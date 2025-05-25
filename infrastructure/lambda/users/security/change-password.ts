import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminSetUserPasswordCommand } from '@aws-sdk/client-cognito-identity-provider';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { 
  SuccessResponse, 
  ErrorResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({});

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Change password request:', JSON.stringify({ ...event, body: '[REDACTED]' }, null, 2));

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required');
    }

    const { currentPassword, newPassword }: ChangePasswordRequest = JSON.parse(event.body);

    // Get authenticated user from context
    const cognitoUser = event.requestContext.authorizer?.claims;
    const authenticatedUserId = cognitoUser?.sub;
    const userRole = cognitoUser?.['custom:role'] || 'employee';
    const userEmail = cognitoUser?.email;

    // Authorization check: users can only change their own password
    if (userId !== authenticatedUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only change your own password'
      );
    }

    // Validate password requirements
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 
        passwordValidation.message
      );
    }

    // Check password history to prevent reuse
    const isPasswordReused = await checkPasswordHistory(userId, newPassword);
    if (isPasswordReused) {
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 
        'Password cannot be one of your last 5 passwords'
      );
    }

    // Get security settings to check lockout status
    const securitySettings = await getUserSecuritySettings(userId);
    if (securitySettings && securitySettings.accountLockedUntil) {
      const lockoutTime = new Date(securitySettings.accountLockedUntil);
      if (lockoutTime > new Date()) {
        return createErrorResponse(
          423, 
          ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
          'Account is temporarily locked due to failed login attempts'
        );
      }
    }

    // Update password in Cognito
    try {
      await cognitoClient.send(new AdminSetUserPasswordCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: userEmail,
        Password: newPassword,
        Permanent: true,
      }));
    } catch (cognitoError: any) {
      console.error('Cognito password update error:', cognitoError);
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 
        'Failed to update password'
      );
    }

    // Store password in history
    await storePasswordHistory(userId, newPassword);

    // Update security settings with new password change timestamp
    await updatePasswordChangeTimestamp(userId);

    // Reset failed login attempts if any
    if (securitySettings && securitySettings.failedLoginAttempts > 0) {
      await resetFailedLoginAttempts(userId);
    }

    const response: SuccessResponse<{ message: string }> = {
      success: true,
      data: {
        message: 'Password updated successfully'
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
    console.error('Change password error:', error);
    return createErrorResponse(500, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Internal server error');
  }
};

function validatePassword(password: string): { isValid: boolean; message: string } {
  if (!password || password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }

  if (!/[A-Za-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one letter' };
  }

  if (!/\d/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character' };
  }

  return { isValid: true, message: '' };
}

async function checkPasswordHistory(userId: string, newPassword: string): Promise<boolean> {
  try {
    // Query password history (last 5 passwords)
    const command = new QueryCommand({
      TableName: process.env.PASSWORD_HISTORY_TABLE!,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // Get most recent first
      Limit: 5,
    });

    const result = await docClient.send(command);
    
    if (!result.Items || result.Items.length === 0) {
      return false;
    }

    // Hash the new password and compare with stored hashes
    for (const item of result.Items) {
      const isMatch = await bcrypt.compare(newPassword, item.passwordHash);
      if (isMatch) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking password history:', error);
    return false; // Allow password change if history check fails
  }
}

async function storePasswordHistory(userId: string, password: string): Promise<void> {
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    await docClient.send(new PutCommand({
      TableName: process.env.PASSWORD_HISTORY_TABLE!,
      Item: {
        userId,
        createdAt: now,
        passwordHash,
        expiresAt: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year TTL
      },
    }));

    // Clean up old password history (keep only last 5)
    const historyCommand = new QueryCommand({
      TableName: process.env.PASSWORD_HISTORY_TABLE!,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false,
      Limit: 10, // Get more than we need to clean up
    });

    const historyResult = await docClient.send(historyCommand);
    if (historyResult.Items && historyResult.Items.length > 5) {
      // Delete old entries beyond the 5 most recent
      const itemsToDelete = historyResult.Items.slice(5);
      for (const item of itemsToDelete) {
        await docClient.send(new DeleteCommand({
          TableName: process.env.PASSWORD_HISTORY_TABLE!,
          Key: {
            userId: item.userId,
            createdAt: item.createdAt,
          },
        }));
      }
    }
  } catch (error) {
    console.error('Error storing password history:', error);
    // Don't fail the password change if history storage fails
  }
}

async function getUserSecuritySettings(userId: string): Promise<any> {
  try {
    const command = new GetCommand({
      TableName: process.env.USER_SECURITY_SETTINGS_TABLE!,
      Key: { userId },
    });

    const result = await docClient.send(command);
    return result.Item || null;
  } catch (error) {
    console.error('Error getting security settings:', error);
    return null;
  }
}

async function updatePasswordChangeTimestamp(userId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    // Get existing settings or create defaults
    const existingSettings = await getUserSecuritySettings(userId);
    
    const settings = {
      userId,
      twoFactorEnabled: false,
      sessionTimeout: 480, // 8 hours
      allowMultipleSessions: true,
      requirePasswordChangeEvery: 0, // Never
      failedLoginAttempts: 0,
      createdAt: existingSettings?.createdAt || now,
      ...existingSettings, // Keep existing settings
      passwordLastChanged: now, // Update this field
      updatedAt: now, // Update timestamp
    };

    await docClient.send(new PutCommand({
      TableName: process.env.USER_SECURITY_SETTINGS_TABLE!,
      Item: settings,
    }));
  } catch (error) {
    console.error('Error updating password change timestamp:', error);
    // Don't fail password change if this update fails
  }
}

async function resetFailedLoginAttempts(userId: string): Promise<void> {
  try {
    const existingSettings = await getUserSecuritySettings(userId);
    if (!existingSettings) return;

    const updatedSettings = {
      ...existingSettings,
      failedLoginAttempts: 0,
      accountLockedUntil: undefined, // Remove lockout
      updatedAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({
      TableName: process.env.USER_SECURITY_SETTINGS_TABLE!,
      Item: updatedSettings,
    }));
  } catch (error) {
    console.error('Error resetting failed login attempts:', error);
  }
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