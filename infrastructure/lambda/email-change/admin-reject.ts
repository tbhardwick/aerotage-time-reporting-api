import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { EmailChangeService } from '../shared/email-change-service';
import { EmailChangeValidation } from '../shared/email-change-validation';
import { UserRepository } from '../shared/user-repository';
import { EmailChangeErrorCodes } from '../shared/types';

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
const emailService = new EmailChangeService();
const userRepo = new UserRepository();

interface RejectEmailChangeRequest {
  rejectionReason: string;
  rejectionNotes?: string;
}

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Admin reject email change request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/{id}/reject', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'reject-email-change', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Check admin permissions with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-admin-permissions',
      'email-change',
      async () => {
        if (userRole !== 'admin') {
          return { canAccess: false, reason: 'not_admin' };
        }
        return { canAccess: true };
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/{id}/reject', 'POST', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'reject-email-change', false, { 
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'Only administrators can reject email change requests');
    }

    // Get request ID from path parameters
    const emailChangeRequestId = event.pathParameters?.id;
    if (!emailChangeRequestId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/{id}/reject', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Request ID is required'), 'reject-email-change-validation', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request ID is required');
    }

    // Parse and validate request body with tracing
    let rejectRequest: RejectEmailChangeRequest = await businessTracer.traceBusinessOperation(
      'parse-rejection-request',
      'email-change',
      async () => {
        if (!event.body) {
          throw new Error('Request body is required');
        }

        try {
          return JSON.parse(event.body);
        } catch {
          throw new Error('Invalid JSON in request body');
        }
      }
    );

    logger.info('Admin reject request parsed', { 
      currentUserId,
      emailChangeRequestId,
      userRole,
      rejectionReason: rejectRequest.rejectionReason,
      hasRejectionNotes: !!rejectRequest.rejectionNotes
    });
    
    // Validate request data with tracing
    const validation = await businessTracer.traceBusinessOperation(
      'validate-rejection-request',
      'email-change',
      async () => {
        return EmailChangeValidation.validateRejectRequest(rejectRequest as unknown as Record<string, unknown>);
      }
    );

    if (!validation.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/{id}/reject', 'POST', 400, responseTime);
      businessLogger.logError(new Error(`Invalid rejection request: ${validation.errors.join(', ')}`), 'reject-email-change-validation', currentUserId);
      return createErrorResponse(400, EmailChangeErrorCodes.INVALID_REQUEST_DATA, validation.errors.join(', '));
    }

    // Get the email change request with tracing
    const emailChangeRequest = await businessTracer.traceDatabaseOperation(
      'get-email-change-request',
      'email-change',
      async () => {
        return await emailChangeRepo.getEmailChangeRequestById(emailChangeRequestId);
      }
    );

    if (!emailChangeRequest) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/{id}/reject', 'POST', 404, responseTime);
      businessLogger.logBusinessOperation('reject', 'email-change', currentUserId, false, { 
        emailChangeRequestId,
        reason: 'request_not_found' 
      });
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    // Validate request eligibility for rejection with tracing
    const eligibilityValidation = await businessTracer.traceBusinessOperation(
      'validate-rejection-eligibility',
      'email-change',
      async () => {
        const rejectableStatuses = ['pending_verification', 'pending_approval'];
        if (!rejectableStatuses.includes(emailChangeRequest.status)) {
          return { canReject: false, reason: 'not_rejectable_status', currentStatus: emailChangeRequest.status };
        }

        // Check if admin is trying to reject their own request
        if (emailChangeRequest.userId === currentUserId) {
          return { canReject: false, reason: 'cannot_reject_own_request' };
        }

        return { canReject: true };
      }
    );

    if (!eligibilityValidation.canReject) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/{id}/reject', 'POST', 400, responseTime);
      
      if (eligibilityValidation.reason === 'not_rejectable_status') {
        businessLogger.logBusinessOperation('reject', 'email-change', currentUserId, false, { 
          emailChangeRequestId,
          currentStatus: emailChangeRequest.status,
          reason: 'request_not_rejectable'
        });
        return createErrorResponse(400, EmailChangeErrorCodes.REQUEST_NOT_PENDING_APPROVAL, `Cannot reject request with status: ${emailChangeRequest.status}`);
      } else {
        businessLogger.logBusinessOperation('reject', 'email-change', currentUserId, false, { 
          emailChangeRequestId,
          targetUserId: emailChangeRequest.userId,
          reason: 'cannot_reject_own_request'
        });
        return createErrorResponse(400, EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST, 'You cannot reject your own email change request');
      }
    }

    // Extract IP address and user agent for audit trail
    const ipAddress = event.requestContext.identity?.sourceIp;
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];

    // Reject the request with tracing
    const rejectedRequest = await businessTracer.traceDatabaseOperation(
      'reject-email-change-request',
      'email-change',
      async () => {
        return await emailChangeRepo.rejectEmailChangeRequest(
          emailChangeRequestId,
          currentUserId,
          rejectRequest.rejectionReason,
          ipAddress,
          userAgent
        );
      }
    );

    // Get user information for notifications with tracing
    const [requestUser, rejecterUser] = await businessTracer.traceDatabaseOperation(
      'get-users-for-notification',
      'users',
      async () => {
        return await Promise.all([
          userRepo.getUserById(emailChangeRequest.userId),
          userRepo.getUserById(currentUserId)
        ]);
      }
    );

    // Send rejection notification to the user with tracing
    const notificationResult = await businessTracer.traceBusinessOperation(
      'send-rejection-notification',
      'email-change',
      async () => {
        if (requestUser) {
          try {
            await emailService.sendRejectionNotification(rejectedRequest, requestUser.name);
            return { success: true };
          } catch (emailError) {
            logger.error('Failed to send rejection notification', {
              error: emailError instanceof Error ? emailError.message : 'Unknown error',
              emailChangeRequestId,
              targetUserId: emailChangeRequest.userId,
              targetEmail: emailChangeRequest.newEmail
            });
            return { success: false, error: emailError };
          }
        }
        return { success: false, reason: 'user_not_found' };
      }
    );

    const responseData = {
      requestId: rejectedRequest.id,
      status: 'rejected',
      rejectedAt: rejectedRequest.rejectedAt!,
      rejectedBy: {
        id: currentUserId,
        name: rejecterUser?.name || 'Unknown Admin'
      },
      rejectionReason: rejectRequest.rejectionReason
    };

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/email-change/{id}/reject', 'POST', 200, responseTime);
    businessLogger.logBusinessOperation('reject', 'email-change', currentUserId, true, { 
      emailChangeRequestId,
      targetUserId: emailChangeRequest.userId,
      currentEmail: emailChangeRequest.currentEmail,
      newEmail: emailChangeRequest.newEmail,
      rejectionReason: rejectRequest.rejectionReason,
      hasRejectionNotes: !!rejectRequest.rejectionNotes,
      notificationSent: notificationResult.success,
      userRole
    });

    logger.info('Email change request rejected successfully', { 
      currentUserId,
      emailChangeRequestId,
      targetUserId: emailChangeRequest.userId,
      currentEmail: emailChangeRequest.currentEmail,
      newEmail: emailChangeRequest.newEmail,
      rejectionReason: rejectRequest.rejectionReason,
      rejecterName: rejecterUser?.name,
      responseTime 
    });

    return createSuccessResponse(responseData, 200, 'Email change request rejected successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/email-change/{id}/reject', 'POST', 500, responseTime);
    businessLogger.logError(error as Error, 'reject-email-change', getCurrentUserId(event) || 'unknown');

    logger.error('Error rejecting email change request', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      emailChangeRequestId: event.pathParameters?.id,
      responseTime
    });

    // Handle specific parsing errors
    if (error instanceof Error) {
      if (error.message === 'Request body is required') {
        return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
      }
      if (error.message === 'Invalid JSON in request body') {
        return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
      }
    }

    // Handle specific errors
    if ((error as Error).message === EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND) {
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    if ((error as Error).message === EmailChangeErrorCodes.REQUEST_NOT_PENDING_APPROVAL) {
      return createErrorResponse(400, EmailChangeErrorCodes.REQUEST_NOT_PENDING_APPROVAL, 'Request is not in a rejectable status');
    }

    if ((error as Error).message === EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST) {
      return createErrorResponse(400, EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST, 'You cannot reject your own email change request');
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 