import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId } from '../../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../../shared/response-helper';
import { SessionRepository } from '../../shared/session-repository';

// PowerTools v2.x imports
import { logger, businessLogger, addRequestContext } from '../../shared/powertools-logger';
import { tracer, businessTracer } from '../../shared/powertools-tracer';
import { metrics, businessMetrics } from '../../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools v2.x middleware
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const sessionRepo = new SessionRepository();

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('User logout request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/logout', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'logout', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Get current request's user agent and IP for session matching with tracing
    const sessionContext = await businessTracer.traceBusinessOperation(
      'extract-session-context',
      'session',
      async () => {
        const currentUserAgent = event.headers['User-Agent'] || event.headers['user-agent'] || '';
        const currentIP = getClientIP(event);
        return { currentUserAgent, currentIP };
      }
    );

    logger.info('Logout request parsed', { 
      currentUserId,
      userAgent: sessionContext.currentUserAgent,
      clientIP: sessionContext.currentIP
    });

    // Find and delete the current session using repository with tracing
    const sessionResult = await businessTracer.traceDatabaseOperation(
      'find-and-delete-current-session',
      'sessions',
      async () => {
        const currentSession = await sessionRepo.findCurrentSession(
          currentUserId, 
          sessionContext.currentUserAgent, 
          sessionContext.currentIP
        );
        
        let sessionId: string | undefined;
        if (currentSession) {
          await sessionRepo.deleteSession(currentSession.sessionId);
          sessionId = currentSession.sessionId;
        }
        
        return { sessionId, sessionFound: !!currentSession };
      }
    );

    // Also clean up any expired sessions for this user using repository with tracing
    await businessTracer.traceDatabaseOperation(
      'cleanup-expired-sessions',
      'sessions',
      async () => {
        return await sessionRepo.cleanupExpiredSessions(currentUserId);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/logout', 'POST', 200, responseTime);
    businessLogger.logBusinessOperation('logout', 'session', currentUserId, true, { 
      sessionId: sessionResult.sessionId,
      sessionFound: sessionResult.sessionFound,
      userAgent: sessionContext.currentUserAgent,
      clientIP: sessionContext.currentIP
    });

    logger.info('User logout completed successfully', { 
      currentUserId,
      sessionId: sessionResult.sessionId,
      sessionFound: sessionResult.sessionFound,
      responseTime 
    });

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse({ 
      message: 'Logout successful',
      sessionId: sessionResult.sessionId 
    }, 200);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/users/logout', 'POST', 500, responseTime);
    businessLogger.logError(error as Error, 'logout', getCurrentUserId(event) || 'unknown');

    logger.error('Logout error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

function getClientIP(event: APIGatewayProxyEvent): string {
  // Check various headers in order of preference
  const xForwardedFor = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
  const xRealIP = event.headers['x-real-ip'] || event.headers['X-Real-IP'];
  const cfConnectingIP = event.headers['cf-connecting-ip'] || event.headers['CF-Connecting-IP'];
  const sourceIP = event.requestContext.identity.sourceIp;
  
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first (original client)
    return xForwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  
  return xRealIP || cfConnectingIP || sourceIP || 'unknown';
}

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 