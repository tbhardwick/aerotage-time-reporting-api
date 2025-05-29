#!/usr/bin/env node

const { getCognitoToken } = require('./scripts/get-cognito-token');
const https = require('https');

// Configuration
const API_BASE_URL = 'https://time-api-dev.aerotage.com';
const TEST_USER = {
  email: 'bhardwick@aerotage.com',
  password: 'Aerotage*2025'
};

// The request ID we want to process
const REQUEST_ID = 'b828162a-1933-44ca-881e-72cd04d5ff0e';

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
 * Test the email change processing workflow
 */
async function testEmailProcessing() {
  try {
    console.log('🔐 Getting JWT token...');
    
    // Get authentication token
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    const token = authResult.AccessToken;
    
    console.log('✅ JWT token obtained successfully');

    // Step 1: Check current status of the request
    console.log('\n📋 Step 1: Checking current request status...');
    const statusResponse = await makeRequest(`${API_BASE_URL}/email-change`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Status Response:', JSON.stringify(statusResponse.data, null, 2));

    // Find our specific request
    const requests = statusResponse.data?.data?.requests || [];
    const targetRequest = requests.find(req => req.id === REQUEST_ID);
    
    if (!targetRequest) {
      console.log('❌ Target request not found');
      return;
    }

    console.log(`📄 Found request: ${targetRequest.id}`);
    console.log(`📧 Current Email: ${targetRequest.currentEmail}`);
    console.log(`📧 New Email: ${targetRequest.newEmail}`);
    console.log(`📊 Status: ${targetRequest.status}`);

    // Step 2: If not approved, approve it first
    if (targetRequest.status !== 'approved') {
      console.log('\n✅ Step 2: Approving the request first...');
      const approveResponse = await makeRequest(`${API_BASE_URL}/email-change/${REQUEST_ID}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: {
          approvalNotes: 'Approved for testing email processing functionality'
        }
      });

      console.log('Approve Response:', JSON.stringify(approveResponse.data, null, 2));

      if (approveResponse.status !== 200) {
        console.log('❌ Failed to approve request');
        return;
      }
    } else {
      console.log('✅ Request is already approved');
    }

    // Step 3: Process the email change
    console.log('\n🔄 Step 3: Processing the email change...');
    const processResponse = await makeRequest(`${API_BASE_URL}/email-change/${REQUEST_ID}/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: {
        notes: 'Processing email change for testing'
      }
    });

    console.log('Process Response Status:', processResponse.status);
    console.log('Process Response:', JSON.stringify(processResponse.data, null, 2));

    if (processResponse.status === 200) {
      console.log('\n🎉 SUCCESS! Email change processed successfully!');
      console.log('📧 Old Email:', processResponse.data.data.oldEmail);
      console.log('📧 New Email:', processResponse.data.data.newEmail);
      console.log('⏰ Completed At:', processResponse.data.data.completedAt);
      console.log('👤 Processed By:', processResponse.data.data.processedBy.name);
    } else if (processResponse.status === 404) {
      console.log('❌ Processing endpoint not found - function may not be deployed yet');
    } else {
      console.log('❌ Processing failed with status:', processResponse.status);
    }

    // Step 4: Verify the final status
    console.log('\n📋 Step 4: Checking final request status...');
    const finalStatusResponse = await makeRequest(`${API_BASE_URL}/email-change`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const finalRequests = finalStatusResponse.data?.data?.requests || [];
    const finalRequest = finalRequests.find(req => req.id === REQUEST_ID);
    
    if (finalRequest) {
      console.log(`📊 Final Status: ${finalRequest.status}`);
      if (finalRequest.completedAt) {
        console.log(`⏰ Completed At: ${finalRequest.completedAt}`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
console.log('🧪 Testing Email Change Processing Workflow');
console.log('==========================================');
testEmailProcessing(); 