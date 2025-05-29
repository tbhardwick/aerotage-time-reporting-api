import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { UserRepository } from '../shared/user-repository';
import { EmailChangeService } from '../shared/email-change-service';
import { createErrorResponse } from '../shared/response-helper';
import { getAuthenticatedUser } from '../shared/auth-helper';
import { EmailChangeErrorCodes, ProcessEmailChangeRequest, ProcessEmailChangeResponse } from '../shared/types';

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const emailChangeRepo = new EmailChangeRepository();
const userRepo = new UserRepository();
const emailService = new EmailChangeService();

/**
 * Process approved email change requests
 * This function actually changes the email in Cognito and updates user profiles
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('🔄 Processing email change request...');

    // Extract user information from JWT token
    const authenticatedUser = getAuthenticatedUser(event);
    
    if (!authenticatedUser) {
      console.log('❌ User authentication required');
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const { userId: currentUserId, email: currentUserEmail, role: userRole } = authenticatedUser;

    // Only admins can process email changes
    if (userRole !== 'admin') {
      console.log('❌ Insufficient permissions for email change processing');
      return createErrorResponse(403, EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'Only administrators can process email changes');
    }

    // Get request ID from path parameters
    const requestId = event.pathParameters?.id;
    if (!requestId) {
      console.log('❌ Request ID is required');
      return createErrorResponse(400, EmailChangeErrorCodes.INVALID_REQUEST_DATA, 'Request ID is required');
    }

    // Parse request body
    let processRequest: ProcessEmailChangeRequest;
    try {
      processRequest = JSON.parse(event.body || '{}');
    } catch (error) {
      console.log('❌ Invalid JSON in request body');
      return createErrorResponse(400, EmailChangeErrorCodes.INVALID_REQUEST_DATA, 'Invalid JSON in request body');
    }

    console.log('🔍 Getting email change request...', { requestId });

    // Get the email change request
    const emailChangeRequest = await emailChangeRepo.getEmailChangeRequestById(requestId);
    if (!emailChangeRequest) {
      console.log('❌ Email change request not found:', requestId);
      return createErrorResponse(404, EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND, 'Email change request not found');
    }

    // Check if request is in correct status for processing
    if (emailChangeRequest.status !== 'approved') {
      console.log('❌ Request not in approved status:', emailChangeRequest.status);
      return createErrorResponse(400, EmailChangeErrorCodes.REQUEST_NOT_APPROVED, `Cannot process request with status: ${emailChangeRequest.status}`);
    }

    // Get the user whose email is being changed
    const targetUser = await userRepo.getUserById(emailChangeRequest.userId);
    if (!targetUser) {
      console.log('❌ Target user not found:', emailChangeRequest.userId);
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    console.log('🔄 Starting email change processing...', {
      userId: targetUser.id,
      currentEmail: emailChangeRequest.currentEmail,
      newEmail: emailChangeRequest.newEmail
    });

    // Extract IP address and user agent for audit trail
    const ipAddress = event.requestContext.identity?.sourceIp;
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];

    try {
      // Step 1: Update email in Cognito User Pool
      console.log('📧 Updating email in Cognito User Pool...');
      
      // First, verify the user exists in Cognito
      try {
        await cognitoClient.send(new AdminGetUserCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID!,
          Username: emailChangeRequest.currentEmail
        }));
      } catch (cognitoError: any) {
        console.error('❌ User not found in Cognito:', cognitoError);
        return createErrorResponse(404, 'COGNITO_USER_NOT_FOUND', 'User not found in Cognito User Pool');
      }

      // Update the email attribute in Cognito
      await cognitoClient.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: emailChangeRequest.currentEmail,
        UserAttributes: [
          {
            Name: 'email',
            Value: emailChangeRequest.newEmail
          },
          {
            Name: 'email_verified',
            Value: 'true'
          }
        ]
      }));

      console.log('✅ Email updated in Cognito User Pool');

      // Step 2: Update email in user profile
      console.log('👤 Updating email in user profile...');
      await userRepo.updateUser(targetUser.id, {
        email: emailChangeRequest.newEmail
      });

      console.log('✅ Email updated in user profile');

      // Step 3: Complete the email change request
      console.log('✅ Completing email change request...');
      const completedRequest = await emailChangeRepo.completeEmailChangeRequest(
        requestId,
        currentUserId,
        ipAddress,
        userAgent
      );

      console.log('✅ Email change request completed successfully');

      // Step 4: Send completion notification
      console.log('📨 Sending completion notification...');
      try {
        await emailService.sendCompletionNotification(completedRequest, targetUser.name);
        console.log('✅ Completion notification sent');
      } catch (emailError) {
        console.error('❌ Failed to send completion notification:', emailError);
        // Don't fail the request if email sending fails
      }

      // Prepare response
      const response: ProcessEmailChangeResponse = {
        success: true,
        data: {
          requestId: completedRequest.id,
          status: 'completed',
          oldEmail: emailChangeRequest.currentEmail,
          newEmail: emailChangeRequest.newEmail,
          completedAt: completedRequest.completedAt!,
          processedBy: {
            id: currentUserId,
            name: currentUserEmail
          }
        },
        message: 'Email change processed successfully'
      };

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(response),
      };

    } catch (processingError: any) {
      console.error('❌ Error during email change processing:', processingError);

      // If Cognito update fails, we should not complete the request
      if (processingError.name === 'UserNotFoundException') {
        return createErrorResponse(404, 'COGNITO_USER_NOT_FOUND', 'User not found in Cognito User Pool');
      }

      if (processingError.name === 'InvalidParameterException') {
        return createErrorResponse(400, 'INVALID_EMAIL_FORMAT', 'Invalid email format for Cognito update');
      }

      // For other errors, return a generic processing error
      return createErrorResponse(500, 'EMAIL_PROCESSING_FAILED', 'Failed to process email change. Please try again later.');
    }

  } catch (error) {
    console.error('❌ Error processing email change:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred while processing the email change');
  }
}; 