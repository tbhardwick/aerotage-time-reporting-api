#!/usr/bin/env node

const { getCognitoToken } = require('./get-cognito-token');
const https = require('https');
const { URL } = require('url');

// Configuration using MANDATORY patterns
const CONFIG = {
  API_BASE_URL: 'https://time-api-dev.aerotage.com',
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

async function testCreateTimeEntry(accessToken) {
  console.log('\n📝 Testing: Create Time Entry');
  
  const timeEntryData = {
    projectId: TEST_PROJECT_ID,
    description: 'Test time entry from automated script',
    date: new Date().toISOString().split('T')[0],
    duration: 120,
    isBillable: true,
    tags: ['testing', 'automation'],
    notes: 'Created by test script'
  };

  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
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

async function testListTimeEntries(accessToken) {
  console.log('\n📋 Testing: List Time Entries');
  
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries?limit=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      console.log('✅ Time entries listed successfully');
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

async function runAllTests() {
  console.log('🚀 Starting Time Entry API Tests with MANDATORY Auth Pattern');
  console.log('=============================================================');
  
  const results = {
    authentication: false,
    createTimeEntry: false,
    listTimeEntries: false
  };

  try {
    // Step 1: Authenticate using MANDATORY pattern
    console.log('🔐 Step 1: Authenticate using MANDATORY pattern');
    const authResult = await getCognitoToken(CONFIG.TEST_USER.email, CONFIG.TEST_USER.password);
    const accessToken = authResult.AccessToken; // MANDATORY: Use AccessToken only
    
    console.log('✅ Authentication successful with standardized pattern');
    results.authentication = true;

    // Step 2: Create time entry
    const timeEntryId = await testCreateTimeEntry(accessToken);
    results.createTimeEntry = !!timeEntryId;

    // Step 3: List time entries
    results.listTimeEntries = await testListTimeEntries(accessToken);

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
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, CONFIG };
