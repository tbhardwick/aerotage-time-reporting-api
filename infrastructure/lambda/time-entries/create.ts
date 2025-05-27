import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { 
  CreateTimeEntryRequest, 
  TimeEntryErrorCodes, 
  SuccessResponse, 
  ErrorResponse 
} from '../shared/types';

const timeEntryRepo = new TimeEntryRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Create time entry request:', JSON.stringify(event, null, 2));

    // Extract user information from authorization context using shared helper
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let requestData: CreateTimeEntryRequest;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate required fields
    const validationErrors: string[] = [];
    
    if (!requestData.projectId) {
      validationErrors.push('projectId is required');
    }
    
    if (!requestData.description || requestData.description.trim().length === 0) {
      validationErrors.push('description is required');
    }
    
    if (!requestData.date) {
      validationErrors.push('date is required');
    } else {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(requestData.date)) {
        validationErrors.push('date must be in YYYY-MM-DD format');
      } else {
        // Check if date is not in the future
        const entryDate = new Date(requestData.date);
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        
        if (entryDate > today) {
          validationErrors.push('date cannot be in the future');
        }
      }
    }

    // Validate time fields if provided
    if (requestData.startTime && requestData.endTime) {
      const startTime = new Date(requestData.startTime);
      const endTime = new Date(requestData.endTime);
      
      if (startTime >= endTime) {
        validationErrors.push('endTime must be after startTime');
      }
      
      // Calculate duration and validate
      const calculatedDuration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      if (calculatedDuration <= 0) {
        validationErrors.push('duration must be positive');
      }
      
      if (requestData.duration && Math.abs(requestData.duration - calculatedDuration) > 1) {
        validationErrors.push('provided duration does not match calculated duration from start and end times');
      }
    } else if (requestData.duration) {
      if (requestData.duration <= 0) {
        validationErrors.push('duration must be positive');
      }
      if (requestData.duration > (24 * 60)) { // 24 hours in minutes
        validationErrors.push('duration cannot exceed 24 hours');
      }
    } else {
      validationErrors.push('either duration or both startTime and endTime must be provided');
    }

    // Validate hourly rate if provided
    if (requestData.hourlyRate !== undefined && requestData.hourlyRate < 0) {
      validationErrors.push('hourlyRate must be non-negative');
    }

    // Validate tags if provided
    if (requestData.tags && requestData.tags.length > 10) {
      validationErrors.push('maximum 10 tags allowed');
    }

    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: TimeEntryErrorCodes.INVALID_TIME_ENTRY_DATA,
            message: 'Validation failed',
            details: validationErrors,
          },
          timestamp: new Date().toISOString(),
        } as ErrorResponse),
      };
    }

    // TODO: Validate project access (check if user has access to the project)
    // This would require querying the projects table
    // For now, we'll assume the user has access

    // Create the time entry
    const timeEntry = await timeEntryRepo.createTimeEntry(userId, requestData);

    console.log('Time entry created successfully:', timeEntry.id);

    return createSuccessResponse(timeEntry, 201, 'Time entry created successfully');

  } catch (error) {
    console.error('Error creating time entry:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === TimeEntryErrorCodes.PROJECT_NOT_FOUND) {
        return createErrorResponse(404, TimeEntryErrorCodes.PROJECT_NOT_FOUND, 'Project not found');
      }

      if (error.message === TimeEntryErrorCodes.PROJECT_ACCESS_DENIED) {
        return createErrorResponse(403, TimeEntryErrorCodes.PROJECT_ACCESS_DENIED, 'Access denied to project');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
  }
};
