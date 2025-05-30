import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  QuickTimeEntryRequest,
  TimeEntry,
  TimeTrackingErrorCodes,
  SuccessResponse
} from '../shared/types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_TIME_ENTRY_DATA, 'Request body is required');
    }

    let request: QuickTimeEntryRequest;
    try {
      request = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_TIME_ENTRY_DATA, 'Invalid JSON in request body');
    }

    // Validate the request
    const validationError = await validateQuickTimeEntry(request, currentUserId);
    if (validationError) {
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_TIME_ENTRY_DATA, validationError);
    }

    // Calculate duration
    const startTime = new Date(`${request.date}T${request.startTime}:00`);
    const endTime = new Date(`${request.date}T${request.endTime}:00`);
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const timeEntryRepo = new TimeEntryRepository();
    const timeEntry = await timeEntryRepo.createTimeEntry(currentUserId, {
      projectId: request.projectId,
      description: request.description,
      date: request.date,
      startTime: `${request.date}T${request.startTime}:00.000Z`,
      endTime: `${request.date}T${request.endTime}:00.000Z`,
      duration: durationMinutes,
      isBillable: request.isBillable ?? true,
      notes: request.fillGap ? 'Created via quick entry to fill time gap' : undefined,
    });

    // MANDATORY: Standardized success response format
    const response: SuccessResponse<TimeEntry> = {
      success: true,
      data: timeEntry,
    };

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Function error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
  }
};

async function validateQuickTimeEntry(request: QuickTimeEntryRequest, userId: string): Promise<string | null> {
  // Validate required fields
  if (!request.date || !request.startTime || !request.endTime || !request.projectId || !request.description) {
    return 'Missing required fields: date, startTime, endTime, projectId, description';
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(request.date)) {
    return 'Date must be in YYYY-MM-DD format';
  }

  // Validate time format
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(request.startTime) || !timeRegex.test(request.endTime)) {
    return 'Times must be in HH:MM format';
  }

  // Validate time range
  const startTime = new Date(`${request.date}T${request.startTime}:00`);
  const endTime = new Date(`${request.date}T${request.endTime}:00`);
  
  if (startTime >= endTime) {
    return 'Start time must be before end time';
  }

  const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  if (durationMinutes > 24 * 60) { // Max 24 hours
    return 'Duration cannot exceed 24 hours';
  }

  if (durationMinutes < 1) { // Min 1 minute
    return 'Duration must be at least 1 minute';
  }

  // Check for future dates
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (endTime > today) {
    return 'Cannot create time entries for future dates';
  }

  // MANDATORY: Use repository pattern for overlap check
  const timeEntryRepo = new TimeEntryRepository();
  const existingEntries = await timeEntryRepo.listTimeEntries({
    userId: userId,
    dateFrom: request.date,
    dateTo: request.date,
    limit: 100
  });

  // Check for overlaps with existing entries
  const newStart = new Date(`${request.date}T${request.startTime}:00`);
  const newEnd = new Date(`${request.date}T${request.endTime}:00`);

  for (const entry of existingEntries.items) {
    if (entry.startTime && entry.endTime) {
      const existingStart = new Date(entry.startTime);
      const existingEnd = new Date(entry.endTime);

      // Check if times overlap
      if (newStart < existingEnd && newEnd > existingStart) {
        return 'Time entry overlaps with existing entry';
      }
    }
  }

  return null;
} 