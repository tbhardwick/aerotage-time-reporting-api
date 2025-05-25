import { APIGatewayProxyEvent } from 'aws-lambda';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  teamId?: string;
  department?: string;
}

/**
 * Extract authenticated user information from custom authorizer context
 */
export function getAuthenticatedUser(event: APIGatewayProxyEvent): AuthenticatedUser | null {
  try {
    // With custom authorizer, user info is in event.requestContext.authorizer
    const authorizerContext = event.requestContext.authorizer;
    
    if (!authorizerContext) {
      console.log('No authorizer context found');
      return null;
    }

    // Extract user information from custom authorizer context
    const userId = authorizerContext.userId;
    const email = authorizerContext.email;
    const role = authorizerContext.role || 'employee';
    const teamId = authorizerContext.teamId || undefined;
    const department = authorizerContext.department || undefined;

    if (!userId) {
      console.log('No userId found in authorizer context');
      return null;
    }

    return {
      userId,
      email: email || '',
      role,
      teamId,
      department
    };

  } catch (error) {
    console.error('Error extracting authenticated user:', error);
    return null;
  }
}

/**
 * Get user ID from the event context (backwards compatibility)
 */
export function getCurrentUserId(event: APIGatewayProxyEvent): string | null {
  const user = getAuthenticatedUser(event);
  return user?.userId || null;
}

/**
 * Check if the authenticated user has admin role
 */
export function isAdmin(event: APIGatewayProxyEvent): boolean {
  const user = getAuthenticatedUser(event);
  return user?.role === 'admin';
}

/**
 * Check if the authenticated user has manager role or higher
 */
export function isManagerOrAdmin(event: APIGatewayProxyEvent): boolean {
  const user = getAuthenticatedUser(event);
  return user?.role === 'admin' || user?.role === 'manager';
} 