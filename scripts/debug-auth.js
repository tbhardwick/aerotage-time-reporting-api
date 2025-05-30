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
 * Main debug function
 */
async function debugAuth() {
  try {
    console.log('🔐 Debug: Getting JWT token...');
    
    // Get authentication token
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    const accessToken = authResult.AccessToken; // MANDATORY: Use AccessToken
    const idToken = authResult.IdToken; // DEBUG ONLY: For comparison purposes
    
    console.log('✅ Tokens obtained successfully');
    console.log('📋 Access Token length:', accessToken.length);
    console.log('📋 ID Token length:', idToken.length);
    
    // Decode tokens to inspect claims
    console.log('\n🔍 Access Token Claims (MANDATORY for API calls):');
    const accessClaims = decodeJWT(accessToken);
    console.log(JSON.stringify(accessClaims, null, 2));
    
    console.log('\n🔍 ID Token Claims (DEBUG ONLY - DO NOT USE for API calls):');
    const idClaims = decodeJWT(idToken);
    console.log(JSON.stringify(idClaims, null, 2));
    
    // Test API endpoints with different tokens
    console.log('\n🧪 Testing API endpoints...');
    
    // Test with Access Token (MANDATORY pattern)
    console.log('\n1. Testing with Access Token (MANDATORY PATTERN):');
    const testWithAccess = await makeRequest(`${API_BASE_URL}/users/${accessClaims.sub}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    console.log('Status:', testWithAccess.status);
    console.log('Response:', testWithAccess.data);
    
    // Test with ID Token (DEBUGGING ONLY - should NOT be used)
    console.log('\n2. Testing with ID Token (DEBUG ONLY - FORBIDDEN in production):');
    const testWithId = await makeRequest(`${API_BASE_URL}/users/${idClaims.sub}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });
    console.log('Status:', testWithId.status);
    console.log('Response:', testWithId.data);
    
    console.log('\n⚠️  REMEMBER: Always use AccessToken for production API calls!');
    console.log('✅ MANDATORY: const token = authResult.AccessToken;');
    
    // Test health endpoint (should not require auth)
    console.log('\n3. Testing health endpoint (no auth):');
    const healthTest = await makeRequest(`${API_BASE_URL}/health`);
    console.log('Status:', healthTest.status);
    console.log('Response:', healthTest.data);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run debug
debugAuth(); 