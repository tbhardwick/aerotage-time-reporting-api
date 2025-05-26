import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface DashboardData {
  kpis: {
    totalRevenue: number;
    totalHours: number;
    utilizationRate: number;
    activeProjects: number;
    activeClients: number;
    teamProductivity: number;
  };
  trends: {
    revenueGrowth: number;
    hoursGrowth: number;
    projectGrowth: number;
    clientGrowth: number;
  };
  charts: {
    revenueByMonth: ChartData[];
    hoursByProject: ChartData[];
    utilizationByUser: ChartData[];
    clientActivity: ChartData[];
  };
  alerts: Alert[];
  generatedAt: string;
  period: string;
}

interface ChartData {
  label: string;
  value: number;
  date?: string;
  metadata?: any;
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: string;
  actionRequired: boolean;
}

interface DashboardRequest {
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  metrics?: string[];
  compareWith?: 'previous' | 'year';
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Generate dashboard data request:', JSON.stringify(event, null, 2));

    // Extract user info from authorizer context
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const dashboardRequest: DashboardRequest = {
      period: (queryParams.period as any) || 'month',
      metrics: queryParams.metrics ? queryParams.metrics.split(',') : undefined,
      compareWith: queryParams.compareWith as any,
    };

    // Validate period
    const validPeriods = ['day', 'week', 'month', 'quarter', 'year'];
    if (!validPeriods.includes(dashboardRequest.period)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_PERIOD',
            message: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
          },
        }),
      };
    }

    // Generate dashboard data
    const dashboardData = await generateDashboardData(dashboardRequest, userId, userRole);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: dashboardData,
      }),
    };

  } catch (error) {
    console.error('Error generating dashboard data:', error);
    
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to generate dashboard data');
  }
};

async function generateDashboardData(request: DashboardRequest, userId: string, userRole: string): Promise<DashboardData> {
  const generatedAt = new Date().toISOString();
  const dateRange = getDateRange(request.period);

  // Get data based on user role
  const dataFilter = userRole === 'employee' ? { userId } : {};

  // Fetch all required data in parallel
  const [
    timeEntries,
    projects,
    clients,
    previousPeriodData,
  ] = await Promise.all([
    getTimeEntriesData(dateRange, dataFilter),
    getProjectsData(dataFilter),
    getClientsData(dataFilter),
    request.compareWith ? getPreviousPeriodData(request.period, dataFilter) : Promise.resolve(null),
  ]);

  // Calculate KPIs
  const kpis = calculateKPIs(timeEntries, projects, clients);

  // Calculate trends (comparison with previous period)
  const trends = calculateTrends(kpis, previousPeriodData);

  // Generate chart data
  const charts = generateChartData(timeEntries, projects, clients, request.period);

  // Generate alerts
  const alerts = generateAlerts(kpis, trends, projects);

  return {
    kpis,
    trends,
    charts,
    alerts,
    generatedAt,
    period: request.period,
  };
}

function getDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  let startDate: string;

  switch (period) {
    case 'day':
      startDate = endDate;
      break;
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      startDate = weekStart.toISOString().split('T')[0];
      break;
    case 'month':
      const monthStart = new Date(now);
      monthStart.setDate(1);
      startDate = monthStart.toISOString().split('T')[0];
      break;
    case 'quarter':
      const quarterStart = new Date(now);
      quarterStart.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
      startDate = quarterStart.toISOString().split('T')[0];
      break;
    case 'year':
      const yearStart = new Date(now.getFullYear(), 0, 1);
      startDate = yearStart.toISOString().split('T')[0];
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }

  return { startDate, endDate };
}

async function getTimeEntriesData(dateRange: { startDate: string; endDate: string }, filter: any): Promise<any[]> {
  const timeEntriesTable = process.env.TIME_ENTRIES_TABLE_NAME;
  
  if (!timeEntriesTable) {
    console.warn('TIME_ENTRIES_TABLE_NAME not set, returning empty data');
    return [];
  }

  try {
    const queryParams: any = {
      TableName: timeEntriesTable,
      FilterExpression: '#date BETWEEN :startDate AND :endDate',
      ExpressionAttributeNames: {
        '#date': 'date',
      },
      ExpressionAttributeValues: {
        ':startDate': dateRange.startDate,
        ':endDate': dateRange.endDate,
      },
    };

    // Add user filter for employees
    if (filter.userId) {
      queryParams.FilterExpression += ' AND #userId = :userId';
      queryParams.ExpressionAttributeNames['#userId'] = 'userId';
      queryParams.ExpressionAttributeValues[':userId'] = filter.userId;
    }

    const command = new ScanCommand(queryParams);
    const result = await docClient.send(command);
    
    return result.Items || [];
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return [];
  }
}

