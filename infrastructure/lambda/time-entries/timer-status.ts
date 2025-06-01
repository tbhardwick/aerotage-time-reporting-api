import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';

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
    
    logger.info('Timer status request received', {
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

    // Repository pattern - MANDATORY
    const timeEntryRepo = new TimeEntryRepository();

    // Get timer status with business tracing - MANDATORY for complex operations
    const timerSession = await businessTracer.traceBusinessOperation(
      'get-timer-status',
      'timer',
      async () => {
        return await timeEntryRepo.getActiveTimer(currentUserId);
      }
    );

    const responseTime = Date.now() - startTime;

    // Success metrics - MANDATORY
    businessMetrics.trackApiPerformance('/time-entries/timer/status', 'GET', 200, responseTime);
    metrics.addMetric('TimerStatusSuccess', MetricUnit.Count, 1);
    businessLogger.logBusinessOperation('status', 'timer', currentUserId, true, { 
      hasActiveTimer: !!timerSession,
      timerId: timerSession?.id
    });

    logger.info('Timer status retrieved successfully', {
      userId: currentUserId,
      hasActiveTimer: !!timerSession,
      timerId: timerSession?.id,
      responseTime
    });

    // Calculate elapsed time if timer is active
    const response = timerSession ? {
      ...timerSession,
      elapsedMinutes: Math.round((new Date().getTime() - new Date(timerSession.startTime).getTime()) / (1000 * 60))
    } : null;

    return createSuccessResponse(response, 200, timerSession ? 'Active timer found' : 'No active timer');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Timer status error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    // Error metrics - MANDATORY
    businessMetrics.trackApiPerformance('/time-entries/timer/status', 'GET', 500, responseTime);
    metrics.addMetric('TimerStatusError', MetricUnit.Count, 1);
    
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
  }
};

// PowerTools middleware export - MANDATORY
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 