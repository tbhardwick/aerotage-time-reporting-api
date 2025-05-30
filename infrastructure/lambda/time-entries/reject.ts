import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  RejectTimeEntriesRequest, 
  TimeEntryErrorCodes, 
  SuccessResponse,
  BulkTimeEntryResponse
} from '../shared/types';

const timeEntryRepo = new TimeEntryRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Check if user has approval permissions (manager or admin)
    if (userRole !== 'manager' && userRole !== 'admin') {
      return createErrorResponse(403, TimeEntryErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'Only managers and admins can reject time entries');
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let requestData: RejectTimeEntriesRequest;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
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
      return createErrorResponse(400, TimeEntryErrorCodes.INVALID_TIME_ENTRY_DATA, `Validation failed: ${validationErrors.join(', ')}`);
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
      return createErrorResponse(400, TimeEntryErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, `Cannot reject time entries: ${rejectionErrors.join(', ')}`);
    }

    // Reject the time entries
    const result = await timeEntryRepo.rejectTimeEntries(
      requestData.timeEntryIds, 
      currentUserId, 
      requestData.rejectionReason
    );

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

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
