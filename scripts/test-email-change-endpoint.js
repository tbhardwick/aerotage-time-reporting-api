#!/usr/bin/env node

const { getCognitoToken } = require('./get-cognito-token');
const https = require('https');

const API_BASE_URL = 'https://time-api-dev.aerotage.com';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = responseData ? JSON.parse(responseData) : {};
          resolve({
            statusCode: res.statusCode,
            data: parsedData,
            headers: res.headers
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: responseData,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testEmailChangeEndpoint() {
  try {
    console.log('🧪 Testing Email Change Endpoint...\n');
    
    // Get authentication token
    console.log('1. Getting authentication token...');
    const authResult = await getCognitoToken('bhardwick@aerotage.com', 'Aerotage*2025');
    
    if (!authResult.success) {
      console.log('❌ Authentication failed:', authResult.error);
      return;
    }
    
    const token = authResult.AccessToken;
    console.log('✅ Authentication successful\n');
    
    // Test the problematic endpoint
    console.log('2. Testing GET /email-change with query parameters...');
    const testUrl = `${API_BASE_URL}/email-change?status=pending_verification&limit=1&sortBy=requestedAt&sortOrder=desc`;
    
    const response = await makeRequest(testUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`Status Code: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      console.log('✅ SUCCESS: Endpoint is working correctly!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } else if (response.statusCode === 500) {
      console.log('❌ STILL FAILING: 500 Internal Server Error');
      console.log('Response:', response.data);
    } else {
      console.log(`⚠️  Unexpected status code: ${response.statusCode}`);
      console.log('Response:', response.data);
    }
    
  } catch (error) {
    console.log('❌ Test failed with error:', error.message);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testEmailChangeEndpoint();
}

module.exports = { testEmailChangeEndpoint }; 