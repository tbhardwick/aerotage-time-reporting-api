import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { UserRepository } from '../shared/user-repository';
import { SuccessResponse, User } from '../shared/types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Authorization check: only admins and managers can list users
    if (userRole !== 'admin' && userRole !== 'manager') {
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to list users');
    }

    const userRepository = new UserRepository();

    // Get all users from the database
    const users = await userRepository.getAllUsers();

    // Filter sensitive information based on role
    const filteredUsers = users.map((user: User) => {
      // Admins can see everything, managers can see basic info
      if (userRole === 'admin') {
        return user;
      } else {
        // Managers see limited information
        return {
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
      }
    });

    const response: SuccessResponse<{ users: any[] }> = {
      success: true,
      data: {
        users: filteredUsers,
      },
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error listing users:', error);
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
}; 