import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { 
  Client,
  SuccessResponse
} from '../shared/types';
import { ValidationService } from '../shared/validation';
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

    // Role-based access control
    if (userRole === 'employee') {
      // Employees cannot update clients
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to update clients');
    }
    // Managers and admins can update clients

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

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
