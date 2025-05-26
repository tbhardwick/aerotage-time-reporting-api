import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface RealTimeAnalyticsRequest {
  metrics: string[];
  includeActivities?: boolean;
  includeSessions?: boolean;
  includeAlerts?: boolean;
  refreshInterval?: number; // seconds
}

interface RealTimeAnalyticsResponse {
  timestamp: string;
  metrics: RealTimeMetrics;
  activities?: ActivityFeed[];
  sessions?: ActiveSession[];
  alerts?: RealTimeAlert[];
  nextRefresh: string;
  refreshInterval: number;
}

interface RealTimeMetrics {
  activeUsers: number;
  currentSessions: number;
  todayHours: number;
  todayRevenue: number;
  liveTimers: number;
  recentEntries: number;
  systemLoad: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
}

interface ActivityFeed {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  details: any;
  type: 'timer' | 'entry' | 'project' | 'client' | 'system';
  priority: 'low' | 'medium' | 'high';
}

interface ActiveSession {
  sessionId: string;
  userId: string;
  userName: string;
  startTime: string;
  lastActivity: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  activeTimers: number;
  todayHours: number;
  status: 'active' | 'idle' | 'away';
}

interface RealTimeAlert {
  id: string;
  type: 'performance' | 'security' | 'business' | 'system';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  autoResolve: boolean;
  metadata: any;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Real-time analytics request:', JSON.stringify(event, null, 2));

    // Extract user info from authorizer context
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse request
    let analyticsRequest: RealTimeAnalyticsRequest;
    if (event.body) {
      try {
        analyticsRequest = JSON.parse(event.body);
      } catch (error) {
        return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
      }
    } else {
      // Default configuration
      analyticsRequest = {
        metrics: ['activeUsers', 'currentSessions', 'todayHours', 'todayRevenue', 'liveTimers'],
        includeActivities: true,
        includeSessions: true,
        includeAlerts: true,
        refreshInterval: 30,
      };
    }

    // Apply query parameters
    const queryParams = event.queryStringParameters || {};
    if (queryParams.refreshInterval) {
      analyticsRequest.refreshInterval = parseInt(queryParams.refreshInterval);
    }
    if (queryParams.includeActivities === 'false') {
      analyticsRequest.includeActivities = false;
    }
    if (queryParams.includeSessions === 'false') {
      analyticsRequest.includeSessions = false;
    }
    if (queryParams.includeAlerts === 'false') {
      analyticsRequest.includeAlerts = false;
    }

    // Generate real-time analytics
    const analyticsData = await generateRealTimeAnalytics(analyticsRequest, userId, userRole);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      body: JSON.stringify({
        success: true,
        data: analyticsData,
      }),
    };

  } catch (error) {
    console.error('Error generating real-time analytics:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'REAL_TIME_ANALYTICS_FAILED',
          message: 'Failed to generate real-time analytics',
        },
      }),
    };
  }
};

async function generateRealTimeAnalytics(
  request: RealTimeAnalyticsRequest,
  userId: string,
  userRole: string
): Promise<RealTimeAnalyticsResponse> {
  const timestamp = new Date().toISOString();
  const refreshInterval = request.refreshInterval || 30;
  
  // Generate real-time metrics
  const metrics = await generateRealTimeMetrics(request.metrics, userId, userRole);
  
  // Generate activity feed if requested
  let activities: ActivityFeed[] | undefined;
  if (request.includeActivities) {
    activities = await generateActivityFeed(userId, userRole);
  }
  
  // Generate active sessions if requested
  let sessions: ActiveSession[] | undefined;
  if (request.includeSessions) {
    sessions = await generateActiveSessions(userId, userRole);
  }
  
  // Generate real-time alerts if requested
  let alerts: RealTimeAlert[] | undefined;
  if (request.includeAlerts) {
    alerts = await generateRealTimeAlerts(userId, userRole);
  }

  return {
    timestamp,
    metrics,
    activities,
    sessions,
    alerts,
    nextRefresh: new Date(Date.now() + (refreshInterval * 1000)).toISOString(),
    refreshInterval,
  };
}

