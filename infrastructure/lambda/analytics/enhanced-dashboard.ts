import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createErrorResponse } from '../shared/response-helper';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { UserRepository } from '../shared/user-repository';

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
const timeEntryRepo = new TimeEntryRepository();
const userRepo = new UserRepository();

interface EnhancedDashboardRequest {
  widgets: WidgetConfig[];
  timeframe: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  customRange?: {
    startDate: string;
    endDate: string;
  };
  realTime?: boolean;
  includeForecasting?: boolean;
  includeBenchmarks?: boolean;
}

interface WidgetConfig {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'gauge' | 'heatmap' | 'trend' | 'alert';
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: { x: number; y: number };
  config: WidgetSpecificConfig;
}

interface WidgetSpecificConfig {
  metric?: string;
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  groupBy?: string;
  filters?: Record<string, unknown>;
  threshold?: number;
  target?: number;
  comparison?: 'previous_period' | 'target' | 'benchmark';
}

interface EnhancedDashboardResponse {
  dashboardId: string;
  widgets: WidgetData[];
  summary: DashboardSummary;
  realTimeData?: RealTimeMetrics;
  forecasting?: ForecastingData;
  benchmarks?: BenchmarkData;
  alerts: AlertData[];
  lastUpdated: string;
  nextUpdate?: string;
}

interface WidgetData {
  id: string;
  type: string;
  title: string;
  data: Record<string, unknown>;
  metadata: {
    lastUpdated: string;
    dataPoints: number;
    trend?: 'up' | 'down' | 'stable';
    changePercent?: number;
    status?: 'good' | 'warning' | 'critical';
  };
}

interface DashboardSummary {
  totalRevenue: number;
  totalHours: number;
  activeProjects: number;
  teamUtilization: number;
  averageHourlyRate: number;
  profitMargin: number;
  clientSatisfaction: number;
  productivityScore: number;
}

interface RealTimeMetrics {
  activeUsers: number;
  currentSessions: number;
  todayHours: number;
  todayRevenue: number;
  liveProjects: number;
  recentActivities: ActivityItem[];
}

interface ActivityItem {
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  details: Record<string, unknown>;
}

