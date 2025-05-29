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
import { getCurrentUserId } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { UserRepository } from '../shared/user-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Create user invitation request:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, InvitationErrorCodes.INVALID_EMAIL, 'Request body is required');
    }

    const requestBody: CreateInvitationRequest = JSON.parse(event.body);

    // Validate request
    const validation = ValidationService.validateCreateInvitationRequest(requestBody as unknown as Record<string, unknown>);
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
    const userRepository = new UserRepository();

    // Check if email already exists in pending invitations
    console.log('🔍 Checking if email has pending invitation...');
    const emailExists = await repository.checkEmailExists(requestBody.email);
    if (emailExists) {
      console.log('❌ Email already has pending invitation:', requestBody.email);
      return createErrorResponse(409, InvitationErrorCodes.EMAIL_ALREADY_EXISTS, 'Email already has a pending invitation');
    }

    // Check if email already exists in Users table
    console.log('🔍 Checking if email already exists in Users table...');
    const existingUser = await userRepository.getUserByEmail(requestBody.email);
    if (existingUser) {
      console.log('❌ Email already exists in Users table:', requestBody.email);
      return createErrorResponse(409, InvitationErrorCodes.EMAIL_ALREADY_EXISTS, 'Email address is already in use by an existing user');
    }

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

    return createSuccessResponse(responseInvitation, 201, 'User invitation created successfully');

  } catch (error) {
    console.error('Error creating user invitation:', error);
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
}; 