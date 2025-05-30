import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { ClientRepository, ClientFilters } from '../shared/client-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const filters: ClientFilters = {
      isActive: queryParams.isActive ? queryParams.isActive === 'true' : undefined,
      limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
      sortBy: queryParams.sortBy as 'name' | 'createdAt' | undefined,
      sortOrder: queryParams.sortOrder as 'asc' | 'desc' | undefined,
    };

    // Basic validation
    if (filters.limit && (filters.limit < 1 || filters.limit > 100)) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Limit must be between 1 and 100');
    }

    if (filters.offset && filters.offset < 0) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Offset must be non-negative');
    }

    // Role-based access control
    if (userRole === 'employee') {
      // Employees can only see active clients
      filters.isActive = true;
    }

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const clientRepository = new ClientRepository();

    // Get clients with pagination
    const result = await clientRepository.listClients(filters);

    const responseData = {
      items: result.clients,
      pagination: {
        total: result.total,
        limit: filters.limit || 50,
        offset: filters.offset || 0,
        hasMore: result.hasMore,
      },
    };

    return createSuccessResponse(responseData);

  } catch (error) {
    console.error('Error listing clients:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
