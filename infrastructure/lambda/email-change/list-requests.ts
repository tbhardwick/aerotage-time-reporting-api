import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { UserRepository } from '../shared/user-repository';
import { EmailChangeErrorCodes } from '../shared/types';
import { getCurrentUserId } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';

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

const emailChangeRepo = new EmailChangeRepository();
const userRepo = new UserRepository();

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('List email change requests started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
      path: event.path,
      queryStringParameters: event.queryStringParameters
    });

    // Extract user information from authorization context
    const authContext = event.requestContext.authorizer;
    const currentUserId = getCurrentUserId(event);
    const userRole = authContext?.role || authContext?.claims?.['custom:role'];

    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/list', 'GET', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'list-email-change-requests', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Parse and validate query parameters with tracing
    const queryValidation = await businessTracer.traceBusinessOperation(
      'parse-and-validate-query-params',
      'email-change',
      async () => {
        const queryParams = event.queryStringParameters || {};
        const {
          userId: filterUserId,
          status,
          limit = '20',
          lastEvaluatedKey,
          includeCompleted = 'false',
          sortBy,
          sortOrder
        } = queryParams;

        // Validate limit parameter
        const limitNum = parseInt(limit, 10);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          throw new Error('Limit must be between 1 and 100');
        }

        // Validate status parameter
        const validStatuses = ['pending_verification', 'pending_approval', 'approved', 'rejected', 'cancelled', 'completed'];
        if (status && !validStatuses.includes(status)) {
          throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        // Validate sortBy parameter
        const validSortFields = ['requestedAt', 'status', 'currentEmail', 'newEmail'];
        if (sortBy && !validSortFields.includes(sortBy)) {
          throw new Error(`Invalid sortBy field. Must be one of: ${validSortFields.join(', ')}`);
        }

        // Validate sortOrder parameter
        const validSortOrders = ['asc', 'desc'];
        if (sortOrder && !validSortOrders.includes(sortOrder)) {
          throw new Error(`Invalid sortOrder. Must be one of: ${validSortOrders.join(', ')}`);
        }

        return {
          filterUserId,
          status,
          limitNum,
          lastEvaluatedKey,
          includeCompleted: includeCompleted === 'true',
          sortBy,
          sortOrder
        };
      }
    );

    // Determine target user and check permissions with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'determine-target-user-and-permissions',
      'email-change',
      async () => {
        let targetUserId: string | undefined;

        if (queryValidation.filterUserId) {
          // Admin can view any user's requests, regular users can only view their own
          if (userRole !== 'admin' && queryValidation.filterUserId !== currentUserId) {
            return { 
              canAccess: false, 
              reason: 'insufficient_permissions',
              requestedUserId: queryValidation.filterUserId
            };
          }
          targetUserId = queryValidation.filterUserId;
        } else if (userRole !== 'admin') {
          // Regular users can only see their own requests
          targetUserId = currentUserId;
        }
        // Admin with no userId filter can see all requests (targetUserId remains undefined)

        return { canAccess: true, targetUserId };
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/list', 'GET', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'list-email-change-requests', false, { 
        requestedUserId: accessControl.requestedUserId,
        reason: 'insufficient_permissions',
        userRole
      });
      return createErrorResponse(403, EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'You can only view your own email change requests');
    }

    logger.info('List email change requests parsed and validated', { 
      currentUserId,
      userRole,
      targetUserId: accessControl.targetUserId,
      status: queryValidation.status,
      limit: queryValidation.limitNum,
      includeCompleted: queryValidation.includeCompleted,
      sortBy: queryValidation.sortBy,
      sortOrder: queryValidation.sortOrder,
      isAdminViewingAll: !accessControl.targetUserId && userRole === 'admin'
    });

    // Get email change requests with tracing
    const result = await businessTracer.traceDatabaseOperation(
      'list-email-change-requests',
      'email-change',
      async () => {
        return await emailChangeRepo.listEmailChangeRequests({
          userId: accessControl.targetUserId,
          status: queryValidation.status,
          limit: queryValidation.limitNum,
          lastEvaluatedKey: queryValidation.lastEvaluatedKey,
          includeCompleted: queryValidation.includeCompleted,
          sortBy: queryValidation.sortBy,
          sortOrder: queryValidation.sortOrder
        });
      }
    );

    // Enrich requests with user information for admin view with tracing
    const enrichedRequests = await businessTracer.traceBusinessOperation(
      'enrich-requests-with-user-info',
      'email-change',
      async () => {
        if (!accessControl.targetUserId && userRole === 'admin') {
          // Get unique user IDs
          const userIds = [...new Set(result.requests.map(req => req.userId))];
          
          // Get user information
          const users = await Promise.all(
            userIds.map(async (userId) => {
              try {
                const user = await userRepo.getUserById(userId);
                return user ? { id: userId, name: user.name, email: user.email } : null;
              } catch (error) {
                logger.warn('Failed to get user for enrichment', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
                return null;
              }
            })
          );

          const userMap = new Map(
            users.filter(user => user !== null).map(user => [user!.id, user!])
          );

          // Enrich requests with user information
          return result.requests.map(request => ({
            ...request,
            userName: userMap.get(request.userId)?.name || 'Unknown User',
            userCurrentEmail: userMap.get(request.userId)?.email || request.currentEmail
          }));
        }

        return result.requests;
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/email-change/list', 'GET', 200, responseTime);
    businessLogger.logBusinessOperation('list', 'email-change-requests', currentUserId, true, { 
      targetUserId: accessControl.targetUserId,
      userRole,
      requestCount: enrichedRequests.length,
      status: queryValidation.status,
      limit: queryValidation.limitNum,
      includeCompleted: queryValidation.includeCompleted,
      hasMore: !!result.lastEvaluatedKey,
      isAdminViewingAll: !accessControl.targetUserId && userRole === 'admin'
    });

    logger.info('Email change requests listed successfully', { 
      currentUserId,
      userRole,
      targetUserId: accessControl.targetUserId,
      requestCount: enrichedRequests.length,
      hasMore: !!result.lastEvaluatedKey,
      responseTime 
    });

    const responseData: Record<string, unknown> = {
      requests: enrichedRequests,
      pagination: {
        total: enrichedRequests.length, // Note: This is the current page count, not total across all pages
        limit: queryValidation.limitNum,
        offset: 0, // Not used with cursor-based pagination
        hasMore: !!result.lastEvaluatedKey
      }
    };

    // Add lastEvaluatedKey to response for cursor-based pagination
    if (result.lastEvaluatedKey) {
      responseData.lastEvaluatedKey = result.lastEvaluatedKey;
    }

    return createSuccessResponse(responseData);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/email-change/list', 'GET', 500, responseTime);
    businessLogger.logError(error as Error, 'list-email-change-requests', getCurrentUserId(event) || 'unknown');

    logger.error('Error listing email change requests', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    // Handle specific validation errors
    if (error instanceof Error) {
      if (error.message.includes('Limit must be between') || 
          error.message.includes('Invalid status') || 
          error.message.includes('Invalid sortBy') || 
          error.message.includes('Invalid sortOrder')) {
        return createErrorResponse(400, 'INVALID_REQUEST', error.message);
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred while retrieving email change requests');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 