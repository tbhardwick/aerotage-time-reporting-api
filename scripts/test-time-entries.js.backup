#!/usr/bin/env node

const https = require('https');
const { URL } = require('url');

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://time-api-dev.aerotage.com',
  COGNITO_CLIENT_ID: '148r35u6uultp1rmfdu22i8amb',
  COGNITO_USER_POOL_ID: 'us-east-1_EsdlgX9Qg',
  TEST_USER: {
    email: 'bhardwick@aerotage.com',
    password: 'Aerotage*2025'
  }
};

// Test data
const TEST_PROJECT_ID = 'test-project-123';
const TEST_TIME_ENTRIES = [];

// Utility functions
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

async function authenticateUser() {
  console.log('🔐 Authenticating user...');
  
  // First, initiate auth with Cognito
  const authUrl = `https://cognito-idp.us-east-1.amazonaws.com/`;
  
  try {
    const authResponse = await makeRequest(authUrl, {
      method: 'POST',
      headers: {
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
        'Content-Type': 'application/x-amz-json-1.1'
      },
      body: {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CONFIG.COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: CONFIG.TEST_USER.email,
          PASSWORD: CONFIG.TEST_USER.password
        }
      }
    });

    if (authResponse.statusCode !== 200) {
      throw new Error(`Authentication failed: ${JSON.stringify(authResponse.body)}`);
    }

    const idToken = authResponse.body.AuthenticationResult.IdToken;
    const accessToken = authResponse.body.AuthenticationResult.AccessToken;
    
    console.log('✅ Authentication successful');
    return { idToken, accessToken };
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    throw error;
  }
}

