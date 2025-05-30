import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../../shared/auth-helper';
import { createErrorResponse } from '../../shared/response-helper';
import { SessionRepository } from '../../shared/session-repository';
import { CognitoIdentityProviderClient, AdminSetUserPasswordCommand } from '@aws-sdk/client-cognito-identity-provider';
import { 
  SuccessResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

const sessionRepo = new SessionRepository();
const cognitoClient = new CognitoIdentityProviderClient({});

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userEmail = user?.email;

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Authorization check: users can only change their own password
    if (userId !== currentUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only change your own password'
      );
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required');
    }

    const { currentPassword, newPassword }: ChangePasswordRequest = JSON.parse(event.body);

    // Validate password requirements
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 
        passwordValidation.message
      );
    }

    // Check password history to prevent reuse using repository
    const isPasswordReused = await sessionRepo.checkPasswordHistory(userId, newPassword);
    if (isPasswordReused) {
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 
        'Password cannot be one of your last 5 passwords'
      );
    }

    // Get security settings to check lockout status using repository
    const securitySettings = await sessionRepo.getUserSecuritySettingsById(userId);
    if (securitySettings && securitySettings.accountLockedUntil) {
      const lockoutTime = new Date(securitySettings.accountLockedUntil);
      if (lockoutTime > new Date()) {
        return createErrorResponse(
          423, 
          ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
          'Account is temporarily locked due to failed login attempts'
        );
      }
    }

    // Update password in Cognito
    try {
      await cognitoClient.send(new AdminSetUserPasswordCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: userEmail,
        Password: newPassword,
        Permanent: true,
      }));
    } catch (cognitoError: any) {
      console.error('Cognito password update error:', cognitoError);
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 
        'Failed to update password'
      );
    }

    // Store password in history using repository
    await sessionRepo.storePasswordHistory(userId, newPassword);

    // Update security settings with new password change timestamp using repository
    await sessionRepo.updatePasswordChangeTimestamp(userId);

    // Reset failed login attempts if any using repository
    if (securitySettings && securitySettings.failedLoginAttempts > 0) {
      await sessionRepo.resetFailedLoginAttempts(userId);
    }

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
    console.error('Change password error:', error);
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