import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  StartTimerRequest,
  TimeEntryErrorCodes,
} from '../shared/types';

// PowerTools v2.x imports - MANDATORY for all new functions
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools v2.x middleware - MANDATORY
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger - MANDATORY
    addRequestContext(event.requestContext?.requestId || 'unknown');
    
    logger.info('Start timer request received', {
      httpMethod: event.httpMethod,
      path: event.path,
      queryStringParameters: event.queryStringParameters
    });

    // Authentication - MANDATORY
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      metrics.addMetric('ApiClientError', MetricUnit.Count, 1);
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Parse request body
    if (!event.body) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/timer/start', 'POST', 400, responseTime);
      return createErrorResponse(400, TimeEntryErrorCodes.INVALID_TIME_ENTRY_DATA, 'Request body is required');
    }

    let request: StartTimerRequest;
    try {
      request = JSON.parse(event.body);
      logger.info('Request body parsed successfully', { 
        userId: currentUserId,
        projectId: request.projectId 
      });
    } catch {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/timer/start', 'POST', 400, responseTime);
      return createErrorResponse(400, TimeEntryErrorCodes.INVALID_TIME_ENTRY_DATA, 'Invalid JSON in request body');
    }

    // Validate required fields
    if (!request.projectId || !request.description) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/timer/start', 'POST', 400, responseTime);
      return createErrorResponse(400, TimeEntryErrorCodes.INVALID_TIME_ENTRY_DATA, 'Missing required fields: projectId, description');
    }

    // Repository pattern - MANDATORY
    const timeEntryRepo = new TimeEntryRepository();

    // Start timer with business tracing - MANDATORY for complex operations
    const timerSession = await businessTracer.traceBusinessOperation(
      'start-timer',
      'timer',
      async () => {
        return await timeEntryRepo.startTimer(currentUserId, request as unknown as Record<string, unknown>);
      }
    );

    const responseTime = Date.now() - startTime;

    // Success metrics - MANDATORY
    businessMetrics.trackApiPerformance('/time-entries/timer/start', 'POST', 201, responseTime);
    metrics.addMetric('TimerStartSuccess', MetricUnit.Count, 1);
    businessLogger.logBusinessOperation('start', 'timer', currentUserId, true, { 
      timerId: timerSession.id,
      projectId: request.projectId
    });

    logger.info('Timer started successfully', {
      userId: currentUserId,
      timerId: timerSession.id,
      projectId: request.projectId,
      responseTime
    });

    return createSuccessResponse(timerSession, 201, 'Timer started successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Start timer error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    // Error metrics - MANDATORY
    businessMetrics.trackApiPerformance('/time-entries/timer/start', 'POST', 500, responseTime);
    metrics.addMetric('TimerStartError', MetricUnit.Count, 1);

    // Handle specific timer errors
    if (error instanceof Error) {
      if (error.message === TimeEntryErrorCodes.TIMER_ALREADY_RUNNING) {
        return createErrorResponse(409, TimeEntryErrorCodes.TIMER_ALREADY_RUNNING, 'A timer is already running for this user');
      }
      if (error.message === TimeEntryErrorCodes.PROJECT_NOT_FOUND) {
        return createErrorResponse(404, TimeEntryErrorCodes.PROJECT_NOT_FOUND, 'Project not found');
      }
    }
    
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
  }
};

// PowerTools middleware export - MANDATORY
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 