import { 
  APIGatewayTokenAuthorizerEvent, 
  APIGatewayAuthorizerResult,
  PolicyDocument,
  Statement
} from 'aws-lambda';
import { AuthService } from './auth-service';

export const handler = async (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  console.log('🔥 CUSTOM AUTHORIZER INVOKED ��');
  console.log('='.repeat(50));
  console.log('📋 AUTHORIZER DEBUG DETAILS:');
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   Type: ${event.type}`);
  console.log(`   AuthorizationToken: ${event.authorizationToken ? 'PRESENT' : 'MISSING'}`);
  console.log(`   MethodArn: ${event.methodArn}`);
  console.log(`   Environment Variables:`);
  console.log(`     STAGE: ${process.env.STAGE}`);
  console.log(`     USER_POOL_ID: ${process.env.USER_POOL_ID}`);
  console.log(`     USER_SESSIONS_TABLE: ${process.env.USER_SESSIONS_TABLE}`);
  console.log(`     FORCE_BOOTSTRAP: ${process.env.FORCE_BOOTSTRAP}`);
  console.log(`     AWS_REGION: ${process.env.AWS_REGION}`);
  console.log('📋 Full event object:', JSON.stringify(event, null, 2));

  try {
    // Extract token from the authorization token
    console.log('\n🔑 STEP 1: Token Extraction');
    console.log('-'.repeat(30));
    const token = AuthService.extractBearerToken(event.authorizationToken);
    
    if (!token) {
      console.log('❌ FAILED: No valid Bearer token found');
      console.log(`   Authorization header: ${event.authorizationToken}`);
      throw new Error('Unauthorized - No valid Bearer token');
    }

    console.log(`✅ SUCCESS: Token extracted (length: ${token.length})`);
    console.log(`   Token prefix: ${token.substring(0, 20)}...`);

    // Parse method ARN to extract HTTP method and resource path
    console.log('\n🔍 STEP 2: Method ARN Parsing');
    console.log('-'.repeat(30));
    const { httpMethod, resourcePath } = parseMethodArn(event.methodArn);
    console.log(`📋 Parsed Request Details:`);
    console.log(`   HTTP Method: ${httpMethod}`);
    console.log(`   Resource Path: ${resourcePath}`);
    console.log(`   Full Method ARN: ${event.methodArn}`);

    // Check if this is a session bootstrap request
    console.log('\n🔍 STEP 3: Bootstrap Detection');
    console.log('-'.repeat(30));
    const isBootstrap = isSessionBootstrapRequest(httpMethod, resourcePath);
    console.log(`🔍 Bootstrap Detection Result: ${isBootstrap ? 'YES - This is a bootstrap request' : 'NO - Not a bootstrap request'}`);
    
    if (isBootstrap) {
      console.log('\n🚀 BOOTSTRAP REQUEST DETECTED - ENTERING BOOTSTRAP FLOW 🚀');
      console.log('='.repeat(60));
      
      // Step 3a: Check FORCE_BOOTSTRAP mode
      console.log('\n🔧 STEP 3a: Force Bootstrap Check');
      console.log('-'.repeat(30));
      const forceBootstrap = process.env.FORCE_BOOTSTRAP;
      console.log(`   FORCE_BOOTSTRAP environment variable: "${forceBootstrap}"`);
      console.log(`   Type: ${typeof forceBootstrap}`);
      console.log(`   Equals 'true'?: ${forceBootstrap === 'true'}`);
      
      if (forceBootstrap === 'true') {
        console.log('⚠️ FORCE_BOOTSTRAP MODE ENABLED - BYPASSING ALL CHECKS!');
        console.log('🔍 Validating JWT token only (no session check)...');
        
        const jwtResult = await AuthService.validateJwtOnly(token);
        
        if (!jwtResult.isValid) {
          console.log('❌ JWT validation failed for force bootstrap:', jwtResult.errorMessage);
          throw new Error('Unauthorized - JWT validation failed');
        }

        const userId = jwtResult.userId!;
        console.log(`✅ JWT validation successful for user: ${userId}`);
        console.log('🎉 ALLOWING BOOTSTRAP (FORCE MODE)');

        const policy = generatePolicy(userId, 'Allow', getResourceForPolicy(event.methodArn), jwtResult.userClaims, {
          bootstrap: 'true',
          reason: 'force_bootstrap'
        });
        console.log('✅ Generated ALLOW policy for bootstrap (forced)');
        console.log('📋 Policy details:', JSON.stringify(policy, null, 2));
        return policy;
      }
      
      // Step 3b: Normal bootstrap flow - JWT validation
      console.log('\n🔍 STEP 3b: JWT-Only Validation for Bootstrap');
      console.log('-'.repeat(45));
      console.log('🔍 Validating JWT token only (no session check)...');
      const jwtResult = await AuthService.validateJwtOnly(token);

      if (!jwtResult.isValid) {
        console.log('❌ FAILED: JWT validation failed for bootstrap:', jwtResult.errorMessage);
        throw new Error('Unauthorized - JWT validation failed');
      }

      const userId = jwtResult.userId!;
      console.log(`✅ SUCCESS: JWT validation successful for user: ${userId}`);

      // Step 3c: Check for existing active sessions
      console.log('\n🔍 STEP 3c: Active Session Check for Bootstrap');
      console.log('-'.repeat(45));
      console.log('🔍 Checking if user has active sessions...');
      const hasActiveSessions = await AuthService.checkUserHasActiveSessions(userId);
      console.log(`📊 User has active sessions: ${hasActiveSessions ? 'YES' : 'NO'}`);

      if (!hasActiveSessions) {
        console.log(`🎉 ALLOWING SESSION BOOTSTRAP for user: ${userId} (no active sessions)`);
        const policy = generatePolicy(userId, 'Allow', getResourceForPolicy(event.methodArn), jwtResult.userClaims, {
          bootstrap: 'true',
          reason: 'session_creation_for_user_without_sessions'
        });
        console.log('✅ Generated ALLOW policy for bootstrap');
        console.log('📋 Policy details:', JSON.stringify(policy, null, 2));
        return policy;
      } else {
        console.log(`🔒 DENYING BOOTSTRAP: User ${userId} has active sessions`);
        console.log('❌ This should only happen if FORCE_BOOTSTRAP is false and user has sessions');
        throw new Error('User already has active sessions');
      }
    } else {
      console.log('\n📝 NON-BOOTSTRAP REQUEST - ENTERING NORMAL VALIDATION FLOW');
      console.log('='.repeat(65));
    }

    // Normal validation: Require both valid JWT and active sessions
    console.log('\n🔒 STEP 4: Normal Session Validation');
    console.log('-'.repeat(35));
    console.log('🔒 Applying normal session validation (JWT + active session required)');
    const authResult = await AuthService.validateAuthentication(token);
    
    if (!authResult.isValid) {
      console.log('❌ FAILED: Authentication validation failed:', authResult.errorMessage);
      throw new Error('Unauthorized - Authentication validation failed');
    }

    const userId = authResult.userId!;
    const userClaims = authResult.userClaims;

    console.log(`✅ SUCCESS: Authorization successful for user: ${userId}`);

    // Generate policy allowing access to all resources in this API
    const policy = generatePolicy(userId, 'Allow', getResourceForPolicy(event.methodArn), userClaims);
    console.log('✅ Generated ALLOW policy for normal request');
    console.log('📋 Policy details:', JSON.stringify(policy, null, 2));
    
    return policy;

  } catch (error) {
    console.error('\n❌ AUTHORIZATION FAILED');
    console.error('='.repeat(25));
    console.error('❌ Error details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'Unknown';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    console.error(`   Error message: ${errorMessage}`);
    console.error(`   Error name: ${errorName}`);
    console.error(`   Stack trace: ${errorStack}`);
    
    // Return deny policy
    const denyPolicy = generatePolicy('unauthorized', 'Deny', event.methodArn);
    console.log('🔒 Generated DENY policy');
    console.log('📋 Deny policy details:', JSON.stringify(denyPolicy, null, 2));
    return denyPolicy;
  }
};

/**
 * Parse method ARN to extract HTTP method and resource path
 */
function parseMethodArn(methodArn: string): { httpMethod: string; resourcePath: string } {
  try {
    console.log('🔍 PARSING METHOD ARN DETAILS:');
    console.log(`   Full ARN: ${methodArn}`);
    
    // Method ARN format: arn:aws:execute-api:region:account:api-id/stage/METHOD/resource-path
    const parts = methodArn.split('/');
    console.log('📋 ARN Split Parts:', parts);
    console.log(`   Total parts: ${parts.length}`);
    
    if (parts.length < 4) {
      console.log('❌ Invalid ARN format - not enough parts');
      console.log(`   Expected at least 4 parts, got ${parts.length}`);
      return { httpMethod: 'UNKNOWN', resourcePath: 'UNKNOWN' };
    }

    const httpMethod = parts[2] || 'UNKNOWN'; // e.g., "POST", "GET" 
    const resourcePath = '/' + parts.slice(3).join('/'); // e.g., "/users/123/sessions"
    
    console.log(`✅ Successfully parsed ARN:`);
    console.log(`   HTTP Method: ${httpMethod}`);
    console.log(`   Resource Path: ${resourcePath}`);
    console.log(`   Method part (index 2): ${parts[2]}`);
    console.log(`   Resource parts (3+): [${parts.slice(3).join(', ')}]`);
    
    return { httpMethod, resourcePath };
  } catch (error) {
    console.error('❌ Error parsing method ARN:', error);
    console.error(`   Original ARN: ${methodArn}`);
    return { httpMethod: 'UNKNOWN', resourcePath: 'UNKNOWN' };
  }
}

/**
 * Check if this is a session bootstrap request
 */
function isSessionBootstrapRequest(httpMethod: string, resourcePath: string): boolean {
  console.log('🔍 DETAILED BOOTSTRAP REQUEST ANALYSIS:');
  console.log(`   Input HTTP Method: "${httpMethod}"`);
  console.log(`   Input Resource Path: "${resourcePath}"`);
  console.log(`   HTTP Method type: ${typeof httpMethod}`);
  console.log(`   Resource Path type: ${typeof resourcePath}`);
  
  // Allow POST requests to session creation endpoints
  if (httpMethod !== 'POST') {
    console.log(`❌ Method check failed: Expected "POST", got "${httpMethod}"`);
    return false;
  }
  console.log('✅ Method check passed: HTTP method is POST');

  // Check for session creation patterns:
  // - /users/{userId}/sessions
  // - /users/*/sessions (wildcard matching)
  const sessionCreationPatterns = [
    /^\/users\/[^\/]+\/sessions\/?$/,  // /users/{userId}/sessions
    /^\/users\/\*\/sessions\/?$/       // /users/*/sessions (API Gateway pattern)
  ];

  console.log('🔍 Testing against bootstrap patterns:');
  for (let i = 0; i < sessionCreationPatterns.length; i++) {
    const pattern = sessionCreationPatterns[i];
    const matches = pattern.test(resourcePath);
    console.log(`   Pattern ${i + 1}: ${pattern.source}`);
    console.log(`     Test result: ${matches ? 'MATCH ✅' : 'NO MATCH ❌'}`);
    console.log(`     Pattern explanation: ${i === 0 ? 'Specific user ID pattern' : 'API Gateway wildcard pattern'}`);
    
    if (matches) {
      console.log(`🎉 BOOTSTRAP PATTERN MATCHED!`);
      console.log(`   Matched pattern: ${pattern.source}`);
      console.log(`   Resource path: ${resourcePath}`);
      return true;
    }
  }

  console.log('❌ NO BOOTSTRAP PATTERNS MATCHED');
  console.log('   This request will proceed through normal validation flow');
  
  // Additional debugging: show what the path would need to look like
  console.log('\n🔍 Expected bootstrap patterns:');
  console.log('   1. /users/{userId}/sessions');
  console.log('   2. /users/*/sessions');
  console.log(`   Actual path: ${resourcePath}`);
  
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
  
  console.log('\n🏗️ GENERATING IAM POLICY:');
  console.log(`   Principal ID: ${principalId}`);
  console.log(`   Effect: ${effect}`);
  console.log(`   Resource: ${resource}`);
  console.log(`   Has context: ${context ? 'YES' : 'NO'}`);
  console.log(`   Additional context: ${additionalContext ? JSON.stringify(additionalContext) : 'NO'}`);
  
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
    
    console.log(`   Generated context for user: ${context.sub}`);
    console.log(`   Context keys: [${Object.keys(authResponse.context || {}).join(', ')}]`);
  }

  console.log('✅ Policy generation complete');
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