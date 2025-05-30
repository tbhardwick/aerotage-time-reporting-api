import { APIGatewayProxyResult } from 'aws-lambda';
import { createSuccessResponse } from '../shared/response-helper';

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

export const handler = async (): Promise<APIGatewayProxyResult> => {
  try {
    const now = Date.now();
    const uptime = Math.floor((now - startTime) / 1000);
    
    // Basic health check - in a real implementation, you might check:
    // - Database connectivity
    // - External service dependencies
    // - Memory usage
    // - Disk space
    
    const healthResponse: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.STAGE || 'unknown',
      services: {
        api: 'healthy',
        database: 'healthy', // Could check DynamoDB connectivity
        auth: 'healthy', // Could check Cognito connectivity
      },
      uptime,
    };

    return createSuccessResponse(healthResponse);
  } catch (error) {
    console.error('Health check failed:', error);
    
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