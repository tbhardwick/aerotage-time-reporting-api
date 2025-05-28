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
 * Test with session creation
 */
async function testWithSession() {
  console.log('🔐 Getting JWT token...');
  
  try {
    const token = await getJwtToken();
    console.log('✅ JWT token obtained successfully');
    
    // First, let's decode the token to see what user ID we have
    const tokenParts = token.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
    const userId = payload.sub;
    
    console.log(`👤 User ID: ${userId}`);
    
    // Step 1: Create a session
    console.log('\n🔗 Creating session...');
    const sessionData = {
      deviceInfo: {
        userAgent: 'Test Script',
        ipAddress: '127.0.0.1',
        deviceType: 'desktop'
      },
      sessionTimeout: 480 // 8 hours
    };
    
    const sessionResponse = await makeRequest('POST', `/users/${userId}/sessions`, token, sessionData);
    console.log(`Session creation status: ${sessionResponse.statusCode}`);
    
    if (sessionResponse.statusCode === 200 || sessionResponse.statusCode === 201) {
      console.log('✅ Session created successfully');
      console.log('Session ID:', sessionResponse.body.data?.session?.sessionId);
    } else {
      console.log('❌ Session creation failed');
      console.log('Response:', JSON.stringify(sessionResponse.body, null, 2));
    }
    
    // Step 2: Test user management endpoints
    console.log('\n📋 Testing GET /users...');
    const usersResponse = await makeRequest('GET', '/users', token);
    console.log(`Status: ${usersResponse.statusCode}`);
    
    if (usersResponse.statusCode === 200) {
      console.log('✅ Users list endpoint working');
      console.log(`Found ${usersResponse.body.data?.users?.length || 0} users`);
      
      // Show first few users
      const users = usersResponse.body.data?.users || [];
      users.slice(0, 3).forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.name} (${user.email}) - Role: ${user.role}`);
      });
      
      // Test getting own user profile
      console.log('\n👤 Testing GET /users/{id} (own profile)...');
      const userResponse = await makeRequest('GET', `/users/${userId}`, token);
      console.log(`Status: ${userResponse.statusCode}`);
      
      if (userResponse.statusCode === 200) {
        console.log('✅ Get own user profile working');
        const user = userResponse.body.data?.user;
        console.log(`User: ${user?.name} (${user?.email}) - Role: ${user?.role}`);
      } else {
        console.log('❌ Get user profile failed');
        console.log('Response:', JSON.stringify(userResponse.body, null, 2));
      }
      
    } else {
      console.log('❌ Users list endpoint failed');
      console.log('Response:', JSON.stringify(usersResponse.body, null, 2));
    }
    
    console.log('\n🎉 Testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  testWithSession().catch(console.error);
}

module.exports = { testWithSession }; 