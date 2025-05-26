import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  TimeEntryErrorCodes, 
  SuccessResponse, 
  ErrorResponse 
} from '../shared/types';

const timeEntryRepo = new TimeEntryRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Delete time entry request:', JSON.stringify(event, null, 2));

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

    // Check authorization - users can only delete their own entries
    // Managers and admins can delete entries for their team members
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
            message: 'You can only delete your own time entries',
          },
        } as ErrorResponse),
      };
    }

    // Validate that the time entry can be deleted (only draft and rejected entries)
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
            message: 'Cannot delete time entry that has been submitted or approved',
          },
        } as ErrorResponse),
      };
    }

    // Delete the time entry
    await timeEntryRepo.deleteTimeEntry(timeEntryId);

    console.log('Time entry deleted successfully:', timeEntryId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Time entry deleted successfully',
      } as SuccessResponse),
    };

  } catch (error) {
    console.error('Error deleting time entry:', error);

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
              message: 'Cannot delete submitted or approved time entry',
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
