import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../../shared/response-helper';
import { SessionRepository } from '../../shared/session-repository';
import { 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

const sessionRepo = new SessionRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Extract user ID and session ID from path parameters
    const userId = event.pathParameters?.id;
    const sessionId = event.pathParameters?.sessionId;
    
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }
    
    if (!sessionId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 'Session ID is required');
    }

    // Authorization check: users can only terminate their own sessions
    if (userId !== currentUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only terminate your own sessions'
      );
    }

    // Get current request's user agent and IP for session matching
    const currentUserAgent = event.headers['User-Agent'] || event.headers['user-agent'] || '';
    const currentIP = getClientIP(event);

    // Get the session to verify it exists and belongs to the user using repository
    const session = await sessionRepo.getSessionById(sessionId);

    if (!session) {
      return createErrorResponse(404, ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 'Session not found');
    }

    // Verify the session belongs to the authenticated user
    if (session.userId !== currentUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only terminate your own sessions'
      );
    }

    // Check if session is already inactive
    if (!session.isActive) {
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 
        'Session is already inactive'
      );
    }

    // Check if session has expired
    if (new Date(session.expiresAt) <= new Date()) {
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 
        'Session has already expired'
      );
    }

    // Get the current session ID using repository
    const currentSessionId = await sessionRepo.getCurrentSessionId(userId, currentUserAgent, currentIP);

    // Check if the session being terminated is the current session
    const isCurrentSession = sessionId === currentSessionId;

    if (isCurrentSession) {
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.CANNOT_TERMINATE_CURRENT_SESSION, 
        'You cannot terminate your current session'
      );
    }

    // Actually delete the session using repository
    await sessionRepo.deleteSession(sessionId);

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse({ 
      message: 'Session terminated successfully'
    }, 200);

  } catch (error) {
    console.error('Terminate session error:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

function getClientIP(event: APIGatewayProxyEvent): string {
  // Check various headers in order of preference
  const xForwardedFor = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
  const xRealIP = event.headers['x-real-ip'] || event.headers['X-Real-IP'];
  const cfConnectingIP = event.headers['cf-connecting-ip'] || event.headers['CF-Connecting-IP'];
  const sourceIP = event.requestContext.identity.sourceIp;
  
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first (original client)
    return xForwardedFor.split(',')[0].trim();
  }
  
  return xRealIP || cfConnectingIP || sourceIP || 'unknown';
} 