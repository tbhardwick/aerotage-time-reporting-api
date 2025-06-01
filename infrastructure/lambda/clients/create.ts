import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ValidationService } from '../shared/validation';
import { ClientRepository } from '../shared/client-repository';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';

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

    logger.info('Create client request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // Get current user from authorization context
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'create-client', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
      logger.info('Request body parsed successfully', { 
        userId: currentUserId,
        requestDataKeys: Object.keys(requestBody) 
      });
    } catch {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Invalid JSON in request body'), 'create-client-parse', currentUserId);
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Add current user as creator
    requestBody.createdBy = currentUserId;

    // Validate request with tracing
    const validationResult = await businessTracer.traceBusinessOperation(
      'validate-create-request',
      'client',
      async () => {
        return ValidationService.validateCreateClientRequest(requestBody);
      }
    );

    if (!validationResult.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients', 'POST', 400, responseTime);
      businessLogger.logBusinessOperation('create', 'client', currentUserId, false, { 
        validationErrors: validationResult.errors 
      });
      return createErrorResponse(400, 'VALIDATION_ERROR', validationResult.errors.join(', '));
    }

    const clientRepository = new ClientRepository();

    // Check if client name already exists
    const nameExists = await businessTracer.traceDatabaseOperation(
      'check-name-exists',
      'clients',
      async () => {
        return await clientRepository.checkClientNameExists(requestBody.name);
      }
    );

    if (nameExists) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients', 'POST', 409, responseTime);
      businessLogger.logBusinessOperation('create', 'client', currentUserId, false, { 
        reason: 'client_name_exists',
        clientName: requestBody.name 
      });
      return createErrorResponse(409, 'CLIENT_NAME_EXISTS', 'A client with this name already exists');
    }

    // Create the client
    const newClient = await businessTracer.traceDatabaseOperation(
      'create',
      'clients',
      async () => {
        return await clientRepository.createClient(requestBody);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/clients', 'POST', 201, responseTime);
    businessMetrics.trackClientOperation('create', true);
    businessLogger.logBusinessOperation('create', 'client', currentUserId, true, { 
      clientId: newClient.id,
      clientName: newClient.name,
      isActive: newClient.isActive
    });

    logger.info('Client created successfully', { 
      userId: currentUserId,
      clientId: newClient.id,
      clientName: newClient.name,
      responseTime 
    });

    return createSuccessResponse(newClient, 201, 'Client created successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/clients', 'POST', 500, responseTime);
    businessMetrics.trackClientOperation('create', false);
    businessLogger.logError(error as Error, 'create-client', getCurrentUserId(event) || 'unknown');

    logger.error('Error creating client', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(409, 'CLIENT_ALREADY_EXISTS', 'A client with this ID already exists');
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
