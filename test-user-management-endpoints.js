#!/usr/bin/env node

const https = require('https');
const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');

// Configuration
const API_BASE_URL = 'https://time-api-dev.aerotage.com';
const COGNITO_CLIENT_ID = '148r35u6uultp1rmfdu22i8amb';
const COGNITO_REGION = 'us-east-1';

// Test credentials
const TEST_EMAIL = 'bhardwick@aerotage.com';
const TEST_PASSWORD = 'Aerotage*2025';

/**
 * Get JWT token from Cognito
 */
async function getJwtToken() {
  const client = new CognitoIdentityProviderClient({ region: COGNITO_REGION });
  
  try {
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: TEST_EMAIL,
        PASSWORD: TEST_PASSWORD,
      },
    });

    const response = await client.send(command);
    
    if (response.AuthenticationResult?.AccessToken) {
      return response.AuthenticationResult.AccessToken;
    } else {
      throw new Error('No access token received');
    }
  } catch (error) {
    console.error('❌ Failed to get JWT token:', error.message);
    throw error;
  }
}

/**
 * Make HTTP request with JWT token
 */
function makeRequest(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };

    if (body) {
      const bodyString = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonData,
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

/**
 * Test user management endpoints
 */
async function testUserManagementEndpoints() {
  console.log('🔐 Getting JWT token...');
  
  try {
    const token = await getJwtToken();
    console.log('✅ JWT token obtained successfully');
    
    // Test 1: List users
    console.log('\n📋 Testing GET /users...');
    const usersResponse = await makeRequest('GET', '/users', token);
    console.log(`Status: ${usersResponse.statusCode}`);
    
    if (usersResponse.statusCode === 200) {
      console.log('✅ Users list endpoint working');
      console.log(`Found ${usersResponse.body.data?.users?.length || 0} users`);
      
      // Get the first user ID for testing
      const users = usersResponse.body.data?.users || [];
      if (users.length > 0) {
        const testUserId = users[0].id;
        console.log(`Using user ID for testing: ${testUserId}`);
        
        // Test 2: Get specific user
        console.log('\n👤 Testing GET /users/{id}...');
        const userResponse = await makeRequest('GET', `/users/${testUserId}`, token);
        console.log(`Status: ${userResponse.statusCode}`);
        
        if (userResponse.statusCode === 200) {
          console.log('✅ Get user endpoint working');
          console.log(`User: ${userResponse.body.data?.user?.name} (${userResponse.body.data?.user?.email})`);
        } else {
          console.log('❌ Get user endpoint failed');
          console.log('Response:', JSON.stringify(userResponse.body, null, 2));
        }
        
        // Test 3: Update user (basic info only)
        console.log('\n✏️ Testing PUT /users/{id}...');
        const updateData = {
          preferences: {
            theme: 'dark',
            notifications: true,
            timezone: 'America/New_York'
          }
        };
        
        const updateResponse = await makeRequest('PUT', `/users/${testUserId}`, token, updateData);
        console.log(`Status: ${updateResponse.statusCode}`);
        
        if (updateResponse.statusCode === 200) {
          console.log('✅ Update user endpoint working');
          console.log('Updated preferences successfully');
        } else {
          console.log('❌ Update user endpoint failed');
          console.log('Response:', JSON.stringify(updateResponse.body, null, 2));
        }
      } else {
        console.log('⚠️ No users found to test individual user endpoints');
      }
    } else {
      console.log('❌ Users list endpoint failed');
      console.log('Response:', JSON.stringify(usersResponse.body, null, 2));
    }
    
    // Test 4: Test unauthorized access (without token)
    console.log('\n🚫 Testing unauthorized access...');
    const unauthorizedResponse = await makeRequest('GET', '/users', 'invalid-token');
    console.log(`Status: ${unauthorizedResponse.statusCode}`);
    
    if (unauthorizedResponse.statusCode === 401 || unauthorizedResponse.statusCode === 403) {
      console.log('✅ Authorization working correctly');
    } else {
      console.log('❌ Authorization not working properly');
      console.log('Response:', JSON.stringify(unauthorizedResponse.body, null, 2));
    }
    
    console.log('\n🎉 User management endpoint testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  testUserManagementEndpoints().catch(console.error);
}

module.exports = { testUserManagementEndpoints }; 