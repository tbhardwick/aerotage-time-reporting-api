import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { ProjectRepository } from '../shared/project-repository';
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

    // Authorization check: Only managers and admins can create projects
    if (userRole === 'employee') {
      return createErrorResponse(403, 'FORBIDDEN', 'Only managers and admins can create projects');
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Basic validation - ensure required fields are present
    if (!requestBody.name || typeof requestBody.name !== 'string') {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Project name is required and must be a string');
    }

    if (!requestBody.clientId || typeof requestBody.clientId !== 'string') {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Client ID is required and must be a string');
    }

    if (typeof requestBody.defaultBillable !== 'boolean') {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Default billable status is required and must be a boolean');
    }

    // Add current user as creator
    requestBody.createdBy = currentUserId;

    // MANDATORY: Use repository pattern instead of direct DynamoDB
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
    console.error('Error creating project:', error);
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(409, 'PROJECT_ALREADY_EXISTS', 'A project with this ID already exists');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
