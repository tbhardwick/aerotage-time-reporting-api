import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId } from '../../shared/auth-helper';
import { createErrorResponse } from '../../shared/response-helper';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import jwt from 'jsonwebtoken';
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

    // Extract user ID and session ID from path parameters
    const userId = event.pathParameters?.id;
    const sessionId = event.pathParameters?.sessionId;
    
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }
    
    if (!sessionId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 'Session ID is required');
    }

    // Authorization check: users can only terminate their own sessions
    if (userId !== currentUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only terminate your own sessions'
      );
    }

    // Get current request's user agent and IP for session matching
    const currentUserAgent = event.headers['User-Agent'] || event.headers['user-agent'] || '';
    const currentIP = getClientIP(event);

    // Get the session to verify it exists and belongs to the user
    const getCommand = new GetCommand({
      TableName: process.env.USER_SESSIONS_TABLE!,
      Key: { sessionId },
    });

    const getResult = await docClient.send(getCommand);

    if (!getResult.Item) {
      return createErrorResponse(404, ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 'Session not found');
    }

    const session = getResult.Item;

    // Verify the session belongs to the authenticated user
    if (session.userId !== currentUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only terminate your own sessions'
      );
    }

    // Check if session is already inactive
    if (!session.isActive) {
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 
        'Session is already inactive'
      );
    }

    // Check if session has expired
    if (new Date(session.expiresAt) <= new Date()) {
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 
        'Session has already expired'
      );
    }

    // Use the same logic as list-sessions.ts to determine if this is the current session
    // We need to check if this session would be identified as "current" by list-sessions
    
    // Query all active sessions for the user to find the current one
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

    const queryResult = await docClient.send(queryCommand);
    const activeSessions = queryResult.Items || [];

    // Find all sessions that match current UA and IP
    const matchingSessions = activeSessions.filter(s => 
      s.userAgent === currentUserAgent && s.ipAddress === currentIP
    );

    let currentSessionId: string | null = null;
    
    if (matchingSessions.length > 0) {
      // Sort by last activity (most recent first)
      matchingSessions.sort((a, b) => {
        const aTime = new Date(a.lastActivity || a.loginTime).getTime();
        const bTime = new Date(b.lastActivity || b.loginTime).getTime();
        return bTime - aTime;
      });
      
      // The most recently active matching session is the current one
      currentSessionId = matchingSessions[0].sessionId;
    }

    // Check if the session being terminated is the current session
    const isCurrentSession = sessionId === currentSessionId;

    if (isCurrentSession) {
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.CANNOT_TERMINATE_CURRENT_SESSION, 
        'You cannot terminate your current session'
      );
    }

    // Actually delete the session from the database
    const deleteCommand = new DeleteCommand({
      TableName: process.env.USER_SESSIONS_TABLE!,
      Key: { sessionId },
    });

    await docClient.send(deleteCommand);

    const response: SuccessResponse<{ message: string }> = {
      success: true,
      data: {
        message: 'Session terminated successfully'
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
    console.error('Terminate session error:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

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