async function generateRealTimeMetrics(
  requestedMetrics: string[],
  userId: string,
  userRole: string
): Promise<RealTimeMetrics> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Fetch current data
  const [timeEntries, sessions, analyticsEvents] = await Promise.all([
    fetchTodayTimeEntries(todayStart, userId, userRole),
    fetchActiveSessions(userId, userRole),
    fetchRecentAnalyticsEvents(userId, userRole),
  ]);

  // Calculate metrics
  const activeUsers = await calculateActiveUsers(sessions);
  const currentSessions = sessions.length;
  const todayHours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const todayRevenue = timeEntries
    .filter(entry => entry.billable)
    .reduce((sum, entry) => sum + ((entry.hours || 0) * (entry.hourlyRate || 0)), 0);
  const liveTimers = await calculateLiveTimers(userId, userRole);
  const recentEntries = timeEntries.filter(entry => {
    const entryTime = new Date(entry.createdAt || entry.startDate);
    return (now.getTime() - entryTime.getTime()) < (60 * 60 * 1000); // Last hour
  }).length;

  // System metrics
  const systemLoad = await calculateSystemLoad();
  const responseTime = await calculateAverageResponseTime();
  const errorRate = await calculateErrorRate();
  const throughput = await calculateThroughput();

  return {
    activeUsers,
    currentSessions,
    todayHours: Math.round(todayHours * 10) / 10,
    todayRevenue: Math.round(todayRevenue),
    liveTimers,
    recentEntries,
    systemLoad,
    responseTime,
    errorRate,
    throughput,
  };
}

async function generateActivityFeed(userId: string, userRole: string): Promise<ActivityFeed[]> {
  try {
    const analyticsTable = process.env.ANALYTICS_EVENTS_TABLE_NAME;
    if (!analyticsTable) return [];

    const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000)).toISOString();
    
    let queryParams: any = {
      TableName: analyticsTable,
      IndexName: 'EventTypeTimestampIndex',
      KeyConditionExpression: '#eventType = :eventType AND #timestamp > :timestamp',
      ExpressionAttributeNames: {
        '#eventType': 'eventType',
        '#timestamp': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':eventType': 'activity',
        ':timestamp': oneHourAgo,
      },
      ScanIndexForward: false, // Most recent first
      Limit: 50,
    };

    // Apply role-based filtering
    if (userRole === 'employee') {
      queryParams.FilterExpression = '#userId = :userId';
      queryParams.ExpressionAttributeNames['#userId'] = 'userId';
      queryParams.ExpressionAttributeValues[':userId'] = userId;
    }

    const command = new QueryCommand(queryParams);
    const result = await docClient.send(command);
    
    return (result.Items || []).map(item => ({
      id: item.eventId,
      userId: item.userId,
      userName: item.metadata?.userName || 'Unknown User',
      action: item.metadata?.action || 'Unknown Action',
      timestamp: item.timestamp,
      details: item.metadata?.details || {},
      type: item.metadata?.type || 'system',
      priority: item.metadata?.priority || 'low',
    }));

  } catch (error) {
    console.error('Error generating activity feed:', error);
    return [];
  }
}

async function generateActiveSessions(userId: string, userRole: string): Promise<ActiveSession[]> {
  try {
    const sessionsTable = process.env.USER_SESSIONS_TABLE_NAME;
    if (!sessionsTable) return [];

    const fifteenMinutesAgo = new Date(Date.now() - (15 * 60 * 1000)).toISOString();
    
    let scanParams: any = {
      TableName: sessionsTable,
      FilterExpression: '#lastActivity > :lastActivity AND #status = :status',
      ExpressionAttributeNames: {
        '#lastActivity': 'lastActivity',
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':lastActivity': fifteenMinutesAgo,
        ':status': 'active',
      },
    };

    // Apply role-based filtering
    if (userRole === 'employee') {
      scanParams.FilterExpression += ' AND #userId = :userId';
      scanParams.ExpressionAttributeNames['#userId'] = 'userId';
      scanParams.ExpressionAttributeValues[':userId'] = userId;
    }

    const command = new ScanCommand(scanParams);
    const result = await docClient.send(command);
    
    return (result.Items || []).map(session => ({
      sessionId: session.sessionId,
      userId: session.userId,
      userName: session.metadata?.userName || 'Unknown User',
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      ipAddress: session.ipAddress || 'Unknown',
      userAgent: session.userAgent || 'Unknown',
      location: session.metadata?.location,
      activeTimers: session.metadata?.activeTimers || 0,
      todayHours: session.metadata?.todayHours || 0,
      status: determineSessionStatus(session.lastActivity),
    }));

  } catch (error) {
    console.error('Error generating active sessions:', error);
    return [];
  }
}

