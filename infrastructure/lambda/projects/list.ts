import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  Project
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { ProjectRepository, ProjectFilters } from '../shared/project-repository';
import { getCurrentUserId } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('List projects request:', JSON.stringify(event, null, 2));

  try {
    // Get current user from authorization context
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const filters: ProjectFilters = {
      clientId: queryParams.clientId,
      status: queryParams.status as any,
      teamMember: queryParams.teamMember,
      limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
      sortBy: queryParams.sortBy as any,
      sortOrder: queryParams.sortOrder as any,
    };

    // Validate filters
    const validation = ValidationService.validateProjectFilters(filters);
    if (!validation.isValid) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    const projectRepository = new ProjectRepository();

    // Get projects with pagination
    const result = await projectRepository.listProjects(filters);

    // TODO: Implement role-based filtering
    // For now, return all projects. In the future, we should:
    // - Admins: see all projects
    // - Managers: see projects they manage or are team members of
    // - Employees: see only projects they are team members of

    const responseData = {
      items: result.projects,
      pagination: {
        total: result.total,
        limit: filters.limit || 50,
        offset: filters.offset || 0,
        hasMore: result.hasMore,
      },
    };

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(responseData, 200, 'Projects retrieved successfully');

  } catch {
    console.error('Error listing projects');
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
