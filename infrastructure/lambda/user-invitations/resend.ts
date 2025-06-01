import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { 
  ResendOptions, 
  InvitationErrorCodes,
  UserInvitation
} from '../shared/types';
import { InvitationRepository } from '../shared/invitation-repository';
import { EmailService, EmailTemplateData } from '../shared/email-service';
import { TokenService } from '../shared/token-service';

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

    logger.info('Resend invitation request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/{id}/resend', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'resend-invitation', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Role-based access control with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-resend-permissions',
      'invitation',
      async () => {
        if (userRole === 'employee') {
          return { canAccess: false, reason: 'employee_role_restriction' };
        }
        // Managers and admins can resend invitations
        return { canAccess: true };
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/{id}/resend', 'POST', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'resend-invitation', false, { 
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to resend invitations');
    }

    // Get invitation ID from path parameters
    const invitationId = event.pathParameters?.id;
    if (!invitationId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/{id}/resend', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Invitation ID is required'), 'resend-invitation-validation', currentUserId);
      return createErrorResponse(400, InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation ID is required');
    }

    // Parse request body (optional) with tracing
    let resendOptions: ResendOptions = await businessTracer.traceBusinessOperation(
      'parse-resend-options',
      'invitation',
      async () => {
        const defaultOptions: ResendOptions = {
          extendExpiration: true, // Default value
        };

        if (event.body) {
          try {
            return { ...defaultOptions, ...JSON.parse(event.body) };
          } catch {
            throw new Error('Invalid JSON in request body');
          }
        }
        return defaultOptions;
      }
    );

    logger.info('Resend invitation request parsed', { 
      currentUserId,
      invitationId,
      userRole,
      extendExpiration: resendOptions.extendExpiration,
      hasPersonalMessage: !!resendOptions.personalMessage
    });

    const repository = new InvitationRepository();
    const emailService = new EmailService();

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
      businessMetrics.trackApiPerformance('/user-invitations/{id}/resend', 'POST', 404, responseTime);
      businessLogger.logBusinessOperation('resend', 'invitation', currentUserId, false, { 
        invitationId,
        reason: 'invitation_not_found' 
      });
      return createErrorResponse(404, InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation not found');
    }

    // Validate invitation status and resend limits with tracing
    const validationResult = await businessTracer.traceBusinessOperation(
      'validate-resend-eligibility',
      'invitation',
      async () => {
        // Check if invitation is still pending
        if (invitation.status !== 'pending') {
          return { canResend: false, reason: 'not_pending', currentStatus: invitation.status };
        }

        // Check resend limit (max 3 resends per invitation)
        if (invitation.resentCount >= 3) {
          return { canResend: false, reason: 'rate_limit_exceeded', resentCount: invitation.resentCount };
        }

        return { canResend: true };
      }
    );

    if (!validationResult.canResend) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/{id}/resend', 'POST', 400, responseTime);
      
      if (validationResult.reason === 'not_pending') {
        businessLogger.logBusinessOperation('resend', 'invitation', currentUserId, false, { 
          invitationId,
          email: invitation.email,
          currentStatus: invitation.status,
          reason: 'invitation_not_pending'
        });
        return createErrorResponse(400, InvitationErrorCodes.INVITATION_ALREADY_ACCEPTED, 'Invitation is no longer pending');
      } else {
        businessLogger.logBusinessOperation('resend', 'invitation', currentUserId, false, { 
          invitationId,
          email: invitation.email,
          resentCount: invitation.resentCount,
          reason: 'rate_limit_exceeded'
        });
        return createErrorResponse(400, InvitationErrorCodes.RATE_LIMIT_EXCEEDED, 'Maximum resend limit reached');
      }
    }

    // Update invitation with resend information with tracing
    const updatedInvitation = await businessTracer.traceDatabaseOperation(
      'resend-invitation',
      'invitations',
      async () => {
        return await repository.resendInvitation(
          invitationId,
          resendOptions.extendExpiration,
          resendOptions.personalMessage
        );
      }
    );

    // Prepare email template data with tracing
    const emailData = await businessTracer.traceBusinessOperation(
      'prepare-email-data',
      'invitation',
      async () => {
        const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
        const invitationUrl = `${frontendBaseUrl}/accept-invitation?token=${updatedInvitation.invitationToken}`;
        
        return {
          inviterName: user?.email?.split('@')[0] || 'Admin',
          inviterEmail: user?.email || 'admin@aerotage.com',
          role: updatedInvitation.role,
          department: updatedInvitation.department,
          jobTitle: updatedInvitation.jobTitle,
          invitationUrl,
          expirationDate: TokenService.formatExpirationDate(updatedInvitation.expiresAt),
          personalMessage: updatedInvitation.personalMessage,
        } as EmailTemplateData;
      }
    );

    // Send reminder email with tracing
    const emailResult = await businessTracer.traceBusinessOperation(
      'send-reminder-email',
      'invitation',
      async () => {
        try {
          await emailService.sendReminderEmail(updatedInvitation.email, emailData);
          return { success: true };
        } catch (emailError) {
          logger.error('Failed to send reminder email', {
            error: emailError instanceof Error ? emailError.message : 'Unknown error',
            invitationId,
            email: updatedInvitation.email
          });
          return { success: false, error: emailError };
        }
      }
    );

    if (!emailResult.success) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/{id}/resend', 'POST', 500, responseTime);
      businessLogger.logBusinessOperation('resend', 'invitation', currentUserId, false, { 
        invitationId,
        email: updatedInvitation.email,
        reason: 'email_send_failed'
      });
      return createErrorResponse(500, InvitationErrorCodes.EMAIL_SEND_FAILED, 'Failed to send reminder email');
    }

    // Prepare response data (exclude sensitive token) with tracing
    const responseData = await businessTracer.traceBusinessOperation(
      'prepare-response-data',
      'invitation',
      async () => {
        return {
          id: updatedInvitation.id,
          expiresAt: updatedInvitation.expiresAt,
          resentAt: updatedInvitation.lastResentAt!,
        };
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/user-invitations/{id}/resend', 'POST', 200, responseTime);
    businessLogger.logBusinessOperation('resend', 'invitation', currentUserId, true, { 
      invitationId,
      email: updatedInvitation.email,
      role: updatedInvitation.role,
      resentCount: updatedInvitation.resentCount,
      extendedExpiration: resendOptions.extendExpiration,
      hasPersonalMessage: !!resendOptions.personalMessage,
      userRole
    });

    logger.info('Invitation resent successfully', { 
      currentUserId,
      invitationId,
      email: updatedInvitation.email,
      role: updatedInvitation.role,
      resentCount: updatedInvitation.resentCount,
      responseTime 
    });

    return createSuccessResponse(responseData, 200, 'Invitation resent successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/user-invitations/{id}/resend', 'POST', 500, responseTime);
    businessLogger.logError(error as Error, 'resend-invitation', getCurrentUserId(event) || 'unknown');

    logger.error('Error resending user invitation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      invitationId: event.pathParameters?.id,
      responseTime
    });

    // Handle specific JSON parsing error
    if (error instanceof Error && error.message === 'Invalid JSON in request body') {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 