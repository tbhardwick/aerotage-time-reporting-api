import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { SessionRepository, SessionValidationResult } from './session-repository';

const sessionRepo = new SessionRepository();

export interface AuthValidationResult {
  isValid: boolean;
  userId?: string;
  userClaims?: any;
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

      // Step 2: Check if user has active sessions using repository
      const sessionResult = await sessionRepo.validateUserSessions(userId);
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
      console.log(`🔍 AUTH SERVICE: Checking active sessions for user ${userId}`);
      const sessionResult = await sessionRepo.validateUserSessions(userId);
      console.log(`📊 AUTH SERVICE: Session check result - Has active sessions: ${sessionResult.hasActiveSessions}, Count: ${sessionResult.sessionCount}`);
      return sessionResult.hasActiveSessions;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ AUTH SERVICE: Error checking sessions for user ${userId}:`, errorMessage);
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