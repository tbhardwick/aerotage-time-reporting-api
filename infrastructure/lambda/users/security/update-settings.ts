import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId } from '../../shared/auth-helper';
import { createErrorResponse } from '../../shared/response-helper';
import { SessionRepository } from '../../shared/session-repository';
import { 
  UpdateUserSecuritySettingsRequest,
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

const sessionRepo = new SessionRepository();

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Update security settings request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/security/settings', 'PUT', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'update-security-settings', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/security/settings', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('User ID is required'), 'update-security-settings-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Authorization check: users can only update their own security settings with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-security-settings-update-access',
      'security',
      async () => {
        if (userId !== currentUserId) {
          return { canUpdate: false, reason: 'not_own_security_settings' };
        }
        return { canUpdate: true };
      }
    );

    if (!accessControl.canUpdate) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/security/settings', 'PUT', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'update-security-settings', false, { 
        requestedUserId: userId,
        reason: 'access_denied',
        accessReason: accessControl.reason
      });
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only update your own security settings'
      );
    }

    // Parse and validate request body with tracing
    const updateData = await businessTracer.traceBusinessOperation(
      'parse-security-settings-update-request',
      'security',
      async () => {
        if (!event.body) {
          throw new Error('Request body is required');
        }
        return JSON.parse(event.body) as UpdateUserSecuritySettingsRequest;
      }
    );

    const validationError = await businessTracer.traceBusinessOperation(
      'validate-security-settings-update-data',
      'security',
      async () => {
        return validateUpdateRequest(updateData);
      }
    );

    if (validationError) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/security/settings', 'PUT', 400, responseTime);
      businessLogger.logError(new Error(`Validation failed: ${validationError}`), 'update-security-settings-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validationError);
    }

    logger.info('Security settings update request parsed', { 
      currentUserId,
      requestedUserId: userId,
      isSelfUpdate: userId === currentUserId,
      updateFields: Object.keys(updateData),
      hasSessionTimeoutUpdate: updateData.sessionTimeout !== undefined,
      hasMultipleSessionsUpdate: updateData.allowMultipleSessions !== undefined
    });

    // Update security settings using repository with tracing
    const updatedSettings = await businessTracer.traceDatabaseOperation(
      'update-user-security-settings',
      'user_sessions',
      async () => {
        return await sessionRepo.updateUserSecuritySettings(userId, updateData);
      }
    );

    // Transform back to API response format with tracing
    const responseData = await businessTracer.traceBusinessOperation(
      'transform-security-settings-response',
      'security',
      async () => {
        let passwordExpiresAt: string | undefined;
        if (updatedSettings.requirePasswordChangeEvery > 0) {
          const passwordDate = new Date(updatedSettings.passwordLastChanged);
          passwordDate.setDate(passwordDate.getDate() + updatedSettings.requirePasswordChangeEvery);
          passwordExpiresAt = passwordDate.toISOString();
        }

        return {
          twoFactorEnabled: updatedSettings.twoFactorEnabled,
          sessionTimeout: updatedSettings.sessionTimeout,
          allowMultipleSessions: updatedSettings.allowMultipleSessions,
          passwordChangeRequired: false,
          passwordLastChanged: updatedSettings.passwordLastChanged,
          passwordExpiresAt,
          securitySettings: {
            requirePasswordChangeEvery: updatedSettings.requirePasswordChangeEvery,
            maxFailedLoginAttempts: 5, // Fixed value
            accountLockoutDuration: 30, // Fixed value
          },
        } as UserSecuritySettings;
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/{id}/security/settings', 'PUT', 200, responseTime);
    businessLogger.logBusinessOperation('update', 'security-settings', currentUserId, true, { 
      requestedUserId: userId,
      isSelfUpdate: userId === currentUserId,
      updatedFields: Object.keys(updateData),
      newSessionTimeout: responseData.sessionTimeout,
      newAllowMultipleSessions: responseData.allowMultipleSessions,
      newPasswordChangeFrequency: responseData.securitySettings.requirePasswordChangeEvery
    });

    logger.info('Security settings updated successfully', { 
      currentUserId,
      requestedUserId: userId,
      isSelfUpdate: userId === currentUserId,
      updatedFields: Object.keys(updateData),
      newSessionTimeout: responseData.sessionTimeout,
      responseTime 
    });

    const response: SuccessResponse<UserSecuritySettings> = {
      success: true,
      data: responseData,
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
    
    businessMetrics.trackApiPerformance('/users/{id}/security/settings', 'PUT', 500, responseTime);
    businessLogger.logError(error as Error, 'update-security-settings', getCurrentUserId(event) || 'unknown');

    logger.error('Error updating security settings', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedUserId: event.pathParameters?.id,
      responseTime
    });

    // Handle specific business logic errors
    if (error instanceof Error && error.message.includes('Request body is required')) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required');
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

function validateUpdateRequest(data: UpdateUserSecuritySettingsRequest): string | null {
  // Validate session timeout
  if (data.sessionTimeout !== undefined) {
    if (typeof data.sessionTimeout !== 'number' || data.sessionTimeout < 15 || data.sessionTimeout > 43200) {
      return 'Session timeout must be between 15 minutes and 30 days (43200 minutes)';
    }
  }

  // Validate allow multiple sessions
  if (data.allowMultipleSessions !== undefined) {
    if (typeof data.allowMultipleSessions !== 'boolean') {
      return 'Allow multiple sessions must be a boolean value';
    }
  }

  // Validate password change frequency
  if (data.requirePasswordChangeEvery !== undefined) {
    if (typeof data.requirePasswordChangeEvery !== 'number' || data.requirePasswordChangeEvery < 0 || data.requirePasswordChangeEvery > 365) {
      return 'Password change frequency must be between 0 (never) and 365 days';
    }
  }

  return null;
}

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 