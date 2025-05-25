import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { UserProfile, SuccessResponse, ErrorResponse, ProfileSettingsErrorCodes } from '../../shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Get user profile request:', JSON.stringify(event, null, 2));

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: ProfileSettingsErrorCodes.PROFILE_NOT_FOUND,
          message: 'User ID is required',
        },
        timestamp: new Date().toISOString(),
      };
      
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(response),
      };
    }

    // Get authenticated user from context (added by Cognito authorizer)
    const cognitoUser = event.requestContext.authorizer?.claims;
    const authenticatedUserId = cognitoUser?.sub;
    const userRole = cognitoUser?.['custom:role'] || 'employee';

    // Authorization check: users can only access their own profile unless they're admin
    if (userId !== authenticatedUserId && userRole !== 'admin') {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS,
          message: 'You can only access your own profile',
        },
        timestamp: new Date().toISOString(),
      };
      
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(response),
      };
    }

    // Get user profile from DynamoDB
    const command = new GetCommand({
      TableName: process.env.USERS_TABLE!,
      Key: { id: userId },
    });

    const result = await docClient.send(command);

    if (!result.Item) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: ProfileSettingsErrorCodes.PROFILE_NOT_FOUND,
          message: 'User profile not found',
        },
        timestamp: new Date().toISOString(),
      };
      
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(response),
      };
    }

    // Transform DynamoDB item to UserProfile
    const user = result.Item;
    const profile: UserProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      jobTitle: user.jobTitle,
      department: user.department,
      hourlyRate: user.hourlyRate,
      role: user.role,
      contactInfo: user.contactInfo ? {
        phone: user.contactInfo.phone,
        address: user.contactInfo.address,
        emergencyContact: user.contactInfo.emergencyContact,
      } : undefined,
      profilePicture: user.profilePicture,
      startDate: user.startDate,
      lastLogin: user.lastLogin,
      isActive: user.isActive,
      teamId: user.teamId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const response: SuccessResponse<UserProfile> = {
      success: true,
      data: profile,
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
    console.error('Error getting user profile:', error);
    
    const response: ErrorResponse = {
      success: false,
      error: {
        code: ProfileSettingsErrorCodes.PROFILE_NOT_FOUND,
        message: 'Internal server error',
      },
      timestamp: new Date().toISOString(),
    };
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  }
}; 