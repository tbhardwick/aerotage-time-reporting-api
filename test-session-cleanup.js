#!/usr/bin/env node

/**
 * Test script to verify session cleanup functionality
 * Tests logout endpoint and session termination with actual deletion
 */

const https = require('https');

// Configuration
const API_BASE_URL = 'https://time-api-dev.aerotage.com';
const TEST_USER_ID = 'test-user-123'; // Replace with actual test user ID
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual JWT token

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
        'User-Agent': 'Session-Cleanup-Test/1.0',
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
 * Test logout endpoint
 */
async function testLogout() {
  console.log('\n🚪 TESTING LOGOUT ENDPOINT');
  console.log('============================');
  
  try {
    const result = await makeRequest(
      '/logout',
      'POST',
      {},
      {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    );
    
    console.log(`📡 Response Status: ${result.statusCode} ${result.statusMessage}`);
    
    if (result.statusCode === 200 && result.body.success) {
      console.log('✅ Logout successful!');
      console.log(`   Message: ${result.body.data.message}`);
      if (result.body.data.sessionId) {
        console.log(`   Session deleted: ${result.body.data.sessionId}`);
      }
      return { success: true, data: result.body.data };
    } else {
      console.log('❌ Logout failed:', result.body);
      return { success: false, error: result.body };
    }
  } catch (error) {
    console.log(`❌ Logout error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test session termination (should actually delete)
 */
async function testSessionTermination() {
  console.log('\n🔄 TESTING SESSION TERMINATION');
  console.log('===============================');
  
  try {
    // First, create a test session
    console.log('📝 Creating test session...');
    const createResult = await makeRequest(
      `/users/${TEST_USER_ID}/sessions`,
      'POST',
      {
        userAgent: 'Session-Cleanup-Test/1.0',
        loginTime: new Date().toISOString()
      },
      {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    );
    
    if (createResult.statusCode !== 201) {
      console.log('❌ Failed to create test session:', createResult.body);
      return { success: false, error: 'Could not create test session' };
    }
    
    const sessionId = createResult.body.data.id;
    console.log(`✅ Test session created: ${sessionId}`);
    
    // Now terminate it
    console.log('🗑️  Terminating session...');
    const terminateResult = await makeRequest(
      `/users/${TEST_USER_ID}/sessions/${sessionId}`,
      'DELETE',
      null,
      {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    );
    
    console.log(`📡 Termination Status: ${terminateResult.statusCode} ${terminateResult.statusMessage}`);
    
    if (terminateResult.statusCode === 200 && terminateResult.body.success) {
      console.log('✅ Session terminated successfully!');
      console.log(`   Message: ${terminateResult.body.data.message}`);
      
      // Verify session is actually deleted by trying to list sessions
      console.log('🔍 Verifying session deletion...');
      const listResult = await makeRequest(
        `/users/${TEST_USER_ID}/sessions`,
        'GET',
        null,
        {
          'Authorization': `Bearer ${JWT_TOKEN}`
        }
      );
      
      if (listResult.statusCode === 200) {
        const sessions = listResult.body.data;
        const deletedSession = sessions.find(s => s.id === sessionId);
        
        if (!deletedSession) {
          console.log('✅ Session successfully deleted from database!');
          return { success: true, verified: true };
        } else {
          console.log('⚠️  Session still exists in database (not properly deleted)');
          return { success: true, verified: false };
        }
      } else {
        console.log('❌ Could not verify session deletion');
        return { success: true, verified: null };
      }
    } else {
      console.log('❌ Session termination failed:', terminateResult.body);
      return { success: false, error: terminateResult.body };
    }
  } catch (error) {
    console.log(`❌ Session termination error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test session listing
 */
async function testSessionListing() {
  console.log('\n📋 TESTING SESSION LISTING');
  console.log('===========================');
  
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
        console.log(`   Is Current: ${session.isCurrent ? '✅' : '❌'}`);
        console.log(`   User Agent: ${session.userAgent}`);
        console.log(`   Login Time: ${session.loginTime}`);
      });
      
      return { success: true, sessions };
    } else {
      console.log('❌ Session listing failed:', result.body);
      return { success: false, error: result.body };
    }
  } catch (error) {
    console.log(`❌ Session listing error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🧪 SESSION CLEANUP TEST SUITE');
  console.log('==============================');
  console.log('🎯 Testing session cleanup functionality');
  console.log('📋 Testing logout, termination, and verification\n');
  
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
    sessionListing: null,
    sessionTermination: null,
    logout: null
  };
  
  try {
    // Test 1: Session listing (baseline)
    console.log('🔍 TEST 1: Session listing (baseline)');
    testResults.sessionListing = await testSessionListing();
    
    // Test 2: Session termination with verification
    console.log('\n🔍 TEST 2: Session termination with verification');
    testResults.sessionTermination = await testSessionTermination();
    
    // Test 3: Logout endpoint
    console.log('\n🔍 TEST 3: Logout endpoint');
    testResults.logout = await testLogout();
    
    // Summary
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('========================');
    
    const sessionListingPassed = testResults.sessionListing?.success;
    const sessionTerminationPassed = testResults.sessionTermination?.success;
    const sessionDeletionVerified = testResults.sessionTermination?.verified;
    const logoutPassed = testResults.logout?.success;
    
    console.log(`✅ Session listing: ${sessionListingPassed ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Session termination: ${sessionTerminationPassed ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Session deletion verified: ${sessionDeletionVerified ? 'YES' : sessionDeletionVerified === false ? 'NO' : 'UNKNOWN'}`);
    console.log(`✅ Logout endpoint: ${logoutPassed ? 'PASS' : 'FAIL'}`);
    
    const allTestsPassed = sessionListingPassed && sessionTerminationPassed && logoutPassed;
    const sessionCleanupWorking = sessionDeletionVerified === true;
    
    if (allTestsPassed && sessionCleanupWorking) {
      console.log('\n🎉 ALL TESTS PASSED! 🎉');
      console.log('=======================');
      console.log('✅ Session cleanup is working correctly');
      console.log('✅ Sessions are actually deleted from database');
      console.log('✅ Logout endpoint is functional');
      console.log('✅ Session management APIs are operational');
    } else if (allTestsPassed && !sessionCleanupWorking) {
      console.log('\n⚠️  TESTS PASSED BUT CLEANUP ISSUE DETECTED');
      console.log('============================================');
      console.log('✅ All API endpoints are working');
      console.log('❌ Sessions may not be properly deleted from database');
      console.log('🔍 Check the terminate-session.ts implementation');
    } else {
      console.log('\n❌ SOME TESTS FAILED');
      console.log('====================');
      console.log('🔍 Check the error messages above for details');
      
      if (!sessionListingPassed) {
        console.log('❌ Session listing failed - check authentication');
      }
      if (!sessionTerminationPassed) {
        console.log('❌ Session termination failed - check endpoint implementation');
      }
      if (!logoutPassed) {
        console.log('❌ Logout failed - check logout endpoint implementation');
      }
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

module.exports = { main, testLogout, testSessionTermination, testSessionListing }; 