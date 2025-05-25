import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
    const cognitoUser = event.requestContext.authorizer?.claims;
    const authenticatedUserId = cognitoUser?.sub;
    const userRole = cognitoUser?.['custom:role'] || 'employee';

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

    // Get current user profile to ensure it exists
    const getCommand = new GetCommand({
      TableName: process.env.USERS_TABLE!,
      Key: { id: userId },
    });

    const currentUser = await docClient.send(getCommand);
    if (!currentUser.Item) {
      return createErrorResponse(404, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User profile not found');
    }

    // Build update expression dynamically
    const updateExpression: string[] = [];
    const expressionAttributeNames: { [key: string]: string } = {};
    const expressionAttributeValues: { [key: string]: any } = {};

    if (updateData.name !== undefined) {
      updateExpression.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = updateData.name;
    }

    if (updateData.jobTitle !== undefined) {
      updateExpression.push('#jobTitle = :jobTitle');
      expressionAttributeNames['#jobTitle'] = 'jobTitle';
      expressionAttributeValues[':jobTitle'] = updateData.jobTitle;
    }

    if (updateData.department !== undefined) {
      updateExpression.push('#department = :department');
      expressionAttributeNames['#department'] = 'department';
      expressionAttributeValues[':department'] = updateData.department;
    }

    if (updateData.hourlyRate !== undefined) {
      updateExpression.push('#hourlyRate = :hourlyRate');
      expressionAttributeNames['#hourlyRate'] = 'hourlyRate';
      expressionAttributeValues[':hourlyRate'] = updateData.hourlyRate;
    }

    if (updateData.contactInfo !== undefined) {
      updateExpression.push('#contactInfo = :contactInfo');
      expressionAttributeNames['#contactInfo'] = 'contactInfo';
      expressionAttributeValues[':contactInfo'] = updateData.contactInfo;
    }

    // Always update the updatedAt timestamp
    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    if (updateExpression.length === 1) { // Only updatedAt
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'No fields to update');
    }

    // Update user profile
    const updateCommand = new UpdateCommand({
      TableName: process.env.USERS_TABLE!,
      Key: { id: userId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(updateCommand);

    // Transform updated item to UserProfile
    const updatedUser = result.Attributes!;
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