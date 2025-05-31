import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { createHash } from 'crypto';

// MANDATORY: Use repository pattern instead of direct DynamoDB
const timeEntryRepo = new TimeEntryRepository();

interface ClientReportFilters {
  dateRange: {
    startDate: string;
    endDate: string;
    preset?: 'week' | 'month' | 'quarter' | 'year';
  };
  clientIds?: string[];
  includeProjects?: boolean;
  includeBilling?: boolean;
  groupBy?: 'client' | 'project' | 'date';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface ClientReportDataItem {
  clientId: string;
  clientName: string;
  contactEmail: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  totalRevenue: number;
  projectCount: number;
  activeProjects: number;
  completedProjects: number;
  averageHourlyRate: number;
  lastActivity: string;
  profitability: number;
  utilizationRate: number;
  projects: ClientProjectSummary[];
  invoiceData: ClientInvoiceData;
  paymentStatus: string;
  outstandingAmount: number;
}

interface ClientProjectSummary {
  projectId: string;
  projectName: string;
  status: string;
  hours: number;
  revenue: number;
  lastActivity: string;
}

interface ClientInvoiceData {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  lastInvoiceDate: string;
  nextInvoiceDue: string;
  invoiceCount: number;
}

interface ClientReportSummary {
  totalClients: number;
  activeClients: number;
  totalRevenue: number;
  totalHours: number;
  averageRevenuePerClient: number;
  averageHoursPerClient: number;
  topClientByRevenue: string;
  topClientByHours: string;
  totalOutstanding: number;
  averageProfitability: number;
}

interface ClientReportResponse {
  reportId: string;
  reportType: string;
  generatedAt: string;
  filters: ClientReportFilters;
  summary: ClientReportSummary;
  data: ClientReportDataItem[];
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
    console.log('Generate client report request:', JSON.stringify(event, null, 2));

    // Extract user info from authorizer context
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Check permissions - only managers and admins can view client reports
    if (userRole === 'employee') {
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'Client reports require manager or admin privileges');
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const defaultStartDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
    const defaultEndDate = new Date().toISOString().split('T')[0]!;

    const filters: ClientReportFilters = {
      dateRange: {
        startDate: queryParams.startDate || defaultStartDate,
        endDate: queryParams.endDate || defaultEndDate,
        preset: queryParams.preset as "week" | "month" | "quarter" | "year" | undefined,
      },
      clientIds: queryParams.clientId ? [queryParams.clientId] : undefined,
      includeProjects: queryParams.includeProjects === 'true',
      includeBilling: queryParams.includeBilling === 'true',
      groupBy: (queryParams.groupBy as 'client' | 'project' | 'date') || 'client',
      sortBy: queryParams.sortBy || 'totalRevenue',
      sortOrder: (queryParams.sortOrder as 'asc' | 'desc') || 'desc',
      limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
    };

    // Generate cache key
    const cacheKey = generateCacheKey(filters);
    
    // Check cache first
    const cachedReport = await getCachedReport(cacheKey);
    if (cachedReport) {
      console.log('Returning cached client report');
      return createSuccessResponse(cachedReport);
    }

    // Generate new report
    const reportData = await generateClientReport(filters);
    
    // Cache the report (30 minutes TTL for client reports)
    await cacheReport(reportData, 1800);

    return createSuccessResponse(reportData);

  } catch (error) {
    console.error('Error generating client report:', error);
    
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to generate client report');
  }
};

