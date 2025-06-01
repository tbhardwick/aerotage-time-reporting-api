import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { randomUUID } from 'crypto';

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

// MANDATORY: Use repository pattern instead of direct DynamoDB
// Mock storage for report configurations - in production, create ReportConfigRepository
const mockReportConfigs = new Map<string, ReportConfig>();

interface ReportConfig {
  reportId: string;
  userId: string;
  reportType: 'time' | 'project' | 'client' | 'dashboard';
  name: string;
  description?: string;
  filters: Record<string, unknown>;
  schedule?: ReportSchedule;
  isTemplate: boolean;
  isShared: boolean;
  sharedWith?: string[];
  createdAt: string;
  updatedAt: string;
  lastGenerated?: string;
  generationCount: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface ReportSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  time: string; // HH:mm format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  nextRun?: string;
  lastRun?: string;
  recipients: string[];
}

interface CreateReportConfigRequest {
  reportType: 'time' | 'project' | 'client' | 'dashboard';
  name: string;
  description?: string;
  filters: Record<string, unknown>;
  schedule?: ReportSchedule;
  isTemplate?: boolean;
  isShared?: boolean;
  sharedWith?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface UpdateReportConfigRequest {
  name?: string;
  description?: string;
  filters?: Record<string, unknown>;
  schedule?: ReportSchedule;
  isTemplate?: boolean;
  isShared?: boolean;
  sharedWith?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Report config management request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
      pathParameters: event.pathParameters
    });

    // Extract user info from authorizer context
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';
    
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/reports/config', event.httpMethod, 401, responseTime);
      businessLogger.logAuth(userId || 'unknown', 'manage-report-config', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Add user context to tracer and logger
    businessTracer.addUserContext(userId);
    addRequestContext(requestId, userId);

    const httpMethod = event.httpMethod;
    const pathParameters = event.pathParameters || {};
    const reportId = pathParameters.reportId;

    logger.info('Report config operation determined', { 
      userId,
      userRole,
      httpMethod,
      reportId
    });

    // Route to appropriate operation with tracing
    const result = await businessTracer.traceBusinessOperation(
      `report-config-${httpMethod.toLowerCase()}`,
      'reports',
      async () => {
        switch (httpMethod) {
          case 'GET':
            if (reportId) {
              return await getReportConfig(reportId, userId, userRole);
            } else {
              return await listReportConfigs(event, userId, userRole);
            }
          
          case 'POST':
            return await createReportConfig(event, userId, userRole);
          
          case 'PUT':
            if (!reportId) {
              throw new Error('Report ID is required for updates');
            }
            return await updateReportConfig(reportId, event, userId, userRole);
          
          case 'DELETE':
            if (!reportId) {
              throw new Error('Report ID is required for deletion');
            }
            return await deleteReportConfig(reportId, userId, userRole);
          
          default:
            throw new Error(`HTTP method ${httpMethod} not allowed`);
        }
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/reports/config', httpMethod, result.statusCode, responseTime);
    businessLogger.logBusinessOperation(httpMethod.toLowerCase(), 'report-config', userId, true, { 
      userRole,
      httpMethod,
      reportId,
      statusCode: result.statusCode
    });

    logger.info('Report config operation completed successfully', { 
      userId,
      userRole,
      httpMethod,
      reportId,
      statusCode: result.statusCode,
      responseTime 
    });

    return result;

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/reports/config', event.httpMethod, 500, responseTime);
    businessLogger.logError(error as Error, 'manage-report-config', getCurrentUserId(event) || 'unknown');

    logger.error('Error in report config management', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message.includes('Report ID is required')) {
        return createErrorResponse(400, 'MISSING_REPORT_ID', error.message);
      }
      if (error.message.includes('HTTP method') && error.message.includes('not allowed')) {
        return createErrorResponse(405, 'METHOD_NOT_ALLOWED', error.message);
      }
    }
    
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to manage report configuration');
  }
};

