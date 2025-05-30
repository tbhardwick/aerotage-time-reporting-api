import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId } from '../../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../../shared/response-helper';
import { SessionRepository } from '../../shared/session-repository';

const sessionRepo = new SessionRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Get current request's user agent and IP for session matching
    const currentUserAgent = event.headers['User-Agent'] || event.headers['user-agent'] || '';
    const currentIP = getClientIP(event);

    // Find and delete the current session using repository
    const currentSession = await sessionRepo.findCurrentSession(currentUserId, currentUserAgent, currentIP);
    let sessionId: string | undefined;

    if (currentSession) {
      await sessionRepo.deleteSession(currentSession.sessionId);
      sessionId = currentSession.sessionId;
    }

    // Also clean up any expired sessions for this user using repository
    await sessionRepo.cleanupExpiredSessions(currentUserId);

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse({ 
      message: 'Logout successful',
      sessionId 
    }, 200);

  } catch (error) {
    console.error('Logout error:', error);
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