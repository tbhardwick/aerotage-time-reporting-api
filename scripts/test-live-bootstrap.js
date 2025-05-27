#!/usr/bin/env node

const https = require('https');
const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const API_BASE_URL = 'https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev';
const TEST_USER_ID = '0408a498-40c1-7071-acc9-90665ef117c3';

// AWS Configuration
const AWS_CONFIG = {
  REGION: 'us-east-1',
  USER_SESSIONS_TABLE: 'aerotage-user-sessions-dev'
};

// Cognito Configuration (from your CDK stack)
const COGNITO_CONFIG = {
  USER_POOL_ID: 'us-east-1_EsdlgX9Qg',
  CLIENT_ID: '148r35u6uultp1rmfdu22i8amb',
  REGION: 'us-east-1'
};

// Test credentials - you can modify these or pass as environment variables
const TEST_CREDENTIALS = {
  username: process.env.TEST_USERNAME || 'bhardwick@aerotage.com', // Change this to your test username
  password: process.env.TEST_PASSWORD || 'Aerotage*2025' // Change this to your test password
};

// Initialize DynamoDB client for session cleanup
const dynamoClient = new DynamoDBClient({ region: AWS_CONFIG.REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Clean up existing sessions for the test user to enable bootstrap testing
 */
async function cleanupUserSessions(userId) {
  console.log(`\n🧹 CLEANING UP EXISTING SESSIONS FOR USER: ${userId}`);
  console.log('==================================================================');
  
  try {
    // Query for all sessions for this user
    const queryCommand = new QueryCommand({
      TableName: AWS_CONFIG.USER_SESSIONS_TABLE,
      IndexName: 'UserIndex', // GSI for userId lookup
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    console.log('🔍 Querying for existing sessions...');
    const result = await docClient.send(queryCommand);
    const sessions = result.Items || [];
    
    console.log(`📊 Found ${sessions.length} existing sessions`);
    
    if (sessions.length === 0) {
      console.log('✅ No existing sessions to clean up');
      return true;
    }

    // Mark all sessions as inactive
    let cleanedCount = 0;
    for (const session of sessions) {
      try {
        const updateCommand = new UpdateCommand({
          TableName: AWS_CONFIG.USER_SESSIONS_TABLE,
          Key: { sessionId: session.sessionId },
          UpdateExpression: 'SET isActive = :false, expiredAt = :now, updatedAt = :now',
          ExpressionAttributeValues: {
            ':false': false,
            ':now': new Date().toISOString()
          }
        });

        await docClient.send(updateCommand);
        console.log(`✅ Deactivated session: ${session.sessionId} (created: ${session.createdAt})`);
        cleanedCount++;
      } catch (sessionError) {
        console.error(`❌ Failed to deactivate session ${session.sessionId}:`, sessionError.message);
      }
    }

    console.log(`\n🎯 CLEANUP SUMMARY: Deactivated ${cleanedCount}/${sessions.length} sessions`);
    return cleanedCount > 0;

  } catch (error) {
    console.error('❌ Session cleanup failed:', error.message);
    console.log('⚠️ This might be due to AWS credentials or table access issues');
    console.log('🔍 You can skip cleanup and test with FORCE_BOOTSTRAP=true');
    return false;
  }
}

/**
 * Check current active sessions for debugging
 */
async function checkActiveSessions(userId) {
  console.log(`\n🔍 CHECKING ACTIVE SESSIONS FOR USER: ${userId}`);
  console.log('====================================================');
  
  try {
    const queryCommand = new QueryCommand({
      TableName: AWS_CONFIG.USER_SESSIONS_TABLE,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: 'isActive = :isActive AND expiresAt > :now',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':isActive': true,
        ':now': new Date().toISOString()
      }
    });

    const result = await docClient.send(queryCommand);
    const activeSessions = result.Items || [];
    
    console.log(`📊 Active sessions found: ${activeSessions.length}`);
    
    if (activeSessions.length > 0) {
      console.log('\n📋 ACTIVE SESSION DETAILS:');
      activeSessions.forEach((session, index) => {
        console.log(`  ${index + 1}. Session ID: ${session.sessionId}`);
        console.log(`     Created: ${session.createdAt}`);
        console.log(`     Last Activity: ${session.lastActivity}`);
        console.log(`     Expires: ${session.expiresAt}`);
        console.log(`     User Agent: ${session.userAgent}`);
        console.log('');
      });
    }
    
    return activeSessions.length;
    
  } catch (error) {
    console.error('❌ Failed to check active sessions:', error.message);
    return -1; // Unknown
  }
}

/**
 * Get a fresh JWT token from Cognito using username/password authentication
 */
async function getFreshJwtToken() {
  console.log('\n🔑 GETTING FRESH JWT TOKEN FROM COGNITO');
  console.log('========================================');
  
  const cognitoClient = new CognitoIdentityProviderClient({
    region: COGNITO_CONFIG.REGION
  });

  try {
    console.log(`🔍 Authenticating user: ${TEST_CREDENTIALS.username}`);
    
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CONFIG.CLIENT_ID,
      AuthParameters: {
        USERNAME: TEST_CREDENTIALS.username,
        PASSWORD: TEST_CREDENTIALS.password
      }
    });

    const response = await cognitoClient.send(command);
    
    if (response.AuthenticationResult && response.AuthenticationResult.IdToken) {
      const idToken = response.AuthenticationResult.IdToken;
      console.log('✅ Successfully obtained fresh JWT token');
      console.log(`🔑 Token preview: ${idToken.substring(0, 50)}...`);
      
      // Decode and show token details
      try {
        const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
        const expTime = new Date(payload.exp * 1000);
        const currentTime = new Date();
        const timeLeft = Math.round((expTime - currentTime) / (1000 * 60));
        
        console.log(`\n📋 TOKEN DETAILS:`);
        console.log(`   User ID (sub): ${payload.sub}`);
        console.log(`   Email: ${payload.email}`);
        console.log(`   Issued at: ${new Date(payload.iat * 1000).toISOString()}`);
        console.log(`   Expires at: ${expTime.toISOString()}`);
        console.log(`   Time remaining: ${timeLeft} minutes`);
        console.log(`   Token use: ${payload.token_use}`);
        console.log(`   Audience: ${payload.aud}`);
        
        // Verify user ID matches our test user
        if (payload.sub !== TEST_USER_ID) {
          console.log(`⚠️ WARNING: Token user ID (${payload.sub}) doesn't match TEST_USER_ID (${TEST_USER_ID})`);
          console.log('   This might cause authorization issues. Update TEST_USER_ID in the script.');
        }
        
      } catch (e) {
        console.log('⚠️ Could not decode token payload');
      }
      
      return idToken;
    } else {
      throw new Error('No IdToken received from Cognito');
    }
  } catch (error) {
    console.error('❌ Failed to get JWT token:', error.message);
    if (error.name === 'NotAuthorizedException') {
      console.error('🔍 Check your username and password in the script');
    } else if (error.name === 'UserNotConfirmedException') {
      console.error('🔍 User needs to confirm their account');
    } else if (error.name === 'PasswordResetRequiredException') {
      console.error('🔍 User needs to reset their password');
    }
    throw error;
  }
}

function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    // Fix URL construction to preserve the /dev stage path
    const fullUrl = API_BASE_URL + path;
    const url = new URL(fullUrl);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Enhanced-Bootstrap-Test/1.0',
        ...headers
      }
    };

    if (data && method !== 'GET') {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    console.log(`\n🔍 MAKING API REQUEST`);
    console.log(`   URL: ${method} ${url.href}`);
    console.log(`   Headers:`, JSON.stringify(options.headers, null, 4));
    if (data) {
      console.log(`   Body:`, JSON.stringify(data, null, 4));
    }
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const result = {
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: responseData
        };
        
        try {
          result.parsedBody = JSON.parse(responseData);
        } catch (e) {
          result.parsedBody = null;
        }
        
        console.log(`\n📨 API RESPONSE`);
        console.log(`   Status: ${result.statusCode} ${result.statusMessage}`);
        console.log(`   Headers:`, JSON.stringify(result.headers, null, 4));
        console.log(`   Body: ${responseData}`);
        
        resolve(result);
      });
    });
    
    req.on('error', (err) => {
      console.error('🌐 Network request failed:', err.message);
      reject(err);
    });
    
    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testBootstrapScenario(jwtToken, scenarioName, testData) {
  console.log(`\n🚀 TESTING SCENARIO: ${scenarioName}`);
  console.log('='.repeat(scenarioName.length + 21));
  
  try {
    const result = await makeRequest(
      `/users/${TEST_USER_ID}/sessions`,
      'POST',
      testData,
      {
        'Authorization': `Bearer ${jwtToken}`
      }
    );
    
    console.log(`\n📊 SCENARIO RESULT: ${result.statusCode} ${result.statusMessage}`);
    
    if (result.statusCode === 200 || result.statusCode === 201) {
      console.log('🎉 SUCCESS: Bootstrap worked!');
      if (result.parsedBody) {
        console.log('📦 Response data:', JSON.stringify(result.parsedBody, null, 2));
      }
      return { success: true, result };
    } else if (result.statusCode === 403) {
      console.log('❌ FAILED: 403 Forbidden - Bootstrap blocked');
      console.log('🔍 This indicates the authorizer is denying the request');
      return { success: false, result, reason: 'bootstrap_blocked' };
    } else if (result.statusCode === 401) {
      console.log('❌ FAILED: 401 Unauthorized - JWT issue');
      console.log('🔍 Token validation failed in authorizer');
      return { success: false, result, reason: 'jwt_invalid' };
    } else {
      console.log(`❌ FAILED: Unexpected status ${result.statusCode}`);
      return { success: false, result, reason: 'unexpected_status' };
    }
    
  } catch (error) {
    console.log('❌ FAILED: Network error -', error.message);
    return { success: false, error: error.message, reason: 'network_error' };
  }
}

