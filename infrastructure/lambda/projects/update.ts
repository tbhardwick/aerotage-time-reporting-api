import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  Project,
  SuccessResponse,
  ErrorResponse
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { ProjectRepository } from '../shared/project-repository';
import { ClientRepository } from '../shared/client-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Update project request:', JSON.stringify(event, null, 2));

  try {
    // Get current user from authorization context
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Get project ID from path parameters
    const projectId = event.pathParameters?.id;
    if (!projectId) {
      return createErrorResponse(400, 'MISSING_PROJECT_ID', 'Project ID is required');
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (error) {
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

    // TODO: Implement role-based access control
    // For now, allow all authenticated users to update projects
    // In the future, we should check:
    // - Admins: can update any project
    // - Managers: can update projects they manage
    // - Employees: cannot update projects (or only specific fields)

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

    const response: SuccessResponse<Project> = {
      success: true,
      data: updatedProject,
      message: 'Project updated successfully',
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
