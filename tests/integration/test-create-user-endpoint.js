#!/usr/bin/env node

const { getCognitoToken } = require('./scripts/get-cognito-token');
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
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
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
 * Test create user endpoint
 */
async function testCreateUserEndpoint() {
  try {
    console.log('🧪 Testing Create User Endpoint\n');
    
    // Get authentication token
    console.log('🔐 Getting JWT token...');
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    const token = authResult.token;
    console.log('✅ JWT token obtained successfully\n');

    // Test creating a new user
    console.log('👤 Testing POST /users (Create User)...');
    const newUserData = {
      email: `test-user-${Date.now()}@example.com`,
      name: 'Test User',
      role: 'employee',
      department: 'Engineering',
      jobTitle: 'Software Developer',
      hourlyRate: 75.00,
      permissions: {
        features: ['time-tracking', 'reports'],
        projects: []
      },
      contactInfo: {
        phone: '+1-555-0123',
        address: '123 Test St, Test City, TC 12345'
      }
    };

    const createResponse = await makeRequest(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: newUserData
    });

    console.log(`Status: ${createResponse.status}`);
    console.log('Response:', JSON.stringify(createResponse.data, null, 2));

    if (createResponse.status === 201 && createResponse.data.success) {
      console.log('✅ SUCCESS: Create user endpoint is working!');
      console.log(`📧 Created user: ${createResponse.data.data.email}`);
      console.log(`🆔 User ID: ${createResponse.data.data.id}`);
      console.log(`👤 Name: ${createResponse.data.data.name}`);
      console.log(`🏢 Role: ${createResponse.data.data.role}`);
    } else {
      console.log('❌ FAILED: Create user endpoint returned an error');
    }

    // Test validation by trying to create a user with invalid data
    console.log('\n🔍 Testing validation with invalid data...');
    const invalidUserData = {
      email: 'invalid-email',
      name: 'A', // Too short
      role: 'invalid-role',
      hourlyRate: -10 // Negative rate
    };

    const validationResponse = await makeRequest(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: invalidUserData
    });

    console.log(`Validation Test Status: ${validationResponse.status}`);
    if (validationResponse.status === 400) {
      console.log('✅ SUCCESS: Validation is working correctly');
    } else {
      console.log('❌ FAILED: Validation should have rejected invalid data');
      console.log('Response:', JSON.stringify(validationResponse.data, null, 2));
    }

    // Test duplicate email prevention
    console.log('\n🔍 Testing duplicate email prevention...');
    const duplicateResponse = await makeRequest(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: {
        email: 'bhardwick@aerotage.com', // Existing email
        name: 'Duplicate User',
        role: 'employee'
      }
    });

    console.log(`Duplicate Test Status: ${duplicateResponse.status}`);
    if (duplicateResponse.status === 409) {
      console.log('✅ SUCCESS: Duplicate email prevention is working');
    } else {
      console.log('❌ FAILED: Should have prevented duplicate email');
      console.log('Response:', JSON.stringify(duplicateResponse.data, null, 2));
    }

    console.log('\n🏁 Create user endpoint testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCreateUserEndpoint(); 