import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface ProjectReportFilters {
  dateRange: {
    startDate: string;
    endDate: string;
    preset?: 'week' | 'month' | 'quarter' | 'year';
  };
  projectIds?: string[];
  clientIds?: string[];
  status?: string[];
  includeMetrics?: boolean;
  groupBy?: 'project' | 'client' | 'status' | 'date';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface ProjectReportDataItem {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  status: string;
  startDate: string;
  endDate: string;
  budgetHours: number;
  actualHours: number;
  budgetCost: number;
  actualCost: number;
  utilizationRate: number;
  profitMargin: number;
  teamMembers: string[];
  completionPercentage: number;
  hoursVariance: number;
  costVariance: number;
  isOverBudget: boolean;
  isOverdue: boolean;
  efficiency: number;
  recentActivity: string;
}

interface ProjectReportSummary {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;
  overBudgetProjects: number;
  totalBudgetHours: number;
  totalActualHours: number;
  totalBudgetCost: number;
  totalActualCost: number;
  averageUtilization: number;
  averageProfitMargin: number;
  totalTeamMembers: number;
}

interface ProjectReportResponse {
  reportId: string;
  reportType: string;
  generatedAt: string;
  filters: ProjectReportFilters;
  summary: ProjectReportSummary;
  data: ProjectReportDataItem[];
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
    console.log('Generate project report request:', JSON.stringify(event, null, 2));

    // Extract user info from authorizer context
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Check permissions - only managers and admins can view project reports
    if (userRole === 'employee') {
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
            message: 'Project reports require manager or admin privileges',
          },
        }),
      };
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const filters: ProjectReportFilters = {
      dateRange: {
        startDate: queryParams.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: queryParams.endDate || new Date().toISOString().split('T')[0],
        preset: queryParams.preset as any,
      },
      projectIds: queryParams.projectId ? [queryParams.projectId] : undefined,
      clientIds: queryParams.clientId ? [queryParams.clientId] : undefined,
      status: queryParams.status ? queryParams.status.split(',') : undefined,
      includeMetrics: queryParams.includeMetrics === 'true',
      groupBy: (queryParams.groupBy as any) || 'project',
      sortBy: queryParams.sortBy || 'actualHours',
      sortOrder: (queryParams.sortOrder as any) || 'desc',
      limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
    };

    // Generate cache key
    const cacheKey = generateCacheKey('project-report', filters, userId);
    
    // Check cache first
    const cachedReport = await getCachedReport(cacheKey);
    if (cachedReport) {
      console.log('Returning cached project report');
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
    const reportData = await generateProjectReport(filters, userId, userRole);
    
    // Cache the report (30 minutes TTL for project reports)
    await cacheReport(cacheKey, reportData, 1800);

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
    console.error('Error generating project report:', error);
    
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to generate project report');
  }
};

