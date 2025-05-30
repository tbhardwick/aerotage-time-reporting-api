import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { ProjectRepository } from '../shared/project-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Role-based access control
    if (userRole === 'employee') {
      // Employees cannot delete projects
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to delete projects');
    }
    // Managers and admins can delete projects

    // Get project ID from path parameters
    const projectId = event.pathParameters?.id;
    if (!projectId) {
      return createErrorResponse(400, 'MISSING_PROJECT_ID', 'Project ID is required');
    }

    const projectRepository = new ProjectRepository();

    // Check if project exists
    const existingProject = await projectRepository.getProjectById(projectId);
    if (!existingProject) {
      return createErrorResponse(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    // TODO: Check for dependencies before deletion
    // In the future, we should check:
    // - Are there any time entries associated with this project?
    // - Are there any invoices associated with this project?
    // - Should we soft delete instead of hard delete?

    // For now, we'll do a hard delete
    await projectRepository.deleteProject(projectId);

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(null, 200, 'Project deleted successfully');

  } catch (error) {
    console.error('Error deleting project:', error);
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(404, 'PROJECT_NOT_FOUND', 'Project not found');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
