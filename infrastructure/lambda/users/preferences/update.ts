import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../../shared/response-helper';
import { UserRepository } from '../../shared/user-repository';
import { 
  UpdateUserPreferencesRequest,
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

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Update user preferences request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/preferences', 'PUT', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'update-user-preferences', false, { reason: 'no_user_id' });
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
      businessMetrics.trackApiPerformance('/users/{id}/preferences', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('User ID is required'), 'update-user-preferences-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Parse request body with tracing
    const updateData: UpdateUserPreferencesRequest = await businessTracer.traceBusinessOperation(
      'parse-preferences-update-request',
      'user',
      async () => {
        if (!event.body) {
          throw new Error('Request body is required');
        }
        return JSON.parse(event.body);
      }
    );

    logger.info('Update user preferences request parsed', { 
      currentUserId,
      requestedUserId: userId,
      userRole,
      isSelfAccess: userId === currentUserId,
      hasThemeUpdate: !!updateData.theme,
      hasTimeTrackingUpdate: !!updateData.timeTracking,
      hasFormattingUpdate: !!updateData.formatting
    });

    // Authorization check: users can only update their own preferences unless they're admin with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-preferences-update-access',
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
      businessMetrics.trackApiPerformance('/users/{id}/preferences', 'PUT', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'update-user-preferences', false, { 
        requestedUserId: userId,
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only update your own preferences'
      );
    }

    // Validate input data with tracing
    const validationError = await businessTracer.traceBusinessOperation(
      'validate-preferences-update-data',
      'user',
      async () => {
        return validateUpdateRequest(updateData);
      }
    );

    if (validationError) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/preferences', 'PUT', 400, responseTime);
      businessLogger.logError(new Error(`Validation failed: ${validationError}`), 'update-user-preferences-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validationError);
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
      businessMetrics.trackApiPerformance('/users/{id}/preferences', 'PUT', 404, responseTime);
      businessLogger.logBusinessOperation('update', 'user-preferences', currentUserId, false, { 
        requestedUserId: userId,
        reason: 'user_not_found' 
      });
      return createErrorResponse(404, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User not found');
    }

    // Merge updates with current preferences with tracing
    const updatedPreferences: UserPreferences = await businessTracer.traceBusinessOperation(
      'merge-preferences-updates',
      'user',
      async () => {
        // Start with existing preferences or defaults
        const currentPreferences: UserPreferences = userData.preferences ? {
          ...DEFAULT_PREFERENCES,
          ...userData.preferences
        } : { ...DEFAULT_PREFERENCES };

        // Merge updates with current preferences
        return {
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
      }
    );

    // Update user preferences using repository pattern with tracing
    await businessTracer.traceDatabaseOperation(
      'update-user-preferences',
      'users',
      async () => {
        return await userRepo.updateUser(userId, { 
          preferences: updatedPreferences 
        });
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/{id}/preferences', 'PUT', 200, responseTime);
    businessLogger.logBusinessOperation('update', 'user-preferences', currentUserId, true, { 
      requestedUserId: userId,
      targetUserName: userData.name,
      isSelfAccess: userId === currentUserId,
      updatedFields: Object.keys(updateData),
      userRole
    });

    logger.info('User preferences updated successfully', { 
      currentUserId,
      requestedUserId: userId,
      targetUserName: userData.name,
      isSelfAccess: userId === currentUserId,
      updatedFields: Object.keys(updateData),
      responseTime 
    });

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(updatedPreferences, 200, 'Preferences updated successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/users/{id}/preferences', 'PUT', 500, responseTime);
    businessLogger.logError(error as Error, 'update-user-preferences', getCurrentUserId(event) || 'unknown');

    logger.error('Error updating user preferences', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedUserId: event.pathParameters?.id,
      responseTime
    });

    // Handle specific parsing errors
    if (error instanceof Error && error.message === 'Request body is required') {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required');
    }

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

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 