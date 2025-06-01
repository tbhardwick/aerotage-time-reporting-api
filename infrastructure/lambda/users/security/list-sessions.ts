import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId } from '../../shared/auth-helper';
import { createErrorResponse } from '../../shared/response-helper';
import { SessionRepository } from '../../shared/session-repository';
import { 
  UserSession, 
  SuccessResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

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

    logger.info('List sessions request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions', 'GET', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'list-sessions', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions', 'GET', 400, responseTime);
      businessLogger.logError(new Error('User ID is required'), 'list-sessions-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Authorization check: users can only view their own sessions with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-session-list-access',
      'session',
      async () => {
        if (userId !== currentUserId) {
          return { canList: false, reason: 'not_own_sessions' };
        }
        return { canList: true };
      }
    );

    if (!accessControl.canList) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions', 'GET', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'list-sessions', false, { 
        requestedUserId: userId,
        reason: 'access_denied',
        accessReason: accessControl.reason
      });
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only view your own sessions'
      );
    }

    // Extract current request details for session matching with tracing
    const requestMetadata = await businessTracer.traceBusinessOperation(
      'extract-request-metadata',
      'session',
      async () => {
        const currentUserAgent = event.headers['User-Agent'] || event.headers['user-agent'] || '';
        const currentIP = getClientIP(event);
        const authContext = event.requestContext.authorizer;
        const currentSessionId = authContext?.sessionId;
        
        return { currentUserAgent, currentIP, currentSessionId };
      }
    );

    logger.info('List sessions request parsed', { 
      currentUserId,
      requestedUserId: userId,
      currentIP: requestMetadata.currentIP,
      currentUserAgent: requestMetadata.currentUserAgent,
      isSelfAccess: userId === currentUserId
    });

    // Get formatted sessions using repository with tracing
    const sessions = await businessTracer.traceDatabaseOperation(
      'get-user-sessions',
      'user_sessions',
      async () => {
        return await sessionRepo.getFormattedSessionsForUser(
          userId, 
          requestMetadata.currentUserAgent, 
          requestMetadata.currentIP, 
          requestMetadata.currentSessionId
        );
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/{id}/sessions', 'GET', 200, responseTime);
    businessLogger.logBusinessOperation('list', 'sessions', currentUserId, true, { 
      userId,
      sessionCount: sessions.length,
      currentIP: requestMetadata.currentIP,
      currentUserAgent: requestMetadata.currentUserAgent,
      hasCurrentSession: !!requestMetadata.currentSessionId
    });

    logger.info('Sessions listed successfully', { 
      currentUserId,
      userId,
      sessionCount: sessions.length,
      currentIP: requestMetadata.currentIP,
      responseTime 
    });

    const response: SuccessResponse<UserSession[]> = {
      success: true,
      data: sessions,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/users/{id}/sessions', 'GET', 500, responseTime);
    businessLogger.logError(error as Error, 'list-sessions', getCurrentUserId(event) || 'unknown');

    logger.error('Error listing sessions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedUserId: event.pathParameters?.id,
      responseTime
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
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