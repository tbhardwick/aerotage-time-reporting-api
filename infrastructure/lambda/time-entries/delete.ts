import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  TimeEntryErrorCodes
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

    // Get time entry ID from path parameters
    const timeEntryId = event.pathParameters?.id;
    if (!timeEntryId) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Time entry ID is required');
    }

    // Get existing time entry to check ownership and status
    const existingTimeEntry = await timeEntryRepo.getTimeEntry(timeEntryId);
    if (!existingTimeEntry) {
      return createErrorResponse(404, TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND, 'Time entry not found');
    }

    // Check authorization - users can only delete their own entries
    // Managers and admins can delete entries for their team members
    if (existingTimeEntry.userId !== currentUserId && userRole === 'employee') {
      return createErrorResponse(403, TimeEntryErrorCodes.UNAUTHORIZED_TIME_ENTRY_ACCESS, 'You can only delete your own time entries');
    }

    // Validate that the time entry can be deleted (only draft and rejected entries)
    if (existingTimeEntry.status !== 'draft' && existingTimeEntry.status !== 'rejected') {
      return createErrorResponse(400, TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED, 'Cannot delete time entry that has been submitted or approved');
    }

    // Delete the time entry
    await timeEntryRepo.deleteTimeEntry(timeEntryId);

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(null, 200, 'Time entry deleted successfully');

  } catch (error) {
    console.error('Error deleting time entry:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND) {
        return createErrorResponse(404, TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND, 'Time entry not found');
      }

      if (error.message === TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED) {
        return createErrorResponse(400, TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED, 'Cannot delete submitted or approved time entry');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
