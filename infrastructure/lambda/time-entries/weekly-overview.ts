import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { UserRepository } from '../shared/user-repository';
import { 
  WeeklyOverviewRequest,
  WeeklyOverview,
  DailySummary,
  WeeklyProjectBreakdown,
  TimeEntry,
  UserWorkSchedule,
  TimeTrackingErrorCodes,
  SuccessResponse
} from '../shared/types';

// PowerTools v2.x imports
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools v2.x middleware
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const timeEntryRepo = new TimeEntryRepository();
const userRepo = new UserRepository();

interface WeeklyTotals {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  targetHours: number;
  completionPercentage: number;
  totalEntries: number;
}

interface WeeklyPatterns {
  mostProductiveDay: string;
  leastProductiveDay: string;
  averageStartTime: string;
  averageEndTime: string;
  longestWorkDay: string;
  shortestWorkDay: string;
}

interface WeeklyComparison {
  previousWeek: {
    totalHours: number;
    change: string;
    changePercentage: string;
  };
}

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Weekly overview request received', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // Extract user information
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/weekly-overview', 'GET', 401, responseTime);
      businessLogger.logAuth(userId || 'unknown', 'weekly-overview', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // Add user context to tracer and logger
    businessTracer.addUserContext(userId);
    addRequestContext(requestId, userId);

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    
    // Validate required parameters
    if (!queryParams.weekStartDate) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/weekly-overview', 'GET', 400, responseTime);
      businessLogger.logError(new Error('Missing weekStartDate parameter'), 'weekly-overview-validation', userId);
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_DATE_RANGE, 'weekStartDate is required');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(queryParams.weekStartDate)) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/weekly-overview', 'GET', 400, responseTime);
      businessLogger.logError(new Error('Invalid weekStartDate format'), 'weekly-overview-validation', userId, { weekStartDate: queryParams.weekStartDate });
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_DATE_RANGE, 'weekStartDate must be in YYYY-MM-DD format');
    }

    // Validate that weekStartDate is a Monday
    const weekStart = new Date(queryParams.weekStartDate);
    if (weekStart.getDay() !== 1) { // 1 = Monday
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/weekly-overview', 'GET', 400, responseTime);
      businessLogger.logError(new Error('weekStartDate is not a Monday'), 'weekly-overview-validation', userId, { weekStartDate: queryParams.weekStartDate, dayOfWeek: weekStart.getDay() });
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_DATE_RANGE, 'weekStartDate must be a Monday');
    }

    // Check for future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (weekStart > today) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/weekly-overview', 'GET', 400, responseTime);
      businessLogger.logError(new Error('Future date not allowed'), 'weekly-overview-validation', userId, { weekStartDate: queryParams.weekStartDate });
      return createErrorResponse(400, TimeTrackingErrorCodes.FUTURE_DATE_NOT_ALLOWED, 'Cannot analyze future weeks');
    }

    // Build request object
    const request: WeeklyOverviewRequest = {
      weekStartDate: queryParams.weekStartDate,
      userId: queryParams.userId || userId,
      includeComparison: queryParams.includeComparison === 'true',
    };

    // Check permissions - employees can only see their own data
    if (user?.role === 'employee' && request.userId !== userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/time-entries/weekly-overview', 'GET', 403, responseTime);
      businessLogger.logAuth(userId, 'weekly-overview', false, { 
        reason: 'employee_accessing_other_user_data',
        requestedUserId: request.userId 
      });
      return createErrorResponse(403, 'FORBIDDEN', 'Employees can only view their own time data');
    }

    // Generate weekly overview with tracing
    const weeklyOverview = await businessTracer.traceBusinessOperation(
      'generate-weekly-overview',
      'time-entry',
      async () => {
        return await generateWeeklyOverview(request);
      }
    );

    const responseTime = Date.now() - startTime;
    
    // Track success metrics
    businessMetrics.trackApiPerformance('/time-entries/weekly-overview', 'GET', 200, responseTime);
    businessLogger.logBusinessOperation('weekly-overview', 'time-entry', userId, true, { 
      weekStartDate: request.weekStartDate,
      targetUserId: request.userId,
      totalHours: weeklyOverview.weeklyTotals.totalHours,
      totalEntries: weeklyOverview.weeklyTotals.totalEntries
    });

    logger.info('Weekly overview generated successfully', { 
      userId, 
      weekStartDate: request.weekStartDate,
      responseTime 
    });

    const response: SuccessResponse<WeeklyOverview> = {
      success: true,
      data: weeklyOverview,
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
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/time-entries/weekly-overview', 'GET', 500, responseTime);
    businessLogger.logError(error as Error, 'weekly-overview', getCurrentUserId(event) || 'unknown');

    logger.error('Error generating weekly overview', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics));

