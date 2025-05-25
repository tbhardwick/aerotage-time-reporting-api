import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { 
  UpdateUserProfileRequest, 
  UserProfile, 
  SuccessResponse, 
  ErrorResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Update user profile request:', JSON.stringify(event, null, 2));

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required');
    }

    const updateData: UpdateUserProfileRequest = JSON.parse(event.body);

    // Get authenticated user from context
    const authContext = event.requestContext.authorizer;
    const authenticatedUserId = authContext?.userId;
    const userRole = authContext?.role || 'employee';

    // Authorization check: users can only update their own profile unless they're admin
    if (userId !== authenticatedUserId && userRole !== 'admin') {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only update your own profile'
      );
    }

    // Validate input data
    const validationError = validateUpdateRequest(updateData);
    if (validationError) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validationError);
    }

    // Check if hourly rate change requires admin approval
    if (updateData.hourlyRate !== undefined && userRole !== 'admin' && userId === authenticatedUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'Hourly rate changes require admin approval'
      );
    }

    // Get current user profile (if it exists)
    const getCommand = new GetCommand({
      TableName: process.env.USERS_TABLE!,
      Key: { id: userId },
    });

    const currentResult = await docClient.send(getCommand);
    const currentUser = currentResult.Item;

    // Create default profile data from JWT token for new profiles
    const currentTimestamp = new Date().toISOString();
    const defaultProfile = {
      id: userId,
      email: authContext?.email || '',
      name: authContext?.email?.split('@')[0] || '',
      role: userRole,
      isActive: true,
      startDate: currentTimestamp.split('T')[0], // ISO date format
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,
      // Optional fields default to undefined
      jobTitle: undefined,
      department: undefined,
      hourlyRate: undefined,
      contactInfo: undefined,
      profilePicture: undefined,
      lastLogin: undefined,
      teamId: undefined,
    };

    // Merge current profile (if exists) with default values and updates
    const profileData = {
      ...defaultProfile,
      ...(currentUser || {}), // Existing profile data takes precedence over defaults
      ...updateData, // Updates take precedence over everything
      updatedAt: currentTimestamp, // Always update timestamp
      // Preserve creation timestamp if profile already exists
      createdAt: currentUser?.createdAt || currentTimestamp,
    };

    // Ensure required fields are present
    if (!profileData.email) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Email is required but not found in token');
    }

    if (!profileData.name) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Name is required but not found in token or update data');
    }

    // Save profile (create or update)
    const putCommand = new PutCommand({
      TableName: process.env.USERS_TABLE!,
      Item: profileData,
    });

    await docClient.send(putCommand);

    // Transform saved data to UserProfile response format
    const updatedUser = profileData;
    const profile: UserProfile = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      jobTitle: updatedUser.jobTitle,
      department: updatedUser.department,
      hourlyRate: updatedUser.hourlyRate,
      role: updatedUser.role,
      contactInfo: updatedUser.contactInfo,
      profilePicture: updatedUser.profilePicture,
      startDate: updatedUser.startDate,
      lastLogin: updatedUser.lastLogin,
      isActive: updatedUser.isActive,
      teamId: updatedUser.teamId,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    const response: SuccessResponse<UserProfile> = {
      success: true,
      data: profile,
      message: 'Profile updated successfully',
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
    console.error('Error updating user profile:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
};

function validateUpdateRequest(data: UpdateUserProfileRequest): string | null {
  // Validate name
  if (data.name !== undefined && (!data.name || data.name.trim().length < 2)) {
    return 'Name must be at least 2 characters long';
  }

  // Validate hourly rate
  if (data.hourlyRate !== undefined && (data.hourlyRate < 0 || data.hourlyRate > 1000)) {
    return 'Hourly rate must be between 0 and 1000';
  }

  // Validate contact info
  if (data.contactInfo) {
    if (data.contactInfo.phone && !/^\+?[\d\s\-\(\)]+$/.test(data.contactInfo.phone)) {
      return 'Invalid phone number format';
    }
  }

  return null;
}

function createErrorResponse(
  statusCode: number, 
  errorCode: ProfileSettingsErrorCodes | string, 
  message: string
): APIGatewayProxyResult {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: errorCode,
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