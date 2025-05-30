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
 * Test user listing
 */
async function testListUsers(accessToken) {
  console.log(`\n👥 TESTING USER LISTING`);
  console.log('='.repeat(60));

  try {
    const response = await makeRequest(`${API_BASE_URL}/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const users = response.body.data?.users || [];
      console.log(`✅ Users retrieved successfully`);
      console.log(`📊 Total users: ${users.length}`);

      users.forEach((user, index) => {
        console.log(`\n👤 User ${index + 1}:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.name || 'N/A'}`);
        console.log(`   Email: ${user.email || 'N/A'}`);
        console.log(`   Role: ${user.role || 'N/A'}`);
        console.log(`   Active: ${user.isActive ? '✅' : '❌'}`);
      });

      return {
        success: true,
        users
      };
    } else {
      console.log(`❌ User listing failed:`, response.body);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ User listing error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test get specific user
 */
async function testGetUser(accessToken, userId) {
  console.log(`\n👤 TESTING GET USER`);
  console.log('='.repeat(60));

  console.log(`📤 Getting user: ${userId}`);

  try {
    const response = await makeRequest(`${API_BASE_URL}/users/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const user = response.body.data?.user;
      console.log(`✅ User retrieved successfully!`);
      console.log(`👤 Name: ${user?.name || 'N/A'}`);
      console.log(`📧 Email: ${user?.email || 'N/A'}`);
      console.log(`🎭 Role: ${user?.role || 'N/A'}`);
      console.log(`🏢 Department: ${user?.department || 'N/A'}`);
      
      return {
        success: true,
        user
      };
    } else {
      console.log(`❌ Get user failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Get user error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test update user
 */
async function testUpdateUser(accessToken, userId) {
  console.log(`\n✏️ TESTING UPDATE USER`);
  console.log('='.repeat(60));

  const updateData = {
    preferences: {
      theme: 'dark',
      notifications: true,
      timezone: 'America/New_York'
    }
  };

  console.log(`📤 Updating user ${userId}:`, updateData);

  try {
    const response = await makeRequest(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: updateData
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const user = response.body.data?.user;
      console.log(`✅ User updated successfully!`);
      console.log(`⚙️ New preferences:`, user?.preferences);
      
      return {
        success: true,
        user
      };
    } else {
      console.log(`❌ User update failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ User update error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Complete test flow for User Management
 */
async function runUserManagementTests() {
  console.log(`\n🚀 TESTING USER MANAGEMENT ENDPOINTS`);
  console.log('='.repeat(80));
  console.log(`📧 Test User: ${TEST_USER.email}`);
  console.log(`🕐 Test Time: ${new Date().toISOString()}`);
  console.log(`🌐 API Base URL: ${API_BASE_URL}`);

  const testResults = {
    authentication: false,
    listUsers: false,
    getUser: false,
    updateUser: false
  };

  try {
    // Step 1: Authenticate
    console.log(`\n🔐 Step 1: Authenticate with Cognito`);
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    
    if (!authResult.success) {
      console.log(`❌ Authentication failed: ${authResult.error}`);
      return testResults;
    }

    const token = authResult.token;
    const userId = authResult.userId;
    console.log(`✅ Authentication successful for user: ${userId}`);
    testResults.authentication = true;

    // Step 2: List Users
    console.log(`\n👥 Step 2: List Users`);
    const listUsersResult = await testListUsers(token);
    testResults.listUsers = listUsersResult.success;

    // Step 3: Get Current User
    console.log(`\n👤 Step 3: Get Current User`);
    const getUserResult = await testGetUser(token, userId);
    testResults.getUser = getUserResult.success;

    // Step 4: Update Current User
    console.log(`\n✏️ Step 4: Update Current User`);
    const updateUserResult = await testUpdateUser(token, userId);
    testResults.updateUser = updateUserResult.success;

  } catch (error) {
    console.error(`\n❌ TEST FAILED WITH ERROR:`, error);
  }

  // Summary
  console.log(`\n📊 USER MANAGEMENT TEST SUMMARY`);
  console.log('='.repeat(80));
  
  const testSteps = [
    { name: 'Authentication', result: testResults.authentication },
    { name: 'List Users', result: testResults.listUsers },
    { name: 'Get User', result: testResults.getUser },
    { name: 'Update User', result: testResults.updateUser }
  ];

  testSteps.forEach(step => {
    const status = step.result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${step.name}`);
  });

  const passedTests = testSteps.filter(step => step.result).length;
  const totalTests = testSteps.length;
  
  console.log(`\n🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log(`🎉 ALL USER MANAGEMENT ENDPOINTS ARE WORKING CORRECTLY!`);
  } else {
    console.log(`🚨 Some tests failed. Please review the output above for details.`);
  }

  return testResults;
}

// CLI interface
if (require.main === module) {
  console.log(`
🧪 User Management Endpoint Test Suite

This script will test all user management endpoints:
- List Users (GET /users)
- Get User (GET /users/{id})
- Update User (PUT /users/{id})

Using test credentials:
- Email: ${TEST_USER.email}
- API: ${API_BASE_URL}

Starting tests...
`);

  runUserManagementTests();
}

module.exports = {
  runUserManagementTests,
  testListUsers,
  testGetUser,
  testUpdateUser
}; 