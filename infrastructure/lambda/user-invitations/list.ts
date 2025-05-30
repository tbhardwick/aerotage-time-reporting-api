import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { 
  InvitationFilters, 
  PaginationResponse, 
  InvitationErrorCodes,
  UserInvitation
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { InvitationRepository } from '../shared/invitation-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Role-based access control - only managers and admins can list invitations
    if (userRole === 'employee') {
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to list invitations');
    }
    // Managers and admins can list invitations

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
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
}; 