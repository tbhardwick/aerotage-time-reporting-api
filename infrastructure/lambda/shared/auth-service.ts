import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export interface AuthValidationResult {
  isValid: boolean;
  userId?: string;
  userClaims?: any;
  errorMessage?: string;
}

export interface SessionValidationResult {
  hasActiveSessions: boolean;
  sessionCount: number;
  errorMessage?: string;
}

export class AuthService {
  private static jwksClient = jwksClient({
    jwksUri: `https://cognito-idp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 10 * 60 * 1000, // 10 minutes
  });

  /**
   * Enhanced JWT validation that also checks session status
   */
  static async validateAuthentication(token: string): Promise<AuthValidationResult> {
    try {
      console.log('Starting enhanced authentication validation');

      // Step 1: Validate JWT token
      const jwtResult = await this.validateJwtToken(token);
      if (!jwtResult.isValid) {
        console.log('JWT validation failed:', jwtResult.errorMessage);
        return jwtResult;
      }

      const userId = jwtResult.userId!;
      console.log(`JWT validation successful for user: ${userId}`);

      // Step 2: Check if user has active sessions
      const sessionResult = await this.validateUserSession(userId);
      if (!sessionResult.hasActiveSessions) {
        console.log(`No active sessions found for user: ${userId}`, sessionResult);
        return {
          isValid: false,
          errorMessage: 'No active sessions for user'
        };
      }

      console.log(`Session validation successful for user: ${userId}, active sessions: ${sessionResult.sessionCount}`);

      return {
        isValid: true,
        userId,
        userClaims: jwtResult.userClaims
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      console.error('Authentication validation error:', error);
      return {
        isValid: false,
        errorMessage
      };
    }
  }

  /**
   * JWT-only validation for bootstrap scenarios (doesn't check session status)
   */
  static async validateJwtOnly(token: string): Promise<AuthValidationResult> {
    try {
      console.log('Starting JWT-only validation for bootstrap');

      // Only validate JWT token, skip session validation
      const jwtResult = await this.validateJwtToken(token);
      if (!jwtResult.isValid) {
        console.log('JWT validation failed:', jwtResult.errorMessage);
        return jwtResult;
      }

      const userId = jwtResult.userId!;
      console.log(`JWT-only validation successful for user: ${userId}`);

      return {
        isValid: true,
        userId,
        userClaims: jwtResult.userClaims
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'JWT validation failed';
      console.error('JWT-only validation error:', error);
      return {
        isValid: false,
        errorMessage
      };
    }
  }

  /**
   * Check if user has any active sessions (for bootstrap logic)
   */
  static async checkUserHasActiveSessions(userId: string): Promise<boolean> {
    try {
      const sessionResult = await this.validateUserSession(userId);
      return sessionResult.hasActiveSessions;
    } catch (error) {
      console.error(`Error checking sessions for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Validates JWT token signature and expiration
   */
  private static async validateJwtToken(token: string): Promise<AuthValidationResult> {
    return new Promise((resolve) => {
      const getKey = (header: any, callback: (err: any, key?: string) => void) => {
        this.jwksClient.getSigningKey(header.kid, (err: any, key: any) => {
          if (err) {
            console.error('Error getting signing key:', err);
            callback(err);
            return;
          }
          const signingKey = key?.getPublicKey();
          callback(null, signingKey);
        });
      };

      jwt.verify(token, getKey, {
        issuer: `https://cognito-idp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.USER_POOL_ID}`,
        algorithms: ['RS256'],
      }, (err: any, decoded: any) => {
        if (err) {
          console.error('JWT verification failed:', err);
          resolve({
            isValid: false,
            errorMessage: `JWT validation failed: ${err.message}`
          });
        } else {
          const userId = decoded.sub;
          if (!userId) {
            resolve({
              isValid: false,
              errorMessage: 'Invalid JWT payload: missing user ID'
            });
          } else {
            resolve({
              isValid: true,
              userId,
              userClaims: decoded
            });
          }
        }
      });
    });
  }

  /**
   * Checks if user has at least one active session
   */
  private static async validateUserSession(userId: string): Promise<SessionValidationResult> {
    try {
      console.log(`Checking active sessions for user: ${userId}`);

      // Query for active sessions for this user using GSI
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
      });

      const result = await docClient.send(command);
      const sessions = result.Items || [];

      console.log(`Found ${sessions.length} potentially active sessions for user ${userId}`);

      // Check session timeout (from user's security settings)
      const currentTime = new Date();
      const validSessions = [];

      for (const session of sessions) {
        try {
          // Check session timeout
          const lastActivity = new Date(session.lastActivity);
          const sessionTimeoutMinutes = session.sessionTimeout || 480; // Default 8 hours
          
          const timeDiffMinutes = (currentTime.getTime() - lastActivity.getTime()) / (1000 * 60);
          
          if (timeDiffMinutes <= sessionTimeoutMinutes) {
            validSessions.push(session);
            console.log(`Valid session found: ${session.sessionId}, last activity: ${session.lastActivity}`);
          } else {
            console.log(`Session expired: ${session.sessionId}, last activity: ${session.lastActivity}, timeout: ${sessionTimeoutMinutes}min`);
            // Mark expired session as inactive
            await this.markSessionExpired(session.sessionId);
          }
        } catch (sessionError) {
          console.error(`Error validating session ${session.sessionId}:`, sessionError);
        }
      }

      return {
        hasActiveSessions: validSessions.length > 0,
        sessionCount: validSessions.length
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Session validation error';
      console.error(`Session validation failed for user ${userId}:`, error);
      return {
        hasActiveSessions: false,
        sessionCount: 0,
        errorMessage: `Session validation error: ${errorMessage}`
      };
    }
  }

  /**
   * Mark expired sessions as inactive
   */
  private static async markSessionExpired(sessionId: string): Promise<void> {
    try {
      const updateCommand = new UpdateCommand({
        TableName: process.env.USER_SESSIONS_TABLE!,
        Key: { sessionId },
        UpdateExpression: 'SET isActive = :false, expiredAt = :now',
        ExpressionAttributeValues: {
          ':false': false,
          ':now': new Date().toISOString()
        }
      });

      await docClient.send(updateCommand);
      console.log(`Session ${sessionId} marked as expired`);
    } catch (error) {
      console.error(`Failed to mark session ${sessionId} as expired:`, error);
    }
  }

  /**
   * Extract and clean Bearer token from Authorization header
   */
  static extractBearerToken(authorizationHeader?: string): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const parts = authorizationHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1] || null;
  }
} 