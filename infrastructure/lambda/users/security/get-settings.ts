import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../../shared/auth-helper';
import { createErrorResponse } from '../../shared/response-helper';
import { UserRepository } from '../../shared/user-repository';
import { 
  UserSecuritySettings, 
  SuccessResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const user = getAuthenticatedUser(event);

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Authorization check: users can only access their own security settings
    if (userId !== currentUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only access your own security settings'
      );
    }

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const userRepo = new UserRepository();
    const userData = await userRepo.getUserById(userId);

    if (!userData) {
      return createErrorResponse(404, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User not found');
    }

    // Extract security settings from user data or use defaults
    // For now, we'll simulate security settings based on user data and defaults
    // In a real implementation, security settings might be in a separate table or user field
    let securitySettings: UserSecuritySettings = { ...DEFAULT_SECURITY_SETTINGS };

    // Calculate password expiration if applicable
    let passwordExpiresAt: string | undefined;
    if (securitySettings.securitySettings.requirePasswordChangeEvery > 0) {
      const passwordDate = new Date(securitySettings.passwordLastChanged);
      passwordDate.setDate(passwordDate.getDate() + securitySettings.securitySettings.requirePasswordChangeEvery);
      passwordExpiresAt = passwordDate.toISOString();
    }

    // Update security settings with calculated values
    securitySettings = {
      ...securitySettings,
      passwordExpiresAt,
      passwordChangeRequired: false, // Always false in response for security
    };

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
    console.error('Error getting security settings:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
  }
}; 