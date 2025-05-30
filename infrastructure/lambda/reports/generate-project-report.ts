import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { createHash } from 'crypto';

// MANDATORY: Use repository pattern instead of direct DynamoDB
const timeEntryRepo = new TimeEntryRepository();

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
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'Project reports require manager or admin privileges');
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const filters: ProjectReportFilters = {
      dateRange: {
        startDate: queryParams.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: queryParams.endDate || new Date().toISOString().split('T')[0],
        preset: queryParams.preset as 'week' | 'month' | 'quarter' | 'year' | undefined,
      },
      projectIds: queryParams.projectId ? [queryParams.projectId] : undefined,
      clientIds: queryParams.clientId ? [queryParams.clientId] : undefined,
      status: queryParams.status ? queryParams.status.split(',') : undefined,
      includeMetrics: queryParams.includeMetrics === 'true',
      groupBy: (queryParams.groupBy as 'project' | 'client' | 'status' | 'date') || 'project',
      sortBy: queryParams.sortBy || 'actualHours',
      sortOrder: (queryParams.sortOrder as 'asc' | 'desc') || 'desc',
      limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
    };

    // Generate cache key
    const cacheKey = generateCacheKey('project-report', filters, userId);
    
    // Check cache first
    const cachedReport = await getCachedReport(cacheKey);
    if (cachedReport) {
      console.log('Returning cached project report');
      return createSuccessResponse(cachedReport);
    }

    // Generate new report
    const reportData = await generateProjectReport(filters, userId, userRole);
    
    // Cache the report (30 minutes TTL for project reports)
    await cacheReport(cacheKey, reportData, 1800);

    return createSuccessResponse(reportData);

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

