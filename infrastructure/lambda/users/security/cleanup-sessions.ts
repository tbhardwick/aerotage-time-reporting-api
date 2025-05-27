import { ScheduledEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

interface CleanupResult {
  totalSessions: number;
  expiredSessions: number;
  inactiveSessions: number;
  orphanedSessions: number;
  deletedSessions: number;
  errors: number;
}

export const handler = async (event: ScheduledEvent, context: Context): Promise<CleanupResult> => {
  console.log('Starting session cleanup job:', JSON.stringify(event, null, 2));
  
  const result: CleanupResult = {
    totalSessions: 0,
    expiredSessions: 0,
    inactiveSessions: 0,
    orphanedSessions: 0,
    deletedSessions: 0,
    errors: 0,
  };

  try {
    // Scan all sessions in the table
    const sessions = await getAllSessions();
    result.totalSessions = sessions.length;

    console.log(`Found ${sessions.length} total sessions to analyze`);

    if (sessions.length === 0) {
      console.log('No sessions found, cleanup complete');
      return result;
    }

    // Categorize sessions for cleanup
    const now = new Date();
    const sessionsToDelete: string[] = [];

    for (const session of sessions) {
      try {
        const shouldDelete = shouldDeleteSession(session, now);
        
        if (shouldDelete.delete) {
          sessionsToDelete.push(session.sessionId);
          
          // Track cleanup reasons
          if (shouldDelete.reason === 'expired') {
            result.expiredSessions++;
          } else if (shouldDelete.reason === 'inactive') {
            result.inactiveSessions++;
          } else if (shouldDelete.reason === 'orphaned') {
            result.orphanedSessions++;
          }
        }
      } catch (error) {
        console.error(`Error analyzing session ${session.sessionId}:`, error);
        result.errors++;
      }
    }

    console.log(`Sessions to delete: ${sessionsToDelete.length}`);
    console.log(`  Expired: ${result.expiredSessions}`);
    console.log(`  Inactive: ${result.inactiveSessions}`);
    console.log(`  Orphaned: ${result.orphanedSessions}`);

    // Delete sessions in batches
    if (sessionsToDelete.length > 0) {
      const deletedCount = await deleteSessions(sessionsToDelete);
      result.deletedSessions = deletedCount;
    }

    console.log(`Session cleanup completed successfully:`);
    console.log(`  Total sessions analyzed: ${result.totalSessions}`);
    console.log(`  Sessions deleted: ${result.deletedSessions}`);
    console.log(`  Errors: ${result.errors}`);

    return result;

  } catch (error) {
    console.error('Session cleanup job failed:', error);
    result.errors++;
    return result;
  }
};

/**
 * Get all sessions from the table
 */
async function getAllSessions(): Promise<any[]> {
  const sessions: any[] = [];
  let lastEvaluatedKey: any = undefined;

  do {
    try {
      const scanCommand = new ScanCommand({
        TableName: process.env.USER_SESSIONS_TABLE!,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 100, // Process in batches
      });

      const result = await docClient.send(scanCommand);
      
      if (result.Items) {
        sessions.push(...result.Items);
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
 * Determine if a session should be deleted
 */
function shouldDeleteSession(session: any, now: Date): { delete: boolean; reason?: string } {
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
  const createdAt = new Date(session.createdAt || session.loginTime);
  
  if (createdAt <= thirtyDaysAgo) {
    return { delete: true, reason: 'orphaned' };
  }

  // Session is still valid
  return { delete: false };
}

/**
 * Delete sessions in batches
 */
async function deleteSessions(sessionIds: string[]): Promise<number> {
  let deletedCount = 0;
  const batchSize = 25; // DynamoDB batch write limit

  // Process in batches of 25
  for (let i = 0; i < sessionIds.length; i += batchSize) {
    const batch = sessionIds.slice(i, i + batchSize);
    
    try {
      // Use individual delete commands for better error handling
      const deletePromises = batch.map(sessionId => {
        const deleteCommand = new DeleteCommand({
          TableName: process.env.USER_SESSIONS_TABLE!,
          Key: { sessionId },
        });
        return docClient.send(deleteCommand);
      });

      await Promise.all(deletePromises);
      deletedCount += batch.length;
      
      console.log(`Deleted batch of ${batch.length} sessions (${deletedCount}/${sessionIds.length} total)`);
      
    } catch (error) {
      console.error(`Error deleting batch of sessions:`, error);
      
      // Try individual deletes for this batch
      for (const sessionId of batch) {
        try {
          const deleteCommand = new DeleteCommand({
            TableName: process.env.USER_SESSIONS_TABLE!,
            Key: { sessionId },
          });
          await docClient.send(deleteCommand);
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