#!/usr/bin/env node

/**
 * Comprehensive Session Identification Test
 * 
 * This script performs extensive testing to determine if the backend
 * session identification is working correctly.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const jwt = require('jsonwebtoken');
const https = require('https');

// AWS Configuration
const AWS_CONFIG = {
  region: 'us-east-1',
  USER_SESSIONS_TABLE: 'aerotage-user-sessions-dev',
  API_BASE_URL: 'https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev'
};

// Cognito Configuration
const COGNITO_CONFIG = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_EsdlgX9Qg',
  clientId: '148r35u6uultp1rmfdu22i8amb'
};

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: AWS_CONFIG.region });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Test Configuration
 */
const TEST_CONFIG = {
  // Test endpoints
  endpoints: {
    sessions: (userId) => `${AWS_CONFIG.API_BASE_URL}/users/${userId}/sessions`
  }
};

/**
 * Make HTTP request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Decode JWT token and extract session information
 */
function analyzeJWT(token) {
  try {
    const decoded = jwt.decode(token);
    const sessionIdentifier = decoded.jti || `${decoded.sub}_${decoded.iat}`;
    
    return {
      valid: true,
      claims: decoded,
      sessionIdentifier,
      userId: decoded.sub,
      issuedAt: new Date(decoded.iat * 1000).toISOString(),
      expiresAt: new Date(decoded.exp * 1000).toISOString()
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Query DynamoDB directly for session data
 */
async function querySessionsFromDB(userId) {
  try {
    console.log(`\n🔍 QUERYING DYNAMODB DIRECTLY FOR USER: ${userId}`);
    console.log('='.repeat(60));

    const command = new QueryCommand({
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

    const result = await docClient.send(command);
    const sessions = result.Items || [];

    console.log(`📊 Found ${sessions.length} active sessions in database`);

    sessions.forEach((session, index) => {
      console.log(`\n📋 Session ${index + 1}:`);
      console.log(`   Session ID: ${session.sessionId}`);
      console.log(`   User ID: ${session.userId}`);
      console.log(`   Session Identifier: ${session.sessionIdentifier || 'MISSING'}`);
      console.log(`   Created: ${session.createdAt}`);
      console.log(`   Last Activity: ${session.lastActivity}`);
      console.log(`   Expires: ${session.expiresAt}`);
      console.log(`   Is Active: ${session.isActive}`);
      console.log(`   User Agent: ${session.userAgent}`);
      
      if (session.sessionToken) {
        const tokenAnalysis = analyzeJWT(session.sessionToken);
        console.log(`   Token Session ID: ${tokenAnalysis.sessionIdentifier}`);
        console.log(`   Token Valid: ${tokenAnalysis.valid}`);
      }
    });

    return sessions;
  } catch (error) {
    console.error('❌ Database query failed:', error.message);
    return [];
  }
}

/**
 * Test Cognito authentication and get JWT token
 */
async function testLogin(email, password) {
  try {
    console.log(`\n🔐 TESTING COGNITO AUTHENTICATION FOR: ${email}`);
    console.log('='.repeat(60));

    const client = new CognitoIdentityProviderClient({ 
      region: COGNITO_CONFIG.region 
    });
    
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CONFIG.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    });

    const response = await client.send(command);

    if (response.AuthenticationResult && response.AuthenticationResult.IdToken) {
      const accessToken = response.AuthenticationResult.IdToken;
      const tokenAnalysis = analyzeJWT(accessToken);

      console.log(`✅ Cognito authentication successful`);
      console.log(`👤 User ID: ${tokenAnalysis.userId}`);
      console.log(`📧 Email: ${tokenAnalysis.claims.email}`);
      console.log(`🎫 Token Session ID: ${tokenAnalysis.sessionIdentifier}`);
      console.log(`⏰ Token Issued: ${tokenAnalysis.issuedAt}`);
      console.log(`⏰ Token Expires: ${tokenAnalysis.expiresAt}`);

      return {
        success: true,
        accessToken,
        userId: tokenAnalysis.userId,
        sessionIdentifier: tokenAnalysis.sessionIdentifier,
        tokenAnalysis
      };
    } else {
      console.log(`❌ No token in Cognito response`);
      return { success: false, error: 'No token in response' };
    }
  } catch (error) {
    console.log(`❌ Cognito authentication failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test session listing API
 */
async function testSessionListing(userId, accessToken) {
  try {
    console.log(`\n📋 TESTING SESSION LISTING API`);
    console.log('='.repeat(60));

    const response = await makeRequest(TEST_CONFIG.endpoints.sessions(userId), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`📡 Sessions API Response Status: ${response.statusCode}`);

    if (response.statusCode === 200 && response.body.success) {
      const sessions = response.body.data;
      console.log(`✅ API call successful`);
      console.log(`📊 Sessions returned: ${sessions.length}`);

      sessions.forEach((session, index) => {
        console.log(`\n📋 API Session ${index + 1}:`);
        console.log(`   ID: ${session.id}`);
        console.log(`   Is Current: ${session.isCurrent} ${session.isCurrent ? '✅' : '❌'}`);
        console.log(`   Login Time: ${session.loginTime}`);
        console.log(`   Last Activity: ${session.lastActivity}`);
        console.log(`   IP Address: ${session.ipAddress}`);
        console.log(`   User Agent: ${session.userAgent}`);
      });

      const currentSession = sessions.find(s => s.isCurrent);
      if (currentSession) {
        console.log(`\n✅ Current session identified: ${currentSession.id}`);
      } else {
        console.log(`\n❌ NO CURRENT SESSION IDENTIFIED - THIS IS THE PROBLEM!`);
      }

      return {
        success: true,
        sessions,
        hasCurrentSession: !!currentSession,
        currentSession
      };
    } else {
      console.log(`❌ Sessions API failed:`, response.body);
      return { success: false, error: response.body };
    }
  } catch (error) {
    console.log(`❌ Sessions API error:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Compare JWT token with database sessions
 */
async function compareTokenWithSessions(accessToken, dbSessions) {
  console.log(`\n🔍 COMPARING JWT TOKEN WITH DATABASE SESSIONS`);
  console.log('='.repeat(60));

  const tokenAnalysis = analyzeJWT(accessToken);
  console.log(`🎫 Current Token Session ID: ${tokenAnalysis.sessionIdentifier}`);

  let matchFound = false;

  dbSessions.forEach((session, index) => {
    console.log(`\n📋 Comparing with DB Session ${index + 1}:`);
    console.log(`   DB Session ID: ${session.sessionId}`);
    console.log(`   DB Session Identifier: ${session.sessionIdentifier || 'MISSING'}`);
    
    // Check if session identifiers match
    const identifierMatch = session.sessionIdentifier === tokenAnalysis.sessionIdentifier;
    console.log(`   Identifier Match: ${identifierMatch ? '✅ YES' : '❌ NO'}`);

    if (identifierMatch) {
      matchFound = true;
      console.log(`   🎯 THIS IS THE CURRENT SESSION!`);
    }

    // Also check token comparison for debugging
    if (session.sessionToken) {
      const sessionTokenAnalysis = analyzeJWT(session.sessionToken);
      const tokenMatch = session.sessionToken === accessToken;
      console.log(`   Token Match: ${tokenMatch ? '✅ YES' : '❌ NO'}`);
      console.log(`   Session Token ID: ${sessionTokenAnalysis.sessionIdentifier}`);
    }
  });

  if (!matchFound) {
    console.log(`\n❌ NO MATCHING SESSION FOUND - THIS EXPLAINS THE ISSUE!`);
  }

  return matchFound;
}

/**
 * Test session creation by logging in again
 */
async function testNewSessionCreation(email, password) {
  console.log(`\n🆕 TESTING NEW SESSION CREATION`);
  console.log('='.repeat(60));

  // Login again to create a new session
  const loginResult = await testLogin(email, password);
  
  if (loginResult.success) {
    // Wait a moment for session to be created
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Query database to see the new session
    const dbSessions = await querySessionsFromDB(loginResult.userId);
    
    // Test the API with the new token
    const apiResult = await testSessionListing(loginResult.userId, loginResult.accessToken);
    
    return {
      loginResult,
      dbSessions,
      apiResult
    };
  }
  
  return { error: 'Login failed' };
}

/**
 * Main test execution
 */
async function runComprehensiveTest(email, password) {
  console.log(`\n🚀 STARTING COMPREHENSIVE SESSION IDENTIFICATION TEST`);
  console.log('='.repeat(80));
  console.log(`📧 Email: ${email}`);
  console.log(`🕐 Test Time: ${new Date().toISOString()}`);

  try {
    // Step 1: Login and get token
    const loginResult = await testLogin(email, password);
    if (!loginResult.success) {
      console.log(`\n❌ TEST FAILED: Could not login`);
      return;
    }

    // Step 2: Query database directly
    const dbSessions = await querySessionsFromDB(loginResult.userId);

    // Step 3: Test session listing API
    const apiResult = await testSessionListing(loginResult.userId, loginResult.accessToken);

    // Step 4: Compare token with database sessions
    const tokenMatch = await compareTokenWithSessions(loginResult.accessToken, dbSessions);

    // Step 5: Test new session creation
    console.log(`\n🔄 TESTING NEW SESSION CREATION...`);
    const newSessionTest = await testNewSessionCreation(email, password);

    // Summary
    console.log(`\n📊 TEST SUMMARY`);
    console.log('='.repeat(60));
    console.log(`✅ Login Success: ${loginResult.success}`);
    console.log(`📊 DB Sessions Found: ${dbSessions.length}`);
    console.log(`✅ API Call Success: ${apiResult.success}`);
    console.log(`🎯 Token Match Found: ${tokenMatch ? 'YES' : 'NO'}`);
    console.log(`🔍 Current Session Identified: ${apiResult.hasCurrentSession ? 'YES' : 'NO'}`);

    if (!apiResult.hasCurrentSession) {
      console.log(`\n🚨 ISSUE CONFIRMED: Backend is NOT identifying current session correctly`);
      
      // Detailed diagnosis
      console.log(`\n🔍 DETAILED DIAGNOSIS:`);
      console.log(`   - JWT Token Session ID: ${loginResult.sessionIdentifier}`);
      console.log(`   - Database Sessions: ${dbSessions.length}`);
      
      dbSessions.forEach((session, i) => {
        console.log(`   - DB Session ${i+1} ID: ${session.sessionIdentifier || 'MISSING'}`);
      });
      
      if (dbSessions.length === 0) {
        console.log(`   🔍 DIAGNOSIS: No sessions found in database`);
      } else if (dbSessions.some(s => !s.sessionIdentifier)) {
        console.log(`   🔍 DIAGNOSIS: Legacy sessions without sessionIdentifier`);
      } else if (!tokenMatch) {
        console.log(`   🔍 DIAGNOSIS: Session identifier mismatch`);
      }
    } else {
      console.log(`\n✅ SUCCESS: Backend correctly identified current session`);
    }

  } catch (error) {
    console.error(`\n❌ TEST FAILED WITH ERROR:`, error);
  }
}

/**
 * CLI Interface
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
🧪 Comprehensive Session Identification Test

Usage: node comprehensive-session-test.js <email> <password>

This script will:
1. Login with provided credentials
2. Query database directly for sessions
3. Test session listing API
4. Compare JWT token with database sessions
5. Test new session creation
6. Provide detailed diagnosis

Example:
  node comprehensive-session-test.js user@example.com password123
`);
    process.exit(1);
  }

  const [email, password] = args;
  runComprehensiveTest(email, password);
}

module.exports = {
  runComprehensiveTest,
  testLogin,
  testSessionListing,
  querySessionsFromDB,
  analyzeJWT,
  compareTokenWithSessions
}; 