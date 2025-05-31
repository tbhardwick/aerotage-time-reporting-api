import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';

// MANDATORY: Use repository pattern instead of direct DynamoDB
const timeEntryRepo = new TimeEntryRepository();

interface TimeEntryData {
  id?: string;
  userId?: string;
  projectId?: string;
  duration?: number;
  hourlyRate?: number;
  billable?: boolean;
  date?: string;
  userName?: string;
}

interface ProjectData {
  id?: string;
  name?: string;
  status?: string;
  isOverdue?: boolean;
  clientId?: string;
  endDate?: string;
}

interface ClientData {
  id: string;
  name: string;
  isActive: boolean;
}

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
  metadata?: Record<string, unknown>;
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
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'last30';
  metrics?: string[];
  compareWith?: 'previous' | 'year';
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
    const dashboardRequest: DashboardRequest = {
      period: (queryParams.period as 'day' | 'week' | 'month' | 'quarter' | 'year' | 'last30') || 'month',
      metrics: queryParams.metrics ? queryParams.metrics.split(',') : undefined,
      compareWith: queryParams.compareWith as 'previous' | 'year' | undefined,
    };

    // Validate period
    const validPeriods = ['day', 'week', 'month', 'quarter', 'year', 'last30'];
    if (!validPeriods.includes(dashboardRequest.period)) {
      return createErrorResponse(400, 'INVALID_PERIOD', `Invalid period. Must be one of: ${validPeriods.join(', ')}`);
    }

    // Generate dashboard data
    const dashboardData = await generateDashboardData(dashboardRequest, currentUserId, userRole);

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
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
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
    getProjectsData(),
    getClientsData(),
    request.compareWith ? getPreviousPeriodData() : Promise.resolve(null),
  ]);

  // Calculate KPIs
  const kpis = calculateKPIs(timeEntries, projects, clients);

  // Calculate trends (comparison with previous period)
  const trends = calculateTrends(kpis, previousPeriodData);

  // Generate chart data
  const charts = generateChartData(timeEntries, projects, clients);

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
  const endDateStr = now.toISOString().split('T')[0];
  
  if (!endDateStr) {
    throw new Error('Failed to generate end date');
  }
  
  const endDate = endDateStr;
  let startDate = endDate; // Default to same day

  switch (period) {
    case 'day':
      startDate = endDate;
      break;
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const weekStartStr = weekStart.toISOString().split('T')[0];
      if (weekStartStr) {
        startDate = weekStartStr;
      }
      break;
    case 'month':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      if (monthStartStr) {
        startDate = monthStartStr;
      }
      break;
    case 'quarter':
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const quarterStartStr = quarterStart.toISOString().split('T')[0];
      if (quarterStartStr) {
        startDate = quarterStartStr;
      }
      break;
    case 'year':
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearStartStr = yearStart.toISOString().split('T')[0];
      if (yearStartStr) {
        startDate = yearStartStr;
      }
      break;
    case 'last30':
      const last30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last30StartStr = last30Start.toISOString().split('T')[0];
      if (last30StartStr) {
        startDate = last30StartStr;
      }
      break;
  }

  return { startDate, endDate };
}

async function getTimeEntriesData(dateRange: { startDate: string; endDate: string }, filter: Record<string, unknown>): Promise<TimeEntryData[]> {
  try {
    // Use TimeEntryRepository instead of direct DynamoDB access
    const filters = {
      dateFrom: dateRange.startDate,
      dateTo: dateRange.endDate,
      userId: filter.userId as string | undefined,
    };

    const result = await timeEntryRepo.listTimeEntries(filters);
    return result.items;
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return [];
  }
}

