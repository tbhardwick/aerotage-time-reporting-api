import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  AcceptInvitationRequest, 
  AcceptInvitationResponse, 
  SuccessResponse, 
  ErrorResponse, 
  InvitationErrorCodes,
  User
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { InvitationRepository } from '../shared/invitation-repository';
import { EmailService, EmailTemplateData } from '../shared/email-service';
import { TokenService } from '../shared/token-service';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Accept invitation request:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, InvitationErrorCodes.INVALID_TOKEN, 'Request body is required');
    }

    const requestBody: AcceptInvitationRequest = JSON.parse(event.body);

    // Validate request
    const validation = ValidationService.validateAcceptInvitationRequest(requestBody);
    if (!validation.isValid) {
      return createErrorResponse(
        400, 
        validation.errorCode || InvitationErrorCodes.INVALID_TOKEN, 
        validation.errors.join(', ')
      );
    }

    const repository = new InvitationRepository();
    const emailService = new EmailService();

    // Validate token and get invitation
    const tokenHash = TokenService.hashToken(requestBody.token);
    const invitation = await repository.getInvitationByTokenHash(tokenHash);

    if (!invitation) {
      return createErrorResponse(404, InvitationErrorCodes.INVALID_TOKEN, 'Invalid token');
    }

    // Check if invitation has already been accepted
    if (invitation.status === 'accepted') {
      return createErrorResponse(409, InvitationErrorCodes.INVITATION_ALREADY_ACCEPTED, 'Invitation has already been accepted');
    }

    // Check if invitation has been cancelled
    if (invitation.status === 'cancelled') {
      return createErrorResponse(410, InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation has been cancelled');
    }

    // Check if invitation is expired
    const isExpired = TokenService.isExpired(invitation.expiresAt);
    if (isExpired) {
      await repository.updateInvitation(invitation.id, {
        status: 'expired',
      });
      return createErrorResponse(410, InvitationErrorCodes.INVITATION_EXPIRED, 'Invitation has expired');
    }

    // TODO: Create Cognito user account
    // This would involve using AWS Cognito Identity Provider SDK
    // For now, we'll simulate user creation

    const now = new Date().toISOString();
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create user object
    const user: User = {
      id: userId,
      email: invitation.email,
      name: requestBody.userData.name,
      role: invitation.role,
      teamId: invitation.teamId,
      department: invitation.department,
      jobTitle: invitation.jobTitle,
      hourlyRate: invitation.hourlyRate,
      invitationId: invitation.id,
      onboardedAt: now,
      invitedBy: invitation.invitedBy,
      isActive: true,
      startDate: now,
      permissions: invitation.permissions,
      preferences: requestBody.userData.preferences,
      contactInfo: requestBody.userData.contactInfo,
      createdAt: now,
      updatedAt: now,
      createdBy: invitation.invitedBy,
    };

    // TODO: Save user to Users table
    // This would involve using the DynamoDB client to save the user

    // Mark invitation as accepted
    const updatedInvitation = await repository.acceptInvitation(invitation.id);

    // Send welcome email
    try {
      const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://app.aerotage.com';
      const emailData: EmailTemplateData = {
        userName: user.name,
        dashboardUrl: frontendBaseUrl,
      };
      await emailService.sendWelcomeEmail(user.email, emailData);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the whole operation, but log the error
    }

    // Prepare response
    const response: SuccessResponse<AcceptInvitationResponse> = {
      success: true,
      data: {
        user,
        invitation: {
          ...updatedInvitation,
          invitationToken: '', // Don't return the token
          tokenHash: '', // Don't return the hash
        },
      },
      message: 'Invitation accepted successfully',
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Error accepting invitation:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An internal server error occurred',
        },
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

/**
 * Creates standardized error response
 */
function createErrorResponse(
  statusCode: number, 
  errorCode: InvitationErrorCodes, 
  message: string
): APIGatewayProxyResult {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
    },
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(errorResponse),
  };
} 