async function generateWeeklyOverview(request: WeeklyOverviewRequest): Promise<WeeklyOverview> {
  const weekStart = new Date(request.weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4); // Friday (5 work days)

  // Get week info
  const weekInfo = {
    weekStartDate: request.weekStartDate,
    weekEndDate: weekEnd.toISOString().split('T')[0],
    weekNumber: getWeekNumber(weekStart),
    year: weekStart.getFullYear(),
  };

  logger.info('Generating weekly overview', {
    weekInfo,
    userId: request.userId
  });

  // Get user's work schedule using repository
  const workSchedule = await businessTracer.traceDatabaseOperation(
    'get',
    'user-work-schedule',
    async () => {
      return await userRepo.getUserWorkSchedule(request.userId!);
    }
  );

  // Get daily summaries for the week
  const dailySummaries = await businessTracer.traceBusinessOperation(
    'get-daily-summaries',
    'time-entry',
    async () => {
      return await getDailySummariesForWeek(request.userId!, weekStart, weekEnd, workSchedule as UserWorkSchedule | null);
    }
  );

  // Calculate weekly totals
  const weeklyTotals = calculateWeeklyTotals(dailySummaries);

  // Calculate patterns
  const patterns = calculateWeeklyPatterns(dailySummaries);

  // Calculate project distribution
  const projectDistribution = await businessTracer.traceBusinessOperation(
    'calculate-project-distribution',
    'time-entry',
    async () => {
      return await calculateWeeklyProjectDistribution(request.userId!, weekStart, weekEnd);
    }
  );

  // Get comparison data if requested
  let comparison;
  if (request.includeComparison) {
    comparison = await businessTracer.traceBusinessOperation(
      'get-weekly-comparison',
      'time-entry',
      async () => {
        return await getWeeklyComparison(request.userId!, weekStart);
      }
    );
  }

  logger.info('Weekly overview calculation completed', {
    weeklyTotals,
    patternsCalculated: !!patterns,
    projectDistributionCount: projectDistribution.length,
    comparisonIncluded: !!comparison
  });

  return {
    weekInfo: {
      weekStartDate: weekInfo.weekStartDate,
      weekEndDate: weekInfo.weekEndDate!,
      weekNumber: weekInfo.weekNumber,
      year: weekInfo.year,
    },
    dailySummaries,
    weeklyTotals,
    patterns,
    projectDistribution,
    comparison,
  };
}

async function getDailySummariesForWeek(
  userId: string,
  weekStart: Date,
  weekEnd: Date,
  workSchedule: UserWorkSchedule | null
): Promise<DailySummary[]> {
  const summaries: DailySummary[] = [];

  for (let date = new Date(weekStart); date <= weekEnd; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Get time entries for this date using repository
    const timeEntries = await getTimeEntriesForDate(userId, dateStr!);
    
    // Get work schedule for this day
    const daySchedule = workSchedule?.schedule[dayOfWeek as keyof typeof workSchedule.schedule];
    const targetHours = daySchedule?.targetHours || 8;
    
    // Calculate basic daily summary (without gaps for performance)
    const summary = calculateBasicDailySummary(dateStr!, dayOfWeek, timeEntries, targetHours);
    summaries.push(summary);
  }

  return summaries;
}

async function getTimeEntriesForDate(userId: string, date: string): Promise<TimeEntry[]> {
  try {
    // Use repository to get time entries for date
    const timeEntries = await timeEntryRepo.getTimeEntriesForUserAndDate(userId, date);
    return timeEntries;
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return [];
  }
}

function calculateBasicDailySummary(
  date: string,
  dayOfWeek: string,
  timeEntries: TimeEntry[],
  targetHours: number
): DailySummary {
  const totalMinutes = timeEntries.reduce((sum, entry) => sum + entry.duration, 0);
  const billableMinutes = timeEntries.filter(entry => entry.isBillable).reduce((sum, entry) => sum + entry.duration, 0);
  const nonBillableMinutes = totalMinutes - billableMinutes;
  
  const targetMinutes = targetHours * 60;
  const completionPercentage = targetMinutes > 0 ? (totalMinutes / targetMinutes) * 100 : 0;

  return {
    date,
    dayOfWeek: dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1),
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    billableMinutes,
    billableHours: Math.round((billableMinutes / 60) * 100) / 100,
    nonBillableMinutes,
    nonBillableHours: Math.round((nonBillableMinutes / 60) * 100) / 100,
    targetMinutes,
    targetHours,
    completionPercentage: Math.round(completionPercentage * 100) / 100,
    entriesCount: timeEntries.length,
    projectBreakdown: [], // Simplified for weekly overview
    timeGaps: [], // Not included in weekly overview for performance
    workingHours: {
      firstEntry: null,
      lastEntry: null,
      totalSpan: null,
    },
  };
}

