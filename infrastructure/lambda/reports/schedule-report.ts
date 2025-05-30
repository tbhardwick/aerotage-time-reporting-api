import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { EventBridgeClient, PutRuleCommand, PutTargetsCommand, DeleteRuleCommand, RemoveTargetsCommand } from '@aws-sdk/client-eventbridge';
import { randomUUID } from 'crypto';

// MANDATORY: Use repository pattern instead of direct DynamoDB
// Mock storage for scheduled reports - in production, create ScheduledReportRepository
const mockScheduledReports = new Map<string, ScheduledReport>();
const eventBridgeClient = new EventBridgeClient({});

interface ScheduleReportRequest {
  reportConfigId: string;
  schedule: ScheduleConfig;
  delivery: DeliveryConfig;
  enabled?: boolean;
}

interface ScheduleConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  time: string; // HH:MM format
  timezone: string;
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  dayOfMonth?: number; // 1-31 for monthly
  customCron?: string; // For custom frequency
  startDate?: string;
  endDate?: string;
}

interface DeliveryConfig {
  recipients: string[];
  subject?: string;
  message?: string;
  format: 'pdf' | 'csv' | 'excel';
  includeAttachment: boolean;
  includeDownloadLink: boolean;
}

interface ScheduledReport {
  scheduleId: string;
  userId: string;
  reportConfigId: string;
  schedule: ScheduleConfig;
  delivery: DeliveryConfig;
  enabled: boolean;
  enabledStr?: string; // For GSI compatibility
  createdAt: string;
  updatedAt: string;
  lastRun?: string;
  nextRun: string;
  runCount: number;
  failureCount: number;
  lastError?: string;
  eventBridgeRuleName?: string;
}

interface ScheduleResponse {
  scheduleId: string;
  status: 'created' | 'updated' | 'deleted';
  nextRun: string;
  message: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Schedule report request:', JSON.stringify(event, null, 2));

    // Extract user info from authorizer context
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const httpMethod = event.httpMethod;
    const pathParameters = event.pathParameters || {};
    const scheduleId = pathParameters.scheduleId;

    switch (httpMethod) {
      case 'GET':
        if (scheduleId) {
          return await getScheduledReport(scheduleId, userId, userRole);
        } else {
          return await listScheduledReports(event, userId, userRole);
        }
      
      case 'POST':
        return await createScheduledReport(event, userId, userRole);
      
      case 'PUT':
        if (!scheduleId) {
          return createErrorResponse(400, 'MISSING_SCHEDULE_ID', 'Schedule ID is required for updates');
        }
        return await updateScheduledReport(scheduleId, event, userId, userRole);
      
      case 'DELETE':
        if (!scheduleId) {
          return createErrorResponse(400, 'MISSING_SCHEDULE_ID', 'Schedule ID is required for deletion');
        }
        return await deleteScheduledReport(scheduleId, userId, userRole);
      
      default:
        return createErrorResponse(405, 'METHOD_NOT_ALLOWED', `HTTP method ${httpMethod} not allowed`);
    }

  } catch (error) {
    console.error('Error in report scheduling:', error);
    
    return createErrorResponse(500, 'SCHEDULE_FAILED', 'Failed to manage report schedule');
  }
};

