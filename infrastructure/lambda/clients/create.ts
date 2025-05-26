import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  Client,
  SuccessResponse,
  ErrorResponse
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { ClientRepository } from '../shared/client-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Create client request:', JSON.stringify(event, null, 2));

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
    const validation = ValidationService.validateCreateClientRequest(requestBody);
    if (!validation.isValid) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    const clientRepository = new ClientRepository();

    // Check if client name already exists
    const nameExists = await clientRepository.checkClientNameExists(requestBody.name);
    if (nameExists) {
      return createErrorResponse(409, 'CLIENT_NAME_EXISTS', 'A client with this name already exists');
    }

    // Create the client
    const newClient = await clientRepository.createClient(requestBody);

    const response: SuccessResponse<Client> = {
      success: true,
      data: newClient,
      message: 'Client created successfully',
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
    console.error('Error creating client:', error);
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(409, 'CLIENT_ALREADY_EXISTS', 'A client with this ID already exists');
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
