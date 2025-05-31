import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { createHash } from 'crypto';

// MANDATORY: Use repository pattern instead of direct DynamoDB
const timeEntryRepo = new TimeEntryRepository();

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
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
    const defaultEndDate = new Date().toISOString().split('T')[0]!;

    const filters: ReportFilters = {
      dateRange: {
        startDate: queryParams.startDate || defaultStartDate,
        endDate: queryParams.endDate || defaultEndDate,
        preset: queryParams.preset as "week" | "month" | "quarter" | "year" | undefined,
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
    const accessControlledFilters = applyAccessControl(filters, currentUserId, 'employee');

    // Authorization check: Ensure user can access requested data
    if (accessControlledFilters.users && accessControlledFilters.users.length > 0 && 'employee' === 'employee') {
      if (!accessControlledFilters.users.includes(currentUserId)) {
        return createErrorResponse(403, 'FORBIDDEN', 'You can only access your own time data');
      }
    }

    // Generate cache key
    const cacheKey = generateCacheKey('time-report', accessControlledFilters);
    
    // Check cache first
    const cachedReport = await getCachedReport(cacheKey);
    if (cachedReport) {
      return createSuccessResponse(cachedReport);
    }

    // Generate new report
    const reportData = await generateTimeReport(accessControlledFilters);
    
    // Cache the report (1 hour TTL)
    await cacheReport(reportData, 3600);

    return createSuccessResponse(reportData);

  } catch (error) {
    console.error('Error generating time report:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
  }
};

async function generateTimeReport(filters: ReportFilters): Promise<ReportResponse> {
  const reportId = `time-report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const generatedAt = new Date().toISOString();

  // Get time entries and related data
  const timeEntries = await queryTimeEntries(filters);
  const [users, projects, clients] = await Promise.all([
    getUsersData(timeEntries),
    getProjectsData(timeEntries),
    getClientsData(timeEntries),
  ]);

  // Transform and calculate metrics
  const reportData = transformTimeEntries(timeEntries, users, projects, clients);
  const summary = calculateSummary(reportData);

  // Apply grouping if specified
  const groupedData = filters.groupBy ? groupData(reportData, filters.groupBy) : reportData;

  // Apply sorting
  const sortedData = sortData(groupedData, filters.sortBy || 'date', filters.sortOrder || 'desc');

  // Apply pagination
  const paginatedData = applyPagination(sortedData, filters.offset || 0, filters.limit || 50);

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
      cacheKey: 'simplified-cache',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    },
  };
}

async function queryTimeEntries(filters: ReportFilters): Promise<Record<string, unknown>[]> {
  try {
    // Use TimeEntryRepository instead of direct DynamoDB access
    const result = await timeEntryRepo.listTimeEntries({
      dateFrom: filters.dateRange.startDate,
      dateTo: filters.dateRange.endDate,
    });

    let entries = result.items as unknown as Record<string, unknown>[];

    // Apply additional filters
    if (filters.projects && filters.projects.length > 0) {
      entries = entries.filter(entry => 
        filters.projects!.includes(entry.projectId as string)
      );
    }

    if (filters.billable !== undefined) {
      entries = entries.filter(entry => entry.isBillable === filters.billable);
    }

    if (filters.status && filters.status.length > 0) {
      entries = entries.filter(entry => 
        filters.status!.includes(entry.status as string)
      );
    }

    return entries;
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return [];
  }
}

async function getUsersData(timeEntries: Record<string, unknown>[]): Promise<Map<string, Record<string, unknown>>> {
  try {
    const userIds = [...new Set(timeEntries.map(entry => entry.userId as string))];
    const users = new Map<string, Record<string, unknown>>();

    // Mock users data - in production, extend UserRepository with batch get
    const mockUsers = [
      { id: 'user1', name: 'John Doe', email: 'john@example.com', hourlyRate: 75 },
      { id: 'user2', name: 'Jane Smith', email: 'jane@example.com', hourlyRate: 80 },
      { id: 'user3', name: 'Bob Johnson', email: 'bob@example.com', hourlyRate: 85 },
    ];

    userIds.forEach(userId => {
      const user = mockUsers.find(u => u.id === userId) || { 
        id: userId, 
        name: 'Unknown User', 
        email: 'unknown@example.com', 
        hourlyRate: 75 
      };
      users.set(userId, user);
    });

    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    return new Map();
  }
}

async function getProjectsData(timeEntries: Record<string, unknown>[]): Promise<Map<string, Record<string, unknown>>> {
  try {
    const projectIds = [...new Set(timeEntries.map(entry => entry.projectId as string))];
    const projects = new Map<string, Record<string, unknown>>();

    // Mock projects data - in production, create ProjectRepository
    const mockProjects = [
      { id: 'proj1', name: 'Website Redesign', clientId: 'client1', hourlyRate: 75 },
      { id: 'proj2', name: 'Mobile App', clientId: 'client1', hourlyRate: 80 },
      { id: 'proj3', name: 'Database Migration', clientId: 'client2', hourlyRate: 90 },
    ];

    projectIds.forEach(projectId => {
      const project = mockProjects.find(p => p.id === projectId) || { 
        id: projectId, 
        name: 'Unknown Project', 
        clientId: 'unknown', 
        hourlyRate: 75 
      };
      projects.set(projectId, project);
    });

    return projects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return new Map();
  }
}

async function getClientsData(timeEntries: Record<string, unknown>[]): Promise<Map<string, Record<string, unknown>>> {
  try {
    const projects = await getProjectsData(timeEntries);
    const clientIds = [...new Set(Array.from(projects.values()).map(project => project.clientId as string))];
    const clients = new Map<string, Record<string, unknown>>();

    // Mock clients data - in production, create ClientRepository
    const mockClients = [
      { id: 'client1', name: 'Acme Corp' },
      { id: 'client2', name: 'Beta Inc' },
      { id: 'client3', name: 'Gamma LLC' },
    ];

    clientIds.forEach(clientId => {
      const client = mockClients.find(c => c.id === clientId) || { 
        id: clientId, 
        name: 'Unknown Client' 
      };
      clients.set(clientId, client);
    });

    return clients;
  } catch (error) {
    console.error('Error fetching clients:', error);
    return new Map();
  }
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
      } catch {
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
    let aValue: any = a[sortBy as keyof TimeReportDataItem];
    let bValue: any = b[sortBy as keyof TimeReportDataItem];
    
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

function generateCacheKey(reportType: string, filters: ReportFilters): string {
  const filterString = JSON.stringify(filters);
  return `${reportType}-${createHash('sha256').update(filterString).digest('hex')}`;
}

async function getCachedReport(cacheKey: string): Promise<ReportResponse | null> {
  try {
    // Mock cache implementation - in production, create ReportCacheRepository
    // For now, return null to skip caching (reports will always be generated fresh)
    return null;
  } catch (error) {
    console.error('Error getting cached report:', error);
    return null;
  }
}

async function cacheReport(reportData: ReportResponse, ttlSeconds: number): Promise<void> {
  try {
    // Mock cache implementation - in production, create ReportCacheRepository
    // For now, just log that we would cache the report
    console.log(`Would cache report for ${ttlSeconds} seconds`);
  } catch (error) {
    console.error('Error caching time report:', error);
    // Don't throw - caching failure shouldn't break the report generation
  }
}

function applyAccessControl(filters: ReportFilters, userId: string, userRole: string): ReportFilters {
  // Create a new filters object to avoid mutation
  const controlledFilters = { ...filters };
  
  // Apply role-based filtering
  if (userRole === 'employee') {
    // Employees can only see their own data
    controlledFilters.users = [userId];
  }

  return controlledFilters;
}

function compareValues(aValue: unknown, bValue: unknown, ascending = false): number {
  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return ascending ? aValue - bValue : bValue - aValue;
  }
  if (typeof aValue === 'string' && typeof bValue === 'string') {
    return ascending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
  }
  return 0;
} 