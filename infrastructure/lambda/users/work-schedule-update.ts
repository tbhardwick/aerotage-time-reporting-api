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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Update work schedule request:', JSON.stringify(event, null, 2));

    // Extract user information
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // Get target user ID from path parameters or use current user
    const targetUserId = event.pathParameters?.userId || userId;

    // Check permissions - employees can only update their own schedule
    if (user?.role === 'employee' && targetUserId !== userId) {
      return createErrorResponse(403, 'FORBIDDEN', 'Employees can only update their own work schedule');
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_WORK_SCHEDULE, 'Request body is required');
    }

    let updateRequest: UpdateWorkScheduleRequest;
    try {
      updateRequest = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_WORK_SCHEDULE, 'Invalid JSON in request body');
    }

    // Validate the update request
    const validationError = validateUpdateRequest(updateRequest);
    if (validationError) {
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_WORK_SCHEDULE, validationError);
    }

    // Get existing work schedule or create default using repository
    let existingSchedule = await userRepo.getUserWorkSchedule(targetUserId);
    if (!existingSchedule) {
      existingSchedule = createDefaultWorkSchedule(targetUserId);
    }

    // Apply updates
    const updatedSchedule = applyUpdates(existingSchedule, updateRequest);

    // Save updated schedule using repository
    await userRepo.updateUserWorkSchedule(updatedSchedule);

    return createSuccessResponse(updatedSchedule, 200, 'Work schedule updated successfully');

  } catch (error) {
    console.error('Error updating work schedule:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
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