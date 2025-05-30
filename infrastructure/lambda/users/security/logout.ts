import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId } from '../../shared/auth-helper';
import { createErrorResponse } from '../../shared/response-helper';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { 
  SuccessResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Get current request's user agent and IP for session matching
    const currentUserAgent = event.headers['User-Agent'] || event.headers['user-agent'] || '';
    const currentIP = getClientIP(event);

    // Find and delete the current session
    const currentSessionId = await findAndDeleteCurrentSession(currentUserId, currentUserAgent, currentIP);

    // Also clean up any expired sessions for this user
    await cleanupExpiredSessions(currentUserId);

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
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
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

    // Find sessions that match current UA and IP
    const matchingSessions = activeSessions.filter(s => 
      s.userAgent === userAgent && s.ipAddress === ipAddress
    );

    if (matchingSessions.length === 0) {
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

    // Delete expired sessions
    const deletePromises = expiredSessions.map(session => {
      const deleteCommand = new DeleteCommand({
        TableName: process.env.USER_SESSIONS_TABLE!,
        Key: { sessionId: session.sessionId },
      });
      return docClient.send(deleteCommand);
    });

    await Promise.all(deletePromises);

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