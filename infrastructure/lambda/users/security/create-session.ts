import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId } from '../../shared/auth-helper';
import { createErrorResponse } from '../../shared/response-helper';
import { SessionRepository } from '../../shared/session-repository';
import { v4 as uuidv4 } from 'uuid';
import { 
  UserSession, 
  SuccessResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

// PowerTools v2.x imports
import { logger, businessLogger, addRequestContext } from '../../shared/powertools-logger';
import { tracer, businessTracer } from '../../shared/powertools-tracer';
import { metrics, businessMetrics } from '../../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools v2.x middleware
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

interface SessionCreationRequest {
  userAgent?: string;
  loginTime?: string;
  ipAddress?: string;
}

const sessionRepo = new SessionRepository();

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Create session request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'create-session', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions', 'POST', 400, responseTime);
      businessLogger.logError(new Error('User ID is required'), 'create-session-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Authorization check: users can only create sessions for themselves with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-session-creation-access',
      'session',
      async () => {
        if (userId !== currentUserId) {
          return { canCreate: false, reason: 'not_own_session' };
        }
        return { canCreate: true };
      }
    );

    if (!accessControl.canCreate) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions', 'POST', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'create-session', false, { 
        requestedUserId: userId,
        reason: 'access_denied',
        accessReason: accessControl.reason
      });
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only create sessions for yourself'
      );
    }

    // Parse and validate request body with tracing
    const requestBody = await businessTracer.traceBusinessOperation(
      'parse-session-creation-request',
      'session',
      async () => {
        if (!event.body) {
          throw new Error('Request body is required');
        }
        return JSON.parse(event.body);
      }
    );

    const validation = await businessTracer.traceBusinessOperation(
      'validate-session-creation-request',
      'session',
      async () => {
        return validateSessionCreationRequest(requestBody);
      }
    );

    if (!validation.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/sessions', 'POST', 400, responseTime);
      businessLogger.logError(new Error(`Validation failed: ${validation.message}`), 'create-session-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validation.message);
    }

    // Extract client IP and session data with tracing
    const sessionMetadata = await businessTracer.traceBusinessOperation(
      'extract-session-metadata',
      'session',
      async () => {
        const ipAddress = getClientIP(event);
        const userAgent = requestBody.userAgent || 'Unknown';
        const loginTime = requestBody.loginTime || new Date().toISOString();
        
        // Validate loginTime is recent (within last 5 minutes)
        const loginTimestamp = new Date(loginTime);
        const now = new Date();
        const timeDiff = now.getTime() - loginTimestamp.getTime();
        const fiveMinutesInMs = 5 * 60 * 1000;
        
        if (timeDiff > fiveMinutesInMs || timeDiff < -fiveMinutesInMs) {
          throw new Error('Login time must be within the last 5 minutes');
        }

        return { ipAddress, userAgent, loginTime, loginTimestamp };
      }
    );

    logger.info('Session creation request parsed', { 
      currentUserId,
      requestedUserId: userId,
      ipAddress: sessionMetadata.ipAddress,
      userAgent: sessionMetadata.userAgent,
      isSelfAccess: userId === currentUserId
    });

    // Get current session token from Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '') || '';

    // Generate session identifiers
    const sessionId = uuidv4();
    const sessionIdentifier = sessionId; // Use session ID as the stable identifier
    const currentTime = new Date().toISOString();

    // Check user security settings and handle existing sessions with tracing
    const securitySettings = await businessTracer.traceDatabaseOperation(
      'get-user-security-settings',
      'user_sessions',
      async () => {
        return await sessionRepo.getUserSecuritySettings(userId);
      }
    );
    
    if (!securitySettings.allowMultipleSessions) {
      await businessTracer.traceDatabaseOperation(
        'terminate-existing-sessions',
        'user_sessions',
        async () => {
          return await sessionRepo.terminateUserSessions(userId, sessionToken);
        }
      );
    }

    // Calculate session expiry and get location data with tracing
    const sessionDetails = await businessTracer.traceBusinessOperation(
      'prepare-session-details',
      'session',
      async () => {
        const sessionTimeoutMs = securitySettings.sessionTimeout * 60 * 1000; // Convert minutes to milliseconds
        const expiresAt = new Date(sessionMetadata.loginTimestamp.getTime() + sessionTimeoutMs).toISOString();
        const location = await getLocationFromIP(sessionMetadata.ipAddress);
        
        return { expiresAt, location };
      }
    );

    // Create session record with tracing
    const sessionData = {
      PK: `SESSION#${sessionId}`,
      SK: `SESSION#${sessionId}`,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `SESSION#${currentTime}`,
      sessionId,
      userId,
      sessionToken,
      sessionIdentifier,
      ipAddress: sessionMetadata.ipAddress,
      userAgent: sessionMetadata.userAgent,
      loginTime: sessionMetadata.loginTime,
      lastActivity: currentTime,
      expiresAt: sessionDetails.expiresAt,
      isActive: true,
      locationData: sessionDetails.location ? JSON.stringify(sessionDetails.location) : undefined,
      createdAt: currentTime,
      updatedAt: currentTime,
      sessionTimeout: securitySettings.sessionTimeout,
    };

    await businessTracer.traceDatabaseOperation(
      'create-session',
      'user_sessions',
      async () => {
        return await sessionRepo.createSession(sessionData);
      }
    );

    // Prepare response data
    const responseData: UserSession = {
      id: sessionId,
      ipAddress: sessionMetadata.ipAddress,
      userAgent: sessionMetadata.userAgent,
      loginTime: sessionMetadata.loginTime,
      lastActivity: sessionMetadata.loginTime,
      isCurrent: true,
      location: sessionDetails.location,
    };

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/{id}/sessions', 'POST', 201, responseTime);
    businessLogger.logBusinessOperation('create', 'session', currentUserId, true, { 
      sessionId,
      userId,
      ipAddress: sessionMetadata.ipAddress,
      userAgent: sessionMetadata.userAgent,
      allowMultipleSessions: securitySettings.allowMultipleSessions,
      sessionTimeout: securitySettings.sessionTimeout
    });

    logger.info('Session created successfully', { 
      currentUserId,
      sessionId,
      userId,
      ipAddress: sessionMetadata.ipAddress,
      userAgent: sessionMetadata.userAgent,
      responseTime 
    });

    const response: SuccessResponse<UserSession> = {
      success: true,
      data: responseData,
    };

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/users/{id}/sessions', 'POST', 500, responseTime);
    businessLogger.logError(error as Error, 'create-session', getCurrentUserId(event) || 'unknown');

    logger.error('Error creating session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedUserId: event.pathParameters?.id,
      responseTime
    });

    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message.includes('Request body is required')) {
        return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required');
      }
      if (error.message.includes('Login time must be within the last 5 minutes')) {
        return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Login time must be within the last 5 minutes');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

function validateSessionCreationRequest(body: SessionCreationRequest): { isValid: boolean; message: string } {
  // userAgent is required
  if (!body.userAgent || typeof body.userAgent !== 'string') {
    return { isValid: false, message: 'userAgent is required and must be a string' };
  }

  // userAgent length check
  if (body.userAgent.length > 1000) {
    return { isValid: false, message: 'userAgent must be less than 1000 characters' };
  }

  // loginTime validation (if provided)
  if (body.loginTime) {
    if (typeof body.loginTime !== 'string') {
      return { isValid: false, message: 'loginTime must be an ISO datetime string' };
    }
    
    const loginTime = new Date(body.loginTime);
    if (isNaN(loginTime.getTime())) {
      return { isValid: false, message: 'loginTime must be a valid ISO datetime string' };
    }
  }

  // ipAddress validation (if provided)
  if (body.ipAddress) {
    if (typeof body.ipAddress !== 'string') {
      return { isValid: false, message: 'ipAddress must be a string' };
    }
    
    // Basic IP address format validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (!ipRegex.test(body.ipAddress)) {
      return { isValid: false, message: 'ipAddress must be a valid IPv4 or IPv6 address' };
    }
  }

  return { isValid: true, message: '' };
}

function getClientIP(event: APIGatewayProxyEvent): string {
  // Check various headers in order of preference
  const xForwardedFor = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
  const xRealIP = event.headers['x-real-ip'] || event.headers['X-Real-IP'];
  const cfConnectingIP = event.headers['cf-connecting-ip'] || event.headers['CF-Connecting-IP'];
  const sourceIP = event.requestContext.identity.sourceIp;
  
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first (original client)
    return xForwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  
  return xRealIP || cfConnectingIP || sourceIP || 'unknown';
}

async function getLocationFromIP(ipAddress: string): Promise<{ city: string; country: string } | undefined> {
  try {
    // Skip location lookup for local/private IP addresses
    if (ipAddress === 'unknown' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.') || ipAddress === '127.0.0.1') {
      return undefined;
    }

    // Use free IP geolocation API (ip-api.com)
    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,city,country`);
    const data = await response.json();
    
    if ((data as any).status === 'success' && (data as any).city && (data as any).country) {
      return {
        city: (data as any).city,
        country: (data as any).country
      };
    }
  } catch (error) {
    console.log('Failed to get location for IP:', ipAddress, error);
  }
  
  return undefined; // Location is optional
}

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 