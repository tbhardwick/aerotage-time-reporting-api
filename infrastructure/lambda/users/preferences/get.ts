import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../../shared/response-helper';
import { UserRepository } from '../../shared/user-repository';
import { 
  UserPreferences, 
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

// Default preferences for new users
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  notifications: true,
  timezone: 'America/New_York',
  timeTracking: {
    defaultTimeEntryDuration: 60, // 1 hour
    autoStartTimer: false,
    showTimerInMenuBar: true,
    defaultBillableStatus: true,
    reminderInterval: 0, // disabled
    workingHours: {
      start: '09:00',
      end: '17:00',
    },
    timeGoals: {
      daily: 8.0,
      weekly: 40.0,
      notifications: true,
    },
  },
  formatting: {
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
  },
  updatedAt: new Date().toISOString(),
};

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Get user preferences request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/preferences', 'GET', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'get-user-preferences', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/preferences', 'GET', 400, responseTime);
      businessLogger.logError(new Error('User ID is required'), 'get-user-preferences-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    logger.info('Get user preferences request parsed', { 
      currentUserId,
      requestedUserId: userId,
      userRole,
      isSelfAccess: userId === currentUserId
    });

    // Authorization check: users can only access their own preferences unless they're admin with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-preferences-access',
      'user',
      async () => {
        if (userId !== currentUserId && userRole !== 'admin') {
          return { canAccess: false, reason: 'not_own_preferences_or_admin' };
        }
        return { canAccess: true };
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/preferences', 'GET', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'get-user-preferences', false, { 
        requestedUserId: userId,
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only access your own preferences'
      );
    }

    // MANDATORY: Use repository pattern instead of direct DynamoDB with tracing
    const userRepo = new UserRepository();
    const userData = await businessTracer.traceDatabaseOperation(
      'get-user-data',
      'users',
      async () => {
        return await userRepo.getUserById(userId);
      }
    );

    if (!userData) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/preferences', 'GET', 404, responseTime);
      businessLogger.logBusinessOperation('get', 'user-preferences', currentUserId, false, { 
        requestedUserId: userId,
        reason: 'user_not_found' 
      });
      return createErrorResponse(404, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User not found');
    }

    // Get preferences from user data or return defaults with tracing
    const preferences: UserPreferences = await businessTracer.traceBusinessOperation(
      'prepare-user-preferences',
      'user',
      async () => {
        return userData.preferences ? {
          ...DEFAULT_PREFERENCES,
          ...userData.preferences,
          updatedAt: userData.updatedAt || new Date().toISOString(),
        } : DEFAULT_PREFERENCES;
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/{id}/preferences', 'GET', 200, responseTime);
    businessLogger.logBusinessOperation('get', 'user-preferences', currentUserId, true, { 
      requestedUserId: userId,
      targetUserName: userData.name,
      isSelfAccess: userId === currentUserId,
      hasCustomPreferences: !!userData.preferences,
      userRole
    });

    logger.info('User preferences retrieved successfully', { 
      currentUserId,
      requestedUserId: userId,
      targetUserName: userData.name,
      isSelfAccess: userId === currentUserId,
      hasCustomPreferences: !!userData.preferences,
      responseTime 
    });

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(preferences, 200, 'User preferences retrieved successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/users/{id}/preferences', 'GET', 500, responseTime);
    businessLogger.logError(error as Error, 'get-user-preferences', getCurrentUserId(event) || 'unknown');

    logger.error('Error getting user preferences', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedUserId: event.pathParameters?.id,
      responseTime
    });

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
}; 

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 