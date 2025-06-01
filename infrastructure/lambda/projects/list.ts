import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ValidationService } from '../shared/validation';
import { ProjectRepository, ProjectFilters } from '../shared/project-repository';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';

// ✅ NEW: Import PowerTools utilities with correct v2.x pattern
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// ✅ NEW: Import Middy middleware for PowerTools v2.x
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

// ✅ FIXED: Use correct PowerTools v2.x middleware pattern
const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // ✅ NEW: Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);
    
    logger.info('List projects request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
      queryParams: event.queryStringParameters,
    });

    // ✅ NEW: Track API request metrics
    businessMetrics.trackApiPerformance(
      '/projects',
      'GET',
      0, // Will be updated later
      0  // Will be updated later
    );

    // Get current user from authorization context
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects', 'GET', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'projects-list', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // ✅ NEW: Add user context to tracer and logger
    const user = getAuthenticatedUser(event);
    businessTracer.addUserContext(currentUserId, user?.role, user?.department);
    addRequestContext(requestId, currentUserId, user?.role);

    // ✅ NEW: Trace query parameter parsing
    const filters = await businessTracer.traceBusinessOperation(
      'parse-query-parameters',
      'project-filters',
      async () => {
        // Parse query parameters
        const queryParams = event.queryStringParameters || {};
        const parsedFilters: ProjectFilters = {
          clientId: queryParams.clientId as string | undefined,
          status: queryParams.status as 'active' | 'paused' | 'completed' | 'cancelled' | undefined,
          teamMember: queryParams.teamMember as string | undefined,
          limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
          offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
          sortBy: queryParams.sortBy as 'name' | 'createdAt' | 'deadline' | undefined,
          sortOrder: queryParams.sortOrder as 'asc' | 'desc' | undefined,
        };

        logger.info('Query parameters parsed', { 
          userId: currentUserId, 
          filters: parsedFilters 
        });

        return parsedFilters;
      }
    );

    // ✅ NEW: Trace validation logic
    const validation = await businessTracer.traceBusinessOperation(
      'validate-project-filters',
      'project-filters',
      async () => {
        return ValidationService.validateProjectFilters(filters);
      }
    );

    if (!validation.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/projects', 'GET', 400, responseTime);
      businessLogger.logBusinessOperation('list', 'project', currentUserId, false, { 
        validationErrors: validation.errors 
      });
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    logger.info('Validation passed, fetching projects', { 
      userId: currentUserId, 
      filters 
    });

    // ✅ NEW: Trace database operation
    const result = await businessTracer.traceDatabaseOperation(
      'list',
      'projects',
      async () => {
        const projectRepository = new ProjectRepository();
        return await projectRepository.listProjects(filters);
      }
    );

    // ✅ NEW: Trace response preparation
    const responseData = await businessTracer.traceBusinessOperation(
      'prepare-response',
      'project-list',
      async () => {
        // TODO: Implement role-based filtering
        // For now, return all projects. In the future, we should:
        // - Admins: see all projects
        // - Managers: see projects they manage or are team members of
        // - Employees: see only projects they are team members of

        return {
          items: result.projects,
          pagination: {
            total: result.total,
            limit: filters.limit || 50,
            offset: filters.offset || 0,
            hasMore: result.hasMore,
          },
        };
      }
    );

    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Track successful metrics
    businessMetrics.trackApiPerformance('/projects', 'GET', 200, responseTime);
    businessMetrics.trackBusinessKPI('ProjectsListed', result.projects.length, MetricUnit.Count);
    businessLogger.logBusinessOperation('list', 'project', currentUserId, true, { 
      projectCount: result.projects.length,
      total: result.total,
      filters 
    });

    logger.info('Projects retrieved successfully', { 
      userId: currentUserId, 
      projectCount: result.projects.length,
      total: result.total,
      responseTime 
    });

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(responseData, 200, 'Projects retrieved successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Enhanced error logging and metrics
    businessMetrics.trackApiPerformance('/projects', 'GET', 500, responseTime);
    businessMetrics.trackBusinessKPI('ProjectsListError', 1, MetricUnit.Count);
    
    businessLogger.logError(
      error instanceof Error ? error : new Error('Unknown error'),
      'projects-list',
      getCurrentUserId(event),
      { responseTime }
    );
    
    logger.error('List projects error', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : { message: 'Unknown error' },
      responseTime,
    });
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// ✅ NEW: Export handler with PowerTools v2.x middleware pattern
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }))
  .use(logMetrics(metrics));
