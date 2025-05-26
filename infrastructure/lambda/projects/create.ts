import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  Project,
  SuccessResponse,
  ErrorResponse,
  TimeEntryErrorCodes
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { ProjectRepository } from '../shared/project-repository';
import { ClientRepository } from '../shared/client-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Create project request:', JSON.stringify(event, null, 2));

  try {
    // Get current user from authorization context
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Add current user as creator
    requestBody.createdBy = currentUserId;

    // Validate request
    const validation = ValidationService.validateCreateProjectRequest(requestBody);
    if (!validation.isValid) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    const projectRepository = new ProjectRepository();
    const clientRepository = new ClientRepository();

    // Verify client exists and is active
    const client = await clientRepository.getClientById(requestBody.clientId);
    if (!client) {
      return createErrorResponse(404, 'CLIENT_NOT_FOUND', 'The specified client does not exist');
    }
    if (!client.isActive) {
      return createErrorResponse(400, 'CLIENT_INACTIVE', 'Cannot create project for inactive client');
    }

    // Ensure client name matches
    requestBody.clientName = client.name;

    // Create the project
    const newProject = await projectRepository.createProject(requestBody);

    const response: SuccessResponse<Project> = {
      success: true,
      data: newProject,
      message: 'Project created successfully',
    };

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Error creating project:', error);
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(409, 'PROJECT_ALREADY_EXISTS', 'A project with this ID already exists');
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
