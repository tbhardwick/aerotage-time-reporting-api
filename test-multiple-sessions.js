#!/usr/bin/env node

/**
 * Test script to verify multiple session support
 * This script tests that users can create multiple sessions without being blocked
 */

const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// Configuration
const API_BASE_URL = 'https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev';
const TEST_USER_ID = 'test-user-123'; // Replace with actual test user ID
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual JWT token

// AWS Configuration
const AWS_CONFIG = {
  region: 'us-east-1',
  USER_SESSIONS_TABLE: 'aerotage-user-sessions-dev'
};

const dynamoClient = new DynamoDBClient({ region: AWS_CONFIG.region });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Make HTTP request to API
 */
function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE_URL + path);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Multiple-Sessions-Test/1.0',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsedBody = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            body: parsedBody
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Check current active sessions
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
        console.log(`     User Agent: ${session.userAgent}`);
        console.log('');
      });
    }
    
    return activeSessions.length;
    
  } catch (error) {
    console.error('❌ Failed to check active sessions:', error.message);
    return -1;
  }
}

/**
 * Create a new session
 */
async function createSession(sessionNumber) {
  console.log(`\n🚀 CREATING SESSION ${sessionNumber}`);
  console.log('================================');
  
  try {
    const sessionData = {
      userAgent: `Multiple-Sessions-Test-${sessionNumber}/1.0`,
      loginTime: new Date().toISOString()
    };
    
    const result = await makeRequest(
      `/users/${TEST_USER_ID}/sessions`,
      'POST',
      sessionData,
      {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    );
    
    console.log(`📡 Response Status: ${result.statusCode} ${result.statusMessage}`);
    
    if (result.statusCode === 201 && result.body.success) {
      console.log(`✅ Session ${sessionNumber} created successfully!`);
      console.log(`   Session ID: ${result.body.data.id}`);
      console.log(`   User Agent: ${result.body.data.userAgent}`);
      return {
        success: true,
        sessionId: result.body.data.id,
        data: result.body.data
      };
    } else {
      console.log(`❌ Session ${sessionNumber} creation failed:`, result.body);
      return {
        success: false,
        error: result.body
      };
    }
  } catch (error) {
    console.log(`❌ Session ${sessionNumber} creation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List sessions via API
 */
async function listSessionsViaAPI() {
  console.log(`\n📋 LISTING SESSIONS VIA API`);
  console.log('============================');
  
  try {
    const result = await makeRequest(
      `/users/${TEST_USER_ID}/sessions`,
      'GET',
      null,
      {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    );
    
    console.log(`📡 Response Status: ${result.statusCode} ${result.statusMessage}`);
    
    if (result.statusCode === 200 && result.body.success) {
      const sessions = result.body.data;
      console.log(`✅ Sessions retrieved successfully!`);
      console.log(`📊 Total sessions: ${sessions.length}`);
      
      sessions.forEach((session, index) => {
        console.log(`\n📋 Session ${index + 1}:`);
        console.log(`   ID: ${session.id}`);
        console.log(`   Is Current: ${session.isCurrent} ${session.isCurrent ? '✅' : '❌'}`);
        console.log(`   User Agent: ${session.userAgent}`);
        console.log(`   Login Time: ${session.loginTime}`);
      });
      
      return {
        success: true,
        sessions
      };
    } else {
      console.log(`❌ Session listing failed:`, result.body);
      return {
        success: false,
        error: result.body
      };
    }
  } catch (error) {
    console.log(`❌ Session listing error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🔬 MULTIPLE SESSIONS TEST SUITE');
  console.log('================================');
  console.log('🎯 This script tests that users can create multiple sessions');
  console.log('📋 Testing session creation, listing, and management\n');
  
  if (JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    console.log('❌ ERROR: Please replace JWT_TOKEN with actual token');
    console.log('   1. Login to the frontend app');
    console.log('   2. Open browser dev tools -> Application -> Local Storage');
    console.log('   3. Or check Network tab for Authorization header');
    console.log('   4. Replace JWT_TOKEN in this script with the actual token');
    return;
  }
  
  const startTime = new Date();
  let testResults = {
    initialSessions: -1,
    sessionsCreated: [],
    finalSessions: -1,
    apiListingWorked: false
  };
  
  try {
    // Step 1: Check initial active sessions
    console.log('🔍 STEP 1: Check initial active sessions');
    testResults.initialSessions = await checkActiveSessions(TEST_USER_ID);
    
    // Step 2: Create multiple sessions
    console.log('\n🔍 STEP 2: Create multiple sessions');
    for (let i = 1; i <= 3; i++) {
      const result = await createSession(i);
      testResults.sessionsCreated.push(result);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 3: Check final active sessions
    console.log('\n🔍 STEP 3: Check final active sessions');
    testResults.finalSessions = await checkActiveSessions(TEST_USER_ID);
    
    // Step 4: List sessions via API
    console.log('\n🔍 STEP 4: List sessions via API');
    const apiResult = await listSessionsViaAPI();
    testResults.apiListingWorked = apiResult.success;
    
    // Step 5: Analysis
    console.log('\n📊 TEST RESULTS ANALYSIS');
    console.log('=========================');
    
    const successfulCreations = testResults.sessionsCreated.filter(r => r.success);
    const failedCreations = testResults.sessionsCreated.filter(r => !r.success);
    
    console.log(`✅ Successful session creations: ${successfulCreations.length}/3`);
    console.log(`❌ Failed session creations: ${failedCreations.length}/3`);
    console.log(`📊 Initial sessions: ${testResults.initialSessions}`);
    console.log(`📊 Final sessions: ${testResults.finalSessions}`);
    console.log(`📋 API listing worked: ${testResults.apiListingWorked ? 'Yes' : 'No'}`);
    
    if (successfulCreations.length >= 2) {
      console.log('\n🎉 MULTIPLE SESSIONS WORKING! 🎉');
      console.log('==================================');
      console.log('✅ Users can now create multiple sessions');
      console.log('✅ The custom authorizer fix is working');
      console.log('✅ Session management is functioning properly');
    } else if (successfulCreations.length === 1) {
      console.log('\n⚠️  PARTIAL SUCCESS');
      console.log('===================');
      console.log('✅ One session created successfully');
      console.log('❌ Multiple sessions still having issues');
      console.log('🔍 Check the failed creation errors above');
    } else {
      console.log('\n❌ MULTIPLE SESSIONS NOT WORKING');
      console.log('=================================');
      console.log('❌ No sessions could be created');
      console.log('🔍 Check the error messages above');
      console.log('💡 The custom authorizer may still be blocking sessions');
    }
    
    if (failedCreations.length > 0) {
      console.log('\n🔍 FAILED CREATION DETAILS:');
      failedCreations.forEach((failure, index) => {
        console.log(`   ${index + 1}. Error:`, failure.error);
      });
    }
    
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log(`\n⏱️  Test completed in ${duration.toFixed(2)} seconds`);
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, createSession, checkActiveSessions }; 