async function getProjectsData(): Promise<ProjectData[]> {
  try {
    // Mock projects data - in production, create ProjectRepository
    const mockProjects = [
      { id: 'proj1', name: 'Project Alpha', status: 'active', isOverdue: false },
      { id: 'proj2', name: 'Project Beta', status: 'completed', isOverdue: false },
      { id: 'proj3', name: 'Project Gamma', status: 'active', isOverdue: true },
    ];

    return mockProjects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}

async function getClientsData(): Promise<ClientData[]> {
  try {
    // Mock clients data - in production, create ClientRepository
    const mockClients = [
      { id: 'client1', name: 'Acme Corp', isActive: true },
      { id: 'client2', name: 'Beta Inc', isActive: true },
      { id: 'client3', name: 'Gamma LLC', isActive: false },
    ];

    return mockClients;
  } catch (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
}

async function getPreviousPeriodData(): Promise<Record<string, unknown> | null> {
  // Get data from previous period for trend calculation
  // This is a simplified implementation - in production, implement proper period calculation
  return null;
}

function calculateKPIs(timeEntries: TimeEntryData[], projects: ProjectData[], clients: ClientData[]): DashboardData['kpis'] {
  // Calculate total hours and revenue
  const totalHours = timeEntries.reduce((sum, entry) => {
    return sum + (Number(entry.duration || 0) / 3600); // Convert seconds to hours
  }, 0);

  const billableEntries = timeEntries.filter(entry => entry.billable);
  const billableHours = billableEntries.reduce((sum, entry) => {
    return sum + (Number(entry.duration || 0) / 3600);
  }, 0);

  const totalRevenue = billableEntries.reduce((sum, entry) => {
    const hours = Number(entry.duration || 0) / 3600;
    const rate = Number(entry.hourlyRate || 0);
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

function calculateTrends(currentKPIs: DashboardData['kpis'], previousData: Record<string, unknown> | null): DashboardData['trends'] {
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
    revenueGrowth: Math.round(calculateGrowth(currentKPIs.totalRevenue, Number(previousData.totalRevenue || 0)) * 100) / 100,
    hoursGrowth: Math.round(calculateGrowth(currentKPIs.totalHours, Number(previousData.totalHours || 0)) * 100) / 100,
    projectGrowth: Math.round(calculateGrowth(currentKPIs.activeProjects, Number(previousData.activeProjects || 0)) * 100) / 100,
    clientGrowth: Math.round(calculateGrowth(currentKPIs.activeClients, Number(previousData.activeClients || 0)) * 100) / 100,
  };
}

function generateChartData(timeEntries: TimeEntryData[], projects: ProjectData[], clients: ClientData[]): DashboardData['charts'] {
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

function generateRevenueByMonth(timeEntries: TimeEntryData[]): ChartData[] {
  const monthlyRevenue = new Map<string, number>();

  timeEntries.forEach(entry => {
    if (entry.billable && entry.date) {
      const dateStr = String(entry.date || '');
      if (dateStr.length >= 7) {
        const month = dateStr.substring(0, 7); // YYYY-MM
        const hours = Number(entry.duration || 0) / 3600;
        const revenue = hours * Number(entry.hourlyRate || 0);
        
        monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + revenue);
      }
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

function generateHoursByProject(timeEntries: TimeEntryData[], projects: ProjectData[]): ChartData[] {
  const projectHours = new Map<string, number>();
  const projectNames = new Map<string, string>();

  // Build project name lookup with null checks
  projects.forEach(project => {
    if (project.id && project.name) {
      projectNames.set(project.id, project.name);
    }
  });

  timeEntries.forEach(entry => {
    if (entry.projectId) {
      const hours = Number(entry.duration || 0) / 3600;
      const projectId = entry.projectId;
      projectHours.set(projectId, (projectHours.get(projectId) || 0) + hours);
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

function generateUtilizationByUser(timeEntries: TimeEntryData[]): ChartData[] {
  const userStats = new Map<string, { total: number; billable: number; name: string }>();

  timeEntries.forEach(entry => {
    if (entry.userId) {
      const hours = Number(entry.duration || 0) / 3600;
      const userId = entry.userId;
      const userName = entry.userName || 'Unknown User';
      const stats = userStats.get(userId) || { total: 0, billable: 0, name: userName };
      
      stats.total += hours;
      if (entry.billable) {
        stats.billable += hours;
      }
      
      userStats.set(userId, stats);
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

function generateClientActivity(timeEntries: TimeEntryData[], projects: ProjectData[], clients: ClientData[]): ChartData[] {
  const clientHours = new Map<string, number>();
  const clientNames = new Map<string, string>();
  const projectClientMap = new Map<string, string>();

  // Build lookup maps with null checks
  clients.forEach(client => {
    clientNames.set(client.id, client.name);
  });

  projects.forEach(project => {
    if (project.id && project.clientId) {
      projectClientMap.set(project.id, project.clientId);
    }
  });

  timeEntries.forEach(entry => {
    if (entry.projectId) {
      const clientId = projectClientMap.get(entry.projectId);
      if (clientId) {
        const hours = Number(entry.duration || 0) / 3600;
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

function generateAlerts(kpis: DashboardData['kpis'], trends: DashboardData['trends'], projects: ProjectData[]): Alert[] {
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
      const endDateStr = String(project.endDate || '');
      if (endDateStr) {
        return new Date(endDateStr) < new Date();
      }
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