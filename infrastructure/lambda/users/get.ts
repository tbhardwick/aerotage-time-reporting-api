import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { UserRepository } from '../shared/user-repository';
import { User } from '../shared/types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'User ID is required');
    }

    // Authorization check: users can only get their own data unless they're admin/manager
    if (userId !== currentUserId && userRole !== 'admin' && userRole !== 'manager') {
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You can only access your own user data');
    }

    const userRepository = new UserRepository();

    // Get user from the database
    const targetUser = await userRepository.getUserById(userId);

    if (!targetUser) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Filter sensitive information based on role and ownership
    let filteredUser: any = targetUser;
    
    if (userRole === 'employee' && userId === currentUserId) {
      // Employees can see their own full data
      filteredUser = targetUser;
    } else if (userRole === 'manager') {
      // Managers can see basic information
      filteredUser = {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        department: targetUser.department,
        jobTitle: targetUser.jobTitle,
        isActive: targetUser.isActive,
        startDate: targetUser.startDate,
        createdAt: targetUser.createdAt,
        preferences: targetUser.preferences,
      };
    } else if (userRole === 'admin') {
      // Admins can see everything
      filteredUser = targetUser;
    }

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse({ user: filteredUser }, 200, 'User retrieved successfully');
  } catch (error) {
    console.error('Error getting user:', error);
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
