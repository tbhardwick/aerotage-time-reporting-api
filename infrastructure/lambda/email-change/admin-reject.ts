import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { EmailChangeService } from '../shared/email-change-service';
import { EmailChangeValidation } from '../shared/email-change-validation';
import { UserRepository } from '../shared/user-repository';
import { EmailChangeErrorCodes } from '../shared/types';

const emailChangeRepo = new EmailChangeRepository();
const emailService = new EmailChangeService();
const userRepo = new UserRepository();

interface RejectEmailChangeRequest {
  rejectionReason: string;
  rejectionNotes?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Check admin permissions
    if (userRole !== 'admin') {
      return createErrorResponse(403, EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'Only administrators can reject email change requests');
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

    let rejectRequest: RejectEmailChangeRequest;
    try {
      rejectRequest = JSON.parse(event.body);
    } catch {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }
    
    // Validate request data
    const validation = EmailChangeValidation.validateRejectRequest(rejectRequest as unknown as Record<string, unknown>);
    if (!validation.isValid) {
      return createErrorResponse(400, EmailChangeErrorCodes.INVALID_REQUEST_DATA, validation.errors.join(', '));
    }

    // Get the email change request
    const emailChangeRequest = await emailChangeRepo.getEmailChangeRequestById(requestId);
    if (!emailChangeRequest) {
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    // Check if request is in correct status for rejection
    const rejectableStatuses = ['pending_verification', 'pending_approval'];
    if (!rejectableStatuses.includes(emailChangeRequest.status)) {
      return createErrorResponse(400, EmailChangeErrorCodes.REQUEST_NOT_PENDING_APPROVAL, `Cannot reject request with status: ${emailChangeRequest.status}`);
    }

    // Check if admin is trying to reject their own request
    if (emailChangeRequest.userId === currentUserId) {
      return createErrorResponse(400, EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST, 'You cannot reject your own email change request');
    }

    // Extract IP address and user agent for audit trail
    const ipAddress = event.requestContext.identity?.sourceIp;
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];

    // Reject the request
    const rejectedRequest = await emailChangeRepo.rejectEmailChangeRequest(
      requestId,
      currentUserId,
      rejectRequest.rejectionReason,
      ipAddress,
      userAgent
    );

    // Get user information for notifications
    const requestUser = await userRepo.getUserById(emailChangeRequest.userId);
    const rejecterUser = await userRepo.getUserById(currentUserId);

    // Send rejection notification to the user
    if (requestUser) {
      try {
        await emailService.sendRejectionNotification(rejectedRequest, requestUser.name);
      } catch (emailError) {
        console.error('Failed to send rejection notification:', emailError);
        // Don't fail the request if email sending fails
      }
    }

    const responseData = {
      requestId: rejectedRequest.id,
      status: 'rejected',
      rejectedAt: rejectedRequest.rejectedAt!,
      rejectedBy: {
        id: currentUserId,
        name: rejecterUser?.name || 'Unknown Admin'
      },
      rejectionReason: rejectRequest.rejectionReason
    };

    return createSuccessResponse(responseData, 200, 'Email change request rejected successfully');

  } catch (error) {
    console.error('Error rejecting email change request:', error);

    // Handle specific errors
    if ((error as Error).message === EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND) {
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    if ((error as Error).message === EmailChangeErrorCodes.REQUEST_NOT_PENDING_APPROVAL) {
      return createErrorResponse(400, EmailChangeErrorCodes.REQUEST_NOT_PENDING_APPROVAL, 'Request is not in a rejectable status');
    }

    if ((error as Error).message === EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST) {
      return createErrorResponse(400, EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST, 'You cannot reject your own email change request');
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
}; 