async function createSession(idToken) {
  console.log('🔄 Creating user session...');
  
  try {
    // Extract user ID from token (simplified - in production you'd decode the JWT properly)
    const tokenParts = idToken.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const userId = payload.sub;
    
         const response = await makeRequest(`${CONFIG.API_BASE_URL}/users/${userId}/sessions`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${idToken}`
       },
       body: {
         userAgent: 'Test Script',
         ipAddress: '127.0.0.1'
       }
     });

    if (response.statusCode === 201) {
      console.log('✅ Session created successfully');
      return { userId, sessionToken: idToken };
    } else {
      console.log('⚠️ Session creation response:', response.statusCode, response.body);
      return { userId, sessionToken: idToken };
    }
  } catch (error) {
    console.error('❌ Session creation failed:', error.message);
    throw error;
  }
}

async function testCreateTimeEntry(token) {
  console.log('\n📝 Testing: Create Time Entry');
  
  const timeEntryData = {
    projectId: TEST_PROJECT_ID,
    description: 'Test time entry from automated script',
    date: new Date().toISOString().split('T')[0], // Today's date
    duration: 120, // 2 hours in minutes
    isBillable: true,
    tags: ['testing', 'automation'],
    notes: 'Created by test script'
  };

  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: timeEntryData
    });

    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 201 && response.body.success) {
      const timeEntryId = response.body.data.id;
      TEST_TIME_ENTRIES.push(timeEntryId);
      console.log('✅ Time entry created successfully:', timeEntryId);
      return timeEntryId;
    } else {
      console.log('❌ Failed to create time entry');
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating time entry:', error.message);
    return null;
  }
}

async function testListTimeEntries(token) {
  console.log('\n📋 Testing: List Time Entries');
  
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries?limit=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      console.log('✅ Time entries listed successfully');
      console.log(`Found ${response.body.data.items.length} time entries`);
      return true;
    } else {
      console.log('❌ Failed to list time entries');
      return false;
    }
  } catch (error) {
    console.error('❌ Error listing time entries:', error.message);
    return false;
  }
}

async function testUpdateTimeEntry(token, timeEntryId) {
  if (!timeEntryId) {
    console.log('\n⏭️ Skipping: Update Time Entry (no time entry to update)');
    return false;
  }

  console.log('\n✏️ Testing: Update Time Entry');
  
  const updateData = {
    description: 'Updated test time entry from automated script',
    duration: 180, // 3 hours in minutes
    tags: ['testing', 'automation', 'updated']
  };

  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/${timeEntryId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: updateData
    });

    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      console.log('✅ Time entry updated successfully');
      return true;
    } else {
      console.log('❌ Failed to update time entry');
      return false;
    }
  } catch (error) {
    console.error('❌ Error updating time entry:', error.message);
    return false;
  }
}

async function testSubmitTimeEntries(token, timeEntryIds) {
  if (!timeEntryIds || timeEntryIds.length === 0) {
    console.log('\n⏭️ Skipping: Submit Time Entries (no time entries to submit)');
    return false;
  }

  console.log('\n📤 Testing: Submit Time Entries');
  
  const submitData = {
    timeEntryIds: timeEntryIds,
    submissionNotes: 'Submitted by test script'
  };

  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: submitData
    });

    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if ((response.statusCode === 200 || response.statusCode === 207) && response.body.success) {
      console.log('✅ Time entries submitted successfully');
      return true;
    } else {
      console.log('❌ Failed to submit time entries');
      return false;
    }
  } catch (error) {
    console.error('❌ Error submitting time entries:', error.message);
    return false;
  }
}

async function testApproveTimeEntries(token, timeEntryIds) {
  if (!timeEntryIds || timeEntryIds.length === 0) {
    console.log('\n⏭️ Skipping: Approve Time Entries (no time entries to approve)');
    return false;
  }

  console.log('\n✅ Testing: Approve Time Entries');
  
  const approveData = {
    timeEntryIds: timeEntryIds,
    approvalNotes: 'Approved by test script'
  };

  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: approveData
    });

    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if ((response.statusCode === 200 || response.statusCode === 207) && response.body.success) {
      console.log('✅ Time entries approved successfully');
      return true;
    } else {
      console.log('❌ Failed to approve time entries');
      return false;
    }
  } catch (error) {
    console.error('❌ Error approving time entries:', error.message);
    return false;
  }
}

async function testRejectTimeEntries(token, timeEntryIds) {
  if (!timeEntryIds || timeEntryIds.length === 0) {
    console.log('\n⏭️ Skipping: Reject Time Entries (no time entries to reject)');
    return false;
  }

  console.log('\n❌ Testing: Reject Time Entries');
  
  const rejectData = {
    timeEntryIds: timeEntryIds,
    rejectionReason: 'Rejected by test script for testing purposes',
    rejectionNotes: 'This is a test rejection'
  };

  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: rejectData
    });

    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if ((response.statusCode === 200 || response.statusCode === 207) && response.body.success) {
      console.log('✅ Time entries rejected successfully');
      return true;
    } else {
      console.log('❌ Failed to reject time entries');
      return false;
    }
  } catch (error) {
    console.error('❌ Error rejecting time entries:', error.message);
    return false;
  }
}

async function testDeleteTimeEntry(token, timeEntryId) {
  if (!timeEntryId) {
    console.log('\n⏭️ Skipping: Delete Time Entry (no time entry to delete)');
    return false;
  }

  console.log('\n🗑️ Testing: Delete Time Entry');
  
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/${timeEntryId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      console.log('✅ Time entry deleted successfully');
      return true;
    } else {
      console.log('❌ Failed to delete time entry');
      return false;
    }
  } catch (error) {
    console.error('❌ Error deleting time entry:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Time Entry API Tests');
  console.log('=====================================');
  
  const results = {
    authentication: false,
    createTimeEntry: false,
    listTimeEntries: false,
    updateTimeEntry: false,
    submitTimeEntries: false,
    approveTimeEntries: false,
    rejectTimeEntries: false,
    deleteTimeEntry: false
  };

  try {
    // Step 1: Authenticate
    const { idToken } = await authenticateUser();
    const { sessionToken } = await createSession(idToken);
    results.authentication = true;

    // Step 2: Create time entry
    const timeEntryId = await testCreateTimeEntry(sessionToken);
    results.createTimeEntry = !!timeEntryId;

    // Step 3: List time entries
    results.listTimeEntries = await testListTimeEntries(sessionToken);

    // Step 4: Update time entry
    results.updateTimeEntry = await testUpdateTimeEntry(sessionToken, timeEntryId);

    // Step 5: Submit time entries
    if (timeEntryId) {
      results.submitTimeEntries = await testSubmitTimeEntries(sessionToken, [timeEntryId]);
    }

    // Step 6: Test approval (this might fail if user doesn't have manager/admin role)
    if (timeEntryId) {
      results.approveTimeEntries = await testApproveTimeEntries(sessionToken, [timeEntryId]);
    }

    // Step 7: Create another entry for rejection test
    const timeEntryId2 = await testCreateTimeEntry(sessionToken);
    if (timeEntryId2) {
      await testSubmitTimeEntries(sessionToken, [timeEntryId2]);
      results.rejectTimeEntries = await testRejectTimeEntries(sessionToken, [timeEntryId2]);
    }

    // Step 8: Create another entry for deletion test
    const timeEntryId3 = await testCreateTimeEntry(sessionToken);
    if (timeEntryId3) {
      results.deleteTimeEntry = await testDeleteTimeEntry(sessionToken, timeEntryId3);
    }

  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
  }

  // Print summary
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${test.padEnd(20)}: ${status}`);
  });

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  console.log(`\nOverall: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️ Some tests failed. Check the output above for details.');
  }
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  CONFIG
}; 