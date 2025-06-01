import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { UserRepository } from '../shared/user-repository';
import { 
  UserWorkSchedule,
  WorkDaySchedule,
  UpdateWorkScheduleRequest,
  TimeTrackingErrorCodes
} from '../shared/types';

// ✅ NEW: Import PowerTools utilities with correct v2.x pattern
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// ✅ NEW: Import Middy middleware for PowerTools v2.x
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const userRepo = new UserRepository();

// Valid timezones (simplified list)
const VALID_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

// ✅ FIXED: Use correct PowerTools v2.x middleware pattern
const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // ✅ NEW: Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);
    
    logger.info('Work schedule update request started', {
      requestId,
      httpMethod: event.httpMethod,
      path: event.path,
      pathParameters: event.pathParameters,
      hasBody: !!event.body,
    });

    // ✅ NEW: Track API request metrics
    businessMetrics.trackApiPerformance(
      '/users/work-schedule',
      'PUT',
      0, // Will be updated later
      0  // Will be updated later
    );

    // ✅ NEW: Trace authentication
    const authResult = await businessTracer.traceBusinessOperation(
      'authenticate-user',
      'work-schedule-update',
      async () => {
        // Extract user information
        const userId = getCurrentUserId(event);
        const user = getAuthenticatedUser(event);
        
        if (!userId) {
          logger.warn('User not authenticated');
          throw new Error('User not authenticated');
        }

        logger.info('User authenticated successfully', { 
          userId, 
          userRole: user?.role 
        });

        return { userId, user };
      }
    );

    // ✅ NEW: Add user context to tracer
    businessTracer.addUserContext(authResult.userId, authResult.user?.role, authResult.user?.department);
    addRequestContext(requestId, authResult.userId, authResult.user?.role);

    // ✅ NEW: Trace authorization logic
    const authorizationResult = await businessTracer.traceBusinessOperation(
      'authorize-access',
      'work-schedule-update',
      async () => {
        // Get target user ID from path parameters or use current user
        const targetUserId = event.pathParameters?.userId || authResult.userId;

        // Check permissions - employees can only update their own schedule
        if (authResult.user?.role === 'employee' && targetUserId !== authResult.userId) {
          logger.warn('Access denied: employee trying to update other user schedule', {
            currentUserId: authResult.userId,
            targetUserId,
            userRole: authResult.user.role
          });
          throw new Error('Employees can only update their own work schedule');
        }

        logger.info('Authorization passed', { 
          currentUserId: authResult.userId,
          targetUserId,
          userRole: authResult.user?.role 
        });

        return { targetUserId };
      }
    );

    // ✅ NEW: Trace request parsing
    const updateRequest = await businessTracer.traceBusinessOperation(
      'parse-request-body',
      'work-schedule-update',
      async () => {
        // Parse request body
        if (!event.body) {
          logger.warn('Request body is required');
          throw new Error('Request body is required');
        }

        let parsedRequest: UpdateWorkScheduleRequest;
        try {
          parsedRequest = JSON.parse(event.body);
        } catch {
          logger.warn('Invalid JSON in request body');
          throw new Error('Invalid JSON in request body');
        }

        logger.info('Request body parsed successfully', { 
          hasSchedule: !!parsedRequest.schedule,
          timezone: parsedRequest.timezone 
        });

        return parsedRequest;
      }
    );

    // ✅ NEW: Trace validation logic
    const validation = await businessTracer.traceBusinessOperation(
      'validate-update-request',
      'work-schedule-update',
      async () => {
        logger.info('Validating work schedule update request');
        
        const validationError = validateUpdateRequest(updateRequest);
        if (validationError) {
          logger.warn('Validation failed', { error: validationError });
          throw new Error(validationError);
        }

        logger.info('Validation passed successfully');
        return { isValid: true };
      }
    );

    // ✅ NEW: Trace database lookup
    const existingSchedule = await businessTracer.traceDatabaseOperation(
      'get',
      'user-work-schedule',
      async () => {
        logger.info('Fetching existing work schedule from database', { 
          targetUserId: authorizationResult.targetUserId 
        });
        
        let schedule: UserWorkSchedule | null = await userRepo.getUserWorkSchedule(authorizationResult.targetUserId) as UserWorkSchedule | null;
        
        if (!schedule) {
          logger.info('No existing schedule found, creating default');
          schedule = createDefaultWorkSchedule(authorizationResult.targetUserId);
        } else {
          logger.info('Existing work schedule found', { 
            targetUserId: authorizationResult.targetUserId,
            timezone: schedule.timezone
          });
        }

        return schedule;
      }
    );

    // ✅ NEW: Trace update logic
    const updatedSchedule = await businessTracer.traceBusinessOperation(
      'apply-schedule-updates',
      'work-schedule-update',
      async () => {
        logger.info('Applying updates to work schedule');
        
        const updated = applyUpdates(existingSchedule, updateRequest);
        
        logger.info('Updates applied successfully', { 
          targetUserId: authorizationResult.targetUserId,
          timezone: updated.timezone,
          weeklyTargetHours: updated.weeklyTargetHours
        });

        return updated;
      }
    );

    // ✅ NEW: Trace database save
    await businessTracer.traceDatabaseOperation(
      'update',
      'user-work-schedule',
      async () => {
        logger.info('Saving updated work schedule to database');
        
        await userRepo.updateUserWorkSchedule(updatedSchedule as any);
        
        logger.info('Work schedule saved successfully', { 
          targetUserId: authorizationResult.targetUserId 
        });
      }
    );

    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Track successful metrics
    businessMetrics.trackApiPerformance('/users/work-schedule', 'PUT', 200, responseTime);
    businessMetrics.trackBusinessKPI('WorkScheduleUpdated', 1, MetricUnit.Count);
    
    businessLogger.logBusinessOperation('update', 'work-schedule', authResult.userId, true, { 
      targetUserId: authorizationResult.targetUserId,
      timezone: updatedSchedule.timezone,
      weeklyTargetHours: updatedSchedule.weeklyTargetHours
    });

    logger.info('Work schedule updated successfully', { 
      targetUserId: authorizationResult.targetUserId,
      responseTime 
    });

    return createSuccessResponse(updatedSchedule, 200, 'Work schedule updated successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Enhanced error handling with PowerTools
    logger.error('Work schedule update failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime 
    });

    // ✅ NEW: Track error metrics
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let errorMessage = 'An unexpected error occurred';

    if (error instanceof Error) {
      if (error.message === 'User not authenticated') {
        statusCode = 401;
        errorCode = 'UNAUTHORIZED';
        errorMessage = 'User not authenticated';
      } else if (error.message === 'Employees can only update their own work schedule') {
        statusCode = 403;
        errorCode = 'FORBIDDEN';
        errorMessage = 'Employees can only update their own work schedule';
      } else if (error.message === 'Request body is required') {
        statusCode = 400;
        errorCode = TimeTrackingErrorCodes.INVALID_WORK_SCHEDULE;
        errorMessage = 'Request body is required';
      } else if (error.message === 'Invalid JSON in request body') {
        statusCode = 400;
        errorCode = TimeTrackingErrorCodes.INVALID_WORK_SCHEDULE;
        errorMessage = 'Invalid JSON in request body';
      } else if (error.message.includes('Invalid') || error.message.includes('must be')) {
        statusCode = 400;
        errorCode = TimeTrackingErrorCodes.INVALID_WORK_SCHEDULE;
        errorMessage = error.message;
      }
    }

    businessMetrics.trackApiPerformance('/users/work-schedule', 'PUT', statusCode, responseTime);
    businessMetrics.trackBusinessKPI('WorkScheduleUpdateError', 1, MetricUnit.Count);
    businessLogger.logBusinessOperation('update', 'work-schedule', 'unknown', false, { 
      errorCode,
      errorMessage 
    });

    return createErrorResponse(statusCode, errorCode, errorMessage);
  }
};

