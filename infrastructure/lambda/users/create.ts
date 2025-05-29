import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UserRepository } from '../shared/user-repository';
import { 
  CreateUserRequest, 
  User, 
  UserErrorCodes, 
  SuccessResponse, 
  ErrorResponse 
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { getCurrentUserId } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { InvitationRepository } from '../shared/invitation-repository';

const userRepo = new UserRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('📝 Create User Handler - Request received:', {
      httpMethod: event.httpMethod,
      path: event.path,
      body: event.body ? 'Present' : 'None',
      headers: {
        authorization: event.headers.authorization ? 'Bearer [REDACTED]' : 'None',
        'content-type': event.headers['content-type']
      }
    });

    // Extract user information from authorization context
    const authContext = event.requestContext.authorizer;
    const currentUserId = getCurrentUserId(event);
    const userRole = authContext?.role || authContext?.claims?.['custom:role'];

    if (!currentUserId) {
      console.log('❌ No user ID found in authorization context');
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // Check if user has permission to create users (admin only)
    if (userRole !== 'admin') {
      console.log(`❌ Insufficient permissions. User role: ${userRole}`);
      return createErrorResponse(403, UserErrorCodes.INSUFFICIENT_PERMISSIONS, 'Only admins can create users');
    }

    // Parse and validate request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let createUserRequest: CreateUserRequest;
    try {
      createUserRequest = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    console.log('📋 Validating create user request...');
    
    // Validate request data
    const validation = ValidationService.validateCreateUserRequest(createUserRequest as unknown as Record<string, unknown>);
    if (!validation.isValid) {
      console.log('❌ Validation failed:', validation.errors);
      return createErrorResponse(400, UserErrorCodes.INVALID_USER_DATA, 'Validation failed');
    }

    // Check if user already exists
    console.log('🔍 Checking if user already exists...');
    const existingUser = await userRepo.getUserByEmail(createUserRequest.email);
    if (existingUser) {
      console.log('❌ User already exists with email:', createUserRequest.email);
      return createErrorResponse(409, UserErrorCodes.USER_ALREADY_EXISTS, 'User with this email already exists');
    }

    // Check if there's a pending invitation for this email
    console.log('🔍 Checking if email has pending invitation...');
    const invitationRepo = new InvitationRepository();
    const hasPendingInvitation = await invitationRepo.checkEmailExists(createUserRequest.email);
    if (hasPendingInvitation) {
      console.log('❌ Email has pending invitation:', createUserRequest.email);
      return createErrorResponse(409, UserErrorCodes.USER_ALREADY_EXISTS, 'Email address has a pending invitation. Please accept the invitation or cancel it before creating a user directly.');
    }

    // Create the user
    console.log('👤 Creating new user...');
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

    console.log('✅ User created successfully:', newUser.id);

    const response: SuccessResponse<User> = {
      success: true,
      data: newUser,
      message: 'User created successfully'
    };

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('❌ Create user error:', error);
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
}; 