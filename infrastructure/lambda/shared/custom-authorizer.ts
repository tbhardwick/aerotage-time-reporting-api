import { 
  APIGatewayTokenAuthorizerEvent, 
  APIGatewayAuthorizerResult,
  PolicyDocument,
  Statement
} from 'aws-lambda';
import { AuthService } from './auth-service';

// PowerTools v2.x imports
import { logger, businessLogger, addRequestContext } from './powertools-logger';
import { tracer, businessTracer } from './powertools-tracer';
import { metrics, businessMetrics } from './powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools v2.x middleware
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const lambdaHandler = async (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  const startTime = Date.now();

  try {
    // Add request context to logger and tracer
    const requestId = `auth-${Date.now()}`;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, 'AUTHORIZER', event.methodArn);

    logger.info('Custom authorizer request started', {
      requestId,
      methodArn: event.methodArn,
      type: event.type,
    });

    // Extract token from the authorization token with tracing
    const token = await businessTracer.traceBusinessOperation(
      'extract-bearer-token',
      'auth',
      async () => {
        return AuthService.extractBearerToken(event.authorizationToken);
      }
    );
    
    if (!token) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/authorizer', 'AUTHORIZER', 401, responseTime);
      metrics.addMetric('AuthorizationFailure', MetricUnit.Count, 1);
      businessLogger.logAuth('unknown', 'authorize', false, { reason: 'no_bearer_token' });
      throw new Error('Unauthorized - No valid Bearer token');
    }

    // Parse method ARN to extract HTTP method and resource path with tracing
    const { httpMethod, resourcePath } = await businessTracer.traceBusinessOperation(
      'parse-method-arn',
      'auth',
      async () => {
        return parseMethodArn(event.methodArn);
      }
    );

    // Check if this is a session bootstrap request with tracing
    const isBootstrap = await businessTracer.traceBusinessOperation(
      'check-bootstrap-request',
      'auth',
      async () => {
        return isSessionBootstrapRequest(httpMethod, resourcePath);
      }
    );
    
    if (isBootstrap) {
      logger.info('Processing bootstrap request', { httpMethod, resourcePath });
      
      // Step 3a: Check FORCE_BOOTSTRAP mode
      const forceBootstrap = process.env.FORCE_BOOTSTRAP;
      
      if (forceBootstrap === 'true') {
        
        const jwtResult = await businessTracer.traceBusinessOperation(
          'validate-jwt-force-bootstrap',
          'auth',
          async () => {
            return await AuthService.validateJwtOnly(token);
          }
        );
        
        if (!jwtResult.isValid) {
          const responseTime = Date.now() - startTime;
          businessMetrics.trackApiPerformance('/authorizer', 'AUTHORIZER', 401, responseTime);
          metrics.addMetric('AuthorizationFailure', MetricUnit.Count, 1);
          businessLogger.logAuth(jwtResult.userId || 'unknown', 'authorize', false, { reason: 'jwt_validation_failed', mode: 'force_bootstrap' });
          throw new Error('Unauthorized - JWT validation failed');
        }

        const userId = jwtResult.userId!;
        const responseTime = Date.now() - startTime;

        businessMetrics.trackApiPerformance('/authorizer', 'AUTHORIZER', 200, responseTime);
        metrics.addMetric('AuthorizationSuccess', MetricUnit.Count, 1);
        businessLogger.logAuth(userId, 'authorize', true, { mode: 'force_bootstrap', httpMethod, resourcePath });

        const policy = generatePolicy(userId, 'Allow', getResourceForPolicy(event.methodArn), jwtResult.userClaims, {
          bootstrap: 'true',
          reason: 'force_bootstrap'
        });
        return policy;
      }
      
      // Step 3b: Normal bootstrap flow - JWT validation
      const jwtResult = await businessTracer.traceBusinessOperation(
        'validate-jwt-bootstrap',
        'auth',
        async () => {
          return await AuthService.validateJwtOnly(token);
        }
      );

      if (!jwtResult.isValid) {
        const responseTime = Date.now() - startTime;
        businessMetrics.trackApiPerformance('/authorizer', 'AUTHORIZER', 401, responseTime);
        metrics.addMetric('AuthorizationFailure', MetricUnit.Count, 1);
        businessLogger.logAuth(jwtResult.userId || 'unknown', 'authorize', false, { reason: 'jwt_validation_failed', mode: 'bootstrap' });
        throw new Error('Unauthorized - JWT validation failed');
      }

      const userId = jwtResult.userId!;
      const responseTime = Date.now() - startTime;

      // Step 3c: Allow session creation regardless of existing sessions
      // Users should be able to create multiple sessions (e.g., different devices/browsers)
      businessMetrics.trackApiPerformance('/authorizer', 'AUTHORIZER', 200, responseTime);
      metrics.addMetric('AuthorizationSuccess', MetricUnit.Count, 1);
      businessLogger.logAuth(userId, 'authorize', true, { mode: 'bootstrap', httpMethod, resourcePath });

      const policy = generatePolicy(userId, 'Allow', getResourceForPolicy(event.methodArn), jwtResult.userClaims, {
        bootstrap: 'true',
        reason: 'session_creation_allowed'
      });
      return policy;
    } else {
      logger.info('Processing normal authentication request', { httpMethod, resourcePath });
    }

    // Normal validation: Require both valid JWT and active sessions with tracing
    const authResult = await businessTracer.traceBusinessOperation(
      'validate-full-authentication',
      'auth',
      async () => {
        return await AuthService.validateAuthentication(token);
      }
    );
    
    if (!authResult.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/authorizer', 'AUTHORIZER', 401, responseTime);
      metrics.addMetric('AuthorizationFailure', MetricUnit.Count, 1);
      businessLogger.logAuth(authResult.userId || 'unknown', 'authorize', false, { reason: 'authentication_validation_failed', httpMethod, resourcePath });
      throw new Error('Unauthorized - Authentication validation failed');
    }

    const userId = authResult.userId!;
    const userClaims = authResult.userClaims;
    const responseTime = Date.now() - startTime;

    // Generate policy allowing access to all resources in this API
    const policy = generatePolicy(userId, 'Allow', getResourceForPolicy(event.methodArn), userClaims);
    
    businessMetrics.trackApiPerformance('/authorizer', 'AUTHORIZER', 200, responseTime);
    metrics.addMetric('AuthorizationSuccess', MetricUnit.Count, 1);
    businessLogger.logAuth(userId, 'authorize', true, { httpMethod, resourcePath, userRole: userClaims?.['custom:role'] || 'employee' });

    logger.info('Authorization successful', { 
      userId,
      httpMethod,
      resourcePath,
      userRole: userClaims?.['custom:role'] || 'employee',
      responseTime 
    });
    
    return policy;

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/authorizer', 'AUTHORIZER', 403, responseTime);
    metrics.addMetric('AuthorizationFailure', MetricUnit.Count, 1);
    businessLogger.logError(error as Error, 'custom-authorizer', 'unknown');

    logger.error('Authorization failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      methodArn: event.methodArn,
      responseTime
    });

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
    if (pattern) {
      const matches = pattern.test(resourcePath);
      
      if (matches) {
        return true;
      }
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
    console.log('JWT context received:', JSON.stringify(context, null, 2));
    
    // Determine role from custom attribute or Cognito groups
    let userRole = context['custom:role'] || 'employee';
    
    // Fallback to Cognito groups if custom:role is not available
    if (!context['custom:role'] && context['cognito:groups']) {
      const groups = Array.isArray(context['cognito:groups']) 
        ? context['cognito:groups'] 
        : [context['cognito:groups']];
      
      console.log('Found Cognito groups:', groups);
      
      if (groups.includes('admin')) {
        userRole = 'admin';
      } else if (groups.includes('manager')) {
        userRole = 'manager';
      } else if (groups.includes('employee')) {
        userRole = 'employee';
      }
    }
    
    console.log('Determined user role:', userRole);
    
    authResponse.context = {
      userId: String(context.sub || ''),
      email: String(context.email || ''),
      role: String(userRole),
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
    
    console.log('Generated auth context:', JSON.stringify(authResponse.context, null, 2));
    
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

function matchResourcePattern(pattern: RegExp | undefined, resourcePath: string): boolean {
  if (!pattern) {
    return false;
  }
  return pattern.test(resourcePath);
} 

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 