import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  InvitationFilters, 
  PaginationResponse, 
  ErrorResponse, 
  InvitationErrorCodes,
  UserInvitation
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { InvitationRepository } from '../shared/invitation-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('List user invitations request:', JSON.stringify(event, null, 2));

  try {
    // Get current user from Cognito token
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, InvitationErrorCodes.INSUFFICIENT_PERMISSIONS, 'User authentication required');
    }

    // TODO: Check if user has admin permissions
    // For now, we'll allow all authenticated users to list invitations

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const filters: InvitationFilters = {
      status: queryParams.status as any,
      limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
      sortBy: queryParams.sortBy as any,
      sortOrder: queryParams.sortOrder as any,
    };

    // Validate filters
    const validation = ValidationService.validateInvitationFilters(filters);
    if (!validation.isValid) {
      return createErrorResponse(400, InvitationErrorCodes.INVALID_EMAIL, validation.errors.join(', '));
    }

    const repository = new InvitationRepository();

    // Get invitations with pagination
    const result = await repository.listInvitations(filters);

    // Remove sensitive data from response
    const sanitizedInvitations = result.invitations.map(invitation => ({
      ...invitation,
      invitationToken: '', // Don't return the actual token
      tokenHash: '', // Don't return the token hash
    }));

    const response: PaginationResponse<UserInvitation> = {
      success: true,
      data: {
        items: sanitizedInvitations,
        pagination: {
          total: result.total,
          limit: filters.limit || 50,
          offset: filters.offset || 0,
          hasMore: result.hasMore,
        },
      },
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
    console.error('Error listing user invitations:', error);
    
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