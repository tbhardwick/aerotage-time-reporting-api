import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';

interface PerformanceMonitorRequest {
  timeframe: 'hour' | 'day' | 'week' | 'month';
  metrics: string[];
  includeRecommendations?: boolean;
  includeAlerts?: boolean;
  includeComparisons?: boolean;
}

interface PerformanceMonitorResponse {
  timestamp: string;
  timeframe: string;
  systemPerformance: SystemPerformance;
  apiPerformance: ApiPerformance;
  databasePerformance: DatabasePerformance;
  userExperience: UserExperience;
  recommendations?: PerformanceRecommendation[];
  alerts?: PerformanceAlert[];
  comparisons?: PerformanceComparison;
  summary: PerformanceSummary;
}

interface SystemPerformance {
  cpuUtilization: MetricData;
  memoryUtilization: MetricData;
  diskUtilization: MetricData;
  networkThroughput: MetricData;
  lambdaConcurrency: MetricData;
  lambdaDuration: MetricData;
  lambdaErrors: MetricData;
  lambdaThrottles: MetricData;
}

interface ApiPerformance {
  responseTime: MetricData;
  throughput: MetricData;
  errorRate: MetricData;
  successRate: MetricData;
  endpointPerformance: EndpointPerformance[];
  slowestEndpoints: EndpointMetric[];
  errorProneEndpoints: EndpointMetric[];
}

interface DatabasePerformance {
  readLatency: MetricData;
  writeLatency: MetricData;
  readThroughput: MetricData;
  writeThroughput: MetricData;
  throttledRequests: MetricData;
  consumedCapacity: MetricData;
  tablePerformance: TablePerformance[];
  slowestQueries: QueryMetric[];
}

interface UserExperience {
  averageSessionDuration: MetricData;
  bounceRate: MetricData;
  pageLoadTime: MetricData;
  userSatisfactionScore: MetricData;
  activeUsers: MetricData;
  sessionCount: MetricData;
}

interface MetricData {
  current: number;
  average: number;
  min: number;
  max: number;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  unit: string;
  dataPoints: number[];
  timestamps: string[];
}

interface EndpointPerformance {
  endpoint: string;
  method: string;
  responseTime: number;
  throughput: number;
  errorRate: number;
  successRate: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
}

interface EndpointMetric {
  endpoint: string;
  method: string;
  value: number;
  unit: string;
  impact: 'low' | 'medium' | 'high';
}

interface TablePerformance {
  tableName: string;
  readLatency: number;
  writeLatency: number;
  readThroughput: number;
  writeThroughput: number;
  throttledRequests: number;
  consumedCapacity: number;
}

interface QueryMetric {
  query: string;
  table: string;
  duration: number;
  frequency: number;
  impact: 'low' | 'medium' | 'high';
}

interface PerformanceRecommendation {
  id: string;
  type: 'optimization' | 'scaling' | 'configuration' | 'architecture';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  estimatedImprovement: string;
  implementation: string[];
  metrics: string[];
}

interface PerformanceAlert {
  id: string;
  type: 'performance' | 'capacity' | 'error' | 'latency';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: string;
  duration: number;
  affectedComponents: string[];
}

interface PerformanceComparison {
  previousPeriod: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    userSatisfaction: number;
  };
  improvement: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    userSatisfaction: number;
  };
  benchmarks: {
    industryAverage: number;
    bestPractice: number;
    currentPerformance: number;
  };
}

interface PerformanceSummary {
  overallScore: number;
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  keyMetrics: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    availability: number;
  };
  topIssues: string[];
  improvements: string[];
  nextActions: string[];
}

interface TimeRange {
  startTime: Date;
  endTime: Date;
  periodMinutes: number;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Performance monitor request:', JSON.stringify(event, null, 2));

    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    const { queryStringParameters } = event;

