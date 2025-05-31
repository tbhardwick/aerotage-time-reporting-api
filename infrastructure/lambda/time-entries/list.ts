import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { 
  TimeEntryFilters
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
    const filters: TimeEntryFilters = {
      userId: queryParams.userId,
      projectId: queryParams.projectId,
      taskId: queryParams.taskId,
      status: queryParams.status as 'draft' | 'submitted' | 'approved' | 'rejected' | undefined,
      dateFrom: queryParams.dateFrom,
      dateTo: queryParams.dateTo,
      limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
      sortBy: queryParams.sortBy as 'date' | 'duration' | 'createdAt' | undefined,
      sortOrder: queryParams.sortOrder as 'asc' | 'desc' | undefined,
    };

    // Apply role-based access control
    const accessControlledFilters = applyAccessControl(filters, userId, user?.role || 'employee');

    // Get time entries with access-controlled filters
    const result = await timeEntryRepo.listTimeEntries(accessControlledFilters);

    return createSuccessResponse({
      items: result.items,
      pagination: result.pagination,
    });

  } catch (error) {
    console.error('Error listing time entries:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to list time entries');
  }
};

function applyAccessControl(filters: TimeEntryFilters, userId: string, userRole: string): TimeEntryFilters {
  // Create a new filters object to avoid mutation
  const controlledFilters = { ...filters };
  
  // Apply role-based filtering
  if (userRole === 'employee') {
    // Employees can only see their own entries
    controlledFilters.userId = userId;
  } else if (!controlledFilters.userId) {
    // For managers/admins, if no specific user is requested, default to current user
    controlledFilters.userId = userId;
  }

  // Validate status filter if present
  if (controlledFilters.status) {
    const validStatuses = ['draft', 'submitted', 'approved', 'rejected'];
    if (!validStatuses.includes(controlledFilters.status)) {
      delete controlledFilters.status;
    }
  }

  return controlledFilters;
}
