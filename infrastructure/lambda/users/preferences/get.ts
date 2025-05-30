import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../../shared/auth-helper';
import { createErrorResponse } from '../../shared/response-helper';
import { UserRepository } from '../../shared/user-repository';
import { 
  UserPreferences, 
  SuccessResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Authorization check: users can only access their own preferences unless they're admin
    if (userId !== currentUserId && userRole !== 'admin') {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only access your own preferences'
      );
    }

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const userRepo = new UserRepository();
    const userData = await userRepo.getUserById(userId);

    if (!userData) {
      return createErrorResponse(404, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User not found');
    }

    // Get preferences from user data or return defaults
    const preferences: UserPreferences = userData.preferences ? {
      ...DEFAULT_PREFERENCES,
      ...userData.preferences,
      updatedAt: userData.updatedAt || new Date().toISOString(),
    } : DEFAULT_PREFERENCES;

    const response: SuccessResponse<UserPreferences> = {
      success: true,
      data: preferences,
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
    console.error('Error getting user preferences:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
}; 