    // Only admins and managers can access performance monitoring
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
            code: 'ACCESS_DENIED',
            message: 'Performance monitoring requires admin or manager role',
          },
        }),
      };
    }

    // Parse request
    let monitorRequest: PerformanceMonitorRequest;
    if (event.body) {
      try {
        monitorRequest = JSON.parse(event.body);
      } catch {
        return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
      }
    } else {
      // Default configuration
      monitorRequest = {
        timeframe: 'day',
        metrics: ['system', 'api', 'database', 'user'],
        includeRecommendations: true,
        includeAlerts: true,
        includeComparisons: true,
      };
    }

    // Apply query parameters
    if (queryStringParameters) {
      if (queryStringParameters.timeframe) {
        monitorRequest.timeframe = queryStringParameters.timeframe as PerformanceMonitorRequest['timeframe'];
      }
    }

    // Generate performance monitoring data
    const performanceData = await generatePerformanceMonitoring(monitorRequest);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'max-age=300', // 5 minute cache
      },
      body: JSON.stringify({
        success: true,
        data: performanceData,
      }),
    };

  } catch (error) {
    console.error('Error generating performance monitoring:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'PERFORMANCE_MONITORING_FAILED',
          message: 'Failed to generate performance monitoring data',
        },
      }),
    };
  }
};

async function generatePerformanceMonitoring(
  request: PerformanceMonitorRequest
): Promise<PerformanceMonitorResponse> {
  const timestamp = new Date().toISOString();
  
  // Calculate time range
  const timeRange = calculateTimeRange(request.timeframe);
  
  // Generate performance data
  const [systemPerformance, apiPerformance, databasePerformance, userExperience] = await Promise.all([
    generateSystemPerformance(timeRange),
    generateApiPerformance(timeRange),
    generateDatabasePerformance(timeRange),
    generateUserExperience(timeRange),
  ]);

  // Generate recommendations if requested
  let recommendations: PerformanceRecommendation[] | undefined;
  if (request.includeRecommendations) {
    recommendations = generatePerformanceRecommendations(systemPerformance, apiPerformance, databasePerformance);
  }

  // Generate alerts if requested
  let alerts: PerformanceAlert[] | undefined;
  if (request.includeAlerts) {
    alerts = generatePerformanceAlerts(systemPerformance, apiPerformance, databasePerformance);
  }

  // Generate comparisons if requested
  let comparisons: PerformanceComparison | undefined;
  if (request.includeComparisons) {
    comparisons = await generatePerformanceComparisons();
  }

  // Generate summary
  const summary = generatePerformanceSummary(systemPerformance, apiPerformance, databasePerformance, userExperience);

  return {
    timestamp,
    timeframe: request.timeframe,
    systemPerformance,
    apiPerformance,
    databasePerformance,
    userExperience,
    recommendations,
    alerts,
    comparisons,
    summary,
  };
}

function calculateTimeRange(timeframe: string): TimeRange {
  const endTime = new Date();
  let startTime: Date;
  let periodMinutes: number;

  switch (timeframe) {
    case 'hour':
      startTime = new Date(endTime.getTime() - (60 * 60 * 1000));
      periodMinutes = 5; // 5-minute intervals
      break;
    case 'day':
      startTime = new Date(endTime.getTime() - (24 * 60 * 60 * 1000));
      periodMinutes = 60; // 1-hour intervals
      break;
    case 'week':
      startTime = new Date(endTime.getTime() - (7 * 24 * 60 * 60 * 1000));
      periodMinutes = 360; // 6-hour intervals
      break;
    case 'month':
      startTime = new Date(endTime.getTime() - (30 * 24 * 60 * 60 * 1000));
      periodMinutes = 1440; // 1-day intervals
      break;
    default:
      startTime = new Date(endTime.getTime() - (24 * 60 * 60 * 1000));
      periodMinutes = 60;
  }

  return { startTime, endTime, periodMinutes };
}

async function generateSystemPerformance(timeRange: TimeRange): Promise<SystemPerformance> {
  // Mock system performance data - in production, fetch from CloudWatch
  const generateMetricData = (baseValue: number, unit: string): MetricData => {
    const dataPoints = Array.from({ length: 24 }, () => 
      baseValue + (Math.random() - 0.5) * baseValue * 0.3
    );
    const current = dataPoints[dataPoints.length - 1];
    const average = dataPoints.reduce((sum, val) => sum + val, 0) / dataPoints.length;
    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints);
    const previousAverage = average * (0.9 + Math.random() * 0.2);
    const changePercent = ((average - previousAverage) / previousAverage) * 100;
    
    const currentValue = current !== undefined ? Math.round(current * 100) / 100 : 0;
    return {
      current: currentValue,
      average: Math.round(average * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      trend: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable',
      changePercent: Math.round(changePercent),
      unit,
      dataPoints: dataPoints.map(val => Math.round(val * 100) / 100),
      timestamps: dataPoints.map((_, i) => 
        new Date(timeRange.startTime.getTime() + (i * 60 * 60 * 1000)).toISOString()
      ),
    };
  };

  return {
    cpuUtilization: generateMetricData(45, '%'),
    memoryUtilization: generateMetricData(60, '%'),
    diskUtilization: generateMetricData(35, '%'),
    networkThroughput: generateMetricData(150, 'MB/s'),
    lambdaConcurrency: generateMetricData(25, 'concurrent'),
    lambdaDuration: generateMetricData(850, 'ms'),
    lambdaErrors: generateMetricData(2.5, '%'),
    lambdaThrottles: generateMetricData(0.5, '%'),
  };
}

