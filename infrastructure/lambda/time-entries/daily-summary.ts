import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { 
  DailySummaryRequest,
  DailySummaryResponse,
  DailySummary,
  TimeEntry,
  ProjectTimeBreakdown,
  TimeGap,
  UserWorkSchedule,
  TimeTrackingErrorCodes,
  SuccessResponse
} from '../shared/types';

interface DaySchedule {
  targetHours: number;
  start: string | null;
  end: string | null;
}

interface PeriodSummary {
  totalDays: number;
  workDays: number;
  totalHours: number;
  averageHoursPerDay: number;
  targetHours: number;
  completionPercentage: number;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    
    // Validate required parameters
    if (!queryParams.startDate || !queryParams.endDate) {
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_DATE_RANGE, 'startDate and endDate are required');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(queryParams.startDate) || !dateRegex.test(queryParams.endDate)) {
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_DATE_RANGE, 'Dates must be in YYYY-MM-DD format');
    }

    // Check date range (max 31 days)
    const startDate = new Date(queryParams.startDate);
    const endDate = new Date(queryParams.endDate);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 31) {
      return createErrorResponse(400, TimeTrackingErrorCodes.DATE_RANGE_TOO_LARGE, 'Date range cannot exceed 31 days');
    }

    if (endDate < startDate) {
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_DATE_RANGE, 'End date must be after start date');
    }

    // Check for future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (endDate > today) {
      return createErrorResponse(400, TimeTrackingErrorCodes.FUTURE_DATE_NOT_ALLOWED, 'Cannot analyze future dates');
    }

    // Build request object
    const request: DailySummaryRequest = {
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
      userId: queryParams.userId || currentUserId,
      includeGaps: queryParams.includeGaps !== 'false',
      targetHours: queryParams.targetHours ? parseFloat(queryParams.targetHours) : undefined,
    };

    // Check permissions - employees can only see their own data
    if (userRole === 'employee' && request.userId !== currentUserId) {
      return createErrorResponse(403, 'FORBIDDEN', 'Employees can only view their own time data');
    }

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const timeEntryRepo = new TimeEntryRepository();
    
    // Get user's work schedule (simplified for now)
    const workSchedule = await getUserWorkSchedule(request.userId!);
    
    // Generate daily summaries
    const summaries = await generateDailySummaries(request, workSchedule, timeEntryRepo);
    
    // Calculate period summary
    const periodSummary = calculatePeriodSummary(summaries);

    const response: SuccessResponse<DailySummaryResponse> = {
      success: true,
      data: {
        summaries,
        periodSummary,
      },
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
    console.error('Error generating daily summary:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

async function getUserWorkSchedule(userId: string): Promise<UserWorkSchedule | null> {
  try {
    // Simplified work schedule - in a real implementation this would use a repository
    // For now, return a basic schedule to avoid complexity
    return {
      userId,
      schedule: {
        monday: { targetHours: 8, start: '09:00', end: '17:00' },
        tuesday: { targetHours: 8, start: '09:00', end: '17:00' },
        wednesday: { targetHours: 8, start: '09:00', end: '17:00' },
        thursday: { targetHours: 8, start: '09:00', end: '17:00' },
        friday: { targetHours: 8, start: '09:00', end: '17:00' },
        saturday: { targetHours: 0, start: null, end: null },
        sunday: { targetHours: 0, start: null, end: null },
      },
      timezone: 'America/New_York',
      weeklyTargetHours: 40,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error fetching work schedule:', error);
    return null;
  }
}

async function generateDailySummaries(
  request: DailySummaryRequest,
  workSchedule: UserWorkSchedule | null,
  timeEntryRepo: TimeEntryRepository
): Promise<DailySummary[]> {
  const summaries: DailySummary[] = [];
  const startDate = new Date(request.startDate);
  const endDate = new Date(request.endDate);

  // Generate summaries for each day in the range
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Get time entries for this date using repository pattern
    const timeEntries = await getTimeEntriesForDate(request.userId!, dateStr!, timeEntryRepo);
    
    // Get work schedule for this day
    const daySchedule = workSchedule?.schedule[dayOfWeek as keyof typeof workSchedule.schedule];
    const targetHours = request.targetHours || daySchedule?.targetHours || 8;
    
    // Calculate summary
    const summary = await calculateDailySummary(
      dateStr!,
      dayOfWeek,
      timeEntries,
      targetHours,
      daySchedule ? {
        targetHours: daySchedule.targetHours,
        start: daySchedule.start,
        end: daySchedule.end
      } : null,
      request.includeGaps || false
    );
    
    summaries.push(summary);
  }

  return summaries;
}

async function getTimeEntriesForDate(
  userId: string, 
  date: string, 
  timeEntryRepo: TimeEntryRepository
): Promise<TimeEntry[]> {
  try {
    // Use repository pattern to get time entries for a specific date
    const result = await timeEntryRepo.listTimeEntries({
      userId,
      dateFrom: date,
      dateTo: date,
      limit: 100 // Get up to 100 entries for the day
    });
    
    return result.items;
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return [];
  }
}

async function calculateDailySummary(
  date: string,
  dayOfWeek: string,
  timeEntries: TimeEntry[],
  targetHours: number,
  daySchedule: DaySchedule | null,
  includeGaps: boolean
): Promise<DailySummary> {
  // Calculate totals
  const totalMinutes = timeEntries.reduce((sum, entry) => sum + entry.duration, 0);
  const billableMinutes = timeEntries.filter(entry => entry.isBillable).reduce((sum, entry) => sum + entry.duration, 0);
  const nonBillableMinutes = totalMinutes - billableMinutes;
  
  const targetMinutes = targetHours * 60;
  const completionPercentage = targetMinutes > 0 ? (totalMinutes / targetMinutes) * 100 : 0;

  // Calculate project breakdown
  const projectBreakdown = await calculateProjectBreakdown(timeEntries);

  // Calculate working hours
  const workingHours = calculateWorkingHours(timeEntries);

  // Calculate time gaps if requested
  const timeGaps = includeGaps ? calculateTimeGaps(timeEntries, daySchedule) : [];

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
    projectBreakdown,
    timeGaps,
    workingHours,
  };
}

async function calculateProjectBreakdown(timeEntries: TimeEntry[]): Promise<ProjectTimeBreakdown[]> {
  const projectMap = new Map<string, { minutes: number; projectName: string; clientName: string }>();
  
  // Group by project
  for (const entry of timeEntries) {
    const existing = projectMap.get(entry.projectId);
    if (existing) {
      existing.minutes += entry.duration;
    } else {
      // Get project and client names (simplified for now)
      projectMap.set(entry.projectId, {
        minutes: entry.duration,
        projectName: `Project ${entry.projectId}`, // TODO: Fetch actual project name
        clientName: 'Client Name', // TODO: Fetch actual client name
      });
    }
  }

  const totalMinutes = timeEntries.reduce((sum, entry) => sum + entry.duration, 0);
  
  return Array.from(projectMap.entries()).map(([projectId, data]) => ({
    projectId,
    projectName: data.projectName,
    clientName: data.clientName,
    minutes: data.minutes,
    hours: Math.round((data.minutes / 60) * 100) / 100,
    percentage: totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 10000) / 100 : 0,
  }));
}

