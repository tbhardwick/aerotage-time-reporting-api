#!/usr/bin/env node

const { getCognitoToken } = require('./scripts/get-cognito-token');
const https = require('https');

// Configuration
const API_BASE_URL = 'https://time-api-dev.aerotage.com';
const TEST_USER = {
  email: 'bhardwick@aerotage.com',
  password: 'Aerotage*2025'
};

/**
 * Make HTTP request (matching Phase 5/6 pattern)
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
 * Test email change workflow endpoints
 */
async function testEmailChangeWorkflow() {
  console.log(`\n🚀 TESTING EMAIL CHANGE WORKFLOW`);
  console.log('='.repeat(80));
  console.log(`📧 Test User: ${TEST_USER.email}`);
  console.log(`🕐 Test Time: ${new Date().toISOString()}`);
  console.log(`🌐 API Base URL: ${API_BASE_URL}`);

  const testResults = {
    authentication: false,
    submitRequest: false,
    listRequests: false,
    cancelRequest: false,
    verifyEndpoint: false
  };

  try {
    // Step 1: Authenticate (matching Phase 5/6 pattern)
    console.log(`\n🔐 Step 1: Authenticate with Cognito`);
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    
    if (!authResult.success) {
      console.log(`❌ Authentication failed: ${authResult.error}`);
      return testResults;
    }

    const { token: accessToken, userId } = authResult;
    console.log(`✅ Authentication successful for user: ${userId}`);
    testResults.authentication = true;

    // Step 2: Submit email change request
    console.log(`\n📝 Step 2: Submit Email Change Request`);
    console.log('='.repeat(60));

    const submitData = {
      newEmail: 'brad.test@aerotage.com',
      reason: 'personal_preference',
      currentPassword: 'Aerotage*2025'
    };

    console.log(`📤 Submitting email change request:`, submitData);

    const submitResponse = await makeRequest(`${API_BASE_URL}/email-change`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: submitData
    });

    console.log(`📡 Response Status: ${submitResponse.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(submitResponse.body, null, 2));

    if (submitResponse.statusCode === 200 && submitResponse.body.success) {
      const requestData = submitResponse.body.data;
      console.log(`✅ Email change request submitted successfully!`);
      console.log(`🆔 Request ID: ${requestData.requestId}`);
      console.log(`📧 New Email: ${requestData.newEmail}`);
      console.log(`📊 Status: ${requestData.status}`);
      testResults.submitRequest = true;
      
      var requestId = requestData.requestId; // Store for later tests
    } else {
      console.log(`❌ Email change request submission failed`);
      testResults.submitRequest = false;
    }

    // Step 3: List email change requests
    console.log(`\n📋 Step 3: List Email Change Requests`);
    console.log('='.repeat(60));

    const listResponse = await makeRequest(`${API_BASE_URL}/email-change?limit=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`📡 Response Status: ${listResponse.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(listResponse.body, null, 2));

    if (listResponse.statusCode === 200 && listResponse.body.success) {
      const { requests, pagination } = listResponse.body.data;
      console.log(`✅ Email change requests retrieved successfully`);
      console.log(`📊 Total requests: ${pagination.total}`);
      console.log(`📄 Page size: ${pagination.limit}`);
      
      if (requests && requests.length > 0) {
        requests.forEach((request, index) => {
          console.log(`\n📧 Request ${index + 1}:`);
          console.log(`   ID: ${request.id}`);
          console.log(`   New Email: ${request.newEmail}`);
          console.log(`   Status: ${request.status}`);
          console.log(`   Reason: ${request.reason}`);
          console.log(`   Created: ${request.createdAt}`);
        });
      } else {
        console.log(`📝 No email change requests found`);
      }
      
      testResults.listRequests = true;
    } else {
      console.log(`❌ Email change requests listing failed`);
      testResults.listRequests = false;
    }

    // Step 4: Cancel email change request (if we have one)
    if (requestId) {
      console.log(`\n❌ Step 4: Cancel Email Change Request`);
      console.log('='.repeat(60));

      console.log(`📤 Cancelling email change request: ${requestId}`);

      const cancelResponse = await makeRequest(`${API_BASE_URL}/email-change/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      console.log(`📡 Response Status: ${cancelResponse.statusCode}`);
      console.log(`📋 Response Body:`, JSON.stringify(cancelResponse.body, null, 2));

      if (cancelResponse.statusCode === 200 && cancelResponse.body.success) {
        console.log(`✅ Email change request cancelled successfully!`);
        testResults.cancelRequest = true;
      } else {
        console.log(`❌ Email change request cancellation failed`);
        testResults.cancelRequest = false;
      }
    }

    // Step 5: Test verification endpoint (with invalid token)
    console.log(`\n🔍 Step 5: Test Email Verification Endpoint`);
    console.log('='.repeat(60));

    const verifyData = {
      token: 'invalid-token-for-testing',
      emailType: 'current'
    };

    console.log(`📤 Testing verification with invalid token:`, verifyData);

    const verifyResponse = await makeRequest(`${API_BASE_URL}/email-change/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: verifyData
    });

    console.log(`📡 Response Status: ${verifyResponse.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(verifyResponse.body, null, 2));

    if (verifyResponse.statusCode === 400 || verifyResponse.statusCode === 404) {
      console.log(`✅ Verification endpoint working correctly (expected error for invalid token)`);
      testResults.verifyEndpoint = true;
    } else {
      console.log(`❌ Verification endpoint unexpected response`);
      testResults.verifyEndpoint = false;
    }

  } catch (error) {
    console.error(`\n❌ TEST FAILED WITH ERROR:`, error);
  }

  // Summary
  console.log(`\n📊 EMAIL CHANGE WORKFLOW TEST SUMMARY`);
  console.log('='.repeat(80));
  
  const testSteps = [
    { name: 'Authentication', result: testResults.authentication },
    { name: 'Submit Request', result: testResults.submitRequest },
    { name: 'List Requests', result: testResults.listRequests },
    { name: 'Cancel Request', result: testResults.cancelRequest },
    { name: 'Verify Endpoint', result: testResults.verifyEndpoint }
  ];

  testSteps.forEach(step => {
    const status = step.result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${step.name}`);
  });

  const passedTests = testSteps.filter(step => step.result).length;
  const totalTests = testSteps.length;
  
  console.log(`\n🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log(`🎉 ALL EMAIL CHANGE ENDPOINTS ARE WORKING CORRECTLY!`);
  } else {
    console.log(`🚨 Some tests failed. Please review the output above for details.`);
  }

  return testResults;
}

/**
 * Test admin approval workflow (requires admin user)
 */
async function testAdminWorkflow() {
  console.log(`\n👑 TESTING ADMIN WORKFLOW (requires admin permissions)`);
  console.log('='.repeat(80));
  
  try {
    // Get authentication token
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    
    if (!authResult.success) {
      console.log(`❌ Authentication failed: ${authResult.error}`);
      return;
    }

    const { token: accessToken, userId } = authResult;
    console.log(`✅ Authentication successful for user: ${userId}`);

    // First create a request to approve/reject
    console.log(`\n📧 Creating email change request for admin testing...`);
    const submitResponse = await makeRequest(`${API_BASE_URL}/email-change`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: {
        newEmail: 'brad.hardwick+admin-test@aerotage.com',
        reason: 'company_change', // This will require approval
        customReason: 'Testing admin approval workflow',
        currentPassword: 'Aerotage*2025' // Added missing password
      }
    });

    if (submitResponse.statusCode !== 200 || !submitResponse.body.success) {
      console.error('❌ Failed to create request for admin testing');
      console.log('Response:', JSON.stringify(submitResponse.body, null, 2));
      return;
    }

    const requestId = submitResponse.body.data.requestId;
    console.log('✅ Email change request created for admin testing:', requestId);

    // Test admin approval (will likely fail due to verification requirements)
    console.log('\n✅ Test: Admin approve request');
    const approveResponse = await makeRequest(`${API_BASE_URL}/email-change/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: {
        approvalNotes: 'Approved for testing purposes'
      }
    });

    console.log('📡 Approve Response Status:', approveResponse.statusCode);
    console.log('📋 Approve Response:', JSON.stringify(approveResponse.body, null, 2));

    // Test admin rejection
    console.log('\n❌ Test: Admin reject request');
    const rejectResponse = await makeRequest(`${API_BASE_URL}/email-change/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: {
        rejectionReason: 'Testing rejection workflow'
      }
    });

    console.log('📡 Reject Response Status:', rejectResponse.statusCode);
    console.log('📋 Reject Response:', JSON.stringify(rejectResponse.body, null, 2));

    console.log('\n✅ Admin workflow tests completed');

  } catch (error) {
    console.error('❌ Admin workflow test failed:', error);
  }
}

// CLI interface
if (require.main === module) {
  console.log(`
🧪 Email Change Workflow Test Suite

This script will test the email change workflow endpoints:
- Submit Email Change Request (POST)
- List Email Change Requests (GET)
- Cancel Email Change Request (DELETE)
- Email Verification (POST)
- Admin Approval/Rejection (POST)

Using test credentials:
- Email: ${TEST_USER.email}
- API: ${API_BASE_URL}

Starting tests...
`);

  async function runAllTests() {
    await testEmailChangeWorkflow();
    await testAdminWorkflow();
    console.log('\n🏁 All tests completed!');
  }

  runAllTests();
}

module.exports = {
  testEmailChangeWorkflow,
  testAdminWorkflow
}; 