import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { AnalyticsRepository, AnalyticsEvent } from '../shared/analytics-repository';

// ✅ NEW: Import PowerTools utilities with correct v2.x pattern
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// ✅ NEW: Import Middy middleware for PowerTools v2.x
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

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

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // ✅ NEW: Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);
    
    logger.info('Analytics track event request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // ✅ NEW: Track API request metrics
    businessMetrics.trackApiPerformance(
      '/analytics/track-event',
      'POST',
      0, // Will be updated later
      0  // Will be updated later
    );

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/analytics/track-event', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'analytics-track-event', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // ✅ NEW: Add user context to tracer and logger
    const user = getAuthenticatedUser(event);
    businessTracer.addUserContext(currentUserId, user?.role, user?.department);
    addRequestContext(requestId, currentUserId, user?.role);

    // Get sessionId from context if available (optional for analytics)
    const sessionId = event.requestContext.authorizer?.sessionId;

    // Parse request body
    let requestBody: TrackEventRequest;
    try {
      requestBody = JSON.parse(event.body || '{}');
      logger.info('Request body parsed successfully', { 
        userId: currentUserId, 
        eventType: requestBody.eventType 
      });
    } catch (parseError) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/analytics/track-event', 'POST', 400, responseTime);
      businessLogger.logError(parseError as Error, 'analytics-track-event-parse', currentUserId);
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // ✅ NEW: Trace validation logic
    const validationResult = await businessTracer.traceBusinessOperation(
      'validate-analytics-event',
      'analytics-event',
      async () => {
        const validationErrors: string[] = [];

        // Validate required fields
        if (!requestBody.eventType) {
          validationErrors.push('eventType is required');
        }

        // Validate event type
        if (requestBody.eventType && !VALID_EVENT_TYPES.includes(requestBody.eventType)) {
          validationErrors.push(`Invalid event type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`);
        }

        return validationErrors;
      }
    );

    if (validationResult.length > 0) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/analytics/track-event', 'POST', 400, responseTime);
      businessLogger.logBusinessOperation('track-event', 'analytics', currentUserId, false, { 
        validationErrors: validationResult 
      });
      
      return createErrorResponse(400, 'INVALID_EVENT_TYPE', validationResult.join(', '));
    }

    // ✅ NEW: Trace rate limiting check
    const rateLimitCheck = await businessTracer.traceDatabaseOperation(
      'check-rate-limit',
      'analytics-events',
      async () => {
        return await analyticsRepo.checkRateLimit(currentUserId);
      }
    );

    if (!rateLimitCheck.allowed) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/analytics/track-event', 'POST', 429, responseTime);
      businessLogger.logSecurity('rate_limit_exceeded', currentUserId, 'medium', { 
        eventType: requestBody.eventType 
      });
      
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

    logger.info('Validation and rate limit checks passed, tracking event', { 
      userId: currentUserId, 
      eventType: requestBody.eventType 
    });

    // ✅ NEW: Trace analytics event creation
    const analyticsEvent = await businessTracer.traceBusinessOperation(
      'create-analytics-event',
      'analytics-event',
      async () => {
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

        return analyticsEvent;
      }
    );

    // ✅ NEW: Trace database operations
    await businessTracer.traceDatabaseOperation(
      'track-event',
      'analytics-events',
      async () => {
        await analyticsRepo.trackEvent(analyticsEvent);
      }
    );

    await businessTracer.traceDatabaseOperation(
      'update-rate-limit',
      'analytics-events',
      async () => {
        await analyticsRepo.updateRateLimit(currentUserId);
      }
    );

    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Track successful metrics
    businessMetrics.trackApiPerformance('/analytics/track-event', 'POST', 201, responseTime);
    businessMetrics.trackBusinessKPI('AnalyticsEventTracked', 1, MetricUnit.Count);
    businessMetrics.trackBusinessKPI(`AnalyticsEvent_${requestBody.eventType}`, 1, MetricUnit.Count);
    businessLogger.logBusinessOperation('track-event', 'analytics', currentUserId, true, { 
      eventId: analyticsEvent.eventId,
      eventType: requestBody.eventType 
    });

    logger.info('Analytics event tracked successfully', { 
      userId: currentUserId, 
      eventId: analyticsEvent.eventId,
      eventType: requestBody.eventType,
      responseTime 
    });

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse({
      eventId: analyticsEvent.eventId,
      timestamp: analyticsEvent.timestamp,
      message: 'Event tracked successfully',
    }, 201);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const currentUserId = getCurrentUserId(event);
    
    // ✅ NEW: Track error metrics and logging
    businessMetrics.trackApiPerformance('/analytics/track-event', 'POST', 500, responseTime);
    businessLogger.logError(error as Error, 'analytics-track-event', currentUserId);

    logger.error('Error tracking analytics event', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: currentUserId,
      responseTime 
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'An internal server error occurred');
  }
};

function getClientIP(event: APIGatewayProxyEvent): string {
  const xForwardedFor = event.headers['X-Forwarded-For'];
  if (!xForwardedFor) {
    return event.requestContext.identity.sourceIp || 'unknown';
  }
  return xForwardedFor.split(',')[0]?.trim() || 'unknown';
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
    logger.debug('Location lookup disabled for IP', { ipAddress });
    return undefined;
  } catch {
    logger.error('Error getting location from IP', { ipAddress });
    return undefined;
  }
}

// ✅ FIXED: Export handler with correct PowerTools v2.x Middy middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }))
  .use(logMetrics(metrics)); 