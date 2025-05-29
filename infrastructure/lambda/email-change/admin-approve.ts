import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { EmailChangeService } from '../shared/email-change-service';
import { EmailChangeValidation } from '../shared/email-change-validation';
import { UserRepository } from '../shared/user-repository';
import { 
  ApproveEmailChangeRequest,
  ApproveRequestResponse,
  EmailChangeErrorCodes
} from '../shared/types';
import { getCurrentUserId } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';

const emailChangeRepo = new EmailChangeRepository();
const emailService = new EmailChangeService();
const userRepo = new UserRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('✅ Admin Approve Email Change - Request received:', {
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
      console.log(`❌ Insufficient permissions. User ${currentUserId} with role ${userRole} trying to approve email change`);
      return createErrorResponse(403, EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'Only administrators can approve email change requests');
    }

    // Get request ID from path parameters
    const requestId = event.pathParameters?.id;
    if (!requestId) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request ID is required');
    }

    // Parse and validate request body
    let approveRequest: ApproveEmailChangeRequest = {};
    if (event.body) {
      try {
        approveRequest = JSON.parse(event.body);
      } catch (error) {
        return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
      }
    }

    console.log('📋 Validating approval request...');
    
    // Validate request data
    const validation = EmailChangeValidation.validateApproveRequest(approveRequest as unknown as Record<string, unknown>);
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

    // Check if request is in correct status for approval
    if (emailChangeRequest.status !== 'pending_approval') {
      console.log('❌ Request not in pending approval status:', emailChangeRequest.status);
      return createErrorResponse(400, EmailChangeErrorCodes.REQUEST_NOT_PENDING_APPROVAL, `Cannot approve request with status: ${emailChangeRequest.status}`);
    }

    // Check if both emails are verified
    if (!emailChangeRequest.currentEmailVerified || !emailChangeRequest.newEmailVerified) {
      console.log('❌ Both emails must be verified before approval');
      return createErrorResponse(400, EmailChangeErrorCodes.INVALID_REQUEST_DATA, 'Both email addresses must be verified before approval');
    }

    // Business Logic: Only prevent non-admins from approving requests
    // Admins can approve their own requests, but managers/employees cannot approve any requests
    if (emailChangeRequest.userId === currentUserId && userRole !== 'admin') {
      console.log('❌ Non-admin user trying to approve their own request');
      return createErrorResponse(400, EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST, 'Only administrators can approve email change requests');
    }

    // Log approval action for audit trail
    if (emailChangeRequest.userId === currentUserId) {
      console.log('ℹ️ Admin approving their own email change request');
    } else {
      console.log('ℹ️ Admin approving another user\'s email change request');
    }

    // Extract IP address and user agent for audit trail
    const ipAddress = event.requestContext.identity?.sourceIp;
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];

    console.log('✅ Approving email change request...');

    // Approve the request
    const approvedRequest = await emailChangeRepo.approveEmailChangeRequest(
      requestId,
      currentUserId,
      approveRequest.approvalNotes,
      ipAddress,
      userAgent
    );

    // Get user information for notifications
    const requestUser = await userRepo.getUserById(emailChangeRequest.userId);
    const approverUser = await userRepo.getUserById(currentUserId);

    if (!requestUser) {
      console.error('❌ Request user not found:', emailChangeRequest.userId);
    }

    if (!approverUser) {
      console.error('❌ Approver user not found:', currentUserId);
    }

    // Send approval notification to the user
    if (requestUser) {
      try {
        await emailService.sendApprovalNotification(approvedRequest, requestUser.name);
      } catch (emailError) {
        console.error('❌ Failed to send approval notification:', emailError);
        // Don't fail the request if email sending fails
      }
    }

    // Calculate estimated completion time (usually 24-48 hours for email change processing)
    const estimatedCompletionTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    console.log('✅ Email change request approved successfully');

    const response: ApproveRequestResponse = {
      success: true,
      data: {
        requestId: approvedRequest.id,
        status: 'approved',
        approvedAt: approvedRequest.approvedAt!,
        approvedBy: {
          id: currentUserId,
          name: approverUser?.name || 'Unknown Admin'
        },
        estimatedCompletionTime
      },
      message: 'Email change request approved successfully'
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
    console.error('❌ Error approving email change request:', error);

    // Handle specific errors
    if ((error as Error).message === EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND) {
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    if ((error as Error).message === EmailChangeErrorCodes.REQUEST_NOT_PENDING_APPROVAL) {
      return createErrorResponse(400, EmailChangeErrorCodes.REQUEST_NOT_PENDING_APPROVAL, 'Request is not pending approval');
    }

    if ((error as Error).message === EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST) {
      return createErrorResponse(400, EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST, 'You cannot approve your own email change request');
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred while approving the email change request');
  }
}; 