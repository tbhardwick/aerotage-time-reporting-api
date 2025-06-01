import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  SubmitTimeEntriesRequest, 
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

    logger.info('Submit time entries request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/submit', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'submit-time-entries', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Parse request body
    if (!event.body) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/submit', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Request body is required'), 'submit-validation', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let requestData: SubmitTimeEntriesRequest;
    try {
      requestData = JSON.parse(event.body);
      logger.info('Request body parsed successfully', { 
        userId: currentUserId,
        timeEntryCount: requestData.timeEntryIds?.length || 0 
      });
    } catch {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/submit', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Invalid JSON in request body'), 'submit-parse', currentUserId);
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate request data with tracing
    const validationErrors = await businessTracer.traceBusinessOperation(
      'validate-submit-request',
      'time-entry',
      async () => {
        const errors: string[] = [];
        
        if (!requestData.timeEntryIds || !Array.isArray(requestData.timeEntryIds)) {
          errors.push('timeEntryIds must be an array');
        } else if (requestData.timeEntryIds.length === 0) {
          errors.push('at least one time entry ID is required');
        } else if (requestData.timeEntryIds.length > 50) {
          errors.push('maximum 50 time entries can be submitted at once');
        }

        return errors;
      }
    );

    if (validationErrors.length > 0) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/submit', 'POST', 400, responseTime);
      businessLogger.logBusinessOperation('submit', 'time-entry', currentUserId, false, { 
        validationErrors 
      });
      return createErrorResponse(400, TimeEntryErrorCodes.INVALID_TIME_ENTRY_DATA, `Validation failed: ${validationErrors.join(', ')}`);
    }

    // Verify ownership of all time entries before submitting any
    const ownershipErrors = await businessTracer.traceBusinessOperation(
      'verify-ownership',
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

            // Users can only submit their own time entries
            // Managers and admins can submit entries for their team members
            if (timeEntry.userId !== currentUserId && userRole === 'employee') {
              errors.push(`You can only submit your own time entries (${timeEntryId})`);
              continue;
            }

            // Check if time entry is in a submittable state
            if (timeEntry.status !== 'draft' && timeEntry.status !== 'rejected') {
              errors.push(`Time entry ${timeEntryId} is already submitted or approved`);
              continue;
            }

            // Validate that the time entry has required data
            if (!timeEntry.description || timeEntry.description.trim().length === 0) {
              errors.push(`Time entry ${timeEntryId} is missing description`);
              continue;
            }

            if (timeEntry.duration <= 0) {
              errors.push(`Time entry ${timeEntryId} has invalid duration`);
              continue;
            }
          } catch (error) {
            errors.push(`Error checking time entry ${timeEntryId}: ${(error as Error).message}`);
          }
        }

        return errors;
      }
    );

    if (ownershipErrors.length > 0) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/submit', 'POST', 400, responseTime);
      businessLogger.logAuth(currentUserId, 'submit-time-entries', false, { 
        reason: 'ownership_errors',
        ownershipErrors 
      });
      return createErrorResponse(400, TimeEntryErrorCodes.UNAUTHORIZED_TIME_ENTRY_ACCESS, `Cannot submit time entries: ${ownershipErrors.join(', ')}`);
    }

    // Submit the time entries using repository pattern
    const result = await businessTracer.traceDatabaseOperation(
      'submit-bulk',
      'time-entries',
      async () => {
        return await timeEntryRepo.submitTimeEntries(requestData.timeEntryIds, currentUserId);
      }
    );

    // Determine response status based on results
    let statusCode = 200;
    let message = 'All time entries submitted successfully';

    if (result.failed.length > 0) {
      if (result.successful.length === 0) {
        statusCode = 400;
        message = 'Failed to submit any time entries';
      } else {
        statusCode = 207; // Multi-status
        message = 'Some time entries submitted successfully';
      }
    }

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/time-entries/submit', 'POST', statusCode, responseTime);
    businessMetrics.trackTimeEntryOperation('submit', result.successful.length > 0);
    businessLogger.logBusinessOperation('submit', 'time-entry', currentUserId, result.successful.length > 0, { 
      totalRequested: requestData.timeEntryIds.length,
      successful: result.successful.length,
      failed: result.failed.length,
      statusCode
    });

    logger.info('Time entries submission completed', { 
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
    
    businessMetrics.trackApiPerformance('/time-entries/submit', 'POST', 500, responseTime);
    businessMetrics.trackTimeEntryOperation('submit', false);
    businessLogger.logError(error as Error, 'submit-time-entries', getCurrentUserId(event) || 'unknown');

    logger.error('Error submitting time entries', {
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
