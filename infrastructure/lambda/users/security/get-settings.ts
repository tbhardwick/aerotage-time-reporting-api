import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId } from '../../shared/auth-helper';
import { createErrorResponse } from '../../shared/response-helper';
import { UserRepository } from '../../shared/user-repository';
import { 
  UserSecuritySettings, 
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

// Default security settings for new users
const DEFAULT_SECURITY_SETTINGS: UserSecuritySettings = {
  twoFactorEnabled: false,
  sessionTimeout: 480, // 8 hours
  allowMultipleSessions: true,
  passwordChangeRequired: false,
  passwordLastChanged: new Date().toISOString(),
  securitySettings: {
    requirePasswordChangeEvery: 0, // Never
    maxFailedLoginAttempts: 5,
    accountLockoutDuration: 30, // 30 minutes
  },
};

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Get security settings request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/security/settings', 'GET', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'get-security-settings', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/security/settings', 'GET', 400, responseTime);
      businessLogger.logError(new Error('User ID is required'), 'get-security-settings-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Authorization check: users can only access their own security settings with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-security-settings-access',
      'security',
      async () => {
        if (userId !== currentUserId) {
          return { canAccess: false, reason: 'not_own_security_settings' };
        }
        return { canAccess: true };
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/security/settings', 'GET', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'get-security-settings', false, { 
        requestedUserId: userId,
        reason: 'access_denied',
        accessReason: accessControl.reason
      });
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only access your own security settings'
      );
    }

    logger.info('Security settings request parsed', { 
      currentUserId,
      requestedUserId: userId,
      isSelfAccess: userId === currentUserId
    });

    // Get user data with tracing
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
      businessMetrics.trackApiPerformance('/users/{id}/security/settings', 'GET', 404, responseTime);
      businessLogger.logBusinessOperation('get', 'security-settings', currentUserId, false, { 
        requestedUserId: userId,
        reason: 'user_not_found' 
      });
      return createErrorResponse(404, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User not found');
    }

    // Prepare security settings with tracing
    const securitySettings = await businessTracer.traceBusinessOperation(
      'prepare-security-settings',
      'security',
      async () => {
        // Extract security settings from user data or use defaults
        let settings: UserSecuritySettings = { ...DEFAULT_SECURITY_SETTINGS };

        // Calculate password expiration if applicable
        let passwordExpiresAt: string | undefined;
        if (settings.securitySettings.requirePasswordChangeEvery > 0) {
          const passwordDate = new Date(settings.passwordLastChanged);
          passwordDate.setDate(passwordDate.getDate() + settings.securitySettings.requirePasswordChangeEvery);
          passwordExpiresAt = passwordDate.toISOString();
        }

        // Update security settings with calculated values
        return {
          ...settings,
          passwordExpiresAt,
          passwordChangeRequired: false, // Always false in response for security
        };
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/{id}/security/settings', 'GET', 200, responseTime);
    businessLogger.logBusinessOperation('get', 'security-settings', currentUserId, true, { 
      requestedUserId: userId,
      isSelfAccess: userId === currentUserId,
      twoFactorEnabled: securitySettings.twoFactorEnabled,
      sessionTimeout: securitySettings.sessionTimeout,
      allowMultipleSessions: securitySettings.allowMultipleSessions
    });

    logger.info('Security settings retrieved successfully', { 
      currentUserId,
      requestedUserId: userId,
      isSelfAccess: userId === currentUserId,
      twoFactorEnabled: securitySettings.twoFactorEnabled,
      sessionTimeout: securitySettings.sessionTimeout,
      responseTime 
    });

    const response: SuccessResponse<UserSecuritySettings> = {
      success: true,
      data: securitySettings,
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
    
    businessMetrics.trackApiPerformance('/users/{id}/security/settings', 'GET', 500, responseTime);
    businessLogger.logError(error as Error, 'get-security-settings', getCurrentUserId(event) || 'unknown');

    logger.error('Error getting security settings', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedUserId: event.pathParameters?.id,
      responseTime
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 