import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { 
  SuccessResponse, 
  ErrorResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Logout request:', JSON.stringify(event, null, 2));

    // Get authenticated user from context
    const authContext = event.requestContext.authorizer;
    const userId = authContext?.userId;

    if (!userId) {
      return createErrorResponse(401, ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 'User authentication required');
    }

    // Get current request's user agent and IP for session matching
    const currentUserAgent = event.headers['User-Agent'] || event.headers['user-agent'] || '';
    const currentIP = getClientIP(event);
    
    console.log('Logout request details:');
    console.log(`  User ID: ${userId}`);
    console.log(`  User Agent: ${currentUserAgent}`);
    console.log(`  IP Address: ${currentIP}`);

    // Find and delete the current session
    const currentSessionId = await findAndDeleteCurrentSession(userId, currentUserAgent, currentIP);

    if (currentSessionId) {
      console.log(`Successfully deleted current session: ${currentSessionId}`);
    } else {
      console.log('No current session found to delete');
    }

    // Also clean up any expired sessions for this user
    await cleanupExpiredSessions(userId);

    const response: SuccessResponse<{ message: string; sessionId?: string }> = {
      success: true,
      data: {
        message: 'Logout successful',
        sessionId: currentSessionId || undefined,
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
    console.error('Logout error:', error);
    return createErrorResponse(500, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Logout failed');
  }
};

/**
 * Find and delete the current session based on user agent and IP
 */
async function findAndDeleteCurrentSession(userId: string, userAgent: string, ipAddress: string): Promise<string | null> {
  try {
    // Query all active sessions for the user
    const queryCommand = new QueryCommand({
      TableName: process.env.USER_SESSIONS_TABLE!,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: 'isActive = :isActive AND expiresAt > :now',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':isActive': true,
        ':now': new Date().toISOString(),
      },
    });

    const result = await docClient.send(queryCommand);
    const activeSessions = result.Items || [];

    console.log(`Found ${activeSessions.length} active sessions for user ${userId}`);

    // Find sessions that match current UA and IP
    const matchingSessions = activeSessions.filter(s => 
      s.userAgent === userAgent && s.ipAddress === ipAddress
    );

    if (matchingSessions.length === 0) {
      console.log('No matching sessions found for current request');
      return null;
    }

    // Sort by last activity (most recent first) and take the most recent one
    matchingSessions.sort((a, b) => {
      const aTime = new Date(a.lastActivity || a.loginTime).getTime();
      const bTime = new Date(b.lastActivity || b.loginTime).getTime();
      return bTime - aTime;
    });

    const currentSession = matchingSessions[0];
    const sessionId = currentSession.sessionId;

    console.log(`Identified current session to delete: ${sessionId}`);

    // Delete the current session
    const deleteCommand = new DeleteCommand({
      TableName: process.env.USER_SESSIONS_TABLE!,
      Key: { sessionId },
    });

    await docClient.send(deleteCommand);

    return sessionId;

  } catch (error) {
    console.error('Error finding and deleting current session:', error);
    return null;
  }
}

/**
 * Clean up expired sessions for the user
 */
async function cleanupExpiredSessions(userId: string): Promise<void> {
  try {
    // Query all sessions for the user (including inactive ones)
    const queryCommand = new QueryCommand({
      TableName: process.env.USER_SESSIONS_TABLE!,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    });

    const result = await docClient.send(queryCommand);
    const allSessions = result.Items || [];

    const now = new Date();
    const expiredSessions = allSessions.filter(session => {
      // Session is expired if:
      // 1. expiresAt is in the past, OR
      // 2. isActive is false, OR
      // 3. lastActivity is too old based on session timeout
      
      const expiresAt = new Date(session.expiresAt);
      const lastActivity = new Date(session.lastActivity || session.loginTime);
      const sessionTimeoutMinutes = session.sessionTimeout || 480; // Default 8 hours
      const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
      
      return (
        expiresAt <= now ||
        !session.isActive ||
        (now.getTime() - lastActivity.getTime()) > timeoutMs
      );
    });

    console.log(`Found ${expiredSessions.length} expired sessions to clean up`);

    // Delete expired sessions
    const deletePromises = expiredSessions.map(session => {
      const deleteCommand = new DeleteCommand({
        TableName: process.env.USER_SESSIONS_TABLE!,
        Key: { sessionId: session.sessionId },
      });
      return docClient.send(deleteCommand);
    });

    await Promise.all(deletePromises);

    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
    }

  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    // Don't throw - cleanup is optional
  }
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