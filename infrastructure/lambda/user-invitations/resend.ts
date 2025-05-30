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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Role-based access control
    if (userRole === 'employee') {
      // Employees cannot resend invitations
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to resend invitations');
    }
    // Managers and admins can resend invitations

    // Get invitation ID from path parameters
    const invitationId = event.pathParameters?.id;
    if (!invitationId) {
      return createErrorResponse(400, InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation ID is required');
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
      inviterName: user?.email?.split('@')[0] || 'Admin',
      inviterEmail: user?.email || 'admin@aerotage.com',
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

    const responseData = {
      id: responseInvitation.id,
      expiresAt: responseInvitation.expiresAt,
      resentAt: responseInvitation.lastResentAt!,
    };

    return createSuccessResponse(responseData, 200, 'Invitation resent successfully');

  } catch (error) {
    console.error('Error resending user invitation:', error);
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
}; 