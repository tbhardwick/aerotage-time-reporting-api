import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  TimeEntryErrorCodes
} from '../shared/types';

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

const timeEntryRepo = new TimeEntryRepository();

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Delete time entry request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/{id}', 'DELETE', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'delete-time-entry', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Get time entry ID from path parameters
    const timeEntryId = event.pathParameters?.id;
    if (!timeEntryId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/{id}', 'DELETE', 400, responseTime);
      businessLogger.logError(new Error('Time entry ID is required'), 'delete-time-entry-validation', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Time entry ID is required');
    }

    logger.info('Deleting time entry', { 
      userId: currentUserId,
      timeEntryId,
      userRole 
    });

    // Get existing time entry to check ownership and status
    const existingTimeEntry = await businessTracer.traceDatabaseOperation(
      'get',
      'time-entries',
      async () => {
        return await timeEntryRepo.getTimeEntry(timeEntryId);
      }
    );

    if (!existingTimeEntry) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/{id}', 'DELETE', 404, responseTime);
      businessLogger.logBusinessOperation('delete', 'time-entry', currentUserId, false, { 
        reason: 'time_entry_not_found',
        timeEntryId 
      });
      return createErrorResponse(404, TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND, 'Time entry not found');
    }

    // Check authorization with tracing
    const authorizationResult = await businessTracer.traceBusinessOperation(
      'check-authorization',
      'time-entry',
      async () => {
        // Check authorization - users can only delete their own entries
        // Managers and admins can delete entries for their team members
        if (existingTimeEntry.userId !== currentUserId && userRole === 'employee') {
          return { authorized: false, reason: 'insufficient_permissions' };
        }

        // Validate that the time entry can be deleted (only draft and rejected entries)
        if (existingTimeEntry.status !== 'draft' && existingTimeEntry.status !== 'rejected') {
          return { authorized: false, reason: 'invalid_status' };
        }

        return { authorized: true };
      }
    );

    if (!authorizationResult.authorized) {
      const responseTime = Date.now() - startTime;
      
      if (authorizationResult.reason === 'insufficient_permissions') {
        businessMetrics.trackApiPerformance('/time-entries/{id}', 'DELETE', 403, responseTime);
        businessLogger.logAuth(currentUserId, 'delete-time-entry', false, { 
          reason: 'insufficient_permissions',
          timeEntryId,
          timeEntryUserId: existingTimeEntry.userId 
        });
        return createErrorResponse(403, TimeEntryErrorCodes.UNAUTHORIZED_TIME_ENTRY_ACCESS, 'You can only delete your own time entries');
      } else {
        businessMetrics.trackApiPerformance('/time-entries/{id}', 'DELETE', 400, responseTime);
        businessLogger.logBusinessOperation('delete', 'time-entry', currentUserId, false, { 
          reason: 'invalid_status',
          timeEntryId,
          status: existingTimeEntry.status 
        });
        return createErrorResponse(400, TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED, 'Cannot delete time entry that has been submitted or approved');
      }
    }

    // Delete the time entry
    await businessTracer.traceDatabaseOperation(
      'delete',
      'time-entries',
      async () => {
        return await timeEntryRepo.deleteTimeEntry(timeEntryId);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/time-entries/{id}', 'DELETE', 200, responseTime);
    businessMetrics.trackTimeEntryOperation('delete', true);
    businessLogger.logBusinessOperation('delete', 'time-entry', currentUserId, true, { 
      timeEntryId,
      originalStatus: existingTimeEntry.status,
      originalUserId: existingTimeEntry.userId
    });

    logger.info('Time entry deleted successfully', { 
      userId: currentUserId,
      timeEntryId,
      responseTime 
    });

    return createSuccessResponse(null, 200, 'Time entry deleted successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/time-entries/{id}', 'DELETE', 500, responseTime);
    businessMetrics.trackTimeEntryOperation('delete', false);
    businessLogger.logError(error as Error, 'delete-time-entry', getCurrentUserId(event) || 'unknown');

    logger.error('Error deleting time entry', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND) {
        return createErrorResponse(404, TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND, 'Time entry not found');
      }

      if (error.message === TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED) {
        return createErrorResponse(400, TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED, 'Cannot delete submitted or approved time entry');
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
