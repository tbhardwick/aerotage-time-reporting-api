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
 * Test invoices endpoint specifically
 */
async function testInvoicesEndpoint() {
  try {
    console.log('🧾 Testing Invoices Endpoint...');
    
    // Get authentication token
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    const accessToken = authResult.AccessToken;
    
    console.log('✅ JWT token obtained successfully');
    console.log('🔗 Testing endpoint:', `${API_BASE_URL}/invoices`);
    
    // Test invoices endpoint
    const response = await makeRequest(`${API_BASE_URL}/invoices`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log('\n📊 Invoices Endpoint Response:');
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.status !== 200) {
      console.log('\n❌ FAILED: Invoices endpoint returned error');
      
      // Test other working endpoints for comparison
      console.log('\n🔍 Testing working endpoints for comparison...');
      
      const projectsResponse = await makeRequest(`${API_BASE_URL}/projects`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      console.log('\n📋 Projects Endpoint Response:');
      console.log('Status:', projectsResponse.status);
      console.log('Response:', JSON.stringify(projectsResponse.data, null, 2));
      
    } else {
      console.log('\n✅ SUCCESS: Invoices endpoint working correctly');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testInvoicesEndpoint(); 