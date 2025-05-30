import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  ApproveTimeEntriesRequest, 
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
      return createErrorResponse(403, TimeEntryErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'Only managers and admins can approve time entries');
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let requestData: ApproveTimeEntriesRequest;
    try {
      requestData = JSON.parse(event.body);
    } catch {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
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
      return createErrorResponse(400, TimeEntryErrorCodes.INVALID_TIME_ENTRY_DATA, `Validation failed: ${validationErrors.join(', ')}`);
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
        if (timeEntry.userId === currentUserId) {
          // Since only managers and admins can reach this point, self-approval is allowed
          // (Employees are already blocked by the authorization check above)
        }

        // TODO: Add team-based authorization check
        // Managers should only be able to approve entries from their team members
        // For now, we'll allow any manager/admin to approve any entry
      } catch (error) {
        approvalErrors.push(`Error checking time entry ${timeEntryId}: ${(error as Error).message}`);
      }
    }

    if (approvalErrors.length > 0) {
      return createErrorResponse(400, TimeEntryErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, `Cannot approve time entries: ${approvalErrors.join(', ')}`);
    }

    // Approve the time entries using repository pattern
    // Allow self-approval for managers and admins (no higher authority)
    const allowSelfApproval = userRole === 'manager' || userRole === 'admin';
    const result = await timeEntryRepo.approveTimeEntries(requestData.timeEntryIds, currentUserId, allowSelfApproval);

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
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
