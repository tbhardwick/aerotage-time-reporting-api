import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UserRepository } from '../shared/user-repository';
import { SuccessResponse, ErrorResponse, User } from '../shared/types';

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
    console.log('Update user request:', JSON.stringify(event, null, 2));

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

    // Get authenticated user from context
    const authContext = event.requestContext.authorizer;
    const authenticatedUserId = authContext?.userId;
    const userRole = authContext?.role || 'employee';

    // Authorization check: users can only update their own basic data unless they're admin
    if (userId !== authenticatedUserId && userRole !== 'admin') {
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You can only update your own user data');
    }

    // Role-based field restrictions
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
    } else if (userId === authenticatedUserId) {
      // Users can update their own basic information
      if (updateData.name !== undefined) allowedUpdates.name = updateData.name;
      if (updateData.preferences !== undefined) allowedUpdates.preferences = updateData.preferences;
      if (updateData.contactInfo !== undefined) allowedUpdates.contactInfo = updateData.contactInfo;
      
      // Users cannot update their own role, permissions, or hourly rate
      if (updateData.role !== undefined || updateData.permissions !== undefined || updateData.hourlyRate !== undefined) {
        return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You cannot update role, permissions, or hourly rate');
      }
    }

    // Validate that there are updates to make
    if (Object.keys(allowedUpdates).length === 0) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'No valid updates provided');
    }

    const userRepository = new UserRepository();

    // Check if user exists
    const existingUser = await userRepository.getUserById(userId);
    if (!existingUser) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Update user
    const updatedUser = await userRepository.updateUser(userId, allowedUpdates);

    const response: SuccessResponse<{ user: User }> = {
      success: true,
      data: {
        user: updatedUser,
      },
      message: 'User updated successfully',
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
    console.error('Error updating user:', error);
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Failed to update user');
  }
};

function createErrorResponse(statusCode: number, code: string, message: string): APIGatewayProxyResult {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code,
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
