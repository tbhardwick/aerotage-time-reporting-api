import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { UserRepository } from '../shared/user-repository';
import { 
  UserWorkSchedule,
  WorkDaySchedule
} from '../shared/types';

// ✅ NEW: Import PowerTools utilities with correct v2.x pattern
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// ✅ NEW: Import Middy middleware for PowerTools v2.x
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const userRepo = new UserRepository();

// ✅ FIXED: Use correct PowerTools v2.x middleware pattern
const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // ✅ NEW: Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);
    
    logger.info('Work schedule get request started', {
      requestId,
      httpMethod: event.httpMethod,
      path: event.path,
      pathParameters: event.pathParameters,
    });

    // ✅ NEW: Track API request metrics
    businessMetrics.trackApiPerformance(
      '/users/work-schedule',
      'GET',
      0, // Will be updated later
      0  // Will be updated later
    );

    // ✅ NEW: Trace authentication
    const authResult = await businessTracer.traceBusinessOperation(
      'authenticate-user',
      'work-schedule-access',
      async () => {
        // Extract user information
        const userId = getCurrentUserId(event);
        const user = getAuthenticatedUser(event);
        
        if (!userId) {
          logger.warn('User not authenticated');
          throw new Error('User not authenticated');
        }

        logger.info('User authenticated successfully', { 
          userId, 
          userRole: user?.role 
        });

        return { userId, user };
      }
    );

    // ✅ NEW: Add user context to tracer
    businessTracer.addUserContext(authResult.userId, authResult.user?.role, authResult.user?.department);
    addRequestContext(requestId, authResult.userId, authResult.user?.role);

    // ✅ NEW: Trace authorization logic
    const authorizationResult = await businessTracer.traceBusinessOperation(
      'authorize-access',
      'work-schedule-access',
      async () => {
        // Get target user ID from path parameters or use current user
        const targetUserId = event.pathParameters?.userId || authResult.userId;

        // Check permissions - employees can only view their own schedule
        if (authResult.user?.role === 'employee' && targetUserId !== authResult.userId) {
          logger.warn('Access denied: employee trying to access other user schedule', {
            currentUserId: authResult.userId,
            targetUserId,
            userRole: authResult.user.role
          });
          throw new Error('Employees can only view their own work schedule');
        }

        logger.info('Authorization passed', { 
          currentUserId: authResult.userId,
          targetUserId,
          userRole: authResult.user?.role 
        });

        return { targetUserId };
      }
    );

    // ✅ NEW: Trace database operation
    const workSchedule = await businessTracer.traceDatabaseOperation(
      'get',
      'user-work-schedule',
      async () => {
        logger.info('Fetching work schedule from database', { 
          targetUserId: authorizationResult.targetUserId 
        });
        
        const schedule = await userRepo.getUserWorkSchedule(authorizationResult.targetUserId);
        
                 if (schedule) {
           logger.info('Work schedule found in database', { 
             targetUserId: authorizationResult.targetUserId,
             timezone: schedule.timezone
           });
         } else {
           logger.info('No work schedule found in database, will use default', { 
             targetUserId: authorizationResult.targetUserId 
           });
         }

         return schedule;
      }
    );

    // ✅ NEW: Trace response preparation
    const responseData = await businessTracer.traceBusinessOperation(
      'prepare-response',
      'work-schedule',
      async () => {
        if (!workSchedule) {
          // Return default work schedule if none exists
          const defaultSchedule = createDefaultWorkSchedule(authorizationResult.targetUserId);
          
          logger.info('Created default work schedule', { 
            targetUserId: authorizationResult.targetUserId,
            weeklyTargetHours: defaultSchedule.weeklyTargetHours,
            timezone: defaultSchedule.timezone
          });
          
          return { schedule: defaultSchedule, isDefault: true };
        }

                 logger.info('Using existing work schedule', { 
           targetUserId: authorizationResult.targetUserId,
           timezone: workSchedule.timezone
         });

        return { schedule: workSchedule, isDefault: false };
      }
    );

    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Track successful metrics
    businessMetrics.trackApiPerformance('/users/work-schedule', 'GET', 200, responseTime);
    businessMetrics.trackBusinessKPI('WorkScheduleRetrieved', 1, MetricUnit.Count);
    if (responseData.isDefault) {
      businessMetrics.trackBusinessKPI('DefaultWorkScheduleUsed', 1, MetricUnit.Count);
    }
    
         businessLogger.logBusinessOperation('get', 'work-schedule', authResult.userId, true, { 
       targetUserId: authorizationResult.targetUserId,
       isDefault: responseData.isDefault,
       weeklyTargetHours: 'weeklyTargetHours' in responseData.schedule ? responseData.schedule.weeklyTargetHours : 40
     });

    logger.info('Work schedule retrieved successfully', { 
      targetUserId: authorizationResult.targetUserId,
      isDefault: responseData.isDefault,
      responseTime 
    });

    const message = responseData.isDefault 
      ? 'Default work schedule retrieved'
      : 'Work schedule retrieved successfully';

    return createSuccessResponse(responseData.schedule, 200, message);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Enhanced error handling with PowerTools
    logger.error('Work schedule retrieval failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime 
    });

    // ✅ NEW: Track error metrics
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let errorMessage = 'An unexpected error occurred';

    if (error instanceof Error) {
      if (error.message === 'User not authenticated') {
        statusCode = 401;
        errorCode = 'UNAUTHORIZED';
        errorMessage = 'User not authenticated';
      } else if (error.message === 'Employees can only view their own work schedule') {
        statusCode = 403;
        errorCode = 'FORBIDDEN';
        errorMessage = 'Employees can only view their own work schedule';
      }
    }

    businessMetrics.trackApiPerformance('/users/work-schedule', 'GET', statusCode, responseTime);
    businessMetrics.trackBusinessKPI('WorkScheduleRetrievalError', 1, MetricUnit.Count);
    businessLogger.logBusinessOperation('get', 'work-schedule', 'unknown', false, { 
      errorCode,
      errorMessage 
    });

    return createErrorResponse(statusCode, errorCode, errorMessage);
  }
};

function createDefaultWorkSchedule(userId: string): UserWorkSchedule {
  const defaultWorkDay: WorkDaySchedule = {
    start: '09:00',
    end: '17:00',
    targetHours: 8,
  };

  const defaultWeekend: WorkDaySchedule = {
    start: null,
    end: null,
    targetHours: 0,
  };

  const now = new Date().toISOString();

  return {
    userId,
    schedule: {
      monday: defaultWorkDay,
      tuesday: defaultWorkDay,
      wednesday: defaultWorkDay,
      thursday: defaultWorkDay,
      friday: defaultWorkDay,
      saturday: defaultWeekend,
      sunday: defaultWeekend,
    },
    timezone: 'America/New_York',
    weeklyTargetHours: 40,
    createdAt: now,
    updatedAt: now,
  };
}

// ✅ NEW: Export handler with PowerTools v2.x middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }))
  .use(logMetrics(metrics)); 