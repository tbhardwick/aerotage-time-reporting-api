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

    const userRepository = new UserRepository();

    // Get user from the database
    const targetUser = await userRepository.getUserById(userId);

    if (!targetUser) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Apply access control and data filtering
    const accessControl = applyAccessControl(targetUser, currentUserId, userRole);
    if (!accessControl.canAccess) {
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', accessControl.reason || 'You do not have permission to access this user data');
    }

    return createSuccessResponse(accessControl.filteredData);

  } catch (error) {
    console.error('Error getting user:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to get user data');
  }
};

function applyAccessControl(
  user: User,
  currentUserId: string,
  userRole: string
): { canAccess: boolean; reason?: string; filteredData?: Record<string, unknown> } {
  // Check access permissions
  if (user.id === currentUserId) {
    // Users can always access their own data
    return {
      canAccess: true,
      filteredData: filterUserData(user, userRole),
    };
  }

  if (userRole === 'admin' || userRole === 'manager') {
    // Admins and managers can access all user data
    return {
      canAccess: true,
      filteredData: filterUserData(user, userRole),
    };
  }

  return {
    canAccess: false,
    reason: 'You can only access your own user data',
  };
}

function filterUserData(user: User, userRole: string): Record<string, unknown> {
  // Base fields that all roles can see
  const filteredData: Record<string, unknown> = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    jobTitle: user.jobTitle,
    isActive: user.isActive,
    startDate: user.startDate,
    createdAt: user.createdAt,
    preferences: user.preferences,
  };

  // Add additional fields for admin users
  if (userRole === 'admin') {
    filteredData.hourlyRate = user.hourlyRate;
    filteredData.permissions = user.permissions;
    filteredData.contactInfo = user.contactInfo;
    filteredData.updatedAt = user.updatedAt;
  }

  return filteredData;
}
