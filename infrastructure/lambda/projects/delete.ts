import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  SuccessResponse,
  ErrorResponse
} from '../shared/types';
import { ProjectRepository } from '../shared/project-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Delete project request:', JSON.stringify(event, null, 2));

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

    const projectRepository = new ProjectRepository();

    // Check if project exists
    const existingProject = await projectRepository.getProjectById(projectId);
    if (!existingProject) {
      return createErrorResponse(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    // TODO: Implement role-based access control
    // For now, allow all authenticated users to delete projects
    // In the future, we should check:
    // - Admins: can delete any project
    // - Managers: can delete projects they manage
    // - Employees: cannot delete projects

    // TODO: Check for dependencies before deletion
    // In the future, we should check:
    // - Are there any time entries associated with this project?
    // - Are there any invoices associated with this project?
    // - Should we soft delete instead of hard delete?

    // For now, we'll do a hard delete
    await projectRepository.deleteProject(projectId);

    const response: SuccessResponse<null> = {
      success: true,
      data: null,
      message: 'Project deleted successfully',
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
    console.error('Error deleting project:', error);
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(404, 'PROJECT_NOT_FOUND', 'Project not found');
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
