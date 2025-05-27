import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
// Removed unused import
import { ValidationService } from '../shared/validation';
import { ProjectRepository } from '../shared/project-repository';
import { ClientRepository } from '../shared/client-repository';
import { getCurrentUserId } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Log request for debugging in development

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
    } catch {
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

    return createSuccessResponse(newProject, 201, 'Project created successfully');

  } catch (error) {
    // Log error for debugging
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(409, 'PROJECT_ALREADY_EXISTS', 'A project with this ID already exists');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
