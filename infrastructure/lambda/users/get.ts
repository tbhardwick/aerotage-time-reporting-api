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

    logger.info('Get user request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}', 'GET', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'get-user', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}', 'GET', 400, responseTime);
      businessLogger.logError(new Error('User ID is required'), 'get-user-validation', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'User ID is required');
    }

    logger.info('User retrieval parameters parsed', { 
      currentUserId,
      targetUserId: userId,
      userRole,
      isSelfAccess: userId === currentUserId
    });

    const userRepository = new UserRepository();

    // Get user from the database with tracing
    const targetUser = await businessTracer.traceDatabaseOperation(
      'get-user',
      'users',
      async () => {
        return await userRepository.getUserById(userId);
      }
    );

    if (!targetUser) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}', 'GET', 404, responseTime);
      businessLogger.logBusinessOperation('get', 'user', currentUserId, false, { 
        targetUserId: userId,
        reason: 'user_not_found' 
      });
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Apply access control and data filtering with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'apply-access-control',
      'user',
      async () => {
        return applyAccessControl(targetUser, currentUserId, userRole);
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}', 'GET', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'get-user', false, { 
        targetUserId: userId,
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', accessControl.reason || 'You do not have permission to access this user data');
    }

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/{id}', 'GET', 200, responseTime);
    businessMetrics.trackUserOperation('read', true);
    businessLogger.logBusinessOperation('get', 'user', currentUserId, true, { 
      targetUserId: userId,
      targetUserName: targetUser.name,
      targetUserRole: targetUser.role,
      isSelfAccess: userId === currentUserId,
      userRole
    });

    logger.info('User retrieval completed', { 
      currentUserId,
      targetUserId: userId,
      targetUserName: targetUser.name,
      isSelfAccess: userId === currentUserId,
      responseTime 
    });

    return createSuccessResponse(accessControl.filteredData);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/users/{id}', 'GET', 500, responseTime);
    businessMetrics.trackUserOperation('read', false);
    businessLogger.logError(error as Error, 'get-user', getCurrentUserId(event) || 'unknown');

    logger.error('Error getting user', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      targetUserId: event.pathParameters?.id,
      responseTime
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to get user data');
  }
};

function applyAccessControl(
  user: User,
  currentUserId: string,
  userRole: string
): { canAccess: boolean; reason?: string; filteredData?: Record<string, unknown> } {
  // Check access permissions
  if (user.id === currentUserId) {
    // Users can always access their own data
    return {
      canAccess: true,
      filteredData: filterUserData(user, userRole),
    };
  }

  if (userRole === 'admin' || userRole === 'manager') {
    // Admins and managers can access all user data
    return {
      canAccess: true,
      filteredData: filterUserData(user, userRole),
    };
  }

  return {
    canAccess: false,
    reason: 'You can only access your own user data',
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
    preferences: user.preferences,
  };

  // Add additional fields for admin users
  if (userRole === 'admin') {
    filteredData.hourlyRate = user.hourlyRate;
    filteredData.permissions = user.permissions;
    filteredData.contactInfo = user.contactInfo;
    filteredData.updatedAt = user.updatedAt;
  }

  return filteredData;
}

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics));
