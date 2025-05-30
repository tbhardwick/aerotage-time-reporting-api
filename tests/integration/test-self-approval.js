#!/usr/bin/env node

const { getCognitoToken } = require('../../scripts/get-cognito-token');
const https = require('https');

// Configuration
const API_BASE_URL = 'https://time-api-dev.aerotage.com';
const TEST_USER = {
  email: 'bhardwick@aerotage.com',
  password: 'Aerotage*2025'
};

/**
 * Make HTTP request with proper authentication
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
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
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
 * Test self-approval functionality
 */
async function testSelfApproval() {
  try {
    console.log('🧪 Testing Self-Approval Functionality for Managers/Admins\n');
    
    // Get authentication token
    console.log('🔐 Getting JWT token...');
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    const { token: accessToken } = authResult;
    console.log('✅ JWT token obtained successfully\n');

    // Step 1: Create a test time entry
    console.log('📝 Step 1: Creating a test time entry...');
    const timeEntryData = {
      projectId: 'test-project-123',
      description: 'Self-approval test entry',
      date: '2025-01-27',
      duration: 480, // 8 hours in minutes
      isBillable: true,
      hourlyRate: 150.00
    };

    const createResponse = await makeRequest(`${API_BASE_URL}/time-entries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: timeEntryData
    });

    console.log(`Status: ${createResponse.status}`);
    if (createResponse.status === 201 && createResponse.data.success) {
      const timeEntryId = createResponse.data.data.id;
      console.log(`✅ Time entry created successfully: ${timeEntryId}\n`);

      // Step 2: Submit the time entry for approval
      console.log('📤 Step 2: Submitting time entry for approval...');
      const submitResponse = await makeRequest(`${API_BASE_URL}/time-entries/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: {
          timeEntryIds: [timeEntryId]
        }
      });

      console.log(`Status: ${submitResponse.status}`);
      if (submitResponse.status === 200 && submitResponse.data.success) {
        console.log('✅ Time entry submitted for approval successfully\n');

        // Step 3: Attempt self-approval (should work for admin/manager)
        console.log('✅ Step 3: Attempting self-approval (admin/manager should be allowed)...');
        const approveResponse = await makeRequest(`${API_BASE_URL}/time-entries/approve`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          body: {
            timeEntryIds: [timeEntryId]
          }
        });

        console.log(`Status: ${approveResponse.status}`);
        console.log('Response:', JSON.stringify(approveResponse.data, null, 2));

        if (approveResponse.status === 200 && approveResponse.data.success) {
          console.log('🎉 SUCCESS: Self-approval worked! Admin/Manager can approve their own time entries.');
          
          // Check if the time entry was actually approved
          if (approveResponse.data.data.successful && approveResponse.data.data.successful.length > 0) {
            console.log(`✅ Time entry ${timeEntryId} was successfully approved by self.`);
          }
        } else {
          console.log('❌ FAILED: Self-approval was rejected.');
          if (approveResponse.data.error) {
            console.log('Error details:', approveResponse.data.error);
          }
        }

      } else {
        console.log('❌ Failed to submit time entry for approval');
        console.log('Response:', JSON.stringify(submitResponse.data, null, 2));
      }

    } else {
      console.log('❌ Failed to create time entry');
      console.log('Response:', JSON.stringify(createResponse.data, null, 2));
    }

    console.log('\n🏁 Self-approval test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSelfApproval(); 