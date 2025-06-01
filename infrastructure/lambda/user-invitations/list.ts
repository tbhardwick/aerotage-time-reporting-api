import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { InvitationRepository } from '../shared/invitation-repository';
import { ValidationService } from '../shared/validation';
import { 
  InvitationFilters,
  InvitationErrorCodes
} from '../shared/types';

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

    logger.info('List user invitations request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations', 'GET', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'list-invitations', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Role-based access control - only managers and admins can list invitations with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-list-permissions',
      'invitation',
      async () => {
        if (userRole === 'employee') {
          return { canAccess: false, reason: 'employee_role_restriction' };
        }
        // Managers and admins can list invitations
        return { canAccess: true };
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations', 'GET', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'list-invitations', false, { 
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to list invitations');
    }

    // Parse query parameters with tracing
    const queryParams = event.queryStringParameters || {};
    const filters: InvitationFilters = await businessTracer.traceBusinessOperation(
      'parse-filters',
      'invitation',
      async () => {
        return {
          status: queryParams.status as 'pending' | 'accepted' | 'expired' | 'cancelled' | undefined,
          limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
          offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
          sortBy: queryParams.sortBy as 'createdAt' | 'expiresAt' | 'email' | undefined,
          sortOrder: queryParams.sortOrder as 'asc' | 'desc' | undefined,
        };
      }
    );

    logger.info('List invitations request parsed', { 
      currentUserId,
      userRole,
      filters: {
        status: filters.status,
        limit: filters.limit,
        offset: filters.offset,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      }
    });

    // Validate filters with tracing
    const validation = await businessTracer.traceBusinessOperation(
      'validate-filters',
      'invitation',
      async () => {
        return ValidationService.validateInvitationFilters(filters);
      }
    );

    if (!validation.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations', 'GET', 400, responseTime);
      businessLogger.logError(new Error(`Invalid filters: ${validation.errors.join(', ')}`), 'list-invitations-validation', currentUserId);
      return createErrorResponse(400, InvitationErrorCodes.INVALID_EMAIL, validation.errors.join(', '));
    }

    const repository = new InvitationRepository();

    // Get invitations with pagination with tracing
    const result = await businessTracer.traceDatabaseOperation(
      'list-invitations',
      'invitations',
      async () => {
        return await repository.listInvitations(filters);
      }
    );

    // Remove sensitive data from response with tracing
    const sanitizedInvitations = await businessTracer.traceBusinessOperation(
      'sanitize-invitations',
      'invitation',
      async () => {
        return result.invitations.map(invitation => ({
          ...invitation,
          invitationToken: '', // Don't return the actual token
          tokenHash: '', // Don't return the token hash
        }));
      }
    );

    const responseData = {
      items: sanitizedInvitations,
      pagination: {
        total: result.total,
        limit: filters.limit || 50,
        offset: filters.offset || 0,
        hasMore: result.hasMore,
      },
    };

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/user-invitations', 'GET', 200, responseTime);
    businessLogger.logBusinessOperation('list', 'invitation', currentUserId, true, { 
      totalInvitations: result.total,
      returnedCount: sanitizedInvitations.length,
      filters: {
        status: filters.status,
        limit: filters.limit,
        offset: filters.offset
      },
      userRole
    });

    logger.info('List invitations completed', { 
      currentUserId,
      totalInvitations: result.total,
      returnedCount: sanitizedInvitations.length,
      hasMore: result.hasMore,
      responseTime 
    });

    return createSuccessResponse(responseData);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/user-invitations', 'GET', 500, responseTime);
    businessLogger.logError(error as Error, 'list-invitations', getCurrentUserId(event) || 'unknown');

    logger.error('Error listing user invitations', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 