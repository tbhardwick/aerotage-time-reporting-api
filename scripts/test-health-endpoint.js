#!/usr/bin/env node

const https = require('https');

// Configuration
const API_BASE_URL = 'https://time-api-dev.aerotage.com';

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
        'Origin': 'http://localhost:3000', // Simulate frontend origin
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ 
            status: res.statusCode, 
            headers: res.headers,
            data: jsonData 
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            headers: res.headers,
            data: data 
          });
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
 * Test health endpoint
 */
async function testHealthEndpoint() {
  try {
    console.log('🏥 Testing Health Endpoint...\n');

    // Test GET request
    console.log('📋 Testing GET /health...');
    const getResponse = await makeRequest(`${API_BASE_URL}/health`, {
      method: 'GET'
    });

    console.log(`Status: ${getResponse.status}`);
    console.log('CORS Headers:');
    console.log(`  Access-Control-Allow-Origin: ${getResponse.headers['access-control-allow-origin']}`);
    console.log(`  Access-Control-Allow-Methods: ${getResponse.headers['access-control-allow-methods']}`);
    console.log(`  Access-Control-Allow-Headers: ${getResponse.headers['access-control-allow-headers']}`);
    
    if (getResponse.status === 200) {
      console.log('✅ GET /health successful');
      console.log('Response data:', JSON.stringify(getResponse.data, null, 2));
    } else {
      console.log('❌ GET /health failed');
      console.log('Response:', getResponse.data);
    }

    console.log('\n📋 Testing OPTIONS /health (preflight)...');
    
    // Test OPTIONS request (preflight)
    const optionsResponse = await makeRequest(`${API_BASE_URL}/health`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type, X-Requested-With'
      }
    });

    console.log(`Status: ${optionsResponse.status}`);
    console.log('CORS Headers:');
    console.log(`  Access-Control-Allow-Origin: ${optionsResponse.headers['access-control-allow-origin']}`);
    console.log(`  Access-Control-Allow-Methods: ${optionsResponse.headers['access-control-allow-methods']}`);
    console.log(`  Access-Control-Allow-Headers: ${optionsResponse.headers['access-control-allow-headers']}`);

    if (optionsResponse.status === 200) {
      console.log('✅ OPTIONS /health successful');
    } else {
      console.log('❌ OPTIONS /health failed');
      console.log('Response:', optionsResponse.data);
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`GET /health: ${getResponse.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`OPTIONS /health: ${optionsResponse.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
    
    const corsWorking = getResponse.headers['access-control-allow-origin'] === '*' &&
                       getResponse.headers['access-control-allow-methods'] &&
                       getResponse.headers['access-control-allow-headers'];
    
    console.log(`CORS Configuration: ${corsWorking ? '✅ WORKING' : '❌ NEEDS ATTENTION'}`);

    if (corsWorking) {
      console.log('\n🎉 Health endpoint is ready for frontend integration!');
      console.log('Frontend can now access: https://time-api-dev.aerotage.com/health');
    } else {
      console.log('\n⚠️  CORS headers may need adjustment for frontend integration.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
testHealthEndpoint(); 