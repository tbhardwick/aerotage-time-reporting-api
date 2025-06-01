import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { ValidationService } from '../shared/validation';
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

    logger.info('Update project request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects/{id}', 'PUT', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'update-project', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Get project ID from path parameters
    const projectId = event.pathParameters?.id;
    if (!projectId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects/{id}', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('Project ID is required'), 'update-project-validation', currentUserId);
      return createErrorResponse(400, 'MISSING_PROJECT_ID', 'Project ID is required');
    }

    // Parse request body
    let requestBody: Record<string, unknown>;
    try {
      if (!event.body) {
        throw new Error('Request body is missing');
      }
      requestBody = JSON.parse(event.body);
      logger.info('Request body parsed successfully', { userId: currentUserId, projectId, requestDataKeys: Object.keys(requestBody) });
    } catch {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects/{id}', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('Invalid request body'), 'update-project-parse', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Invalid request body');
    }

    // Validate request with tracing
    const validationResult = await businessTracer.traceBusinessOperation(
      'validate-update-request',
      'project',
      async () => {
        return ValidationService.validateUpdateProjectRequest(requestBody);
      }
    );

    if (!validationResult.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects/{id}', 'PUT', 400, responseTime);
      businessLogger.logBusinessOperation('update', 'project', currentUserId, false, { 
        validationErrors: validationResult.errors,
        projectId 
      });
      return createErrorResponse(400, 'VALIDATION_ERROR', validationResult.errors.join(', '));
    }

    const projectRepository = new ProjectRepository();
    const clientRepository = new ClientRepository();

    // Check if project exists
    const existingProject = await businessTracer.traceDatabaseOperation(
      'get',
      'projects',
      async () => {
        return await projectRepository.getProjectById(projectId);
      }
    );

    if (!existingProject) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects/{id}', 'PUT', 404, responseTime);
      businessLogger.logBusinessOperation('update', 'project', currentUserId, false, { 
        reason: 'project_not_found',
        projectId 
      });
      return createErrorResponse(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    // Role-based access control with tracing
    const authorizationResult = await businessTracer.traceBusinessOperation(
      'check-authorization',
      'project',
      async () => {
        if (userRole === 'employee') {
          // Employees cannot update projects
          return { authorized: false, reason: 'insufficient_role' };
        } else if (userRole === 'manager') {
          // Managers can update projects they manage
          // TODO: Implement team/project association check when user teams are implemented
          // For now, allow managers to update any project
          return { authorized: true };
        }
        // Admins can update any project (no additional restrictions)
        return { authorized: true };
      }
    );

    if (!authorizationResult.authorized) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects/{id}', 'PUT', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'update-project', false, { 
        reason: authorizationResult.reason,
        projectId,
        userRole 
      });
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to update projects');
    }

    // If client is being changed, verify the new client exists and is active
    if (requestBody.clientId && typeof requestBody.clientId === 'string' && requestBody.clientId !== existingProject.clientId) {
      const client = await businessTracer.traceDatabaseOperation(
        'get',
        'clients',
        async () => {
          return await clientRepository.getClientById(requestBody.clientId as string);
        }
      );

      if (!client) {
        const responseTime = Date.now() - startTime;
        businessMetrics.trackApiPerformance('/projects/{id}', 'PUT', 404, responseTime);
        businessLogger.logBusinessOperation('update', 'project', currentUserId, false, { 
          reason: 'client_not_found',
          projectId,
          clientId: requestBody.clientId 
        });
        return createErrorResponse(404, 'CLIENT_NOT_FOUND', 'The specified client does not exist');
      }

      if (!client.isActive) {
        const responseTime = Date.now() - startTime;
        businessMetrics.trackApiPerformance('/projects/{id}', 'PUT', 400, responseTime);
        businessLogger.logBusinessOperation('update', 'project', currentUserId, false, { 
          reason: 'client_inactive',
          projectId,
          clientId: requestBody.clientId 
        });
        return createErrorResponse(400, 'CLIENT_INACTIVE', 'Cannot assign project to inactive client');
      }

      // Update client name to match
      requestBody.clientName = client.name;
      logger.info('Client validation successful', { 
        userId: currentUserId,
        projectId,
        newClientId: requestBody.clientId,
        newClientName: client.name 
      });
    }

    // Update the project
    const updatedProject = await businessTracer.traceDatabaseOperation(
      'update',
      'projects',
      async () => {
        return await projectRepository.updateProject(projectId, requestBody);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/projects/{id}', 'PUT', 200, responseTime);
    businessMetrics.trackProjectOperation('update', true);
    businessLogger.logBusinessOperation('update', 'project', currentUserId, true, { 
      projectId,
      updatedFields: Object.keys(requestBody),
      projectName: updatedProject.name
    });

    logger.info('Project updated successfully', { 
      userId: currentUserId,
      projectId,
      projectName: updatedProject.name,
      responseTime 
    });

    return createSuccessResponse(updatedProject, 200, 'Project updated successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/projects/{id}', 'PUT', 500, responseTime);
    businessMetrics.trackProjectOperation('update', false);
    businessLogger.logError(error as Error, 'update-project', getCurrentUserId(event) || 'unknown');

    logger.error('Error updating project', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(404, 'PROJECT_NOT_FOUND', 'Project not found');
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
