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

interface UpdateUserRequest {
  name?: string;
  role?: 'admin' | 'manager' | 'employee';
  department?: string;
  jobTitle?: string;
  hourlyRate?: number;
  isActive?: boolean;
  permissions?: {
    features: string[];
    projects: string[];
  };
  preferences?: {
    theme: 'light' | 'dark';
    notifications: boolean;
    timezone: string;
  };
  contactInfo?: {
    phone?: string;
    address?: string;
    emergencyContact?: string;
  };
}

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Update user request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}', 'PUT', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'update-user', false, { reason: 'no_user_id' });
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
      businessMetrics.trackApiPerformance('/users/{id}', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('User ID is required'), 'update-user-validation', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'User ID is required');
    }

    // Parse request body
    if (!event.body) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('Request body is required'), 'update-user-validation', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let updateData: UpdateUserRequest;
    try {
      updateData = JSON.parse(event.body);
      logger.info('Update user request parsed', { 
        currentUserId,
        targetUserId: userId,
        updateFields: Object.keys(updateData),
        isSelfUpdate: userId === currentUserId
      });
    } catch {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('Invalid JSON in request body'), 'update-user-parse', currentUserId);
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Apply access control and get allowed updates with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'apply-access-control',
      'user',
      async () => {
        return applyAccessControl(updateData, userId, currentUserId, userRole);
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}', 'PUT', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'update-user', false, { 
        targetUserId: userId,
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', accessControl.reason || 'You do not have permission to update this user');
    }

    // Validate that there are updates to make
    if (Object.keys(accessControl.allowedUpdates).length === 0) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}', 'PUT', 400, responseTime);
      businessLogger.logBusinessOperation('update', 'user', currentUserId, false, { 
        targetUserId: userId,
        reason: 'no_valid_updates'
      });
      return createErrorResponse(400, 'INVALID_REQUEST', 'No valid updates provided');
    }

    const userRepository = new UserRepository();

    // Check if user exists with tracing
    const existingUser = await businessTracer.traceDatabaseOperation(
      'get-user',
      'users',
      async () => {
        return await userRepository.getUserById(userId);
      }
    );

    if (!existingUser) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}', 'PUT', 404, responseTime);
      businessLogger.logBusinessOperation('update', 'user', currentUserId, false, { 
        targetUserId: userId,
        reason: 'user_not_found' 
      });
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Update user with allowed fields with tracing
    const updatedUser = await businessTracer.traceDatabaseOperation(
      'update-user',
      'users',
      async () => {
        return await userRepository.updateUser(userId, accessControl.allowedUpdates);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/{id}', 'PUT', 200, responseTime);
    businessMetrics.trackUserOperation('update', true);
    businessLogger.logBusinessOperation('update', 'user', currentUserId, true, { 
      targetUserId: userId,
      targetUserName: existingUser.name,
      updatedFields: Object.keys(accessControl.allowedUpdates),
      isSelfUpdate: userId === currentUserId,
      userRole
    });

    logger.info('User update completed', { 
      currentUserId,
      targetUserId: userId,
      targetUserName: existingUser.name,
      updatedFields: Object.keys(accessControl.allowedUpdates),
      isSelfUpdate: userId === currentUserId,
      responseTime 
    });

    return createSuccessResponse(updatedUser);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/users/{id}', 'PUT', 500, responseTime);
    businessMetrics.trackUserOperation('update', false);
    businessLogger.logError(error as Error, 'update-user', getCurrentUserId(event) || 'unknown');

    logger.error('Error updating user', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      targetUserId: event.pathParameters?.id,
      responseTime
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to update user');
  }
};

function applyAccessControl(
  updateData: UpdateUserRequest,
  targetUserId: string,
  currentUserId: string,
  userRole: string
): { canAccess: boolean; reason?: string; allowedUpdates: Partial<User> } {
  // Check basic access permissions
  if (targetUserId !== currentUserId && userRole !== 'admin') {
    return {
      canAccess: false,
      reason: 'You can only update your own user data',
      allowedUpdates: {},
    };
  }

  const allowedUpdates: Partial<User> = {};

  if (userRole === 'admin') {
    // Admins can update everything
    if (updateData.name !== undefined) allowedUpdates.name = updateData.name;
    if (updateData.role !== undefined) allowedUpdates.role = updateData.role;
    if (updateData.department !== undefined) allowedUpdates.department = updateData.department;
    if (updateData.jobTitle !== undefined) allowedUpdates.jobTitle = updateData.jobTitle;
    if (updateData.hourlyRate !== undefined) allowedUpdates.hourlyRate = updateData.hourlyRate;
    if (updateData.isActive !== undefined) allowedUpdates.isActive = updateData.isActive;
    if (updateData.permissions !== undefined) allowedUpdates.permissions = updateData.permissions;
    if (updateData.preferences !== undefined) allowedUpdates.preferences = updateData.preferences;
    if (updateData.contactInfo !== undefined) allowedUpdates.contactInfo = updateData.contactInfo;
  } else if (targetUserId === currentUserId) {
    // Users can update their own basic information
    if (updateData.name !== undefined) allowedUpdates.name = updateData.name;
    if (updateData.preferences !== undefined) allowedUpdates.preferences = updateData.preferences;
    if (updateData.contactInfo !== undefined) allowedUpdates.contactInfo = updateData.contactInfo;

    // Check for restricted fields
    if (updateData.role !== undefined || updateData.permissions !== undefined || updateData.hourlyRate !== undefined) {
      return {
        canAccess: false,
        reason: 'You cannot update role, permissions, or hourly rate',
        allowedUpdates: {},
      };
    }
  }

  return {
    canAccess: true,
    allowedUpdates,
  };
}

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics));
