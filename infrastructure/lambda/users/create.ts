import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { UserRepository } from '../shared/user-repository';
import { 
  CreateUserRequest, 
  UserErrorCodes
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { InvitationRepository } from '../shared/invitation-repository';

const userRepo = new UserRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Check if user has permission to create users (admin only)
    if (userRole !== 'admin') {
      return createErrorResponse(403, UserErrorCodes.INSUFFICIENT_PERMISSIONS, 'Only admins can create users');
    }

    // Parse and validate request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let createUserRequest: CreateUserRequest;
    try {
      createUserRequest = JSON.parse(event.body);
    } catch {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }
    
    // Validate request data
    const validation = ValidationService.validateCreateUserRequest(createUserRequest as unknown as Record<string, unknown>);
    if (!validation.isValid) {
      return createErrorResponse(400, UserErrorCodes.INVALID_USER_DATA, 'Validation failed');
    }

    // Check if user already exists
    const existingUser = await userRepo.getUserByEmail(createUserRequest.email);
    if (existingUser) {
      return createErrorResponse(409, UserErrorCodes.USER_ALREADY_EXISTS, 'User with this email already exists');
    }

    // Check if there's a pending invitation for this email
    const invitationRepo = new InvitationRepository();
    const hasPendingInvitation = await invitationRepo.checkEmailExists(createUserRequest.email);
    if (hasPendingInvitation) {
      return createErrorResponse(409, UserErrorCodes.USER_ALREADY_EXISTS, 'Email address has a pending invitation. Please accept the invitation or cancel it before creating a user directly.');
    }

    // Create the user
    const newUser = await userRepo.createUser({
      email: createUserRequest.email,
      name: createUserRequest.name,
      role: createUserRequest.role || 'employee',
      department: createUserRequest.department,
      jobTitle: createUserRequest.jobTitle,
      hourlyRate: createUserRequest.hourlyRate,
      permissions: createUserRequest.permissions || { features: [], projects: [] },
      preferences: {
        theme: 'light',
        notifications: true,
        timezone: 'UTC'
      },
      contactInfo: createUserRequest.contactInfo,
      invitedBy: currentUserId
    });

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(newUser, 201, 'User created successfully');

  } catch (error) {
    console.error('Create user error:', error);
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
}; 