async function createScheduledReport(event: APIGatewayProxyEvent, userId: string, userRole: string): Promise<APIGatewayProxyResult> {
  try {
    // Parse request body
    let scheduleRequest: ScheduleReportRequest;
    try {
      scheduleRequest = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate required fields
    if (!scheduleRequest.reportConfigId || !scheduleRequest.schedule || !scheduleRequest.delivery) {
      return createErrorResponse(400, 'MISSING_REQUIRED_FIELDS', 'reportConfigId, schedule, and delivery are required');
    }

    // Validate schedule frequency
    const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'custom'];
    if (!validFrequencies.includes(scheduleRequest.schedule.frequency)) {
      return createErrorResponse(400, 'INVALID_FREQUENCY', `Frequency must be one of: ${validFrequencies.join(', ')}`);
    }

    // Validate delivery format
    const validFormats = ['pdf', 'csv', 'excel'];
    if (!validFormats.includes(scheduleRequest.delivery.format)) {
      return createErrorResponse(400, 'INVALID_FORMAT', `Format must be one of: ${validFormats.join(', ')}`);
    }

    // Check if user has access to the report config
    const hasAccess = await validateReportConfigAccess(scheduleRequest.reportConfigId, userId, userRole);
    if (!hasAccess) {
      return createErrorResponse(403, 'ACCESS_DENIED', 'You do not have access to this report configuration');
    }

    // Create scheduled report
    const enabled = scheduleRequest.enabled !== false;
    const scheduledReport: ScheduledReport = {
      scheduleId: randomUUID(),
      userId,
      reportConfigId: scheduleRequest.reportConfigId,
      schedule: scheduleRequest.schedule,
      delivery: scheduleRequest.delivery,
      enabled,
      enabledStr: enabled ? 'true' : 'false', // For GSI compatibility
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextRun: calculateNextRun(scheduleRequest.schedule),
      runCount: 0,
      failureCount: 0,
    };

    // Create EventBridge rule for scheduling
    if (scheduledReport.enabled) {
      const ruleName = await createEventBridgeRule(scheduledReport);
      scheduledReport.eventBridgeRuleName = ruleName;
    }

    // Save to database
    await saveScheduledReport(scheduledReport);

    const response: ScheduleResponse = {
      scheduleId: scheduledReport.scheduleId,
      status: 'created',
      nextRun: scheduledReport.nextRun,
      message: 'Report schedule created successfully',
    };

    return createSuccessResponse(response, 201);

  } catch (error) {
    console.error('Error creating scheduled report:', error);
    throw error;
  }
}

async function getScheduledReport(scheduleId: string, userId: string, userRole: string): Promise<APIGatewayProxyResult> {
  try {
    const scheduledReport = await fetchScheduledReport(scheduleId);
    
    if (!scheduledReport) {
      return createErrorResponse(404, 'SCHEDULE_NOT_FOUND', 'Scheduled report not found');
    }

    // Check access permissions
    if (!canAccessSchedule(scheduledReport, userId, userRole)) {
      return createErrorResponse(403, 'ACCESS_DENIED', 'You do not have permission to access this schedule');
    }

    return createSuccessResponse(scheduledReport);

  } catch (error) {
    console.error('Error getting scheduled report:', error);
    throw error;
  }
}

async function listScheduledReports(event: APIGatewayProxyEvent, userId: string, userRole: string): Promise<APIGatewayProxyResult> {
  try {
    const queryParams = event.queryStringParameters || {};
    const enabled = queryParams.enabled === 'true' ? true : queryParams.enabled === 'false' ? false : undefined;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    // Get user's scheduled reports
    const scheduledReports = await fetchUserScheduledReports(userId, enabled, limit);

    return createSuccessResponse({
      schedules: scheduledReports,
      totalCount: scheduledReports.length,
    });

  } catch (error) {
    console.error('Error listing scheduled reports:', error);
    throw error;
  }
}

