import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UserRepository } from '../shared/user-repository';
import { SuccessResponse, ErrorResponse, User } from '../shared/types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('List users request:', JSON.stringify(event, null, 2));

    // Get authenticated user from context
    const authContext = event.requestContext.authorizer;
    const authenticatedUserId = authContext?.userId;
    const userRole = authContext?.role || 'employee';

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
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Failed to list users');
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