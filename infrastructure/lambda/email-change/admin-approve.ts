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

interface ApproveEmailChangeRequest {
  approvalNotes?: string;
}

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Admin approve email change request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/{id}/approve', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'approve-email-change', false, { reason: 'no_user_id' });
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
      businessMetrics.trackApiPerformance('/email-change/{id}/approve', 'POST', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'approve-email-change', false, { 
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'Only administrators can approve email change requests');
    }

    // Get request ID from path parameters
    const emailChangeRequestId = event.pathParameters?.id;
    if (!emailChangeRequestId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/{id}/approve', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Request ID is required'), 'approve-email-change-validation', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request ID is required');
    }

    // Parse and validate request body with tracing
    let approveRequest: ApproveEmailChangeRequest = await businessTracer.traceBusinessOperation(
      'parse-approval-request',
      'email-change',
      async () => {
        const defaultRequest: ApproveEmailChangeRequest = {};
        
        if (event.body) {
          try {
            return JSON.parse(event.body);
          } catch {
            throw new Error('Invalid JSON in request body');
          }
        }
        return defaultRequest;
      }
    );

    logger.info('Admin approve request parsed', { 
      currentUserId,
      emailChangeRequestId,
      userRole,
      hasApprovalNotes: !!approveRequest.approvalNotes
    });
    
    // Validate request data with tracing
    const validation = await businessTracer.traceBusinessOperation(
      'validate-approval-request',
      'email-change',
      async () => {
        return EmailChangeValidation.validateApproveRequest(approveRequest as unknown as Record<string, unknown>);
      }
    );

    if (!validation.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/{id}/approve', 'POST', 400, responseTime);
      businessLogger.logError(new Error(`Invalid approval request: ${validation.errors.join(', ')}`), 'approve-email-change-validation', currentUserId);
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
      businessMetrics.trackApiPerformance('/email-change/{id}/approve', 'POST', 404, responseTime);
      businessLogger.logBusinessOperation('approve', 'email-change', currentUserId, false, { 
        emailChangeRequestId,
        reason: 'request_not_found' 
      });
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    // Validate request eligibility for approval with tracing
    const eligibilityValidation = await businessTracer.traceBusinessOperation(
      'validate-approval-eligibility',
      'email-change',
      async () => {
        // Check if request is in correct status for approval
        if (emailChangeRequest.status !== 'pending_approval') {
          return { canApprove: false, reason: 'not_pending_approval', currentStatus: emailChangeRequest.status };
        }

        // Check if both emails are verified
        if (!emailChangeRequest.currentEmailVerified || !emailChangeRequest.newEmailVerified) {
          return { canApprove: false, reason: 'emails_not_verified', currentVerified: emailChangeRequest.currentEmailVerified, newVerified: emailChangeRequest.newEmailVerified };
        }

        // Business Logic: Only prevent non-admins from approving requests
        // Admins can approve their own requests, but managers/employees cannot approve any requests
        if (emailChangeRequest.userId === currentUserId && userRole !== 'admin') {
          return { canApprove: false, reason: 'cannot_approve_own_request' };
        }

        return { canApprove: true };
      }
    );

    if (!eligibilityValidation.canApprove) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/{id}/approve', 'POST', 400, responseTime);
      
      if (eligibilityValidation.reason === 'not_pending_approval') {
        businessLogger.logBusinessOperation('approve', 'email-change', currentUserId, false, { 
          emailChangeRequestId,
          currentStatus: emailChangeRequest.status,
          reason: 'request_not_pending_approval'
        });
        return createErrorResponse(400, EmailChangeErrorCodes.REQUEST_NOT_PENDING_APPROVAL, `Cannot approve request with status: ${emailChangeRequest.status}`);
      } else if (eligibilityValidation.reason === 'emails_not_verified') {
        businessLogger.logBusinessOperation('approve', 'email-change', currentUserId, false, { 
          emailChangeRequestId,
          currentEmailVerified: emailChangeRequest.currentEmailVerified,
          newEmailVerified: emailChangeRequest.newEmailVerified,
          reason: 'emails_not_verified'
        });
        return createErrorResponse(400, EmailChangeErrorCodes.INVALID_REQUEST_DATA, 'Both email addresses must be verified before approval');
      } else {
        businessLogger.logBusinessOperation('approve', 'email-change', currentUserId, false, { 
          emailChangeRequestId,
          targetUserId: emailChangeRequest.userId,
          reason: 'cannot_approve_own_request'
        });
        return createErrorResponse(400, EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST, 'Only administrators can approve email change requests');
      }
    }

    // Extract IP address and user agent for audit trail
    const ipAddress = event.requestContext.identity?.sourceIp;
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];

    // Approve the request with tracing
    const approvedRequest = await businessTracer.traceDatabaseOperation(
      'approve-email-change-request',
      'email-change',
      async () => {
        return await emailChangeRepo.approveEmailChangeRequest(
          emailChangeRequestId,
          currentUserId,
          approveRequest.approvalNotes,
          ipAddress,
          userAgent
        );
      }
    );

    // Get user information for notifications with tracing
    const [requestUser, approverUser] = await businessTracer.traceDatabaseOperation(
      'get-users-for-notification',
      'users',
      async () => {
        return await Promise.all([
          userRepo.getUserById(emailChangeRequest.userId),
          userRepo.getUserById(currentUserId)
        ]);
      }
    );

    // Send approval notification to the user with tracing
    const notificationResult = await businessTracer.traceBusinessOperation(
      'send-approval-notification',
      'email-change',
      async () => {
        if (requestUser) {
          try {
            await emailService.sendApprovalNotification(approvedRequest, requestUser.name);
            return { success: true };
          } catch (emailError) {
            logger.error('Failed to send approval notification', {
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

    // Calculate estimated completion time (usually 24-48 hours for email change processing)
    const estimatedCompletionTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const responseData = {
      requestId: approvedRequest.id,
      status: 'approved',
      approvedAt: approvedRequest.approvedAt!,
      approvedBy: {
        id: currentUserId,
        name: approverUser?.name || 'Unknown Admin'
      },
      estimatedCompletionTime
    };

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/email-change/{id}/approve', 'POST', 200, responseTime);
    businessLogger.logBusinessOperation('approve', 'email-change', currentUserId, true, { 
      emailChangeRequestId,
      targetUserId: emailChangeRequest.userId,
      currentEmail: emailChangeRequest.currentEmail,
      newEmail: emailChangeRequest.newEmail,
      hasApprovalNotes: !!approveRequest.approvalNotes,
      notificationSent: notificationResult.success,
      userRole
    });

    logger.info('Email change request approved successfully', { 
      currentUserId,
      emailChangeRequestId,
      targetUserId: emailChangeRequest.userId,
      currentEmail: emailChangeRequest.currentEmail,
      newEmail: emailChangeRequest.newEmail,
      approverName: approverUser?.name,
      responseTime 
    });

    return createSuccessResponse(responseData, 200, 'Email change request approved successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/email-change/{id}/approve', 'POST', 500, responseTime);
    businessLogger.logError(error as Error, 'approve-email-change', getCurrentUserId(event) || 'unknown');

    logger.error('Error approving email change request', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      emailChangeRequestId: event.pathParameters?.id,
      responseTime
    });

    // Handle specific JSON parsing error
    if (error instanceof Error && error.message === 'Invalid JSON in request body') {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Handle specific errors
    if ((error as Error).message === EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND) {
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    if ((error as Error).message === EmailChangeErrorCodes.REQUEST_NOT_PENDING_APPROVAL) {
      return createErrorResponse(400, EmailChangeErrorCodes.REQUEST_NOT_PENDING_APPROVAL, 'Request is not pending approval');
    }

    if ((error as Error).message === EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST) {
      return createErrorResponse(400, EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST, 'You cannot approve your own email change request');
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 