import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { EmailChangeService } from '../shared/email-change-service';
import { EmailChangeValidation } from '../shared/email-change-validation';
import { UserRepository } from '../shared/user-repository';
import { 
  EmailVerificationRequest,
  EmailChangeErrorCodes
} from '../shared/types';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';

const emailChangeRepo = new EmailChangeRepository();
const emailService = new EmailChangeService();
const userRepo = new UserRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('🔐 Email Verification - Request received:', {
      httpMethod: event.httpMethod,
      path: event.path,
      body: event.body ? 'Present' : 'None'
    });

    // Parse and validate request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let verificationRequest: EmailVerificationRequest;
    try {
      verificationRequest = JSON.parse(event.body);
    } catch {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    console.log('📋 Validating email verification request...');
    
    // Validate request data
    const validation = EmailChangeValidation.validateEmailVerificationRequest(verificationRequest as unknown as Record<string, unknown>);
    if (!validation.isValid) {
      console.log('❌ Validation failed:', validation.errors);
      return createErrorResponse(400, EmailChangeErrorCodes.INVALID_REQUEST_DATA, validation.errors.join(', '));
    }

    // Validate token format
    if (!EmailChangeValidation.isValidToken(verificationRequest.token)) {
      console.log('❌ Invalid token format');
      return createErrorResponse(400, EmailChangeErrorCodes.INVALID_VERIFICATION_TOKEN, 'Invalid verification token format');
    }

    // Find email change request by token
    console.log('🔍 Finding email change request by token...');
    const emailChangeRequest = await emailChangeRepo.getEmailChangeRequestByToken(
      verificationRequest.token, 
      verificationRequest.emailType
    );

    if (!emailChangeRequest) {
      console.log('❌ Email change request not found for token');
      return createErrorResponse(404, EmailChangeErrorCodes.INVALID_VERIFICATION_TOKEN, 'Invalid or expired verification token');
    }

    // Check if token is expired
    if (emailChangeRequest.verificationTokensExpiresAt && 
        EmailChangeValidation.isTokenExpired(emailChangeRequest.verificationTokensExpiresAt)) {
      console.log('❌ Verification token expired');
      return createErrorResponse(410, EmailChangeErrorCodes.VERIFICATION_TOKEN_EXPIRED, 'Verification token has expired');
    }

    // Check if email is already verified
    const isAlreadyVerified = verificationRequest.emailType === 'current' 
      ? emailChangeRequest.currentEmailVerified 
      : emailChangeRequest.newEmailVerified;

    if (isAlreadyVerified) {
      console.log('❌ Email already verified');
      return createErrorResponse(410, EmailChangeErrorCodes.EMAIL_ALREADY_VERIFIED, 'This email address has already been verified');
    }

    // Check if request is in correct status
    if (emailChangeRequest.status !== 'pending_verification') {
      console.log('❌ Request not in pending verification status:', emailChangeRequest.status);
      return createErrorResponse(400, EmailChangeErrorCodes.INVALID_REQUEST_DATA, 'Email change request is not in pending verification status');
    }

    // Extract IP address and user agent for audit trail
    const ipAddress = event.requestContext.identity?.sourceIp;
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];

    // Update verification status
    console.log('✅ Updating email verification status...');
    const updatedRequest = await emailChangeRepo.updateEmailVerificationStatus(
      emailChangeRequest.id,
      verificationRequest.emailType,
      undefined, // No specific user performing this action
      ipAddress,
      userAgent
    );

    // Get user information for notifications
    const user = await userRepo.getUserById(updatedRequest.userId);
    if (!user) {
      console.error('❌ User not found for email change request:', updatedRequest.userId);
      // Continue processing but log the error
    }

    // Determine next step based on verification status
    let nextStep: 'verify_other_email' | 'pending_approval' | 'auto_approved' | 'processing';
    let message: string;

    if (updatedRequest.currentEmailVerified && updatedRequest.newEmailVerified) {
      // Both emails verified
      if (updatedRequest.status === 'pending_approval') {
        nextStep = 'pending_approval';
        message = 'Both email addresses verified successfully. Your request is now pending admin approval.';
        
        // Send admin notification if user exists
        if (user) {
          try {
            // Get admin emails (this would typically come from a configuration or admin user query)
            const adminEmails = ['admin@aerotage.com']; // TODO: Get from configuration
            await emailService.sendAdminApprovalNotification(updatedRequest, user.name, adminEmails);
          } catch (emailError) {
            console.error('❌ Failed to send admin notification:', emailError);
          }
        }
      } else if (updatedRequest.status === 'approved') {
        nextStep = 'auto_approved';
        message = 'Both email addresses verified successfully. Your request has been auto-approved and will be processed shortly.';
        
        // Send approval notification if user exists
        if (user) {
          try {
            await emailService.sendApprovalNotification(updatedRequest, user.name);
          } catch (emailError) {
            console.error('❌ Failed to send approval notification:', emailError);
          }
        }
      } else {
        nextStep = 'processing';
        message = 'Both email addresses verified successfully. Your request is being processed.';
      }
    } else {
      // Only one email verified
      const otherEmailType = verificationRequest.emailType === 'current' ? 'new' : 'current';
      const otherEmailAddress = verificationRequest.emailType === 'current' 
        ? updatedRequest.newEmail 
        : updatedRequest.currentEmail;
      
      nextStep = 'verify_other_email';
      message = `${verificationRequest.emailType === 'current' ? 'Current' : 'New'} email verified successfully. Please verify your ${otherEmailType} email address (${otherEmailAddress}).`;
    }

    console.log('✅ Email verification completed successfully');

    const responseData = {
      requestId: updatedRequest.id,
      emailType: verificationRequest.emailType,
      verified: true,
      verificationStatus: {
        currentEmailVerified: updatedRequest.currentEmailVerified,
        newEmailVerified: updatedRequest.newEmailVerified
      },
      nextStep,
      message
    };

    return createSuccessResponse(responseData);

  } catch (error) {
    console.error('Error verifying email:', error);
    
    // Handle specific errors
    if ((error as Error).message === EmailChangeErrorCodes.INVALID_VERIFICATION_TOKEN) {
      return createErrorResponse(400, EmailChangeErrorCodes.INVALID_VERIFICATION_TOKEN, 'Invalid or expired verification token');
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
}; 