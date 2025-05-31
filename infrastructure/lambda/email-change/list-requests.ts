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
    console.log('📋 List Email Change Requests - Request received:', {
      httpMethod: event.httpMethod,
      path: event.path,
      queryStringParameters: event.queryStringParameters
    });

    // Extract user information from authorization context
    const authContext = event.requestContext.authorizer;
    const currentUserId = getCurrentUserId(event);
    const userRole = authContext?.role || authContext?.claims?.['custom:role'];

    if (!currentUserId) {
      console.log('❌ No user ID found in authorization context');
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const {
      userId: filterUserId,
      status,
      limit = '20',
      lastEvaluatedKey,
      includeCompleted = 'false',
      sortBy,
      sortOrder
    } = queryParams;

    // Determine which user's requests to retrieve
    let targetUserId: string | undefined;

    if (filterUserId) {
      // Admin can view any user's requests, regular users can only view their own
      if (userRole !== 'admin' && filterUserId !== currentUserId) {
        console.log(`❌ Insufficient permissions. User ${currentUserId} trying to view requests for ${filterUserId}`);
        return createErrorResponse(403, EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS, 'You can only view your own email change requests');
      }
      targetUserId = filterUserId;
    } else if (userRole !== 'admin') {
      // Regular users can only see their own requests
      targetUserId = currentUserId;
    }
    // Admin with no userId filter can see all requests (targetUserId remains undefined)

    // Validate limit parameter
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Limit must be between 1 and 100');
    }

    // Validate status parameter
    const validStatuses = ['pending_verification', 'pending_approval', 'approved', 'rejected', 'cancelled', 'completed'];
    if (status && !validStatuses.includes(status)) {
      return createErrorResponse(400, 'INVALID_REQUEST', `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate sortBy parameter
    const validSortFields = ['requestedAt', 'status', 'currentEmail', 'newEmail'];
    if (sortBy && !validSortFields.includes(sortBy)) {
      return createErrorResponse(400, 'INVALID_REQUEST', `Invalid sortBy field. Must be one of: ${validSortFields.join(', ')}`);
    }

    // Validate sortOrder parameter
    const validSortOrders = ['asc', 'desc'];
    if (sortOrder && !validSortOrders.includes(sortOrder)) {
      return createErrorResponse(400, 'INVALID_REQUEST', `Invalid sortOrder. Must be one of: ${validSortOrders.join(', ')}`);
    }

    console.log('🔍 Retrieving email change requests...', {
      targetUserId,
      status,
      limit: limitNum,
      includeCompleted: includeCompleted === 'true',
      sortBy,
      sortOrder
    });

    // Get email change requests
    const result = await emailChangeRepo.listEmailChangeRequests({
      userId: targetUserId,
      status,
      limit: limitNum,
      lastEvaluatedKey,
      includeCompleted: includeCompleted === 'true',
      sortBy,
      sortOrder
    });

    // If admin is viewing all requests, enrich with user information
    let enrichedRequests = result.requests;
    if (!targetUserId && userRole === 'admin') {
      console.log('🔍 Enriching requests with user information for admin view...');
      
      // Get unique user IDs
      const userIds = [...new Set(result.requests.map(req => req.userId))];
      
      // Get user information
      const users = await Promise.all(
        userIds.map(async (userId) => {
          try {
            const user = await userRepo.getUserById(userId);
            return user ? { id: userId, name: user.name, email: user.email } : null;
          } catch (error) {
            console.error(`❌ Failed to get user ${userId}:`, error);
            return null;
          }
        })
      );

      const userMap = new Map(
        users.filter(user => user !== null).map(user => [user!.id, user!])
      );

      // Enrich requests with user information
      enrichedRequests = result.requests.map(request => ({
        ...request,
        userName: userMap.get(request.userId)?.name || 'Unknown User',
        userCurrentEmail: userMap.get(request.userId)?.email || request.currentEmail
      }));
    }

    console.log(`✅ Retrieved ${enrichedRequests.length} email change requests`);

    const responseData: Record<string, unknown> = {
      requests: enrichedRequests,
      pagination: {
        total: enrichedRequests.length, // Note: This is the current page count, not total across all pages
        limit: limitNum,
        offset: 0, // Not used with cursor-based pagination
        hasMore: !!result.lastEvaluatedKey
      }
    };

    // Add lastEvaluatedKey to response for cursor-based pagination
    if (result.lastEvaluatedKey) {
      responseData.lastEvaluatedKey = result.lastEvaluatedKey;
    }

    return createSuccessResponse(responseData);

  } catch (error) {
    console.error('❌ Error listing email change requests:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred while retrieving email change requests');
  }
}; 