import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand, ScanCommandInput } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface ReportFilters {
  dateRange: {
    startDate: string;
    endDate: string;
    preset?: 'week' | 'month' | 'quarter' | 'year';
  };
  users?: string[];
  projects?: string[];
  clients?: string[];
  billable?: boolean;
  status?: string[];
  tags?: string[];
  groupBy?: 'user' | 'project' | 'client' | 'date';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface TimeReportDataItem {
  date: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  hours: number;
  billableHours: number;
  nonBillableHours: number;
  hourlyRate: number;
  totalCost: number;
  description: string;
  tags: string[];
}

interface ReportSummary {
  totalHours: number;
  totalCost: number;
  billableHours: number;
  nonBillableHours: number;
  projectCount: number;
  userCount: number;
  clientCount: number;
  averageHourlyRate: number;
  utilizationRate: number;
}

interface ReportResponse {
  reportId: string;
  reportType: string;
  generatedAt: string;
  filters: ReportFilters;
  summary: ReportSummary;
  data: TimeReportDataItem[];
  pagination?: {
    nextCursor?: string;
    hasMore: boolean;
    totalCount: number;
  };
  cacheInfo?: {
    cached: boolean;
    cacheKey: string;
    expiresAt: string;
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Generate time report request:', JSON.stringify(event, null, 2));

    // Extract user info from authorizer context
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const filters: ReportFilters = {
      dateRange: {
        startDate: queryParams.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: queryParams.endDate || new Date().toISOString().split('T')[0],
        preset: queryParams.preset as 'week' | 'month' | 'quarter' | 'year' | undefined,
      },
      users: queryParams.userId ? [queryParams.userId] : undefined,
      projects: queryParams.projectId ? [queryParams.projectId] : undefined,
      clients: queryParams.clientId ? [queryParams.clientId] : undefined,
      billable: queryParams.billable ? queryParams.billable === 'true' : undefined,
      groupBy: (queryParams.groupBy as 'user' | 'project' | 'client' | 'date') || 'date',
      sortBy: queryParams.sortBy || 'date',
      sortOrder: (queryParams.sortOrder as 'asc' | 'desc') || 'desc',
      limit: queryParams.limit ? parseInt(queryParams.limit) : 100,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
    };

    // Apply role-based access control
    if (userRole === 'employee') {
      // Employees can only see their own data
      filters.users = [userId];
    }

    // Generate cache key
    const cacheKey = generateCacheKey('time-report', filters, userId);
    
    // Check cache first
    const cachedReport = await getCachedReport(cacheKey);
    if (cachedReport) {
      console.log('Returning cached report');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          data: cachedReport,
        }),
      };
    }

    // Generate new report
    const reportData = await generateTimeReport(filters, userId, userRole);
    
    // Cache the report (1 hour TTL)
    await cacheReport(cacheKey, reportData, 3600);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: reportData,
      }),
    };

  } catch (error) {
    console.error('Error generating time report:', error);
    
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to generate time report');
  }
};