async function generateApiPerformance(timeRange: TimeRange): Promise<ApiPerformance> {
  const generateMetricData = (baseValue: number, unit: string): MetricData => {
    const dataPoints = Array.from({ length: 24 }, () => 
      baseValue + (Math.random() - 0.5) * baseValue * 0.2
    );
    const current = dataPoints[dataPoints.length - 1];
    const average = dataPoints.reduce((sum, val) => sum + val, 0) / dataPoints.length;
    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints);
    const previousAverage = average * (0.95 + Math.random() * 0.1);
    const changePercent = ((average - previousAverage) / previousAverage) * 100;
    
    const currentValue = current !== undefined ? Math.round(current * 100) / 100 : 0;
    return {
      current: currentValue,
      average: Math.round(average * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      trend: changePercent > 3 ? 'up' : changePercent < -3 ? 'down' : 'stable',
      changePercent: Math.round(changePercent),
      unit,
      dataPoints: dataPoints.map(val => Math.round(val * 100) / 100),
      timestamps: dataPoints.map((_, i) => 
        new Date(timeRange.startTime.getTime() + (i * 60 * 60 * 1000)).toISOString()
      ),
    };
  };

  const endpointPerformance: EndpointPerformance[] = [
    {
      endpoint: '/reports/time',
      method: 'GET',
      responseTime: 245,
      throughput: 150,
      errorRate: 1.2,
      successRate: 98.8,
      p95ResponseTime: 380,
      p99ResponseTime: 650,
    },
    {
      endpoint: '/analytics/dashboard',
      method: 'GET',
      responseTime: 180,
      throughput: 200,
      errorRate: 0.8,
      successRate: 99.2,
      p95ResponseTime: 290,
      p99ResponseTime: 450,
    },
    {
      endpoint: '/time-entries',
      method: 'POST',
      responseTime: 120,
      throughput: 300,
      errorRate: 2.1,
      successRate: 97.9,
      p95ResponseTime: 200,
      p99ResponseTime: 350,
    },
  ];

  const slowestEndpoints: EndpointMetric[] = [
    { endpoint: '/reports/export', method: 'POST', value: 3200, unit: 'ms', impact: 'high' },
    { endpoint: '/reports/project', method: 'GET', value: 890, unit: 'ms', impact: 'medium' },
    { endpoint: '/analytics/advanced', method: 'POST', value: 650, unit: 'ms', impact: 'medium' },
  ];

  const errorProneEndpoints: EndpointMetric[] = [
    { endpoint: '/reports/export', method: 'POST', value: 5.2, unit: '%', impact: 'high' },
    { endpoint: '/time-entries', method: 'POST', value: 2.1, unit: '%', impact: 'medium' },
    { endpoint: '/projects', method: 'PUT', value: 1.8, unit: '%', impact: 'low' },
  ];

  return {
    responseTime: generateMetricData(220, 'ms'),
    throughput: generateMetricData(180, 'req/min'),
    errorRate: generateMetricData(1.5, '%'),
    successRate: generateMetricData(98.5, '%'),
    endpointPerformance,
    slowestEndpoints,
    errorProneEndpoints,
  };
}