interface ForecastingData {
  revenueProjection: {
    nextMonth: number;
    nextQuarter: number;
    confidence: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  utilizationProjection: {
    nextWeek: number;
    nextMonth: number;
    confidence: number;
  };
  projectCompletion: {
    onTimeProjects: number;
    delayedProjects: number;
    averageDelay: number;
  };
}

interface BenchmarkData {
  industryAverages: {
    utilization: number;
    hourlyRate: number;
    profitMargin: number;
    clientRetention: number;
  };
  companyPerformance: {
    utilizationVsIndustry: number;
    rateVsIndustry: number;
    marginVsIndustry: number;
    retentionVsIndustry: number;
  };
}

interface AlertData {
  id: string;
  type: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
}

interface TimeEntryData {
  id?: string;
  userId?: string;
  projectId?: string;
  hours?: number;
  hourlyRate?: number;
  billable?: boolean;
  startDate?: string;
  startTime?: string;
  endTime?: string;
  productivityScore?: number;
}

interface ProjectData {
  id?: string;
  projectId?: string;
  name?: string;
  status?: string;
  managerId?: string;
  budget?: number;
  budgetHours?: number;
  isOverdue?: boolean;
}

interface ClientData {
  id: string;
  name: string;
  status: string;
}

interface UserData {
  userId?: string;
  name?: string;
  email?: string;
  role?: string;
}

interface DateRange {
  startDate: string;
  endDate: string;
}

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Enhanced dashboard request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // Extract user info from authorizer context
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';
    
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/analytics/enhanced-dashboard', event.httpMethod, 401, responseTime);
      businessLogger.logAuth(userId || 'unknown', 'enhanced-dashboard', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Add user context to tracer and logger
    businessTracer.addUserContext(userId);
    addRequestContext(requestId, userId);

    // Parse and validate request with tracing
    const dashboardRequest = await businessTracer.traceBusinessOperation(
      'parse-enhanced-dashboard-request',
      'analytics',
      async () => {
        let request: EnhancedDashboardRequest;
        
        if (event.httpMethod === 'POST' && event.body) {
          try {
            request = JSON.parse(event.body);
          } catch {
            throw new Error('Invalid JSON in request body');
          }
        } else {
          // Use default dashboard configuration
          request = getDefaultDashboardConfig();
        }

        // Apply query parameters for GET requests
        const queryParams = event.queryStringParameters || {};
        if (queryParams.timeframe) {
          request.timeframe = queryParams.timeframe as EnhancedDashboardRequest['timeframe'];
        }
        if (queryParams.realTime === 'true') {
          request.realTime = true;
        }
        if (queryParams.includeForecasting === 'true') {
          request.includeForecasting = true;
        }
        if (queryParams.includeBenchmarks === 'true') {
          request.includeBenchmarks = true;
        }

        return request;
      }
    );

    logger.info('Enhanced dashboard request parsed', { 
      userId,
      userRole,
      timeframe: dashboardRequest.timeframe,
      widgetCount: dashboardRequest.widgets.length,
      realTime: dashboardRequest.realTime,
      includeForecasting: dashboardRequest.includeForecasting,
      includeBenchmarks: dashboardRequest.includeBenchmarks
    });

    // Generate enhanced dashboard with tracing
    const dashboardData = await businessTracer.traceBusinessOperation(
      'generate-enhanced-dashboard',
      'analytics',
      async () => {
        return await generateEnhancedDashboard(dashboardRequest, userId, userRole);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/analytics/enhanced-dashboard', event.httpMethod, 200, responseTime);
    businessLogger.logBusinessOperation('generate', 'enhanced-dashboard', userId, true, { 
      userRole,
      timeframe: dashboardRequest.timeframe,
      widgetCount: dashboardRequest.widgets.length,
      realTime: dashboardRequest.realTime,
      includeForecasting: dashboardRequest.includeForecasting,
      includeBenchmarks: dashboardRequest.includeBenchmarks,
      totalRevenue: dashboardData.summary.totalRevenue,
      totalHours: dashboardData.summary.totalHours,
      activeProjects: dashboardData.summary.activeProjects,
      teamUtilization: dashboardData.summary.teamUtilization,
      alertCount: dashboardData.alerts.length
    });

    logger.info('Enhanced dashboard generated successfully', { 
      userId,
      userRole,
      timeframe: dashboardRequest.timeframe,
      widgetCount: dashboardData.widgets.length,
      totalRevenue: dashboardData.summary.totalRevenue,
      totalHours: dashboardData.summary.totalHours,
      alertCount: dashboardData.alerts.length,
      responseTime 
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'max-age=300', // 5 minute cache for non-real-time
      },
      body: JSON.stringify({
        success: true,
        data: dashboardData,
      }),
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/analytics/enhanced-dashboard', event.httpMethod, 500, responseTime);
    businessLogger.logError(error as Error, 'enhanced-dashboard', getCurrentUserId(event) || 'unknown');

    logger.error('Error generating enhanced dashboard', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    // Handle specific business logic errors
    if (error instanceof Error && error.message.includes('Invalid JSON in request body')) {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    return createErrorResponse(500, 'ENHANCED_DASHBOARD_FAILED', 'Failed to generate enhanced dashboard');
  }
};

function getDefaultDashboardConfig(): EnhancedDashboardRequest {
  return {
    widgets: [
      {
        id: 'revenue-kpi',
        type: 'kpi',
        title: 'Total Revenue',
        size: 'medium',
        position: { x: 0, y: 0 },
        config: {
          metric: 'revenue',
          comparison: 'previous_period',
        },
      },
      {
        id: 'utilization-gauge',
        type: 'gauge',
        title: 'Team Utilization',
        size: 'medium',
        position: { x: 1, y: 0 },
        config: {
          metric: 'utilization',
          target: 80,
          threshold: 70,
        },
      },
      {
        id: 'revenue-trend',
        type: 'chart',
        title: 'Revenue Trend',
        size: 'large',
        position: { x: 0, y: 1 },
        config: {
          metric: 'revenue',
          chartType: 'line',
          groupBy: 'month',
        },
      },
      {
        id: 'project-status',
        type: 'chart',
        title: 'Project Status',
        size: 'medium',
        position: { x: 2, y: 0 },
        config: {
          metric: 'projects',
          chartType: 'pie',
          groupBy: 'status',
        },
      },
      {
        id: 'productivity-heatmap',
        type: 'heatmap',
        title: 'Productivity Heatmap',
        size: 'large',
        position: { x: 1, y: 1 },
        config: {
          metric: 'productivity',
          groupBy: 'user_day',
        },
      },
    ],
    timeframe: 'month',
    realTime: false,
    includeForecasting: true,
    includeBenchmarks: true,
  };
}

async function generateEnhancedDashboard(
  request: EnhancedDashboardRequest,
  userId: string,
  userRole: string
): Promise<EnhancedDashboardResponse> {
  const dashboardId = `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Calculate date range
  const dateRange = calculateDateRange(request.timeframe, request.customRange);
  
  // Fetch base data
  const [timeEntries, projects, clients, users] = await Promise.all([
    fetchTimeEntries(dateRange, userId, userRole),
    fetchProjects(userId, userRole),
    fetchClients(),
    fetchUsers(userId, userRole),
  ]);

  // Generate widgets
  const widgets = await Promise.all(
    request.widgets.map(widget => generateWidget(widget, timeEntries, projects, clients, users, dateRange))
  );

  // Generate summary
  const summary = generateDashboardSummary(timeEntries, projects, clients, users);

  // Generate real-time data if requested
  let realTimeData: RealTimeMetrics | undefined;
  if (request.realTime) {
    realTimeData = await generateRealTimeMetrics();
  }

  // Generate forecasting data if requested
  let forecasting: ForecastingData | undefined;
  if (request.includeForecasting) {
    forecasting = await generateForecastingData(timeEntries, projects, dateRange);
  }

  // Generate benchmark data if requested
  let benchmarks: BenchmarkData | undefined;
  if (request.includeBenchmarks) {
    benchmarks = generateBenchmarkData(summary);
  }

  // Generate alerts
  const alerts = generateAlerts(summary, realTimeData, forecasting);

  return {
    dashboardId,
    widgets,
    summary,
    realTimeData,
    forecasting,
    benchmarks,
    alerts,
    lastUpdated: new Date().toISOString(),
    nextUpdate: request.realTime ? 
      new Date(Date.now() + 30000).toISOString() : // 30 seconds for real-time
      new Date(Date.now() + 300000).toISOString(), // 5 minutes for standard
  };
}

function calculateDateRange(timeframe: string, customRange?: { startDate: string; endDate: string }): DateRange {
  const now = new Date();
  let startDate: Date;
  let endDate = new Date(now);

  if (timeframe === 'custom' && customRange) {
    startDate = new Date(customRange.startDate);
    endDate = new Date(customRange.endDate);
  } else {
    switch (timeframe) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

async function fetchTimeEntries(dateRange: DateRange, userId: string, userRole: string): Promise<TimeEntryData[]> {
  try {
    // Use TimeEntryRepository instead of direct DynamoDB access
    const filters = {
      dateFrom: dateRange.startDate?.split('T')[0] || dateRange.startDate,
      dateTo: dateRange.endDate?.split('T')[0] || dateRange.endDate,
      userId: userRole === 'employee' ? userId : undefined,
    };

    const result = await timeEntryRepo.listTimeEntries(filters);
    return result.items;
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return [];
  }
}

async function fetchProjects(userId: string, userRole: string): Promise<ProjectData[]> {
  try {
    // Mock projects data - in production, create ProjectRepository
    const mockProjects = [
      { id: 'proj1', name: 'Project Alpha', status: 'active', managerId: userId },
      { id: 'proj2', name: 'Project Beta', status: 'completed', managerId: 'other' },
      { id: 'proj3', name: 'Project Gamma', status: 'active', managerId: userId },
    ];

    // Apply role-based filtering
    if (userRole === 'employee') {
      return mockProjects.filter(project => 
        project.managerId === userId // Simplified filtering
      );
    }

    return mockProjects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}

async function fetchClients(): Promise<ClientData[]> {
  try {
    // Mock clients data - in production, create ClientRepository
    const mockClients = [
      { id: 'client1', name: 'Acme Corp', status: 'active' },
      { id: 'client2', name: 'Beta Inc', status: 'active' },
      { id: 'client3', name: 'Gamma LLC', status: 'inactive' },
    ];

    return mockClients;
  } catch (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
}

async function fetchUsers(userId: string, userRole: string): Promise<UserData[]> {
  try {
    // Use UserRepository for user data
    if (userRole === 'employee') {
      const user = await userRepo.getUserById(userId);
      return user ? [user] : [];
    }

    // For admins/managers, return mock users list - in production, implement getUsersList
    const mockUsers = [
      { userId, name: 'Current User', role: userRole },
      { userId: 'user2', name: 'John Doe', role: 'employee' },
      { userId: 'user3', name: 'Jane Smith', role: 'manager' },
    ];

    return mockUsers;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

async function generateWidget(
  widget: WidgetConfig,
  timeEntries: TimeEntryData[],
  projects: ProjectData[],
  clients: ClientData[],
  users: UserData[],
  dateRange: DateRange
): Promise<WidgetData> {
  let data: Record<string, unknown>;
  const metadata: WidgetData['metadata'] = {
    lastUpdated: new Date().toISOString(),
    dataPoints: 0,
  };

  switch (widget.type) {
    case 'kpi':
      data = generateKPIData(widget.config.metric!, timeEntries, projects);
      metadata.trend = calculateTrend(data.current as number, data.previous as number);
      metadata.changePercent = calculateChangePercent(data.current as number, data.previous as number);
      metadata.status = getKPIStatus(data.current as number, widget.config.target, widget.config.threshold);
      break;

    case 'gauge':
      data = generateGaugeData(widget.config.metric!, timeEntries, projects, users);
      metadata.status = getGaugeStatus(data.value as number, widget.config.target, widget.config.threshold);
      break;

    case 'chart':
      data = generateChartData(widget.config, timeEntries, projects, clients, dateRange);
      metadata.dataPoints = (data.rows as unknown[])?.length || 0;
      break;

    case 'table':
      data = generateTableData(widget.config, timeEntries, projects, clients);
      metadata.dataPoints = (data.rows as unknown[])?.length || 0;
      break;

    case 'heatmap':
      data = generateHeatmapData(widget.config, timeEntries, users, dateRange);
      metadata.dataPoints = (data.data as unknown[])?.length || 0;
      break;

    case 'trend':
      data = generateTrendData(widget.config, timeEntries);
      metadata.trend = data.trend as 'up' | 'down' | 'stable';
      metadata.changePercent = data.changePercent as number;
      break;

    default:
      data = { message: 'Widget type not implemented' };
  }

  return {
    id: widget.id,
    type: widget.type,
    title: widget.title,
    data,
    metadata,
  };
}

function generateKPIData(metric: string, timeEntries: TimeEntryData[], projects: ProjectData[]): Record<string, unknown> {
  switch (metric) {
    case 'revenue':
      const totalRevenue = timeEntries
        .filter(entry => entry.billable)
        .reduce((sum, entry) => sum + (Number(entry.hours) * Number(entry.hourlyRate)), 0);
      return {
        current: totalRevenue,
        previous: totalRevenue * 0.85, // Mock previous period
        unit: 'currency',
        format: 'USD',
      };

    case 'hours':
      const totalHours = timeEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
      return {
        current: totalHours,
        previous: totalHours * 0.92,
        unit: 'hours',
        format: 'decimal',
      };

    case 'projects':
      const activeProjects = projects.filter(p => p.status === 'active').length;
      return {
        current: activeProjects,
        previous: Math.floor(activeProjects * 0.9),
        unit: 'count',
        format: 'integer',
      };

    case 'utilization':
      const workingHours = timeEntries.length * 8; // Assume 8 hours per day
      const actualHours = timeEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
      const utilization = workingHours > 0 ? (actualHours / workingHours) * 100 : 0;
      return {
        current: utilization,
        previous: utilization * 0.95,
        unit: 'percentage',
        format: 'decimal',
      };

    default:
      return { current: 0, previous: 0, unit: 'unknown' };
  }
}

function generateGaugeData(metric: string, timeEntries: TimeEntryData[], projects: ProjectData[], users: UserData[]): Record<string, unknown> {
  switch (metric) {
    case 'utilization':
      const totalPossibleHours = users.length * 40 * 4; // 40 hours/week * 4 weeks
      const totalActualHours = timeEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
      const utilization = totalPossibleHours > 0 ? (totalActualHours / totalPossibleHours) * 100 : 0;
      
      return {
        value: Math.round(utilization),
        min: 0,
        max: 100,
        unit: '%',
        segments: [
          { min: 0, max: 60, color: '#ff4444', label: 'Low' },
          { min: 60, max: 80, color: '#ffaa00', label: 'Good' },
          { min: 80, max: 100, color: '#00aa00', label: 'Excellent' },
        ],
      };

    case 'productivity':
      const avgProductivity = timeEntries.reduce((sum, entry) => sum + Number(entry.productivityScore || 75), 0) / timeEntries.length;
      
      return {
        value: Math.round(avgProductivity),
        min: 0,
        max: 100,
        unit: '%',
        segments: [
          { min: 0, max: 50, color: '#ff4444', label: 'Poor' },
          { min: 50, max: 75, color: '#ffaa00', label: 'Average' },
          { min: 75, max: 100, color: '#00aa00', label: 'High' },
        ],
      };

    default:
      return { value: 0, min: 0, max: 100, unit: '%' };
  }
}

function generateChartData(config: WidgetSpecificConfig, timeEntries: TimeEntryData[], projects: ProjectData[], _clients: ClientData[], _dateRange: DateRange): Record<string, unknown> {
  switch (config.metric) {
    case 'revenue':
      if (config.groupBy === 'month') {
        const monthlyData = groupByMonth(timeEntries);
        return {
          type: config.chartType || 'line',
          labels: monthlyData.map(d => d.month),
          datasets: [{
            label: 'Revenue',
            data: monthlyData.map(d => d.revenue),
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
          }],
        };
      }
      return { type: 'line', labels: [], datasets: [] };

    case 'projects':
      if (config.groupBy === 'status') {
        const statusCounts = projects.reduce((acc: Record<string, number>, project) => {
          const status = String(project.status || 'unknown');
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
        
        return {
          type: 'pie',
          labels: Object.keys(statusCounts),
          datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#6c757d'],
          }],
        };
      }
      return { type: 'pie', labels: [], datasets: [] };

    default:
      return { type: 'line', labels: [], datasets: [] };
  }
}

function generateTableData(config: WidgetSpecificConfig, timeEntries: TimeEntryData[], projects: ProjectData[], clients: ClientData[]): Record<string, unknown> {
  switch (config.metric) {
    case 'top_projects':
      const projectHours = projects.map(project => {
        const hours = timeEntries
          .filter(entry => entry.projectId === project.projectId)
          .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
        
        return {
          name: project.name || 'Unknown Project',
          hours,
          budget: project.budget,
          utilization: Number(project.budget || 0) > 0 ? (hours / Number(project.budgetHours || 1)) * 100 : 0,
        };
      }).sort((a, b) => b.hours - a.hours).slice(0, 10);

      return {
        headers: ['Project', 'Hours', 'Budget', 'Utilization'],
        rows: projectHours.map(p => [
          p.name,
          p.hours.toFixed(1),
          `$${Number(p.budget || 0).toLocaleString()}`,
          `${p.utilization.toFixed(1)}%`,
        ]),
      };

    default:
      return { headers: [], rows: [] };
  }
}

function generateHeatmapData(config: WidgetSpecificConfig, timeEntries: TimeEntryData[], users: UserData[], dateRange: DateRange): Record<string, unknown> {
  if (config.groupBy === 'user_day') {
    const heatmapData: Array<{ x: string; y: string; value: number }> = [];
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    
    users.forEach(user => {
      // Only process users with valid userId
      if (!user.userId) return;
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayKey = d.toISOString().split('T')[0];
        const dayEntries = timeEntries.filter(entry => {
          if (entry.userId !== user.userId) return false;
          const entryStartDate = entry.startTime || entry.startDate;
          if (!entryStartDate) return false;
          if (entryStartDate && dayKey) {
            return entryStartDate.startsWith(dayKey);
          }
          return false;
        });
        
        const dayHours = dayEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
        
        // Ensure we always have a valid string for the y-axis
        const userLabel: string = user.name || user.email || user.userId || 'Unknown User';
        
        const dateStr = d.toISOString().split('T')[0];
        if (dateStr) {
          heatmapData.push({
            x: dateStr,
            y: userLabel,
            value: dayHours,
          });
        }
      }
    });

    return {
      data: heatmapData,
      colorScale: {
        min: 0,
        max: 8,
        colors: ['#ffffff', '#c6e48b', '#7bc96f', '#239a3b', '#196127'],
      },
    };
  }

  return { data: [] };
}

function generateTrendData(config: WidgetSpecificConfig, timeEntries: TimeEntryData[]): Record<string, unknown> {
  const { metric } = config;
  const trendData = groupByWeek(timeEntries);
  
  return {
    labels: trendData.map(d => d.week),
    datasets: [{
      label: metric || 'Value',
      data: trendData.map(d => d.value),
      fill: false,
      borderColor: '#4CAF50',
      tension: 0.1
    }]
  };
}

function groupByMonth(timeEntries: TimeEntryData[]): Array<{ month: string; hours: number; revenue: number }> {
  const months = new Map<string, { month: string; hours: number; revenue: number }>();
  
  timeEntries.forEach(entry => {
    const startDate = entry.startDate || '';
    const month = startDate.substring(0, 7); // YYYY-MM
    if (!months.has(month)) {
      months.set(month, { month, hours: 0, revenue: 0 });
    }
    
    const data = months.get(month);
    if (data) {
      data.hours += Number(entry.hours || 0);
      if (entry.billable) {
        data.revenue += Number(entry.hours || 0) * Number(entry.hourlyRate || 0);
      }
    }
  });

  return Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function groupByWeek(timeEntries: TimeEntryData[]): Array<{ week: string; value: number }> {
  const weeks = new Map<string, { week: string; value: number }>();
  
  timeEntries.forEach(entry => {
    const startDate = entry.startDate || '';
    const date = new Date(startDate);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (weekKey) {
      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, { week: weekKey, value: 0 });
      }
      const weekData = weeks.get(weekKey);
      if (weekData) {
        weekData.value += Number(entry.hours || 0);
      }
    }
  });

  return Array.from(weeks.values()).sort((a, b) => a.week.localeCompare(b.week));
}

function generateDashboardSummary(timeEntries: TimeEntryData[], projects: ProjectData[], clients: ClientData[], users: UserData[]): DashboardSummary {
  const totalHours = timeEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const billableHours = timeEntries.filter(entry => entry.billable).reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const totalRevenue = timeEntries
    .filter(entry => entry.billable)
    .reduce((sum, entry) => sum + (Number(entry.hours || 0) * Number(entry.hourlyRate || 0)), 0);
  
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const totalPossibleHours = users.length * 40 * 4; // 40 hours/week * 4 weeks
  const teamUtilization = totalPossibleHours > 0 ? (totalHours / totalPossibleHours) * 100 : 0;
  const averageHourlyRate = billableHours > 0 ? totalRevenue / billableHours : 0;

  return {
    totalRevenue: Math.round(totalRevenue),
    totalHours: Math.round(totalHours * 10) / 10,
    activeProjects,
    teamUtilization: Math.round(teamUtilization),
    averageHourlyRate: Math.round(averageHourlyRate),
    profitMargin: 65, // Mock data
    clientSatisfaction: 87, // Mock data
    productivityScore: 78, // Mock data
  };
}

async function generateRealTimeMetrics(): Promise<RealTimeMetrics> {
  // In a real implementation, this would fetch live data
  return {
    activeUsers: 0,
    currentSessions: 0,
    todayHours: 0,
    todayRevenue: 0,
    liveProjects: 0,
    recentActivities: []
  };
}

async function generateForecastingData(timeEntries: TimeEntryData[], projects: ProjectData[], dateRange: DateRange): Promise<ForecastingData> {
  const monthlyRevenue = groupByMonth(timeEntries);
  const recentRevenue = monthlyRevenue.slice(-3).map(m => m.revenue);
  
  // Simple linear regression for forecasting
  const recentRevenueLength = recentRevenue.length;
  if (recentRevenueLength > 1) {
    const firstValue = recentRevenue[0];
    const lastValue = recentRevenue[recentRevenueLength - 1];
    if (firstValue !== undefined && lastValue !== undefined) {
      const projectedRevenue = (lastValue - firstValue) / (recentRevenueLength - 1);
      const nextMonthProjection = lastValue + projectedRevenue;
      const nextQuarterProjection = lastValue + (projectedRevenue * 3);
      
      return {
        revenueProjection: {
          nextMonth: Math.round(nextMonthProjection),
          nextQuarter: Math.round(nextQuarterProjection),
          confidence: 75,
          trend: projectedRevenue > 0 ? 'increasing' : projectedRevenue < 0 ? 'decreasing' : 'stable',
        },
        utilizationProjection: {
          nextWeek: 82,
          nextMonth: 78,
          confidence: 68,
        },
        projectCompletion: {
          onTimeProjects: projects.filter(p => p.status === 'completed' && !p.isOverdue).length,
          delayedProjects: projects.filter(p => p.isOverdue).length,
          averageDelay: 3.2, // days
        },
      };
    }
  }
  return {
    revenueProjection: {
      nextMonth: 0,
      nextQuarter: 0,
      confidence: 0,
      trend: 'stable',
    },
    utilizationProjection: {
      nextWeek: 0,
      nextMonth: 0,
      confidence: 0,
    },
    projectCompletion: {
      onTimeProjects: 0,
      delayedProjects: 0,
      averageDelay: 0,
    },
  };
}

function generateBenchmarkData(summary: DashboardSummary): BenchmarkData {
  // Mock industry benchmarks - in production, these would come from industry data
  const industryAverages = {
    utilization: 75,
    hourlyRate: 85,
    profitMargin: 60,
    clientRetention: 85,
  };

  return {
    industryAverages,
    companyPerformance: {
      utilizationVsIndustry: ((summary.teamUtilization - industryAverages.utilization) / industryAverages.utilization) * 100,
      rateVsIndustry: ((summary.averageHourlyRate - industryAverages.hourlyRate) / industryAverages.hourlyRate) * 100,
      marginVsIndustry: ((summary.profitMargin - industryAverages.profitMargin) / industryAverages.profitMargin) * 100,
      retentionVsIndustry: 5, // Mock data
    },
  };
}

function generateAlerts(summary: DashboardSummary, realTime?: RealTimeMetrics, forecasting?: ForecastingData): AlertData[] {
  const alerts: AlertData[] = [];

  // Low utilization alert
  if (summary.teamUtilization < 70) {
    alerts.push({
      id: `alert-${Date.now()}-1`,
      type: 'warning',
      title: 'Low Team Utilization',
      message: `Team utilization is ${summary.teamUtilization}%, below the target of 75%`,
      metric: 'utilization',
      currentValue: summary.teamUtilization,
      threshold: 75,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    });
  }

  // Revenue decline alert
  if (forecasting?.revenueProjection.trend === 'decreasing') {
    alerts.push({
      id: `alert-${Date.now()}-2`,
      type: 'critical',
      title: 'Revenue Decline Forecast',
      message: 'Revenue is projected to decline next month based on current trends',
      metric: 'revenue',
      currentValue: forecasting.revenueProjection.nextMonth,
      threshold: 0,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    });
  }

  // Overdue projects alert
  if (forecasting?.projectCompletion?.delayedProjects && forecasting.projectCompletion.delayedProjects > 0) {
    alerts.push({
      id: `alert-${Date.now()}-3`,
      type: 'warning',
      title: 'Overdue Projects',
      message: `${forecasting.projectCompletion.delayedProjects} projects are overdue`,
      metric: 'projects',
      currentValue: forecasting.projectCompletion.delayedProjects,
      threshold: 0,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    });
  }

  return alerts;
}

// Utility functions
function calculateTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
  const change = ((current - previous) / previous) * 100;
  return change > 5 ? 'up' : change < -5 ? 'down' : 'stable';
}

function calculateChangePercent(current: number, previous: number): number {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
}

function getKPIStatus(current: number, target?: number, threshold?: number): 'good' | 'warning' | 'critical' {
  if (!target && !threshold) return 'good';
  
  if (threshold && current < threshold) return 'critical';
  if (target && current < target * 0.9) return 'warning';
  
  return 'good';
}

function getGaugeStatus(value: number, target?: number, threshold?: number): 'good' | 'warning' | 'critical' {
  if (threshold && value < threshold) return 'critical';
  if (target && value < target) return 'warning';
  return 'good';
}

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 