async function generateTimeReport(filters: ReportFilters, userId: string, userRole: string): Promise<ReportResponse> {
  const reportId = `time-report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const generatedAt = new Date().toISOString();

  // Query time entries based on filters
  const timeEntries = await queryTimeEntries(filters, userRole);
  
  // Get related data (users, projects, clients)
  const [users, projects, clients] = await Promise.all([
    getUsersData(timeEntries),
    getProjectsData(timeEntries),
    getClientsData(timeEntries),
  ]);

  // Transform and aggregate data
  const reportData = transformTimeEntries(timeEntries, users, projects, clients);
  const summary = calculateSummary(reportData);

  // Apply grouping and sorting
  const groupedData = groupData(reportData, filters.groupBy || 'date');
  const sortedData = sortData(groupedData, filters.sortBy || 'date', filters.sortOrder || 'desc');

  // Apply pagination
  const paginatedData = applyPagination(sortedData, filters.offset || 0, filters.limit || 100);

  return {
    reportId,
    reportType: 'time',
    generatedAt,
    filters,
    summary,
    data: paginatedData.data,
    pagination: {
      hasMore: paginatedData.hasMore,
      totalCount: sortedData.length,
      nextCursor: paginatedData.nextCursor,
    },
    cacheInfo: {
      cached: false,
      cacheKey: generateCacheKey('time-report', filters, userId),
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    },
  };
}

async function queryTimeEntries(filters: ReportFilters, userRole: string): Promise<Record<string, unknown>[]> {
  const timeEntriesTable = process.env.TIME_ENTRIES_TABLE;
  
  if (!timeEntriesTable) {
    throw new Error('TIME_ENTRIES_TABLE environment variable not set');
  }

  // Build query parameters based on filters
  const queryParams: ScanCommandInput = {
    TableName: timeEntriesTable,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND #date BETWEEN :startDate AND :endDate',
    ExpressionAttributeNames: {
      '#date': 'date',
    },
    ExpressionAttributeValues: {
      ':pkPrefix': 'TIME_ENTRY#',
      ':startDate': filters.dateRange.startDate,
      ':endDate': filters.dateRange.endDate,
    },
  };

  // Add additional filters
  if (filters.users && filters.users.length > 0) {
    queryParams.FilterExpression += ' AND #userId IN (:userIds)';
    queryParams.ExpressionAttributeNames!['#userId'] = 'userId';
    queryParams.ExpressionAttributeValues![':userIds'] = filters.users;
  }

  if (filters.projects && filters.projects.length > 0) {
    queryParams.FilterExpression += ' AND #projectId IN (:projectIds)';
    queryParams.ExpressionAttributeNames!['#projectId'] = 'projectId';
    queryParams.ExpressionAttributeValues![':projectIds'] = filters.projects;
  }

  if (filters.billable !== undefined) {
    queryParams.FilterExpression += ' AND #isBillable = :billable';
    queryParams.ExpressionAttributeNames!['#isBillable'] = 'isBillable';
    queryParams.ExpressionAttributeValues![':billable'] = filters.billable;
  }

  if (filters.status && filters.status.length > 0) {
    queryParams.FilterExpression += ' AND #status IN (:statuses)';
    queryParams.ExpressionAttributeNames!['#status'] = 'status';
    queryParams.ExpressionAttributeValues![':statuses'] = filters.status;
  }

  const command = new ScanCommand(queryParams);
  const result = await docClient.send(command);
  
  return (result.Items || []) as Record<string, unknown>[];
}

async function getUsersData(timeEntries: Record<string, unknown>[]): Promise<Map<string, Record<string, unknown>>> {
  const usersTable = process.env.USERS_TABLE;
  const userIds = [...new Set(timeEntries.map(entry => entry.userId as string))];
  const users = new Map<string, Record<string, unknown>>();

  if (!usersTable || userIds.length === 0) {
    return users;
  }

  // Batch get users (simplified - in production, use BatchGetItem)
  for (const userId of userIds) {
    try {
      const command = new GetCommand({
        TableName: usersTable,
        Key: { id: userId },
      });
      const result = await docClient.send(command);
      if (result.Item) {
        users.set(userId, result.Item as Record<string, unknown>);
      }
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
    }
  }

  return users;
}

async function getProjectsData(timeEntries: Record<string, unknown>[]): Promise<Map<string, Record<string, unknown>>> {
  const projectsTable = process.env.PROJECTS_TABLE;
  const projectIds = [...new Set(timeEntries.map(entry => entry.projectId as string))];
  const projects = new Map<string, Record<string, unknown>>();

  if (!projectsTable || projectIds.length === 0) {
    return projects;
  }

  // Batch get projects (simplified - in production, use BatchGetItem)
  for (const projectId of projectIds) {
    try {
      const command = new GetCommand({
        TableName: projectsTable,
        Key: { id: projectId },
      });
      const result = await docClient.send(command);
      if (result.Item) {
        projects.set(projectId, result.Item as Record<string, unknown>);
      }
    } catch (error) {
      console.error(`Error fetching project ${projectId}:`, error);
    }
  }

  return projects;
}

async function getClientsData(timeEntries: Record<string, unknown>[]): Promise<Map<string, Record<string, unknown>>> {
  const clientsTable = process.env.CLIENTS_TABLE;
  const projects = await getProjectsData(timeEntries);
  const clientIds = [...new Set(Array.from(projects.values()).map(project => project.clientId as string))];
  const clients = new Map<string, Record<string, unknown>>();

  if (!clientsTable || clientIds.length === 0) {
    return clients;
  }

  // Batch get clients (simplified - in production, use BatchGetItem)
  for (const clientId of clientIds) {
    try {
      const command = new GetCommand({
        TableName: clientsTable,
        Key: { id: clientId },
      });
      const result = await docClient.send(command);
      if (result.Item) {
        clients.set(clientId, result.Item as Record<string, unknown>);
      }
    } catch (error) {
      console.error(`Error fetching client ${clientId}:`, error);
    }
  }

  return clients;
}

function transformTimeEntries(
  timeEntries: Record<string, unknown>[],
  users: Map<string, Record<string, unknown>>,
  projects: Map<string, Record<string, unknown>>,
  clients: Map<string, Record<string, unknown>>
): TimeReportDataItem[] {
  return timeEntries.map(entry => {
    const user = users.get(entry.userId as string);
    const project = projects.get(entry.projectId as string);
    const client = clients.get(project?.clientId as string);
    
    // Duration is in minutes, convert to hours
    const hours = (Number(entry.duration) || 0) / 60;
    const billableHours = entry.isBillable ? hours : 0;
    const nonBillableHours = entry.isBillable ? 0 : hours;
    const hourlyRate = Number(entry.hourlyRate) || Number(project?.hourlyRate) || Number(user?.hourlyRate) || 0;
    const totalCost = billableHours * hourlyRate;

    // Parse tags if they're stored as JSON string
    let tags = entry.tags || [];
    if (typeof tags === 'string') {
      try {
        tags = JSON.parse(tags);
      } catch (e) {
        tags = [];
      }
    }

    return {
      date: entry.date as string,
      userId: entry.userId as string,
      userName: (user?.name as string) || (user?.email as string) || 'Unknown User',
      projectId: entry.projectId as string,
      projectName: (project?.name as string) || 'Unknown Project',
      clientId: (project?.clientId as string) || '',
      clientName: (client?.name as string) || 'Unknown Client',
      hours,
      billableHours,
      nonBillableHours,
      hourlyRate,
      totalCost,
      description: (entry.description as string) || '',
      tags: tags as string[],
    };
  });
}

function calculateSummary(data: TimeReportDataItem[]): ReportSummary {
  const totalHours = data.reduce((sum, item) => sum + item.hours, 0);
  const billableHours = data.reduce((sum, item) => sum + item.billableHours, 0);
  const nonBillableHours = data.reduce((sum, item) => sum + item.nonBillableHours, 0);
  const totalCost = data.reduce((sum, item) => sum + item.totalCost, 0);
  
  const uniqueProjects = new Set(data.map(item => item.projectId)).size;
  const uniqueUsers = new Set(data.map(item => item.userId)).size;
  const uniqueClients = new Set(data.map(item => item.clientId)).size;
  
  const averageHourlyRate = totalCost > 0 && billableHours > 0 ? totalCost / billableHours : 0;
  const utilizationRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

  return {
    totalHours,
    totalCost,
    billableHours,
    nonBillableHours,
    projectCount: uniqueProjects,
    userCount: uniqueUsers,
    clientCount: uniqueClients,
    averageHourlyRate,
    utilizationRate,
  };
}

function groupData(data: TimeReportDataItem[], groupBy: string): TimeReportDataItem[] {
  // For now, return data as-is. In production, implement proper grouping logic
  return data;
}

function sortData(data: TimeReportDataItem[], sortBy: string, sortOrder: string): TimeReportDataItem[] {
  return data.sort((a, b) => {
    let aValue: unknown = a[sortBy as keyof TimeReportDataItem];
    let bValue: unknown = b[sortBy as keyof TimeReportDataItem];
    
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = (bValue as string).toLowerCase();
    }
    
    if (sortOrder === 'desc') {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    } else {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    }
  });
}

function applyPagination(data: TimeReportDataItem[], offset: number, limit: number): {
  data: TimeReportDataItem[];
  hasMore: boolean;
  nextCursor?: string;
} {
  const startIndex = offset;
  const endIndex = startIndex + limit;
  const paginatedData = data.slice(startIndex, endIndex);
  const hasMore = endIndex < data.length;
  
  return {
    data: paginatedData,
    hasMore,
    nextCursor: hasMore ? (endIndex).toString() : undefined,
  };
}

function generateCacheKey(reportType: string, filters: ReportFilters, userId: string): string {
  const filterString = JSON.stringify({ ...filters, userId });
  return createHash('md5').update(`${reportType}-${filterString}`).digest('hex');
}

async function getCachedReport(cacheKey: string): Promise<ReportResponse | null> {
  try {
    const cacheTable = process.env.REPORT_CACHE_TABLE_NAME;
    if (!cacheTable) {
      return null;
    }

    const command = new GetCommand({
      TableName: cacheTable,
      Key: { cacheKey },
    });
    
    const result = await docClient.send(command);
    
    if (result.Item && result.Item.expiresAt > Date.now()) {
      const cachedData = result.Item.reportData;
      cachedData.cacheInfo = {
        cached: true,
        cacheKey,
        expiresAt: new Date(result.Item.expiresAt).toISOString(),
      };
      return cachedData;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting cached report:', error);
    return null;
  }
}

async function cacheReport(cacheKey: string, reportData: ReportResponse, ttlSeconds: number): Promise<void> {
  try {
    const cacheTable = process.env.REPORT_CACHE_TABLE_NAME;
    if (!cacheTable) {
      return;
    }

    const expiresAt = Date.now() + (ttlSeconds * 1000);
    
    const command = new PutCommand({
      TableName: cacheTable,
      Item: {
        cacheKey,
        reportData,
        reportType: reportData.reportType,
        generatedAt: reportData.generatedAt,
        expiresAt,
        dataSize: JSON.stringify(reportData).length,
      },
    });
    
    await docClient.send(command);
  } catch (error) {
    console.error('Error caching report:', error);
    // Don't throw - caching failure shouldn't break the report generation
  }
} 