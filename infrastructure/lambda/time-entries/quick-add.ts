import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  QuickTimeEntryRequest,
  TimeTrackingErrorCodes,
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

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Quick add time entry request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/quick-add', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'quick-add-time-entry', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Parse request body
    if (!event.body) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/quick-add', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Request body is required'), 'quick-add-validation', currentUserId);
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_TIME_ENTRY_DATA, 'Request body is required');
    }

    let request: QuickTimeEntryRequest;
    try {
      request = JSON.parse(event.body);
      logger.info('Request body parsed successfully', { 
        userId: currentUserId,
        requestDataKeys: Object.keys(request) 
      });
    } catch {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/quick-add', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Invalid JSON in request body'), 'quick-add-parse', currentUserId);
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_TIME_ENTRY_DATA, 'Invalid JSON in request body');
    }

    // Validate the request with tracing
    const validationError = await businessTracer.traceBusinessOperation(
      'validate-quick-entry',
      'time-entry',
      async () => {
        return await validateQuickTimeEntry(request, currentUserId);
      }
    );

    if (validationError) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/quick-add', 'POST', 400, responseTime);
      businessLogger.logBusinessOperation('quick-add', 'time-entry', currentUserId, false, { 
        validationError 
      });
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_TIME_ENTRY_DATA, validationError);
    }

    // Calculate duration with tracing
    const { startTime: entryStartTime, endTime: entryEndTime, durationMinutes } = await businessTracer.traceBusinessOperation(
      'calculate-duration',
      'time-entry',
      async () => {
        const startTime = new Date(`${request.date}T${request.startTime}:00`);
        const endTime = new Date(`${request.date}T${request.endTime}:00`);
        const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
        
        return {
          startTime: `${request.date}T${request.startTime}:00.000Z`,
          endTime: `${request.date}T${request.endTime}:00.000Z`,
          durationMinutes
        };
      }
    );

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const timeEntryRepo = new TimeEntryRepository();
    const timeEntry = await businessTracer.traceDatabaseOperation(
      'create',
      'time-entries',
      async () => {
        return await timeEntryRepo.createTimeEntry(currentUserId, {
          projectId: request.projectId,
          description: request.description,
          date: request.date,
          startTime: entryStartTime,
          endTime: entryEndTime,
          duration: durationMinutes,
          isBillable: request.isBillable ?? true,
          notes: request.fillGap ? 'Created via quick entry to fill time gap' : undefined,
        });
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/time-entries/quick-add', 'POST', 201, responseTime);
    businessMetrics.trackTimeEntryOperation('create', true, durationMinutes);
    businessLogger.logBusinessOperation('quick-add', 'time-entry', currentUserId, true, { 
      timeEntryId: timeEntry.id,
      projectId: request.projectId,
      duration: durationMinutes,
      fillGap: request.fillGap
    });

    logger.info('Quick time entry created successfully', { 
      userId: currentUserId,
      timeEntryId: timeEntry.id,
      duration: durationMinutes,
      responseTime 
    });

    return createSuccessResponse(timeEntry, 201, 'Quick time entry created successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/time-entries/quick-add', 'POST', 500, responseTime);
    businessMetrics.trackTimeEntryOperation('create', false);
    businessLogger.logError(error as Error, 'quick-add-time-entry', getCurrentUserId(event) || 'unknown');

    logger.error('Error creating quick time entry', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
  }
};

async function validateQuickTimeEntry(request: QuickTimeEntryRequest, userId: string): Promise<string | null> {
  // Validate required fields
  if (!request.date || !request.startTime || !request.endTime || !request.projectId || !request.description) {
    return 'Missing required fields: date, startTime, endTime, projectId, description';
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(request.date)) {
    return 'Date must be in YYYY-MM-DD format';
  }

  // Validate time format
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(request.startTime) || !timeRegex.test(request.endTime)) {
    return 'Times must be in HH:MM format';
  }

  // Validate time range
  const startTime = new Date(`${request.date}T${request.startTime}:00`);
  const endTime = new Date(`${request.date}T${request.endTime}:00`);
  
  if (startTime >= endTime) {
    return 'Start time must be before end time';
  }

  const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  if (durationMinutes > 24 * 60) { // Max 24 hours
    return 'Duration cannot exceed 24 hours';
  }

  if (durationMinutes < 1) { // Min 1 minute
    return 'Duration must be at least 1 minute';
  }

  // Check for future dates
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (endTime > today) {
    return 'Cannot create time entries for future dates';
  }

  // MANDATORY: Use repository pattern for overlap check
  const timeEntryRepo = new TimeEntryRepository();
  const existingEntries = await timeEntryRepo.listTimeEntries({
    userId,
    dateFrom: request.date,
    dateTo: request.date,
    limit: 100
  });

  // Check for overlaps with existing entries
  const newStart = new Date(`${request.date}T${request.startTime}:00`);
  const newEnd = new Date(`${request.date}T${request.endTime}:00`);

  for (const entry of existingEntries.items) {
    if (entry.startTime && entry.endTime) {
      const existingStart = new Date(entry.startTime);
      const existingEnd = new Date(entry.endTime);

      // Check if times overlap
      if (newStart < existingEnd && newEnd > existingStart) {
        return 'Time entry overlaps with existing entry';
      }
    }
  }

  return null;
}

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 