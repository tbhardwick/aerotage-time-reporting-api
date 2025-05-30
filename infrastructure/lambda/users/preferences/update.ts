import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../../shared/auth-helper';
import { createErrorResponse } from '../../shared/response-helper';
import { UserRepository } from '../../shared/user-repository';
import { 
  UpdateUserPreferencesRequest,
  UserPreferences, 
  SuccessResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

// Default preferences for merging
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  notifications: true,
  timezone: 'America/New_York',
  timeTracking: {
    defaultTimeEntryDuration: 60,
    autoStartTimer: false,
    showTimerInMenuBar: true,
    defaultBillableStatus: true,
    reminderInterval: 0,
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

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required');
    }

    const updateData: UpdateUserPreferencesRequest = JSON.parse(event.body);

    // Authorization check: users can only update their own preferences unless they're admin
    if (userId !== currentUserId && userRole !== 'admin') {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only update your own preferences'
      );
    }

    // Validate input data
    const validationError = validateUpdateRequest(updateData);
    if (validationError) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validationError);
    }

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const userRepo = new UserRepository();
    const userData = await userRepo.getUserById(userId);

    if (!userData) {
      return createErrorResponse(404, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User not found');
    }

    // Start with existing preferences or defaults
    const currentPreferences: UserPreferences = userData.preferences ? {
      ...DEFAULT_PREFERENCES,
      ...userData.preferences
    } : { ...DEFAULT_PREFERENCES };

    // Merge updates with current preferences
    const updatedPreferences: UserPreferences = {
      theme: updateData.theme ?? currentPreferences.theme,
      notifications: updateData.notifications ?? currentPreferences.notifications,
      timezone: updateData.timezone ?? currentPreferences.timezone,
      timeTracking: {
        defaultTimeEntryDuration: 
          updateData.timeTracking?.defaultTimeEntryDuration ?? 
          currentPreferences.timeTracking.defaultTimeEntryDuration,
        autoStartTimer: 
          updateData.timeTracking?.autoStartTimer ?? 
          currentPreferences.timeTracking.autoStartTimer,
        showTimerInMenuBar: 
          updateData.timeTracking?.showTimerInMenuBar ?? 
          currentPreferences.timeTracking.showTimerInMenuBar,
        defaultBillableStatus: 
          updateData.timeTracking?.defaultBillableStatus ?? 
          currentPreferences.timeTracking.defaultBillableStatus,
        reminderInterval: 
          updateData.timeTracking?.reminderInterval ?? 
          currentPreferences.timeTracking.reminderInterval,
        workingHours: {
          start: 
            updateData.timeTracking?.workingHours?.start ?? 
            currentPreferences.timeTracking.workingHours.start,
          end: 
            updateData.timeTracking?.workingHours?.end ?? 
            currentPreferences.timeTracking.workingHours.end,
        },
        timeGoals: {
          daily: 
            updateData.timeTracking?.timeGoals?.daily ?? 
            currentPreferences.timeTracking.timeGoals.daily,
          weekly: 
            updateData.timeTracking?.timeGoals?.weekly ?? 
            currentPreferences.timeTracking.timeGoals.weekly,
          notifications: 
            updateData.timeTracking?.timeGoals?.notifications ?? 
            currentPreferences.timeTracking.timeGoals.notifications,
        },
      },
      formatting: {
        currency: 
          updateData.formatting?.currency ?? 
          currentPreferences.formatting.currency,
        dateFormat: 
          updateData.formatting?.dateFormat ?? 
          currentPreferences.formatting.dateFormat,
        timeFormat: 
          updateData.formatting?.timeFormat ?? 
          currentPreferences.formatting.timeFormat,
      },
      updatedAt: new Date().toISOString(),
    };

    // Update user preferences using repository pattern
    await userRepo.updateUser(userId, { 
      preferences: updatedPreferences 
    });

    const response: SuccessResponse<UserPreferences> = {
      success: true,
      data: updatedPreferences,
      message: 'Preferences updated successfully',
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
    console.error('Error updating user preferences:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

function validateUpdateRequest(data: UpdateUserPreferencesRequest): string | null {
  // Validate theme
  if (data.theme && !['light', 'dark'].includes(data.theme)) {
    return 'Theme must be either "light" or "dark"';
  }

  // Validate timezone (basic check)
  if (data.timezone && !/^[A-Za-z_]+\/[A-Za-z_]+$/.test(data.timezone)) {
    return 'Invalid timezone format';
  }

  // Validate time tracking settings
  if (data.timeTracking) {
    if (data.timeTracking.defaultTimeEntryDuration !== undefined && 
        (data.timeTracking.defaultTimeEntryDuration < 1 || data.timeTracking.defaultTimeEntryDuration > 480)) {
      return 'Default time entry duration must be between 1 and 480 minutes';
    }

    if (data.timeTracking.reminderInterval !== undefined && 
        (data.timeTracking.reminderInterval < 0 || data.timeTracking.reminderInterval > 240)) {
      return 'Reminder interval must be between 0 and 240 minutes';
    }

    if (data.timeTracking.workingHours) {
      if (data.timeTracking.workingHours.start && 
          !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.timeTracking.workingHours.start)) {
        return 'Working hours start time must be in HH:MM format';
      }

      if (data.timeTracking.workingHours.end && 
          !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.timeTracking.workingHours.end)) {
        return 'Working hours end time must be in HH:MM format';
      }
    }

    if (data.timeTracking.timeGoals) {
      if (data.timeTracking.timeGoals.daily !== undefined && 
          (data.timeTracking.timeGoals.daily < 0 || data.timeTracking.timeGoals.daily > 24)) {
        return 'Daily time goal must be between 0 and 24 hours';
      }

      if (data.timeTracking.timeGoals.weekly !== undefined && 
          (data.timeTracking.timeGoals.weekly < 0 || data.timeTracking.timeGoals.weekly > 168)) {
        return 'Weekly time goal must be between 0 and 168 hours';
      }
    }
  }

  // Validate formatting settings
  if (data.formatting) {
    if (data.formatting.currency && !/^[A-Z]{3}$/.test(data.formatting.currency)) {
      return 'Currency must be a 3-letter ISO code (e.g., USD)';
    }

    if (data.formatting.timeFormat && !['12h', '24h'].includes(data.formatting.timeFormat)) {
      return 'Time format must be either "12h" or "24h"';
    }
  }

  return null;
} 