async function generateDatabasePerformance(timeRange: TimeRange): Promise<DatabasePerformance> {
  const generateMetricData = (baseValue: number, unit: string): MetricData => {
    const dataPoints = Array.from({ length: 24 }, () => 
      baseValue + (Math.random() - 0.5) * baseValue * 0.25
    );
    const current = dataPoints[dataPoints.length - 1];
    const average = dataPoints.reduce((sum, val) => sum + val, 0) / dataPoints.length;
    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints);
    const previousAverage = average * (0.92 + Math.random() * 0.16);
    const changePercent = ((average - previousAverage) / previousAverage) * 100;
    
    const currentValue = current !== undefined ? Math.round(current * 100) / 100 : 0;
    return {
      current: currentValue,
      average: Math.round(average * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      trend: changePercent > 4 ? 'up' : changePercent < -4 ? 'down' : 'stable',
      changePercent: Math.round(changePercent),
      unit,
      dataPoints: dataPoints.map(val => Math.round(val * 100) / 100),
      timestamps: dataPoints.map((_, i) => 
        new Date(timeRange.startTime.getTime() + (i * 60 * 60 * 1000)).toISOString()
      ),
    };
  };

  const tablePerformance: TablePerformance[] = [
    {
      tableName: 'aerotage-time-entries-dev',
      readLatency: 12.5,
      writeLatency: 18.2,
      readThroughput: 45.8,
      writeThroughput: 23.1,
      throttledRequests: 0,
      consumedCapacity: 67.3,
    },
    {
      tableName: 'aerotage-projects-dev',
      readLatency: 8.9,
      writeLatency: 15.6,
      readThroughput: 32.4,
      writeThroughput: 12.7,
      throttledRequests: 0,
      consumedCapacity: 34.2,
    },
    {
      tableName: 'aerotage-report-cache-dev',
      readLatency: 6.2,
      writeLatency: 11.8,
      readThroughput: 89.5,
      writeThroughput: 45.3,
      throttledRequests: 0,
      consumedCapacity: 78.9,
    },
  ];

  const slowestQueries: QueryMetric[] = [
    {
      query: 'Scan on time-entries with complex filter',
      table: 'aerotage-time-entries-dev',
      duration: 450,
      frequency: 12,
      impact: 'high',
    },
    {
      query: 'Query on UserProjectIndex',
      table: 'aerotage-projects-dev',
      duration: 180,
      frequency: 35,
      impact: 'medium',
    },
    {
      query: 'Batch write to analytics-events',
      table: 'aerotage-analytics-events-dev',
      duration: 120,
      frequency: 67,
      impact: 'low',
    },
  ];

  return {
    readLatency: generateMetricData(9.2, 'ms'),
    writeLatency: generateMetricData(15.1, 'ms'),
    readThroughput: generateMetricData(55.7, 'RCU'),
    writeThroughput: generateMetricData(27.1, 'WCU'),
    throttledRequests: generateMetricData(0.1, 'count'),
    consumedCapacity: generateMetricData(60.2, '%'),
    tablePerformance,
    slowestQueries,
  };
}

async function generateUserExperience(timeRange: TimeRange): Promise<UserExperience> {
  const generateMetricData = (baseValue: number, unit: string): MetricData => {
    const dataPoints = Array.from({ length: 24 }, () => 
      baseValue + (Math.random() - 0.5) * baseValue * 0.15
    );
    const current = dataPoints[dataPoints.length - 1];
    const average = dataPoints.reduce((sum, val) => sum + val, 0) / dataPoints.length;
    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints);
    const previousAverage = average * (0.95 + Math.random() * 0.1);
    const changePercent = ((average - previousAverage) / previousAverage) * 100;
    
    const currentValue = current !== undefined ? Math.round(current * 100) / 100 : 0;
    return {
      current: currentValue,
      average: Math.round(average * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      trend: changePercent > 2 ? 'up' : changePercent < -2 ? 'down' : 'stable',
      changePercent: Math.round(changePercent),
      unit,
      dataPoints: dataPoints.map(val => Math.round(val * 100) / 100),
      timestamps: dataPoints.map((_, i) => 
        new Date(timeRange.startTime.getTime() + (i * 60 * 60 * 1000)).toISOString()
      ),
    };
  };

  return {
    averageSessionDuration: generateMetricData(28.5, 'minutes'),
    bounceRate: generateMetricData(12.3, '%'),
    pageLoadTime: generateMetricData(1.8, 'seconds'),
    userSatisfactionScore: generateMetricData(4.2, '/5'),
    activeUsers: generateMetricData(45, 'users'),
    sessionCount: generateMetricData(156, 'sessions'),
  };
}