function calculateWeeklyTotals(dailySummaries: DailySummary[]): WeeklyTotals {
  const totalHours = dailySummaries.reduce((sum, day) => sum + day.totalHours, 0);
  const billableHours = dailySummaries.reduce((sum, day) => sum + day.billableHours, 0);
  const nonBillableHours = dailySummaries.reduce((sum, day) => sum + day.nonBillableHours, 0);
  const targetHours = dailySummaries.reduce((sum, day) => sum + day.targetHours, 0);
  const totalEntries = dailySummaries.reduce((sum, day) => sum + day.entriesCount, 0);

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    billableHours: Math.round(billableHours * 100) / 100,
    nonBillableHours: Math.round(nonBillableHours * 100) / 100,
    targetHours: Math.round(targetHours * 100) / 100,
    completionPercentage: targetHours > 0 ? Math.round((totalHours / targetHours) * 10000) / 100 : 0,
    totalEntries,
  };
}

function calculateWeeklyPatterns(dailySummaries: DailySummary[]): WeeklyPatterns {
  // Find most and least productive days
  const workDays = dailySummaries.filter(day => day.totalHours > 0);
  
  let mostProductiveDay = 'Monday';
  let leastProductiveDay = 'Monday';
  let maxHours = 0;
  let minHours = Infinity;

  workDays.forEach(day => {
    if (day.totalHours > maxHours) {
      maxHours = day.totalHours;
      mostProductiveDay = day.dayOfWeek;
    }
    if (day.totalHours < minHours) {
      minHours = day.totalHours;
      leastProductiveDay = day.dayOfWeek;
    }
  });

  // Calculate average start/end times (simplified)
  const averageStartTime = '08:30'; // TODO: Calculate from actual data
  const averageEndTime = '17:30'; // TODO: Calculate from actual data

  return {
    mostProductiveDay,
    leastProductiveDay,
    averageStartTime,
    averageEndTime,
    longestWorkDay: mostProductiveDay,
    shortestWorkDay: leastProductiveDay,
  };
}

async function calculateWeeklyProjectDistribution(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyProjectBreakdown[]> {
  // Get all time entries for the week
  const allEntries: TimeEntry[] = [];
  
  for (let date = new Date(weekStart); date <= weekEnd; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    const entries = await getTimeEntriesForDate(userId, dateStr!);
    allEntries.push(...entries);
  }

  // Group by project
  const projectMap = new Map<string, { 
    totalMinutes: number; 
    projectName: string; 
    clientName: string;
    dailyBreakdown: Map<string, number>;
  }>();

  allEntries.forEach(entry => {
    const existing = projectMap.get(entry.projectId);
    if (existing) {
      existing.totalMinutes += entry.duration;
      const dayMinutes = existing.dailyBreakdown.get(entry.date) || 0;
      existing.dailyBreakdown.set(entry.date, dayMinutes + entry.duration);
    } else {
      const dailyBreakdown = new Map<string, number>();
      dailyBreakdown.set(entry.date, entry.duration);
      
      projectMap.set(entry.projectId, {
        totalMinutes: entry.duration,
        projectName: `Project ${entry.projectId}`, // TODO: Fetch actual project name
        clientName: 'Client Name', // TODO: Fetch actual client name
        dailyBreakdown,
      });
    }
  });

  const totalMinutes = allEntries.reduce((sum, entry) => sum + entry.duration, 0);

  return Array.from(projectMap.entries()).map(([projectId, data]) => ({
    projectId,
    projectName: data.projectName,
    clientName: data.clientName,
    totalHours: Math.round((data.totalMinutes / 60) * 100) / 100,
    percentage: totalMinutes > 0 ? Math.round((data.totalMinutes / totalMinutes) * 10000) / 100 : 0,
    dailyBreakdown: Array.from(data.dailyBreakdown.entries()).map(([date, minutes]) => ({
      date,
      hours: Math.round((minutes / 60) * 100) / 100,
    })),
  }));
}

async function getWeeklyComparison(userId: string, currentWeekStart: Date): Promise<WeeklyComparison> {
  // Get previous week data
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(previousWeekStart);
  previousWeekEnd.setDate(previousWeekEnd.getDate() + 4);

  // Get previous week entries
  const previousWeekEntries: TimeEntry[] = [];
  
  for (let date = new Date(previousWeekStart); date <= previousWeekEnd; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    const entries = await getTimeEntriesForDate(userId, dateStr!);
    previousWeekEntries.push(...entries);
  }

  const previousWeekHours = previousWeekEntries.reduce((sum, entry) => sum + entry.duration, 0) / 60;
  
  // This would be compared with current week in the calling function
  return {
    previousWeek: {
      totalHours: Math.round(previousWeekHours * 100) / 100,
      change: '+0.0', // Will be calculated by caller
      changePercentage: '+0.0%', // Will be calculated by caller
    },
  };
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
} 