function createDefaultWorkSchedule(userId: string): UserWorkSchedule {
  const defaultWorkDay: WorkDaySchedule = {
    start: '09:00',
    end: '17:00',
    targetHours: 8,
  };

  const defaultWeekend: WorkDaySchedule = {
    start: null,
    end: null,
    targetHours: 0,
  };

  const now = new Date().toISOString();

  return {
    userId,
    schedule: {
      monday: defaultWorkDay,
      tuesday: defaultWorkDay,
      wednesday: defaultWorkDay,
      thursday: defaultWorkDay,
      friday: defaultWorkDay,
      saturday: defaultWeekend,
      sunday: defaultWeekend,
    },
    timezone: 'America/New_York',
    weeklyTargetHours: 40,
    createdAt: now,
    updatedAt: now,
  };
}

function validateUpdateRequest(request: UpdateWorkScheduleRequest): string | null {
  // Validate timezone if provided
  if (request.timezone && !VALID_TIMEZONES.includes(request.timezone)) {
    return `Invalid timezone. Must be one of: ${VALID_TIMEZONES.join(', ')}`;
  }

  // Validate schedule if provided
  if (request.schedule) {
    for (const [day, daySchedule] of Object.entries(request.schedule)) {
      const validationError = validateDaySchedule(day, daySchedule);
      if (validationError) {
        return validationError;
      }
    }
  }

  return null;
}