function generatePerformanceRecommendations(
  systemPerf: SystemPerformance,
  apiPerf: ApiPerformance,
  dbPerf: DatabasePerformance
): PerformanceRecommendation[] {
  const recommendations: PerformanceRecommendation[] = [];

  // API Performance recommendations
  if (apiPerf.responseTime.average > 500) {
    recommendations.push({
      id: 'api-response-time',
      type: 'optimization',
      priority: 'high',
      title: 'Optimize API Response Times',
      description: 'Average API response time is above 500ms, impacting user experience',
      impact: 'Reduce response time by 30-40%',
      effort: 'medium',
      estimatedImprovement: '200-300ms faster responses',
      implementation: [
        'Implement response caching for frequently accessed endpoints',
        'Optimize database queries and add proper indexing',
        'Consider implementing pagination for large datasets',
        'Add compression for large response payloads',
      ],
      metrics: ['responseTime', 'userSatisfaction'],
    });
  }

  // Database Performance recommendations
  if (dbPerf.readLatency.average > 20) {
    recommendations.push({
      id: 'db-read-optimization',
      type: 'optimization',
      priority: 'medium',
      title: 'Optimize Database Read Performance',
      description: 'Database read latency is higher than optimal',
      impact: 'Improve read performance by 25-35%',
      effort: 'medium',
      estimatedImprovement: '5-10ms faster reads',
      implementation: [
        'Review and optimize Global Secondary Indexes',
        'Implement read replicas for read-heavy workloads',
        'Use DynamoDB Accelerator (DAX) for caching',
        'Optimize query patterns and avoid scans',
      ],
      metrics: ['readLatency', 'responseTime'],
    });
  }

  // System Performance recommendations
  if (systemPerf.lambdaDuration.average > 1000) {
    recommendations.push({
      id: 'lambda-optimization',
      type: 'optimization',
      priority: 'high',
      title: 'Optimize Lambda Function Performance',
      description: 'Lambda functions are taking longer than optimal to execute',
      impact: 'Reduce execution time by 20-30%',
      effort: 'low',
      estimatedImprovement: '200-300ms faster execution',
      implementation: [
        'Increase Lambda memory allocation for CPU-intensive functions',
        'Optimize cold start performance with provisioned concurrency',
        'Minimize package size and dependencies',
        'Use connection pooling for database connections',
      ],
      metrics: ['lambdaDuration', 'responseTime'],
    });
  }

  // Scaling recommendations
  if (systemPerf.lambdaConcurrency.average > 80) {
    recommendations.push({
      id: 'scaling-optimization',
      type: 'scaling',
      priority: 'medium',
      title: 'Implement Auto-Scaling Strategies',
      description: 'High concurrency levels indicate need for better scaling',
      impact: 'Improve system reliability and performance under load',
      effort: 'high',
      estimatedImprovement: 'Better handling of traffic spikes',
      implementation: [
        'Configure auto-scaling for DynamoDB tables',
        'Implement SQS for asynchronous processing',
        'Use CloudFront for static content caching',
        'Consider implementing circuit breakers',
      ],
      metrics: ['concurrency', 'throughput', 'errorRate'],
    });
  }

  return recommendations;
}

