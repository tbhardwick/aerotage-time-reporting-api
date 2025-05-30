import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  SubmitTimeEntriesRequest, 
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

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let requestData: SubmitTimeEntriesRequest;
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
      validationErrors.push('maximum 50 time entries can be submitted at once');
    }

    if (validationErrors.length > 0) {
      return createErrorResponse(400, TimeEntryErrorCodes.INVALID_TIME_ENTRY_DATA, `Validation failed: ${validationErrors.join(', ')}`);
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
        if (timeEntry.userId !== currentUserId && userRole === 'employee') {
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
      return createErrorResponse(400, TimeEntryErrorCodes.UNAUTHORIZED_TIME_ENTRY_ACCESS, `Cannot submit time entries: ${ownershipErrors.join(', ')}`);
    }

    // Submit the time entries using repository pattern
    const result = await timeEntryRepo.submitTimeEntries(requestData.timeEntryIds, currentUserId);

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
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
