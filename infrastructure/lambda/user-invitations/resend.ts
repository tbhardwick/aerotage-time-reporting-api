import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  ResendOptions, 
  SuccessResponse, 
  ErrorResponse, 
  InvitationErrorCodes,
  UserInvitation
} from '../shared/types';
import { InvitationRepository } from '../shared/invitation-repository';
import { EmailService, EmailTemplateData } from '../shared/email-service';
import { TokenService } from '../shared/token-service';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Resend user invitation request:', JSON.stringify(event, null, 2));

  try {
    // Get invitation ID from path parameters
    const invitationId = event.pathParameters?.id;
    if (!invitationId) {
      return createErrorResponse(400, InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation ID is required');
    }

    // Get current user from Cognito token
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, InvitationErrorCodes.INSUFFICIENT_PERMISSIONS, 'User authentication required');
    }

    // Parse request body (optional)
    let resendOptions: ResendOptions = {
      extendExpiration: true, // Default value
    };

    if (event.body) {
      try {
        resendOptions = { ...resendOptions, ...JSON.parse(event.body) };
      } catch (parseError) {
        return createErrorResponse(400, InvitationErrorCodes.INVALID_EMAIL, 'Invalid request body format');
      }
    }

    const repository = new InvitationRepository();
    const emailService = new EmailService();

    // Get existing invitation
    const invitation = await repository.getInvitationById(invitationId);
    if (!invitation) {
      return createErrorResponse(404, InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation not found');
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return createErrorResponse(400, InvitationErrorCodes.INVITATION_ALREADY_ACCEPTED, 'Invitation is no longer pending');
    }

    // Check resend limit (max 3 resends per invitation)
    if (invitation.resentCount >= 3) {
      return createErrorResponse(400, InvitationErrorCodes.RATE_LIMIT_EXCEEDED, 'Maximum resend limit reached');
    }

    // Update invitation with resend information
    const updatedInvitation = await repository.resendInvitation(
      invitationId,
      resendOptions.extendExpiration,
      resendOptions.personalMessage
    );

    // Prepare email template data
    const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
    const invitationUrl = `${frontendBaseUrl}/accept-invitation?token=${updatedInvitation.invitationToken}`;
    
    const emailData: EmailTemplateData = {
      inviterName: 'Admin', // TODO: Get actual inviter name from Users table
      inviterEmail: 'admin@aerotage.com', // TODO: Get actual inviter email
      role: updatedInvitation.role,
      department: updatedInvitation.department,
      jobTitle: updatedInvitation.jobTitle,
      invitationUrl,
      expirationDate: TokenService.formatExpirationDate(updatedInvitation.expiresAt),
      personalMessage: updatedInvitation.personalMessage,
    };

    // Send reminder email
    try {
      await emailService.sendReminderEmail(updatedInvitation.email, emailData);
    } catch (emailError) {
      console.error('Failed to send reminder email:', emailError);
      return createErrorResponse(500, InvitationErrorCodes.EMAIL_SEND_FAILED, 'Failed to send reminder email');
    }

    // Prepare response data (exclude sensitive token)
    const responseInvitation: UserInvitation = {
      ...updatedInvitation,
      invitationToken: '', // Don't return the actual token in response
      tokenHash: '', // Don't return the token hash
    };

    const response: SuccessResponse<{ id: string; expiresAt: string; resentAt: string }> = {
      success: true,
      data: {
        id: responseInvitation.id,
        expiresAt: responseInvitation.expiresAt,
        resentAt: responseInvitation.lastResentAt!,
      },
      message: 'Invitation resent successfully',
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
    console.error('Error resending user invitation:', error);
    
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
 * Extracts current user ID from Cognito JWT token
 */
function getCurrentUserId(event: APIGatewayProxyEvent): string | null {
  const cognitoIdentity = event.requestContext.authorizer?.claims;
  if (cognitoIdentity && cognitoIdentity.sub) {
    return cognitoIdentity.sub;
  }

  // Fallback: try to get from custom authorizer
  if (event.requestContext.authorizer?.userId) {
    return event.requestContext.authorizer.userId;
  }

  return null;
}

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