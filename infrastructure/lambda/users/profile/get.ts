import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../../shared/response-helper';
import { UserRepository } from '../../shared/user-repository';
import { UserProfile } from '../../shared/types';

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
    const requestedUserId = event.pathParameters?.id;
    if (!requestedUserId) {
      return createErrorResponse(400, 'MISSING_PARAMETER', 'User ID is required');
    }

    // Authorization check: users can only access their own profile unless they're admin
    if (requestedUserId !== currentUserId && userRole !== 'admin') {
      return createErrorResponse(403, 'FORBIDDEN', 'You can only access your own profile');
    }

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const userRepo = new UserRepository();
    const userProfile = await userRepo.getUserById(requestedUserId);

    if (!userProfile) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User profile not found');
    }

    // Transform to UserProfile format (remove sensitive fields)
    const profile: UserProfile = {
      id: userProfile.id,
      email: userProfile.email,
      name: userProfile.name,
      jobTitle: userProfile.jobTitle,
      department: userProfile.department,
      hourlyRate: userProfile.hourlyRate,
      role: userProfile.role as 'employee' | 'admin' | 'manager',
      contactInfo: userProfile.contactInfo,
      startDate: userProfile.startDate,
      isActive: userProfile.isActive,
      createdAt: userProfile.createdAt,
      updatedAt: userProfile.updatedAt,
    };

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(profile, 200, 'User profile retrieved successfully');

  } catch (error) {
    console.error('Function error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
  }
}; 