import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { 
  TimeEntryFilters
} from '../shared/types';

// ✅ NEW: Import PowerTools utilities
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';

// ✅ NEW: Import Middy and PowerTools v2.x middleware
import middy from '@middy/core';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';

const timeEntryRepo = new TimeEntryRepository();

const listTimeEntriesHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // ✅ NEW: Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.path);

    // ✅ NEW: Log structured request information
    logger.info('Processing list time entries request', {
      httpMethod: event.httpMethod,
      path: event.path,
      queryParams: event.queryStringParameters,
    });

    // Extract user information from authorization context using shared helper
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    
    if (!userId) {
      // ✅ NEW: Track authentication failure
      const responseTime = Date.now() - startTime;
      businessMetrics.trackAuthEvent(false, 'token');
      businessMetrics.trackApiPerformance('/time-entries', 'GET', 401, responseTime);
      businessLogger.logAuth('unknown', 'list_time_entries', false, { reason: 'no_user_id' });
      
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // ✅ NEW: Add user context to tracer and logger
    const userRole = user?.role || 'employee';
    businessTracer.addUserContext(userId, userRole, user?.department);
    logger.appendKeys({ userId, userRole });

    // ✅ NEW: Track successful authentication
    businessMetrics.trackAuthEvent(true, 'token');
    businessLogger.logAuth(userId, 'list_time_entries', true, { userRole });

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    
    // ✅ NEW: Trace filter building operation
    const filters = await businessTracer.traceBusinessOperation(
      'build_filters',
      'time-entries',
      async () => {
        // Build filters from query parameters
        const baseFilters: TimeEntryFilters = {
          userId: queryParams.userId,
          projectId: queryParams.projectId,
          taskId: queryParams.taskId,
          status: queryParams.status as 'draft' | 'submitted' | 'approved' | 'rejected' | undefined,
          dateFrom: queryParams.dateFrom,
          dateTo: queryParams.dateTo,
          limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
          offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
          sortBy: queryParams.sortBy as 'date' | 'duration' | 'createdAt' | undefined,
          sortOrder: queryParams.sortOrder as 'asc' | 'desc' | undefined,
        };

        // Apply role-based access control
        return applyAccessControl(baseFilters, userId, userRole);
      }
    );

    logger.info('Applied filters and access control', { 
      userId, 
      userRole, 
      filtersApplied: Object.keys(filters).filter(key => filters[key as keyof TimeEntryFilters] !== undefined)
    });

    // ✅ NEW: Trace database operation
    const result = await businessTracer.traceDatabaseOperation(
      'listTimeEntries',
      'time-entries',
      async () => {
        return timeEntryRepo.listTimeEntries(filters);
      }
    );

    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Track successful metrics
    businessMetrics.trackApiPerformance('/time-entries', 'GET', 200, responseTime);
    businessMetrics.trackDatabaseOperation('list', 'time-entries', true, responseTime, result.items.length);
    businessLogger.logBusinessOperation('list', 'time-entries', userId, true, { 
      itemCount: result.items.length,
      hasMore: result.pagination.hasMore 
    });

    logger.info('Time entries listed successfully', { 
      userId, 
      itemCount: result.items.length,
      responseTime 
    });

    return createSuccessResponse({
      items: result.items,
      pagination: result.pagination,
    });

  } catch (error) {
    // ✅ NEW: Enhanced error logging and metrics
    const responseTime = Date.now() - startTime;
    const userId = getCurrentUserId(event);
    
    businessMetrics.trackApiPerformance('/time-entries', 'GET', 500, responseTime);
    businessMetrics.trackDatabaseOperation('list', 'time-entries', false, responseTime);
    businessLogger.logError(
      error instanceof Error ? error : new Error('Unknown error'),
      'list_time_entries_handler',
      userId,
      { responseTime }
    );

    logger.error('Error listing time entries', { 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : { message: 'Unknown error' },
      userId,
      responseTime 
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to list time entries');
  }
};

function applyAccessControl(filters: TimeEntryFilters, userId: string, userRole: string): TimeEntryFilters {
  // Create a new filters object to avoid mutation
  const controlledFilters = { ...filters };
  
  // Apply role-based filtering
  if (userRole === 'employee') {
    // Employees can only see their own entries
    controlledFilters.userId = userId;
  } else if (!controlledFilters.userId) {
    // For managers/admins, if no specific user is requested, default to current user
    controlledFilters.userId = userId;
  }

  // Validate status filter if present
  if (controlledFilters.status) {
    const validStatuses = ['draft', 'submitted', 'approved', 'rejected'];
    if (!validStatuses.includes(controlledFilters.status)) {
      delete controlledFilters.status;
    }
  }

  return controlledFilters;
}

// ✅ NEW: Export handler with PowerTools v2.x middleware pattern
export const handler = middy(listTimeEntriesHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }))
  .use(logMetrics(metrics));
