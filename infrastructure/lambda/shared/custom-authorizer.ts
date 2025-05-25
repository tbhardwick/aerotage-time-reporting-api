import { 
  APIGatewayTokenAuthorizerEvent, 
  APIGatewayAuthorizerResult,
  PolicyDocument,
  Statement
} from 'aws-lambda';
import { AuthService } from './auth-service';

export const handler = async (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  console.log('Custom authorizer invoked:', JSON.stringify(event, null, 2));

  try {
    // Extract token from the authorization token
    const token = AuthService.extractBearerToken(event.authorizationToken);
    
    if (!token) {
      console.log('No valid Bearer token found');
      throw new Error('Unauthorized');
    }

    // Parse method ARN to extract HTTP method and resource path
    const { httpMethod, resourcePath } = parseMethodArn(event.methodArn);
    console.log(`Request: ${httpMethod} ${resourcePath}`);

    // Check if this is a session bootstrap request
    if (isSessionBootstrapRequest(httpMethod, resourcePath)) {
      console.log('🚀 Detected session bootstrap request');
      
      // For session creation, validate JWT only (no session requirement)
      const jwtResult = await AuthService.validateJwtOnly(token);
      
      if (!jwtResult.isValid) {
        console.log('JWT validation failed for bootstrap:', jwtResult.errorMessage);
        throw new Error('Unauthorized');
      }

      const userId = jwtResult.userId!;
      
      // Check if user already has active sessions
      const hasActiveSessions = await AuthService.checkUserHasActiveSessions(userId);
      
      if (!hasActiveSessions) {
        console.log(`✅ Allowing session bootstrap for user: ${userId} (no active sessions)`);
        
        // Generate policy allowing session creation
        const policy = generatePolicy(userId, 'Allow', event.methodArn, jwtResult.userClaims, {
          bootstrap: 'true',
          reason: 'session_creation_for_user_without_sessions'
        });
        
        return policy;
      } else {
        console.log(`🔒 User ${userId} has active sessions, requiring normal validation for session creation`);
        // Fall through to normal validation
      }
    }

    // Normal validation: Require both valid JWT and active sessions
    console.log('🔒 Applying normal session validation');
    const authResult = await AuthService.validateAuthentication(token);
    
    if (!authResult.isValid) {
      console.log('Authentication validation failed:', authResult.errorMessage);
      throw new Error('Unauthorized');
    }

    const userId = authResult.userId!;
    const userClaims = authResult.userClaims;

    console.log(`✅ Authorization successful for user: ${userId}`);

    // Generate policy allowing access to all resources in this API
    const policy = generatePolicy(userId, 'Allow', event.methodArn, userClaims);
    
    return policy;

  } catch (error) {
    console.error('❌ Authorization failed:', error);
    // Return deny policy
    const denyPolicy = generatePolicy('unauthorized', 'Deny', event.methodArn);
    return denyPolicy;
  }
};

/**
 * Parse method ARN to extract HTTP method and resource path
 */
function parseMethodArn(methodArn: string): { httpMethod: string; resourcePath: string } {
  try {
    // Method ARN format: arn:aws:execute-api:region:account:api-id/stage/METHOD/resource-path
    const parts = methodArn.split('/');
    
    if (parts.length < 3) {
      return { httpMethod: 'UNKNOWN', resourcePath: 'UNKNOWN' };
    }

    const httpMethod = parts[2]; // e.g., "POST", "GET"
    const resourcePath = '/' + parts.slice(3).join('/'); // e.g., "/users/123/sessions"
    
    return { httpMethod, resourcePath };
  } catch (error) {
    console.error('Error parsing method ARN:', error);
    return { httpMethod: 'UNKNOWN', resourcePath: 'UNKNOWN' };
  }
}

/**
 * Check if this is a session bootstrap request
 */
function isSessionBootstrapRequest(httpMethod: string, resourcePath: string): boolean {
  // Allow POST requests to session creation endpoints
  if (httpMethod !== 'POST') {
    return false;
  }

  // Check for session creation patterns:
  // - /users/{userId}/sessions
  // - /users/*/sessions (wildcard matching)
  const sessionCreationPatterns = [
    /^\/users\/[^\/]+\/sessions\/?$/,  // /users/{userId}/sessions
    /^\/users\/\*\/sessions\/?$/       // /users/*/sessions (API Gateway pattern)
  ];

  for (const pattern of sessionCreationPatterns) {
    if (pattern.test(resourcePath)) {
      console.log(`✅ Session bootstrap pattern matched: ${resourcePath}`);
      return true;
    }
  }

  console.log(`❌ Not a session bootstrap request: ${httpMethod} ${resourcePath}`);
  return false;
}

/**
 * Generate IAM policy for API Gateway
 */
function generatePolicy(
  principalId: string, 
  effect: 'Allow' | 'Deny', 
  resource: string,
  context?: any,
  additionalContext?: any
): APIGatewayAuthorizerResult {
  
  const policyDocument: PolicyDocument = {
    Version: '2012-10-17',
    Statement: []
  };

  const statement: Statement = {
    Action: 'execute-api:Invoke',
    Effect: effect,
    Resource: resource
  };

  policyDocument.Statement.push(statement);

  const authResponse: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument
  };

  // Add user context if available (for Allow policies)
  if (effect === 'Allow' && context) {
    authResponse.context = {
      userId: context.sub,
      email: context.email,
      role: context['custom:role'] || 'employee',
      teamId: context['custom:teamId'] || '',
      department: context['custom:department'] || '',
      // Convert boolean and number values to strings (API Gateway requirement)
      authTime: String(context.auth_time || ''),
      iat: String(context.iat || ''),
      exp: String(context.exp || ''),
      // Add any additional context
      ...additionalContext
    };
  }

  return authResponse;
}

/**
 * Helper function to extract API Gateway base path for policy generation
 */
function getResourceForPolicy(methodArn: string): string {
  // Convert specific method ARN to allow all methods on this API
  // From: arn:aws:execute-api:region:account:api-id/stage/method/resource
  // To: arn:aws:execute-api:region:account:api-id/stage/*/*
  const arnParts = methodArn.split('/');
  if (arnParts.length >= 3) {
    return `${arnParts[0]}/${arnParts[1]}/*/*`;
  }
  return methodArn;
} 