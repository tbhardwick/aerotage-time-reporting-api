#!/usr/bin/env node

const { getCognitoToken } = require('./get-cognito-token');
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
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
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
 * Decode JWT token to inspect claims
 */
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Test session creation endpoint (should work with bootstrap)
 */
async function testSessionCreation() {
  try {
    console.log('🔐 Testing Session Creation Endpoint...');
    
    // Get authentication token
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    const accessToken = authResult.AccessToken;
    
    console.log('✅ JWT token obtained successfully');
    
    // Decode token to get user ID
    const accessClaims = decodeJWT(accessToken);
    const userId = accessClaims.sub;
    
    console.log(`📋 User ID: ${userId}`);
    
    // Test session creation endpoint (should work with FORCE_BOOTSTRAP)
    console.log('\n🧪 Testing session creation endpoint...');
    
    const sessionData = {
      userAgent: 'Test-Agent/1.0',
      loginTime: new Date().toISOString()
    };
    
    const sessionResponse = await makeRequest(`${API_BASE_URL}/users/${userId}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Test-Agent/1.0'
      },
      body: sessionData
    });
    
    console.log('Session Creation Response:');
    console.log('Status:', sessionResponse.status);
    console.log('Response:', JSON.stringify(sessionResponse.data, null, 2));
    
    if (sessionResponse.status === 201) {
      console.log('\n✅ SUCCESS: Session created! Now testing other endpoints...');
      
      // Test user endpoint after session creation
      const userResponse = await makeRequest(`${API_BASE_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      console.log('\nUser Endpoint Response:');
      console.log('Status:', userResponse.status);
      console.log('Response:', JSON.stringify(userResponse.data, null, 2));
      
    } else {
      console.log('\n❌ FAILED: Session creation failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testSessionCreation(); 