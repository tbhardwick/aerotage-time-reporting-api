import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../../shared/response-helper';
import { UserRepository } from '../../shared/user-repository';
import { UserProfile } from '../../shared/types';

// PowerTools v2.x imports
import { logger, businessLogger, addRequestContext } from '../../shared/powertools-logger';
import { tracer, businessTracer } from '../../shared/powertools-tracer';
import { metrics, businessMetrics } from '../../shared/powertools-metrics';
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

    logger.info('Get user profile request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/profile', 'GET', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'get-user-profile', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Extract user ID from path parameters
    const requestedUserId = event.pathParameters?.id;
    if (!requestedUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/profile', 'GET', 400, responseTime);
      businessLogger.logError(new Error('User ID is required'), 'get-user-profile-validation', currentUserId);
      return createErrorResponse(400, 'MISSING_PARAMETER', 'User ID is required');
    }

    logger.info('Get user profile request parsed', { 
      currentUserId,
      requestedUserId,
      userRole,
      isSelfAccess: requestedUserId === currentUserId
    });

    // Authorization check: users can only access their own profile unless they're admin with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-profile-access',
      'user',
      async () => {
        if (requestedUserId !== currentUserId && userRole !== 'admin') {
          return { canAccess: false, reason: 'not_own_profile_or_admin' };
        }
        return { canAccess: true };
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/profile', 'GET', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'get-user-profile', false, { 
        requestedUserId,
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, 'FORBIDDEN', 'You can only access your own profile');
    }

    // MANDATORY: Use repository pattern instead of direct DynamoDB with tracing
    const userRepo = new UserRepository();
    const userProfile = await businessTracer.traceDatabaseOperation(
      'get-user-profile',
      'users',
      async () => {
        return await userRepo.getUserById(requestedUserId);
      }
    );

    if (!userProfile) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/profile', 'GET', 404, responseTime);
      businessLogger.logBusinessOperation('get', 'user-profile', currentUserId, false, { 
        requestedUserId,
        reason: 'user_not_found' 
      });
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User profile not found');
    }

    // Transform to UserProfile format (remove sensitive fields) with tracing
    const profile: UserProfile = await businessTracer.traceBusinessOperation(
      'transform-user-profile',
      'user',
      async () => {
        return {
          id: userProfile.id,
          email: userProfile.email,
          name: userProfile.name,
          jobTitle: userProfile.jobTitle,
          department: userProfile.department,
          hourlyRate: userProfile.hourlyRate,
          role: userProfile.role as 'employee' | 'admin' | 'manager',
          contactInfo: userProfile.contactInfo,
          startDate: userProfile.startDate,
          isActive: userProfile.isActive,
          createdAt: userProfile.createdAt,
          updatedAt: userProfile.updatedAt,
        };
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/{id}/profile', 'GET', 200, responseTime);
    businessMetrics.trackUserOperation('read', true);
    businessLogger.logBusinessOperation('get', 'user-profile', currentUserId, true, { 
      requestedUserId,
      targetUserName: userProfile.name,
      targetUserRole: userProfile.role,
      isSelfAccess: requestedUserId === currentUserId,
      userRole
    });

    logger.info('User profile retrieved successfully', { 
      currentUserId,
      requestedUserId,
      targetUserName: userProfile.name,
      targetUserRole: userProfile.role,
      isSelfAccess: requestedUserId === currentUserId,
      responseTime 
    });

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(profile, 200, 'User profile retrieved successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/users/{id}/profile', 'GET', 500, responseTime);
    businessMetrics.trackUserOperation('read', false);
    businessLogger.logError(error as Error, 'get-user-profile', getCurrentUserId(event) || 'unknown');

    logger.error('Error retrieving user profile', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedUserId: event.pathParameters?.id,
      responseTime
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 