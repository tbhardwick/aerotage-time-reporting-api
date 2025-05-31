import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { UserRepository } from '../shared/user-repository';
import { User } from '../shared/types';

interface UpdateUserRequest {
  name?: string;
  role?: 'admin' | 'manager' | 'employee';
  department?: string;
  jobTitle?: string;
  hourlyRate?: number;
  isActive?: boolean;
  permissions?: {
    features: string[];
    projects: string[];
  };
  preferences?: {
    theme: 'light' | 'dark';
    notifications: boolean;
    timezone: string;
  };
  contactInfo?: {
    phone?: string;
    address?: string;
    emergencyContact?: string;
  };
}

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

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    const updateData: UpdateUserRequest = JSON.parse(event.body);

    // Apply access control and get allowed updates
    const accessControl = applyAccessControl(updateData, userId, currentUserId, userRole);
    if (!accessControl.canAccess) {
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', accessControl.reason || 'You do not have permission to update this user');
    }

    // Validate that there are updates to make
    if (Object.keys(accessControl.allowedUpdates).length === 0) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'No valid updates provided');
    }

    const userRepository = new UserRepository();

    // Check if user exists
    const existingUser = await userRepository.getUserById(userId);
    if (!existingUser) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Update user with allowed fields
    const updatedUser = await userRepository.updateUser(userId, accessControl.allowedUpdates);

    return createSuccessResponse(updatedUser);

  } catch (error) {
    console.error('Error updating user:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to update user');
  }
};

function applyAccessControl(
  updateData: UpdateUserRequest,
  targetUserId: string,
  currentUserId: string,
  userRole: string
): { canAccess: boolean; reason?: string; allowedUpdates: Partial<User> } {
  // Check basic access permissions
  if (targetUserId !== currentUserId && userRole !== 'admin') {
    return {
      canAccess: false,
      reason: 'You can only update your own user data',
      allowedUpdates: {},
    };
  }

  const allowedUpdates: Partial<User> = {};

  if (userRole === 'admin') {
    // Admins can update everything
    if (updateData.name !== undefined) allowedUpdates.name = updateData.name;
    if (updateData.role !== undefined) allowedUpdates.role = updateData.role;
    if (updateData.department !== undefined) allowedUpdates.department = updateData.department;
    if (updateData.jobTitle !== undefined) allowedUpdates.jobTitle = updateData.jobTitle;
    if (updateData.hourlyRate !== undefined) allowedUpdates.hourlyRate = updateData.hourlyRate;
    if (updateData.isActive !== undefined) allowedUpdates.isActive = updateData.isActive;
    if (updateData.permissions !== undefined) allowedUpdates.permissions = updateData.permissions;
    if (updateData.preferences !== undefined) allowedUpdates.preferences = updateData.preferences;
    if (updateData.contactInfo !== undefined) allowedUpdates.contactInfo = updateData.contactInfo;
  } else if (targetUserId === currentUserId) {
    // Users can update their own basic information
    if (updateData.name !== undefined) allowedUpdates.name = updateData.name;
    if (updateData.preferences !== undefined) allowedUpdates.preferences = updateData.preferences;
    if (updateData.contactInfo !== undefined) allowedUpdates.contactInfo = updateData.contactInfo;

    // Check for restricted fields
    if (updateData.role !== undefined || updateData.permissions !== undefined || updateData.hourlyRate !== undefined) {
      return {
        canAccess: false,
        reason: 'You cannot update role, permissions, or hourly rate',
        allowedUpdates: {},
      };
    }
  }

  return {
    canAccess: true,
    allowedUpdates,
  };
}
