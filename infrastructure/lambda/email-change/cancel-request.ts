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

    logger.info('Cancel email change request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
      path: event.path,
      pathParameters: event.pathParameters
    });

    // Extract user information from authorization context
    const authContext = event.requestContext.authorizer;
    const currentUserId = getCurrentUserId(event);
    const userRole = authContext?.role || authContext?.claims?.['custom:role'];

    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/cancel/{id}', 'DELETE', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'cancel-email-change', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Get request ID from path parameters
    const emailChangeRequestId = event.pathParameters?.id;
    if (!emailChangeRequestId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/cancel/{id}', 'DELETE', 400, responseTime);
      businessLogger.logError(new Error('Request ID is required'), 'cancel-email-change-validation', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request ID is required');
    }

    logger.info('Cancel email change request parsed', { 
      currentUserId,
      userRole,
      emailChangeRequestId
    });

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
      businessMetrics.trackApiPerformance('/email-change/cancel/{id}', 'DELETE', 404, responseTime);
      businessLogger.logBusinessOperation('cancel', 'email-change', currentUserId, false, { 
        emailChangeRequestId,
        reason: 'request_not_found' 
      });
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    // Check permissions with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-cancel-permissions',
      'email-change',
      async () => {
        if (emailChangeRequest.userId !== currentUserId && userRole !== 'admin') {
          return { canCancel: false, reason: 'not_own_request_or_admin' };
        }
        return { canCancel: true };
      }
    );

    if (!accessControl.canCancel) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/cancel/{id}', 'DELETE', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'cancel-email-change', false, { 
        emailChangeRequestId,
        requestUserId: emailChangeRequest.userId,
        reason: 'insufficient_permissions',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'You can only cancel your own email change requests');
    }

    // Check if request can be cancelled with tracing
    const cancellationCheck = await businessTracer.traceBusinessOperation(
      'validate-cancellation-eligibility',
      'email-change',
      async () => {
        const cancellableStatuses = ['pending_verification', 'pending_approval'];
        if (!cancellableStatuses.includes(emailChangeRequest.status)) {
          if (emailChangeRequest.status === 'completed') {
            return { canCancel: false, reason: 'already_completed' };
          }
          return { canCancel: false, reason: 'invalid_status', currentStatus: emailChangeRequest.status };
        }
        return { canCancel: true };
      }
    );

    if (!cancellationCheck.canCancel) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/cancel/{id}', 'DELETE', 400, responseTime);
      
      let errorCode = EmailChangeErrorCodes.CANNOT_CANCEL_REQUEST;
      let errorMessage = `Cannot cancel request with status: ${emailChangeRequest.status}`;
      
      if (cancellationCheck.reason === 'already_completed') {
        errorCode = EmailChangeErrorCodes.REQUEST_ALREADY_COMPLETED;
        errorMessage = 'Cannot cancel a completed email change request';
      }

      businessLogger.logBusinessOperation('cancel', 'email-change', currentUserId, false, { 
        emailChangeRequestId,
        currentStatus: emailChangeRequest.status,
        reason: cancellationCheck.reason
      });
      
      return createErrorResponse(400, errorCode, errorMessage);
    }

    // Extract IP address and user agent for audit trail with tracing
    const auditData = await businessTracer.traceBusinessOperation(
      'extract-audit-data',
      'email-change',
      async () => {
        const ipAddress = event.requestContext.identity?.sourceIp;
        const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];
        return { ipAddress, userAgent };
      }
    );

    // Cancel the request with tracing
    const cancelledRequest = await businessTracer.traceDatabaseOperation(
      'cancel-email-change-request',
      'email-change',
      async () => {
        return await emailChangeRepo.cancelEmailChangeRequest(
          emailChangeRequestId,
          currentUserId,
          auditData.ipAddress,
          auditData.userAgent
        );
      }
    );

    // Get user information for response with tracing
    const user = await businessTracer.traceDatabaseOperation(
      'get-user-info',
      'users',
      async () => {
        return await userRepo.getUserById(currentUserId);
      }
    );

    const userName = user?.name || 'Unknown User';

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/email-change/cancel/{id}', 'DELETE', 200, responseTime);
    businessLogger.logBusinessOperation('cancel', 'email-change', currentUserId, true, { 
      emailChangeRequestId,
      requestUserId: emailChangeRequest.userId,
      previousStatus: emailChangeRequest.status,
      cancelledAt: cancelledRequest.cancelledAt,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      isSelfCancel: emailChangeRequest.userId === currentUserId
    });

    logger.info('Email change request cancelled successfully', { 
      currentUserId,
      emailChangeRequestId,
      requestUserId: emailChangeRequest.userId,
      previousStatus: emailChangeRequest.status,
      cancelledAt: cancelledRequest.cancelledAt,
      responseTime 
    });

    const responseData = {
      requestId: cancelledRequest.id,
      status: 'cancelled',
      cancelledAt: cancelledRequest.cancelledAt!,
      cancelledBy: currentUserId,
      cancelledByName: userName
    };

    return createSuccessResponse(responseData, 200, 'Email change request cancelled successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/email-change/cancel/{id}', 'DELETE', 500, responseTime);
    businessLogger.logError(error as Error, 'cancel-email-change', getCurrentUserId(event) || 'unknown');

    logger.error('Error cancelling email change request', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      emailChangeRequestId: event.pathParameters?.id,
      responseTime
    });

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND) {
        return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
      }
      if (error.message === EmailChangeErrorCodes.CANNOT_CANCEL_REQUEST) {
        return createErrorResponse(400, EmailChangeErrorCodes.CANNOT_CANCEL_REQUEST, 'Cannot cancel this email change request');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred while cancelling the email change request');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 