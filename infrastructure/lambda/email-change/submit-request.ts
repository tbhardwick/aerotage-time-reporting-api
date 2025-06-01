import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { EmailChangeService } from '../shared/email-change-service';
import { EmailChangeValidation } from '../shared/email-change-validation';
import { UserRepository } from '../shared/user-repository';
import { 
  CreateEmailChangeRequest, 
  EmailChangeErrorCodes
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

    logger.info('Submit email change request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/submit-request', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'submit-email-change', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Get user ID from path parameters (for admin operations) or use current user
    const targetUserId = event.pathParameters?.id || currentUserId;

    // Check permissions - users can only change their own email, admins can change any with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-email-change-permissions',
      'email-change',
      async () => {
        if (targetUserId !== currentUserId && userRole !== 'admin') {
          return { canAccess: false, reason: 'not_own_email_or_admin' };
        }
        return { canAccess: true };
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/submit-request', 'POST', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'submit-email-change', false, { 
        targetUserId,
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'You can only change your own email address');
    }

    // Parse and validate request body
    if (!event.body) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/submit-request', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Request body is required'), 'submit-email-change-validation', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let createRequest: CreateEmailChangeRequest;
    try {
      createRequest = JSON.parse(event.body);
      logger.info('Email change request parsed', { 
        currentUserId,
        targetUserId,
        newEmail: createRequest.newEmail,
        reason: createRequest.reason,
        isSelfRequest: targetUserId === currentUserId
      });
    } catch {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/submit-request', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Invalid JSON in request body'), 'submit-email-change-parse', currentUserId);
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }
    
    // Validate request data with tracing
    const validation = await businessTracer.traceBusinessOperation(
      'validate-request-data',
      'email-change',
      async () => {
        return EmailChangeValidation.validateCreateEmailChangeRequest(createRequest as unknown as Record<string, unknown>);
      }
    );

    if (!validation.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/submit-request', 'POST', 400, responseTime);
      businessLogger.logError(new Error(`Invalid request data: ${validation.errors.join(', ')}`), 'submit-email-change-validation', currentUserId);
      return createErrorResponse(400, EmailChangeErrorCodes.INVALID_REQUEST_DATA, validation.errors.join(', '));
    }

    // Get current user information with tracing
    const currentUser = await businessTracer.traceDatabaseOperation(
      'get-target-user',
      'users',
      async () => {
        return await userRepo.getUserById(targetUserId);
      }
    );

    if (!currentUser) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/submit-request', 'POST', 404, responseTime);
      businessLogger.logBusinessOperation('submit', 'email-change', currentUserId, false, { 
        targetUserId,
        reason: 'user_not_found' 
      });
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Check if new email already exists with tracing
    const existingUser = await businessTracer.traceDatabaseOperation(
      'check-email-exists',
      'users',
      async () => {
        return await userRepo.getUserByEmail(createRequest.newEmail);
      }
    );

    if (existingUser) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/submit-request', 'POST', 409, responseTime);
      businessLogger.logBusinessOperation('submit', 'email-change', currentUserId, false, { 
        targetUserId,
        newEmail: createRequest.newEmail,
        reason: 'email_already_exists' 
      });
      return createErrorResponse(409, EmailChangeErrorCodes.EMAIL_ALREADY_EXISTS, 'Email address is already in use');
    }

    // Check for active email change requests with tracing
    const hasActiveRequest = await businessTracer.traceDatabaseOperation(
      'check-active-requests',
      'email-change',
      async () => {
        return await emailChangeRepo.hasActiveEmailChangeRequest(targetUserId);
      }
    );

    // Validate business rules with tracing
    const businessValidation = await businessTracer.traceBusinessOperation(
      'validate-business-rules',
      'email-change',
      async () => {
        return EmailChangeValidation.validateBusinessRules(
          currentUser.email,
          createRequest.newEmail,
          createRequest.reason,
          hasActiveRequest
        );
      }
    );

    if (!businessValidation.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/email-change/submit-request', 'POST', 409, responseTime);
      const errorCode = businessValidation.errors[0] as EmailChangeErrorCodes;
      businessLogger.logBusinessOperation('submit', 'email-change', currentUserId, false, { 
        targetUserId,
        currentEmail: currentUser.email,
        newEmail: createRequest.newEmail,
        reason: 'business_rule_violation',
        errors: businessValidation.errors
      });
      return createErrorResponse(409, errorCode, businessValidation.errors.join(', '));
    }

    // Extract IP address and user agent for audit trail
    const ipAddress = event.requestContext.identity?.sourceIp;
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];

    // Create email change request with tracing
    const emailChangeRequest = await businessTracer.traceDatabaseOperation(
      'create-email-change-request',
      'email-change',
      async () => {
        return await emailChangeRepo.createEmailChangeRequest(
          targetUserId,
          currentUser.email,
          createRequest.newEmail,
          createRequest.reason,
          createRequest.customReason,
          ipAddress,
          userAgent
        );
      }
    );

    // Send verification emails with tracing
    const emailSendResults = await businessTracer.traceBusinessOperation(
      'send-verification-emails',
      'email-change',
      async () => {
        try {
          // Send verification email to current email
          await emailService.sendVerificationEmail(emailChangeRequest, 'current', currentUser.name);
          
          // Send verification email to new email
          await emailService.sendVerificationEmail(emailChangeRequest, 'new', currentUser.name);
          
          return { success: true };
        } catch (emailError) {
          logger.error('Failed to send verification emails', {
            error: emailError instanceof Error ? emailError.message : 'Unknown error',
            emailChangeRequestId: emailChangeRequest.id,
            currentEmail: currentUser.email,
            newEmail: createRequest.newEmail
          });
          // Don't fail the request if email sending fails, but log it
          // The user can resend verification emails later
          return { success: false, error: emailError };
        }
      }
    );

    // Determine next steps and estimated completion time with tracing
    const approvalAnalysis = await businessTracer.traceBusinessOperation(
      'analyze-approval-requirements',
      'email-change',
      async () => {
        const autoApprovalReasons = ['personal_preference', 'name_change'];
        const isDomainChange = currentUser.email.split('@')[1] !== createRequest.newEmail.split('@')[1];
        const requiresApproval = !autoApprovalReasons.includes(createRequest.reason) || isDomainChange;

        const nextSteps = [
          `Check your current email (${currentUser.email}) for verification link`,
          `Check your new email (${createRequest.newEmail}) for verification link`
        ];

        if (requiresApproval) {
          nextSteps.push('Admin approval will be required after verification');
        }

        // Calculate estimated completion time (24-48 hours depending on approval requirement)
        const estimatedHours = requiresApproval ? 48 : 24;
        const estimatedCompletionTime = new Date(Date.now() + estimatedHours * 60 * 60 * 1000).toISOString();

        return {
          requiresApproval,
          isDomainChange,
          nextSteps,
          estimatedCompletionTime
        };
      }
    );

    const responseData = {
      requestId: emailChangeRequest.id,
      status: emailChangeRequest.status,
      currentEmail: emailChangeRequest.currentEmail,
      newEmail: emailChangeRequest.newEmail,
      reason: emailChangeRequest.reason,
      customReason: emailChangeRequest.customReason,
      requestedAt: emailChangeRequest.requestedAt,
      estimatedCompletionTime: approvalAnalysis.estimatedCompletionTime,
      verificationRequired: {
        currentEmail: true,
        newEmail: true
      },
      nextSteps: approvalAnalysis.nextSteps
    };

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/email-change/submit-request', 'POST', 201, responseTime);
    businessLogger.logBusinessOperation('submit', 'email-change', currentUserId, true, { 
      emailChangeRequestId: emailChangeRequest.id,
      targetUserId,
      currentEmail: currentUser.email,
      newEmail: createRequest.newEmail,
      reason: createRequest.reason,
      requiresApproval: approvalAnalysis.requiresApproval,
      isDomainChange: approvalAnalysis.isDomainChange,
      emailsSent: emailSendResults.success,
      isSelfRequest: targetUserId === currentUserId
    });

    logger.info('Email change request submitted successfully', { 
      currentUserId,
      emailChangeRequestId: emailChangeRequest.id,
      targetUserId,
      currentEmail: currentUser.email,
      newEmail: createRequest.newEmail,
      reason: createRequest.reason,
      requiresApproval: approvalAnalysis.requiresApproval,
      responseTime 
    });

    return createSuccessResponse(responseData, 201, 'Email change request submitted successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/email-change/submit-request', 'POST', 500, responseTime);
    businessLogger.logError(error as Error, 'submit-email-change', getCurrentUserId(event) || 'unknown');

    logger.error('Error submitting email change request', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      targetUserId: event.pathParameters?.id,
      responseTime
    });

    // Handle specific errors
    if ((error as Error).message === EmailChangeErrorCodes.EMAIL_ALREADY_EXISTS) {
      return createErrorResponse(409, EmailChangeErrorCodes.EMAIL_ALREADY_EXISTS, 'Email address is already in use');
    }

    if ((error as Error).message === EmailChangeErrorCodes.ACTIVE_REQUEST_EXISTS) {
      return createErrorResponse(409, EmailChangeErrorCodes.ACTIVE_REQUEST_EXISTS, 'You already have an active email change request');
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 