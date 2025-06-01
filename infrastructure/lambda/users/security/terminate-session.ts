import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId } from '../../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../../shared/response-helper';
import { SessionRepository } from '../../shared/session-repository';
import { 
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

    logger.info('Terminate session request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions/{sessionId}', 'DELETE', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'terminate-session', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Extract user ID and session ID from path parameters
    const userId = event.pathParameters?.id;
    const sessionId = event.pathParameters?.sessionId;
    
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions/{sessionId}', 'DELETE', 400, responseTime);
      businessLogger.logError(new Error('User ID is required'), 'terminate-session-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }
    
    if (!sessionId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions/{sessionId}', 'DELETE', 400, responseTime);
      businessLogger.logError(new Error('Session ID is required'), 'terminate-session-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 'Session ID is required');
    }

    // Authorization check: users can only terminate their own sessions with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-session-termination-access',
      'session',
      async () => {
        if (userId !== currentUserId) {
          return { canTerminate: false, reason: 'not_own_session' };
        }
        return { canTerminate: true };
      }
    );

    if (!accessControl.canTerminate) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions/{sessionId}', 'DELETE', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'terminate-session', false, { 
        requestedUserId: userId,
        sessionId,
        reason: 'access_denied',
        accessReason: accessControl.reason
      });
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only terminate your own sessions'
      );
    }

    // Get current request metadata with tracing
    const requestMetadata = await businessTracer.traceBusinessOperation(
      'extract-request-metadata',
      'session',
      async () => {
        const currentUserAgent = event.headers['User-Agent'] || event.headers['user-agent'] || '';
        const currentIP = getClientIP(event);
        
        return { currentUserAgent, currentIP };
      }
    );

    logger.info('Terminate session request parsed', { 
      currentUserId,
      requestedUserId: userId,
      sessionId,
      currentIP: requestMetadata.currentIP,
      currentUserAgent: requestMetadata.currentUserAgent,
      isSelfAccess: userId === currentUserId
    });

    // Get the session to verify it exists and belongs to the user with tracing
    const session = await businessTracer.traceDatabaseOperation(
      'get-session-for-termination',
      'user_sessions',
      async () => {
        return await sessionRepo.getSessionById(sessionId);
      }
    );

    if (!session) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions/{sessionId}', 'DELETE', 404, responseTime);
      businessLogger.logBusinessOperation('terminate', 'session', currentUserId, false, { 
        sessionId,
        userId,
        reason: 'session_not_found' 
      });
      return createErrorResponse(404, ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 'Session not found');
    }

    // Verify the session belongs to the authenticated user with tracing
    const sessionValidation = await businessTracer.traceBusinessOperation(
      'validate-session-ownership',
      'session',
      async () => {
        if (session.userId !== currentUserId) {
          return { isValid: false, reason: 'not_session_owner' };
        }
        if (!session.isActive) {
          return { isValid: false, reason: 'session_already_inactive' };
        }
        if (new Date(session.expiresAt) <= new Date()) {
          return { isValid: false, reason: 'session_expired' };
        }
        return { isValid: true };
      }
    );

    if (!sessionValidation.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions/{sessionId}', 'DELETE', 400, responseTime);
      
      let errorMessage = 'Session cannot be terminated';
      let errorCode = ProfileSettingsErrorCodes.SESSION_NOT_FOUND;
      
      if (sessionValidation.reason === 'not_session_owner') {
        errorMessage = 'You can only terminate your own sessions';
        errorCode = ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS;
      } else if (sessionValidation.reason === 'session_already_inactive') {
        errorMessage = 'Session is already inactive';
      } else if (sessionValidation.reason === 'session_expired') {
        errorMessage = 'Session has already expired';
      }

      businessLogger.logBusinessOperation('terminate', 'session', currentUserId, false, { 
        sessionId,
        userId,
        reason: sessionValidation.reason,
        sessionOwner: session.userId,
        isActive: session.isActive,
        expiresAt: session.expiresAt
      });
      
      return createErrorResponse(400, errorCode, errorMessage);
    }

    // Check if the session being terminated is the current session with tracing
    const currentSessionCheck = await businessTracer.traceDatabaseOperation(
      'check-current-session',
      'user_sessions',
      async () => {
        const currentSessionId = await sessionRepo.getCurrentSessionId(
          userId, 
          requestMetadata.currentUserAgent, 
          requestMetadata.currentIP
        );
        return { currentSessionId, isCurrentSession: sessionId === currentSessionId };
      }
    );

    if (currentSessionCheck.isCurrentSession) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions/{sessionId}', 'DELETE', 400, responseTime);
      businessLogger.logBusinessOperation('terminate', 'session', currentUserId, false, { 
        sessionId,
        userId,
        reason: 'cannot_terminate_current_session',
        currentSessionId: currentSessionCheck.currentSessionId
      });
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.CANNOT_TERMINATE_CURRENT_SESSION, 
        'You cannot terminate your current session'
      );
    }

    // Actually delete the session with tracing
    await businessTracer.traceDatabaseOperation(
      'delete-session',
      'user_sessions',
      async () => {
        return await sessionRepo.deleteSession(sessionId);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/{id}/sessions/{sessionId}', 'DELETE', 200, responseTime);
    businessLogger.logBusinessOperation('terminate', 'session', currentUserId, true, { 
      sessionId,
      userId,
      terminatedSessionOwner: session.userId,
      currentIP: requestMetadata.currentIP,
      currentUserAgent: requestMetadata.currentUserAgent,
      sessionWasActive: session.isActive,
      sessionExpiresAt: session.expiresAt
    });

    logger.info('Session terminated successfully', { 
      currentUserId,
      sessionId,
      userId,
      terminatedSessionOwner: session.userId,
      currentIP: requestMetadata.currentIP,
      responseTime 
    });

    return createSuccessResponse({ 
      message: 'Session terminated successfully'
    }, 200);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/users/{id}/sessions/{sessionId}', 'DELETE', 500, responseTime);
    businessLogger.logError(error as Error, 'terminate-session', getCurrentUserId(event) || 'unknown');

    logger.error('Error terminating session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedUserId: event.pathParameters?.id,
      sessionId: event.pathParameters?.sessionId,
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