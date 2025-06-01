import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { ClientRepository } from '../shared/client-repository';
import { ValidationService } from '../shared/validation';

// PowerTools v2.x imports
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools v2.x middleware
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Update client request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients/{id}', 'PUT', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'update-client', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Role-based access control with tracing
    const authorizationResult = await businessTracer.traceBusinessOperation(
      'check-authorization',
      'client',
      async () => {
        if (userRole === 'employee') {
          // Employees cannot update clients
          return { authorized: false, reason: 'insufficient_role' };
        }
        // Managers and admins can update clients
        return { authorized: true };
      }
    );

    if (!authorizationResult.authorized) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients/{id}', 'PUT', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'update-client', false, { 
        reason: authorizationResult.reason,
        userRole 
      });
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to update clients');
    }

    // Get client ID from path parameters
    const clientId = event.pathParameters?.id;
    if (!clientId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients/{id}', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('Client ID is required'), 'update-client-validation', currentUserId);
      return createErrorResponse(400, 'MISSING_CLIENT_ID', 'Client ID is required');
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
      logger.info('Request body parsed successfully', { 
        userId: currentUserId,
        clientId,
        requestDataKeys: Object.keys(requestBody) 
      });
    } catch {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients/{id}', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('Invalid JSON in request body'), 'update-client-parse', currentUserId);
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate request with tracing
    const validationResult = await businessTracer.traceBusinessOperation(
      'validate-update-request',
      'client',
      async () => {
        return ValidationService.validateUpdateClientRequest(requestBody);
      }
    );

    if (!validationResult.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients/{id}', 'PUT', 400, responseTime);
      businessLogger.logBusinessOperation('update', 'client', currentUserId, false, { 
        validationErrors: validationResult.errors,
        clientId 
      });
      return createErrorResponse(400, 'VALIDATION_ERROR', validationResult.errors.join(', '));
    }

    const clientRepository = new ClientRepository();

    // Check if client exists
    const existingClient = await businessTracer.traceDatabaseOperation(
      'get',
      'clients',
      async () => {
        return await clientRepository.getClientById(clientId);
      }
    );

    if (!existingClient) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients/{id}', 'PUT', 404, responseTime);
      businessLogger.logBusinessOperation('update', 'client', currentUserId, false, { 
        reason: 'client_not_found',
        clientId 
      });
      return createErrorResponse(404, 'CLIENT_NOT_FOUND', 'Client not found');
    }

    // If name is being changed, check if new name already exists
    if (requestBody.name && requestBody.name !== existingClient.name) {
      const nameExists = await businessTracer.traceDatabaseOperation(
        'check-name-exists',
        'clients',
        async () => {
          return await clientRepository.checkClientNameExists(requestBody.name, clientId);
        }
      );

      if (nameExists) {
        const responseTime = Date.now() - startTime;
        businessMetrics.trackApiPerformance('/clients/{id}', 'PUT', 409, responseTime);
        businessLogger.logBusinessOperation('update', 'client', currentUserId, false, { 
          reason: 'client_name_exists',
          clientId,
          newName: requestBody.name 
        });
        return createErrorResponse(409, 'CLIENT_NAME_EXISTS', 'A client with this name already exists');
      }
    }

    // Update the client
    const updatedClient = await businessTracer.traceDatabaseOperation(
      'update',
      'clients',
      async () => {
        return await clientRepository.updateClient(clientId, requestBody);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/clients/{id}', 'PUT', 200, responseTime);
    businessMetrics.trackClientOperation('update', true);
    businessLogger.logBusinessOperation('update', 'client', currentUserId, true, { 
      clientId,
      updatedFields: Object.keys(requestBody),
      clientName: updatedClient.name
    });

    logger.info('Client updated successfully', { 
      userId: currentUserId,
      clientId,
      clientName: updatedClient.name,
      responseTime 
    });

    return createSuccessResponse(updatedClient, 200, 'Client updated successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/clients/{id}', 'PUT', 500, responseTime);
    businessMetrics.trackClientOperation('update', false);
    businessLogger.logError(error as Error, 'update-client', getCurrentUserId(event) || 'unknown');

    logger.error('Error updating client', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
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

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics));
