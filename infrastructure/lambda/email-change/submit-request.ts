import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { EmailChangeService } from '../shared/email-change-service';
import { EmailChangeValidation } from '../shared/email-change-validation';
import { UserRepository } from '../shared/user-repository';
import { 
  CreateEmailChangeRequest, 
  EmailChangeErrorCodes
} from '../shared/types';

const emailChangeRepo = new EmailChangeRepository();
const emailService = new EmailChangeService();
const userRepo = new UserRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Get user ID from path parameters (for admin operations) or use current user
    const targetUserId = event.pathParameters?.id || currentUserId;

    // Check permissions - users can only change their own email, admins can change any
    if (targetUserId !== currentUserId && userRole !== 'admin') {
      return createErrorResponse(403, EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'You can only change your own email address');
    }

    // Parse and validate request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let createRequest: CreateEmailChangeRequest;
    try {
      createRequest = JSON.parse(event.body);
    } catch {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }
    
    // Validate request data
    const validation = EmailChangeValidation.validateCreateEmailChangeRequest(createRequest as unknown as Record<string, unknown>);
    if (!validation.isValid) {
      return createErrorResponse(400, EmailChangeErrorCodes.INVALID_REQUEST_DATA, validation.errors.join(', '));
    }

    // Get current user information
    const currentUser = await userRepo.getUserById(targetUserId);
    if (!currentUser) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Check if new email already exists
    const existingUser = await userRepo.getUserByEmail(createRequest.newEmail);
    if (existingUser) {
      return createErrorResponse(409, EmailChangeErrorCodes.EMAIL_ALREADY_EXISTS, 'Email address is already in use');
    }

    // Check for active email change requests
    const hasActiveRequest = await emailChangeRepo.hasActiveEmailChangeRequest(targetUserId);

    // Validate business rules
    const businessValidation = EmailChangeValidation.validateBusinessRules(
      currentUser.email,
      createRequest.newEmail,
      createRequest.reason,
      hasActiveRequest
    );

    if (!businessValidation.isValid) {
      const errorCode = businessValidation.errors[0] as EmailChangeErrorCodes;
      return createErrorResponse(409, errorCode, businessValidation.errors.join(', '));
    }

    // Extract IP address and user agent for audit trail
    const ipAddress = event.requestContext.identity?.sourceIp;
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];

    // Create email change request
    const emailChangeRequest = await emailChangeRepo.createEmailChangeRequest(
      targetUserId,
      currentUser.email,
      createRequest.newEmail,
      createRequest.reason,
      createRequest.customReason,
      ipAddress,
      userAgent
    );

    // Send verification emails
    try {
      // Send verification email to current email
      await emailService.sendVerificationEmail(emailChangeRequest, 'current', currentUser.name);
      
      // Send verification email to new email
      await emailService.sendVerificationEmail(emailChangeRequest, 'new', currentUser.name);
    } catch (emailError) {
      console.error('Failed to send verification emails:', emailError);
      // Don't fail the request if email sending fails, but log it
      // The user can resend verification emails later
    }

    // Determine next steps and estimated completion time
    const autoApprovalReasons = ['personal_preference', 'name_change'];
    const isDomainChange = currentUser.email.split('@')[1] !== createRequest.newEmail.split('@')[1];
    const requiresApproval = !autoApprovalReasons.includes(createRequest.reason) || isDomainChange;

    const nextSteps = [
      `Check your current email (${currentUser.email}) for verification link`,
      `Check your new email (${createRequest.newEmail}) for verification link`
    ];

    if (requiresApproval) {
      nextSteps.push('Admin approval will be required after verification');
    }

    // Calculate estimated completion time (24-48 hours depending on approval requirement)
    const estimatedHours = requiresApproval ? 48 : 24;
    const estimatedCompletionTime = new Date(Date.now() + estimatedHours * 60 * 60 * 1000).toISOString();

    const responseData = {
      requestId: emailChangeRequest.id,
      status: emailChangeRequest.status,
      currentEmail: emailChangeRequest.currentEmail,
      newEmail: emailChangeRequest.newEmail,
      reason: emailChangeRequest.reason,
      customReason: emailChangeRequest.customReason,
      requestedAt: emailChangeRequest.requestedAt,
      estimatedCompletionTime,
      verificationRequired: {
        currentEmail: true,
        newEmail: true
      },
      nextSteps
    };

    return createSuccessResponse(responseData, 201, 'Email change request submitted successfully');

  } catch (error) {
    console.error('Error submitting email change request:', error);

    // Handle specific errors
    if ((error as Error).message === EmailChangeErrorCodes.EMAIL_ALREADY_EXISTS) {
      return createErrorResponse(409, EmailChangeErrorCodes.EMAIL_ALREADY_EXISTS, 'Email address is already in use');
    }

    if ((error as Error).message === EmailChangeErrorCodes.ACTIVE_REQUEST_EXISTS) {
      return createErrorResponse(409, EmailChangeErrorCodes.ACTIVE_REQUEST_EXISTS, 'You already have an active email change request');
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
}; 