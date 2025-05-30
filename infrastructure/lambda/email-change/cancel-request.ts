import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { UserRepository } from '../shared/user-repository';
import { EmailChangeErrorCodes } from '../shared/types';
import { getCurrentUserId } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';

const emailChangeRepo = new EmailChangeRepository();
const userRepo = new UserRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('❌ Cancel Email Change Request - Request received:', {
      httpMethod: event.httpMethod,
      path: event.path,
      pathParameters: event.pathParameters
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

    console.log('🔍 Getting email change request...', { requestId });

    // Get the email change request
    const emailChangeRequest = await emailChangeRepo.getEmailChangeRequestById(requestId);
    if (!emailChangeRequest) {
      console.log('❌ Email change request not found:', requestId);
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    // Check permissions - users can only cancel their own requests, admins can cancel any
    if (emailChangeRequest.userId !== currentUserId && userRole !== 'admin') {
      console.log(`❌ Insufficient permissions. User ${currentUserId} trying to cancel request for ${emailChangeRequest.userId}`);
      return createErrorResponse(403, EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'You can only cancel your own email change requests');
    }

    // Check if request can be cancelled
    const cancellableStatuses = ['pending_verification', 'pending_approval'];
    if (!cancellableStatuses.includes(emailChangeRequest.status)) {
      console.log('❌ Request cannot be cancelled. Current status:', emailChangeRequest.status);
      
      if (emailChangeRequest.status === 'completed') {
        return createErrorResponse(400, EmailChangeErrorCodes.REQUEST_ALREADY_COMPLETED, 'Cannot cancel a completed email change request');
      }
      
      return createErrorResponse(400, EmailChangeErrorCodes.CANNOT_CANCEL_REQUEST, `Cannot cancel request with status: ${emailChangeRequest.status}`);
    }

    // Extract IP address and user agent for audit trail
    const ipAddress = event.requestContext.identity?.sourceIp;
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];

    console.log('❌ Cancelling email change request...');

    // Cancel the request
    const cancelledRequest = await emailChangeRepo.cancelEmailChangeRequest(
      requestId,
      currentUserId,
      ipAddress,
      userAgent
    );

    // Get user information for response
    const user = await userRepo.getUserById(currentUserId);
    let userName = 'Unknown User';
    if (user) {
      userName = user.name || 'Unknown User';
    }

    console.log('✅ Email change request cancelled successfully');

    const responseData = {
      requestId: cancelledRequest.id,
      status: 'cancelled',
      cancelledAt: cancelledRequest.cancelledAt!,
      cancelledBy: currentUserId,
      cancelledByName: userName
    };

    return createSuccessResponse(responseData, 200, 'Email change request cancelled successfully');

  } catch (error) {
    console.error('❌ Error cancelling email change request:', error);

    // Handle specific errors
    if ((error as Error).message === EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND) {
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    if ((error as Error).message === EmailChangeErrorCodes.CANNOT_CANCEL_REQUEST) {
      return createErrorResponse(400, EmailChangeErrorCodes.CANNOT_CANCEL_REQUEST, 'Cannot cancel this email change request');
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred while cancelling the email change request');
  }
}; 