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

    // Check access permissions
    const accessControl = applyAccessControl(userRole);
    if (!accessControl.canAccess) {
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', accessControl.reason || 'You do not have permission to list users');
    }

    const userRepository = new UserRepository();

    // Get all users from the database
    const users = await userRepository.getAllUsers();

    // Filter sensitive information based on role
    const filteredUsers = users.map(user => filterUserData(user, userRole));

    return createSuccessResponse({ users: filteredUsers }, 200, 'Users retrieved successfully');

  } catch (error) {
    console.error('Error listing users:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to list users');
  }
};

function applyAccessControl(userRole: string): { canAccess: boolean; reason?: string } {
  if (userRole === 'admin' || userRole === 'manager') {
    return { canAccess: true };
  }

  return {
    canAccess: false,
    reason: 'Only managers and admins can list users',
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
  };

  // Add additional fields for admin users
  if (userRole === 'admin') {
    filteredData.hourlyRate = user.hourlyRate;
    filteredData.permissions = user.permissions;
    filteredData.contactInfo = user.contactInfo;
    filteredData.updatedAt = user.updatedAt;
    filteredData.preferences = user.preferences;
  }

  return filteredData;
} 