async function generateClientReport(filters: ClientReportFilters): Promise<ClientReportResponse> {
  const reportId = `client-report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const generatedAt = new Date().toISOString();

  // Get clients and related data
  const [clients, projects, timeEntries, invoices] = await Promise.all([
    getClientsData(filters),
    getProjectsData(filters),
    getTimeEntriesForClients(filters),
    getInvoicesData(filters),
  ]);

  // Transform and calculate client metrics
  const reportData = await transformClientData(clients, projects, timeEntries, invoices, filters);
  const summary = calculateClientSummary(reportData);

  // Apply sorting
  const sortedData = sortClientData(reportData, filters.sortBy || 'totalRevenue', filters.sortOrder || 'desc');

  // Apply pagination
  const paginatedData = applyPagination(sortedData, filters.offset || 0, filters.limit || 50);

  return {
    reportId,
    reportType: 'client',
    generatedAt,
    filters,
    summary,
    data: paginatedData.data,
    pagination: {
      hasMore: paginatedData.hasMore,
      totalCount: sortedData.length,
      nextCursor: paginatedData.nextCursor,
    },
  };
}

async function getClientsData(filters: ClientReportFilters): Promise<Record<string, unknown>[]> {
  try {
    // Mock clients data - in production, create ClientRepository
    const mockClients = [
      { id: 'client1', name: 'Acme Corp', email: 'contact@acme.com', isActive: true },
      { id: 'client2', name: 'Beta Inc', email: 'contact@beta.com', isActive: true },
      { id: 'client3', name: 'Gamma LLC', email: 'contact@gamma.com', isActive: false },
    ];

    // Apply filters
    if (filters.clientIds && filters.clientIds.length > 0) {
      return mockClients.filter(client => filters.clientIds!.includes(client.id));
    }

    return mockClients;
  } catch (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
}

async function getProjectsData(filters: ClientReportFilters): Promise<Record<string, unknown>[]> {
  try {
    // Mock projects data - in production, create ProjectRepository
    const mockProjects = [
      { id: 'proj1', name: 'Website Redesign', clientId: 'client1', status: 'active', hourlyRate: 75 },
      { id: 'proj2', name: 'Mobile App', clientId: 'client1', status: 'completed', hourlyRate: 80 },
      { id: 'proj3', name: 'Database Migration', clientId: 'client2', status: 'active', hourlyRate: 90 },
    ];

    // Apply filters
    if (filters.clientIds && filters.clientIds.length > 0) {
      return mockProjects.filter(project => filters.clientIds!.includes(project.clientId));
    }

    return mockProjects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}

async function getTimeEntriesForClients(filters: ClientReportFilters): Promise<Record<string, unknown>[]> {
  try {
    // Use TimeEntryRepository instead of direct DynamoDB access
    const result = await timeEntryRepo.listTimeEntries({
      dateFrom: filters.dateRange.startDate,
      dateTo: filters.dateRange.endDate,
    });

    return result.items as unknown as Record<string, unknown>[];
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return [];
  }
}

async function getInvoicesData(filters: ClientReportFilters): Promise<Record<string, unknown>[]> {
  try {
    // Mock invoices data - in production, create InvoiceRepository
    const mockInvoices = [
      { 
        id: 'inv1', clientId: 'client1', amount: 5000, status: 'paid', 
        issueDate: '2024-01-15', dueDate: '2024-02-14'
      },
      { 
        id: 'inv2', clientId: 'client1', amount: 3200, status: 'pending', 
        issueDate: '2024-02-15', dueDate: '2024-03-16'
      },
      { 
        id: 'inv3', clientId: 'client2', amount: 7500, status: 'paid', 
        issueDate: '2024-01-10', dueDate: '2024-02-09'
      },
    ];

    // Apply filters
    if (filters.clientIds && filters.clientIds.length > 0) {
      return mockInvoices.filter(invoice => filters.clientIds!.includes(invoice.clientId));
    }

    return mockInvoices;
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
}

async function transformClientData(
  clients: Record<string, unknown>[],
  projects: Record<string, unknown>[],
  timeEntries: Record<string, unknown>[],
  invoices: Record<string, unknown>[],
  filters: ClientReportFilters
): Promise<ClientReportDataItem[]> {
  // Group projects by client
  const projectsByClient = new Map<string, Record<string, unknown>[]>();
  projects.forEach(project => {
    if (project.clientId) {
      if (!projectsByClient.has(project.clientId as string)) {
        projectsByClient.set(project.clientId as string, []);
      }
      projectsByClient.get(project.clientId as string)!.push(project);
    }
  });

  // Group time entries by project, then by client
  const timeByProject = new Map<string, Record<string, unknown>[]>();
  timeEntries.forEach(entry => {
    if (entry.projectId) {
      if (!timeByProject.has(entry.projectId as string)) {
        timeByProject.set(entry.projectId as string, []);
      }
      timeByProject.get(entry.projectId as string)!.push(entry);
    }
  });

  // Group invoices by client
  const invoicesByClient = new Map<string, Record<string, unknown>[]>();
  invoices.forEach(invoice => {
    if (invoice.clientId) {
      if (!invoicesByClient.has(invoice.clientId as string)) {
        invoicesByClient.set(invoice.clientId as string, []);
      }
      invoicesByClient.get(invoice.clientId as string)!.push(invoice);
    }
  });

  return clients.map(client => {
    const clientProjects = projectsByClient.get(client.id as string) || [];
    const clientInvoices = invoicesByClient.get(client.id as string) || [];

    // Calculate time and revenue across all client projects
    let totalHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;
    let totalRevenue = 0;
    let lastActivityDate = '';

    const projectSummaries: ClientProjectSummary[] = [];

    clientProjects.forEach(project => {
      const projectTimeEntries = timeByProject.get(project.id as string) || [];
      
      const projectHours = projectTimeEntries.reduce((sum, entry) => {
        return sum + (entry.duration ? (Number(entry.duration) || 0) / 60 : 0);
      }, 0);

      const projectBillableHours = projectTimeEntries
        .filter(entry => entry.isBillable)
        .reduce((sum, entry) => sum + (entry.duration ? (Number(entry.duration) || 0) / 60 : 0), 0);

      const projectRevenue = projectTimeEntries
        .filter(entry => entry.isBillable)
        .reduce((sum, entry) => {
          const hours = entry.duration ? (Number(entry.duration) || 0) / 60 : 0;
          const rate = Number(entry.hourlyRate) || Number(project.hourlyRate) || 0;
          return sum + (hours * rate);
        }, 0);

      // Get most recent activity for this project
      const projectLastActivity = getProjectLastActivity(projectTimeEntries);
      if (projectLastActivity > lastActivityDate) {
        lastActivityDate = projectLastActivity;
      }

      totalHours += projectHours;
      billableHours += projectBillableHours;
      nonBillableHours += (projectHours - projectBillableHours);
      totalRevenue += projectRevenue;

      if (filters.includeProjects) {
        projectSummaries.push({
          projectId: project.id as string,
          projectName: project.name as string,
          status: (project.status as string) || 'unknown',
          hours: Math.round(projectHours * 100) / 100,
          revenue: Math.round(projectRevenue * 100) / 100,
          lastActivity: projectLastActivity || 'No activity',
        });
      }
    });

    // Calculate invoice data
    const invoiceData = calculateInvoiceData(clientInvoices);

    // Calculate metrics
    const averageHourlyRate = billableHours > 0 ? totalRevenue / billableHours : 0;
    const utilizationRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
    const profitability = calculateClientProfitability(totalRevenue, totalHours, averageHourlyRate);

    // Count project statuses
    const activeProjects = clientProjects.filter(p => p.status === 'active').length;
    const completedProjects = clientProjects.filter(p => p.status === 'completed').length;

    // Determine payment status
    const paymentStatus = determinePaymentStatus(invoiceData);

    return {
      clientId: client.id as string,
      clientName: (client.name as string) || 'Unknown Client',
      contactEmail: (client.email as string) || '',
      totalHours: Math.round(totalHours * 100) / 100,
      billableHours: Math.round(billableHours * 100) / 100,
      nonBillableHours: Math.round(nonBillableHours * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      projectCount: clientProjects.length,
      activeProjects,
      completedProjects,
      averageHourlyRate: Math.round(averageHourlyRate * 100) / 100,
      lastActivity: formatLastActivity(lastActivityDate),
      profitability: Math.round(profitability * 100) / 100,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      projects: projectSummaries,
      invoiceData,
      paymentStatus,
      outstandingAmount: invoiceData.totalOutstanding,
    };
  });
}

function getProjectLastActivity(timeEntries: Record<string, unknown>[]): string {
  if (timeEntries.length === 0) return '';
  
  const sortedEntries = timeEntries.sort((a, b) => (b.date as string).localeCompare(a.date as string));
  return sortedEntries[0]?.date as string || '';
}

function calculateInvoiceData(invoices: Record<string, unknown>[]): ClientInvoiceData {
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  const totalPaid = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  const totalOutstanding = invoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);

  // Get last invoice date
  const sortedInvoices = invoices.sort((a, b) => (b.issueDate as string)?.localeCompare(a.issueDate as string) || 0);
  const lastInvoiceDate = sortedInvoices.length > 0 ? (sortedInvoices[0]?.issueDate as string) : '';

  // Calculate next invoice due (simplified - 30 days from last invoice)
  const nextInvoiceDue = lastInvoiceDate ? 
    new Date(new Date(lastInvoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]! : '';

  return {
    totalInvoiced: Math.round(totalInvoiced * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    lastInvoiceDate,
    nextInvoiceDue,
    invoiceCount: invoices.length,
  };
}

function calculateClientProfitability(revenue: number, hours: number, hourlyRate: number): number {
  // Simplified profitability calculation
  // In production, this would include actual costs, overhead, etc.
  const estimatedCost = hours * (hourlyRate * 0.7); // Assume 70% of rate is cost
  return revenue > 0 ? ((revenue - estimatedCost) / revenue) * 100 : 0;
}

function determinePaymentStatus(invoiceData: ClientInvoiceData): string {
  if (invoiceData.totalOutstanding === 0) return 'current';
  if (invoiceData.totalOutstanding > invoiceData.totalPaid) return 'overdue';
  return 'pending';
}

function formatLastActivity(dateString: string): string {
  if (!dateString) return 'No recent activity';
  
  const daysSince = Math.floor((Date.now() - new Date(dateString).getTime()) / (24 * 60 * 60 * 1000));
  
  if (daysSince === 0) return 'Today';
  if (daysSince === 1) return 'Yesterday';
  if (daysSince < 7) return `${daysSince} days ago`;
  if (daysSince < 30) return `${Math.floor(daysSince / 7)} weeks ago`;
  return `${Math.floor(daysSince / 30)} months ago`;
}

function calculateClientSummary(data: ClientReportDataItem[]): ClientReportSummary {
  const totalClients = data.length;
  const activeClients = data.filter(c => c.lastActivity !== 'No recent activity').length;
  const totalRevenue = data.reduce((sum, c) => sum + c.totalRevenue, 0);
  const totalHours = data.reduce((sum, c) => sum + c.totalHours, 0);
  const totalOutstanding = data.reduce((sum, c) => sum + c.outstandingAmount, 0);

  const averageRevenuePerClient = totalClients > 0 ? totalRevenue / totalClients : 0;
  const averageHoursPerClient = totalClients > 0 ? totalHours / totalClients : 0;
  const averageProfitability = data.length > 0 ? 
    data.reduce((sum, c) => sum + c.profitability, 0) / data.length : 0;

  // Find top clients
  const sortedByRevenue = [...data].sort((a, b) => b.totalRevenue - a.totalRevenue);
  const sortedByHours = [...data].sort((a, b) => b.totalHours - a.totalHours);

  const topClientByRevenue = sortedByRevenue.length > 0 ? (sortedByRevenue[0]?.clientName || 'N/A') : 'N/A';
  const topClientByHours = sortedByHours.length > 0 ? (sortedByHours[0]?.clientName || 'N/A') : 'N/A';

  return {
    totalClients,
    activeClients,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    averageRevenuePerClient: Math.round(averageRevenuePerClient * 100) / 100,
    averageHoursPerClient: Math.round(averageHoursPerClient * 100) / 100,
    topClientByRevenue,
    topClientByHours,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    averageProfitability: Math.round(averageProfitability * 100) / 100,
  };
}

function sortClientData(data: ClientReportDataItem[], sortBy: string, sortOrder: string): ClientReportDataItem[] {
  return data.sort((a, b) => {
    let aValue: any = a[sortBy as keyof ClientReportDataItem];
    let bValue: any = b[sortBy as keyof ClientReportDataItem];
    
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

function applyPagination(data: ClientReportDataItem[], offset: number, limit: number): {
  data: ClientReportDataItem[];
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

function generateCacheKey(filters: ClientReportFilters): string {
  const filterString = JSON.stringify(filters);
  return createHash('sha256').update(filterString).digest('hex');
}

async function getCachedReport(cacheKey: string): Promise<ClientReportResponse | null> {
  try {
    // Mock cache implementation - in production, create ReportCacheRepository
    // For now, return null to skip caching (reports will always be generated fresh)
    return null;
  } catch (error) {
    console.error('Error getting cached client report:', error);
    return null;
  }
}

async function cacheReport(reportData: ClientReportResponse, ttlSeconds: number): Promise<void> {
  try {
    // Mock cache implementation - in production, create ReportCacheRepository
    // For now, just log that we would cache the report
    console.log(`Would cache report for ${ttlSeconds} seconds`);
  } catch (error) {
    console.error('Error caching client report:', error);
    // Don't throw - caching failure shouldn't break the report generation
  }
} 