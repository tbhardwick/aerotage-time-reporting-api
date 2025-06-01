import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { ClientRepository } from '../shared/client-repository';
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

    logger.info('Delete client request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients/{id}', 'DELETE', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'delete-client', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Get client ID from path parameters
    const clientId = event.pathParameters?.id;
    if (!clientId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients/{id}', 'DELETE', 400, responseTime);
      businessLogger.logError(new Error('Client ID is required'), 'delete-client-validation', currentUserId);
      return createErrorResponse(400, 'MISSING_CLIENT_ID', 'Client ID is required');
    }

    logger.info('Client deletion parameters parsed', { 
      userId: currentUserId,
      clientId,
      userRole,
      hardDelete: event.queryStringParameters?.hard === 'true'
    });

    // Role-based access control with tracing
    const authorizationResult = await businessTracer.traceBusinessOperation(
      'check-authorization',
      'client',
      async () => {
        if (userRole === 'employee') {
          // Employees cannot delete clients
          return { authorized: false, reason: 'insufficient_role' };
        }
        // Managers and admins can delete clients
        return { authorized: true };
      }
    );

    if (!authorizationResult.authorized) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients/{id}', 'DELETE', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'delete-client', false, { 
        reason: authorizationResult.reason,
        userRole,
        clientId 
      });
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to delete clients');
    }

    const clientRepository = new ClientRepository();
    const projectRepository = new ProjectRepository();

    // Check if client exists with tracing
    const existingClient = await businessTracer.traceDatabaseOperation(
      'get-client',
      'clients',
      async () => {
        return await clientRepository.getClientById(clientId);
      }
    );

    if (!existingClient) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients/{id}', 'DELETE', 404, responseTime);
      businessLogger.logBusinessOperation('delete', 'client', currentUserId, false, { 
        clientId,
        reason: 'client_not_found' 
      });
      return createErrorResponse(404, 'CLIENT_NOT_FOUND', 'Client not found');
    }

    // Check if client has any projects with tracing
    const clientProjects = await businessTracer.traceDatabaseOperation(
      'get-client-projects',
      'projects',
      async () => {
        return await projectRepository.getProjectsByClientId(clientId);
      }
    );

    if (clientProjects.length > 0) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients/{id}', 'DELETE', 400, responseTime);
      businessLogger.logBusinessOperation('delete', 'client', currentUserId, false, { 
        clientId,
        reason: 'client_has_projects',
        projectCount: clientProjects.length 
      });
      return createErrorResponse(400, 'CLIENT_HAS_PROJECTS', 
        `Cannot delete client. There are ${clientProjects.length} project(s) associated with this client. Please reassign or delete the projects first.`);
    }

    // Check query parameter for hard delete
    const hardDelete = event.queryStringParameters?.hard === 'true';

    // Perform deletion with tracing
    await businessTracer.traceDatabaseOperation(
      hardDelete ? 'hard-delete-client' : 'soft-delete-client',
      'clients',
      async () => {
        if (hardDelete) {
          // Hard delete (permanent removal)
          await clientRepository.hardDeleteClient(clientId);
        } else {
          // Soft delete (set isActive to false)
          await clientRepository.deleteClient(clientId);
        }
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/clients/{id}', 'DELETE', 200, responseTime);
    businessMetrics.trackClientOperation('delete', true);
    businessLogger.logBusinessOperation('delete', 'client', currentUserId, true, { 
      clientId,
      clientName: existingClient.name,
      hardDelete,
      userRole
    });

    logger.info('Client deletion completed', { 
      userId: currentUserId,
      clientId,
      clientName: existingClient.name,
      hardDelete,
      responseTime 
    });

    // ✅ FIXED: Use standardized response helper
    const message = hardDelete ? 'Client permanently deleted' : 'Client deactivated successfully';
    return createSuccessResponse(null, 200, message);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/clients/{id}', 'DELETE', 500, responseTime);
    businessMetrics.trackClientOperation('delete', false);
    businessLogger.logError(error as Error, 'delete-client', getCurrentUserId(event) || 'unknown');

    logger.error('Error deleting client', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      clientId: event.pathParameters?.id,
      responseTime
    });
    
    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.message.includes('ConditionalCheckFailedException')) {
        return createErrorResponse(404, 'CLIENT_NOT_FOUND', 'Client not found');
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