async function getProjectsData(filter: any): Promise<any[]> {
  const projectsTable = process.env.PROJECTS_TABLE_NAME;
  
  if (!projectsTable) {
    console.warn('PROJECTS_TABLE_NAME not set, returning empty data');
    return [];
  }

  try {
    const command = new ScanCommand({
      TableName: projectsTable,
    });
    const result = await docClient.send(command);
    
    return result.Items || [];
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}

async function getClientsData(filter: any): Promise<any[]> {
  const clientsTable = process.env.CLIENTS_TABLE_NAME;
  
  if (!clientsTable) {
    console.warn('CLIENTS_TABLE_NAME not set, returning empty data');
    return [];
  }

  try {
    const command = new ScanCommand({
      TableName: clientsTable,
    });
    const result = await docClient.send(command);
    
    return result.Items || [];
  } catch (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
}

async function getPreviousPeriodData(period: string, filter: any): Promise<any> {
  // Get data from previous period for trend calculation
  // This is a simplified implementation - in production, implement proper period calculation
  return null;
}

function calculateKPIs(timeEntries: any[], projects: any[], clients: any[]): DashboardData['kpis'] {
  // Calculate total hours and revenue
  const totalHours = timeEntries.reduce((sum, entry) => {
    return sum + (entry.duration ? entry.duration / 3600 : 0); // Convert seconds to hours
  }, 0);

  const billableEntries = timeEntries.filter(entry => entry.billable);
  const billableHours = billableEntries.reduce((sum, entry) => {
    return sum + (entry.duration ? entry.duration / 3600 : 0);
  }, 0);

  const totalRevenue = billableEntries.reduce((sum, entry) => {
    const hours = entry.duration ? entry.duration / 3600 : 0;
    const rate = entry.hourlyRate || 0;
    return sum + (hours * rate);
  }, 0);

  // Calculate utilization rate
  const utilizationRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

  // Count active projects and clients
  const activeProjects = projects.filter(project => project.status === 'active').length;
  const activeClients = clients.filter(client => client.isActive).length;

  // Calculate team productivity (simplified metric)
  const uniqueUsers = new Set(timeEntries.map(entry => entry.userId)).size;
  const teamProductivity = uniqueUsers > 0 ? totalHours / uniqueUsers : 0;

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    utilizationRate: Math.round(utilizationRate * 100) / 100,
    activeProjects,
    activeClients,
    teamProductivity: Math.round(teamProductivity * 100) / 100,
  };
}

function calculateTrends(currentKPIs: DashboardData['kpis'], previousData: any): DashboardData['trends'] {
  // If no previous data, return zero growth
  if (!previousData) {
    return {
      revenueGrowth: 0,
      hoursGrowth: 0,
      projectGrowth: 0,
      clientGrowth: 0,
    };
  }

  // Calculate percentage growth
  const calculateGrowth = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  return {
    revenueGrowth: Math.round(calculateGrowth(currentKPIs.totalRevenue, previousData.totalRevenue) * 100) / 100,
    hoursGrowth: Math.round(calculateGrowth(currentKPIs.totalHours, previousData.totalHours) * 100) / 100,
    projectGrowth: Math.round(calculateGrowth(currentKPIs.activeProjects, previousData.activeProjects) * 100) / 100,
    clientGrowth: Math.round(calculateGrowth(currentKPIs.activeClients, previousData.activeClients) * 100) / 100,
  };
}

function generateChartData(timeEntries: any[], projects: any[], clients: any[], period: string): DashboardData['charts'] {
  // Revenue by month (simplified - group by month)
  const revenueByMonth = generateRevenueByMonth(timeEntries);
  
  // Hours by project
  const hoursByProject = generateHoursByProject(timeEntries, projects);
  
  // Utilization by user
  const utilizationByUser = generateUtilizationByUser(timeEntries);
  
  // Client activity
  const clientActivity = generateClientActivity(timeEntries, projects, clients);

  return {
    revenueByMonth,
    hoursByProject,
    utilizationByUser,
    clientActivity,
  };
}

function generateRevenueByMonth(timeEntries: any[]): ChartData[] {
  const monthlyRevenue = new Map<string, number>();

  timeEntries.forEach(entry => {
    if (entry.billable && entry.date) {
      const month = entry.date.substring(0, 7); // YYYY-MM
      const hours = entry.duration ? entry.duration / 3600 : 0;
      const revenue = hours * (entry.hourlyRate || 0);
      
      monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + revenue);
    }
  });

  return Array.from(monthlyRevenue.entries())
    .map(([month, revenue]) => ({
      label: month,
      value: Math.round(revenue * 100) / 100,
      date: month,
    }))
    .sort((a, b) => a.date!.localeCompare(b.date!));
}

