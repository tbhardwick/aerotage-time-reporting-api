import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../../shared/auth-helper';
import { createErrorResponse } from '../../shared/response-helper';
import { SessionRepository } from '../../shared/session-repository';
import { CognitoIdentityProviderClient, AdminSetUserPasswordCommand } from '@aws-sdk/client-cognito-identity-provider';
import { 
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
const cognitoClient = new CognitoIdentityProviderClient({});

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Change password request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/security/password', 'PUT', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'change-password', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userEmail = user?.email;

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/security/password', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('User ID is required'), 'change-password-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Authorization check: users can only change their own password with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-password-change-access',
      'security',
      async () => {
        if (userId !== currentUserId) {
          return { canChange: false, reason: 'not_own_password' };
        }
        if (!userEmail) {
          return { canChange: false, reason: 'no_user_email' };
        }
        return { canChange: true };
      }
    );

    if (!accessControl.canChange) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/security/password', 'PUT', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'change-password', false, { 
        requestedUserId: userId,
        reason: 'access_denied',
        accessReason: accessControl.reason,
        hasUserEmail: !!userEmail
      });
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only change your own password'
      );
    }

    // Parse and validate request body with tracing
    const passwordData = await businessTracer.traceBusinessOperation(
      'parse-password-change-request',
      'security',
      async () => {
        if (!event.body) {
          throw new Error('Request body is required');
        }
        return JSON.parse(event.body) as ChangePasswordRequest;
      }
    );

    const passwordValidation = await businessTracer.traceBusinessOperation(
      'validate-new-password',
      'security',
      async () => {
        return validatePassword(passwordData.newPassword);
      }
    );

    if (!passwordValidation.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/security/password', 'PUT', 400, responseTime);
      businessLogger.logError(new Error(`Password validation failed: ${passwordValidation.message}`), 'change-password-validation', currentUserId);
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 
        passwordValidation.message
      );
    }

    // Check password history to prevent reuse with tracing
    const passwordHistoryCheck = await businessTracer.traceDatabaseOperation(
      'check-password-history',
      'user_sessions',
      async () => {
        return await sessionRepo.checkPasswordHistory(userId, passwordData.newPassword);
      }
    );

    if (passwordHistoryCheck) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/security/password', 'PUT', 400, responseTime);
      businessLogger.logBusinessOperation('change', 'password', currentUserId, false, { 
        requestedUserId: userId,
        reason: 'password_reused' 
      });
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 
        'Password cannot be one of your last 5 passwords'
      );
    }

    // Get security settings to check lockout status with tracing
    const securitySettings = await businessTracer.traceDatabaseOperation(
      'get-user-security-settings',
      'user_sessions',
      async () => {
        return await sessionRepo.getUserSecuritySettingsById(userId);
      }
    );

    const lockoutCheck = await businessTracer.traceBusinessOperation(
      'check-account-lockout',
      'security',
      async () => {
        if (securitySettings && securitySettings.accountLockedUntil) {
          const lockoutTime = new Date(securitySettings.accountLockedUntil);
          if (lockoutTime > new Date()) {
            return { isLocked: true, lockedUntil: lockoutTime.toISOString() };
          }
        }
        return { isLocked: false };
      }
    );

    if (lockoutCheck.isLocked) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/security/password', 'PUT', 423, responseTime);
      businessLogger.logBusinessOperation('change', 'password', currentUserId, false, { 
        requestedUserId: userId,
        reason: 'account_locked',
        lockedUntil: lockoutCheck.lockedUntil
      });
      return createErrorResponse(
        423, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'Account is temporarily locked due to failed login attempts'
      );
    }

    logger.info('Password change request parsed and validated', { 
      currentUserId,
      requestedUserId: userId,
      userEmail,
      isSelfChange: userId === currentUserId,
      hasSecuritySettings: !!securitySettings,
      failedLoginAttempts: securitySettings?.failedLoginAttempts || 0
    });

    // Update password in Cognito with tracing
    await businessTracer.traceBusinessOperation(
      'update-cognito-password',
      'security',
      async () => {
        try {
          await cognitoClient.send(new AdminSetUserPasswordCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID!,
            Username: userEmail,
            Password: passwordData.newPassword,
            Permanent: true,
          }));
        } catch (cognitoError: unknown) {
          logger.error('Cognito password update error', { 
            error: cognitoError instanceof Error ? cognitoError.message : 'Unknown error',
            userEmail,
            userId 
          });
          throw new Error('Failed to update password in Cognito');
        }
      }
    );

    // Store password in history and update security settings with tracing
    await businessTracer.traceDatabaseOperation(
      'update-password-security-data',
      'user_sessions',
      async () => {
        // Store password in history
        await sessionRepo.storePasswordHistory(userId, passwordData.newPassword);
        
        // Update security settings with new password change timestamp
        await sessionRepo.updatePasswordChangeTimestamp(userId);
        
        // Reset failed login attempts if any
        if (securitySettings && securitySettings.failedLoginAttempts > 0) {
          await sessionRepo.resetFailedLoginAttempts(userId);
        }
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/{id}/security/password', 'PUT', 200, responseTime);
    businessLogger.logBusinessOperation('change', 'password', currentUserId, true, { 
      requestedUserId: userId,
      userEmail,
      isSelfChange: userId === currentUserId,
      hadFailedAttempts: (securitySettings?.failedLoginAttempts || 0) > 0,
      resetFailedAttempts: (securitySettings?.failedLoginAttempts || 0) > 0
    });

    logger.info('Password changed successfully', { 
      currentUserId,
      requestedUserId: userId,
      userEmail,
      isSelfChange: userId === currentUserId,
      responseTime 
    });

    const response: SuccessResponse<{ message: string }> = {
      success: true,
      data: {
        message: 'Password updated successfully'
      },
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
    
    businessMetrics.trackApiPerformance('/users/{id}/security/password', 'PUT', 500, responseTime);
    businessLogger.logError(error as Error, 'change-password', getCurrentUserId(event) || 'unknown');

    logger.error('Error changing password', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedUserId: event.pathParameters?.id,
      responseTime
    });

    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message.includes('Request body is required')) {
        return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required');
      }
      if (error.message.includes('Failed to update password in Cognito')) {
        return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Failed to update password');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

function validatePassword(password: string): { isValid: boolean; message: string } {
  if (!password || password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }

  if (!/[A-Za-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one letter' };
  }

  if (!/\d/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character' };
  }

  return { isValid: true, message: '' };
}

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 