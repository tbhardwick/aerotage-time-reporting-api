import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  RejectTimeEntriesRequest, 
  TimeEntryErrorCodes, 
  SuccessResponse,
  BulkTimeEntryResponse
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

    logger.info('Reject time entries request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/reject', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'reject-time-entries', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Check authorization with tracing
    const authorizationResult = await businessTracer.traceBusinessOperation(
      'check-authorization',
      'time-entry',
      async () => {
        // Check if user has approval permissions (manager or admin)
        if (userRole !== 'manager' && userRole !== 'admin') {
          return { authorized: false, reason: 'insufficient_role' };
        }
        return { authorized: true };
      }
    );

    if (!authorizationResult.authorized) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/reject', 'POST', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'reject-time-entries', false, { 
        reason: authorizationResult.reason,
        userRole 
      });
      return createErrorResponse(403, TimeEntryErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'Only managers and admins can reject time entries');
    }

    // Parse request body
    if (!event.body) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/reject', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Request body is required'), 'reject-validation', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let requestData: RejectTimeEntriesRequest;
    try {
      requestData = JSON.parse(event.body);
      logger.info('Request body parsed successfully', { 
        userId: currentUserId,
        timeEntryCount: requestData.timeEntryIds?.length || 0,
        hasRejectionReason: !!requestData.rejectionReason
      });
    } catch {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/reject', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Invalid JSON in request body'), 'reject-parse', currentUserId);
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate request data with tracing
    const validationErrors = await businessTracer.traceBusinessOperation(
      'validate-reject-request',
      'time-entry',
      async () => {
        const errors: string[] = [];
        
        if (!requestData.timeEntryIds || !Array.isArray(requestData.timeEntryIds)) {
          errors.push('timeEntryIds must be an array');
        } else if (requestData.timeEntryIds.length === 0) {
          errors.push('at least one time entry ID is required');
        } else if (requestData.timeEntryIds.length > 50) {
          errors.push('maximum 50 time entries can be rejected at once');
        }

        if (!requestData.rejectionReason || requestData.rejectionReason.trim().length === 0) {
          errors.push('rejectionReason is required');
        } else if (requestData.rejectionReason.length > 500) {
          errors.push('rejectionReason cannot exceed 500 characters');
        }

        return errors;
      }
    );

    if (validationErrors.length > 0) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/reject', 'POST', 400, responseTime);
      businessLogger.logBusinessOperation('reject', 'time-entry', currentUserId, false, { 
        validationErrors 
      });
      return createErrorResponse(400, TimeEntryErrorCodes.INVALID_TIME_ENTRY_DATA, `Validation failed: ${validationErrors.join(', ')}`);
    }

    // Verify rejection eligibility with tracing
    const rejectionErrors = await businessTracer.traceBusinessOperation(
      'verify-rejection-eligibility',
      'time-entry',
      async () => {
        const errors: string[] = [];
        
        for (const timeEntryId of requestData.timeEntryIds) {
          try {
            const timeEntry = await timeEntryRepo.getTimeEntry(timeEntryId);
            
            if (!timeEntry) {
              errors.push(`Time entry ${timeEntryId} not found`);
              continue;
            }

            // Check if time entry is in a rejectable state
            if (timeEntry.status !== 'submitted') {
              errors.push(`Time entry ${timeEntryId} is not submitted for approval (status: ${timeEntry.status})`);
              continue;
            }

            // TODO: Add team-based authorization check
            // Managers should only be able to reject entries from their team members
            // For now, we'll allow any manager/admin to reject any entry
          } catch (error) {
            errors.push(`Error checking time entry ${timeEntryId}: ${(error as Error).message}`);
          }
        }

        return errors;
      }
    );

    if (rejectionErrors.length > 0) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/reject', 'POST', 400, responseTime);
      businessLogger.logAuth(currentUserId, 'reject-time-entries', false, { 
        reason: 'rejection_eligibility_errors',
        rejectionErrors 
      });
      return createErrorResponse(400, TimeEntryErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, `Cannot reject time entries: ${rejectionErrors.join(', ')}`);
    }

    // Reject the time entries with tracing
    const result = await businessTracer.traceDatabaseOperation(
      'reject-bulk',
      'time-entries',
      async () => {
        return await timeEntryRepo.rejectTimeEntries(
          requestData.timeEntryIds, 
          currentUserId, 
          requestData.rejectionReason
        );
      }
    );

    // Determine response status based on results
    let statusCode = 200;
    let message = 'All time entries rejected successfully';

    if (result.failed.length > 0) {
      if (result.successful.length === 0) {
        statusCode = 400;
        message = 'Failed to reject any time entries';
      } else {
        statusCode = 207; // Multi-status
        message = 'Some time entries rejected successfully';
      }
    }

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/time-entries/reject', 'POST', statusCode, responseTime);
    businessMetrics.trackTimeEntryOperation('reject', result.successful.length > 0);
    businessLogger.logBusinessOperation('reject', 'time-entry', currentUserId, result.successful.length > 0, { 
      totalRequested: requestData.timeEntryIds.length,
      successful: result.successful.length,
      failed: result.failed.length,
      statusCode,
      userRole,
      rejectionReasonLength: requestData.rejectionReason.length
    });

    logger.info('Time entries rejection completed', { 
      userId: currentUserId,
      totalRequested: requestData.timeEntryIds.length,
      successful: result.successful.length,
      failed: result.failed.length,
      responseTime 
    });

    const response: SuccessResponse<BulkTimeEntryResponse> = {
      success: true,
      data: result,
      message,
    };

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/time-entries/reject', 'POST', 500, responseTime);
    businessMetrics.trackTimeEntryOperation('reject', false);
    businessLogger.logError(error as Error, 'reject-time-entries', getCurrentUserId(event) || 'unknown');

    logger.error('Error rejecting time entries', {
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
