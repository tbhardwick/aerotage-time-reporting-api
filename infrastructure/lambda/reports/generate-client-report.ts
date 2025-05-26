import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

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
            message: 'Client reports require manager or admin privileges',
          },
        }),
      };
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const filters: ClientReportFilters = {
      dateRange: {
        startDate: queryParams.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: queryParams.endDate || new Date().toISOString().split('T')[0],
        preset: queryParams.preset as any,
      },
      clientIds: queryParams.clientId ? [queryParams.clientId] : undefined,
      includeProjects: queryParams.includeProjects === 'true',
      includeBilling: queryParams.includeBilling === 'true',
      groupBy: (queryParams.groupBy as any) || 'client',
      sortBy: queryParams.sortBy || 'totalRevenue',
      sortOrder: (queryParams.sortOrder as any) || 'desc',
      limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
    };

    // Generate cache key
    const cacheKey = generateCacheKey('client-report', filters, userId);
    
    // Check cache first
    const cachedReport = await getCachedReport(cacheKey);
    if (cachedReport) {
      console.log('Returning cached client report');
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
    const reportData = await generateClientReport(filters, userId, userRole);
    
    // Cache the report (30 minutes TTL for client reports)
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
    console.error('Error generating client report:', error);
    
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to generate client report');
  }
};

async function generateClientReport(filters: ClientReportFilters, userId: string, userRole: string): Promise<ClientReportResponse> {
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
    cacheInfo: {
      cached: false,
      cacheKey: generateCacheKey('client-report', filters, userId),
      expiresAt: new Date(Date.now() + 1800 * 1000).toISOString(),
    },
  };
}

async function getClientsData(filters: ClientReportFilters): Promise<any[]> {
  const clientsTable = process.env.CLIENTS_TABLE;
  
  if (!clientsTable) {
    throw new Error('CLIENTS_TABLE environment variable not set');
  }

  let queryParams: any = {
    TableName: clientsTable,
  };

  // Add filters
  if (filters.clientIds && filters.clientIds.length > 0) {
    queryParams.FilterExpression = '#id IN (:clientIds)';
    queryParams.ExpressionAttributeNames = { '#id': 'id' };
    queryParams.ExpressionAttributeValues = { ':clientIds': filters.clientIds };
  }

  const command = new ScanCommand(queryParams);
  const result = await docClient.send(command);
  
  return result.Items || [];
}

async function getProjectsData(filters: ClientReportFilters): Promise<any[]> {
  const projectsTable = process.env.PROJECTS_TABLE;
  
  if (!projectsTable) {
    throw new Error('PROJECTS_TABLE environment variable not set');
  }

  let queryParams: any = {
    TableName: projectsTable,
  };

  // Add client filter if specified
  if (filters.clientIds && filters.clientIds.length > 0) {
    queryParams.FilterExpression = '#clientId IN (:clientIds)';
    queryParams.ExpressionAttributeNames = { '#clientId': 'clientId' };
    queryParams.ExpressionAttributeValues = { ':clientIds': filters.clientIds };
  }

  const command = new ScanCommand(queryParams);
  const result = await docClient.send(command);
  
  return result.Items || [];
}

async function getTimeEntriesForClients(filters: ClientReportFilters): Promise<any[]> {
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

  const command = new ScanCommand(queryParams);
  const result = await docClient.send(command);
  
  return result.Items || [];
}