async function createReportConfig(event: APIGatewayProxyEvent, userId: string, userRole: string): Promise<APIGatewayProxyResult> {
  try {
    // Parse request body
    let requestBody: CreateReportConfigRequest;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate required fields
    if (!requestBody.reportType || !requestBody.name || !requestBody.filters) {
      return createErrorResponse(400, 'MISSING_REQUIRED_FIELDS', 'reportType, name, and filters are required');
    }

    // Validate report type
    const validReportTypes = ['time', 'project', 'client', 'dashboard'];
    if (!validReportTypes.includes(requestBody.reportType)) {
      return createErrorResponse(400, 'INVALID_REPORT_TYPE', `Report type must be one of: ${validReportTypes.join(', ')}`);
    }

    // Check permissions for shared reports
    if (requestBody.isShared && userRole === 'employee') {
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'Only managers and admins can create shared reports');
    }

    // Create report configuration
    const reportConfig: ReportConfig = {
      reportId: randomUUID(),
      userId,
      reportType: requestBody.reportType,
      name: requestBody.name,
      description: requestBody.description,
      filters: requestBody.filters,
      schedule: requestBody.schedule,
      isTemplate: requestBody.isTemplate || false,
      isShared: requestBody.isShared || false,
      sharedWith: requestBody.sharedWith || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      generationCount: 0,
      tags: requestBody.tags || [],
      metadata: requestBody.metadata || {},
    };

    // Calculate next run time if scheduled
    if (reportConfig.schedule?.enabled) {
      reportConfig.schedule.nextRun = calculateNextRun(reportConfig.schedule).toISOString();
    }

    // Save to database
    await saveReportConfig(reportConfig);

    return createSuccessResponse(reportConfig, 201);

  } catch (error) {
    console.error('Error creating report config:', error);
    throw error;
  }
}

async function getReportConfig(reportId: string, userId: string, userRole: string): Promise<APIGatewayProxyResult> {
  try {
    const reportConfig = await fetchReportConfig(reportId);
    
    if (!reportConfig) {
      return createErrorResponse(404, 'REPORT_NOT_FOUND', 'Report configuration not found');
    }

    // Check access permissions
    const accessControl = applyAccessControl(reportConfig, userId, userRole);
    if (!accessControl.canAccess) {
      return createErrorResponse(403, 'ACCESS_DENIED', accessControl.reason || 'You do not have permission to access this report');
    }

    return createSuccessResponse(reportConfig);

  } catch (error) {
    console.error('Error getting report config:', error);
    throw error;
  }
}

async function listReportConfigs(event: APIGatewayProxyEvent, userId: string, userRole: string): Promise<APIGatewayProxyResult> {
  try {
    const queryParams = event.queryStringParameters || {};
    const reportType = queryParams.reportType;
    const isTemplate = queryParams.isTemplate === 'true';
    const isShared = queryParams.isShared === 'true';
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
    const offset = queryParams.offset ? parseInt(queryParams.offset) : 0;

    // Get user's own reports
    const userReports = await fetchUserReportConfigs(userId, reportType, isTemplate, limit, offset);
    
    // Get shared reports if requested
    let sharedReports: ReportConfig[] = [];
    if (isShared || userRole !== 'employee') {
      sharedReports = await fetchSharedReportConfigs(userId, reportType, isTemplate);
    }

    // Combine and deduplicate
    const allReports = [...userReports, ...sharedReports];
    const uniqueReports = allReports.filter((report, index, self) => 
      index === self.findIndex(r => r.reportId === report.reportId)
    );

    // Sort by updatedAt descending
    uniqueReports.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return createSuccessResponse({
      reports: uniqueReports,
      pagination: {
        hasMore: uniqueReports.length >= limit,
        totalCount: uniqueReports.length,
      },
    });

  } catch (error) {
    console.error('Error listing report configs:', error);
    throw error;
  }
}