async function getProjectsData(filters: ProjectReportFilters): Promise<Record<string, unknown>[]> {
  try {
    // Mock projects data - in production, create ProjectRepository
    const mockProjects = [
      { 
        id: 'proj1', name: 'Website Redesign', clientId: 'client1', status: 'active',
        startDate: '2024-01-01', endDate: '2024-03-31', budgetHours: 200, budgetCost: 15000,
        hourlyRate: 75, teamMembers: ['dev1', 'designer1']
      },
      { 
        id: 'proj2', name: 'Mobile App', clientId: 'client1', status: 'completed',
        startDate: '2023-10-01', endDate: '2024-01-15', budgetHours: 300, budgetCost: 24000,
        hourlyRate: 80, teamMembers: ['dev2', 'dev3']
      },
      { 
        id: 'proj3', name: 'Database Migration', clientId: 'client2', status: 'active',
        startDate: '2024-02-01', endDate: '2024-04-30', budgetHours: 150, budgetCost: 13500,
        hourlyRate: 90, teamMembers: ['dev4']
      },
    ];

    // Apply filters
    let filteredProjects = mockProjects;

    if (filters.projectIds && filters.projectIds.length > 0) {
      filteredProjects = filteredProjects.filter(project => filters.projectIds!.includes(project.id));
    }

    if (filters.clientIds && filters.clientIds.length > 0) {
      filteredProjects = filteredProjects.filter(project => filters.clientIds!.includes(project.clientId));
    }

    if (filters.status && filters.status.length > 0) {
      filteredProjects = filteredProjects.filter(project => filters.status!.includes(project.status));
    }

    return filteredProjects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}

async function getTimeEntriesForProjects(filters: ProjectReportFilters): Promise<Record<string, unknown>[]> {
  try {
    // Use TimeEntryRepository instead of direct DynamoDB access
    const result = await timeEntryRepo.listTimeEntries({
      dateFrom: filters.dateRange.startDate,
      dateTo: filters.dateRange.endDate,
    });

    let entries = result.items as unknown as Record<string, unknown>[];

    // Apply project filter if specified
    if (filters.projectIds && filters.projectIds.length > 0) {
      entries = entries.filter(entry => 
        filters.projectIds!.includes(entry.projectId as string)
      );
    }

    return entries;
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return [];
  }
}

async function getClientsData(): Promise<Map<string, Record<string, unknown>>> {
  try {
    // Mock clients data - in production, create ClientRepository
    const mockClients = [
      { id: 'client1', name: 'Acme Corp', email: 'contact@acme.com' },
      { id: 'client2', name: 'Beta Inc', email: 'contact@beta.com' },
      { id: 'client3', name: 'Gamma LLC', email: 'contact@gamma.com' },
    ];

    const clients = new Map<string, Record<string, unknown>>();
    mockClients.forEach(client => {
      clients.set(client.id, client);
    });

    return clients;
  } catch (error) {
    console.error('Error fetching clients:', error);
    return new Map();
  }
}

async function transformProjectData(
  projects: Record<string, unknown>[],
  timeEntries: Record<string, unknown>[],
  clients: Map<string, Record<string, unknown>>,
  filters: ProjectReportFilters
): Promise<ProjectReportDataItem[]> {
  // Group time entries by project
  const timeByProject = new Map<string, Record<string, unknown>[]>();
  timeEntries.forEach(entry => {
    if (entry.projectId) {
      if (!timeByProject.has(entry.projectId as string)) {
        timeByProject.set(entry.projectId as string, []);
      }
      timeByProject.get(entry.projectId as string)!.push(entry);
    }
  });

  // Get team members for each project
  const teamMembersByProject = await getTeamMembersByProject(projects);

  return projects.map(project => {
    const client = clients.get(project.clientId as string);
    const projectTimeEntries = timeByProject.get(project.id as string) || [];
    const teamMembers = teamMembersByProject.get(project.id as string) || [];

    // Calculate actual hours and cost
    const actualHours = projectTimeEntries.reduce((sum, entry) => {
      return sum + (entry.duration ? (Number(entry.duration) || 0) / 60 : 0);
    }, 0);

    const actualCost = projectTimeEntries.reduce((sum, entry) => {
      const hours = entry.duration ? (Number(entry.duration) || 0) / 60 : 0;
      const rate = Number(entry.hourlyRate) || Number(project.hourlyRate) || 0;
      return sum + (hours * rate);
    }, 0);

    // Get budget information
    const budgetHours = Number(project.budgetHours) || 0;
    const budgetCost = Number(project.budgetCost) || (budgetHours * (Number(project.hourlyRate) || 0));

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
    const isOverdue = project.endDate && new Date(project.endDate as string) < new Date() && project.status === 'active';

    // Get recent activity
    const recentActivity = getRecentActivity(projectTimeEntries);

    return {
      projectId: project.id as string,
      projectName: project.name as string,
      clientId: (project.clientId as string) || '',
      clientName: (client?.name as string) || 'Unknown Client',
      status: (project.status as string) || 'unknown',
      startDate: (project.startDate as string) || '',
      endDate: (project.endDate as string) || '',
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

async function getTeamMembersByProject(projects: Record<string, unknown>[]): Promise<Map<string, string[]>> {
  // In a real implementation, this would query a project-team relationship table
  // For now, return empty arrays
  const teamMembers = new Map<string, string[]>();
  
  projects.forEach(project => {
    // Placeholder - in production, fetch actual team members
    teamMembers.set(project.id as string, (project.teamMembers as string[]) || []);
  });

  return teamMembers;
}

function calculateCompletionPercentage(project: Record<string, unknown>, actualHours: number, budgetHours: number): number {
  // Simple completion calculation based on hours
  if (project.status === 'completed') return 100;
  if (project.status === 'cancelled') return 0;
  if (budgetHours === 0) return 0;
  
  return Math.min((actualHours / budgetHours) * 100, 100);
}

function getRecentActivity(timeEntries: Record<string, unknown>[]): string {
  if (timeEntries.length === 0) return 'No recent activity';
  
  // Sort by date and get the most recent entry
  const sortedEntries = timeEntries.sort((a, b) => (b.date as string).localeCompare(a.date as string));
  const mostRecent = sortedEntries[0];
  
  const daysSince = Math.floor((Date.now() - new Date(mostRecent.date as string).getTime()) / (24 * 60 * 60 * 1000));
  
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
    let aValue: unknown = a[sortBy as keyof ProjectReportDataItem];
    let bValue: unknown = b[sortBy as keyof ProjectReportDataItem];
    
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
    // Mock cache implementation - in production, create ReportCacheRepository
    // For now, return null to skip caching (reports will always be generated fresh)
    return null;
  } catch (error) {
    console.error('Error getting cached project report:', error);
    return null;
  }
}

async function cacheReport(cacheKey: string, reportData: ProjectReportResponse, ttlSeconds: number): Promise<void> {
  try {
    // Mock cache implementation - in production, create ReportCacheRepository
    // For now, just log that we would cache the report
    console.log(`Would cache project report with key: ${cacheKey} for ${ttlSeconds} seconds`);
  } catch (error) {
    console.error('Error caching project report:', error);
    // Don't throw - caching failure shouldn't break the report generation
  }
} 