import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { 
  UpdateTimeEntryRequest, 
  TimeEntryErrorCodes, 
  ErrorResponse 
} from '../shared/types';

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

const timeEntryRepo = new TimeEntryRepository();

// ✅ FIXED: Use correct PowerTools v2.x middleware pattern
const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // ✅ NEW: Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    const timeEntryId = event.pathParameters?.id;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);
    
    logger.info('Update time entry request started', {
      requestId,
      timeEntryId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // ✅ NEW: Track API request metrics
    businessMetrics.trackApiPerformance(
      '/time-entries/{id}',
      'PUT',
      0, // Will be updated later
      0  // Will be updated later
    );

    // Extract user information from authorization context using shared helper
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/{id}', 'PUT', 401, responseTime);
      businessLogger.logAuth(userId || 'unknown', 'time-entry-update', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // ✅ NEW: Add user context to tracer and logger
    businessTracer.addUserContext(userId, user?.role, user?.department);
    addRequestContext(requestId, userId, user?.role);

    // Get time entry ID from path parameters
    if (!timeEntryId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/{id}', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('Missing time entry ID'), 'time-entry-update', userId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Time entry ID is required');
    }

    // Parse request body
    if (!event.body) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/{id}', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('Missing request body'), 'time-entry-update', userId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let requestData: UpdateTimeEntryRequest;
    try {
      requestData = JSON.parse(event.body);
      logger.info('Request body parsed successfully', { userId, timeEntryId, requestDataKeys: Object.keys(requestData) });
    } catch (parseError) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/{id}', 'PUT', 400, responseTime);
      businessLogger.logError(parseError as Error, 'time-entry-update-parse', userId);
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // ✅ NEW: Trace database operation to get existing time entry
    const existingTimeEntry = await businessTracer.traceDatabaseOperation(
      'get',
      'time-entries',
      async () => {
        return await timeEntryRepo.getTimeEntry(timeEntryId);
      }
    );

    if (!existingTimeEntry) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/{id}', 'PUT', 404, responseTime);
      businessMetrics.trackTimeEntryOperation('update', false);
      businessLogger.logBusinessOperation('update', 'time-entry', userId, false, { 
        timeEntryId,
        reason: 'not_found' 
      });
      return createErrorResponse(404, TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND, 'Time entry not found');
    }

    // ✅ NEW: Trace authorization check
    const authorizationResult = await businessTracer.traceBusinessOperation(
      'check-authorization',
      'time-entry',
      async () => {
        // Check authorization - users can only update their own entries
        // Managers and admins can update entries for their team members
        if (existingTimeEntry.userId !== userId && user?.role === 'employee') {
          return { authorized: false, reason: 'not_owner' };
        }
        return { authorized: true };
      }
    );

    if (!authorizationResult.authorized) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/{id}', 'PUT', 403, responseTime);
      businessMetrics.trackTimeEntryOperation('update', false);
      businessLogger.logSecurity('unauthorized_time_entry_update', userId, 'medium', { 
        timeEntryId,
        ownerUserId: existingTimeEntry.userId,
        userRole: user?.role 
      });
      return createErrorResponse(403, TimeEntryErrorCodes.UNAUTHORIZED_TIME_ENTRY_ACCESS, 'You can only update your own time entries');
    }

    // ✅ NEW: Trace status validation
    const statusValidation = await businessTracer.traceBusinessOperation(
      'validate-status',
      'time-entry',
      async () => {
        // Validate that the time entry can be updated (only draft and rejected entries)
        if (existingTimeEntry.status !== 'draft' && existingTimeEntry.status !== 'rejected') {
          return { valid: false, status: existingTimeEntry.status };
        }
        return { valid: true, status: existingTimeEntry.status };
      }
    );

    if (!statusValidation.valid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/{id}', 'PUT', 400, responseTime);
      businessMetrics.trackTimeEntryOperation('update', false);
      businessLogger.logBusinessOperation('update', 'time-entry', userId, false, { 
        timeEntryId,
        reason: 'invalid_status',
        currentStatus: statusValidation.status 
      });
      return createErrorResponse(400, TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED, 'Cannot update time entry that has been submitted or approved');
    }

    // ✅ NEW: Trace validation logic
    const validationResult = await businessTracer.traceBusinessOperation(
      'validate-update-data',
      'time-entry',
      async () => {
        const validationErrors: string[] = [];
        
        if (requestData.description !== undefined && requestData.description.trim().length === 0) {
          validationErrors.push('description cannot be empty');
        }
        
        if (requestData.date !== undefined) {
          // Validate date format (YYYY-MM-DD)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(requestData.date)) {
            validationErrors.push('date must be in YYYY-MM-DD format');
          } else {
            // Check if date is not in the future
            const entryDate = new Date(requestData.date);
            const today = new Date();
            today.setHours(23, 59, 59, 999); // End of today
            
            if (entryDate > today) {
              validationErrors.push('date cannot be in the future');
            }
          }
        }

        // Validate time fields if provided
        const startTime = requestData.startTime || existingTimeEntry.startTime;
        const endTime = requestData.endTime || existingTimeEntry.endTime;
        
        if (startTime && endTime) {
          const start = new Date(startTime);
          const end = new Date(endTime);
          
          if (start >= end) {
            validationErrors.push('endTime must be after startTime');
          }
          
          // Calculate duration and validate
          const calculatedDuration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
          if (calculatedDuration <= 0) {
            validationErrors.push('duration must be positive');
          }
          
          if (requestData.duration && Math.abs(requestData.duration - calculatedDuration) > 1) {
            validationErrors.push('provided duration does not match calculated duration from start and end times');
          }
        } else if (requestData.duration !== undefined) {
          if (requestData.duration <= 0) {
            validationErrors.push('duration must be positive');
          }
          if (requestData.duration > (24 * 60)) { // 24 hours in minutes
            validationErrors.push('duration cannot exceed 24 hours');
          }
        }

        // Validate hourly rate if provided
        if (requestData.hourlyRate !== undefined && requestData.hourlyRate < 0) {
          validationErrors.push('hourlyRate must be non-negative');
        }

        // Validate tags if provided
        if (requestData.tags && requestData.tags.length > 10) {
          validationErrors.push('maximum 10 tags allowed');
        }

        return validationErrors;
      }
    );

    if (validationResult.length > 0) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/{id}', 'PUT', 400, responseTime);
      businessMetrics.trackTimeEntryOperation('update', false);
      businessLogger.logBusinessOperation('update', 'time-entry', userId, false, { 
        timeEntryId,
        validationErrors: validationResult 
      });
      
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: TimeEntryErrorCodes.INVALID_TIME_ENTRY_DATA,
            message: `Validation failed: ${validationResult.join(', ')}`,
          },
          timestamp: new Date().toISOString(),
        } as ErrorResponse),
      };
    }

    logger.info('Validation passed, updating time entry', { userId, timeEntryId });

    // ✅ NEW: Trace database update operation
    const updatedTimeEntry = await businessTracer.traceDatabaseOperation(
      'update',
      'time-entries',
      async () => {
        return await timeEntryRepo.updateTimeEntry(timeEntryId, requestData);
      }
    );

    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Track successful metrics
    businessMetrics.trackApiPerformance('/time-entries/{id}', 'PUT', 200, responseTime);
    businessMetrics.trackTimeEntryOperation('update', true, requestData.duration);
    businessLogger.logBusinessOperation('update', 'time-entry', userId, true, { 
      timeEntryId,
      updatedFields: Object.keys(requestData)
    });

    logger.info('Time entry updated successfully', { 
      userId, 
      timeEntryId,
      responseTime 
    });

    return createSuccessResponse(updatedTimeEntry, 200, 'Time entry updated successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Enhanced error logging and metrics
    businessMetrics.trackApiPerformance('/time-entries/{id}', 'PUT', 500, responseTime);
    businessMetrics.trackTimeEntryOperation('update', false);
    
    businessLogger.logError(
      error instanceof Error ? error : new Error('Unknown error'),
      'time-entry-update',
      getCurrentUserId(event),
      { timeEntryId: event.pathParameters?.id, responseTime }
    );
    
    logger.error('Update time entry error', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : { message: 'Unknown error' },
      timeEntryId: event.pathParameters?.id,
      responseTime,
    });

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND) {
        return createErrorResponse(404, TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND, 'Time entry not found');
      }

      if (error.message === TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED) {
        return createErrorResponse(400, TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED, 'Cannot update submitted or approved time entry');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
  }
};

// ✅ NEW: Export handler with PowerTools v2.x middleware pattern
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }))
  .use(logMetrics(metrics));
