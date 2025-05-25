import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  CreateInvitationRequest, 
  SuccessResponse, 
  ErrorResponse, 
  InvitationErrorCodes,
  UserInvitation
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { InvitationRepository, CreateInvitationData } from '../shared/invitation-repository';
import { EmailService, EmailTemplateData } from '../shared/email-service';
import { TokenService } from '../shared/token-service';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Create user invitation request:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, InvitationErrorCodes.INVALID_EMAIL, 'Request body is required');
    }

    const requestBody: CreateInvitationRequest = JSON.parse(event.body);

    // Validate request
    const validation = ValidationService.validateCreateInvitationRequest(requestBody);
    if (!validation.isValid) {
      return createErrorResponse(
        400, 
        validation.errorCode || InvitationErrorCodes.INVALID_EMAIL, 
        validation.errors.join(', ')
      );
    }

    // Get current user from Cognito token
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, InvitationErrorCodes.INSUFFICIENT_PERMISSIONS, 'User authentication required');
    }

    // TODO: Add permission check for userManagement permission
    // This would typically involve checking the user's role/permissions in the database
    // For now, we'll proceed with the invitation creation

    const repository = new InvitationRepository();
    const emailService = new EmailService();

    // Check if email already exists in users or pending invitations
    const emailExists = await repository.checkEmailExists(requestBody.email);
    if (emailExists) {
      return createErrorResponse(409, InvitationErrorCodes.EMAIL_ALREADY_EXISTS, 'Email already has a pending invitation');
    }

    // TODO: Check if email exists in Users table
    // This would require querying the Users table by email

    // Create invitation data
    const invitationData: CreateInvitationData = {
      email: requestBody.email.toLowerCase(),
      invitedBy: currentUserId,
      role: requestBody.role,
      teamId: requestBody.teamId,
      department: requestBody.department,
      jobTitle: requestBody.jobTitle,
      hourlyRate: requestBody.hourlyRate,
      permissions: requestBody.permissions,
      personalMessage: requestBody.personalMessage,
      expirationDays: 7, // Default from requirements
    };

    // Create invitation in database
    const invitation = await repository.createInvitation(invitationData);

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

    // Send invitation email
    try {
      await emailService.sendInvitationEmail(invitation.email, emailData);
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the whole operation, but log the error
      // In production, you might want to queue the email for retry
    }

    // Prepare response data (exclude sensitive token)
    const responseInvitation: UserInvitation = {
      ...invitation,
      invitationToken: '', // Don't return the actual token in response
    };

    const response: SuccessResponse<UserInvitation> = {
      success: true,
      data: responseInvitation,
      message: 'User invitation created successfully',
    };

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Error creating user invitation:', error);
    
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
 * Extracts current user ID from authorization context
 */
function getCurrentUserId(event: APIGatewayProxyEvent): string | null {
  const authContext = event.requestContext.authorizer;
  
  // Primary: get from custom authorizer context
  if (authContext?.userId) {
    return authContext.userId;
  }

  // Fallback: try to get from Cognito claims (for backward compatibility)
  if (authContext?.claims?.sub) {
    return authContext.claims.sub;
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