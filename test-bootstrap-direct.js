#!/usr/bin/env node

const https = require('https');

const API_BASE_URL = 'https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev';
const TEST_USER_ID = '0408a498-40c1-7071-acc9-90665ef117c3';

// You'll need to get this from the browser developer tools after logging in
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual JWT token

function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Bootstrap-Test-Script/1.0',
        ...headers
      }
    };

    if (data && method !== 'GET') {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    console.log(`🔍 Testing: ${method} ${url.href}`);
    console.log(`📋 Headers:`, options.headers);
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const result = {
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: responseData
        };
        
        try {
          result.parsedBody = JSON.parse(responseData);
        } catch (e) {
          result.parsedBody = null;
        }
        
        resolve(result);
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testBootstrapSession() {
  console.log('🚀 Testing Bootstrap Session Creation');
  console.log('=====================================');
  
  if (JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    console.log('❌ ERROR: Please replace JWT_TOKEN with actual token from browser dev tools');
    console.log('   1. Login to the frontend app');
    console.log('   2. Open browser dev tools -> Application -> Local Storage');
    console.log('   3. Or check Network tab for Authorization header');
    console.log('   4. Replace JWT_TOKEN in this script with the actual token');
    return;
  }
  
  try {
    // Test session creation with JWT token
    const sessionData = {
      userAgent: 'Bootstrap-Test-Script/1.0',
      loginTime: new Date().toISOString()
    };
    
    const result = await makeRequest(
      `/users/${TEST_USER_ID}/sessions`,
      'POST',
      sessionData,
      {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    );
    
    console.log(`\n📊 Response Status: ${result.statusCode} ${result.statusMessage}`);
    console.log(`📋 Response Headers:`, result.headers);
    
    if (result.statusCode === 200 || result.statusCode === 201) {
      console.log('🎉 SUCCESS: Session creation worked!');
      console.log('✅ Bootstrap functionality is working correctly');
      if (result.parsedBody) {
        console.log('📦 Response Data:', JSON.stringify(result.parsedBody, null, 2));
      }
    } else if (result.statusCode === 403) {
      console.log('❌ 403 Forbidden: Authorizer is still blocking requests');
      console.log('🔍 This suggests bootstrap logic is not working or cache not cleared');
      if (result.body) {
        console.log('📝 Error Details:', result.body);
      }
    } else if (result.statusCode === 401) {
      console.log('❌ 401 Unauthorized: JWT token issue');
      console.log('🔍 Token might be expired or invalid');
    } else {
      console.log(`❌ Unexpected status: ${result.statusCode}`);
      if (result.body) {
        console.log('📝 Response Body:', result.body);
      }
    }
    
  } catch (error) {
    console.log('❌ NETWORK ERROR:', error.message);
    console.log('🔍 This could indicate CORS or network connectivity issues');
  }
}

async function testSimpleEndpoint() {
  console.log('\n🔍 Testing Simple Endpoint (without auth)');
  console.log('==========================================');
  
  try {
    const result = await makeRequest('/users');
    
    console.log(`📊 Response Status: ${result.statusCode} ${result.statusMessage}`);
    
    if (result.statusCode === 401 || result.statusCode === 403) {
      console.log('✅ Good: API Gateway is working and requiring authentication');
    } else {
      console.log('🔍 Unexpected response for unauthenticated request');
    }
    
  } catch (error) {
    console.log('❌ NETWORK ERROR:', error.message);
  }
}

async function main() {
  await testSimpleEndpoint();
  await testBootstrapSession();
  
  console.log('\n📋 Next Steps:');
  console.log('1. If you see 403 errors, the bootstrap fix may not be deployed');
  console.log('2. If you see network errors, check API Gateway configuration');
  console.log('3. If you see JWT errors, get fresh token from browser');
  console.log('4. If it works, try logging in through the frontend app');
}

if (require.main === module) {
  main().catch(console.error);
} 