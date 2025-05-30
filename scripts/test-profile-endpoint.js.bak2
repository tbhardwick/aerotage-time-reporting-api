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
 * Test profile endpoints that Settings page calls
 */
async function testProfileEndpoints() {
  try {
    console.log('👤 Testing Profile Endpoints (Settings Page Dependencies)...');
    
    // Get authentication token
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    const accessToken = authResult.AccessToken;
    
    console.log('✅ JWT token obtained successfully');
    console.log('🔗 Testing profile endpoints...\n');
    
    const userId = '0408a498-40c1-7071-acc9-90665ef117c3';
    
    // Test endpoints that Settings page likely calls
    const profileEndpoints = [
      {
        name: 'User Profile',
        url: `${API_BASE_URL}/users/${userId}/profile`,
        description: 'Main user profile data'
      },
      {
        name: 'User Preferences', 
        url: `${API_BASE_URL}/users/${userId}/preferences`,
        description: 'User preferences and settings'
      },
      {
        name: 'Security Settings',
        url: `${API_BASE_URL}/users/${userId}/security-settings`, 
        description: 'Security configuration'
      },
      {
        name: 'User Sessions',
        url: `${API_BASE_URL}/users/${userId}/sessions`,
        description: 'Active user sessions'
      },
      {
        name: 'Current User',
        url: `${API_BASE_URL}/users/${userId}`,
        description: 'Current user data'
      }
    ];
    
    for (const endpoint of profileEndpoints) {
      console.log(`🧪 Testing: ${endpoint.name}`);
      console.log(`📋 Description: ${endpoint.description}`);
      console.log(`🔗 URL: ${endpoint.url}`);
      
      try {
        const response = await makeRequest(endpoint.url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        console.log(`✅ Status: ${response.status}`);
        if (response.status === 200) {
          console.log(`✅ Success: ${endpoint.name} endpoint working`);
          if (response.data.success) {
            console.log(`📊 Data keys: ${Object.keys(response.data.data || {}).join(', ')}`);
          }
        } else {
          console.log(`❌ Failed: ${endpoint.name} endpoint returned ${response.status}`);
          console.log(`❌ Error: ${JSON.stringify(response.data, null, 2)}`);
        }
        
      } catch (error) {
        console.log(`❌ Network Error: ${endpoint.name} - ${error.message}`);
      }
      
      console.log(''); // Empty line for readability
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
testProfileEndpoints(); 