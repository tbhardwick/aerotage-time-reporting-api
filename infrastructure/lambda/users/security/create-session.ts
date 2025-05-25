import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { 
  UserSession, 
  SuccessResponse, 
  ErrorResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Create session request:', JSON.stringify(event, null, 2));

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Get authenticated user from context
    const cognitoUser = event.requestContext.authorizer?.claims;
    const authenticatedUserId = cognitoUser?.sub;

    // Authorization check: users can only create sessions for themselves
    if (userId !== authenticatedUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only create sessions for yourself'
      );
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Invalid JSON in request body');
    }

    // Validate request body
    const validation = validateSessionCreationRequest(requestBody);
    if (!validation.isValid) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validation.message);
    }

    // Extract client IP address from event
    const ipAddress = getClientIP(event);
    
    // Extract session data from request
    const userAgent = requestBody.userAgent || 'Unknown';
    const loginTime = requestBody.loginTime || new Date().toISOString();
    
    // Validate loginTime is recent (within last 5 minutes)
    const loginTimestamp = new Date(loginTime);
    const now = new Date();
    const timeDiff = now.getTime() - loginTimestamp.getTime();
    const fiveMinutesInMs = 5 * 60 * 1000;
    
    if (timeDiff > fiveMinutesInMs || timeDiff < -fiveMinutesInMs) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Login time must be within the last 5 minutes');
    }

    // Get current session token from Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '') || '';

    // Check user security settings for multiple sessions
    const securitySettings = await getUserSecuritySettings(userId);
    
    if (!securitySettings.allowMultipleSessions) {
      // Terminate existing active sessions
      await terminateUserSessions(userId, sessionToken);
    }

    // Generate unique session ID
    const sessionId = uuidv4();
    
    // Calculate session expiry based on security settings
    const sessionTimeoutMs = securitySettings.sessionTimeout * 60 * 1000; // Convert minutes to milliseconds
    const expiresAt = new Date(loginTimestamp.getTime() + sessionTimeoutMs).toISOString();

    // Get location data from IP (optional)
    const location = await getLocationFromIP(ipAddress);

    // Create session record
    const sessionData = {
      PK: `SESSION#${sessionId}`,
      SK: `SESSION#${sessionId}`,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `SESSION#${loginTime}`,
      sessionId,
      userId,
      sessionToken,
      ipAddress,
      userAgent,
      loginTime,
      lastActivity: loginTime,
      expiresAt,
      isActive: true,
      locationData: location ? JSON.stringify(location) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save session to DynamoDB
    const command = new PutCommand({
      TableName: process.env.USER_SESSIONS_TABLE!,
      Item: sessionData,
    });

    await docClient.send(command);

    // Prepare response data (without internal DynamoDB keys)
    const responseData: UserSession = {
      id: sessionId,
      ipAddress,
      userAgent,
      loginTime,
      lastActivity: loginTime,
      isCurrent: true, // New sessions are always current
      location,
    };

    const response: SuccessResponse<UserSession> = {
      success: true,
      data: responseData,
    };

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Create session error:', error);
    return createErrorResponse(500, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Failed to create session record');
  }
};

function validateSessionCreationRequest(body: any): { isValid: boolean; message: string } {
  // userAgent is required
  if (!body.userAgent || typeof body.userAgent !== 'string') {
    return { isValid: false, message: 'userAgent is required and must be a string' };
  }

  // userAgent length check
  if (body.userAgent.length > 1000) {
    return { isValid: false, message: 'userAgent must be less than 1000 characters' };
  }

  // loginTime validation (if provided)
  if (body.loginTime) {
    if (typeof body.loginTime !== 'string') {
      return { isValid: false, message: 'loginTime must be an ISO datetime string' };
    }
    
    const loginTime = new Date(body.loginTime);
    if (isNaN(loginTime.getTime())) {
      return { isValid: false, message: 'loginTime must be a valid ISO datetime string' };
    }
  }

  // ipAddress validation (if provided)
  if (body.ipAddress) {
    if (typeof body.ipAddress !== 'string') {
      return { isValid: false, message: 'ipAddress must be a string' };
    }
    
    // Basic IP address format validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (!ipRegex.test(body.ipAddress)) {
      return { isValid: false, message: 'ipAddress must be a valid IPv4 or IPv6 address' };
    }
  }

  return { isValid: true, message: '' };
}

function getClientIP(event: APIGatewayProxyEvent): string {
  // Check various headers in order of preference
  const xForwardedFor = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
  const xRealIP = event.headers['x-real-ip'] || event.headers['X-Real-IP'];
  const cfConnectingIP = event.headers['cf-connecting-ip'] || event.headers['CF-Connecting-IP'];
  const sourceIP = event.requestContext.identity.sourceIp;
  
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first (original client)
    return xForwardedFor.split(',')[0].trim();
  }
  
  return xRealIP || cfConnectingIP || sourceIP || 'unknown';
}

async function getLocationFromIP(ipAddress: string): Promise<{ city: string; country: string } | undefined> {
  try {
    // Skip location lookup for local/private IP addresses
    if (ipAddress === 'unknown' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.') || ipAddress === '127.0.0.1') {
      return undefined;
    }

    // Use free IP geolocation API (ip-api.com)
    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,city,country`);
    const data = await response.json();
    
    if (data.status === 'success' && data.city && data.country) {
      return {
        city: data.city,
        country: data.country
      };
    }
  } catch (error) {
    console.log('Failed to get location for IP:', ipAddress, error);
  }
  
  return undefined; // Location is optional
}

async function getUserSecuritySettings(userId: string): Promise<{ sessionTimeout: number; allowMultipleSessions: boolean }> {
  try {
    const command = new QueryCommand({
      TableName: process.env.USER_SECURITY_SETTINGS_TABLE!,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'SECURITY',
      },
    });

    const result = await docClient.send(command);
    
    if (result.Items && result.Items.length > 0) {
      const settings = result.Items[0];
      return {
        sessionTimeout: settings.sessionTimeout || 480, // Default 8 hours
        allowMultipleSessions: settings.allowMultipleSessions !== false, // Default true
      };
    }
  } catch (error) {
    console.error('Error getting user security settings:', error);
  }
  
  // Return default settings if not found or error
  return {
    sessionTimeout: 480, // 8 hours
    allowMultipleSessions: true,
  };
}

async function terminateUserSessions(userId: string, currentSessionToken: string): Promise<void> {
  try {
    // Query all active sessions for the user
    const command = new QueryCommand({
      TableName: process.env.USER_SESSIONS_TABLE!,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: 'isActive = :isActive AND sessionToken <> :currentToken',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':isActive': true,
        ':currentToken': currentSessionToken,
      },
    });

    const result = await docClient.send(command);

    if (result.Items && result.Items.length > 0) {
      // Terminate each session (set isActive to false)
      const updatePromises = result.Items.map(session => {
        const updateCommand = new PutCommand({
          TableName: process.env.USER_SESSIONS_TABLE!,
          Item: {
            ...session,
            isActive: false,
            updatedAt: new Date().toISOString(),
          },
        });
        return docClient.send(updateCommand);
      });

      await Promise.all(updatePromises);
      console.log(`Terminated ${result.Items.length} existing sessions for user ${userId}`);
    }
  } catch (error) {
    console.error('Error terminating user sessions:', error);
    // Don't throw - session creation should still succeed even if cleanup fails
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