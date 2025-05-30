import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { 
  TimeEntryFilters, 
  PaginationResponse, 
  ErrorResponse,
  TimeEntry
} from '../shared/types';

const timeEntryRepo = new TimeEntryRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('List time entries request:', JSON.stringify(event, null, 2));

    // Extract user information from authorization context using shared helper
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    
    // Build filters from query parameters
    const filters: TimeEntryFilters = {};

    // User filtering - employees can only see their own entries
    // Managers and admins can see entries for their team/all users
    if (user?.role === 'employee') {
      filters.userId = userId;
    } else if (queryParams.userId) {
      filters.userId = queryParams.userId;
    } else {
      // Default to current user's entries if no specific user requested
      filters.userId = userId;
    }

    // Project filtering
    if (queryParams.projectId) {
      filters.projectId = queryParams.projectId;
    }

    // Task filtering
    if (queryParams.taskId) {
      filters.taskId = queryParams.taskId;
    }

    // Status filtering
    if (queryParams.status) {
      const validStatuses = ['draft', 'submitted', 'approved', 'rejected'];
      if (validStatuses.includes(queryParams.status)) {
        filters.status = queryParams.status as 'draft' | 'submitted' | 'approved' | 'rejected';
      }
    }

    // Billable filtering
    if (queryParams.isBillable !== undefined) {
      filters.isBillable = queryParams.isBillable === 'true';
    }

    // Date range filtering
    if (queryParams.dateFrom) {
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(queryParams.dateFrom)) {
        filters.dateFrom = queryParams.dateFrom;
      }
    }

    if (queryParams.dateTo) {
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(queryParams.dateTo)) {
        filters.dateTo = queryParams.dateTo;
      }
    }

    // Tags filtering
    if (queryParams.tags) {
      filters.tags = queryParams.tags.split(',').map(tag => tag.trim());
    }

    // Pagination
    if (queryParams.limit) {
      const limit = parseInt(queryParams.limit, 10);
      if (!isNaN(limit) && limit > 0 && limit <= 100) {
        filters.limit = limit;
      }
    }

    if (queryParams.offset) {
      const offset = parseInt(queryParams.offset, 10);
      if (!isNaN(offset) && offset >= 0) {
        filters.offset = offset;
      }
    }

    // Sorting
    if (queryParams.sortBy) {
      const validSortFields = ['date', 'duration', 'createdAt', 'updatedAt'];
      if (validSortFields.includes(queryParams.sortBy)) {
        filters.sortBy = queryParams.sortBy as 'date' | 'duration' | 'createdAt' | 'updatedAt';
      }
    }

    if (queryParams.sortOrder) {
      if (queryParams.sortOrder === 'asc' || queryParams.sortOrder === 'desc') {
        filters.sortOrder = queryParams.sortOrder;
      }
    }

    console.log('Applied filters:', JSON.stringify(filters, null, 2));

    // Get time entries
    const result = await timeEntryRepo.listTimeEntries(filters);

    console.log(`Retrieved ${result.items.length} time entries`);

    return createSuccessResponse({
      items: result.items,
      pagination: result.pagination,
    }, 200, 'Time entries retrieved successfully');

  } catch (error) {
    console.error('Error listing time entries:', error);

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
  }
};
