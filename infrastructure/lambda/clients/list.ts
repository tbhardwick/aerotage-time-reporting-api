import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
// Removed unused imports
import { ValidationService } from '../shared/validation';
import { ClientRepository, ClientFilters } from '../shared/client-repository';
import { getCurrentUserId } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Log request for debugging in development

  try {
    // Get current user from authorization context
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const filters: ClientFilters = {
      isActive: queryParams.isActive ? queryParams.isActive === 'true' : undefined,
      limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
      sortBy: queryParams.sortBy as 'name' | 'createdAt' | undefined,
      sortOrder: queryParams.sortOrder as 'asc' | 'desc' | undefined,
    };

    // Validate filters
    const validation = ValidationService.validateClientFilters(filters);
    if (!validation.isValid) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    const clientRepository = new ClientRepository();

    // Get clients with pagination
    const result = await clientRepository.listClients(filters);

    // TODO: Implement role-based filtering
    // For now, return all clients. In the future, we should:
    // - Admins: see all clients
    // - Managers: see all clients
    // - Employees: see only active clients they work on projects for

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
    // Log error for debugging
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
