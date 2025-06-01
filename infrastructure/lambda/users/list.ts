import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { UserRepository } from '../shared/user-repository';
import { User } from '../shared/types';

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

    logger.info('List users request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users', 'GET', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'list-users', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    logger.info('List users parameters parsed', { 
      currentUserId,
      userRole
    });

    // Check access permissions with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'check-authorization',
      'user',
      async () => {
        return applyAccessControl(userRole);
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users', 'GET', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'list-users', false, { 
        reason: 'insufficient_permissions',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', accessControl.reason || 'You do not have permission to list users');
    }

    const userRepository = new UserRepository();

    // Get all users from the database with tracing
    const users = await businessTracer.traceDatabaseOperation(
      'list-users',
      'users',
      async () => {
        return await userRepository.getAllUsers();
      }
    );

    // Filter sensitive information based on role with tracing
    const filteredUsers = await businessTracer.traceBusinessOperation(
      'filter-user-data',
      'user',
      async () => {
        return users.map(user => filterUserData(user, userRole));
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users', 'GET', 200, responseTime);
    businessMetrics.trackUserOperation('read', true);
    businessLogger.logBusinessOperation('list', 'user', currentUserId, true, { 
      userCount: users.length,
      filteredUserCount: filteredUsers.length,
      userRole
    });

    logger.info('List users completed', { 
      currentUserId,
      userCount: users.length,
      filteredUserCount: filteredUsers.length,
      responseTime 
    });

    return createSuccessResponse({ users: filteredUsers }, 200, 'Users retrieved successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/users', 'GET', 500, responseTime);
    businessMetrics.trackUserOperation('read', false);
    businessLogger.logError(error as Error, 'list-users', getCurrentUserId(event) || 'unknown');

    logger.error('Error listing users', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to list users');
  }
};

function applyAccessControl(userRole: string): { canAccess: boolean; reason?: string } {
  if (userRole === 'admin' || userRole === 'manager') {
    return { canAccess: true };
  }

  return {
    canAccess: false,
    reason: 'Only managers and admins can list users',
  };
}

function filterUserData(user: User, userRole: string): Record<string, unknown> {
  // Base fields that all roles can see
  const filteredData: Record<string, unknown> = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    jobTitle: user.jobTitle,
    isActive: user.isActive,
    startDate: user.startDate,
    createdAt: user.createdAt,
  };

  // Add additional fields for admin users
  if (userRole === 'admin') {
    filteredData.hourlyRate = user.hourlyRate;
    filteredData.permissions = user.permissions;
    filteredData.contactInfo = user.contactInfo;
    filteredData.updatedAt = user.updatedAt;
    filteredData.preferences = user.preferences;
  }

  return filteredData;
}

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 