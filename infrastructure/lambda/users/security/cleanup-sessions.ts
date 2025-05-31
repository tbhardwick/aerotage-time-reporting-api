import { ScheduledEvent } from 'aws-lambda';
import { SessionRepository } from '../../shared/session-repository';

const sessionRepo = new SessionRepository();

interface CleanupResult {
  totalSessions: number;
  expiredSessions: number;
  inactiveSessions: number;
  orphanedSessions: number;
  deletedSessions: number;
  errors: number;
}

export const handler = async (event: ScheduledEvent): Promise<CleanupResult> => {
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
    // Get all sessions using repository
    const sessions = await sessionRepo.getAllSessions();
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
        const shouldDelete = sessionRepo.shouldDeleteSession(session, now);
        
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

    // Delete sessions in batches using repository
    if (sessionsToDelete.length > 0) {
      const deletedCount = await sessionRepo.deleteSessions(sessionsToDelete);
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