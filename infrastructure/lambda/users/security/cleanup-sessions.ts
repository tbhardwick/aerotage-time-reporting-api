import { ScheduledEvent } from 'aws-lambda';
import { SessionRepository } from '../../shared/session-repository';

// PowerTools v2.x imports
import { logger, businessLogger, addRequestContext } from '../../shared/powertools-logger';
import { tracer, businessTracer } from '../../shared/powertools-tracer';
import { metrics, businessMetrics } from '../../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools v2.x middleware
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const sessionRepo = new SessionRepository();

interface CleanupResult {
  totalSessions: number;
  expiredSessions: number;
  inactiveSessions: number;
  orphanedSessions: number;
  deletedSessions: number;
  errors: number;
}

const lambdaHandler = async (event: ScheduledEvent): Promise<CleanupResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = `cleanup-${Date.now()}`;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, 'SCHEDULED', '/users/security/cleanup-sessions');

    logger.info('Session cleanup job started', {
      requestId,
      eventSource: event.source,
      eventTime: event.time,
      eventId: event.id
    });

    const result: CleanupResult = {
      totalSessions: 0,
      expiredSessions: 0,
      inactiveSessions: 0,
      orphanedSessions: 0,
      deletedSessions: 0,
      errors: 0,
    };

    // Get all sessions using repository with tracing
    const sessions = await businessTracer.traceDatabaseOperation(
      'get-all-sessions',
      'user_sessions',
      async () => {
        return await sessionRepo.getAllSessions();
      }
    );

    result.totalSessions = sessions.length;

    logger.info('Sessions retrieved for cleanup analysis', { 
      totalSessions: sessions.length
    });

    if (sessions.length === 0) {
      const executionTime = Date.now() - startTime;
      
      // Track metrics for empty cleanup
      businessMetrics.trackApiPerformance('/users/security/cleanup-sessions', 'SCHEDULED', 200, executionTime);
      businessLogger.logBusinessOperation('cleanup', 'sessions', 'system', true, { 
        totalSessions: 0,
        deletedSessions: 0,
        executionTime
      });

      logger.info('No sessions found, cleanup complete', { executionTime });
      return result;
    }

    // Categorize sessions for cleanup with tracing
    const cleanupAnalysis = await businessTracer.traceBusinessOperation(
      'analyze-sessions-for-cleanup',
      'security',
      async () => {
        const now = new Date();
        const sessionsToDelete: string[] = [];
        let analysisErrors = 0;

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
            logger.error('Error analyzing session for cleanup', {
              sessionId: session.sessionId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            analysisErrors++;
          }
        }

        result.errors = analysisErrors;
        return { sessionsToDelete, analysisErrors };
      }
    );

    logger.info('Session cleanup analysis completed', { 
      totalSessions: result.totalSessions,
      sessionsToDelete: cleanupAnalysis.sessionsToDelete.length,
      expiredSessions: result.expiredSessions,
      inactiveSessions: result.inactiveSessions,
      orphanedSessions: result.orphanedSessions,
      analysisErrors: cleanupAnalysis.analysisErrors
    });

    // Delete sessions in batches using repository with tracing
    if (cleanupAnalysis.sessionsToDelete.length > 0) {
      const deletedCount = await businessTracer.traceDatabaseOperation(
        'delete-expired-sessions',
        'user_sessions',
        async () => {
          return await sessionRepo.deleteSessions(cleanupAnalysis.sessionsToDelete);
        }
      );
      result.deletedSessions = deletedCount;
    }

    const executionTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/security/cleanup-sessions', 'SCHEDULED', 200, executionTime);
    businessLogger.logBusinessOperation('cleanup', 'sessions', 'system', true, { 
      totalSessions: result.totalSessions,
      expiredSessions: result.expiredSessions,
      inactiveSessions: result.inactiveSessions,
      orphanedSessions: result.orphanedSessions,
      deletedSessions: result.deletedSessions,
      errors: result.errors,
      executionTime
    });

    logger.info('Session cleanup completed successfully', { 
      totalSessions: result.totalSessions,
      deletedSessions: result.deletedSessions,
      expiredSessions: result.expiredSessions,
      inactiveSessions: result.inactiveSessions,
      orphanedSessions: result.orphanedSessions,
      errors: result.errors,
      executionTime
    });

    return result;

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/users/security/cleanup-sessions', 'SCHEDULED', 500, executionTime);
    businessLogger.logError(error as Error, 'session-cleanup', 'system');

    logger.error('Session cleanup job failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      executionTime
    });

    const result: CleanupResult = {
      totalSessions: 0,
      expiredSessions: 0,
      inactiveSessions: 0,
      orphanedSessions: 0,
      deletedSessions: 0,
      errors: 1,
    };

    return result;
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 