async function generateProjectReport(filters: ProjectReportFilters, userId: string, userRole: string): Promise<ProjectReportResponse> {
  const reportId = `project-report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const generatedAt = new Date().toISOString();

  // Get projects and related data
  const [projects, timeEntries, clients] = await Promise.all([
    getProjectsData(filters),
    getTimeEntriesForProjects(filters),
    getClientsData(),
  ]);

  // Transform and calculate project metrics
  const reportData = await transformProjectData(projects, timeEntries, clients, filters);
  const summary = calculateProjectSummary(reportData);

  // Apply sorting
  const sortedData = sortProjectData(reportData, filters.sortBy || 'actualHours', filters.sortOrder || 'desc');

  // Apply pagination
  const paginatedData = applyPagination(sortedData, filters.offset || 0, filters.limit || 50);

  return {
    reportId,
    reportType: 'project',
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
      cacheKey: generateCacheKey('project-report', filters, userId),
      expiresAt: new Date(Date.now() + 1800 * 1000).toISOString(),
    },
  };
}

async function getProjectsData(filters: ProjectReportFilters): Promise<any[]> {
  const projectsTable = process.env.PROJECTS_TABLE;
  
  if (!projectsTable) {
    throw new Error('PROJECTS_TABLE environment variable not set');
  }

  let queryParams: any = {
    TableName: projectsTable,
  };

  // Add filters
  let filterExpressions: string[] = [];
  let expressionAttributeNames: any = {};
  let expressionAttributeValues: any = {};

  if (filters.projectIds && filters.projectIds.length > 0) {
    filterExpressions.push('#id IN (:projectIds)');
    expressionAttributeNames['#id'] = 'id';
    expressionAttributeValues[':projectIds'] = filters.projectIds;
  }

  if (filters.clientIds && filters.clientIds.length > 0) {
    filterExpressions.push('#clientId IN (:clientIds)');
    expressionAttributeNames['#clientId'] = 'clientId';
    expressionAttributeValues[':clientIds'] = filters.clientIds;
  }

  if (filters.status && filters.status.length > 0) {
    filterExpressions.push('#status IN (:statuses)');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':statuses'] = filters.status;
  }

  if (filterExpressions.length > 0) {
    queryParams.FilterExpression = filterExpressions.join(' AND ');
    queryParams.ExpressionAttributeNames = expressionAttributeNames;
    queryParams.ExpressionAttributeValues = expressionAttributeValues;
  }

  const command = new ScanCommand(queryParams);
  const result = await docClient.send(command);
  
  return result.Items || [];
}

async function getTimeEntriesForProjects(filters: ProjectReportFilters): Promise<any[]> {
  const timeEntriesTable = process.env.TIME_ENTRIES_TABLE;
  
  if (!timeEntriesTable) {
    throw new Error('TIME_ENTRIES_TABLE environment variable not set');
  }

  const queryParams: any = {
    TableName: timeEntriesTable,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND #date BETWEEN :startDate AND :endDate',
    ExpressionAttributeNames: {
      '#date': 'date',
    },
    ExpressionAttributeValues: {
      ':startDate': filters.dateRange.startDate,
      ':endDate': filters.dateRange.endDate,
      ':pkPrefix': 'TIME_ENTRY#',
    },
  };

  // Add project filter if specified
  if (filters.projectIds && filters.projectIds.length > 0) {
    queryParams.FilterExpression += ' AND #projectId IN (:projectIds)';
    queryParams.ExpressionAttributeNames['#projectId'] = 'projectId';
    queryParams.ExpressionAttributeValues[':projectIds'] = filters.projectIds;
  }

  const command = new ScanCommand(queryParams);
  const result = await docClient.send(command);
  
  return result.Items || [];
}

async function getClientsData(): Promise<Map<string, any>> {
  const clientsTable = process.env.CLIENTS_TABLE;
  const clients = new Map();
  
  if (!clientsTable) {
    return clients;
  }

  try {
    const command = new ScanCommand({
      TableName: clientsTable,
    });
    const result = await docClient.send(command);
    
    if (result.Items) {
      result.Items.forEach(client => {
        clients.set(client.id, client);
      });
    }
  } catch (error) {
    console.error('Error fetching clients:', error);
  }

  return clients;
}

async function transformProjectData(
  projects: any[],
  timeEntries: any[],
  clients: Map<string, any>,
  filters: ProjectReportFilters
): Promise<ProjectReportDataItem[]> {
  // Group time entries by project
  const timeByProject = new Map<string, any[]>();
  timeEntries.forEach(entry => {
    if (entry.projectId) {
      if (!timeByProject.has(entry.projectId)) {
        timeByProject.set(entry.projectId, []);
      }
      timeByProject.get(entry.projectId)!.push(entry);
    }
  });

  // Get team members for each project
  const teamMembersByProject = await getTeamMembersByProject(projects);

  return projects.map(project => {
    const client = clients.get(project.clientId);
    const projectTimeEntries = timeByProject.get(project.id) || [];
    const teamMembers = teamMembersByProject.get(project.id) || [];

    // Calculate actual hours and cost
    const actualHours = projectTimeEntries.reduce((sum, entry) => {
      return sum + (entry.duration ? (entry.duration || 0) / 60 : 0);
    }, 0);

    const actualCost = projectTimeEntries.reduce((sum, entry) => {
      const hours = entry.duration ? (entry.duration || 0) / 60 : 0;
      const rate = entry.hourlyRate || project.hourlyRate || 0;
      return sum + (hours * rate);
    }, 0);

    // Get budget information
    const budgetHours = project.budgetHours || 0;
    const budgetCost = project.budgetCost || (budgetHours * (project.hourlyRate || 0));

    // Calculate metrics
    const hoursVariance = actualHours - budgetHours;
    const costVariance = actualCost - budgetCost;
    const utilizationRate = budgetHours > 0 ? (actualHours / budgetHours) * 100 : 0;
    const profitMargin = budgetCost > 0 ? ((budgetCost - actualCost) / budgetCost) * 100 : 0;
    const efficiency = actualHours > 0 ? (budgetHours / actualHours) * 100 : 100;

    // Calculate completion percentage
    const completionPercentage = calculateCompletionPercentage(project, actualHours, budgetHours);

    // Check status flags
    const isOverBudget = actualCost > budgetCost;
    const isOverdue = project.endDate && new Date(project.endDate) < new Date() && project.status === 'active';

    // Get recent activity
    const recentActivity = getRecentActivity(projectTimeEntries);

    return {
      projectId: project.id,
      projectName: project.name,
      clientId: project.clientId || '',
      clientName: client?.name || 'Unknown Client',
      status: project.status || 'unknown',
      startDate: project.startDate || '',
      endDate: project.endDate || '',
      budgetHours: Math.round(budgetHours * 100) / 100,
      actualHours: Math.round(actualHours * 100) / 100,
      budgetCost: Math.round(budgetCost * 100) / 100,
      actualCost: Math.round(actualCost * 100) / 100,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
      teamMembers,
      completionPercentage: Math.round(completionPercentage * 100) / 100,
      hoursVariance: Math.round(hoursVariance * 100) / 100,
      costVariance: Math.round(costVariance * 100) / 100,
      isOverBudget,
      isOverdue,
      efficiency: Math.round(efficiency * 100) / 100,
      recentActivity,
    };
  });
}

async function getTeamMembersByProject(projects: any[]): Promise<Map<string, string[]>> {
  // In a real implementation, this would query a project-team relationship table
  // For now, return empty arrays
  const teamMembers = new Map<string, string[]>();
  
  projects.forEach(project => {
    // Placeholder - in production, fetch actual team members
    teamMembers.set(project.id, project.teamMembers || []);
  });

  return teamMembers;
}

function calculateCompletionPercentage(project: any, actualHours: number, budgetHours: number): number {
  // Simple completion calculation based on hours
  if (project.status === 'completed') return 100;
  if (project.status === 'cancelled') return 0;
  if (budgetHours === 0) return 0;
  
  return Math.min((actualHours / budgetHours) * 100, 100);
}

function getRecentActivity(timeEntries: any[]): string {
  if (timeEntries.length === 0) return 'No recent activity';
  
  // Sort by date and get the most recent entry
  const sortedEntries = timeEntries.sort((a, b) => b.date.localeCompare(a.date));
  const mostRecent = sortedEntries[0];
  
  const daysSince = Math.floor((Date.now() - new Date(mostRecent.date).getTime()) / (24 * 60 * 60 * 1000));
  
  if (daysSince === 0) return 'Active today';
  if (daysSince === 1) return 'Active yesterday';
  if (daysSince < 7) return `Active ${daysSince} days ago`;
  if (daysSince < 30) return `Active ${Math.floor(daysSince / 7)} weeks ago`;
  return `Active ${Math.floor(daysSince / 30)} months ago`;
}

function calculateProjectSummary(data: ProjectReportDataItem[]): ProjectReportSummary {
  const totalProjects = data.length;
  const activeProjects = data.filter(p => p.status === 'active').length;
  const completedProjects = data.filter(p => p.status === 'completed').length;
  const overdueProjects = data.filter(p => p.isOverdue).length;
  const overBudgetProjects = data.filter(p => p.isOverBudget).length;

  const totalBudgetHours = data.reduce((sum, p) => sum + p.budgetHours, 0);
  const totalActualHours = data.reduce((sum, p) => sum + p.actualHours, 0);
  const totalBudgetCost = data.reduce((sum, p) => sum + p.budgetCost, 0);
  const totalActualCost = data.reduce((sum, p) => sum + p.actualCost, 0);

  const averageUtilization = data.length > 0 ? 
    data.reduce((sum, p) => sum + p.utilizationRate, 0) / data.length : 0;
  
  const averageProfitMargin = data.length > 0 ? 
    data.reduce((sum, p) => sum + p.profitMargin, 0) / data.length : 0;

  const allTeamMembers = new Set<string>();
  data.forEach(p => p.teamMembers.forEach(member => allTeamMembers.add(member)));

  return {
    totalProjects,
    activeProjects,
    completedProjects,
    overdueProjects,
    overBudgetProjects,
    totalBudgetHours: Math.round(totalBudgetHours * 100) / 100,
    totalActualHours: Math.round(totalActualHours * 100) / 100,
    totalBudgetCost: Math.round(totalBudgetCost * 100) / 100,
    totalActualCost: Math.round(totalActualCost * 100) / 100,
    averageUtilization: Math.round(averageUtilization * 100) / 100,
    averageProfitMargin: Math.round(averageProfitMargin * 100) / 100,
    totalTeamMembers: allTeamMembers.size,
  };
}

function sortProjectData(data: ProjectReportDataItem[], sortBy: string, sortOrder: string): ProjectReportDataItem[] {
  return data.sort((a, b) => {
    let aValue: any = a[sortBy as keyof ProjectReportDataItem];
    let bValue: any = b[sortBy as keyof ProjectReportDataItem];
    
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (sortOrder === 'desc') {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    } else {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    }
  });
}

function applyPagination(data: ProjectReportDataItem[], offset: number, limit: number): {
  data: ProjectReportDataItem[];
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

function generateCacheKey(reportType: string, filters: ProjectReportFilters, userId: string): string {
  const filterString = JSON.stringify({ ...filters, userId });
  return createHash('md5').update(`${reportType}-${filterString}`).digest('hex');
}

async function getCachedReport(cacheKey: string): Promise<ProjectReportResponse | null> {
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
    console.error('Error getting cached project report:', error);
    return null;
  }
}

async function cacheReport(cacheKey: string, reportData: ProjectReportResponse, ttlSeconds: number): Promise<void> {
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
    console.error('Error caching project report:', error);
    // Don't throw - caching failure shouldn't break the report generation
  }
} 