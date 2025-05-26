import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Client } from '../shared/types';
import { ValidationService } from '../shared/validation';
import { ClientRepository } from '../shared/client-repository';
import { getCurrentUserId } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';

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

    return createSuccessResponse(newClient, 201, 'Client created successfully');

  } catch (error) {
    console.error('Error creating client:', error);
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(409, 'CLIENT_ALREADY_EXISTS', 'A client with this ID already exists');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