async function runDiagnosticTests(jwtToken) {
  console.log('\n🔬 RUNNING COMPREHENSIVE DIAGNOSTIC TESTS');
  console.log('============================================');
  
  const testScenarios = [
    {
      name: 'Standard Bootstrap Request',
      data: {
        userAgent: 'Enhanced-Bootstrap-Test/1.0',
        loginTime: new Date().toISOString()
      }
    },
    {
      name: 'Bootstrap with All Fields',
      data: {
        userAgent: 'Enhanced-Bootstrap-Test/1.0-Full',
        loginTime: new Date().toISOString(),
        ipAddress: '192.168.1.100'
      }
    },
    {
      name: 'Bootstrap with Minimal Data',
      data: {
        userAgent: 'Enhanced-Bootstrap-Test/1.0-Minimal'
      }
    }
  ];
  
  const results = [];
  
  for (const scenario of testScenarios) {
    const result = await testBootstrapScenario(jwtToken, scenario.name, scenario.data);
    results.push({ scenario: scenario.name, ...result });
    
    // Wait a bit between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return results;
}

async function main() {
  console.log('🔬 ENHANCED BOOTSTRAP DEBUGGING SUITE');
  console.log('=====================================');
  console.log('🎯 This script will comprehensively test and debug the bootstrap authentication');
  console.log('📋 Including session cleanup, JWT validation, and detailed diagnostics\n');
  
  const startTime = new Date();
  let testResults = {
    sessionCleanup: false,
    jwtObtained: false,
    activeSessionsBefore: -1,
    activeSessionsAfter: -1,
    testResults: [],
    recommendations: []
  };
  
  try {
    // Step 1: Check active sessions before cleanup
    console.log('🔍 STEP 1: Pre-cleanup session analysis');
    testResults.activeSessionsBefore = await checkActiveSessions(TEST_USER_ID);
    
    // Step 2: Clean up existing sessions
    console.log('\n🔍 STEP 2: Session cleanup');
    testResults.sessionCleanup = await cleanupUserSessions(TEST_USER_ID);
    
    // Step 3: Verify sessions are cleaned
    console.log('\n🔍 STEP 3: Post-cleanup verification');
    testResults.activeSessionsAfter = await checkActiveSessions(TEST_USER_ID);
    
    // Step 4: Get fresh JWT token
    console.log('\n🔍 STEP 4: JWT token acquisition');
    const jwtToken = await getFreshJwtToken();
    testResults.jwtObtained = true;
    
    // Step 5: Run diagnostic tests
    console.log('\n🔍 STEP 5: Bootstrap diagnostic tests');
    testResults.testResults = await runDiagnosticTests(jwtToken);
    
    // Step 6: Analysis and recommendations
    console.log('\n📊 COMPREHENSIVE TEST ANALYSIS');
    console.log('================================');
    
    const successfulTests = testResults.testResults.filter(r => r.success);
    const failedTests = testResults.testResults.filter(r => !r.success);
    
    console.log(`✅ Successful tests: ${successfulTests.length}/${testResults.testResults.length}`);
    console.log(`❌ Failed tests: ${failedTests.length}/${testResults.testResults.length}`);
    console.log(`🧹 Session cleanup: ${testResults.sessionCleanup ? 'Success' : 'Failed/Skipped'}`);
    console.log(`📊 Active sessions before: ${testResults.activeSessionsBefore}`);
    console.log(`📊 Active sessions after: ${testResults.activeSessionsAfter}`);
    
    if (successfulTests.length > 0) {
      console.log('\n🎉 BOOTSTRAP IS WORKING! 🎉');
      console.log('=============================');
      console.log('The backend bootstrap mechanism is functioning correctly.');
      console.log('If you\'re still experiencing issues in the frontend:');
      console.log('');
      console.log('1. 🧹 Clear browser cache and local storage');
      console.log('2. 🔄 Restart your development server');
      console.log('3. 🔍 Check frontend session handling logic');
      console.log('4. 📱 Try in incognito/private browsing mode');
      
    } else {
      console.log('\n❌ BOOTSTRAP IS NOT WORKING');
      console.log('=============================');
      console.log('The backend bootstrap mechanism is failing.');
      
      // Analyze failure patterns
      const reasons = failedTests.map(t => t.reason);
      const uniqueReasons = [...new Set(reasons)];
      
      console.log('\n🔍 FAILURE ANALYSIS:');
      uniqueReasons.forEach(reason => {
        const count = reasons.filter(r => r === reason).length;
        console.log(`   - ${reason}: ${count} occurrence(s)`);
      });
      
      console.log('\n🛠️ DEBUGGING RECOMMENDATIONS:');
      
      if (reasons.includes('bootstrap_blocked')) {
        console.log('1. 🔍 Check CloudWatch logs for the custom authorizer:');
        console.log('   aws logs filter-log-events \\');
        console.log('     --log-group-name "/aws/lambda/aerotage-custom-authorizer-dev" \\');
        console.log(`     --start-time $(($(date +%s) - 1800))000`);
        console.log('');
        console.log('2. 🔧 Verify FORCE_BOOTSTRAP environment variable is set to "true"');
        console.log('3. 🔍 Check method ARN parsing in the authorizer');
        console.log('4. 🔍 Verify bootstrap detection regex patterns');
      }
      
      if (reasons.includes('jwt_invalid')) {
        console.log('1. 🔑 Check JWT validation in the authorizer');
        console.log('2. 🔍 Verify Cognito configuration matches');
        console.log('3. 🕒 Check token expiration');
      }
      
      if (reasons.includes('network_error')) {
        console.log('1. 🌐 Check API Gateway endpoint URL');
        console.log('2. 🔍 Verify API is deployed and accessible');
        console.log('3. 🔧 Check CORS configuration');
      }
    }
    
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    console.log(`\n⏱️ Total test duration: ${duration} seconds`);
    
  } catch (error) {
    console.error('\n💥 CRITICAL ERROR during testing:', error.message);
    console.log('\n🔧 TROUBLESHOOTING STEPS:');
    console.log('1. 📝 Verify AWS credentials are configured');
    console.log('2. 🔑 Check Cognito user credentials in script');
    console.log('3. 🔧 Verify table names and API endpoints');
    console.log('4. 📦 Install missing dependencies: npm install');
    
    if (error.message.includes('AWS SDK')) {
      console.log('\n📦 Install AWS SDK dependencies:');
      console.log('npm install @aws-sdk/client-cognito-identity-provider @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb');
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
} 