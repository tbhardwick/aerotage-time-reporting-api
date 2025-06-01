import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { EmailChangeService } from '../shared/email-change-service';
import { EmailChangeValidation } from '../shared/email-change-validation';
import { UserRepository } from '../shared/user-repository';
import { 
  ResendVerificationRequest,
  EmailChangeErrorCodes
} from '../shared/types';
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
const emailService = new EmailChangeService();
const userRepo = new UserRepository();

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Resend email verification request started', {
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
      businessMetrics.trackApiPerformance('/email-change/resend/{id}', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'resend-email-verification', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Get request ID from path parameters
    const emailChangeRequestId = event.pathParameters?.id;
    if (!emailChangeRequestId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/resend/{id}', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Request ID is required'), 'resend-email-verification-validation', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request ID is required');
    }

    // Parse and validate request body with tracing
    const resendRequest = await businessTracer.traceBusinessOperation(
      'parse-resend-verification-request',
      'email-change',
      async () => {
        if (!event.body) {
          throw new Error('Request body is required');
        }

        let request: ResendVerificationRequest;
        try {
          request = JSON.parse(event.body);
        } catch {
          throw new Error('Invalid JSON in request body');
        }

        // Validate request data
        const validation = EmailChangeValidation.validateResendVerificationRequest(request as unknown as Record<string, unknown>);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        return request;
      }
    );

    logger.info('Resend verification request parsed and validated', { 
      currentUserId,
      userRole,
      emailChangeRequestId,
      emailType: resendRequest.emailType
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
      businessMetrics.trackApiPerformance('/email-change/resend/{id}', 'POST', 404, responseTime);
      businessLogger.logBusinessOperation('resend', 'email-verification', currentUserId, false, { 
        emailChangeRequestId,
        reason: 'request_not_found' 
      });
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    // Check permissions with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-resend-permissions',
      'email-change',
      async () => {
        if (emailChangeRequest.userId !== currentUserId && userRole !== 'admin') {
          return { canResend: false, reason: 'not_own_request_or_admin' };
        }
        return { canResend: true };
      }
    );

    if (!accessControl.canResend) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/resend/{id}', 'POST', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'resend-email-verification', false, { 
        emailChangeRequestId,
        requestUserId: emailChangeRequest.userId,
        reason: 'insufficient_permissions',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'You can only resend verification for your own email change requests');
    }

    // Validate request status and email verification state with tracing
    const statusValidation = await businessTracer.traceBusinessOperation(
      'validate-resend-eligibility',
      'email-change',
      async () => {
        if (emailChangeRequest.status !== 'pending_verification') {
          return { canResend: false, reason: 'invalid_status', currentStatus: emailChangeRequest.status };
        }

        const isAlreadyVerified = resendRequest.emailType === 'current' 
          ? emailChangeRequest.currentEmailVerified 
          : emailChangeRequest.newEmailVerified;

        if (isAlreadyVerified) {
          return { canResend: false, reason: 'already_verified' };
        }

        return { canResend: true };
      }
    );

    if (!statusValidation.canResend) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/resend/{id}', 'POST', 400, responseTime);
      
      let errorCode = EmailChangeErrorCodes.INVALID_REQUEST_DATA;
      let errorMessage = `Email change request is not in pending verification status`;
      
      if (statusValidation.reason === 'already_verified') {
        errorCode = EmailChangeErrorCodes.EMAIL_ALREADY_VERIFIED;
        errorMessage = 'This email address has already been verified';
      }

      businessLogger.logBusinessOperation('resend', 'email-verification', currentUserId, false, { 
        emailChangeRequestId,
        currentStatus: emailChangeRequest.status,
        emailType: resendRequest.emailType,
        reason: statusValidation.reason
      });
      
      return createErrorResponse(statusValidation.reason === 'already_verified' ? 410 : 400, errorCode, errorMessage);
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

    // Generate new verification token with tracing
    const tokenInfo = await businessTracer.traceDatabaseOperation(
      'regenerate-verification-token',
      'email-change',
      async () => {
        return await emailChangeRepo.regenerateVerificationTokens(
          emailChangeRequestId,
          resendRequest.emailType,
          currentUserId,
          auditData.ipAddress,
          auditData.userAgent
        );
      }
    );

    // Get user information for email with tracing
    const user = await businessTracer.traceDatabaseOperation(
      'get-user-info',
      'users',
      async () => {
        return await userRepo.getUserById(emailChangeRequest.userId);
      }
    );

    if (!user) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/resend/{id}', 'POST', 404, responseTime);
      businessLogger.logError(new Error('User not found for email change request'), 'resend-email-verification', currentUserId);
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Send verification email with tracing
    await businessTracer.traceBusinessOperation(
      'send-verification-email',
      'email-change',
      async () => {
        // Update the request object with new token for email sending
        const updatedRequest = {
          ...emailChangeRequest,
          [resendRequest.emailType === 'current' ? 'currentEmailVerificationToken' : 'newEmailVerificationToken']: tokenInfo.token,
          verificationTokensExpiresAt: tokenInfo.expiresAt
        };

        try {
          await emailService.sendVerificationEmail(updatedRequest, resendRequest.emailType, user.name);
        } catch (error) {
          throw new Error('Failed to send verification email');
        }
      }
    );

    const emailAddress = resendRequest.emailType === 'current' 
      ? emailChangeRequest.currentEmail 
      : emailChangeRequest.newEmail;

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/email-change/resend/{id}', 'POST', 200, responseTime);
    businessLogger.logBusinessOperation('resend', 'email-verification', currentUserId, true, { 
      emailChangeRequestId,
      requestUserId: emailChangeRequest.userId,
      emailType: resendRequest.emailType,
      emailAddress,
      tokenExpiresAt: tokenInfo.expiresAt,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      isSelfResend: emailChangeRequest.userId === currentUserId
    });

    logger.info('Verification email resent successfully', { 
      currentUserId,
      emailChangeRequestId,
      requestUserId: emailChangeRequest.userId,
      emailType: resendRequest.emailType,
      emailAddress,
      responseTime 
    });

    const responseData = {
      requestId: emailChangeRequest.id,
      emailType: resendRequest.emailType,
      emailAddress,
      resentAt: new Date().toISOString(),
      expiresAt: tokenInfo.expiresAt
    };

    return createSuccessResponse(responseData, 200, `Verification email resent to ${emailAddress}`);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/email-change/resend/{id}', 'POST', 500, responseTime);
    businessLogger.logError(error as Error, 'resend-email-verification', getCurrentUserId(event) || 'unknown');

    logger.error('Error resending email verification', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      emailChangeRequestId: event.pathParameters?.id,
      responseTime
    });

    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message.includes('Request body is required')) {
        return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
      }
      if (error.message.includes('Invalid JSON in request body')) {
        return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
      }
      if (error.message.includes('Validation failed:')) {
        return createErrorResponse(400, EmailChangeErrorCodes.INVALID_REQUEST_DATA, error.message.replace('Validation failed: ', ''));
      }
      if (error.message.includes('Failed to send verification email')) {
        return createErrorResponse(500, EmailChangeErrorCodes.EMAIL_SEND_FAILED, 'Failed to send verification email');
      }
      if (error.message === EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND) {
        return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
      }
      if (error.message === EmailChangeErrorCodes.EMAIL_ALREADY_VERIFIED) {
        return createErrorResponse(410, EmailChangeErrorCodes.EMAIL_ALREADY_VERIFIED, 'Email address has already been verified');
      }
      if (error.message === EmailChangeErrorCodes.VERIFICATION_RATE_LIMITED) {
        return createErrorResponse(429, EmailChangeErrorCodes.VERIFICATION_RATE_LIMITED, 'Too many verification emails sent. Please wait before requesting another.');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 