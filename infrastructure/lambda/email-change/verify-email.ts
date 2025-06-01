import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { EmailChangeService } from '../shared/email-change-service';
import { EmailChangeValidation } from '../shared/email-change-validation';
import { UserRepository } from '../shared/user-repository';
import { 
  EmailVerificationRequest,
  EmailChangeErrorCodes
} from '../shared/types';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';

// ✅ NEW: Import PowerTools utilities with correct v2.x pattern
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// ✅ NEW: Import Middy middleware for PowerTools v2.x
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const emailChangeRepo = new EmailChangeRepository();
const emailService = new EmailChangeService();
const userRepo = new UserRepository();

// ✅ FIXED: Use correct PowerTools v2.x middleware pattern
const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // ✅ NEW: Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);
    
    logger.info('Email verification request started', {
      requestId,
      httpMethod: event.httpMethod,
      path: event.path,
      hasBody: !!event.body,
    });

    // ✅ NEW: Track API request metrics
    businessMetrics.trackApiPerformance(
      '/email-change/verify',
      'POST',
      0, // Will be updated later
      0  // Will be updated later
    );

    // ✅ NEW: Trace request parsing
    const verificationRequest = await businessTracer.traceBusinessOperation(
      'parse-request-body',
      'email-verification',
      async () => {
        // Parse and validate request body
        if (!event.body) {
          throw new Error('Request body is required');
        }

        let parsedRequest: EmailVerificationRequest;
        try {
          parsedRequest = JSON.parse(event.body);
        } catch {
          throw new Error('Invalid JSON in request body');
        }

        logger.info('Request body parsed successfully', { 
          emailType: parsedRequest.emailType,
          hasToken: !!parsedRequest.token 
        });

        return parsedRequest;
      }
    );

    // ✅ NEW: Trace validation logic
    const validation = await businessTracer.traceBusinessOperation(
      'validate-verification-request',
      'email-verification',
      async () => {
        logger.info('Validating email verification request');
        
        // Validate request data
        const requestValidation = EmailChangeValidation.validateEmailVerificationRequest(verificationRequest as unknown as Record<string, unknown>);
        if (!requestValidation.isValid) {
          logger.warn('Request validation failed', { errors: requestValidation.errors });
          throw new Error(`Validation failed: ${requestValidation.errors.join(', ')}`);
        }

        // Validate token format
        if (!EmailChangeValidation.isValidToken(verificationRequest.token)) {
          logger.warn('Invalid token format');
          throw new Error('Invalid verification token format');
        }

        logger.info('Validation passed successfully');
        return { isValid: true };
      }
    );

    // ✅ NEW: Trace database lookup
    const emailChangeRequest = await businessTracer.traceDatabaseOperation(
      'get',
      'email-change-request',
      async () => {
        logger.info('Finding email change request by token');
        
        const request = await emailChangeRepo.getEmailChangeRequestByToken(
          verificationRequest.token, 
          verificationRequest.emailType
        );

        if (!request) {
          logger.warn('Email change request not found for token');
          throw new Error('Invalid or expired verification token');
        }

        logger.info('Email change request found', { 
          requestId: request.id,
          userId: request.userId,
          status: request.status 
        });

        return request;
      }
    );

    // ✅ NEW: Trace business validation
    const businessValidation = await businessTracer.traceBusinessOperation(
      'validate-business-rules',
      'email-verification',
      async () => {
        // Check if token is expired
        if (emailChangeRequest.verificationTokensExpiresAt && 
            EmailChangeValidation.isTokenExpired(emailChangeRequest.verificationTokensExpiresAt)) {
          logger.warn('Verification token expired');
          throw new Error('Verification token has expired');
        }

        // Check if email is already verified
        const isAlreadyVerified = verificationRequest.emailType === 'current' 
          ? emailChangeRequest.currentEmailVerified 
          : emailChangeRequest.newEmailVerified;

        if (isAlreadyVerified) {
          logger.warn('Email already verified');
          throw new Error('This email address has already been verified');
        }

        // Check if request is in correct status
        if (emailChangeRequest.status !== 'pending_verification') {
          logger.warn('Request not in pending verification status', { status: emailChangeRequest.status });
          throw new Error('Email change request is not in pending verification status');
        }

        logger.info('Business validation passed');
        return { isValid: true };
      }
    );

    // ✅ NEW: Add user context to tracer
    businessTracer.addUserContext(emailChangeRequest.userId, 'unknown', 'unknown');

    // Extract IP address and user agent for audit trail
    const ipAddress = event.requestContext.identity?.sourceIp;
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];

    // ✅ NEW: Trace verification update
    const updatedRequest = await businessTracer.traceDatabaseOperation(
      'update',
      'email-verification-status',
      async () => {
        logger.info('Updating email verification status');
        
        const updated = await emailChangeRepo.updateEmailVerificationStatus(
          emailChangeRequest.id,
          verificationRequest.emailType,
          undefined, // No specific user performing this action
          ipAddress,
          userAgent
        );

        logger.info('Email verification status updated successfully', {
          requestId: updated.id,
          currentEmailVerified: updated.currentEmailVerified,
          newEmailVerified: updated.newEmailVerified,
          status: updated.status
        });

        return updated;
      }
    );

    // ✅ NEW: Trace user lookup
    const user = await businessTracer.traceDatabaseOperation(
      'get',
      'user',
      async () => {
        const userData = await userRepo.getUserById(updatedRequest.userId);
        if (!userData) {
          logger.error('User not found for email change request', { userId: updatedRequest.userId });
        } else {
          logger.info('User information retrieved', { userId: userData.id, name: userData.name });
        }
        return userData;
      }
    );

    // ✅ NEW: Trace notification logic
    const notificationResult = await businessTracer.traceBusinessOperation(
      'send-notifications',
      'email-verification',
      async () => {
        // Determine next step based on verification status
        let nextStep: 'verify_other_email' | 'pending_approval' | 'auto_approved' | 'processing';
        let message: string;

        if (updatedRequest.currentEmailVerified && updatedRequest.newEmailVerified) {
          // Both emails verified
          if (updatedRequest.status === 'pending_approval') {
            nextStep = 'pending_approval';
            message = 'Both email addresses verified successfully. Your request is now pending admin approval.';
            
            // Send admin notification if user exists
            if (user) {
              try {
                // Get admin emails (this would typically come from a configuration or admin user query)
                const adminEmails = ['admin@aerotage.com']; // TODO: Get from configuration
                await emailService.sendAdminApprovalNotification(updatedRequest, user.name, adminEmails);
                logger.info('Admin notification sent successfully');
              } catch (emailError) {
                logger.error('Failed to send admin notification', { error: emailError });
              }
            }
          } else if (updatedRequest.status === 'approved') {
            nextStep = 'auto_approved';
            message = 'Both email addresses verified successfully. Your request has been auto-approved and will be processed shortly.';
            
            // Send approval notification if user exists
            if (user) {
              try {
                await emailService.sendApprovalNotification(updatedRequest, user.name);
                logger.info('Approval notification sent successfully');
              } catch (emailError) {
                logger.error('Failed to send approval notification', { error: emailError });
              }
            }
          } else {
            nextStep = 'processing';
            message = 'Both email addresses verified successfully. Your request is being processed.';
          }
        } else {
          // Only one email verified
          const otherEmailType = verificationRequest.emailType === 'current' ? 'new' : 'current';
          const otherEmailAddress = verificationRequest.emailType === 'current' 
            ? updatedRequest.newEmail 
            : updatedRequest.currentEmail;
          
          nextStep = 'verify_other_email';
          message = `${verificationRequest.emailType === 'current' ? 'Current' : 'New'} email verified successfully. Please verify your ${otherEmailType} email address (${otherEmailAddress}).`;
        }

        logger.info('Notification logic completed', { nextStep, message });
        return { nextStep, message };
      }
    );

    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Track successful metrics
    businessMetrics.trackApiPerformance('/email-change/verify', 'POST', 200, responseTime);
    businessMetrics.trackBusinessKPI('EmailVerificationSuccess', 1, MetricUnit.Count);
    businessLogger.logBusinessOperation('verify', 'email-change', updatedRequest.userId, true, { 
      emailType: verificationRequest.emailType,
      nextStep: notificationResult.nextStep,
      bothEmailsVerified: updatedRequest.currentEmailVerified && updatedRequest.newEmailVerified
    });

    logger.info('Email verification completed successfully', { 
      requestId: updatedRequest.id,
      emailType: verificationRequest.emailType,
      nextStep: notificationResult.nextStep,
      responseTime 
    });

    const responseData = {
      requestId: updatedRequest.id,
      emailType: verificationRequest.emailType,
      verified: true,
      verificationStatus: {
        currentEmailVerified: updatedRequest.currentEmailVerified,
        newEmailVerified: updatedRequest.newEmailVerified
      },
      nextStep: notificationResult.nextStep,
      message: notificationResult.message
    };

    return createSuccessResponse(responseData);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Enhanced error handling with PowerTools
    logger.error('Email verification failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime 
    });

    // ✅ NEW: Track error metrics
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let errorMessage = 'An internal server error occurred';

    if (error instanceof Error) {
      if (error.message === 'Request body is required') {
        statusCode = 400;
        errorCode = 'INVALID_REQUEST';
        errorMessage = 'Request body is required';
      } else if (error.message === 'Invalid JSON in request body') {
        statusCode = 400;
        errorCode = 'INVALID_JSON';
        errorMessage = 'Invalid JSON in request body';
      } else if (error.message.startsWith('Validation failed:')) {
        statusCode = 400;
        errorCode = EmailChangeErrorCodes.INVALID_REQUEST_DATA;
        errorMessage = error.message.replace('Validation failed: ', '');
      } else if (error.message === 'Invalid verification token format') {
        statusCode = 400;
        errorCode = EmailChangeErrorCodes.INVALID_VERIFICATION_TOKEN;
        errorMessage = 'Invalid verification token format';
      } else if (error.message === 'Invalid or expired verification token') {
        statusCode = 404;
        errorCode = EmailChangeErrorCodes.INVALID_VERIFICATION_TOKEN;
        errorMessage = 'Invalid or expired verification token';
      } else if (error.message === 'Verification token has expired') {
        statusCode = 410;
        errorCode = EmailChangeErrorCodes.VERIFICATION_TOKEN_EXPIRED;
        errorMessage = 'Verification token has expired';
      } else if (error.message === 'This email address has already been verified') {
        statusCode = 410;
        errorCode = EmailChangeErrorCodes.EMAIL_ALREADY_VERIFIED;
        errorMessage = 'This email address has already been verified';
      } else if (error.message === 'Email change request is not in pending verification status') {
        statusCode = 400;
        errorCode = EmailChangeErrorCodes.INVALID_REQUEST_DATA;
        errorMessage = 'Email change request is not in pending verification status';
      }
    }

    businessMetrics.trackApiPerformance('/email-change/verify', 'POST', statusCode, responseTime);
    businessMetrics.trackBusinessKPI('EmailVerificationError', 1, MetricUnit.Count);
    businessLogger.logBusinessOperation('verify', 'email-change', 'unknown', false, { 
      errorCode,
      errorMessage 
    });

    return createErrorResponse(statusCode, errorCode, errorMessage);
  }
};

// ✅ NEW: Export handler with PowerTools v2.x middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }))
  .use(logMetrics(metrics)); 