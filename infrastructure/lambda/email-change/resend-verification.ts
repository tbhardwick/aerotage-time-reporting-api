import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { EmailChangeService } from '../shared/email-change-service';
import { EmailChangeValidation } from '../shared/email-change-validation';
import { UserRepository } from '../shared/user-repository';
import { 
  ResendVerificationRequest,
  EmailChangeErrorCodes
} from '../shared/types';
import { getCurrentUserId } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';

const emailChangeRepo = new EmailChangeRepository();
const emailService = new EmailChangeService();
const userRepo = new UserRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('📨 Resend Email Verification - Request received:', {
      httpMethod: event.httpMethod,
      path: event.path,
      pathParameters: event.pathParameters,
      body: event.body ? 'Present' : 'None'
    });

    // Extract user information from authorization context
    const authContext = event.requestContext.authorizer;
    const currentUserId = getCurrentUserId(event);
    const userRole = authContext?.role || authContext?.claims?.['custom:role'];

    if (!currentUserId) {
      console.log('❌ No user ID found in authorization context');
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // Get request ID from path parameters
    const requestId = event.pathParameters?.id;
    if (!requestId) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request ID is required');
    }

    // Parse and validate request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let resendRequest: ResendVerificationRequest;
    try {
      resendRequest = JSON.parse(event.body);
    } catch {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    console.log('📋 Validating resend verification request...');
    
    // Validate request data
    const validation = EmailChangeValidation.validateResendVerificationRequest(resendRequest as unknown as Record<string, unknown>);
    if (!validation.isValid) {
      console.log('❌ Validation failed:', validation.errors);
      return createErrorResponse(400, EmailChangeErrorCodes.INVALID_REQUEST_DATA, validation.errors.join(', '));
    }

    console.log('🔍 Getting email change request...', { requestId });

    // Get the email change request
    const emailChangeRequest = await emailChangeRepo.getEmailChangeRequestById(requestId);
    if (!emailChangeRequest) {
      console.log('❌ Email change request not found:', requestId);
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    // Check permissions - users can only resend for their own requests, admins can resend for any
    if (emailChangeRequest.userId !== currentUserId && userRole !== 'admin') {
      console.log(`❌ Insufficient permissions. User ${currentUserId} trying to resend for request ${emailChangeRequest.userId}`);
      return createErrorResponse(403, EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'You can only resend verification for your own email change requests');
    }

    // Check if request is in correct status
    if (emailChangeRequest.status !== 'pending_verification') {
      console.log('❌ Request not in pending verification status:', emailChangeRequest.status);
      return createErrorResponse(400, EmailChangeErrorCodes.INVALID_REQUEST_DATA, 'Email change request is not in pending verification status');
    }

    // Check if email is already verified
    const isAlreadyVerified = resendRequest.emailType === 'current' 
      ? emailChangeRequest.currentEmailVerified 
      : emailChangeRequest.newEmailVerified;

    if (isAlreadyVerified) {
      console.log('❌ Email already verified');
      return createErrorResponse(410, EmailChangeErrorCodes.EMAIL_ALREADY_VERIFIED, 'This email address has already been verified');
    }

    // Extract IP address and user agent for audit trail
    const ipAddress = event.requestContext.identity?.sourceIp;
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];

    console.log('🔄 Regenerating verification token...');

    // Generate new verification token
    const tokenInfo = await emailChangeRepo.regenerateVerificationTokens(
      requestId,
      resendRequest.emailType,
      currentUserId,
      ipAddress,
      userAgent
    );

    // Get user information for email
    const user = await userRepo.getUserById(emailChangeRequest.userId);
    if (!user) {
      console.error('❌ User not found for email change request:', emailChangeRequest.userId);
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Update the request object with new token for email sending
    const updatedRequest = {
      ...emailChangeRequest,
      [resendRequest.emailType === 'current' ? 'currentEmailVerificationToken' : 'newEmailVerificationToken']: tokenInfo.token,
      verificationTokensExpiresAt: tokenInfo.expiresAt
    };

    console.log('📨 Sending verification email...');

    // Send verification email
    try {
      await emailService.sendVerificationEmail(updatedRequest, resendRequest.emailType, user.name);
    } catch {
      console.log('❌ Failed to send verification email');
      return createErrorResponse(500, EmailChangeErrorCodes.EMAIL_SEND_FAILED, 'Failed to send verification email');
    }

    const emailAddress = resendRequest.emailType === 'current' 
      ? emailChangeRequest.currentEmail 
      : emailChangeRequest.newEmail;

    console.log('✅ Verification email resent successfully');

    const responseData = {
      requestId: emailChangeRequest.id,
      emailType: resendRequest.emailType,
      emailAddress,
      resentAt: new Date().toISOString(),
      expiresAt: tokenInfo.expiresAt
    };

    return createSuccessResponse(responseData, 200, `Verification email resent to ${emailAddress}`);

  } catch (error) {
    console.error('Error resending email verification:', error);
    
    // Handle specific errors
    if ((error as Error).message === EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND) {
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    if ((error as Error).message === EmailChangeErrorCodes.EMAIL_ALREADY_VERIFIED) {
      return createErrorResponse(410, EmailChangeErrorCodes.EMAIL_ALREADY_VERIFIED, 'Email address has already been verified');
    }

    if ((error as Error).message === EmailChangeErrorCodes.VERIFICATION_RATE_LIMITED) {
      return createErrorResponse(429, EmailChangeErrorCodes.VERIFICATION_RATE_LIMITED, 'Too many verification emails sent. Please wait before requesting another.');
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
}; 