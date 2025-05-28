import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createErrorResponse } from '../shared/response-helper';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

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

interface DateRange {
  startDate: string;
  endDate: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Enhanced dashboard request:', JSON.stringify(event, null, 2));

    // Extract user info from authorizer context
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse request body for POST requests
    let dashboardRequest: EnhancedDashboardRequest;
    if (event.httpMethod === 'POST' && event.body) {
      try {
        dashboardRequest = JSON.parse(event.body);
      } catch {
        return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
      }
    } else {
      // Default dashboard configuration
      dashboardRequest = getDefaultDashboardConfig();
    }

    // Apply query parameters
    const queryParams = event.queryStringParameters || {};
    if (queryParams.timeframe) {
      dashboardRequest.timeframe = queryParams.timeframe as EnhancedDashboardRequest['timeframe'];
    }
    if (queryParams.realTime === 'true') {
      dashboardRequest.realTime = true;
    }
    if (queryParams.forecasting === 'true') {
      dashboardRequest.includeForecasting = true;
    }
    if (queryParams.benchmarks === 'true') {
      dashboardRequest.includeBenchmarks = true;
    }

    // Generate enhanced dashboard
    const dashboardData = await generateEnhancedDashboard(dashboardRequest, userId, userRole);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': dashboardRequest.realTime ? 'no-cache' : 'max-age=300', // 5 min cache for non-real-time
      },
      body: JSON.stringify({
        success: true,
        data: dashboardData,
      }),
    };

  } catch (error) {
    console.error('Error generating enhanced dashboard:', error);
    
    return createErrorResponse(500, 'DASHBOARD_GENERATION_FAILED', 'Failed to generate enhanced dashboard');
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
    fetchClients(userId, userRole),
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
    realTimeData = await generateRealTimeMetrics(userId, userRole);
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

async function fetchTimeEntries(dateRange: DateRange, userId: string, userRole: string): Promise<Record<string, unknown>[]> {
  const timeEntriesTable = process.env.TIME_ENTRIES_TABLE_NAME;
  if (!timeEntriesTable) return [];

  try {
    let filterExpression = '#startDate BETWEEN :startDate AND :endDate';
    const expressionAttributeNames: Record<string, string> = { '#startDate': 'startDate' };
    const expressionAttributeValues: Record<string, unknown> = {
      ':startDate': dateRange.startDate,
      ':endDate': dateRange.endDate,
    };

    // Apply role-based filtering
    if (userRole === 'employee') {
      filterExpression += ' AND #userId = :userId';
      expressionAttributeNames['#userId'] = 'userId';
      expressionAttributeValues[':userId'] = userId;
    }

    const command = new ScanCommand({
      TableName: timeEntriesTable,
      FilterExpression: filterExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    const result = await docClient.send(command);
    return result.Items || [];
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return [];
  }
}

async function fetchProjects(userId: string, userRole: string): Promise<Record<string, unknown>[]> {
  const projectsTable = process.env.PROJECTS_TABLE_NAME;
  if (!projectsTable) return [];

  try {
    const command = new ScanCommand({
      TableName: projectsTable,
    });

    const result = await docClient.send(command);
    let projects = result.Items || [];

    // Apply role-based filtering
    if (userRole === 'employee') {
      projects = projects.filter(project => 
        project.teamMembers?.includes(userId) || project.managerId === userId
      );
    }

    return projects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}

async function fetchClients(_userId: string, _userRole: string): Promise<Record<string, unknown>[]> {
  const clientsTable = process.env.CLIENTS_TABLE_NAME;
  if (!clientsTable) return [];

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

async function fetchUsers(userId: string, userRole: string): Promise<Record<string, unknown>[]> {
  const usersTable = process.env.USERS_TABLE_NAME;
  if (!usersTable) return [];

  try {
    const command = new ScanCommand({
      TableName: usersTable,
    });

    const result = await docClient.send(command);
    let users = result.Items || [];

    // Apply role-based filtering
    if (userRole === 'employee') {
      users = users.filter(user => user.userId === userId);
    }

    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

async function generateWidget(
  widget: WidgetConfig,
  timeEntries: Record<string, unknown>[],
  projects: Record<string, unknown>[],
  clients: Record<string, unknown>[],
  users: Record<string, unknown>[],
  dateRange: DateRange
): Promise<WidgetData> {
  let data: Record<string, unknown>;
  const metadata: WidgetData['metadata'] = {
    lastUpdated: new Date().toISOString(),
    dataPoints: 0,
  };

  switch (widget.type) {
    case 'kpi':
      data = generateKPIData(widget.config.metric!, timeEntries, projects, clients);
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
      data = generateTrendData(widget.config, timeEntries, projects, dateRange);
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

function generateKPIData(metric: string, timeEntries: Record<string, unknown>[], projects: Record<string, unknown>[], _clients: Record<string, unknown>[]): Record<string, unknown> {
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

function generateGaugeData(metric: string, timeEntries: Record<string, unknown>[], projects: Record<string, unknown>[], users: Record<string, unknown>[]): Record<string, unknown> {
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

function generateChartData(config: WidgetSpecificConfig, timeEntries: Record<string, unknown>[], projects: Record<string, unknown>[], _clients: Record<string, unknown>[], _dateRange: DateRange): Record<string, unknown> {
  switch (config.metric) {
    case 'revenue':
      if (config.groupBy === 'month') {
        const monthlyData = groupByMonth(timeEntries, _dateRange);
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
      break;

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
      break;

    default:
      return { type: 'line', labels: [], datasets: [] };
  }
}

function generateTableData(config: WidgetSpecificConfig, timeEntries: Record<string, unknown>[], projects: Record<string, unknown>[], _clients: Record<string, unknown>[]): Record<string, unknown> {
  switch (config.metric) {
    case 'top_projects':
      const projectHours = projects.map(project => {
        const hours = timeEntries
          .filter(entry => entry.projectId === project.projectId)
          .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
        
        return {
          name: project.name,
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

function generateHeatmapData(config: WidgetSpecificConfig, timeEntries: Record<string, unknown>[], users: Record<string, unknown>[], dateRange: DateRange): Record<string, unknown> {
  if (config.groupBy === 'user_day') {
    const heatmapData: Array<{ x: string; y: string; value: number }> = [];
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    
    users.forEach(user => {
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayEntries = timeEntries.filter(entry => 
          entry.userId === user.userId && 
          String(entry.startDate || '').startsWith(d.toISOString().split('T')[0])
        );
        
        const dayHours = dayEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
        
        heatmapData.push({
          x: d.toISOString().split('T')[0],
          y: String(user.name || user.email || 'Unknown User'),
          value: dayHours,
        });
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

function generateTrendData(config: WidgetSpecificConfig, timeEntries: Record<string, unknown>[], _projects: Record<string, unknown>[], _dateRange: DateRange): Record<string, unknown> {
  const weeklyData = groupByWeek(timeEntries, _dateRange);
  const values = weeklyData.map(d => d.value);
  
  if (values.length < 2) {
    return { trend: 'stable', changePercent: 0, data: weeklyData };
  }

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
  
  const changePercent = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
  const trend = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable';

  return {
    trend,
    changePercent: Math.round(changePercent),
    data: weeklyData,
    forecast: generateSimpleForecast(values),
  };
}

function groupByMonth(timeEntries: Record<string, unknown>[], dateRange: DateRange): Array<{ month: string; hours: number; revenue: number }> {
  const months = new Map<string, { month: string; hours: number; revenue: number }>();
  
  timeEntries.forEach(entry => {
    const startDate = String(entry.startDate || '');
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

function groupByWeek(timeEntries: Record<string, unknown>[], dateRange: DateRange): Array<{ week: string; value: number }> {
  const weeks = new Map<string, { week: string; value: number }>();
  
  timeEntries.forEach(entry => {
    const startDate = String(entry.startDate || '');
    const date = new Date(startDate);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, { week: weekKey, value: 0 });
    }
    
    const weekData = weeks.get(weekKey);
    if (weekData) {
      weekData.value += Number(entry.hours || 0);
    }
  });

  return Array.from(weeks.values()).sort((a, b) => a.week.localeCompare(b.week));
}

function generateDashboardSummary(timeEntries: Record<string, unknown>[], projects: Record<string, unknown>[], clients: Record<string, unknown>[], users: Record<string, unknown>[]): DashboardSummary {
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

async function generateRealTimeMetrics(_userId: string, _userRole: string): Promise<RealTimeMetrics> {
  // Mock real-time data - in production, this would query live sessions and current activities
  return {
    activeUsers: 12,
    currentSessions: 8,
    todayHours: 45.5,
    todayRevenue: 3420,
    liveProjects: 6,
    recentActivities: [
      {
        userId: 'user1',
        userName: 'John Doe',
        action: 'Started timer',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        details: { project: 'Website Redesign' },
      },
      {
        userId: 'user2',
        userName: 'Jane Smith',
        action: 'Completed task',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        details: { task: 'Database optimization' },
      },
    ],
  };
}

async function generateForecastingData(timeEntries: Record<string, unknown>[], projects: Record<string, unknown>[], dateRange: DateRange): Promise<ForecastingData> {
  const monthlyRevenue = groupByMonth(timeEntries, dateRange);
  const recentRevenue = monthlyRevenue.slice(-3).map(m => m.revenue);
  
  // Simple linear regression for forecasting
  const avgGrowth = recentRevenue.length > 1 ? 
    (recentRevenue[recentRevenue.length - 1] - recentRevenue[0]) / (recentRevenue.length - 1) : 0;
  
  const lastRevenue = recentRevenue[recentRevenue.length - 1] || 0;
  const nextMonthProjection = lastRevenue + avgGrowth;
  const nextQuarterProjection = lastRevenue + (avgGrowth * 3);
  
  return {
    revenueProjection: {
      nextMonth: Math.round(nextMonthProjection),
      nextQuarter: Math.round(nextQuarterProjection),
      confidence: 75,
      trend: avgGrowth > 0 ? 'increasing' : avgGrowth < 0 ? 'decreasing' : 'stable',
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

function generateSimpleForecast(values: number[]): number[] {
  if (values.length < 2) return [];
  
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  
  if (firstValue === undefined || lastValue === undefined) return [];
  
  const trend = (lastValue - firstValue) / (values.length - 1);
  
  return [
    lastValue + trend,
    lastValue + (trend * 2),
    lastValue + (trend * 3),
  ];
} 