import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';

// Create a simple AnalyticsRepository to follow repository pattern
class AnalyticsRepository {
  private docClient: any;
  private analyticsTableName: string;

  constructor() {
    // Import DynamoDB modules here to avoid top-level imports
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
    
    const dynamoClient = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
    this.analyticsTableName = process.env.ANALYTICS_EVENTS_TABLE_NAME || 'aerotage-analytics-events-dev';
  }

  async trackEvent(analyticsEvent: AnalyticsEvent): Promise<void> {
    const command = new (require('@aws-sdk/lib-dynamodb').PutCommand)({
      TableName: this.analyticsTableName,
      Item: analyticsEvent,
    });

    await this.docClient.send(command);
  }
}

interface AnalyticsEvent {
  eventId: string;
  userId: string;
  eventType: string;
  timestamp: string;
  sessionId?: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country: string;
    region: string;
    city: string;
  };
  expiresAt: number; // TTL for auto-deletion (90 days)
}

interface TrackEventRequest {
  eventType: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

// Valid event types for validation
const VALID_EVENT_TYPES = [
  // User actions
  'user_login',
  'user_logout',
  'user_profile_update',
  'user_preferences_update',
  'user_action',
  
  // Time tracking
  'timer_start',
  'timer_stop',
  'timer_pause',
  'time_entry_create',
  'time_entry_update',
  'time_entry_delete',
  'time_entry_submit',
  'time_entry_approve',
  'time_entry_reject',
  
  // Project management
  'project_create',
  'project_update',
  'project_delete',
  'project_view',
  
  // Client management
  'client_create',
  'client_update',
  'client_delete',
  'client_view',
  
  // Reporting
  'report_generate',
  'report_export',
  'report_schedule',
  'dashboard_view',
  
  // System events
  'api_error',
  'performance_metric',
  'feature_usage',
];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    // Get sessionId from context if available (optional for analytics)
    const sessionId = event.requestContext.authorizer?.sessionId;

    // Parse request body
    let requestBody: TrackEventRequest;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate required fields
    if (!requestBody.eventType) {
      return createErrorResponse(400, 'MISSING_EVENT_TYPE', 'eventType is required');
    }

    // Validate event type
    if (!VALID_EVENT_TYPES.includes(requestBody.eventType)) {
      return createErrorResponse(400, 'INVALID_EVENT_TYPE', `Invalid event type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`);
    }

    // Check rate limiting (simple implementation)
    const rateLimitCheck = await checkRateLimit(currentUserId);
    if (!rateLimitCheck.allowed) {
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Retry-After': '60',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many events. Please try again later.',
            retryAfter: 60,
          },
        }),
      };
    }

    // Create analytics event with user context
    const analyticsEvent: AnalyticsEvent = {
      eventId: randomUUID(),
      userId: currentUserId,
      eventType: requestBody.eventType,
      timestamp: requestBody.timestamp || new Date().toISOString(),
      sessionId,
      metadata: {
        ...requestBody.metadata,
        userRole: user?.role || 'employee',
        userDepartment: user?.department,
      },
      ipAddress: getClientIP(event),
      userAgent: event.headers['User-Agent'] || event.headers['user-agent'],
      location: await getLocationFromIP(getClientIP(event)),
      expiresAt: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days TTL
    };

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const analyticsRepo = new AnalyticsRepository();
    await analyticsRepo.trackEvent(analyticsEvent);

    // Update rate limiting counter
    await updateRateLimit(currentUserId);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          eventId: analyticsEvent.eventId,
          timestamp: analyticsEvent.timestamp,
          message: 'Event tracked successfully',
        },
      }),
    };

  } catch (error) {
    console.error('Error tracking analytics event:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
  }
};

function getClientIP(event: APIGatewayProxyEvent): string {
  // Try to get real IP from various headers (CloudFront, ALB, etc.)
  const xForwardedFor = event.headers['X-Forwarded-For'] || event.headers['x-forwarded-for'];
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  const xRealIP = event.headers['X-Real-IP'] || event.headers['x-real-ip'];
  if (xRealIP) {
    return xRealIP;
  }
  
  return event.requestContext.identity?.sourceIp || 'unknown';
}

async function getLocationFromIP(_ipAddress: string): Promise<{ country: string; region: string; city: string } | undefined> {
  // In production, integrate with a geolocation service like MaxMind or ipapi.co
  // For now, return undefined to avoid external dependencies
  try {
    // Placeholder for geolocation logic
    // const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
    // const data = await response.json();
    // return {
    //   country: data.country_name,
    //   region: data.region,
    //   city: data.city,
    // };
    return undefined;
  } catch {
    console.error('Error getting location from IP');
    return undefined;
  }
}

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  // Simple rate limiting: 1000 events per hour per user
  // In production, use Redis or DynamoDB with TTL for more sophisticated rate limiting
  
  try {
    const rateLimitTable = process.env.RATE_LIMIT_TABLE_NAME;
    if (!rateLimitTable) {
      // If no rate limit table, allow all requests
      return { allowed: true, remaining: 999 };
    }

    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    const rateLimitKey = `${userId}-${currentHour}`;
    
    // For now, return allowed (implement proper rate limiting in production)
    return { allowed: true, remaining: 999 };
    
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // On error, allow the request
    return { allowed: true, remaining: 999 };
  }
}

async function updateRateLimit(userId: string): Promise<void> {
  // Update rate limiting counter
  // Implementation depends on the rate limiting strategy chosen
  try {
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    const _rateLimitKey = `${userId}-${currentHour}`;
    
    // Placeholder for rate limit update logic
    
  } catch {
    console.error('Error updating rate limit');
    // Don't throw - rate limit update failure shouldn't break event tracking
  }
} 