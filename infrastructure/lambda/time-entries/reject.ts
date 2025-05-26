import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  RejectTimeEntriesRequest, 
  TimeEntryErrorCodes, 
  SuccessResponse, 
  ErrorResponse,
  BulkTimeEntryResponse
} from '../shared/types';

const timeEntryRepo = new TimeEntryRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Reject time entries request:', JSON.stringify(event, null, 2));

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

    // Check if user has approval permissions (manager or admin)
    if (userRole !== 'manager' && userRole !== 'admin') {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: TimeEntryErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS,
            message: 'Only managers and admins can reject time entries',
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

    let requestData: RejectTimeEntriesRequest;
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
      validationErrors.push('maximum 50 time entries can be rejected at once');
    }

    if (!requestData.rejectionReason || requestData.rejectionReason.trim().length === 0) {
      validationErrors.push('rejectionReason is required');
    } else if (requestData.rejectionReason.length > 500) {
      validationErrors.push('rejectionReason cannot exceed 500 characters');
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

    // Verify that all time entries can be rejected
    const rejectionErrors: string[] = [];
    
    for (const timeEntryId of requestData.timeEntryIds) {
      try {
        const timeEntry = await timeEntryRepo.getTimeEntry(timeEntryId);
        
        if (!timeEntry) {
          rejectionErrors.push(`Time entry ${timeEntryId} not found`);
          continue;
        }

        // Check if time entry is in a rejectable state
        if (timeEntry.status !== 'submitted') {
          rejectionErrors.push(`Time entry ${timeEntryId} is not submitted for approval (status: ${timeEntry.status})`);
          continue;
        }

        // TODO: Add team-based authorization check
        // Managers should only be able to reject entries from their team members
        // For now, we'll allow any manager/admin to reject any entry
      } catch (error) {
        rejectionErrors.push(`Error checking time entry ${timeEntryId}: ${(error as Error).message}`);
      }
    }

    if (rejectionErrors.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: TimeEntryErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS,
            message: 'Cannot reject time entries',
            details: rejectionErrors,
          },
        } as ErrorResponse),
      };
    }

    // Reject the time entries
    const result = await timeEntryRepo.rejectTimeEntries(
      requestData.timeEntryIds, 
      userId, 
      requestData.rejectionReason
    );

    console.log(`Rejected ${result.successful.length} time entries, ${result.failed.length} failed`);

    // Determine response status based on results
    let statusCode = 200;
    let message = 'All time entries rejected successfully';

    if (result.failed.length > 0) {
      if (result.successful.length === 0) {
        statusCode = 400;
        message = 'Failed to reject any time entries';
      } else {
        statusCode = 207; // Multi-status
        message = 'Some time entries rejected successfully';
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
    console.error('Error rejecting time entries:', error);

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