async function getInvoicesData(filters: ClientReportFilters): Promise<any[]> {
  const invoicesTable = process.env.INVOICES_TABLE_NAME;
  
  if (!invoicesTable) {
    console.warn('INVOICES_TABLE_NAME not set, returning empty invoice data');
    return [];
  }

  try {
    let queryParams: any = {
      TableName: invoicesTable,
    };

    // Add client filter if specified
    if (filters.clientIds && filters.clientIds.length > 0) {
      queryParams.FilterExpression = '#clientId IN (:clientIds)';
      queryParams.ExpressionAttributeNames = { '#clientId': 'clientId' };
      queryParams.ExpressionAttributeValues = { ':clientIds': filters.clientIds };
    }

    const command = new ScanCommand(queryParams);
    const result = await docClient.send(command);
    
    return result.Items || [];
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
}

async function transformClientData(
  clients: any[],
  projects: any[],
  timeEntries: any[],
  invoices: any[],
  filters: ClientReportFilters
): Promise<ClientReportDataItem[]> {
  // Group projects by client
  const projectsByClient = new Map<string, any[]>();
  projects.forEach(project => {
    if (project.clientId) {
      if (!projectsByClient.has(project.clientId)) {
        projectsByClient.set(project.clientId, []);
      }
      projectsByClient.get(project.clientId)!.push(project);
    }
  });

  // Group time entries by project, then by client
  const timeByProject = new Map<string, any[]>();
  timeEntries.forEach(entry => {
    if (entry.projectId) {
      if (!timeByProject.has(entry.projectId)) {
        timeByProject.set(entry.projectId, []);
      }
      timeByProject.get(entry.projectId)!.push(entry);
    }
  });

  // Group invoices by client
  const invoicesByClient = new Map<string, any[]>();
  invoices.forEach(invoice => {
    if (invoice.clientId) {
      if (!invoicesByClient.has(invoice.clientId)) {
        invoicesByClient.set(invoice.clientId, []);
      }
      invoicesByClient.get(invoice.clientId)!.push(invoice);
    }
  });

  return clients.map(client => {
    const clientProjects = projectsByClient.get(client.id) || [];
    const clientInvoices = invoicesByClient.get(client.id) || [];

    // Calculate time and revenue across all client projects
    let totalHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;
    let totalRevenue = 0;
    let lastActivityDate = '';

    const projectSummaries: ClientProjectSummary[] = [];

    clientProjects.forEach(project => {
      const projectTimeEntries = timeByProject.get(project.id) || [];
      
      const projectHours = projectTimeEntries.reduce((sum, entry) => {
        return sum + (entry.duration ? (entry.duration || 0) / 60 : 0);
      }, 0);

      const projectBillableHours = projectTimeEntries
        .filter(entry => entry.isBillable)
        .reduce((sum, entry) => sum + (entry.duration ? (entry.duration || 0) / 60 : 0), 0);

      const projectRevenue = projectTimeEntries
        .filter(entry => entry.isBillable)
        .reduce((sum, entry) => {
          const hours = entry.duration ? (entry.duration || 0) / 60 : 0;
          const rate = entry.hourlyRate || project.hourlyRate || 0;
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
          projectId: project.id,
          projectName: project.name,
          status: project.status || 'unknown',
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
      clientId: client.id,
      clientName: client.name || 'Unknown Client',
      contactEmail: client.email || '',
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

function getProjectLastActivity(timeEntries: any[]): string {
  if (timeEntries.length === 0) return '';
  
  const sortedEntries = timeEntries.sort((a, b) => b.date.localeCompare(a.date));
  return sortedEntries[0].date;
}

function calculateInvoiceData(invoices: any[]): ClientInvoiceData {
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const totalPaid = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const totalOutstanding = invoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + (inv.amount || 0), 0);

  // Get last invoice date
  const sortedInvoices = invoices.sort((a, b) => b.issueDate?.localeCompare(a.issueDate) || 0);
  const lastInvoiceDate = sortedInvoices.length > 0 ? sortedInvoices[0].issueDate : '';

  // Calculate next invoice due (simplified - 30 days from last invoice)
  const nextInvoiceDue = lastInvoiceDate ? 
    new Date(new Date(lastInvoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : '';

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

  return {
    totalClients,
    activeClients,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    averageRevenuePerClient: Math.round(averageRevenuePerClient * 100) / 100,
    averageHoursPerClient: Math.round(averageHoursPerClient * 100) / 100,
    topClientByRevenue: sortedByRevenue.length > 0 ? sortedByRevenue[0].clientName : 'N/A',
    topClientByHours: sortedByHours.length > 0 ? sortedByHours[0].clientName : 'N/A',
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
      bValue = bValue.toLowerCase();
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

function generateCacheKey(reportType: string, filters: ClientReportFilters, userId: string): string {
  const filterString = JSON.stringify({ ...filters, userId });
  return createHash('md5').update(`${reportType}-${filterString}`).digest('hex');
}

async function getCachedReport(cacheKey: string): Promise<ClientReportResponse | null> {
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
    console.error('Error getting cached client report:', error);
    return null;
  }
}

async function cacheReport(cacheKey: string, reportData: ClientReportResponse, ttlSeconds: number): Promise<void> {
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
    console.error('Error caching client report:', error);
    // Don't throw - caching failure shouldn't break the report generation
  }
} 