async function updateReportConfig(reportId: string, event: APIGatewayProxyEvent, userId: string, userRole: string): Promise<APIGatewayProxyResult> {
  try {
    // Get existing report config
    const existingConfig = await fetchReportConfig(reportId);
    
    if (!existingConfig) {
      return createErrorResponse(404, 'REPORT_NOT_FOUND', 'Report configuration not found');
    }

    // Check permissions
    if (!canModifyReport(existingConfig, userId, userRole)) {
      return createErrorResponse(403, 'ACCESS_DENIED', 'You do not have permission to modify this report');
    }

    // Parse request body
    let updateData: UpdateReportConfigRequest;
    try {
      updateData = JSON.parse(event.body || '{}');
    } catch {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Update the configuration
    const updatedConfig: ReportConfig = {
      ...existingConfig,
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    // Recalculate next run time if schedule was updated
    if (updateData.schedule && updatedConfig.schedule?.enabled) {
      updatedConfig.schedule.nextRun = calculateNextRun(updatedConfig.schedule).toISOString();
    }

    // Save updated configuration
    await saveReportConfig(updatedConfig);

    return createSuccessResponse(updatedConfig);

  } catch (error) {
    console.error('Error updating report config:', error);
    throw error;
  }
}

async function deleteReportConfig(reportId: string, userId: string, userRole: string): Promise<APIGatewayProxyResult> {
  try {
    // Get existing report config
    const existingConfig = await fetchReportConfig(reportId);
    
    if (!existingConfig) {
      return createErrorResponse(404, 'REPORT_NOT_FOUND', 'Report configuration not found');
    }

    // Check permissions
    if (!canModifyReport(existingConfig, userId, userRole)) {
      return createErrorResponse(403, 'ACCESS_DENIED', 'You do not have permission to delete this report');
    }

    // Delete the configuration
    await deleteReportConfigFromDB(reportId);

    return createSuccessResponse({
      message: 'Report configuration deleted successfully',
      reportId,
    });

  } catch (error) {
    console.error('Error deleting report config:', error);
    throw error;
  }
}

// Database operations (MOCK implementations)
async function saveReportConfig(reportConfig: ReportConfig): Promise<void> {
  try {
    // Mock save - in production, use ReportConfigRepository
    mockReportConfigs.set(reportConfig.reportId, reportConfig);
    console.log(`Saved report config: ${reportConfig.reportId}`);
  } catch (error) {
    console.error('Error saving report config:', error);
    throw error;
  }
}

async function fetchReportConfig(reportId: string): Promise<ReportConfig | null> {
  try {
    // Mock fetch - in production, use ReportConfigRepository
    return mockReportConfigs.get(reportId) || null;
  } catch (error) {
    console.error('Error fetching report config:', error);
    return null;
  }
}

async function fetchUserReportConfigs(
  userId: string,
  reportType?: string,
  isTemplate?: boolean,
  limit: number = 50,
  offset: number = 0
): Promise<ReportConfig[]> {
  try {
    // Mock fetch - in production, use ReportConfigRepository
    const allConfigs = Array.from(mockReportConfigs.values());
    let userConfigs = allConfigs.filter(config => config.userId === userId);

    if (reportType) {
      userConfigs = userConfigs.filter(config => config.reportType === reportType);
    }

    if (isTemplate !== undefined) {
      userConfigs = userConfigs.filter(config => config.isTemplate === isTemplate);
    }

    // Apply pagination
    return userConfigs.slice(offset, offset + limit);
  } catch (error) {
    console.error('Error fetching user report configs:', error);
    return [];
  }
}

async function fetchSharedReportConfigs(
  userId: string,
  reportType?: string,
  isTemplate?: boolean
): Promise<ReportConfig[]> {
  try {
    // Mock fetch - in production, use ReportConfigRepository
    const allConfigs = Array.from(mockReportConfigs.values());
    let sharedConfigs = allConfigs.filter(config => 
      config.isShared && (config.sharedWith?.includes(userId) || config.sharedWith?.includes('*'))
    );

    if (reportType) {
      sharedConfigs = sharedConfigs.filter(config => config.reportType === reportType);
    }

    if (isTemplate !== undefined) {
      sharedConfigs = sharedConfigs.filter(config => config.isTemplate === isTemplate);
    }

    return sharedConfigs;
  } catch (error) {
    console.error('Error fetching shared report configs:', error);
    return [];
  }
}

async function deleteReportConfigFromDB(reportId: string): Promise<void> {
  try {
    // Mock delete - in production, use ReportConfigRepository
    mockReportConfigs.delete(reportId);
    console.log(`Deleted report config: ${reportId}`);
  } catch (error) {
    console.error('Error deleting report config:', error);
    throw error;
  }
}

// Utility functions
function canModifyReport(reportConfig: ReportConfig, userId: string, userRole: string): boolean {
  // Owner can always modify
  if (reportConfig.userId === userId) return true;
  
  // Admins can modify any report
  if (userRole === 'admin') return true;
  
  return false;
}

function calculateNextRun(schedule: ReportSchedule): Date {
  const nextRun = new Date();
  const timeParts = schedule.time.split(':');
  const hours = parseInt(timeParts[0] || '0', 10);
  const minutes = parseInt(timeParts[1] || '0', 10);
  
  if (!isNaN(hours) && !isNaN(minutes)) {
    nextRun.setHours(hours, minutes, 0, 0);
  } else {
    // Default to midnight if time is invalid
    nextRun.setHours(0, 0, 0, 0);
  }
  
  // If the calculated time is in the past, move to next occurrence
  if (nextRun <= new Date()) {
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
  
  return nextRun;
}

function applyAccessControl(reportConfig: ReportConfig, userId: string, userRole: string): { canAccess: boolean; reason?: string } {
  // Owner can always access
  if (reportConfig.userId === userId) {
    return { canAccess: true };
  }
  
  // Shared reports
  if (reportConfig.isShared) {
    // Admins can access all shared reports
    if (userRole === 'admin') {
      return { canAccess: true };
    }
    
    // Check if user is in shared list
    if (reportConfig.sharedWith?.includes(userId)) {
      return { canAccess: true };
    }
  }
  
  return { 
    canAccess: false, 
    reason: 'You do not have permission to access this report' 
  };
}

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 