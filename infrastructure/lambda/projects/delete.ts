import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { ProjectRepository } from '../shared/project-repository';

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

    logger.info('Delete project request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects/{id}', 'DELETE', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'delete-project', false, { reason: 'no_user_id' });
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
      'project',
      async () => {
        if (userRole === 'employee') {
          // Employees cannot delete projects
          return { authorized: false, reason: 'insufficient_role' };
        }
        // Managers and admins can delete projects
        return { authorized: true };
      }
    );

    if (!authorizationResult.authorized) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects/{id}', 'DELETE', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'delete-project', false, { 
        reason: authorizationResult.reason,
        userRole 
      });
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to delete projects');
    }

    // Get project ID from path parameters
    const projectId = event.pathParameters?.id;
    if (!projectId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects/{id}', 'DELETE', 400, responseTime);
      businessLogger.logError(new Error('Project ID is required'), 'delete-project-validation', currentUserId);
      return createErrorResponse(400, 'MISSING_PROJECT_ID', 'Project ID is required');
    }

    logger.info('Deleting project', { 
      userId: currentUserId,
      projectId,
      userRole 
    });

    const projectRepository = new ProjectRepository();

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
      businessMetrics.trackApiPerformance('/projects/{id}', 'DELETE', 404, responseTime);
      businessLogger.logBusinessOperation('delete', 'project', currentUserId, false, { 
        reason: 'project_not_found',
        projectId 
      });
      return createErrorResponse(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    // TODO: Check for dependencies before deletion
    // In the future, we should check:
    // - Are there any time entries associated with this project?
    // - Are there any invoices associated with this project?
    // - Should we soft delete instead of hard delete?

    // For now, we'll do a hard delete
    await businessTracer.traceDatabaseOperation(
      'delete',
      'projects',
      async () => {
        return await projectRepository.deleteProject(projectId);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/projects/{id}', 'DELETE', 200, responseTime);
    businessMetrics.trackProjectOperation('delete', true);
    businessLogger.logBusinessOperation('delete', 'project', currentUserId, true, { 
      projectId,
      projectName: existingProject.name,
      clientId: existingProject.clientId
    });

    logger.info('Project deleted successfully', { 
      userId: currentUserId,
      projectId,
      projectName: existingProject.name,
      responseTime 
    });

    return createSuccessResponse(null, 200, 'Project deleted successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/projects/{id}', 'DELETE', 500, responseTime);
    businessMetrics.trackProjectOperation('delete', false);
    businessLogger.logError(error as Error, 'delete-project', getCurrentUserId(event) || 'unknown');

    logger.error('Error deleting project', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(404, 'PROJECT_NOT_FOUND', 'Project not found');
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
