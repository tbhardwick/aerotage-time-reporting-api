#!/usr/bin/env node

/**
 * Comprehensive Endpoint Testing Script
 * Tests all major functional domains of the Aerotage Time Reporting API
 */

const { getCognitoToken } = require('./get-cognito-token');
const https = require('https');

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://time-api-dev.aerotage.com',
  TEST_USER: {
    email: 'bhardwick@aerotage.com',
    password: 'Aerotage*2025'
  }
};

// Test results tracking
const testResults = {
  authentication: { passed: 0, failed: 0, tests: [] },
  health: { passed: 0, failed: 0, tests: [] },
  users: { passed: 0, failed: 0, tests: [] },
  userProfile: { passed: 0, failed: 0, tests: [] },
  userPreferences: { passed: 0, failed: 0, tests: [] },
  userSessions: { passed: 0, failed: 0, tests: [] },
  userInvitations: { passed: 0, failed: 0, tests: [] },
  projects: { passed: 0, failed: 0, tests: [] },
  clients: { passed: 0, failed: 0, tests: [] },
  timeEntries: { passed: 0, failed: 0, tests: [] },
  reports: { passed: 0, failed: 0, tests: [] },
  analytics: { passed: 0, failed: 0, tests: [] },
  invoices: { passed: 0, failed: 0, tests: [] }
};

/**
 * Make HTTP request with proper error handling
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
 * Record test result
 */
function recordTest(domain, testName, passed, statusCode, response, error = null) {
  const result = {
    name: testName,
    passed,
    statusCode,
    response: passed ? 'Success' : (error || response),
    timestamp: new Date().toISOString()
  };
  
  testResults[domain].tests.push(result);
  if (passed) {
    testResults[domain].passed++;
  } else {
    testResults[domain].failed++;
  }
  
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${testName}: ${statusCode} ${passed ? 'PASS' : 'FAIL'}`);
  if (!passed && error) {
    console.log(`   Error: ${error}`);
  }
}

/**
 * Test Authentication
 */
async function testAuthentication() {
  console.log('\n🔐 Testing Authentication...');
  console.log('================================');
  
  try {
    const authResult = await getCognitoToken(CONFIG.TEST_USER.email, CONFIG.TEST_USER.password);
    if (authResult.success && authResult.AccessToken) {
      recordTest('authentication', 'Cognito Token Acquisition', true, 200, 'Token obtained');
      return authResult.AccessToken;
    } else {
      recordTest('authentication', 'Cognito Token Acquisition', false, 401, authResult.error);
      return null;
    }
  } catch (error) {
    recordTest('authentication', 'Cognito Token Acquisition', false, 500, null, error.message);
    return null;
  }
}

/**
 * Test Health Endpoint
 */
async function testHealth() {
  console.log('\n🏥 Testing Health Endpoint...');
  console.log('==============================');
  
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/health`);
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('health', 'GET /health', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('health', 'GET /health', false, 500, null, error.message);
  }
}

/**
 * Test User Management Endpoints
 */
async function testUserManagement(accessToken, userId) {
  console.log('\n👥 Testing User Management...');
  console.log('==============================');
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  // Test GET /users (list all users)
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/users`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('users', 'GET /users (List Users)', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('users', 'GET /users (List Users)', false, 500, null, error.message);
  }
  
  // Test GET /users/{id} (get specific user)
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/users/${userId}`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('users', 'GET /users/{id} (Get User)', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('users', 'GET /users/{id} (Get User)', false, 500, null, error.message);
  }
}

/**
 * Test User Profile Endpoints
 */
async function testUserProfile(accessToken, userId) {
  console.log('\n👤 Testing User Profile...');
  console.log('===========================');
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  // Test GET /users/{id}/profile
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/users/${userId}/profile`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('userProfile', 'GET /users/{id}/profile', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('userProfile', 'GET /users/{id}/profile', false, 500, null, error.message);
  }
}

/**
 * Test User Preferences Endpoints
 */
async function testUserPreferences(accessToken, userId) {
  console.log('\n⚙️ Testing User Preferences...');
  console.log('===============================');
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  // Test GET /users/{id}/preferences
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/users/${userId}/preferences`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('userPreferences', 'GET /users/{id}/preferences', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('userPreferences', 'GET /users/{id}/preferences', false, 500, null, error.message);
  }
}

/**
 * Test User Sessions Endpoints
 */
