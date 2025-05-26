import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface ReportConfig {
  reportId: string;
  userId: string;
  reportType: 'time' | 'project' | 'client' | 'dashboard';
  name: string;
  description?: string;
  filters: any;
  schedule?: ReportSchedule;
  isTemplate: boolean;
  isShared: boolean;
  sharedWith?: string[];
  createdAt: string;
  updatedAt: string;
  lastGenerated?: string;
  generationCount: number;
  tags?: string[];
  metadata?: any;
}

interface ReportSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM format
  timezone: string;
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
  nextRun?: string;
  lastRun?: string;
}

interface CreateReportConfigRequest {
  reportType: 'time' | 'project' | 'client' | 'dashboard';
  name: string;
  description?: string;
  filters: any;
  schedule?: ReportSchedule;
  isTemplate?: boolean;
  isShared?: boolean;
  sharedWith?: string[];
  tags?: string[];
  metadata?: any;
}

interface UpdateReportConfigRequest {
  name?: string;
  description?: string;
  filters?: any;
  schedule?: ReportSchedule;
  isTemplate?: boolean;
  isShared?: boolean;
  sharedWith?: string[];
  tags?: string[];
  metadata?: any;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Report config management request:', JSON.stringify(event, null, 2));

    // Extract user info from authorizer context
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const httpMethod = event.httpMethod;
    const pathParameters = event.pathParameters || {};
    const reportId = pathParameters.reportId;

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
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'MISSING_REPORT_ID',
                message: 'Report ID is required for updates',
              },
            }),
          };
        }
        return await updateReportConfig(reportId, event, userId, userRole);
      
      case 'DELETE':
        if (!reportId) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              success: false,
              error: {
                code: 'MISSING_REPORT_ID',
                message: 'Report ID is required for deletion',
              },
            }),
          };
        }
        return await deleteReportConfig(reportId, userId, userRole);
      
      default:
        return {
          statusCode: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'METHOD_NOT_ALLOWED',
              message: `HTTP method ${httpMethod} not allowed`,
            },
          }),
        };
    }

  } catch (error) {
    console.error('Error in report config management:', error);
    
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to manage report configuration');
  }
};

async function createReportConfig(event: APIGatewayProxyEvent, userId: string, userRole: string): Promise<APIGatewayProxyResult> {
  try {
    // Parse request body
    let requestBody: CreateReportConfigRequest;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate required fields
    if (!requestBody.reportType || !requestBody.name || !requestBody.filters) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'reportType, name, and filters are required',
          },
        }),
      };
    }

    // Validate report type
    const validReportTypes = ['time', 'project', 'client', 'dashboard'];
    if (!validReportTypes.includes(requestBody.reportType)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REPORT_TYPE',
            message: `Report type must be one of: ${validReportTypes.join(', ')}`,
          },
        }),
      };
    }

    // Check permissions for shared reports
    if (requestBody.isShared && userRole === 'employee') {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Only managers and admins can create shared reports',
          },
        }),
      };
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
      reportConfig.schedule.nextRun = calculateNextRun(reportConfig.schedule);
    }

    // Save to database
    await saveReportConfig(reportConfig);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: reportConfig,
      }),
    };

  } catch (error) {
    console.error('Error creating report config:', error);
    throw error;
  }
}

async function getReportConfig(reportId: string, userId: string, userRole: string): Promise<APIGatewayProxyResult> {
  try {
    const reportConfig = await fetchReportConfig(reportId);
    
    if (!reportConfig) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'REPORT_NOT_FOUND',
            message: 'Report configuration not found',
          },
        }),
      };
    }

    // Check access permissions
    if (!canAccessReport(reportConfig, userId, userRole)) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to access this report',
          },
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: reportConfig,
      }),
    };

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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          reports: uniqueReports,
          pagination: {
            hasMore: uniqueReports.length >= limit,
            totalCount: uniqueReports.length,
          },
        },
      }),
    };

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
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'REPORT_NOT_FOUND',
            message: 'Report configuration not found',
          },
        }),
      };
    }

    // Check permissions
    if (!canModifyReport(existingConfig, userId, userRole)) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to modify this report',
          },
        }),
      };
    }

    // Parse request body
    let updateData: UpdateReportConfigRequest;
    try {
      updateData = JSON.parse(event.body || '{}');
    } catch (error) {
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
      updatedConfig.schedule.nextRun = calculateNextRun(updatedConfig.schedule);
    }

    // Save updated configuration
    await saveReportConfig(updatedConfig);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: updatedConfig,
      }),
    };

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
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'REPORT_NOT_FOUND',
            message: 'Report configuration not found',
          },
        }),
      };
    }

    // Check permissions
    if (!canModifyReport(existingConfig, userId, userRole)) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to delete this report',
          },
        }),
      };
    }

    // Delete the configuration
    await deleteReportConfigFromDB(reportId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          message: 'Report configuration deleted successfully',
          reportId,
        },
      }),
    };

  } catch (error) {
    console.error('Error deleting report config:', error);
    throw error;
  }
}

