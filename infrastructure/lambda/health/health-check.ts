import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      body: JSON.stringify({
        success: true,
        data: healthResponse,
      }),
    };
  } catch (error) {
    console.error('Health check error:', error);
    
    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.STAGE || 'unknown',
      services: {
        api: 'unhealthy',
        database: 'unhealthy',
        auth: 'unhealthy',
      },
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };

    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      body: JSON.stringify({
        success: false,
        data: errorResponse,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Health check failed',
        },
      }),
    };
  }
}; 