async function testUserSessions(accessToken, userId) {
  console.log('\n🔗 Testing User Sessions...');
  console.log('============================');
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  // Test POST /users/{id}/sessions (create session)
  try {
    const sessionData = {
      userAgent: 'Test-Agent/1.0',
      loginTime: new Date().toISOString()
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/users/${userId}/sessions`, {
      method: 'POST',
      headers,
      body: sessionData
    });
    const passed = response.statusCode === 201 && response.body?.success === true;
    recordTest('userSessions', 'POST /users/{id}/sessions', passed, response.statusCode, response.body);
    
    // If session created successfully, test listing sessions
    if (passed) {
      const listResponse = await makeRequest(`${CONFIG.API_BASE_URL}/users/${userId}/sessions`, { headers });
      const listPassed = listResponse.statusCode === 200 && listResponse.body?.success === true;
      recordTest('userSessions', 'GET /users/{id}/sessions', listPassed, listResponse.statusCode, listResponse.body);
    }
  } catch (error) {
    recordTest('userSessions', 'POST /users/{id}/sessions', false, 500, null, error.message);
  }
}

/**
 * Test Projects Endpoints
 */
async function testProjects(accessToken) {
  console.log('\n📁 Testing Projects...');
  console.log('=======================');
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  // Test GET /projects
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/projects`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('projects', 'GET /projects', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('projects', 'GET /projects', false, 500, null, error.message);
  }
}

/**
 * Test Clients Endpoints
 */
async function testClients(accessToken) {
  console.log('\n🏢 Testing Clients...');
  console.log('======================');
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  // Test GET /clients
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/clients`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('clients', 'GET /clients', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('clients', 'GET /clients', false, 500, null, error.message);
  }
}

/**
 * Test Time Entries Endpoints
 */
async function testTimeEntries(accessToken) {
  console.log('\n⏰ Testing Time Entries...');
  console.log('===========================');
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  // Test GET /time-entries
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('timeEntries', 'GET /time-entries', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('timeEntries', 'GET /time-entries', false, 500, null, error.message);
  }
}

/**
 * Test Reports Endpoints
 */
async function testReports(accessToken) {
  console.log('\n📊 Testing Reports...');
  console.log('======================');
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  // Test GET /reports/time
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/reports/time`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('reports', 'GET /reports/time', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('reports', 'GET /reports/time', false, 500, null, error.message);
  }
}

/**
 * Test Analytics Endpoints
 */
async function testAnalytics(accessToken) {
  console.log('\n📈 Testing Analytics...');
  console.log('========================');
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  // Test GET /analytics/dashboard/enhanced
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/analytics/dashboard/enhanced`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('analytics', 'GET /analytics/dashboard/enhanced', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('analytics', 'GET /analytics/dashboard/enhanced', false, 500, null, error.message);
  }
}

/**
 * Test Invoices Endpoints
 */
async function testInvoices(accessToken) {
  console.log('\n🧾 Testing Invoices...');
  console.log('=======================');
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  // Test GET /invoices
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/invoices`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('invoices', 'GET /invoices', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('invoices', 'GET /invoices', false, 500, null, error.message);
  }
}

/**
 * Print comprehensive test results
 */
function printTestResults() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;
  
  Object.entries(testResults).forEach(([domain, results]) => {
    const domainTotal = results.passed + results.failed;
    if (domainTotal > 0) {
      totalPassed += results.passed;
      totalFailed += results.failed;
      totalTests += domainTotal;
      
      const percentage = domainTotal > 0 ? Math.round((results.passed / domainTotal) * 100) : 0;
      const status = percentage === 100 ? '✅' : percentage >= 50 ? '⚠️' : '❌';
      
      console.log(`${status} ${domain.padEnd(20)}: ${results.passed}/${domainTotal} (${percentage}%)`);
      
      // Show failed tests
      if (results.failed > 0) {
        results.tests.filter(t => !t.passed).forEach(test => {
          console.log(`   ❌ ${test.name}: ${test.statusCode} - ${test.response}`);
        });
      }
    }
  });
  
  console.log('='.repeat(80));
  const overallPercentage = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
  const overallStatus = overallPercentage === 100 ? '🎉' : overallPercentage >= 80 ? '✅' : overallPercentage >= 50 ? '⚠️' : '❌';
  
  console.log(`${overallStatus} OVERALL RESULTS: ${totalPassed}/${totalTests} tests passed (${overallPercentage}%)`);
  console.log('='.repeat(80));
  
  if (overallPercentage === 100) {
    console.log('🎉 ALL TESTS PASSED! API is fully functional.');
  } else if (overallPercentage >= 80) {
    console.log('✅ Most tests passed. API is largely functional with minor issues.');
  } else if (overallPercentage >= 50) {
    console.log('⚠️  Some tests failed. API has significant issues that need attention.');
  } else {
    console.log('❌ Many tests failed. API has major issues that need immediate attention.');
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 AEROTAGE TIME REPORTING API - COMPREHENSIVE ENDPOINT TESTING');
  console.log('================================================================');
  console.log(`🌐 Testing Environment: ${CONFIG.API_BASE_URL}`);
  console.log(`👤 Test User: ${CONFIG.TEST_USER.email}`);
  console.log(`📅 Test Started: ${new Date().toLocaleString()}`);
  
  try {
    // Step 1: Authentication
    const accessToken = await testAuthentication();
    if (!accessToken) {
      console.log('❌ Authentication failed. Cannot proceed with endpoint tests.');
      printTestResults();
      return;
    }
    
    // Extract user ID from token
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
    const userId = payload.sub;
    
    console.log(`✅ Authentication successful. User ID: ${userId}`);
    
    // Step 2: Health Check
    await testHealth();
    
    // Step 3: User Management
    await testUserManagement(accessToken, userId);
    
    // Step 4: User Profile
    await testUserProfile(accessToken, userId);
    
    // Step 5: User Preferences
    await testUserPreferences(accessToken, userId);
    
    // Step 6: User Sessions
    await testUserSessions(accessToken, userId);
    
    // Step 7: Projects
    await testProjects(accessToken);
    
    // Step 8: Clients
    await testClients(accessToken);
    
    // Step 9: Time Entries
    await testTimeEntries(accessToken);
    
    // Step 10: Reports
    await testReports(accessToken);
    
    // Step 11: Analytics
    await testAnalytics(accessToken);
    
    // Step 12: Invoices
    await testInvoices(accessToken);
    
  } catch (error) {
    console.error('💥 Test suite failed with error:', error.message);
  }
  
  // Print final results
  printTestResults();
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, CONFIG, testResults }; 