import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  InvitationValidation, 
  InvitationErrorCodes
} from '../shared/types';
import { InvitationRepository } from '../shared/invitation-repository';
import { TokenService } from '../shared/token-service';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Validate invitation token request:', JSON.stringify(event, null, 2));

  try {
    // Get token from path parameters
    const token = event.pathParameters?.token;
    if (!token) {
      return createErrorResponse(400, InvitationErrorCodes.INVALID_TOKEN, 'Token is required');
    }

    // Validate token format
    if (!TokenService.validateTokenFormat(token)) {
      return createErrorResponse(400, InvitationErrorCodes.INVALID_TOKEN, 'Invalid token format');
    }

    const repository = new InvitationRepository();

    // Get invitation by token hash
    const tokenHash = TokenService.hashToken(token);
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
      // Update invitation status to expired
      await repository.updateInvitation(invitation.id, {
        status: 'expired',
      });
      return createErrorResponse(410, InvitationErrorCodes.INVITATION_EXPIRED, 'Invitation has expired');
    }

    // Prepare validation response
    const validationData: InvitationValidation = {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        department: invitation.department,
        jobTitle: invitation.jobTitle,
        hourlyRate: invitation.hourlyRate,
        permissions: invitation.permissions,
        expiresAt: invitation.expiresAt,
        isExpired: isExpired,
      },
    };

    return createSuccessResponse(validationData);

  } catch (error) {
    console.error('Error validating invitation token:', error);
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// ... existing code ...