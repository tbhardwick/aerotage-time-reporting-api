import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import jwt from 'jsonwebtoken';
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
    console.log('List user sessions request:', JSON.stringify(event, null, 2));

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Get authenticated user from context
    const authContext = event.requestContext.authorizer;
    const authenticatedUserId = authContext?.userId;

    // Authorization check: users can only view their own sessions
    if (userId !== authenticatedUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only view your own sessions'
      );
    }

    // Get current session identifier from JWT token
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const currentToken = authHeader?.replace('Bearer ', '');
    let currentSessionIdentifier: string | null = null;

    if (currentToken) {
      try {
        // Decode JWT token without verification to extract claims
        const decodedToken = jwt.decode(currentToken) as any;
        if (decodedToken) {
          // Use jti (JWT ID) if available, otherwise use iat (issued at) + sub combination
          currentSessionIdentifier = decodedToken.jti || 
                                   `${decodedToken.sub}_${decodedToken.iat}`;
          console.log('Current session identifier:', currentSessionIdentifier);
        }
      } catch (error) {
        console.error('Error decoding JWT token for session identification:', error);
      }
    }

    // Query active sessions for the user using GSI
    const command = new QueryCommand({
      TableName: process.env.USER_SESSIONS_TABLE!,
      IndexName: 'UserIndex', // GSI for userId lookup
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: 'isActive = :isActive AND expiresAt > :now',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':isActive': true,
        ':now': new Date().toISOString(),
      },
      ScanIndexForward: false, // Get most recent first
    });

    const result = await docClient.send(command);
    const rawSessions = result.Items || [];

    console.log(`Found ${rawSessions.length} active sessions for user ${userId}`);

    // Check if any sessions lack sessionIdentifier (legacy sessions)
    const legacySessions = rawSessions.filter(session => !session.sessionIdentifier);
    
    if (legacySessions.length > 0) {
      console.log(`Found ${legacySessions.length} legacy sessions without sessionIdentifier. Clearing all sessions to force re-login.`);
      
      // Invalidate all sessions for this user
      await invalidateAllUserSessions(userId);
      
      // Return error to force re-login
      return createErrorResponse(
        401, 
        ProfileSettingsErrorCodes.SESSION_MIGRATION_REQUIRED, 
        'Your sessions have been updated for improved security. Please log in again.'
      );
    }

    // Transform DynamoDB items to UserSession format
    const sessions: UserSession[] = rawSessions.map(item => {
      // Parse location data if it exists
      let location: { city: string; country: string } | undefined;
      if (item.locationData) {
        try {
          location = typeof item.locationData === 'string' 
            ? JSON.parse(item.locationData) 
            : item.locationData;
        } catch (error) {
          console.error('Error parsing location data:', error);
        }
      }

      // Determine if this is the current session using sessionIdentifier
      const isCurrent = currentSessionIdentifier && item.sessionIdentifier
        ? item.sessionIdentifier === currentSessionIdentifier
        : false; // Don't fall back to broken token comparison

      return {
        id: item.sessionId,
        ipAddress: item.ipAddress || 'Unknown',
        userAgent: item.userAgent || 'Unknown',
        loginTime: item.loginTime,
        lastActivity: item.lastActivity,
        isCurrent,
        location,
      };
    });

    // Sort sessions with current session first
    sessions.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });

    console.log(`Returning ${sessions.length} sessions, current session identified: ${sessions.some(s => s.isCurrent)}`);

    const response: SuccessResponse<UserSession[]> = {
      success: true,
      data: sessions,
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
    console.error('List sessions error:', error);
    return createErrorResponse(500, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Internal server error');
  }
};

/**
 * Invalidate all active sessions for a user
 */
async function invalidateAllUserSessions(userId: string): Promise<void> {
  try {
    console.log(`Invalidating all sessions for user: ${userId}`);

    // Query all active sessions for the user
    const command = new QueryCommand({
      TableName: process.env.USER_SESSIONS_TABLE!,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':isActive': true,
      },
    });

    const result = await docClient.send(command);
    const sessions = result.Items || [];

    if (sessions.length === 0) {
      console.log('No active sessions found to invalidate');
      return;
    }

    // Mark all sessions as inactive
    const updatePromises = sessions.map(session => {
      const updateCommand = new UpdateCommand({
        TableName: process.env.USER_SESSIONS_TABLE!,
        Key: { sessionId: session.sessionId },
        UpdateExpression: 'SET isActive = :false, updatedAt = :now, invalidationReason = :reason',
        ExpressionAttributeValues: {
          ':false': false,
          ':now': new Date().toISOString(),
          ':reason': 'session_migration_security_update'
        },
      });
      return docClient.send(updateCommand);
    });

    await Promise.all(updatePromises);
    console.log(`Successfully invalidated ${sessions.length} sessions for user ${userId}`);

  } catch (error) {
    console.error(`Error invalidating sessions for user ${userId}:`, error);
    throw error;
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