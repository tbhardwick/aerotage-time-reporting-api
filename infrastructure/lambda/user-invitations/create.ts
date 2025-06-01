import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { InvitationRepository, CreateInvitationData } from '../shared/invitation-repository';
import { EmailService, EmailTemplateData } from '../shared/email-service';
import { ValidationService } from '../shared/validation';
import { TokenService } from '../shared/token-service';
import { 
  CreateInvitationRequest,
  InvitationErrorCodes,
  UserInvitation
} from '../shared/types';
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
    
    logger.info('Create user invitation request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // ✅ NEW: Track API request metrics
    businessMetrics.trackApiPerformance(
      '/user-invitations',
      'POST',
      0, // Will be updated later
      0  // Will be updated later
    );

    // Parse request body
    if (!event.body) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Missing request body'), 'user-invitation-create', 'unknown');
      return createErrorResponse(400, InvitationErrorCodes.INVALID_EMAIL, 'Request body is required');
    }

    let requestBody: CreateInvitationRequest;
    try {
      requestBody = JSON.parse(event.body);
      logger.info('Request body parsed successfully', { email: requestBody.email, role: requestBody.role });
    } catch (parseError) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations', 'POST', 400, responseTime);
      businessLogger.logError(parseError as Error, 'user-invitation-create-parse', 'unknown');
      return createErrorResponse(400, InvitationErrorCodes.INVALID_EMAIL, 'Invalid JSON in request body');
    }

    // ✅ NEW: Trace validation logic
    const validation = await businessTracer.traceBusinessOperation(
      'validate-invitation-request',
      'user-invitation',
      async () => {
        return ValidationService.validateCreateInvitationRequest(requestBody as unknown as Record<string, unknown>);
      }
    );

    if (!validation.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations', 'POST', 400, responseTime);
      businessMetrics.trackBusinessKPI('UserInvitationValidationError', 1, MetricUnit.Count);
      businessLogger.logBusinessOperation('create', 'user-invitation', 'unknown', false, { 
        validationErrors: validation.errors 
      });
      
      return createErrorResponse(
        400, 
        validation.errorCode || InvitationErrorCodes.INVALID_EMAIL, 
        validation.errors.join(', ')
      );
    }

    // Get current user from Cognito token
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'user-invitation-create', false, { reason: 'no_user_id' });
      return createErrorResponse(401, InvitationErrorCodes.INSUFFICIENT_PERMISSIONS, 'User authentication required');
    }

    // ✅ NEW: Add user context to tracer and logger
    const user = getAuthenticatedUser(event);
    businessTracer.addUserContext(currentUserId, user?.role, user?.department);
    addRequestContext(requestId, currentUserId, user?.role);

    // TODO: Add permission check for userManagement permission
    // This would typically involve checking the user's role/permissions in the database
    // For now, we'll proceed with the invitation creation

    const repository = new InvitationRepository();
    const emailService = new EmailService();
    const userRepository = new UserRepository();

    // ✅ NEW: Trace email existence check for invitations
    const emailExists = await businessTracer.traceDatabaseOperation(
      'check',
      'user-invitations',
      async () => {
        logger.info('Checking if email has pending invitation', { email: requestBody.email });
        return await repository.checkEmailExists(requestBody.email);
      }
    );

    if (emailExists) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations', 'POST', 409, responseTime);
      businessMetrics.trackBusinessKPI('UserInvitationDuplicateError', 1, MetricUnit.Count);
      businessLogger.logBusinessOperation('create', 'user-invitation', currentUserId, false, { 
        email: requestBody.email,
        reason: 'pending_invitation_exists' 
      });
      
      logger.warn('Email already has pending invitation', { email: requestBody.email });
      return createErrorResponse(409, InvitationErrorCodes.EMAIL_ALREADY_EXISTS, 'Email already has a pending invitation');
    }

    // ✅ NEW: Trace email existence check for users
    const existingUser = await businessTracer.traceDatabaseOperation(
      'get',
      'users',
      async () => {
        logger.info('Checking if email already exists in Users table', { email: requestBody.email });
        return await userRepository.getUserByEmail(requestBody.email);
      }
    );

    if (existingUser) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations', 'POST', 409, responseTime);
      businessMetrics.trackBusinessKPI('UserInvitationDuplicateError', 1, MetricUnit.Count);
      businessLogger.logBusinessOperation('create', 'user-invitation', currentUserId, false, { 
        email: requestBody.email,
        reason: 'user_already_exists' 
      });
      
      logger.warn('Email already exists in Users table', { email: requestBody.email });
      return createErrorResponse(409, InvitationErrorCodes.EMAIL_ALREADY_EXISTS, 'Email address is already in use by an existing user');
    }

    // ✅ NEW: Trace invitation creation
    const invitation = await businessTracer.traceBusinessOperation(
      'create-invitation',
      'user-invitation',
      async () => {
        // Create invitation data
        const invitationData: CreateInvitationData = {
          email: requestBody.email.toLowerCase(),
          invitedBy: currentUserId,
          role: requestBody.role,
          department: requestBody.department,
          jobTitle: requestBody.jobTitle,
          hourlyRate: requestBody.hourlyRate,
          permissions: requestBody.permissions,
          personalMessage: requestBody.personalMessage,
          expirationDays: 7, // Default from requirements
        };

        logger.info('Creating invitation in database', { 
          email: invitationData.email,
          role: invitationData.role,
          invitedBy: currentUserId 
        });

        // Create invitation in database
        return await repository.createInvitation(invitationData);
      }
    );

    // ✅ NEW: Trace email sending
    const emailResult = await businessTracer.traceBusinessOperation(
      'send-invitation-email',
      'email',
      async () => {
        // Prepare email template data
        const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
        const invitationUrl = `${frontendBaseUrl}/accept-invitation?token=${invitation.invitationToken}`;
        
        const emailData: EmailTemplateData = {
          inviterName: 'Admin', // TODO: Get actual inviter name from Users table
          inviterEmail: 'admin@aerotage.com', // TODO: Get actual inviter email
          role: invitation.role,
          department: invitation.department,
          jobTitle: invitation.jobTitle,
          invitationUrl,
          expirationDate: TokenService.formatExpirationDate(invitation.expiresAt),
          personalMessage: invitation.personalMessage,
        };

        logger.info('Sending invitation email', { 
          email: invitation.email,
          invitationId: invitation.id 
        });

        // Send invitation email
        try {
          await emailService.sendInvitationEmail(invitation.email, emailData);
          return { success: true };
        } catch (emailError) {
          businessLogger.logError(
            emailError instanceof Error ? emailError : new Error('Email send failed'),
            'send-invitation-email',
            currentUserId,
            { email: invitation.email, invitationId: invitation.id }
          );
          
          logger.error('Failed to send invitation email', {
            error: emailError instanceof Error ? emailError.message : 'Unknown error',
            email: invitation.email,
            invitationId: invitation.id,
          });
          
          // Don't fail the whole operation, but log the error
          // In production, you might want to queue the email for retry
          return { success: false, error: emailError };
        }
      }
    );

    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Track successful metrics
    businessMetrics.trackApiPerformance('/user-invitations', 'POST', 201, responseTime);
    businessMetrics.trackUserOperation('create', true); // Using 'create' for invitation creation
    businessMetrics.trackBusinessKPI('UserInvitationCreated', 1, MetricUnit.Count);
    
    if (emailResult.success) {
      businessMetrics.trackBusinessKPI('InvitationEmailSent', 1, MetricUnit.Count);
    } else {
      businessMetrics.trackBusinessKPI('InvitationEmailError', 1, MetricUnit.Count);
    }
    
    businessLogger.logBusinessOperation('create', 'user-invitation', currentUserId, true, { 
      invitationId: invitation.id,
      email: invitation.email,
      role: invitation.role,
      emailSent: emailResult.success 
    });

    logger.info('User invitation created successfully', { 
      userId: currentUserId,
      invitationId: invitation.id,
      email: invitation.email,
      emailSent: emailResult.success,
      responseTime 
    });

    // Prepare response data (exclude sensitive token)
    const responseInvitation: UserInvitation = {
      ...invitation,
      invitationToken: '', // Don't return the actual token in response
    };

    return createSuccessResponse(responseInvitation, 201, 'User invitation created successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Enhanced error logging and metrics
    businessMetrics.trackApiPerformance('/user-invitations', 'POST', 500, responseTime);
    businessMetrics.trackUserOperation('create', false);
    businessMetrics.trackBusinessKPI('UserInvitationError', 1, MetricUnit.Count);
    
    businessLogger.logError(
      error instanceof Error ? error : new Error('Unknown error'),
      'user-invitation-create',
      getCurrentUserId(event),
      { responseTime }
    );
    
    logger.error('Create user invitation error', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : { message: 'Unknown error' },
      responseTime,
    });
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// ✅ NEW: Export handler with PowerTools v2.x middleware pattern
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }))
  .use(logMetrics(metrics)); 