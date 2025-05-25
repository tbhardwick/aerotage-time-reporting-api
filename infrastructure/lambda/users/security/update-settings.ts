import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { 
  UpdateUserSecuritySettingsRequest,
  UserSecuritySettings, 
  SuccessResponse, 
  ErrorResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Update user security settings request:', JSON.stringify(event, null, 2));

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required');
    }

    const updateData: UpdateUserSecuritySettingsRequest = JSON.parse(event.body);

    // Get authenticated user from context
    const authContext = event.requestContext.authorizer;
    const authenticatedUserId = authContext?.userId;

    // Authorization check: users can only update their own security settings
    if (userId !== authenticatedUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only update your own security settings'
      );
    }

    // Validate input data
    const validationError = validateUpdateRequest(updateData);
    if (validationError) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validationError);
    }

    // Get existing security settings
    const getCommand = new GetCommand({
      TableName: process.env.USER_SECURITY_SETTINGS_TABLE!,
      Key: { userId },
    });

    const getResult = await docClient.send(getCommand);
    const now = new Date().toISOString();

    // Merge with existing settings or create new ones
    const existingSettings = getResult.Item || {};
    const updatedSettings = {
      userId,
      twoFactorEnabled: existingSettings.twoFactorEnabled || false,
      sessionTimeout: updateData.sessionTimeout ?? existingSettings.sessionTimeout ?? 480,
      allowMultipleSessions: updateData.allowMultipleSessions ?? existingSettings.allowMultipleSessions ?? true,
      requirePasswordChangeEvery: updateData.requirePasswordChangeEvery ?? existingSettings.requirePasswordChangeEvery ?? 0,
      passwordLastChanged: existingSettings.passwordLastChanged || now,
      failedLoginAttempts: existingSettings.failedLoginAttempts || 0,
      twoFactorSecret: existingSettings.twoFactorSecret,
      backupCodes: existingSettings.backupCodes,
      accountLockedUntil: existingSettings.accountLockedUntil,
      createdAt: existingSettings.createdAt || now,
      updatedAt: now,
    };

    // Save updated settings to DynamoDB
    const putCommand = new PutCommand({
      TableName: process.env.USER_SECURITY_SETTINGS_TABLE!,
      Item: updatedSettings,
    });

    await docClient.send(putCommand);

    // Transform back to API response format
    let passwordExpiresAt: string | undefined;
    if (updatedSettings.requirePasswordChangeEvery > 0) {
      const passwordDate = new Date(updatedSettings.passwordLastChanged);
      passwordDate.setDate(passwordDate.getDate() + updatedSettings.requirePasswordChangeEvery);
      passwordExpiresAt = passwordDate.toISOString();
    }

    const responseData: UserSecuritySettings = {
      twoFactorEnabled: updatedSettings.twoFactorEnabled,
      sessionTimeout: updatedSettings.sessionTimeout,
      allowMultipleSessions: updatedSettings.allowMultipleSessions,
      passwordChangeRequired: false,
      passwordLastChanged: updatedSettings.passwordLastChanged,
      passwordExpiresAt,
      securitySettings: {
        requirePasswordChangeEvery: updatedSettings.requirePasswordChangeEvery,
        maxFailedLoginAttempts: 5, // Fixed value
        accountLockoutDuration: 30, // Fixed value
      },
    };

    const response: SuccessResponse<UserSecuritySettings> = {
      success: true,
      data: responseData,
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
    console.error('Update security settings error:', error);
    return createErrorResponse(500, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Internal server error');
  }
};

function validateUpdateRequest(data: UpdateUserSecuritySettingsRequest): string | null {
  // Validate session timeout
  if (data.sessionTimeout !== undefined) {
    if (typeof data.sessionTimeout !== 'number' || data.sessionTimeout < 15 || data.sessionTimeout > 43200) {
      return 'Session timeout must be between 15 minutes and 30 days (43200 minutes)';
    }
  }

  // Validate allow multiple sessions
  if (data.allowMultipleSessions !== undefined) {
    if (typeof data.allowMultipleSessions !== 'boolean') {
      return 'Allow multiple sessions must be a boolean value';
    }
  }

  // Validate password change frequency
  if (data.requirePasswordChangeEvery !== undefined) {
    if (typeof data.requirePasswordChangeEvery !== 'number' || data.requirePasswordChangeEvery < 0 || data.requirePasswordChangeEvery > 365) {
      return 'Password change frequency must be between 0 (never) and 365 days';
    }
  }

  return null;
}

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