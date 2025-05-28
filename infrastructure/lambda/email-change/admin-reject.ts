import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { EmailChangeService } from '../shared/email-change-service';
import { EmailChangeValidation } from '../shared/email-change-validation';
import { UserRepository } from '../shared/user-repository';
import { 
  RejectEmailChangeRequest,
  RejectRequestResponse,
  EmailChangeErrorCodes
} from '../shared/types';
import { getCurrentUserId } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';

const emailChangeRepo = new EmailChangeRepository();
const emailService = new EmailChangeService();
const userRepo = new UserRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('❌ Admin Reject Email Change - Request received:', {
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

    // Check admin permissions
    if (userRole !== 'admin') {
      console.log(`❌ Insufficient permissions. User ${currentUserId} with role ${userRole} trying to reject email change`);
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
    } catch (error) {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    console.log('📋 Validating rejection request...');
    
    // Validate request data
    const validation = EmailChangeValidation.validateRejectRequest(rejectRequest as unknown as Record<string, unknown>);
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

    // Check if request is in correct status for rejection
    const rejectableStatuses = ['pending_verification', 'pending_approval'];
    if (!rejectableStatuses.includes(emailChangeRequest.status)) {
      console.log('❌ Request not in rejectable status:', emailChangeRequest.status);
      return createErrorResponse(400, EmailChangeErrorCodes.REQUEST_NOT_PENDING_APPROVAL, `Cannot reject request with status: ${emailChangeRequest.status}`);
    }

    // Check if admin is trying to reject their own request
    if (emailChangeRequest.userId === currentUserId) {
      console.log('❌ Admin trying to reject their own request');
      return createErrorResponse(400, EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST, 'You cannot reject your own email change request');
    }

    // Extract IP address and user agent for audit trail
    const ipAddress = event.requestContext.identity?.sourceIp;
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];

    console.log('❌ Rejecting email change request...');

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

    if (!requestUser) {
      console.error('❌ Request user not found:', emailChangeRequest.userId);
    }

    if (!rejecterUser) {
      console.error('❌ Rejecter user not found:', currentUserId);
    }

    // Send rejection notification to the user
    if (requestUser) {
      try {
        await emailService.sendRejectionNotification(rejectedRequest, requestUser.name);
      } catch (emailError) {
        console.error('❌ Failed to send rejection notification:', emailError);
        // Don't fail the request if email sending fails
      }
    }

    console.log('✅ Email change request rejected successfully');

    const response: RejectRequestResponse = {
      success: true,
      data: {
        requestId: rejectedRequest.id,
        status: 'rejected',
        rejectedAt: rejectedRequest.rejectedAt!,
        rejectedBy: {
          id: currentUserId,
          name: rejecterUser?.name || 'Unknown Admin'
        },
        rejectionReason: rejectRequest.rejectionReason
      },
      message: 'Email change request rejected successfully'
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
    console.error('❌ Error rejecting email change request:', error);

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

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred while rejecting the email change request');
  }
}; 