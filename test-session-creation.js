#!/usr/bin/env node

const { getCognitoToken } = require('./get-cognito-token');
const https = require('https');

// Configuration
const API_BASE_URL = 'https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev';

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
 * Test session creation endpoint
 */
async function testSessionCreation(userId, accessToken) {
  console.log(`\n🆕 TESTING SESSION CREATION ENDPOINT`);
  console.log('='.repeat(60));

  const sessionData = {
    userAgent: 'Test User Agent - Node.js Script',
    loginTime: new Date().toISOString()
  };

  console.log(`📤 Creating session for user: ${userId}`);
  console.log(`📋 Session data:`, sessionData);

  try {
    const response = await makeRequest(`${API_BASE_URL}/users/${userId}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: sessionData
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 201 && response.body.success) {
      const session = response.body.data;
      console.log(`✅ Session created successfully!`);
      console.log(`🆔 Session ID: ${session.id}`);
      console.log(`🔄 Is Current: ${session.isCurrent}`);
      console.log(`📍 IP Address: ${session.ipAddress}`);
      console.log(`🌍 Location: ${session.location ? `${session.location.city}, ${session.location.country}` : 'Unknown'}`);
      
      return {
        success: true,
        session
      };
    } else {
      console.log(`❌ Session creation failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Session creation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test session listing after creation
 */
async function testSessionListingAfterCreation(userId, accessToken) {
  console.log(`\n📋 TESTING SESSION LISTING AFTER CREATION`);
  console.log('='.repeat(60));

  try {
    const response = await makeRequest(`${API_BASE_URL}/users/${userId}/sessions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`📡 Response Status: ${response.statusCode}`);

    if (response.statusCode === 200 && response.body.success) {
      const sessions = response.body.data;
      console.log(`✅ Sessions retrieved successfully`);
      console.log(`📊 Total sessions: ${sessions.length}`);

      sessions.forEach((session, index) => {
        console.log(`\n📋 Session ${index + 1}:`);
        console.log(`   ID: ${session.id}`);
        console.log(`   Is Current: ${session.isCurrent} ${session.isCurrent ? '✅' : '❌'}`);
        console.log(`   Login Time: ${session.loginTime}`);
        console.log(`   User Agent: ${session.userAgent}`);
      });

      const currentSession = sessions.find(s => s.isCurrent);
      if (currentSession) {
        console.log(`\n🎯 SUCCESS: Current session identified!`);
        console.log(`   Current Session ID: ${currentSession.id}`);
        return {
          success: true,
          sessions,
          currentSession
        };
      } else {
        console.log(`\n❌ ISSUE PERSISTS: No current session identified`);
        return {
          success: true,
          sessions,
          currentSession: null
        };
      }
    } else {
      console.log(`❌ Session listing failed:`, response.body);
      return {
        success: false,
        error: response.body
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
 * Complete test flow
 */
async function runCompleteTest(email, password) {
  console.log(`\n🚀 TESTING COMPLETE SESSION CREATION FLOW`);
  console.log('='.repeat(80));
  console.log(`📧 Email: ${email}`);
  console.log(`🕐 Test Time: ${new Date().toISOString()}`);

  try {
    // Step 1: Get Cognito token
    console.log(`\n🔐 Step 1: Authenticate with Cognito`);
    const authResult = await getCognitoToken(email, password);
    
    if (!authResult.success) {
      console.log(`❌ Authentication failed: ${authResult.error}`);
      return;
    }

    const { token: accessToken, userId } = authResult;
    console.log(`✅ Authentication successful for user: ${userId}`);

    // Step 2: Create session
    console.log(`\n🆕 Step 2: Create session record`);
    const createResult = await testSessionCreation(userId, accessToken);
    
    if (!createResult.success) {
      console.log(`❌ Session creation failed: ${createResult.error}`);
      return;
    }

    // Step 3: List sessions to verify current session identification
    console.log(`\n📋 Step 3: Verify session identification`);
    const listResult = await testSessionListingAfterCreation(userId, accessToken);

    // Summary
    console.log(`\n📊 TEST SUMMARY`);
    console.log('='.repeat(60));
    console.log(`✅ Authentication: ${authResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Session Creation: ${createResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Session Listing: ${listResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`🎯 Current Session Identified: ${listResult.currentSession ? 'YES ✅' : 'NO ❌'}`);

    if (listResult.currentSession) {
      console.log(`\n🎉 SUCCESS: Session identification is working correctly!`);
      console.log(`   The issue is that the frontend needs to call the session creation endpoint after Cognito login.`);
    } else {
      console.log(`\n🚨 ISSUE PERSISTS: Session identification still not working`);
      console.log(`   This indicates a deeper backend issue that needs investigation.`);
    }

  } catch (error) {
    console.error(`\n❌ TEST FAILED WITH ERROR:`, error);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
🧪 Session Creation Test

Usage: node test-session-creation.js <email> <password>

This script will:
1. Authenticate with Cognito
2. Create a session record using POST /users/{userId}/sessions
3. List sessions to verify current session identification
4. Determine if the issue is resolved

Example:
  node test-session-creation.js user@example.com password123
`);
    process.exit(1);
  }

  const [email, password] = args;
  runCompleteTest(email, password);
}

module.exports = {
  testSessionCreation,
  testSessionListingAfterCreation,
  runCompleteTest
}; 