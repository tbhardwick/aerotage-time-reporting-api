#!/usr/bin/env node

const { getCognitoToken } = require('./scripts/get-cognito-token');
const https = require('https');

// Configuration
const API_BASE_URL = 'https://time-api-dev.aerotage.com';
const TEST_USER = {
  email: 'bhardwick@aerotage.com',
  password: 'Aerotage*2025'
};

// Tokens from the previous test
const VERIFICATION_TOKENS = {
  current: '0af09368ae5119016e6e299c9b264b59d4a40604b386b96d913abbbfa17dd041',
  new: '8ab94160939521abfb4781f1b58cd7cbc3bb2090c3fc49a997a980faeb07968b'
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
          const jsonData = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: jsonData });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
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

async function testEmailVerification() {
  try {
    console.log('🔐 Getting JWT token...');
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    const accessToken = authResult.AccessToken;
    console.log('✅ JWT token obtained successfully');

    // Test current email verification
    console.log('\n📧 Testing current email verification...');
    const currentEmailResponse = await makeRequest(`${API_BASE_URL}/email-change/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: {
        token: VERIFICATION_TOKENS.current,
        emailType: 'current'
      }
    });

    console.log('📡 Current Email Verification Response:', currentEmailResponse.statusCode);
    console.log('📋 Response Body:', JSON.stringify(currentEmailResponse.body, null, 2));

    // Test new email verification
    console.log('\n📧 Testing new email verification...');
    const newEmailResponse = await makeRequest(`${API_BASE_URL}/email-change/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: {
        token: VERIFICATION_TOKENS.new,
        emailType: 'new'
      }
    });

    console.log('📡 New Email Verification Response:', newEmailResponse.statusCode);
    console.log('📋 Response Body:', JSON.stringify(newEmailResponse.body, null, 2));

    // Check final status
    console.log('\n📋 Checking final request status...');
    const listResponse = await makeRequest(`${API_BASE_URL}/email-change`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log('📡 List Response:', listResponse.statusCode);
    if (listResponse.body.success && listResponse.body.data.requests.length > 0) {
      const request = listResponse.body.data.requests[0];
      console.log('📊 Final Status:', request.status);
      console.log('📧 Current Email Verified:', request.currentEmailVerified);
      console.log('📧 New Email Verified:', request.newEmailVerified);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testEmailVerification(); 