function generateHoursByProject(timeEntries: any[], projects: any[]): ChartData[] {
  const projectHours = new Map<string, number>();
  const projectNames = new Map<string, string>();

  // Build project name lookup
  projects.forEach(project => {
    projectNames.set(project.id, project.name);
  });

  timeEntries.forEach(entry => {
    if (entry.projectId) {
      const hours = entry.duration ? entry.duration / 3600 : 0;
      projectHours.set(entry.projectId, (projectHours.get(entry.projectId) || 0) + hours);
    }
  });

  return Array.from(projectHours.entries())
    .map(([projectId, hours]) => ({
      label: projectNames.get(projectId) || 'Unknown Project',
      value: Math.round(hours * 100) / 100,
      metadata: { projectId },
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Top 10 projects
}

function generateUtilizationByUser(timeEntries: any[]): ChartData[] {
  const userStats = new Map<string, { total: number; billable: number; name: string }>();

  timeEntries.forEach(entry => {
    if (entry.userId) {
      const hours = entry.duration ? entry.duration / 3600 : 0;
      const stats = userStats.get(entry.userId) || { total: 0, billable: 0, name: entry.userName || 'Unknown User' };
      
      stats.total += hours;
      if (entry.billable) {
        stats.billable += hours;
      }
      
      userStats.set(entry.userId, stats);
    }
  });

  return Array.from(userStats.entries())
    .map(([userId, stats]) => ({
      label: stats.name,
      value: stats.total > 0 ? Math.round((stats.billable / stats.total) * 10000) / 100 : 0, // Utilization percentage
      metadata: { userId, totalHours: stats.total, billableHours: stats.billable },
    }))
    .sort((a, b) => b.value - a.value);
}

function generateClientActivity(timeEntries: any[], projects: any[], clients: any[]): ChartData[] {
  const clientHours = new Map<string, number>();
  const clientNames = new Map<string, string>();
  const projectClientMap = new Map<string, string>();

  // Build lookup maps
  clients.forEach(client => {
    clientNames.set(client.id, client.name);
  });

  projects.forEach(project => {
    if (project.clientId) {
      projectClientMap.set(project.id, project.clientId);
    }
  });

  timeEntries.forEach(entry => {
    if (entry.projectId) {
      const clientId = projectClientMap.get(entry.projectId);
      if (clientId) {
        const hours = entry.duration ? entry.duration / 3600 : 0;
        clientHours.set(clientId, (clientHours.get(clientId) || 0) + hours);
      }
    }
  });

  return Array.from(clientHours.entries())
    .map(([clientId, hours]) => ({
      label: clientNames.get(clientId) || 'Unknown Client',
      value: Math.round(hours * 100) / 100,
      metadata: { clientId },
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Top 10 clients
}

function generateAlerts(kpis: DashboardData['kpis'], trends: DashboardData['trends'], projects: any[]): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  // Low utilization alert
  if (kpis.utilizationRate < 70) {
    alerts.push({
      id: `utilization-${Date.now()}`,
      type: 'warning',
      title: 'Low Utilization Rate',
      message: `Current utilization rate is ${kpis.utilizationRate}%. Consider reviewing project allocation.`,
      severity: kpis.utilizationRate < 50 ? 'high' : 'medium',
      createdAt: now,
      actionRequired: true,
    });
  }

  // Negative revenue growth alert
  if (trends.revenueGrowth < -10) {
    alerts.push({
      id: `revenue-decline-${Date.now()}`,
      type: 'error',
      title: 'Revenue Decline',
      message: `Revenue has decreased by ${Math.abs(trends.revenueGrowth)}% compared to the previous period.`,
      severity: 'high',
      createdAt: now,
      actionRequired: true,
    });
  }

  // Overdue projects alert (simplified check)
  const overdueProjects = projects.filter(project => {
    if (project.endDate && project.status === 'active') {
      return new Date(project.endDate) < new Date();
    }
    return false;
  });

  if (overdueProjects.length > 0) {
    alerts.push({
      id: `overdue-projects-${Date.now()}`,
      type: 'warning',
      title: 'Overdue Projects',
      message: `${overdueProjects.length} project(s) are past their deadline.`,
      severity: 'medium',
      createdAt: now,
      actionRequired: true,
    });
  }

  return alerts;
} 