import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { 
  InvitationErrorCodes
} from '../shared/types';
import { InvitationRepository } from '../shared/invitation-repository';

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

    logger.info('Cancel invitation request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/{id}/cancel', 'DELETE', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'cancel-invitation', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Role-based access control - only managers and admins can cancel invitations with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-cancel-permissions',
      'invitation',
      async () => {
        if (userRole === 'employee') {
          return { canAccess: false, reason: 'employee_role_restriction' };
        }
        // Managers and admins can cancel invitations
        return { canAccess: true };
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/{id}/cancel', 'DELETE', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'cancel-invitation', false, { 
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to cancel invitations');
    }

    // Get invitation ID from path parameters
    const invitationId = event.pathParameters?.id;
    if (!invitationId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/{id}/cancel', 'DELETE', 400, responseTime);
      businessLogger.logError(new Error('Invitation ID is required'), 'cancel-invitation-validation', currentUserId);
      return createErrorResponse(400, InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation ID is required');
    }

    logger.info('Cancel invitation request parsed', { 
      currentUserId,
      invitationId,
      userRole
    });

    const repository = new InvitationRepository();

    // Get existing invitation with tracing
    const invitation = await businessTracer.traceDatabaseOperation(
      'get-invitation',
      'invitations',
      async () => {
        return await repository.getInvitationById(invitationId);
      }
    );

    if (!invitation) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/{id}/cancel', 'DELETE', 404, responseTime);
      businessLogger.logBusinessOperation('cancel', 'invitation', currentUserId, false, { 
        invitationId,
        reason: 'invitation_not_found' 
      });
      return createErrorResponse(404, InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation not found');
    }

    // Check if invitation is still pending with tracing
    const statusValidation = await businessTracer.traceBusinessOperation(
      'validate-invitation-status',
      'invitation',
      async () => {
        if (invitation.status !== 'pending') {
          return { canCancel: false, reason: 'not_pending', currentStatus: invitation.status };
        }
        return { canCancel: true };
      }
    );

    if (!statusValidation.canCancel) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/{id}/cancel', 'DELETE', 400, responseTime);
      businessLogger.logBusinessOperation('cancel', 'invitation', currentUserId, false, { 
        invitationId,
        email: invitation.email,
        currentStatus: invitation.status,
        reason: 'invitation_not_pending'
      });
      return createErrorResponse(400, InvitationErrorCodes.INVITATION_ALREADY_ACCEPTED, 'Invitation is no longer pending');
    }

    // Update invitation status to cancelled with tracing
    await businessTracer.traceDatabaseOperation(
      'cancel-invitation',
      'invitations',
      async () => {
        return await repository.updateInvitation(invitationId, {
          status: 'cancelled',
        });
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/user-invitations/{id}/cancel', 'DELETE', 200, responseTime);
    businessLogger.logBusinessOperation('cancel', 'invitation', currentUserId, true, { 
      invitationId,
      email: invitation.email,
      invitedBy: invitation.invitedBy,
      previousStatus: invitation.status,
      newStatus: 'cancelled',
      userRole
    });

    logger.info('Invitation cancelled successfully', { 
      currentUserId,
      invitationId,
      email: invitation.email,
      invitedBy: invitation.invitedBy,
      responseTime 
    });

    return createSuccessResponse(undefined, 200, 'Invitation cancelled successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/user-invitations/{id}/cancel', 'DELETE', 500, responseTime);
    businessLogger.logError(error as Error, 'cancel-invitation', getCurrentUserId(event) || 'unknown');

    logger.error('Error cancelling user invitation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      invitationId: event.pathParameters?.id,
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