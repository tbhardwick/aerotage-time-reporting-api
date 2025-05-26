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

    // Get current session ID from authorizer context
    const authContext = event.requestContext.authorizer;
    const authenticatedUserId = authContext?.userId;
    const currentSessionId = authContext?.sessionId; // Session ID should be passed from authorizer

    console.log('Authorizer context:', JSON.stringify(authContext, null, 2));
    console.log('Current session ID from context:', currentSessionId);

    // Authorization check: users can only view their own sessions
    if (userId !== authenticatedUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only view your own sessions'
      );
    }

    // Get current request's user agent and IP for session matching
    const currentUserAgent = event.headers['User-Agent'] || event.headers['user-agent'] || '';
    const currentIP = getClientIP(event);
    
    console.log('Current request details for session matching:');
    console.log(`  User Agent: ${currentUserAgent}`);
    console.log(`  IP Address: ${currentIP}`);

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

    // If no current session ID from context, try to identify it by most recent activity
    let identifiedCurrentSessionId = currentSessionId;
    
    if (!identifiedCurrentSessionId && rawSessions.length > 0) {
      // Sort by last activity and pick the most recent as current
      const sortedSessions = [...rawSessions].sort((a, b) => 
        new Date(b.lastActivity || b.createdAt).getTime() - 
        new Date(a.lastActivity || a.createdAt).getTime()
      );
      
      // The most recently active session is likely the current one
      identifiedCurrentSessionId = sortedSessions[0].sessionId;
      console.log(`No session ID from context, using most recent session: ${identifiedCurrentSessionId}`);
    }

    // Check if any sessions lack sessionIdentifier (legacy sessions)
    const legacySessions = rawSessions.filter(session => !session.sessionIdentifier);
    
    if (legacySessions.length > 0 && identifiedCurrentSessionId) {
      console.log(`Found ${legacySessions.length} legacy sessions without sessionIdentifier. Migrating current session and cleaning up others.`);
      
      // Try to find the current session by token comparison (fallback for migration)
      let currentSession = null;
      for (const session of legacySessions) {
        if (session.sessionId === identifiedCurrentSessionId) {
          currentSession = session;
          break;
        }
      }
      
      if (currentSession) {
        console.log(`Migrating current session ${currentSession.sessionId} with sessionIdentifier: ${identifiedCurrentSessionId}`);
        
        // Update current session with sessionIdentifier
        const updateCurrentCommand = new UpdateCommand({
          TableName: process.env.USER_SESSIONS_TABLE!,
          Key: { sessionId: currentSession.sessionId },
          UpdateExpression: 'SET sessionIdentifier = :sessionIdentifier, updatedAt = :now',
          ExpressionAttributeValues: {
            ':sessionIdentifier': identifiedCurrentSessionId,
            ':now': new Date().toISOString(),
          },
        });
        
        await docClient.send(updateCurrentCommand);
        
        // Update the session in our local array
        currentSession.sessionIdentifier = identifiedCurrentSessionId;
      }
      
      // Invalidate other legacy sessions (not the current one)
      const otherLegacySessions = legacySessions.filter(session => 
        session.sessionId !== currentSession?.sessionId
      );
      
      if (otherLegacySessions.length > 0) {
        console.log(`Invalidating ${otherLegacySessions.length} other legacy sessions`);
        await invalidateSpecificSessions(otherLegacySessions.map(s => s.sessionId));
      }
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

    // Find the current session: the most recently active session that matches current UA and IP
    let identifiedCurrentSession: string | null = null;
    
    // First, find all sessions that match current UA and IP
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
      console.log(`Identified current session: ${identifiedCurrentSession} (most recent of ${matchingSessions.length} matching sessions)`);
    }
    
    // Mark only the identified current session
    sessions.forEach(session => {
      session.isCurrent = session.id === identifiedCurrentSession;
    });

    // Sort sessions by last activity (most recent first)
    sessions.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      const aTime = new Date(a.lastActivity || a.loginTime).getTime();
      const bTime = new Date(b.lastActivity || b.loginTime).getTime();
      return bTime - aTime;
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