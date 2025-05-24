import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  SuccessResponse, 
  ErrorResponse, 
  InvitationErrorCodes
} from '../shared/types';
import { InvitationRepository } from '../shared/invitation-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Cancel user invitation request:', JSON.stringify(event, null, 2));

  try {
    // Get invitation ID from path parameters
    const invitationId = event.pathParameters?.id;
    if (!invitationId) {
      return createErrorResponse(400, InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation ID is required');
    }

    // Get current user from Cognito token
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, InvitationErrorCodes.INSUFFICIENT_PERMISSIONS, 'User authentication required');
    }

    // TODO: Check if user has admin permissions
    // For now, we'll allow all authenticated users to cancel invitations

    const repository = new InvitationRepository();

    // Get existing invitation
    const invitation = await repository.getInvitationById(invitationId);
    if (!invitation) {
      return createErrorResponse(404, InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation not found');
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return createErrorResponse(400, InvitationErrorCodes.INVITATION_ALREADY_ACCEPTED, 'Invitation is no longer pending');
    }

    // Update invitation status to cancelled
    await repository.updateInvitation(invitationId, {
      status: 'cancelled',
    });

    const response: SuccessResponse<void> = {
      success: true,
      data: undefined,
      message: 'Invitation cancelled successfully',
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
    console.error('Error cancelling user invitation:', error);
    
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
 * Extracts current user ID from Cognito JWT token
 */
function getCurrentUserId(event: APIGatewayProxyEvent): string | null {
  const cognitoIdentity = event.requestContext.authorizer?.claims;
  if (cognitoIdentity && cognitoIdentity.sub) {
    return cognitoIdentity.sub;
  }

  // Fallback: try to get from custom authorizer
  if (event.requestContext.authorizer?.userId) {
    return event.requestContext.authorizer.userId;
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