function generatePerformanceAlerts(
  systemPerf: SystemPerformance,
  apiPerf: ApiPerformance,
  dbPerf: DatabasePerformance
): PerformanceAlert[] {
  const alerts: PerformanceAlert[] = [];
  const now = new Date();

  // High response time alert
  if (apiPerf.responseTime.current > 1000) {
    alerts.push({
      id: `alert-${now.getTime()}-response-time`,
      type: 'latency',
      severity: apiPerf.responseTime.current > 2000 ? 'critical' : 'warning',
      title: 'High API Response Time',
      message: `Current response time is ${apiPerf.responseTime.current}ms`,
      metric: 'responseTime',
      currentValue: apiPerf.responseTime.current,
      threshold: 1000,
      timestamp: now.toISOString(),
      duration: 15, // minutes
      affectedComponents: ['API Gateway', 'Lambda Functions'],
    });
  }

  // High error rate alert
  if (apiPerf.errorRate.current > 5) {
    alerts.push({
      id: `alert-${now.getTime()}-error-rate`,
      type: 'error',
      severity: apiPerf.errorRate.current > 10 ? 'critical' : 'warning',
      title: 'High API Error Rate',
      message: `Current error rate is ${apiPerf.errorRate.current}%`,
      metric: 'errorRate',
      currentValue: apiPerf.errorRate.current,
      threshold: 5,
      timestamp: now.toISOString(),
      duration: 10,
      affectedComponents: ['API Endpoints', 'Lambda Functions'],
    });
  }

  // Database throttling alert
  if (dbPerf.throttledRequests.current > 0) {
    alerts.push({
      id: `alert-${now.getTime()}-db-throttling`,
      type: 'capacity',
      severity: 'critical',
      title: 'Database Throttling Detected',
      message: `${dbPerf.throttledRequests.current} throttled requests detected`,
      metric: 'throttledRequests',
      currentValue: dbPerf.throttledRequests.current,
      threshold: 0,
      timestamp: now.toISOString(),
      duration: 5,
      affectedComponents: ['DynamoDB Tables'],
    });
  }

  // High Lambda duration alert
  if (systemPerf.lambdaDuration.current > 5000) {
    alerts.push({
      id: `alert-${now.getTime()}-lambda-duration`,
      type: 'performance',
      severity: 'warning',
      title: 'High Lambda Execution Time',
      message: `Lambda execution time is ${systemPerf.lambdaDuration.current}ms`,
      metric: 'lambdaDuration',
      currentValue: systemPerf.lambdaDuration.current,
      threshold: 5000,
      timestamp: now.toISOString(),
      duration: 8,
      affectedComponents: ['Lambda Functions'],
    });
  }

  return alerts;
}

async function generatePerformanceComparisons(): Promise<PerformanceComparison> {
  // Mock comparison data - in production, fetch historical data
  return {
    previousPeriod: {
      responseTime: 280,
      throughput: 165,
      errorRate: 2.1,
      userSatisfaction: 4.0,
    },
    improvement: {
      responseTime: -12.5, // 12.5% improvement (negative is better)
      throughput: 9.1,     // 9.1% improvement
      errorRate: -28.6,    // 28.6% improvement (negative is better)
      userSatisfaction: 5.0, // 5% improvement
    },
    benchmarks: {
      industryAverage: 350,
      bestPractice: 200,
      currentPerformance: 245,
    },
  };
}

function generatePerformanceSummary(
  systemPerf: SystemPerformance,
  apiPerf: ApiPerformance,
  dbPerf: DatabasePerformance,
  userExp: UserExperience
): PerformanceSummary {
  // Calculate overall performance score
  const responseTimeScore = Math.max(0, 100 - (apiPerf.responseTime.average / 10));
  const errorRateScore = Math.max(0, 100 - (apiPerf.errorRate.average * 10));
  const throughputScore = Math.min(100, apiPerf.throughput.average / 2);
  const userSatisfactionScore = (userExp.userSatisfactionScore.average / 5) * 100;
  
  const overallScore = Math.round(
    (responseTimeScore + errorRateScore + throughputScore + userSatisfactionScore) / 4
  );

  const performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 
    overallScore >= 90 ? 'A' :
    overallScore >= 80 ? 'B' :
    overallScore >= 70 ? 'C' :
    overallScore >= 60 ? 'D' : 'F';

  const topIssues: string[] = [];
  if (apiPerf.responseTime.average > 500) topIssues.push('High API response times');
  if (apiPerf.errorRate.average > 3) topIssues.push('Elevated error rates');
  if (dbPerf.readLatency.average > 20) topIssues.push('Database read latency');
  if (systemPerf.lambdaDuration.average > 1000) topIssues.push('Lambda execution time');

  const improvements: string[] = [];
  if (apiPerf.responseTime.trend === 'down') improvements.push('Response times improving');
  if (apiPerf.errorRate.trend === 'down') improvements.push('Error rates decreasing');
  if (userExp.userSatisfactionScore.trend === 'up') improvements.push('User satisfaction increasing');

  const nextActions: string[] = [
    'Implement caching for frequently accessed data',
    'Optimize database query patterns',
    'Monitor and tune Lambda memory allocation',
    'Set up automated performance alerts',
  ];

  return {
    overallScore,
    performanceGrade,
    keyMetrics: {
      responseTime: Math.round(apiPerf.responseTime.average),
      throughput: Math.round(apiPerf.throughput.average),
      errorRate: Math.round(apiPerf.errorRate.average * 10) / 10,
      availability: 99.9, // Mock availability
    },
    topIssues,
    improvements,
    nextActions,
  };
} 