function calculateWorkingHours(timeEntries: TimeEntry[]): {
  firstEntry: string | null;
  lastEntry: string | null;
  totalSpan: string | null;
} {
  if (timeEntries.length === 0) {
    return { firstEntry: null, lastEntry: null, totalSpan: null };
  }

  // Sort entries by start time
  const sortedEntries = timeEntries
    .filter(entry => entry.startTime)
    .sort((a, b) => a.startTime!.localeCompare(b.startTime!));

  if (sortedEntries.length === 0) {
    return { firstEntry: null, lastEntry: null, totalSpan: null };
  }

  const firstEntry = sortedEntries[0]?.startTime?.substring(11, 16) || '00:00'; // Extract HH:MM
  const lastEntry = sortedEntries[sortedEntries.length - 1]?.endTime?.substring(11, 16) || firstEntry;

  // Calculate span
  const firstTime = new Date(`2000-01-01T${firstEntry}:00`);
  const lastTime = new Date(`2000-01-01T${lastEntry}:00`);
  const spanMinutes = (lastTime.getTime() - firstTime.getTime()) / (1000 * 60);
  const spanHours = Math.floor(spanMinutes / 60);
  const spanMins = spanMinutes % 60;
  const totalSpan = `${spanHours}h ${spanMins}m`;

  return { firstEntry, lastEntry, totalSpan };
}

function calculateTimeGaps(timeEntries: TimeEntry[], daySchedule: DaySchedule | null): TimeGap[] {
  // Simplified gap calculation - would need more sophisticated logic
  // This is a basic implementation
  const gaps: TimeGap[] = [];
  
  if (!daySchedule || !daySchedule.start || !daySchedule.end) {
    return gaps;
  }

  // Sort entries by start time
  const sortedEntries = timeEntries
    .filter(entry => entry.startTime && entry.endTime)
    .sort((a, b) => a.startTime!.localeCompare(b.startTime!));

  // Find gaps between entries
  for (let i = 0; i < sortedEntries.length - 1; i++) {
    const currentEnd = sortedEntries[i]?.endTime?.substring(11, 16);
    const nextStart = sortedEntries[i + 1]?.startTime?.substring(11, 16);
    
    if (!currentEnd || !nextStart) continue;
    
    const currentEndTime = new Date(`2000-01-01T${currentEnd}:00`);
    const nextStartTime = new Date(`2000-01-01T${nextStart}:00`);
    const gapMinutes = (nextStartTime.getTime() - currentEndTime.getTime()) / (1000 * 60);
    
    if (gapMinutes >= 15) { // Only report gaps of 15+ minutes
      gaps.push({
        startTime: currentEnd,
        endTime: nextStart,
        durationMinutes: gapMinutes,
        suggestedAction: gapMinutes <= 60 ? 'break' : 'untracked',
      });
    }
  }

  return gaps;
}

function calculatePeriodSummary(summaries: DailySummary[]): PeriodSummary {
  const totalDays = summaries.length;
  const workDays = summaries.filter(s => s.targetHours > 0).length;
  const totalHours = summaries.reduce((sum, s) => sum + s.totalHours, 0);
  const targetHours = summaries.reduce((sum, s) => sum + s.targetHours, 0);
  
  return {
    totalDays,
    workDays,
    totalHours: Math.round(totalHours * 100) / 100,
    averageHoursPerDay: workDays > 0 ? Math.round((totalHours / workDays) * 100) / 100 : 0,
    targetHours: Math.round(targetHours * 100) / 100,
    completionPercentage: targetHours > 0 ? Math.round((totalHours / targetHours) * 10000) / 100 : 0,
  };
} 