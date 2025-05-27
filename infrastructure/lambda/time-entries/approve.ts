import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  ApproveTimeEntriesRequest, 
  TimeEntryErrorCodes, 
  SuccessResponse, 
  ErrorResponse,
  BulkTimeEntryResponse
} from '../shared/types';

const timeEntryRepo = new TimeEntryRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Approve time entries request:', JSON.stringify(event, null, 2));

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
            message: 'Only managers and admins can approve time entries',
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

    let requestData: ApproveTimeEntriesRequest;
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
      validationErrors.push('maximum 50 time entries can be approved at once');
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
            details: { errors: validationErrors },
          },
          timestamp: new Date().toISOString(),
        } as ErrorResponse),
      };
    }

    // Verify that all time entries can be approved
    const approvalErrors: string[] = [];
    
    for (const timeEntryId of requestData.timeEntryIds) {
      try {
        const timeEntry = await timeEntryRepo.getTimeEntry(timeEntryId);
        
        if (!timeEntry) {
          approvalErrors.push(`Time entry ${timeEntryId} not found`);
          continue;
        }

        // Check if time entry is in an approvable state
        if (timeEntry.status !== 'submitted') {
          approvalErrors.push(`Time entry ${timeEntryId} is not submitted for approval (status: ${timeEntry.status})`);
          continue;
        }

        // Check self-approval rules
        // Managers and admins can approve their own entries (no higher authority)
        // Employees cannot approve their own entries
        if (timeEntry.userId === userId) {
          if (userRole === 'employee') {
            approvalErrors.push(`Employees cannot approve their own time entry (${timeEntryId})`);
            continue;
          }
          // Managers and admins can approve their own entries
          console.log(`Self-approval allowed for ${userRole}: ${timeEntryId}`);
        }

        // TODO: Add team-based authorization check
        // Managers should only be able to approve entries from their team members
        // For now, we'll allow any manager/admin to approve any entry
      } catch (error) {
        approvalErrors.push(`Error checking time entry ${timeEntryId}: ${(error as Error).message}`);
      }
    }

    if (approvalErrors.length > 0) {
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
            message: 'Cannot approve time entries',
            details: { errors: approvalErrors },
          },
          timestamp: new Date().toISOString(),
        } as ErrorResponse),
      };
    }

    // Approve the time entries
    // Allow self-approval for managers and admins (no higher authority)
    const allowSelfApproval = userRole === 'manager' || userRole === 'admin';
    const result = await timeEntryRepo.approveTimeEntries(requestData.timeEntryIds, userId, allowSelfApproval);

    console.log(`Approved ${result.successful.length} time entries, ${result.failed.length} failed`);

    // Determine response status based on results
    let statusCode = 200;
    let message = 'All time entries approved successfully';

    if (result.failed.length > 0) {
      if (result.successful.length === 0) {
        statusCode = 400;
        message = 'Failed to approve any time entries';
      } else {
        statusCode = 207; // Multi-status
        message = 'Some time entries approved successfully';
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
    console.error('Error approving time entries:', error);

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
