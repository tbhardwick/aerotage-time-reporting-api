import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { getCurrentUserId } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

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
    console.log('Track analytics event request:', JSON.stringify(event, null, 2));

    // Extract user info from authorizer context
    const userId = getCurrentUserId(event);
    const sessionId = event.requestContext.authorizer?.sessionId;
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse request body
    let requestBody: TrackEventRequest;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (error) {
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
    const rateLimitCheck = await checkRateLimit(userId);
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

    // Create analytics event
    const analyticsEvent: AnalyticsEvent = {
      eventId: randomUUID(),
      userId,
      eventType: requestBody.eventType,
      timestamp: requestBody.timestamp || new Date().toISOString(),
      sessionId,
      metadata: requestBody.metadata || {},
      ipAddress: getClientIP(event),
      userAgent: event.headers['User-Agent'] || event.headers['user-agent'],
      location: await getLocationFromIP(getClientIP(event)),
      expiresAt: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days TTL
    };

    // Store the event
    await storeAnalyticsEvent(analyticsEvent);

    // Update rate limiting counter
    await updateRateLimit(userId);

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
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to track analytics event');
  }
};

async function storeAnalyticsEvent(analyticsEvent: AnalyticsEvent): Promise<void> {
  const analyticsTable = process.env.ANALYTICS_EVENTS_TABLE_NAME;
  
  if (!analyticsTable) {
    throw new Error('ANALYTICS_EVENTS_TABLE_NAME environment variable not set');
  }

  const command = new PutCommand({
    TableName: analyticsTable,
    Item: analyticsEvent,
  });

  await docClient.send(command);
  console.log('Analytics event stored:', analyticsEvent.eventId);
}

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

async function getLocationFromIP(ipAddress: string): Promise<{ country: string; region: string; city: string } | undefined> {
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
  } catch (error) {
    console.error('Error getting location from IP:', error);
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
    const rateLimitKey = `${userId}-${currentHour}`;
    
    // Placeholder for rate limit update logic
    console.log('Rate limit updated for:', rateLimitKey);
    
  } catch (error) {
    console.error('Error updating rate limit:', error);
    // Don't throw - rate limit update failure shouldn't break event tracking
  }
} 