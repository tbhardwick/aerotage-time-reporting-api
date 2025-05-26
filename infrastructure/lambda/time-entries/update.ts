import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  UpdateTimeEntryRequest, 
  TimeEntryErrorCodes, 
  SuccessResponse, 
  ErrorResponse 
} from '../shared/types';

const timeEntryRepo = new TimeEntryRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Update time entry request:', JSON.stringify(event, null, 2));

    // Extract user information from authorizer context
    const authContext = event.requestContext.authorizer;
    const userId = authContext?.userId || authContext?.claims?.sub;
    const userRole = authContext?.role || authContext?.claims?.['custom:role'];

    if (!userId) {
      console.error('No user ID found in authorization context');
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        } as ErrorResponse),
      };
    }

    // Get time entry ID from path parameters
    const timeEntryId = event.pathParameters?.id;
    if (!timeEntryId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Time entry ID is required',
          },
        } as ErrorResponse),
      };
    }

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request body is required',
          },
        } as ErrorResponse),
      };
    }

    let requestData: UpdateTimeEntryRequest;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON in request body',
          },
        } as ErrorResponse),
      };
    }

    // Get existing time entry to check ownership and status
    const existingTimeEntry = await timeEntryRepo.getTimeEntry(timeEntryId);
    if (!existingTimeEntry) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND,
            message: 'Time entry not found',
          },
        } as ErrorResponse),
      };
    }

    // Check authorization - users can only update their own entries
    // Managers and admins can update entries for their team members
    if (existingTimeEntry.userId !== userId && userRole === 'employee') {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: TimeEntryErrorCodes.UNAUTHORIZED_TIME_ENTRY_ACCESS,
            message: 'You can only update your own time entries',
          },
        } as ErrorResponse),
      };
    }

    // Validate that the time entry can be updated (only draft and rejected entries)
    if (existingTimeEntry.status !== 'draft' && existingTimeEntry.status !== 'rejected') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED,
            message: 'Cannot update time entry that has been submitted or approved',
          },
        } as ErrorResponse),
      };
    }

    // Validate update data
    const validationErrors: string[] = [];
    
    if (requestData.description !== undefined && requestData.description.trim().length === 0) {
      validationErrors.push('description cannot be empty');
    }
    
    if (requestData.date !== undefined) {
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
    const startTime = requestData.startTime || existingTimeEntry.startTime;
    const endTime = requestData.endTime || existingTimeEntry.endTime;
    
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (start >= end) {
        validationErrors.push('endTime must be after startTime');
      }
      
      // Calculate duration and validate
      const calculatedDuration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      if (calculatedDuration <= 0) {
        validationErrors.push('duration must be positive');
      }
      
      if (requestData.duration && Math.abs(requestData.duration - calculatedDuration) > 1) {
        validationErrors.push('provided duration does not match calculated duration from start and end times');
      }
    } else if (requestData.duration !== undefined) {
      if (requestData.duration <= 0) {
        validationErrors.push('duration must be positive');
      }
      if (requestData.duration > (24 * 60)) { // 24 hours in minutes
        validationErrors.push('duration cannot exceed 24 hours');
      }
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
        } as ErrorResponse),
      };
    }

    // Update the time entry
    const updatedTimeEntry = await timeEntryRepo.updateTimeEntry(timeEntryId, requestData);

    console.log('Time entry updated successfully:', timeEntryId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: updatedTimeEntry,
        message: 'Time entry updated successfully',
      } as SuccessResponse),
    };

  } catch (error) {
    console.error('Error updating time entry:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            error: {
              code: TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND,
              message: 'Time entry not found',
            },
          } as ErrorResponse),
        };
      }

      if (error.message === TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            error: {
              code: TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED,
              message: 'Cannot update submitted or approved time entry',
            },
          } as ErrorResponse),
        };
      }
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      } as ErrorResponse),
    };
  }
};