async function updateScheduledReport(scheduleId: string, event: APIGatewayProxyEvent, userId: string, userRole: string): Promise<APIGatewayProxyResult> {
  try {
    // Get existing schedule
    const existingSchedule = await fetchScheduledReport(scheduleId);
    
    if (!existingSchedule) {
      return createErrorResponse(404, 'SCHEDULE_NOT_FOUND', 'Scheduled report not found');
    }

    // Check permissions
    if (!canModifySchedule(existingSchedule, userId, userRole)) {
      return createErrorResponse(403, 'ACCESS_DENIED', 'You do not have permission to modify this schedule');
    }

    // Parse request body
    let updateData: Partial<ScheduleReportRequest>;
    try {
      updateData = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Update the schedule
    const enabled = updateData.enabled !== undefined ? updateData.enabled : existingSchedule.enabled;
    const updatedSchedule: ScheduledReport = {
      ...existingSchedule,
      schedule: updateData.schedule || existingSchedule.schedule,
      delivery: updateData.delivery || existingSchedule.delivery,
      enabled,
      enabledStr: enabled ? 'true' : 'false', // For GSI compatibility
      updatedAt: new Date().toISOString(),
    };

    // Recalculate next run if schedule changed
    if (updateData.schedule) {
      updatedSchedule.nextRun = calculateNextRun(updatedSchedule.schedule);
    }

    // Update EventBridge rule
    if (existingSchedule.eventBridgeRuleName) {
      await deleteEventBridgeRule(existingSchedule.eventBridgeRuleName);
    }
    
    if (updatedSchedule.enabled) {
      const ruleName = await createEventBridgeRule(updatedSchedule);
      updatedSchedule.eventBridgeRuleName = ruleName;
    }

    // Save updated schedule
    await saveScheduledReport(updatedSchedule);

    const response: ScheduleResponse = {
      scheduleId: updatedSchedule.scheduleId,
      status: 'updated',
      nextRun: updatedSchedule.nextRun,
      message: 'Report schedule updated successfully',
    };

    return createSuccessResponse(response);

  } catch (error) {
    console.error('Error updating scheduled report:', error);
    throw error;
  }
}

async function deleteScheduledReport(scheduleId: string, userId: string, userRole: string): Promise<APIGatewayProxyResult> {
  try {
    // Get existing schedule
    const existingSchedule = await fetchScheduledReport(scheduleId);
    
    if (!existingSchedule) {
      return createErrorResponse(404, 'SCHEDULE_NOT_FOUND', 'Scheduled report not found');
    }

    // Check permissions
    if (!canModifySchedule(existingSchedule, userId, userRole)) {
      return createErrorResponse(403, 'ACCESS_DENIED', 'You do not have permission to delete this schedule');
    }

    // Delete EventBridge rule
    if (existingSchedule.eventBridgeRuleName) {
      await deleteEventBridgeRule(existingSchedule.eventBridgeRuleName);
    }

    // Delete from database
    await deleteScheduledReportFromDB(scheduleId);

    const response: ScheduleResponse = {
      scheduleId,
      status: 'deleted',
      nextRun: '',
      message: 'Report schedule deleted successfully',
    };

    return createSuccessResponse(response);

  } catch (error) {
    console.error('Error deleting scheduled report:', error);
    throw error;
  }
}

// Mock database functions
async function saveScheduledReport(scheduledReport: ScheduledReport): Promise<void> {
  try {
    // Mock save - in production, use ScheduledReportRepository
    mockScheduledReports.set(scheduledReport.scheduleId, scheduledReport);
    console.log(`Saved scheduled report: ${scheduledReport.scheduleId}`);
  } catch (error) {
    console.error('Error saving scheduled report:', error);
    throw error;
  }
}

async function fetchScheduledReport(scheduleId: string): Promise<ScheduledReport | null> {
  try {
    // Mock fetch - in production, use ScheduledReportRepository
    return mockScheduledReports.get(scheduleId) || null;
  } catch (error) {
    console.error('Error fetching scheduled report:', error);
    return null;
  }
}

async function fetchUserScheduledReports(userId: string, enabled?: boolean, limit: number = 50): Promise<ScheduledReport[]> {
  try {
    // Mock fetch - in production, use ScheduledReportRepository
    const allSchedules = Array.from(mockScheduledReports.values());
    let userSchedules = allSchedules.filter(schedule => schedule.userId === userId);

    if (enabled !== undefined) {
      userSchedules = userSchedules.filter(schedule => schedule.enabled === enabled);
    }

    return userSchedules.slice(0, limit);
  } catch (error) {
    console.error('Error fetching user scheduled reports:', error);
    return [];
  }
}

async function deleteScheduledReportFromDB(scheduleId: string): Promise<void> {
  try {
    // Mock delete - in production, use ScheduledReportRepository
    mockScheduledReports.delete(scheduleId);
    console.log(`Deleted scheduled report: ${scheduleId}`);
  } catch (error) {
    console.error('Error deleting scheduled report:', error);
    throw error;
  }
}

// EventBridge operations
async function createEventBridgeRule(scheduledReport: ScheduledReport): Promise<string> {
  const ruleName = `aerotage-report-${scheduledReport.scheduleId}`;
  const scheduleExpression = generateScheduleExpression(scheduledReport.schedule);

  try {
    // Create the EventBridge rule
    const putRuleCommand = new PutRuleCommand({
      Name: ruleName,
      Description: `Scheduled report for ${scheduledReport.reportConfigId}`,
      ScheduleExpression: scheduleExpression,
      State: 'ENABLED',
    });

    await eventBridgeClient.send(putRuleCommand);

    // Add target (Lambda function that will execute the report)
    // For now, we'll create the rule without a target since the execution function doesn't exist yet
    // In Phase 7, we'll add the actual execution Lambda function
    const putTargetsCommand = new PutTargetsCommand({
      Rule: ruleName,
      Targets: [
        {
          Id: '1',
          Arn: `arn:aws:lambda:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:function:aerotage-schedulereport-${process.env.STAGE}`,
          Input: JSON.stringify({
            scheduleId: scheduledReport.scheduleId,
            reportConfigId: scheduledReport.reportConfigId,
            action: 'execute',
          }),
        },
      ],
    });

    await eventBridgeClient.send(putTargetsCommand);

    console.log(`Created EventBridge rule: ${ruleName} with schedule: ${scheduleExpression}`);
    return ruleName;
  } catch (error) {
    console.error('Error creating EventBridge rule:', error);
    throw new Error(`Failed to create EventBridge rule: ${error}`);
  }
}

async function deleteEventBridgeRule(ruleName: string): Promise<void> {
  try {
    // Remove targets first
    const removeTargetsCommand = new RemoveTargetsCommand({
      Rule: ruleName,
      Ids: ['1'],
    });

    await eventBridgeClient.send(removeTargetsCommand);

    // Delete the rule
    const deleteRuleCommand = new DeleteRuleCommand({
      Name: ruleName,
    });

    await eventBridgeClient.send(deleteRuleCommand);

    console.log(`Deleted EventBridge rule: ${ruleName}`);
  } catch (error) {
    console.error('Error deleting EventBridge rule:', error);
    // Don't throw - rule might not exist
  }
}

// Utility functions
function calculateNextRun(schedule: ScheduleConfig): string {
  const now = new Date();
  let nextRun = new Date(now);
  
  // Parse time
  const [hours, minutes] = schedule.time.split(':').map(Number);
  nextRun.setHours(hours, minutes, 0, 0);
  
  // If time has passed today, move to next occurrence
  if (nextRun <= now) {
    switch (schedule.frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        const daysUntilNext = (7 + (schedule.dayOfWeek || 0) - nextRun.getDay()) % 7;
        nextRun.setDate(nextRun.getDate() + (daysUntilNext || 7));
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(schedule.dayOfMonth || 1);
        break;
      case 'quarterly':
        nextRun.setMonth(nextRun.getMonth() + 3);
        nextRun.setDate(1);
        break;
    }
  }
  
  return nextRun.toISOString();
}

function generateScheduleExpression(schedule: ScheduleConfig): string {
  if (schedule.customCron) {
    return `cron(${schedule.customCron})`;
  }

  const [hours, minutes] = schedule.time.split(':').map(Number);

  switch (schedule.frequency) {
    case 'daily':
      return `cron(${minutes} ${hours} * * ? *)`;
    case 'weekly':
      const dayOfWeek = schedule.dayOfWeek || 0;
      return `cron(${minutes} ${hours} ? * ${dayOfWeek === 0 ? 'SUN' : dayOfWeek} *)`;
    case 'monthly':
      const dayOfMonth = schedule.dayOfMonth || 1;
      return `cron(${minutes} ${hours} ${dayOfMonth} * ? *)`;
    case 'quarterly':
      return `cron(${minutes} ${hours} 1 */3 ? *)`;
    default:
      return `cron(${minutes} ${hours} * * ? *)`;
  }
}

async function validateReportConfigAccess(reportConfigId: string, userId: string, userRole: string): Promise<boolean> {
  // Mock validation - in production, check actual report config access
  return true;
}

function canAccessSchedule(schedule: ScheduledReport, userId: string, userRole: string): boolean {
  // Owner can always access
  if (schedule.userId === userId) return true;
  
  // Admins can access all schedules
  if (userRole === 'admin') return true;
  
  return false;
}

function canModifySchedule(schedule: ScheduledReport, userId: string, userRole: string): boolean {
  // Owner can always modify
  if (schedule.userId === userId) return true;
  
  // Admins can modify any schedule
  if (userRole === 'admin') return true;
  
  return false;
} 