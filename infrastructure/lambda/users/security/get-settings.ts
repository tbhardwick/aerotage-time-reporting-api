import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { 
  UserSecuritySettings, 
  SuccessResponse, 
  ErrorResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Default security settings for new users
const DEFAULT_SECURITY_SETTINGS: UserSecuritySettings = {
  twoFactorEnabled: false,
  sessionTimeout: 480, // 8 hours
  allowMultipleSessions: true,
  passwordChangeRequired: false,
  passwordLastChanged: new Date().toISOString(),
  securitySettings: {
    requirePasswordChangeEvery: 0, // Never
    maxFailedLoginAttempts: 5,
    accountLockoutDuration: 30, // 30 minutes
  },
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Get user security settings request:', JSON.stringify(event, null, 2));

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Get authenticated user from context
    const authContext = event.requestContext.authorizer;
    const authenticatedUserId = authContext?.userId;
    const userRole = authContext?.role || 'employee';

    // Authorization check: users can only access their own security settings
    if (userId !== authenticatedUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only access your own security settings'
      );
    }

    // Get user security settings from DynamoDB
    const command = new GetCommand({
      TableName: process.env.USER_SECURITY_SETTINGS_TABLE!,
      Key: { userId },
    });

    const result = await docClient.send(command);

    let securitySettings: UserSecuritySettings;

    if (!result.Item) {
      // Return default security settings if none exist
      securitySettings = DEFAULT_SECURITY_SETTINGS;
    } else {
      // Transform DynamoDB item to UserSecuritySettings
      const item = result.Item;
      
      // Check if password should expire
      let passwordExpiresAt: string | undefined;
      if (item.requirePasswordChangeEvery > 0) {
        const passwordDate = new Date(item.passwordLastChanged);
        passwordDate.setDate(passwordDate.getDate() + item.requirePasswordChangeEvery);
        passwordExpiresAt = passwordDate.toISOString();
      }

      securitySettings = {
        twoFactorEnabled: item.twoFactorEnabled || false,
        sessionTimeout: item.sessionTimeout || 480,
        allowMultipleSessions: item.allowMultipleSessions !== false, // Default to true
        passwordChangeRequired: false, // Always false in response
        passwordLastChanged: item.passwordLastChanged || DEFAULT_SECURITY_SETTINGS.passwordLastChanged,
        passwordExpiresAt,
        securitySettings: {
          requirePasswordChangeEvery: item.requirePasswordChangeEvery || 0,
          maxFailedLoginAttempts: 5, // Fixed value for security
          accountLockoutDuration: 30, // Fixed value for security
        },
      };
    }

    const response: SuccessResponse<UserSecuritySettings> = {
      success: true,
      data: securitySettings,
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
    console.error('Get security settings error:', error);
    return createErrorResponse(500, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Internal server error');
  }
};

function createErrorResponse(
  statusCode: number,
  errorCode: ProfileSettingsErrorCodes,
  message: string
): APIGatewayProxyResult {
  const response: ErrorResponse = {
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
    body: JSON.stringify(response),
  };
} 