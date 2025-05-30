import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { ValidationService } from '../shared/validation';
import { ProjectRepository } from '../shared/project-repository';
import { ClientRepository } from '../shared/client-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Get project ID from path parameters
    const projectId = event.pathParameters?.id;
    if (!projectId) {
      return createErrorResponse(400, 'MISSING_PROJECT_ID', 'Project ID is required');
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate request
    const validation = ValidationService.validateUpdateProjectRequest(requestBody);
    if (!validation.isValid) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    const projectRepository = new ProjectRepository();
    const clientRepository = new ClientRepository();

    // Check if project exists
    const existingProject = await projectRepository.getProjectById(projectId);
    if (!existingProject) {
      return createErrorResponse(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    // Role-based access control
    if (userRole === 'employee') {
      // Employees cannot update projects
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to update projects');
    } else if (userRole === 'manager') {
      // Managers can update projects they manage
      // TODO: Implement team/project association check when user teams are implemented
      // For now, allow managers to update any project
    }
    // Admins can update any project (no additional restrictions)

    // If client is being changed, verify the new client exists and is active
    if (requestBody.clientId && requestBody.clientId !== existingProject.clientId) {
      const client = await clientRepository.getClientById(requestBody.clientId);
      if (!client) {
        return createErrorResponse(404, 'CLIENT_NOT_FOUND', 'The specified client does not exist');
      }
      if (!client.isActive) {
        return createErrorResponse(400, 'CLIENT_INACTIVE', 'Cannot assign project to inactive client');
      }
      // Update client name to match
      requestBody.clientName = client.name;
    }

    // Update the project
    const updatedProject = await projectRepository.updateProject(projectId, requestBody);

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(updatedProject, 200, 'Project updated successfully');

  } catch (error) {
    console.error('Error updating project:', error);
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(404, 'PROJECT_NOT_FOUND', 'Project not found');
      }
      if (error.message.includes('No valid updates provided')) {
        return createErrorResponse(400, 'NO_UPDATES', 'No valid updates provided');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