async function generateRealTimeAlerts(userId: string, userRole: string): Promise<RealTimeAlert[]> {
  const alerts: RealTimeAlert[] = [];
  const now = new Date();

  try {
    // Performance alerts
    const responseTime = await calculateAverageResponseTime();
    if (responseTime > 2000) { // 2 seconds
      alerts.push({
        id: `alert-${now.getTime()}-performance`,
        type: 'performance',
        severity: responseTime > 5000 ? 'critical' : 'warning',
        title: 'High Response Time',
        message: `Average response time is ${responseTime}ms`,
        timestamp: now.toISOString(),
        acknowledged: false,
        autoResolve: true,
        metadata: { responseTime },
      });
    }

    // Error rate alerts
    const errorRate = await calculateErrorRate();
    if (errorRate > 5) { // 5%
      alerts.push({
        id: `alert-${now.getTime()}-errors`,
        type: 'system',
        severity: errorRate > 10 ? 'critical' : 'warning',
        title: 'High Error Rate',
        message: `Error rate is ${errorRate}%`,
        timestamp: now.toISOString(),
        acknowledged: false,
        autoResolve: true,
        metadata: { errorRate },
      });
    }

    // Business alerts
    const liveTimers = await calculateLiveTimers(userId, userRole);
    if (liveTimers > 50) { // Many active timers
      alerts.push({
        id: `alert-${now.getTime()}-timers`,
        type: 'business',
        severity: 'info',
        title: 'High Timer Activity',
        message: `${liveTimers} active timers running`,
        timestamp: now.toISOString(),
        acknowledged: false,
        autoResolve: true,
        metadata: { liveTimers },
      });
    }

    // Security alerts - unusual activity
    const recentSessions = await fetchActiveSessions(userId, userRole);
    const uniqueIPs = new Set(recentSessions.map(s => s.ipAddress)).size;
    if (uniqueIPs > 20) { // Many different IPs
      alerts.push({
        id: `alert-${now.getTime()}-security`,
        type: 'security',
        severity: 'warning',
        title: 'Unusual Access Pattern',
        message: `${uniqueIPs} unique IP addresses active`,
        timestamp: now.toISOString(),
        acknowledged: false,
        autoResolve: false,
        metadata: { uniqueIPs },
      });
    }

  } catch (error) {
    console.error('Error generating real-time alerts:', error);
  }

  return alerts;
}

// Helper functions
async function fetchTodayTimeEntries(todayStart: Date, userId: string, userRole: string): Promise<any[]> {
  const timeEntriesTable = process.env.TIME_ENTRIES_TABLE_NAME;
  if (!timeEntriesTable) return [];

  try {
    let scanParams: any = {
      TableName: timeEntriesTable,
      FilterExpression: '#startDate >= :todayStart',
      ExpressionAttributeNames: {
        '#startDate': 'startDate',
      },
      ExpressionAttributeValues: {
        ':todayStart': todayStart.toISOString(),
      },
    };

    // Apply role-based filtering
    if (userRole === 'employee') {
      scanParams.FilterExpression += ' AND #userId = :userId';
      scanParams.ExpressionAttributeNames['#userId'] = 'userId';
      scanParams.ExpressionAttributeValues[':userId'] = userId;
    }

    const command = new ScanCommand(scanParams);
    const result = await docClient.send(command);
    
    return result.Items || [];
  } catch (error) {
    console.error('Error fetching today time entries:', error);
    return [];
  }
}

