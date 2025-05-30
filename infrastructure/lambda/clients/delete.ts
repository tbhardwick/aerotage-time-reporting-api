import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { ClientRepository } from '../shared/client-repository';
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
      // Employees cannot delete clients
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to delete clients');
    }
    // Managers and admins can delete clients

    // Get client ID from path parameters
    const clientId = event.pathParameters?.id;
    if (!clientId) {
      return createErrorResponse(400, 'MISSING_CLIENT_ID', 'Client ID is required');
    }

    const clientRepository = new ClientRepository();
    const projectRepository = new ProjectRepository();

    // Check if client exists
    const existingClient = await clientRepository.getClientById(clientId);
    if (!existingClient) {
      return createErrorResponse(404, 'CLIENT_NOT_FOUND', 'Client not found');
    }

    // Check if client has any projects
    const clientProjects = await projectRepository.getProjectsByClientId(clientId);
    if (clientProjects.length > 0) {
      return createErrorResponse(400, 'CLIENT_HAS_PROJECTS', 
        `Cannot delete client. There are ${clientProjects.length} project(s) associated with this client. Please reassign or delete the projects first.`);
    }

    // Check query parameter for hard delete
    const hardDelete = event.queryStringParameters?.hard === 'true';

    if (hardDelete) {
      // Hard delete (permanent removal)
      await clientRepository.hardDeleteClient(clientId);
    } else {
      // Soft delete (set isActive to false)
      await clientRepository.deleteClient(clientId);
    }

    // ✅ FIXED: Use standardized response helper
    const message = hardDelete ? 'Client permanently deleted' : 'Client deactivated successfully';
    return createSuccessResponse(null, 200, message);

  } catch (error) {
    console.error('Error deleting client:', error);
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(404, 'CLIENT_NOT_FOUND', 'Client not found');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
