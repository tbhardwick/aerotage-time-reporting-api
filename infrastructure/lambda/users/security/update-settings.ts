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

const sessionRepo = new SessionRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Authorization check: users can only update their own security settings
    if (userId !== currentUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only update your own security settings'
      );
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required');
    }

    const updateData: UpdateUserSecuritySettingsRequest = JSON.parse(event.body);

    // Validate input data
    const validationError = validateUpdateRequest(updateData);
    if (validationError) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validationError);
    }

    // Update security settings using repository
    const updatedSettings = await sessionRepo.updateUserSecuritySettings(userId, updateData);

    // Transform back to API response format
    let passwordExpiresAt: string | undefined;
    if (updatedSettings.requirePasswordChangeEvery > 0) {
      const passwordDate = new Date(updatedSettings.passwordLastChanged);
      passwordDate.setDate(passwordDate.getDate() + updatedSettings.requirePasswordChangeEvery);
      passwordExpiresAt = passwordDate.toISOString();
    }

    const responseData: UserSecuritySettings = {
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
    };

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
    console.error('Update security settings error:', error);
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