async function fetchActiveSessions(userId: string, userRole: string): Promise<any[]> {
  const sessionsTable = process.env.USER_SESSIONS_TABLE_NAME;
  if (!sessionsTable) return [];

  try {
    const fifteenMinutesAgo = new Date(Date.now() - (15 * 60 * 1000)).toISOString();
    
    let scanParams: any = {
      TableName: sessionsTable,
      FilterExpression: '#lastActivity > :lastActivity',
      ExpressionAttributeNames: {
        '#lastActivity': 'lastActivity',
      },
      ExpressionAttributeValues: {
        ':lastActivity': fifteenMinutesAgo,
      },
    };

    // Apply role-based filtering
    if (userRole === 'employee') {
      scanParams.FilterExpression += ' AND #userId = :userId';
      scanParams.ExpressionAttributeNames['#userId'] = 'userId';
      scanParams.ExpressionAttributeValues[':userId'] = userId;
    }

    const command = new ScanCommand(scanParams);
    const result = await docClient.send(command);
    
    return result.Items || [];
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    return [];
  }
}

async function fetchRecentAnalyticsEvents(userId: string, userRole: string): Promise<any[]> {
  const analyticsTable = process.env.ANALYTICS_EVENTS_TABLE_NAME;
  if (!analyticsTable) return [];

  try {
    const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000)).toISOString();
    
    let scanParams: any = {
      TableName: analyticsTable,
      FilterExpression: '#timestamp > :timestamp',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':timestamp': oneHourAgo,
      },
    };

    // Apply role-based filtering
    if (userRole === 'employee') {
      scanParams.FilterExpression += ' AND #userId = :userId';
      scanParams.ExpressionAttributeNames['#userId'] = 'userId';
      scanParams.ExpressionAttributeValues[':userId'] = userId;
    }

    const command = new ScanCommand(scanParams);
    const result = await docClient.send(command);
    
    return result.Items || [];
  } catch (error) {
    console.error('Error fetching recent analytics events:', error);
    return [];
  }
}

async function calculateActiveUsers(sessions: any[]): Promise<number> {
  const uniqueUsers = new Set(sessions.map(session => session.userId));
  return uniqueUsers.size;
}

async function calculateLiveTimers(userId: string, userRole: string): Promise<number> {
  // Mock implementation - in production, query active timers from time entries
  // where status = 'running' or similar
  return Math.floor(Math.random() * 25) + 5; // 5-30 active timers
}

async function calculateSystemLoad(): Promise<number> {
  // Mock system load - in production, this would come from CloudWatch metrics
  return Math.round((Math.random() * 50 + 25) * 10) / 10; // 25-75%
}

async function calculateAverageResponseTime(): Promise<number> {
  // Mock response time - in production, this would come from CloudWatch metrics
  return Math.round(Math.random() * 1000 + 200); // 200-1200ms
}

async function calculateErrorRate(): Promise<number> {
  // Mock error rate - in production, this would come from CloudWatch metrics
  return Math.round((Math.random() * 5) * 10) / 10; // 0-5%
}

async function calculateThroughput(): Promise<number> {
  // Mock throughput - in production, this would come from CloudWatch metrics
  return Math.round(Math.random() * 100 + 50); // 50-150 requests/minute
}

function determineSessionStatus(lastActivity: string): 'active' | 'idle' | 'away' {
  const lastActivityTime = new Date(lastActivity).getTime();
  const now = Date.now();
  const minutesSinceActivity = (now - lastActivityTime) / (1000 * 60);

  if (minutesSinceActivity < 5) return 'active';
  if (minutesSinceActivity < 15) return 'idle';
  return 'away';
}

// Track real-time activity
export async function trackRealTimeActivity(
  userId: string,
  action: string,
  details: any,
  type: string = 'system',
  priority: string = 'low'
): Promise<void> {
  try {
    const analyticsTable = process.env.ANALYTICS_EVENTS_TABLE_NAME;
    if (!analyticsTable) return;

    const event = {
      eventId: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      eventType: 'activity',
      timestamp: new Date().toISOString(),
      metadata: {
        action,
        details,
        type,
        priority,
        realTime: true,
      },
    };

    const command = new PutCommand({
      TableName: analyticsTable,
      Item: event,
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Error tracking real-time activity:', error);
  }
} 