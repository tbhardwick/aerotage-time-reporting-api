import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  SubmitTimeEntriesRequest, 
  TimeEntryErrorCodes, 
  SuccessResponse, 
  ErrorResponse,
  BulkTimeEntryResponse
} from '../shared/types';

const timeEntryRepo = new TimeEntryRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Submit time entries request:', JSON.stringify(event, null, 2));

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

    let requestData: SubmitTimeEntriesRequest;
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

    // Validate request data
    const validationErrors: string[] = [];
    
    if (!requestData.timeEntryIds || !Array.isArray(requestData.timeEntryIds)) {
      validationErrors.push('timeEntryIds must be an array');
    } else if (requestData.timeEntryIds.length === 0) {
      validationErrors.push('at least one time entry ID is required');
    } else if (requestData.timeEntryIds.length > 50) {
      validationErrors.push('maximum 50 time entries can be submitted at once');
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

    // Verify ownership of all time entries before submitting any
    const ownershipErrors: string[] = [];
    
    for (const timeEntryId of requestData.timeEntryIds) {
      try {
        const timeEntry = await timeEntryRepo.getTimeEntry(timeEntryId);
        
        if (!timeEntry) {
          ownershipErrors.push(`Time entry ${timeEntryId} not found`);
          continue;
        }

        // Users can only submit their own time entries
        // Managers and admins can submit entries for their team members
        if (timeEntry.userId !== userId && userRole === 'employee') {
          ownershipErrors.push(`You can only submit your own time entries (${timeEntryId})`);
          continue;
        }

        // Check if time entry is in a submittable state
        if (timeEntry.status !== 'draft' && timeEntry.status !== 'rejected') {
          ownershipErrors.push(`Time entry ${timeEntryId} is already submitted or approved`);
          continue;
        }

        // Validate that the time entry has required data
        if (!timeEntry.description || timeEntry.description.trim().length === 0) {
          ownershipErrors.push(`Time entry ${timeEntryId} is missing description`);
          continue;
        }

        if (timeEntry.duration <= 0) {
          ownershipErrors.push(`Time entry ${timeEntryId} has invalid duration`);
          continue;
        }
      } catch (error) {
        ownershipErrors.push(`Error checking time entry ${timeEntryId}: ${(error as Error).message}`);
      }
    }

    if (ownershipErrors.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: TimeEntryErrorCodes.UNAUTHORIZED_TIME_ENTRY_ACCESS,
            message: 'Cannot submit time entries',
            details: ownershipErrors,
          },
        } as ErrorResponse),
      };
    }

    // Submit the time entries
    const result = await timeEntryRepo.submitTimeEntries(requestData.timeEntryIds, userId);

    console.log(`Submitted ${result.successful.length} time entries, ${result.failed.length} failed`);

    // Determine response status based on results
    let statusCode = 200;
    let message = 'All time entries submitted successfully';

    if (result.failed.length > 0) {
      if (result.successful.length === 0) {
        statusCode = 400;
        message = 'Failed to submit any time entries';
      } else {
        statusCode = 207; // Multi-status
        message = 'Some time entries submitted successfully';
      }
    }

    const response: SuccessResponse<BulkTimeEntryResponse> = {
      success: true,
      data: result,
      message,
    };

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Error submitting time entries:', error);

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
