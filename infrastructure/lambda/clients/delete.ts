import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  SuccessResponse,
  ErrorResponse
} from '../shared/types';
import { ClientRepository } from '../shared/client-repository';
import { ProjectRepository } from '../shared/project-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Delete client request:', JSON.stringify(event, null, 2));

  try {
    // Get current user from authorization context
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

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

    // TODO: Implement role-based access control
    // For now, allow all authenticated users to delete clients
    // In the future, we should check:
    // - Admins: can delete any client
    // - Managers: can delete clients
    // - Employees: cannot delete clients

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

    const response: SuccessResponse<null> = {
      success: true,
      data: null,
      message: hardDelete ? 'Client permanently deleted' : 'Client deactivated successfully',
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Error deleting client:', error);
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(404, 'CLIENT_NOT_FOUND', 'Client not found');
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
          message: 'An internal server error occurred',
        },
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

/**
 * Extracts current user ID from authorization context
 */
function getCurrentUserId(event: APIGatewayProxyEvent): string | null {
  const authContext = event.requestContext.authorizer;
  
  // Primary: get from custom authorizer context
  if (authContext?.userId) {
    return authContext.userId;
  }

  // Fallback: try to get from Cognito claims
  if (authContext?.claims?.sub) {
    return authContext.claims.sub;
  }

  return null;
}

/**
 * Creates standardized error response
 */
function createErrorResponse(
  statusCode: number, 
  errorCode: string, 
  message: string
): APIGatewayProxyResult {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
    },
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(errorResponse),
  };
}
