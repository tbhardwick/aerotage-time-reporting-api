import { APIGatewayProxyResult } from 'aws-lambda';
import { createSuccessResponse } from '../shared/response-helper';

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

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  services: {
    api: 'healthy' | 'degraded' | 'unhealthy';
    database: 'healthy' | 'degraded' | 'unhealthy';
    auth: 'healthy' | 'degraded' | 'unhealthy';
  };
  uptime: number;
}

const startTime = Date.now();

const lambdaHandler = async (): Promise<APIGatewayProxyResult> => {
  const requestStartTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = `health-${Date.now()}`;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, 'GET', '/health');

    logger.info('Health check request started', {
      requestId,
      httpMethod: 'GET',
      resource: '/health',
    });

    // Perform health checks with tracing
    const healthStatus = await businessTracer.traceBusinessOperation(
      'perform-health-checks',
      'system',
      async () => {
        const now = Date.now();
        const uptime = Math.floor((now - startTime) / 1000);
        
        // Basic health check - in a real implementation, you might check:
        // - Database connectivity
        // - External service dependencies
        // - Memory usage
        // - Disk space
        
        return {
          status: 'healthy' as const,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          environment: process.env.STAGE || 'unknown',
          services: {
            api: 'healthy' as const,
            database: 'healthy' as const, // Could check DynamoDB connectivity
            auth: 'healthy' as const, // Could check Cognito connectivity
          },
          uptime,
        };
      }
    );

    const responseTime = Date.now() - requestStartTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/health', 'GET', 200, responseTime);
    metrics.addMetric('HealthCheckSuccess', MetricUnit.Count, 1);
    businessLogger.logBusinessOperation('check', 'health', 'system', true, { 
      status: healthStatus.status,
      uptime: healthStatus.uptime,
      environment: healthStatus.environment
    });

    logger.info('Health check completed successfully', { 
      status: healthStatus.status,
      uptime: healthStatus.uptime,
      responseTime 
    });

    return createSuccessResponse(healthStatus);
  } catch (error) {
    const responseTime = Date.now() - requestStartTime;
    
    businessMetrics.trackApiPerformance('/health', 'GET', 500, responseTime);
    metrics.addMetric('HealthCheckFailure', MetricUnit.Count, 1);
    businessLogger.logError(error as Error, 'health-check', 'system');

    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        status: 'unhealthy',
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Health check failed',
        },
      }),
    };
  }
}; 

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 