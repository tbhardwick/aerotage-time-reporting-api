import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { AnalyticsRepository, AnalyticsEvent } from '../shared/analytics-repository';

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

// MANDATORY: Use repository pattern instead of direct DynamoDB
const analyticsRepo = new AnalyticsRepository();

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

    // Check rate limiting using repository
    const rateLimitCheck = await analyticsRepo.checkRateLimit(currentUserId);
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
    await analyticsRepo.trackEvent(analyticsEvent);

    // Update rate limiting counter using repository
    await analyticsRepo.updateRateLimit(currentUserId);

    // Log for debugging
    console.log('Event tracked successfully:', analyticsEvent.eventId);

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse({
      eventId: analyticsEvent.eventId,
      timestamp: analyticsEvent.timestamp,
      message: 'Event tracked successfully',
    }, 201);

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
    console.log('Location lookup disabled for IP:', ipAddress);
    return undefined;
  } catch {
    console.error('Error getting location from IP');
    return undefined;
  }
} 