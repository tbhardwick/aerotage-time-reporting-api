import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../../shared/auth-helper';
import { createErrorResponse } from '../../shared/response-helper';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { 
  UserSession, 
  SuccessResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

// Note: This function still uses some direct DynamoDB access due to complex session management logic
// In a full standardization, this would be moved to a UserSessionRepository
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Authorization check: users can only view their own sessions
    if (userId !== currentUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only view your own sessions'
      );
    }

    // Get current request details for session matching
    const currentUserAgent = event.headers['User-Agent'] || event.headers['user-agent'] || '';
    const currentIP = getClientIP(event);
    
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

    // Get current session ID from context for identification
    const authContext = event.requestContext.authorizer;
    const currentSessionId = authContext?.sessionId;

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

      return {
        id: item.sessionId,
        ipAddress: item.ipAddress || 'Unknown',
        userAgent: item.userAgent || 'Unknown',
        loginTime: item.loginTime,
        lastActivity: item.lastActivity,
        isCurrent: false, // Will be set later
        location,
      };
    });

    // Identify current session
    let identifiedCurrentSession: string | null = currentSessionId;
    
    if (!identifiedCurrentSession && sessions.length > 0) {
      // Find sessions that match current UA and IP
      const matchingSessions = sessions.filter(session => 
        session.userAgent === currentUserAgent && session.ipAddress === currentIP
      );
      
      if (matchingSessions.length > 0) {
        // Sort by last activity (most recent first)
        matchingSessions.sort((a, b) => {
          const aTime = new Date(a.lastActivity || a.loginTime).getTime();
          const bTime = new Date(b.lastActivity || b.loginTime).getTime();
          return bTime - aTime;
        });
        
        // The most recently active matching session is the current one
        identifiedCurrentSession = matchingSessions[0].id;
      }
    }
    
    // Mark the current session
    sessions.forEach(session => {
      session.isCurrent = session.id === identifiedCurrentSession;
    });

    // Sort sessions by current status and last activity
    sessions.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      const aTime = new Date(a.lastActivity || a.loginTime).getTime();
      const bTime = new Date(b.lastActivity || b.loginTime).getTime();
      return bTime - aTime;
    });

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
    console.error('Error listing sessions:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
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

/**
 * Invalidate specific sessions by their IDs
 */
async function invalidateSpecificSessions(sessionIds: string[]): Promise<void> {
  try {
    console.log(`Invalidating ${sessionIds.length} specific sessions:`, sessionIds);

    // Mark specific sessions as inactive
    const updatePromises = sessionIds.map(sessionId => {
      const updateCommand = new UpdateCommand({
        TableName: process.env.USER_SESSIONS_TABLE!,
        Key: { sessionId },
        UpdateExpression: 'SET isActive = :false, updatedAt = :now, invalidationReason = :reason',
        ExpressionAttributeValues: {
          ':false': false,
          ':now': new Date().toISOString(),
          ':reason': 'legacy_session_cleanup'
        },
      });
      return docClient.send(updateCommand);
    });

    await Promise.all(updatePromises);
    console.log(`Successfully invalidated ${sessionIds.length} specific sessions`);

  } catch (error) {
    console.error(`Error invalidating specific sessions:`, error);
    throw error;
  }
}

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