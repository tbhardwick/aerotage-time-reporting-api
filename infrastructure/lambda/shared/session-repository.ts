import { DynamoDBDocumentClient, QueryCommand, DeleteCommand, UpdateCommand, GetCommand, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

interface SessionLocation {
  city: string;
  country: string;
}

interface FormattedSession {
  id: string;
  ipAddress: string;
  userAgent: string;
  loginTime: string;
  lastActivity: string;
  isCurrent: boolean;
  location?: SessionLocation;
}

interface UserSecuritySettings {
  sessionTimeout: number;
  allowMultipleSessions: boolean;
  maxFailedAttempts: number;
  lockoutDuration: number;
  passwordHistorySize: number;
  requirePasswordChange: boolean;
  lastPasswordChange: string;
  failedLoginAttempts: number;
  lockedUntil?: string;
  accountLockedUntil?: string;
  createdAt: string;
  twoFactorEnabled: boolean;
  requirePasswordChangeEvery: number;
  passwordLastChanged: string;
  twoFactorSecret?: string;
  backupCodes?: string[];
}

interface SessionData {
  sessionId: string;
  userId: string;
  isActive: boolean;
  expiresAt: string;
  lastActivity: string;
  loginTime: string;
  userAgent: string;
  ipAddress: string;
  sessionTimeout: number;
  locationData?: string | SessionLocation;
}

interface SecuritySettingsUpdate {
  sessionTimeout?: number;
  allowMultipleSessions?: boolean;
  maxFailedAttempts?: number;
  lockoutDuration?: number;
  passwordHistorySize?: number;
  requirePasswordChange?: boolean;
  twoFactorEnabled?: boolean;
  requirePasswordChangeEvery?: number;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  isActive: boolean;
  expiresAt: string;
  lastActivity: string;
  loginTime: string;
  userAgent: string;
  ipAddress: string;
  sessionTimeout: number;
  locationData?: string | SessionLocation;
}

export interface SessionValidationResult {
  hasActiveSessions: boolean;
  sessionCount: number;
  errorMessage?: string;
}

export class SessionRepository {
  private docClient: DynamoDBDocumentClient;
  private userSessionsTableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
    this.userSessionsTableName = process.env.USER_SESSIONS_TABLE || 'aerotage-user-sessions-dev';
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessionsForUser(userId: string): Promise<UserSession[]> {
    try {
      const command = new QueryCommand({
        TableName: this.userSessionsTableName,
        IndexName: 'UserIndex',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'isActive = :isActive AND expiresAt > :now',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':isActive': true,
          ':now': new Date().toISOString(),
        },
      });

      const result = await this.docClient.send(command);
      return (result.Items || []) as UserSession[];
    } catch (error) {
      console.error('Error getting active sessions for user:', error);
      throw new Error('Failed to get active sessions');
    }
  }

  /**
   * Get all sessions for a user (including inactive)
   */
  async getAllSessionsForUser(userId: string): Promise<UserSession[]> {
    try {
      const command = new QueryCommand({
        TableName: this.userSessionsTableName,
        IndexName: 'UserIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      });

      const result = await this.docClient.send(command);
      return (result.Items || []) as UserSession[];
    } catch (error) {
      console.error('Error getting all sessions for user:', error);
      throw new Error('Failed to get sessions');
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const command = new DeleteCommand({
        TableName: this.userSessionsTableName,
        Key: { sessionId },
      });

      await this.docClient.send(command);
    } catch (error) {
      console.error('Error deleting session:', error);
      throw new Error('Failed to delete session');
    }
  }

  /**
   * Mark a session as expired
   */
  async markSessionExpired(sessionId: string): Promise<void> {
    try {
      const command = new UpdateCommand({
        TableName: this.userSessionsTableName,
        Key: { sessionId },
        UpdateExpression: 'SET isActive = :false, expiredAt = :now',
        ExpressionAttributeValues: {
          ':false': false,
          ':now': new Date().toISOString()
        }
      });

      await this.docClient.send(command);
    } catch (error) {
      console.error('Error marking session as expired:', error);
      throw new Error('Failed to mark session as expired');
    }
  }

  /**
   * Validate user sessions (check for active sessions)
   */
  async validateUserSessions(userId: string): Promise<SessionValidationResult> {
    try {
      console.log(`Checking active sessions for user: ${userId}`);

      const sessions = await this.getActiveSessionsForUser(userId);
      console.log(`Found ${sessions.length} potentially active sessions for user ${userId}`);

      // Check session timeout
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
   * Find current session based on user agent and IP
   */
  async findCurrentSession(userId: string, userAgent: string, ipAddress: string): Promise<UserSession | null> {
    try {
      const activeSessions = await this.getActiveSessionsForUser(userId);

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

      return matchingSessions[0] || null;
    } catch (error) {
      console.error('Error finding current session:', error);
      return null;
    }
  }

  /**
   * Get a specific session by ID
   */
  async getSessionById(sessionId: string): Promise<UserSession | null> {
    try {
      const command = new GetCommand({
        TableName: this.userSessionsTableName,
        Key: { sessionId },
      });

      const result = await this.docClient.send(command);
      return result.Item as UserSession || null;
    } catch (error) {
      console.error('Error getting session by ID:', error);
      throw new Error('Failed to get session');
    }
  }

  /**
   * Get the current session ID based on user agent and IP
   */
  async getCurrentSessionId(userId: string, userAgent: string, ipAddress: string): Promise<string | null> {
    try {
      const currentSession = await this.findCurrentSession(userId, userAgent, ipAddress);
      return currentSession?.sessionId || null;
    } catch (error) {
      console.error('Error getting current session ID:', error);
      return null;
    }
  }

  /**
   * Get formatted sessions for a user (for UI display)
   */
  async getFormattedSessionsForUser(userId: string, currentUserAgent: string, currentIP: string, currentSessionId?: string): Promise<FormattedSession[]> {
    try {
      const rawSessions = await this.getActiveSessionsForUser(userId);

      // Transform to UI format
      const sessions = rawSessions.map(item => {
        // Parse location data if it exists
        let location: SessionLocation | undefined;
        if (item.locationData) {
          try {
            const locationData = item.locationData;
            location = typeof locationData === 'string' 
              ? JSON.parse(locationData) 
              : locationData;
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
      let identifiedCurrentSession: string | null = currentSessionId || null;
      
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
          identifiedCurrentSession = matchingSessions[0]?.id || null;
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

      return sessions;
    } catch (error) {
      console.error('Error getting formatted sessions for user:', error);
      throw new Error('Failed to get formatted sessions');
    }
  }

  /**
   * Invalidate specific sessions by their IDs
   */
  async invalidateSpecificSessions(sessionIds: string[]): Promise<void> {
    try {
      console.log(`Invalidating ${sessionIds.length} specific sessions:`, sessionIds);

      // Mark specific sessions as inactive
      const updatePromises = sessionIds.map(sessionId => {
        const command = new UpdateCommand({
          TableName: this.userSessionsTableName,
          Key: { sessionId },
          UpdateExpression: 'SET isActive = :false, updatedAt = :now, invalidationReason = :reason',
          ExpressionAttributeValues: {
            ':false': false,
            ':now': new Date().toISOString(),
            ':reason': 'legacy_session_cleanup'
          },
        });
        return this.docClient.send(command);
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
  async invalidateAllUserSessions(userId: string): Promise<void> {
    try {
      console.log(`Invalidating all sessions for user: ${userId}`);

      const sessions = await this.getActiveSessionsForUser(userId);

      if (sessions.length === 0) {
        console.log('No active sessions found to invalidate');
        return;
      }

      // Mark all sessions as inactive
      const updatePromises = sessions.map(session => {
        const command = new UpdateCommand({
          TableName: this.userSessionsTableName,
          Key: { sessionId: session.sessionId },
          UpdateExpression: 'SET isActive = :false, updatedAt = :now, invalidationReason = :reason',
          ExpressionAttributeValues: {
            ':false': false,
            ':now': new Date().toISOString(),
            ':reason': 'session_migration_security_update'
          },
        });
        return this.docClient.send(command);
      });

      await Promise.all(updatePromises);
      console.log(`Successfully invalidated ${sessions.length} sessions for user ${userId}`);
    } catch (error) {
      console.error(`Error invalidating sessions for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get all sessions from the table (for cleanup operations)
   */
  async getAllSessions(): Promise<UserSession[]> {
    const sessions: UserSession[] = [];
    let lastEvaluatedKey: any = undefined;

    do {
      try {
        const scanCommand = new ScanCommand({
          TableName: this.userSessionsTableName,
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 100, // Process in batches
        });

        const result = await this.docClient.send(scanCommand);
        
        if (result.Items) {
          sessions.push(...(result.Items as UserSession[]));
        }
        
        lastEvaluatedKey = result.LastEvaluatedKey;
        
      } catch (error) {
        console.error('Error scanning sessions:', error);
        break;
      }
    } while (lastEvaluatedKey);

    return sessions;
  }

  /**
   * Determine if a session should be deleted during cleanup
   */
  shouldDeleteSession(session: UserSession, now: Date): { delete: boolean; reason?: string } {
    // Check if session has expired based on expiresAt
    const expiresAt = new Date(session.expiresAt);
    if (expiresAt <= now) {
      return { delete: true, reason: 'expired' };
    }

    // Check if session is marked as inactive
    if (!session.isActive) {
      return { delete: true, reason: 'inactive' };
    }

    // Check if session has been inactive for too long based on session timeout
    const lastActivity = new Date(session.lastActivity || session.loginTime);
    const sessionTimeoutMinutes = session.sessionTimeout || 480; // Default 8 hours
    const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
    
    if ((now.getTime() - lastActivity.getTime()) > timeoutMs) {
      return { delete: true, reason: 'expired' };
    }

    // Check for orphaned sessions (sessions older than 30 days regardless of activity)
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const createdAt = new Date((session as any).createdAt || session.loginTime);
    
    if (createdAt <= thirtyDaysAgo) {
      return { delete: true, reason: 'orphaned' };
    }

    // Session is still valid
    return { delete: false };
  }

  /**
   * Delete sessions in batches
   */
  async deleteSessions(sessionIds: string[]): Promise<number> {
    let deletedCount = 0;
    const batchSize = 25; // DynamoDB batch write limit

    // Process in batches of 25
    for (let i = 0; i < sessionIds.length; i += batchSize) {
      const batch = sessionIds.slice(i, i + batchSize);
      
      try {
        // Use individual delete commands for better error handling
        const deletePromises = batch.map(sessionId => {
          const deleteCommand = new DeleteCommand({
            TableName: this.userSessionsTableName,
            Key: { sessionId },
          });
          return this.docClient.send(deleteCommand);
        });

        await Promise.all(deletePromises);
        deletedCount += batch.length;
        
        console.log(`Deleted batch of ${batch.length} sessions (${deletedCount}/${sessionIds.length} total)`);
        
      } catch (error) {
        console.error(`Error deleting batch of sessions:`, error);
        
        // Try individual deletes for this batch
        for (const sessionId of batch) {
          try {
            await this.deleteSession(sessionId);
            deletedCount++;
          } catch (individualError) {
            console.error(`Error deleting individual session ${sessionId}:`, individualError);
          }
        }
      }

      // Small delay between batches to avoid throttling
      if (i + batchSize < sessionIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return deletedCount;
  }

  /**
   * Clean up expired sessions for a user
   */
  async cleanupExpiredSessions(userId: string): Promise<void> {
    try {
      const allSessions = await this.getAllSessionsForUser(userId);
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
      const deletePromises = expiredSessions.map(session => 
        this.deleteSession(session.sessionId)
      );

      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      // Don't throw - cleanup is optional
    }
  }

  /**
   * Create a new session
   */
  async createSession(sessionData: SessionData): Promise<void> {
    try {
      const command = new PutCommand({
        TableName: this.userSessionsTableName,
        Item: sessionData,
      });

      await this.docClient.send(command);
    } catch (error) {
      console.error('Error creating session:', error);
      throw new Error('Failed to create session');
    }
  }

  /**
   * Get user security settings
   */
  async getUserSecuritySettings(userId: string): Promise<UserSecuritySettings> {
    try {
      const USER_SECURITY_SETTINGS_TABLE = process.env.USER_SECURITY_SETTINGS_TABLE;
      if (!USER_SECURITY_SETTINGS_TABLE) {
        console.warn('USER_SECURITY_SETTINGS_TABLE not configured, using defaults');
        return {
          sessionTimeout: 480, // 8 hours
          allowMultipleSessions: true,
          maxFailedAttempts: 5,
          lockoutDuration: 15 * 60 * 1000, // 15 minutes
          passwordHistorySize: 5,
          requirePasswordChange: true,
          lastPasswordChange: new Date().toISOString(),
          failedLoginAttempts: 0,
          createdAt: new Date().toISOString(),
          twoFactorEnabled: false,
          requirePasswordChangeEvery: 0,
          passwordLastChanged: new Date().toISOString(),
        };
      }

      const command = new QueryCommand({
        TableName: USER_SECURITY_SETTINGS_TABLE,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'SECURITY',
        },
      });

      const result = await this.docClient.send(command);
      
      if (result.Items && result.Items.length > 0) {
        const settings = result.Items[0] as any;
        return {
          sessionTimeout: settings?.sessionTimeout || 480, // Default 8 hours
          allowMultipleSessions: settings?.allowMultipleSessions !== false, // Default true
          maxFailedAttempts: settings?.maxFailedAttempts || 5,
          lockoutDuration: settings?.lockoutDuration || (15 * 60 * 1000), // Default 15 minutes
          passwordHistorySize: settings?.passwordHistorySize || 5,
          requirePasswordChange: settings?.requirePasswordChange !== false, // Default true
          lastPasswordChange: settings?.lastPasswordChange || new Date().toISOString(),
          failedLoginAttempts: settings?.failedLoginAttempts || 0,
          lockedUntil: settings?.lockedUntil,
          createdAt: settings?.createdAt || new Date().toISOString(),
          twoFactorEnabled: settings?.twoFactorEnabled !== false,
          requirePasswordChangeEvery: settings?.requirePasswordChangeEvery || 0,
          passwordLastChanged: settings?.passwordLastChanged || new Date().toISOString(),
          twoFactorSecret: settings?.twoFactorSecret,
          backupCodes: settings?.backupCodes,
        };
      }
    } catch (error) {
      console.error('Error getting user security settings:', error);
    }
    
    // Return default settings if not found or error
    return {
      sessionTimeout: 480, // 8 hours
      allowMultipleSessions: true,
      maxFailedAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      passwordHistorySize: 5,
      requirePasswordChange: true,
      lastPasswordChange: new Date().toISOString(),
      failedLoginAttempts: 0,
      createdAt: new Date().toISOString(),
      twoFactorEnabled: false,
      requirePasswordChangeEvery: 0,
      passwordLastChanged: new Date().toISOString(),
    };
  }

  /**
   * Terminate user sessions (except current one)
   */
  async terminateUserSessions(userId: string, currentSessionToken: string): Promise<void> {
    try {
      // Query all active sessions for the user
      const command = new QueryCommand({
        TableName: this.userSessionsTableName,
        IndexName: 'UserIndex',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'isActive = :isActive AND sessionToken <> :currentToken',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':isActive': true,
          ':currentToken': currentSessionToken,
        },
      });

      const result = await this.docClient.send(command);

      if (result.Items && result.Items.length > 0) {
        // Terminate each session (set isActive to false)
        const updatePromises = result.Items.map(session => {
          const updateCommand = new PutCommand({
            TableName: this.userSessionsTableName,
            Item: {
              ...session,
              isActive: false,
              updatedAt: new Date().toISOString(),
            },
          });
          return this.docClient.send(updateCommand);
        });

        await Promise.all(updatePromises);
        console.log(`Terminated ${result.Items.length} existing sessions for user ${userId}`);
      }
    } catch (error) {
      console.error('Error terminating user sessions:', error);
      // Don't throw - session creation should still succeed even if cleanup fails
    }
  }

  /**
   * Check password history to prevent reuse
   */
  async checkPasswordHistory(userId: string, newPassword: string): Promise<boolean> {
    try {
      const PASSWORD_HISTORY_TABLE = process.env.PASSWORD_HISTORY_TABLE;
      if (!PASSWORD_HISTORY_TABLE) {
        console.warn('PASSWORD_HISTORY_TABLE not configured, skipping check');
        return false;
      }

      // Query password history (last 5 passwords)
      const command = new QueryCommand({
        TableName: PASSWORD_HISTORY_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false, // Get most recent first
        Limit: 5,
      });

      const result = await this.docClient.send(command);
      
      if (!result.Items || result.Items.length === 0) {
        return false;
      }

      const bcrypt = await import('bcryptjs');
      
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

  /**
   * Store password in history
   */
  async storePasswordHistory(userId: string, password: string): Promise<void> {
    try {
      const PASSWORD_HISTORY_TABLE = process.env.PASSWORD_HISTORY_TABLE;
      if (!PASSWORD_HISTORY_TABLE) {
        console.warn('PASSWORD_HISTORY_TABLE not configured, skipping storage');
        return;
      }

      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 12);
      const now = new Date().toISOString();

      await this.docClient.send(new PutCommand({
        TableName: PASSWORD_HISTORY_TABLE,
        Item: {
          userId,
          createdAt: now,
          passwordHash,
          expiresAt: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year TTL
        },
      }));

      // Clean up old password history (keep only last 5)
      const historyCommand = new QueryCommand({
        TableName: PASSWORD_HISTORY_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false,
        Limit: 10, // Get more than we need to clean up
      });

      const historyResult = await this.docClient.send(historyCommand);
      if (historyResult.Items && historyResult.Items.length > 5) {
        // Delete old entries beyond the 5 most recent
        const itemsToDelete = historyResult.Items.slice(5);
        for (const item of itemsToDelete) {
          await this.docClient.send(new DeleteCommand({
            TableName: PASSWORD_HISTORY_TABLE,
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

  /**
   * Get user security settings by user ID
   */
  async getUserSecuritySettingsById(userId: string): Promise<UserSecuritySettings> {
    try {
      const USER_SECURITY_SETTINGS_TABLE = process.env.USER_SECURITY_SETTINGS_TABLE;
      if (!USER_SECURITY_SETTINGS_TABLE) {
        console.warn('USER_SECURITY_SETTINGS_TABLE not configured');
        return {
          sessionTimeout: 480, // 8 hours
          allowMultipleSessions: true,
          maxFailedAttempts: 5,
          lockoutDuration: 15 * 60 * 1000, // 15 minutes
          passwordHistorySize: 5,
          requirePasswordChange: true,
          lastPasswordChange: new Date().toISOString(),
          failedLoginAttempts: 0,
          createdAt: new Date().toISOString(),
          twoFactorEnabled: false,
          requirePasswordChangeEvery: 0,
          passwordLastChanged: new Date().toISOString(),
        };
      }

      const command = new GetCommand({
        TableName: USER_SECURITY_SETTINGS_TABLE,
        Key: { userId },
      });

      const result = await this.docClient.send(command);
      return result.Item as UserSecuritySettings || {
        sessionTimeout: 480, // 8 hours
        allowMultipleSessions: true,
        maxFailedAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes
        passwordHistorySize: 5,
        requirePasswordChange: true,
        lastPasswordChange: new Date().toISOString(),
        failedLoginAttempts: 0,
        createdAt: new Date().toISOString(),
        twoFactorEnabled: false,
        requirePasswordChangeEvery: 0,
        passwordLastChanged: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting security settings:', error);
      return {
        sessionTimeout: 480, // 8 hours
        allowMultipleSessions: true,
        maxFailedAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes
        passwordHistorySize: 5,
        requirePasswordChange: true,
        lastPasswordChange: new Date().toISOString(),
        failedLoginAttempts: 0,
        createdAt: new Date().toISOString(),
        twoFactorEnabled: false,
        requirePasswordChangeEvery: 0,
        passwordLastChanged: new Date().toISOString(),
      };
    }
  }

  /**
   * Update password change timestamp
   */
  async updatePasswordChangeTimestamp(userId: string): Promise<void> {
    try {
      const USER_SECURITY_SETTINGS_TABLE = process.env.USER_SECURITY_SETTINGS_TABLE;
      if (!USER_SECURITY_SETTINGS_TABLE) {
        console.warn('USER_SECURITY_SETTINGS_TABLE not configured');
        return;
      }

      const now = new Date().toISOString();
      
      // Get existing settings or create defaults
      const existingSettings = await this.getUserSecuritySettingsById(userId);
      
      const settings = {
        userId,
        ...existingSettings, // Keep existing settings first
        passwordLastChanged: now, // Update this field
      };

      await this.docClient.send(new PutCommand({
        TableName: USER_SECURITY_SETTINGS_TABLE,
        Item: settings,
      }));
    } catch (error) {
      console.error('Error updating password change timestamp:', error);
      // Don't fail password change if this update fails
    }
  }

  /**
   * Reset failed login attempts
   */
  async resetFailedLoginAttempts(userId: string): Promise<void> {
    try {
      const existingSettings = await this.getUserSecuritySettingsById(userId);
      if (!existingSettings) return;

      const USER_SECURITY_SETTINGS_TABLE = process.env.USER_SECURITY_SETTINGS_TABLE;
      if (!USER_SECURITY_SETTINGS_TABLE) return;

      const updatedSettings = {
        ...existingSettings,
        failedLoginAttempts: 0,
        accountLockedUntil: undefined, // Remove lockout
      };

      await this.docClient.send(new PutCommand({
        TableName: USER_SECURITY_SETTINGS_TABLE,
        Item: updatedSettings,
      }));
    } catch (error) {
      console.error('Error resetting failed login attempts:', error);
    }
  }

  /**
   * Update user security settings
   */
  async updateUserSecuritySettings(userId: string, updates: SecuritySettingsUpdate): Promise<UserSecuritySettings> {
    try {
      const USER_SECURITY_SETTINGS_TABLE = process.env.USER_SECURITY_SETTINGS_TABLE;
      if (!USER_SECURITY_SETTINGS_TABLE) {
        throw new Error('USER_SECURITY_SETTINGS_TABLE not configured');
      }

      const now = new Date().toISOString();
      const settings: UserSecuritySettings = {
        twoFactorEnabled: updates.twoFactorEnabled ?? false,
        sessionTimeout: updates.sessionTimeout ?? 480,
        allowMultipleSessions: updates.allowMultipleSessions ?? true,
        requirePasswordChangeEvery: updates.requirePasswordChangeEvery ?? 0,
        passwordLastChanged: now,
        failedLoginAttempts: 0,
        maxFailedAttempts: updates.maxFailedAttempts ?? 5,
        lockoutDuration: updates.lockoutDuration ?? (15 * 60 * 1000),
        passwordHistorySize: updates.passwordHistorySize ?? 5,
        requirePasswordChange: updates.requirePasswordChange ?? false,
        lastPasswordChange: now,
        createdAt: now
      };

      const command = new PutCommand({
        TableName: USER_SECURITY_SETTINGS_TABLE,
        Item: {
          userId,
          ...settings,
          updatedAt: now
        }
      });

      await this.docClient.send(command);
      return settings;
    } catch (error) {
      console.error('Error updating security settings:', error);
      throw error;
    }
  }
} 