import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../../shared/response-helper';
import { UserRepository } from '../../shared/user-repository';
import { 
  UpdateUserProfileRequest, 
  UserProfile, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

const userRepo = new UserRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = (user?.role as 'employee' | 'admin' | 'manager') || 'employee';

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Authorization check: users can only update their own profile unless they're admin
    if (userId !== currentUserId && userRole !== 'admin') {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only update your own profile'
      );
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required');
    }

    const updateData: UpdateUserProfileRequest = JSON.parse(event.body);

    // Validate input data
    const validationError = validateUpdateRequest(updateData);
    if (validationError) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validationError);
    }

    // Check if hourly rate change requires admin approval
    if (updateData.hourlyRate !== undefined && userRole !== 'admin' && userId === currentUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'Hourly rate changes require admin approval'
      );
    }

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const currentUser = await userRepo.getUserById(userId);

    // Create default profile data from user context for new profiles
    const currentTimestamp = new Date().toISOString();
    const defaultProfile = {
      id: userId,
      email: user?.email || '',
      name: user?.email?.split('@')[0] || '',
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

    // MANDATORY: Use repository pattern for save operation
    await userRepo.updateUser(userId, profileData);

    // Transform saved data to UserProfile response format
    const profile: UserProfile = {
      id: profileData.id,
      email: profileData.email,
      name: profileData.name,
      jobTitle: profileData.jobTitle,
      department: profileData.department,
      hourlyRate: profileData.hourlyRate,
      role: profileData.role as 'employee' | 'admin' | 'manager',
      contactInfo: profileData.contactInfo ? {
        phone: profileData.contactInfo.phone,
        address: profileData.contactInfo.address,
        emergencyContact: profileData.contactInfo.emergencyContact,
      } : undefined,
      profilePicture: profileData.profilePicture,
      startDate: profileData.startDate || currentTimestamp.split('T')[0]!,
      lastLogin: profileData.lastLogin,
      isActive: profileData.isActive,
      createdAt: profileData.createdAt,
      updatedAt: profileData.updatedAt,
    };

    return createSuccessResponse(profile, 200, 'Profile updated successfully');

  } catch (error) {
    console.error('Error updating user profile:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
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