import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { InvitationRepository } from '../shared/invitation-repository';
import { InvitationErrorCodes } from '../shared/types';
import { 
  AcceptInvitationRequest
} from '../shared/types';
import { EmailService, EmailTemplateData } from '../shared/email-service';
import { TokenService } from '../shared/token-service';
import { UserRepository } from '../shared/user-repository';

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

// ✅ FIXED: Use correct PowerTools v2.x middleware pattern
const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // ✅ NEW: Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);
    
    logger.info('Accept invitation request started', {
      requestId,
      httpMethod: event.httpMethod,
      path: event.path,
      hasBody: !!event.body,
    });

    // ✅ NEW: Track API request metrics
    businessMetrics.trackApiPerformance(
      '/user-invitations/accept',
      'POST',
      0, // Will be updated later
      0  // Will be updated later
    );

    // ✅ NEW: Trace request parsing
    const requestBody = await businessTracer.traceBusinessOperation(
      'parse-request-body',
      'invitation-accept',
      async () => {
        // Parse request body
        if (!event.body) {
          logger.warn('Request body is required');
          throw new Error('Request body is required');
        }

        let parsedRequest: AcceptInvitationRequest;
        try {
          parsedRequest = JSON.parse(event.body);
        } catch {
          logger.warn('Invalid JSON in request body');
          throw new Error('Invalid JSON in request body');
        }

        logger.info('Request body parsed successfully', { 
          hasToken: !!parsedRequest.token,
          hasUserData: !!parsedRequest.userData,
          userName: parsedRequest.userData?.name 
        });

        return parsedRequest;
      }
    );

    // ✅ NEW: Trace validation logic
    const validation = await businessTracer.traceBusinessOperation(
      'validate-request',
      'invitation-accept',
      async () => {
        logger.info('Validating accept invitation request');
        
        // Basic validation
        if (!requestBody.token || !requestBody.userData?.name || !requestBody.userData?.password) {
          logger.warn('Missing required fields', {
            hasToken: !!requestBody.token,
            hasName: !!requestBody.userData?.name,
            hasPassword: !!requestBody.userData?.password
          });
          throw new Error('Missing required fields');
        }

        logger.info('Validation passed successfully');
        return { isValid: true };
      }
    );

    const repository = new InvitationRepository();
    const emailService = new EmailService();

    // ✅ NEW: Trace token validation and invitation lookup
    const invitation = await businessTracer.traceDatabaseOperation(
      'get',
      'invitation-by-token',
      async () => {
        logger.info('Validating token and fetching invitation');
        
        // Validate token and get invitation
        const tokenHash = TokenService.hashToken(requestBody.token);
        const invitationData = await repository.getInvitationByTokenHash(tokenHash);

        if (!invitationData) {
          logger.warn('Invalid token provided');
          throw new Error('Invalid token');
        }

        logger.info('Invitation found', { 
          invitationId: invitationData.id,
          email: invitationData.email,
          status: invitationData.status,
          role: invitationData.role
        });

        return invitationData;
      }
    );

    // ✅ NEW: Trace business validation
    const businessValidation = await businessTracer.traceBusinessOperation(
      'validate-invitation-status',
      'invitation-accept',
      async () => {
        // Check if invitation has already been accepted
        if (invitation.status === 'accepted') {
          logger.warn('Invitation already accepted', { invitationId: invitation.id });
          throw new Error('Invitation has already been accepted');
        }

        // Check if invitation has been cancelled
        if (invitation.status === 'cancelled') {
          logger.warn('Invitation cancelled', { invitationId: invitation.id });
          throw new Error('Invitation has been cancelled');
        }

        // Check if invitation is expired
        const isExpired = TokenService.isExpired(invitation.expiresAt);
        if (isExpired) {
          logger.warn('Invitation expired', { 
            invitationId: invitation.id,
            expiresAt: invitation.expiresAt 
          });
          
          await repository.updateInvitation(invitation.id, {
            status: 'expired',
          });
          
          throw new Error('Invitation has expired');
        }

        logger.info('Invitation status validation passed', { 
          invitationId: invitation.id,
          status: invitation.status 
        });
        
        return { isValid: true };
      }
    );

    // ✅ NEW: Trace user creation
    const user = await businessTracer.traceDatabaseOperation(
      'create',
      'user-account',
      async () => {
        logger.info('Creating user account', { 
          email: invitation.email,
          name: requestBody.userData.name,
          role: invitation.role 
        });
        
        // Create user account
        const userRepository = new UserRepository();
        
        const userData = await userRepository.createUser({
          email: invitation.email,
          name: requestBody.userData.name,
          role: invitation.role,
          department: invitation.department,
          jobTitle: invitation.jobTitle,
          hourlyRate: invitation.hourlyRate,
          permissions: invitation.permissions,
          preferences: requestBody.userData.preferences,
          contactInfo: requestBody.userData.contactInfo,
          invitationId: invitation.id,
          invitedBy: invitation.invitedBy,
        });

        logger.info('User account created successfully', { 
          userId: userData.id,
          email: userData.email,
          role: userData.role 
        });

        return userData;
      }
    );

    // ✅ NEW: Add user context to tracer
    businessTracer.addUserContext(user.id, user.role, user.department);

    // ✅ NEW: Trace invitation acceptance
    const updatedInvitation = await businessTracer.traceDatabaseOperation(
      'update',
      'invitation-acceptance',
      async () => {
        logger.info('Marking invitation as accepted', { invitationId: invitation.id });
        
        // Mark invitation as accepted
        const updated = await repository.acceptInvitation(invitation.id);
        
        logger.info('Invitation marked as accepted', { 
          invitationId: invitation.id,
          acceptedAt: updated.acceptedAt 
        });

        return updated;
      }
    );

    // ✅ NEW: Trace welcome email sending
    const emailResult = await businessTracer.traceBusinessOperation(
      'send-welcome-email',
      'invitation-accept',
      async () => {
        // Send welcome email
        try {
          const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
          const emailData: EmailTemplateData = {
            userName: user.name,
            dashboardUrl: frontendBaseUrl,
          };
          
          await emailService.sendWelcomeEmail(user.email, emailData);
          
          logger.info('Welcome email sent successfully', { 
            email: user.email,
            userName: user.name 
          });
          
          return { emailSent: true };
        } catch (emailError) {
          logger.error('Failed to send welcome email', { 
            error: emailError instanceof Error ? emailError.message : 'Unknown error',
            email: user.email 
          });
          
          // Don't fail the whole operation, but log the error
          return { emailSent: false, error: emailError };
        }
      }
    );

    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Track successful metrics
    businessMetrics.trackApiPerformance('/user-invitations/accept', 'POST', 200, responseTime);
    businessMetrics.trackBusinessKPI('InvitationAccepted', 1, MetricUnit.Count);
    businessMetrics.trackBusinessKPI('UserAccountCreated', 1, MetricUnit.Count);
    if (emailResult.emailSent) {
      businessMetrics.trackBusinessKPI('WelcomeEmailSent', 1, MetricUnit.Count);
    }
    
    businessLogger.logBusinessOperation('accept', 'invitation', user.id, true, { 
      invitationId: invitation.id,
      email: user.email,
      role: user.role,
      emailSent: emailResult.emailSent
    });

    logger.info('Invitation accepted successfully', { 
      invitationId: invitation.id,
      userId: user.id,
      email: user.email,
      responseTime 
    });

    // Prepare response
    const responseData = {
      user,
      invitation: {
        ...updatedInvitation,
        invitationToken: '', // Don't return the token
        tokenHash: '', // Don't return the hash
      },
    };

    return createSuccessResponse(responseData, 200, 'Invitation accepted successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Enhanced error handling with PowerTools
    logger.error('Invitation acceptance failed', { 
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
        errorCode = InvitationErrorCodes.INVALID_TOKEN;
        errorMessage = 'Request body is required';
      } else if (error.message === 'Invalid JSON in request body') {
        statusCode = 400;
        errorCode = InvitationErrorCodes.INVALID_TOKEN;
        errorMessage = 'Invalid JSON in request body';
      } else if (error.message === 'Missing required fields') {
        statusCode = 400;
        errorCode = InvitationErrorCodes.INVALID_TOKEN;
        errorMessage = 'Missing required fields';
      } else if (error.message === 'Invalid token') {
        statusCode = 404;
        errorCode = InvitationErrorCodes.INVALID_TOKEN;
        errorMessage = 'Invalid token';
      } else if (error.message === 'Invitation has already been accepted') {
        statusCode = 409;
        errorCode = InvitationErrorCodes.INVITATION_ALREADY_ACCEPTED;
        errorMessage = 'Invitation has already been accepted';
      } else if (error.message === 'Invitation has been cancelled') {
        statusCode = 410;
        errorCode = InvitationErrorCodes.INVITATION_NOT_FOUND;
        errorMessage = 'Invitation has been cancelled';
      } else if (error.message === 'Invitation has expired') {
        statusCode = 410;
        errorCode = InvitationErrorCodes.INVITATION_EXPIRED;
        errorMessage = 'Invitation has expired';
      }
    }

    businessMetrics.trackApiPerformance('/user-invitations/accept', 'POST', statusCode, responseTime);
    businessMetrics.trackBusinessKPI('InvitationAcceptanceError', 1, MetricUnit.Count);
    businessLogger.logBusinessOperation('accept', 'invitation', 'unknown', false, { 
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