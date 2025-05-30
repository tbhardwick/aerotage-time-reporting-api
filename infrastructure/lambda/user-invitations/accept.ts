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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Accept invitation request:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, InvitationErrorCodes.INVALID_TOKEN, 'Request body is required');
    }

    const requestBody: AcceptInvitationRequest = JSON.parse(event.body);

    // Basic validation
    if (!requestBody.token || !requestBody.userData?.name || !requestBody.userData?.password) {
      return createErrorResponse(400, InvitationErrorCodes.INVALID_TOKEN, 'Missing required fields');
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

    // Create user account
    const userRepository = new UserRepository();
    
    const user = await userRepository.createUser({
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

    // Mark invitation as accepted
    const updatedInvitation = await repository.acceptInvitation(invitation.id);

    // Send welcome email
    try {
      const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
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
    console.error('Error accepting invitation:', error);
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};