import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { getCurrentUserId } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { 
  CreateTimeEntryRequest, 
  TimeEntryErrorCodes
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
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);
    
    logger.info('Create time entry request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // ✅ NEW: Track API request metrics
    businessMetrics.trackApiPerformance(
      '/time-entries',
      'POST',
      0, // Will be updated later
      0  // Will be updated later
    );

    // Extract user information from authorization context using shared helper
    const userId = getCurrentUserId(event);
    
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries', 'POST', 401, responseTime);
      businessLogger.logAuth(userId || 'unknown', 'time-entry-create', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // ✅ NEW: Add user context to tracer and logger
    businessTracer.addUserContext(userId);
    addRequestContext(requestId, userId);

    // Parse request body
    if (!event.body) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Missing request body'), 'time-entry-create', userId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let requestData: CreateTimeEntryRequest;
    try {
      requestData = JSON.parse(event.body);
      logger.info('Request body parsed successfully', { userId, requestDataKeys: Object.keys(requestData) });
    } catch (parseError) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries', 'POST', 400, responseTime);
      businessLogger.logError(parseError as Error, 'time-entry-create-parse', userId);
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // ✅ NEW: Trace validation logic
    const validationResult = await businessTracer.traceBusinessOperation(
      'validate-time-entry',
      'time-entry',
      async () => {
        // Validate required fields
        const validationErrors: string[] = [];
        
        if (!requestData.projectId) {
          validationErrors.push('projectId is required');
        }
        
        if (!requestData.description || requestData.description.trim().length === 0) {
          validationErrors.push('description is required');
        }
        
        if (!requestData.date) {
          validationErrors.push('date is required');
        } else {
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
        if (requestData.startTime && requestData.endTime) {
          const startTime = new Date(requestData.startTime);
          const endTime = new Date(requestData.endTime);
          
          if (startTime >= endTime) {
            validationErrors.push('endTime must be after startTime');
          }
          
          // Calculate duration and validate
          const calculatedDuration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
          if (calculatedDuration <= 0) {
            validationErrors.push('duration must be positive');
          }
          
          if (requestData.duration && Math.abs(requestData.duration - calculatedDuration) > 1) {
            validationErrors.push('provided duration does not match calculated duration from start and end times');
          }
        } else if (requestData.duration) {
          if (requestData.duration <= 0) {
            validationErrors.push('duration must be positive');
          }
          if (requestData.duration > (24 * 60)) { // 24 hours in minutes
            validationErrors.push('duration cannot exceed 24 hours');
          }
        } else {
          validationErrors.push('either duration or both startTime and endTime must be provided');
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
      businessMetrics.trackApiPerformance('/time-entries', 'POST', 400, responseTime);
      businessMetrics.trackTimeEntryOperation('create', false);
      businessLogger.logBusinessOperation('create', 'time-entry', userId, false, { 
        validationErrors: validationResult 
      });
      
      return createErrorResponse(
        400, 
        TimeEntryErrorCodes.INVALID_TIME_ENTRY_DATA, 
        `Validation failed: ${validationResult.join(', ')}`
      );
    }

    logger.info('Validation passed, creating time entry', { userId, projectId: requestData.projectId });

    // ✅ NEW: Trace database operation
    const timeEntry = await businessTracer.traceDatabaseOperation(
      'create',
      'time-entries',
      async () => {
        return await timeEntryRepo.createTimeEntry(userId, requestData);
      }
    );

    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Track successful metrics
    businessMetrics.trackApiPerformance('/time-entries', 'POST', 201, responseTime);
    businessMetrics.trackTimeEntryOperation('create', true, requestData.duration);
    businessLogger.logBusinessOperation('create', 'time-entry', userId, true, { 
      timeEntryId: timeEntry.id,
      projectId: requestData.projectId,
      duration: requestData.duration 
    });

    logger.info('Time entry created successfully', { 
      userId, 
      timeEntryId: timeEntry.id,
      responseTime 
    });

    return createSuccessResponse(timeEntry, 201, 'Time entry created successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const userId = getCurrentUserId(event);
    
    // ✅ NEW: Track error metrics and logging
    businessMetrics.trackApiPerformance('/time-entries', 'POST', 500, responseTime);
    businessMetrics.trackTimeEntryOperation('create', false);
    businessLogger.logError(error as Error, 'time-entry-create', userId);

    logger.error('Error creating time entry', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      responseTime 
    });

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === TimeEntryErrorCodes.PROJECT_NOT_FOUND) {
        businessMetrics.trackApiPerformance('/time-entries', 'POST', 404, responseTime);
        return createErrorResponse(404, TimeEntryErrorCodes.PROJECT_NOT_FOUND, 'Project not found');
      }

      if (error.message === TimeEntryErrorCodes.PROJECT_ACCESS_DENIED) {
        businessMetrics.trackApiPerformance('/time-entries', 'POST', 403, responseTime);
        return createErrorResponse(403, TimeEntryErrorCodes.PROJECT_ACCESS_DENIED, 'Access denied to project');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
  }
};

// ✅ FIXED: Export handler with correct PowerTools v2.x Middy middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }))
  .use(logMetrics(metrics));
