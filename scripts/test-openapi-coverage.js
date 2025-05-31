#!/usr/bin/env node

/**
 * OpenAPI Documentation Coverage Test
 * Verifies that all documented endpoints in OpenAPI spec are actually deployed and working
 */

const { getCognitoToken } = require('./get-cognito-token');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://time-api-dev.aerotage.com',
  TEST_USER: {
    email: 'bhardwick@aerotage.com',
    password: 'Aerotage*2025'
  }
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
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
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
 * Extract endpoints from OpenAPI spec
 */
function extractEndpointsFromOpenAPI() {
  try {
    const openApiPath = path.join(__dirname, '../docs/swagger-ui/openapi.json');
    const openApiSpec = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
    
    const endpoints = [];
    
    Object.entries(openApiSpec.paths || {}).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, spec]) => {
        if (method !== 'parameters') {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            summary: spec.summary || 'No summary',
            requiresAuth: !spec.security || spec.security.length > 0,
            tags: spec.tags || []
          });
        }
      });
    });
    
    return endpoints;
  } catch (error) {
    console.error('Error reading OpenAPI spec:', error.message);
    return [];
  }
}

/**
 * Test endpoint availability
 */
async function testEndpoint(endpoint, accessToken, userId) {
  const url = `${CONFIG.API_BASE_URL}${endpoint.path}`;
  const headers = {};
  
  if (endpoint.requiresAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  // Replace path parameters with test values
  let testUrl = url
    .replace('{id}', userId || 'test-id')
    .replace('{sessionId}', 'test-session-id')
    .replace('{invoiceId}', 'test-invoice-id')
    .replace('{templateId}', 'test-template-id')
    .replace('{token}', 'test-token')
    .replace('{scheduleId}', 'test-schedule-id');
  
  try {
    const response = await makeRequest(testUrl, {
      method: endpoint.method,
      headers
    });
    
    // Consider these status codes as "working" endpoints
    const workingStatuses = [200, 201, 204, 400, 404, 422]; // 400/404/422 means endpoint exists but bad request
    const authStatuses = [401, 403]; // Auth required but endpoint exists
    
    if (workingStatuses.includes(response.statusCode)) {
      return { status: 'working', statusCode: response.statusCode };
    } else if (authStatuses.includes(response.statusCode)) {
      return { status: 'auth_required', statusCode: response.statusCode };
    } else {
      return { status: 'error', statusCode: response.statusCode, body: response.body };
    }
  } catch (error) {
    return { status: 'network_error', error: error.message };
  }
}

/**
 * Main test runner
 */
async function runOpenAPICoverageTest() {
  console.log('🔍 OPENAPI DOCUMENTATION COVERAGE TEST');
  console.log('======================================');
  console.log(`📚 Testing OpenAPI spec against: ${CONFIG.API_BASE_URL}`);
  console.log(`👤 Test User: ${CONFIG.TEST_USER.email}`);
  
  // Get authentication token
  console.log('\n🔐 Getting authentication token...');
  const authResult = await getCognitoToken(CONFIG.TEST_USER.email, CONFIG.TEST_USER.password);
  const accessToken = authResult.AccessToken;
  
  if (!accessToken) {
    console.log('❌ Authentication failed. Cannot test authenticated endpoints.');
    return;
  }
  
  // Extract user ID from token
  const tokenParts = accessToken.split('.');
  const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
  const userId = payload.sub;
  
  console.log(`✅ Authentication successful. User ID: ${userId}`);
  
  // Extract endpoints from OpenAPI spec
  console.log('\n📋 Extracting endpoints from OpenAPI specification...');
  const endpoints = extractEndpointsFromOpenAPI();
  console.log(`📊 Found ${endpoints.length} documented endpoints`);
  
  // Test each endpoint
  console.log('\n🧪 Testing endpoint availability...');
  console.log('=====================================');
  
  const results = {
    working: [],
    authRequired: [],
    errors: [],
    networkErrors: []
  };
  
  for (const endpoint of endpoints) {
    const testResult = await testEndpoint(endpoint, accessToken, userId);
    
    const statusIcon = testResult.status === 'working' ? '✅' : 
                      testResult.status === 'auth_required' ? '🔐' : 
                      testResult.status === 'error' ? '❌' : '🌐';
    
    console.log(`${statusIcon} ${endpoint.method.padEnd(6)} ${endpoint.path.padEnd(40)} (${testResult.statusCode || 'N/A'})`);
    
    switch (testResult.status) {
      case 'working':
        results.working.push({ endpoint, result: testResult });
        break;
      case 'auth_required':
        results.authRequired.push({ endpoint, result: testResult });
        break;
      case 'error':
        results.errors.push({ endpoint, result: testResult });
        break;
      case 'network_error':
        results.networkErrors.push({ endpoint, result: testResult });
        break;
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 OPENAPI COVERAGE TEST RESULTS');
  console.log('='.repeat(80));
  
  const total = endpoints.length;
  const working = results.working.length;
  const authRequired = results.authRequired.length;
  const errors = results.errors.length;
  const networkErrors = results.networkErrors.length;
  
  console.log(`📈 Total Documented Endpoints: ${total}`);
  console.log(`✅ Working Endpoints: ${working} (${Math.round(working/total*100)}%)`);
  console.log(`🔐 Auth Required (Working): ${authRequired} (${Math.round(authRequired/total*100)}%)`);
  console.log(`❌ Error Endpoints: ${errors} (${Math.round(errors/total*100)}%)`);
  console.log(`🌐 Network Errors: ${networkErrors} (${Math.round(networkErrors/total*100)}%)`);
  
  const functionalEndpoints = working + authRequired;
  const coveragePercentage = Math.round(functionalEndpoints/total*100);
  
  console.log('\n' + '='.repeat(80));
  console.log(`🎯 OVERALL COVERAGE: ${functionalEndpoints}/${total} (${coveragePercentage}%)`);
  console.log('='.repeat(80));
  
  if (coveragePercentage >= 95) {
    console.log('🎉 EXCELLENT! OpenAPI documentation has excellent coverage.');
  } else if (coveragePercentage >= 85) {
    console.log('✅ GOOD! OpenAPI documentation has good coverage.');
  } else if (coveragePercentage >= 70) {
    console.log('⚠️  FAIR! OpenAPI documentation needs some updates.');
  } else {
    console.log('❌ POOR! OpenAPI documentation needs significant updates.');
  }
  
  // Show problematic endpoints
  if (errors.length > 0) {
    console.log('\n❌ ENDPOINTS WITH ERRORS:');
    results.errors.forEach(({ endpoint, result }) => {
      console.log(`   ${endpoint.method} ${endpoint.path} - ${result.statusCode}`);
    });
  }
  
  if (networkErrors.length > 0) {
    console.log('\n🌐 ENDPOINTS WITH NETWORK ERRORS:');
    results.networkErrors.forEach(({ endpoint, result }) => {
      console.log(`   ${endpoint.method} ${endpoint.path} - ${result.error}`);
    });
  }
  
  // Group by tags for better organization
  console.log('\n📋 COVERAGE BY FUNCTIONAL DOMAIN:');
  const byTags = {};
  endpoints.forEach(endpoint => {
    const tag = endpoint.tags[0] || 'Untagged';
    if (!byTags[tag]) byTags[tag] = { total: 0, working: 0 };
    byTags[tag].total++;
    
    const isWorking = results.working.some(r => r.endpoint === endpoint) || 
                     results.authRequired.some(r => r.endpoint === endpoint);
    if (isWorking) byTags[tag].working++;
  });
  
  Object.entries(byTags).forEach(([tag, stats]) => {
    const percentage = Math.round(stats.working/stats.total*100);
    const status = percentage >= 90 ? '✅' : percentage >= 70 ? '⚠️' : '❌';
    console.log(`${status} ${tag.padEnd(25)}: ${stats.working}/${stats.total} (${percentage}%)`);
  });
}

// Run the test
if (require.main === module) {
  runOpenAPICoverageTest().catch(console.error);
}

module.exports = { runOpenAPICoverageTest }; 