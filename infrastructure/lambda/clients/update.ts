import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  Client,
  SuccessResponse,
  ErrorResponse
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { ClientRepository } from '../shared/client-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Update client request:', JSON.stringify(event, null, 2));

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

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate request
    const validation = ValidationService.validateUpdateClientRequest(requestBody);
    if (!validation.isValid) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    const clientRepository = new ClientRepository();

    // Check if client exists
    const existingClient = await clientRepository.getClientById(clientId);
    if (!existingClient) {
      return createErrorResponse(404, 'CLIENT_NOT_FOUND', 'Client not found');
    }

    // TODO: Implement role-based access control
    // For now, allow all authenticated users to update clients
    // In the future, we should check:
    // - Admins: can update any client
    // - Managers: can update clients
    // - Employees: cannot update clients

    // If name is being changed, check if new name already exists
    if (requestBody.name && requestBody.name !== existingClient.name) {
      const nameExists = await clientRepository.checkClientNameExists(requestBody.name, clientId);
      if (nameExists) {
        return createErrorResponse(409, 'CLIENT_NAME_EXISTS', 'A client with this name already exists');
      }
    }

    // Update the client
    const updatedClient = await clientRepository.updateClient(clientId, requestBody);

    const response: SuccessResponse<Client> = {
      success: true,
      data: updatedClient,
      message: 'Client updated successfully',
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
    console.error('Error updating client:', error);
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(404, 'CLIENT_NOT_FOUND', 'Client not found');
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
