import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UserRepository } from '../shared/user-repository';
import { SuccessResponse, ErrorResponse, User } from '../shared/types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Get user request:', JSON.stringify(event, null, 2));

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'User ID is required');
    }

    // Get authenticated user from context
    const authContext = event.requestContext.authorizer;
    const authenticatedUserId = authContext?.userId;
    const userRole = authContext?.role || 'employee';

    // Authorization check: users can only get their own data unless they're admin/manager
    if (userId !== authenticatedUserId && userRole !== 'admin' && userRole !== 'manager') {
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You can only access your own user data');
    }

    const userRepository = new UserRepository();

    // Get user from the database
    const user = await userRepository.getUserById(userId);

    if (!user) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Filter sensitive information based on role and ownership
    let filteredUser: any = user;
    
    if (userRole === 'employee' && userId === authenticatedUserId) {
      // Employees can see their own full data
      filteredUser = user;
    } else if (userRole === 'manager') {
      // Managers can see basic information
      filteredUser = {
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
    } else if (userRole === 'admin') {
      // Admins can see everything
      filteredUser = user;
    }

    const response: SuccessResponse<{ user: any }> = {
      success: true,
      data: {
        user: filteredUser,
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
    console.error('Error getting user:', error);
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Failed to get user');
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