function validateDaySchedule(day: string, daySchedule: WorkDaySchedule): string | null {
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  if (!validDays.includes(day)) {
    return `Invalid day: ${day}`;
  }

  // Validate target hours
  if (daySchedule.targetHours < 0 || daySchedule.targetHours > 24) {
    return `Invalid target hours for ${day}: must be between 0 and 24`;
  }

  // If it's a working day (targetHours > 0), validate start and end times
  if (daySchedule.targetHours > 0) {
    if (!daySchedule.start || !daySchedule.end) {
      return `Working day ${day} must have both start and end times`;
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(daySchedule.start) || !timeRegex.test(daySchedule.end)) {
      return `Invalid time format for ${day}: must be HH:MM`;
    }

    // Validate that start time is before end time
    const startTime = new Date(`2000-01-01T${daySchedule.start}:00`);
    const endTime = new Date(`2000-01-01T${daySchedule.end}:00`);
    
    if (startTime >= endTime) {
      return `Start time must be before end time for ${day}`;
    }

    // Validate that target hours don't exceed the time window
    const actualHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    if (daySchedule.targetHours > actualHours) {
      return `Target hours (${daySchedule.targetHours}) exceed available time window (${actualHours}) for ${day}`;
    }
  } else {
    // Non-working day should have null start/end times
    if (daySchedule.start !== null || daySchedule.end !== null) {
      return `Non-working day ${day} should have null start and end times`;
    }
  }

  return null;
}

function applyUpdates(existingSchedule: UserWorkSchedule, updateRequest: UpdateWorkScheduleRequest): UserWorkSchedule {
  const updatedSchedule: UserWorkSchedule = {
    ...existingSchedule,
    updatedAt: new Date().toISOString(),
  };

  // Update timezone if provided
  if (updateRequest.timezone) {
    updatedSchedule.timezone = updateRequest.timezone;
  }

  // Update schedule if provided
  if (updateRequest.schedule) {
    updatedSchedule.schedule = {
      ...existingSchedule.schedule,
      ...updateRequest.schedule,
    };

    // Recalculate weekly target hours
    updatedSchedule.weeklyTargetHours = Object.values(updatedSchedule.schedule)
      .reduce((total, day) => total + day.targetHours, 0);
  }

  return updatedSchedule;
}

// ✅ NEW: Export handler with PowerTools v2.x middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }))
  .use(logMetrics(metrics)); 