import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { ClientRepository, ClientFilters } from '../shared/client-repository';

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

    logger.info('List clients request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients', 'GET', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'list-clients', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const filters: ClientFilters = {
      isActive: queryParams.isActive ? queryParams.isActive === 'true' : undefined,
      limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
      sortBy: queryParams.sortBy as 'name' | 'createdAt' | undefined,
      sortOrder: queryParams.sortOrder as 'asc' | 'desc' | undefined,
    };

    logger.info('Parsed query parameters', { filters, userRole });

    // Basic validation
    if (filters.limit && (filters.limit < 1 || filters.limit > 100)) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients', 'GET', 400, responseTime);
      businessLogger.logError(new Error('Invalid limit parameter'), 'list-clients-validation', currentUserId);
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Limit must be between 1 and 100');
    }

    if (filters.offset && filters.offset < 0) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/clients', 'GET', 400, responseTime);
      businessLogger.logError(new Error('Invalid offset parameter'), 'list-clients-validation', currentUserId);
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Offset must be non-negative');
    }

    // Apply role-based access control
    const accessControlledFilters = applyAccessControl(filters, userRole);

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const clientRepository = new ClientRepository();

    // Get clients with pagination
    const result = await businessTracer.traceDatabaseOperation(
      'list',
      'clients',
      async () => {
        return await clientRepository.listClients(accessControlledFilters);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/clients', 'GET', 200, responseTime);
    businessLogger.logBusinessOperation('list', 'client', currentUserId, true, { 
      clientCount: result.clients.length,
      total: result.total,
      userRole
    });

    logger.info('Clients listed successfully', { 
      userId: currentUserId,
      clientCount: result.clients.length,
      total: result.total,
      responseTime 
    });

    const responseData = {
      items: result.clients,
      pagination: {
        total: result.total,
        limit: filters.limit || 50,
        offset: filters.offset || 0,
        hasMore: result.hasMore,
      },
    };

    return createSuccessResponse(responseData);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/clients', 'GET', 500, responseTime);
    businessLogger.logError(error as Error, 'list-clients', getCurrentUserId(event) || 'unknown');

    logger.error('Error listing clients', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics));

function applyAccessControl(filters: ClientFilters, userRole: string): ClientFilters {
  // Create a new filters object to avoid mutation
  const controlledFilters = { ...filters };
  
  // Apply role-based filtering
  if (userRole === 'employee') {
    // Employees can only see active clients
    controlledFilters.isActive = true;
  }

  return controlledFilters;
}