// Database operations
async function saveReportConfig(reportConfig: ReportConfig): Promise<void> {
  const reportConfigsTable = process.env.REPORT_CONFIGS_TABLE_NAME;
  
  if (!reportConfigsTable) {
    throw new Error('REPORT_CONFIGS_TABLE_NAME environment variable not set');
  }

  const command = new PutCommand({
    TableName: reportConfigsTable,
    Item: reportConfig,
  });

  await docClient.send(command);
}

async function fetchReportConfig(reportId: string): Promise<ReportConfig | null> {
  const reportConfigsTable = process.env.REPORT_CONFIGS_TABLE_NAME;
  
  if (!reportConfigsTable) {
    throw new Error('REPORT_CONFIGS_TABLE_NAME environment variable not set');
  }

  const command = new GetCommand({
    TableName: reportConfigsTable,
    Key: { reportId },
  });

  const result = await docClient.send(command);
  return result.Item as ReportConfig || null;
}

async function fetchUserReportConfigs(userId: string, reportType?: string, isTemplate?: boolean, limit?: number, offset?: number): Promise<ReportConfig[]> {
  const reportConfigsTable = process.env.REPORT_CONFIGS_TABLE_NAME;
  
  if (!reportConfigsTable) {
    throw new Error('REPORT_CONFIGS_TABLE_NAME environment variable not set');
  }

  let filterExpression = '';
  let expressionAttributeNames: any = {};
  let expressionAttributeValues: any = {};

  if (reportType) {
    filterExpression += '#reportType = :reportType';
    expressionAttributeNames['#reportType'] = 'reportType';
    expressionAttributeValues[':reportType'] = reportType;
  }

  if (isTemplate !== undefined) {
    if (filterExpression) filterExpression += ' AND ';
    filterExpression += '#isTemplate = :isTemplate';
    expressionAttributeNames['#isTemplate'] = 'isTemplate';
    expressionAttributeValues[':isTemplate'] = isTemplate;
  }

  const queryParams: any = {
    TableName: reportConfigsTable,
    IndexName: 'UserIndex',
    KeyConditionExpression: '#userId = :userId',
    ExpressionAttributeNames: {
      '#userId': 'userId',
      ...expressionAttributeNames,
    },
    ExpressionAttributeValues: {
      ':userId': userId,
      ...expressionAttributeValues,
    },
    ScanIndexForward: false, // Sort by createdAt descending
  };

  if (filterExpression) {
    queryParams.FilterExpression = filterExpression;
  }

  if (limit) {
    queryParams.Limit = limit;
  }

  const command = new QueryCommand(queryParams);
  const result = await docClient.send(command);
  
  return result.Items as ReportConfig[] || [];
}

async function fetchSharedReportConfigs(userId: string, reportType?: string, isTemplate?: boolean): Promise<ReportConfig[]> {
  const reportConfigsTable = process.env.REPORT_CONFIGS_TABLE_NAME;
  
  if (!reportConfigsTable) {
    throw new Error('REPORT_CONFIGS_TABLE_NAME environment variable not set');
  }

  // This is a simplified implementation
  // In production, you'd want a more efficient query using GSI
  let filterExpression = '#isShared = :isShared';
  let expressionAttributeNames: any = { '#isShared': 'isShared' };
  let expressionAttributeValues: any = { ':isShared': true };

  if (reportType) {
    filterExpression += ' AND #reportType = :reportType';
    expressionAttributeNames['#reportType'] = 'reportType';
    expressionAttributeValues[':reportType'] = reportType;
  }

  if (isTemplate !== undefined) {
    filterExpression += ' AND #isTemplate = :isTemplate';
    expressionAttributeNames['#isTemplate'] = 'isTemplate';
    expressionAttributeValues[':isTemplate'] = isTemplate;
  }

  const queryParams: any = {
    TableName: reportConfigsTable,
    IndexName: 'ReportTypeIndex',
    KeyConditionExpression: '#reportType = :reportType',
    FilterExpression: filterExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  };

  const command = new QueryCommand(queryParams);
  const result = await docClient.send(command);
  
  return result.Items as ReportConfig[] || [];
}

async function deleteReportConfigFromDB(reportId: string): Promise<void> {
  const reportConfigsTable = process.env.REPORT_CONFIGS_TABLE_NAME;
  
  if (!reportConfigsTable) {
    throw new Error('REPORT_CONFIGS_TABLE_NAME environment variable not set');
  }

  const command = new DeleteCommand({
    TableName: reportConfigsTable,
    Key: { reportId },
  });

  await docClient.send(command);
}

// Utility functions
function canAccessReport(reportConfig: ReportConfig, userId: string, userRole: string): boolean {
  // Owner can always access
  if (reportConfig.userId === userId) return true;
  
  // Shared reports
  if (reportConfig.isShared) {
    // Admins can access all shared reports
    if (userRole === 'admin') return true;
    
    // Check if user is in shared list
    if (reportConfig.sharedWith?.includes(userId)) return true;
  }
  
  return false;
}

function canModifyReport(reportConfig: ReportConfig, userId: string, userRole: string): boolean {
  // Owner can always modify
  if (reportConfig.userId === userId) return true;
  
  // Admins can modify any report
  if (userRole === 'admin') return true;
  
  return false;
}

function calculateNextRun(schedule: ReportSchedule): string {
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