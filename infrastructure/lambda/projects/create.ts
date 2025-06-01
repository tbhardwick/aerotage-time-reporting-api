import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { ProjectRepository } from '../shared/project-repository';
import { ClientRepository } from '../shared/client-repository';

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

    logger.info('Create project request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'create-project', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Authorization check: Only managers and admins can create projects
    if (userRole === 'employee') {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects', 'POST', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'create-project', false, { reason: 'insufficient_role', userRole });
      return createErrorResponse(403, 'FORBIDDEN', 'Only managers and admins can create projects');
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
      logger.info('Request body parsed successfully', { userId: currentUserId, requestDataKeys: Object.keys(requestBody) });
    } catch {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Invalid JSON in request body'), 'create-project-parse', currentUserId);
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validation with tracing
    const validationResult = await businessTracer.traceBusinessOperation(
      'validate-project-data',
      'project',
      async () => {
        const validationErrors: string[] = [];

        // Basic validation - ensure required fields are present
        if (!requestBody.name || typeof requestBody.name !== 'string') {
          validationErrors.push('Project name is required and must be a string');
        }

        if (!requestBody.clientId || typeof requestBody.clientId !== 'string') {
          validationErrors.push('Client ID is required and must be a string');
        }

        if (typeof requestBody.defaultBillable !== 'boolean') {
          validationErrors.push('Default billable status is required and must be a boolean');
        }

        return validationErrors;
      }
    );

    if (validationResult.length > 0) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects', 'POST', 400, responseTime);
      businessLogger.logBusinessOperation('create', 'project', currentUserId, false, { 
        validationErrors: validationResult 
      });
      return createErrorResponse(400, 'VALIDATION_ERROR', `Validation failed: ${validationResult.join(', ')}`);
    }

    // Add current user as creator
    requestBody.createdBy = currentUserId;

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const projectRepository = new ProjectRepository();
    const clientRepository = new ClientRepository();

    // Verify client exists and is active
    const client = await businessTracer.traceDatabaseOperation(
      'get',
      'clients',
      async () => {
        return await clientRepository.getClientById(requestBody.clientId);
      }
    );

    if (!client) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects', 'POST', 404, responseTime);
      businessLogger.logBusinessOperation('create', 'project', currentUserId, false, { 
        reason: 'client_not_found',
        clientId: requestBody.clientId 
      });
      return createErrorResponse(404, 'CLIENT_NOT_FOUND', 'The specified client does not exist');
    }

    if (!client.isActive) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects', 'POST', 400, responseTime);
      businessLogger.logBusinessOperation('create', 'project', currentUserId, false, { 
        reason: 'client_inactive',
        clientId: requestBody.clientId 
      });
      return createErrorResponse(400, 'CLIENT_INACTIVE', 'Cannot create project for inactive client');
    }

    // Ensure client name matches
    requestBody.clientName = client.name;

    logger.info('Creating project', { 
      userId: currentUserId,
      projectName: requestBody.name,
      clientId: requestBody.clientId,
      clientName: client.name 
    });

    // Create the project
    const newProject = await businessTracer.traceDatabaseOperation(
      'create',
      'projects',
      async () => {
        return await projectRepository.createProject(requestBody);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/projects', 'POST', 201, responseTime);
    businessLogger.logBusinessOperation('create', 'project', currentUserId, true, { 
      projectId: newProject.id,
      projectName: newProject.name,
      clientId: newProject.clientId
    });

    logger.info('Project created successfully', { 
      userId: currentUserId,
      projectId: newProject.id,
      projectName: newProject.name,
      responseTime 
    });

    return createSuccessResponse(newProject, 201, 'Project created successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/projects', 'POST', 500, responseTime);
    businessLogger.logError(error as Error, 'create-project', getCurrentUserId(event) || 'unknown');

    logger.error('Error creating project', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(409, 'PROJECT_ALREADY_EXISTS', 'A project with this ID already exists');
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
