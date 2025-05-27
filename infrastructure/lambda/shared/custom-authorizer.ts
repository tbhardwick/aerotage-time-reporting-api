import { 
  APIGatewayTokenAuthorizerEvent, 
  APIGatewayAuthorizerResult,
  PolicyDocument,
  Statement
} from 'aws-lambda';
import { AuthService } from './auth-service';

export const handler = async (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {

  try {
    // Extract token from the authorization token
    const token = AuthService.extractBearerToken(event.authorizationToken);
    
    if (!token) {
      throw new Error('Unauthorized - No valid Bearer token');
    }

    // Parse method ARN to extract HTTP method and resource path
    const { httpMethod, resourcePath } = parseMethodArn(event.methodArn);

    // Check if this is a session bootstrap request
    const isBootstrap = isSessionBootstrapRequest(httpMethod, resourcePath);
    
    if (isBootstrap) {
      
      // Step 3a: Check FORCE_BOOTSTRAP mode
      const forceBootstrap = process.env.FORCE_BOOTSTRAP;
      
      if (forceBootstrap === 'true') {
        
        const jwtResult = await AuthService.validateJwtOnly(token);
        
        if (!jwtResult.isValid) {
          throw new Error('Unauthorized - JWT validation failed');
        }

        const userId = jwtResult.userId!;

        const policy = generatePolicy(userId, 'Allow', getResourceForPolicy(event.methodArn), jwtResult.userClaims, {
          bootstrap: 'true',
          reason: 'force_bootstrap'
        });
        return policy;
      }
      
      // Step 3b: Normal bootstrap flow - JWT validation
      const jwtResult = await AuthService.validateJwtOnly(token);

      if (!jwtResult.isValid) {
        throw new Error('Unauthorized - JWT validation failed');
      }

      const userId = jwtResult.userId!;

      // Step 3c: Allow session creation regardless of existing sessions
      // Users should be able to create multiple sessions (e.g., different devices/browsers)
      const policy = generatePolicy(userId, 'Allow', getResourceForPolicy(event.methodArn), jwtResult.userClaims, {
        bootstrap: 'true',
        reason: 'session_creation_allowed'
      });
      return policy;
    } else {
    }

    // Normal validation: Require both valid JWT and active sessions
    const authResult = await AuthService.validateAuthentication(token);
    
    if (!authResult.isValid) {
      throw new Error('Unauthorized - Authentication validation failed');
    }

    const userId = authResult.userId!;
    const userClaims = authResult.userClaims;


    // Generate policy allowing access to all resources in this API
    const policy = generatePolicy(userId, 'Allow', getResourceForPolicy(event.methodArn), userClaims);
    
    return policy;

  } catch {
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
    
    if (parts.length < 4) {
      return { httpMethod: 'UNKNOWN', resourcePath: 'UNKNOWN' };
    }

    const httpMethod = parts[2] || 'UNKNOWN'; // e.g., "POST", "GET" 
    const resourcePath = `/${parts.slice(3).join('/')}`; // e.g., "/users/123/sessions"
    
    
    return { httpMethod, resourcePath };
  } catch {
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

  for (let i = 0; i < sessionCreationPatterns.length; i++) {
    const pattern = sessionCreationPatterns[i];
    const matches = pattern.test(resourcePath);
    
    if (matches) {
      return true;
    }
  }

  
  // Additional debugging: show what the path would need to look like
  
  return false;
}

/**
 * Generate IAM policy for API Gateway
 */
function generatePolicy(
  principalId: string, 
  effect: 'Allow' | 'Deny', 
  resource: string,
  context?: Record<string, unknown>,
  additionalContext?: Record<string, unknown>
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
      userId: String(context.sub || ''),
      email: String(context.email || ''),
      role: String(context['custom:role'] || 'employee'),
      teamId: String(context['custom:teamId'] || ''),
      department: String(context['custom:department'] || ''),
      // Convert boolean and number values to strings (API Gateway requirement)
      authTime: String(context.auth_time || ''),
      iat: String(context.iat || ''),
      exp: String(context.exp || ''),
      // Add any additional context (convert to strings)
      ...(additionalContext ? Object.fromEntries(
        Object.entries(additionalContext).map(([key, value]) => [key, String(value)])
      ) : {})
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