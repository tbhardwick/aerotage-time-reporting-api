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
  emailChange: { passed: 0, failed: 0, tests: [] },
  projects: { passed: 0, failed: 0, tests: [] },
  clients: { passed: 0, failed: 0, tests: [] },
  timeEntries: { passed: 0, failed: 0, tests: [] },
  timerEndpoints: { passed: 0, failed: 0, tests: [] },
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
 * Test User Invitations Endpoints
 */
async function testUserInvitations(accessToken) {
  console.log('\n📧 Testing User Invitations...');
  console.log('===============================');
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  // Test GET /user-invitations (list invitations)
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/user-invitations`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('userInvitations', 'GET /user-invitations', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('userInvitations', 'GET /user-invitations', false, 500, null, error.message);
  }

  // Test POST /user-invitations (create invitation) - using a test email
  try {
    const invitationData = {
      email: `test-invite-${Date.now()}@example.com`,
      role: 'employee',
      message: 'Test invitation from comprehensive endpoint testing'
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/user-invitations`, {
      method: 'POST',
      headers,
      body: invitationData
    });
    const passed = response.statusCode === 201 && response.body?.success === true;
    recordTest('userInvitations', 'POST /user-invitations', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('userInvitations', 'POST /user-invitations', false, 500, null, error.message);
  }
}

/**
 * Test Email Change Endpoints
 */
async function testEmailChange(accessToken, userId) {
  console.log('\n📮 Testing Email Change...');
  console.log('===========================');
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  // Test GET /email-change (get pending email change requests)
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/email-change`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('emailChange', 'GET /email-change', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('emailChange', 'GET /email-change', false, 500, null, error.message);
  }

  // Test POST /email-change (submit email change request) - using a test email
  try {
    const emailChangeData = {
      newEmail: `test-email-change-${Date.now()}@example.com`,
      reason: 'Testing email change functionality'
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/email-change`, {
      method: 'POST',
      headers,
      body: emailChangeData
    });
    const passed = response.statusCode === 201 && response.body?.success === true;
    recordTest('emailChange', 'POST /email-change', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('emailChange', 'POST /email-change', false, 500, null, error.message);
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

  // Test POST /projects (create project)
  let createdProjectId = null;
  try {
    const projectData = {
      name: `Test Project ${Date.now()}`,
      description: 'Test project created by comprehensive endpoint testing',
      clientId: 'client_test_123',
      status: 'active',
      hourlyRate: 75.00
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/projects`, {
      method: 'POST',
      headers,
      body: projectData
    });
    const passed = response.statusCode === 201 && response.body?.success === true;
    if (passed && response.body?.data?.id) {
      createdProjectId = response.body.data.id;
    }
    recordTest('projects', 'POST /projects', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('projects', 'POST /projects', false, 500, null, error.message);
  }

  // Test PUT /projects/{id} (update project) - only if we created one
  if (createdProjectId) {
    try {
      const updateData = {
        name: `Updated Test Project ${Date.now()}`,
        description: 'Updated test project description',
        status: 'active'
      };
      const response = await makeRequest(`${CONFIG.API_BASE_URL}/projects/${createdProjectId}`, {
        method: 'PUT',
        headers,
        body: updateData
      });
      const passed = response.statusCode === 200 && response.body?.success === true;
      recordTest('projects', 'PUT /projects/{id}', passed, response.statusCode, response.body);
    } catch (error) {
      recordTest('projects', 'PUT /projects/{id}', false, 500, null, error.message);
    }

    // Test DELETE /projects/{id} (delete project)
    try {
      const response = await makeRequest(`${CONFIG.API_BASE_URL}/projects/${createdProjectId}`, {
        method: 'DELETE',
        headers
      });
      const passed = response.statusCode === 200 && response.body?.success === true;
      recordTest('projects', 'DELETE /projects/{id}', passed, response.statusCode, response.body);
    } catch (error) {
      recordTest('projects', 'DELETE /projects/{id}', false, 500, null, error.message);
    }
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

  // Test POST /clients (create client)
  let createdClientId = null;
  try {
    const clientData = {
      name: `Test Client ${Date.now()}`,
      email: `test-client-${Date.now()}@example.com`,
      phone: '+1-555-0123',
      address: '123 Test Street, Test City, TC 12345',
      hourlyRate: 100.00
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/clients`, {
      method: 'POST',
      headers,
      body: clientData
    });
    const passed = response.statusCode === 201 && response.body?.success === true;
    if (passed && response.body?.data?.id) {
      createdClientId = response.body.data.id;
    }
    recordTest('clients', 'POST /clients', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('clients', 'POST /clients', false, 500, null, error.message);
  }

  // Test PUT /clients/{id} (update client) - only if we created one
  if (createdClientId) {
    try {
      const updateData = {
        name: `Updated Test Client ${Date.now()}`,
        email: `updated-test-client-${Date.now()}@example.com`,
        phone: '+1-555-0456'
      };
      const response = await makeRequest(`${CONFIG.API_BASE_URL}/clients/${createdClientId}`, {
        method: 'PUT',
        headers,
        body: updateData
      });
      const passed = response.statusCode === 200 && response.body?.success === true;
      recordTest('clients', 'PUT /clients/{id}', passed, response.statusCode, response.body);
    } catch (error) {
      recordTest('clients', 'PUT /clients/{id}', false, 500, null, error.message);
    }

    // Test DELETE /clients/{id} (delete client)
    try {
      const response = await makeRequest(`${CONFIG.API_BASE_URL}/clients/${createdClientId}`, {
        method: 'DELETE',
        headers
      });
      const passed = response.statusCode === 200 && response.body?.success === true;
      recordTest('clients', 'DELETE /clients/{id}', passed, response.statusCode, response.body);
    } catch (error) {
      recordTest('clients', 'DELETE /clients/{id}', false, 500, null, error.message);
    }
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

  // Test GET /time-entries/daily-summary
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/daily-summary`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('timeEntries', 'GET /time-entries/daily-summary', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('timeEntries', 'GET /time-entries/daily-summary', false, 500, null, error.message);
  }

  // Test GET /time-entries/weekly-overview
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/weekly-overview`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('timeEntries', 'GET /time-entries/weekly-overview', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('timeEntries', 'GET /time-entries/weekly-overview', false, 500, null, error.message);
  }

  // Test POST /time-entries/quick-add
  try {
    const quickAddData = {
      projectId: 'proj_test_123',
      description: 'Test quick add entry',
      duration: 30,
      date: new Date().toISOString().split('T')[0]
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/quick-add`, {
      method: 'POST',
      headers,
      body: quickAddData
    });
    const passed = response.statusCode === 201 && response.body?.success === true;
    recordTest('timeEntries', 'POST /time-entries/quick-add', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('timeEntries', 'POST /time-entries/quick-add', false, 500, null, error.message);
  }
}

/**
 * Test Timer Endpoints (NEW)
 */
async function testTimerEndpoints(accessToken) {
  console.log('\n⏱️ Testing Timer Endpoints...');
  console.log('==============================');
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  
  // Test 1: GET /time-entries/timer/status (should be no active timer initially)
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/timer/status`, { headers });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('timerEndpoints', 'GET /time-entries/timer/status (Initial)', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('timerEndpoints', 'GET /time-entries/timer/status (Initial)', false, 500, null, error.message);
  }

  // Test 2: POST /time-entries/timer/start
  let timerStarted = false;
  try {
    const startData = {
      projectId: 'proj_test_timer_123',
      description: 'Testing timer endpoints via comprehensive test',
      tags: ['testing', 'automation', 'timer']
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/timer/start`, {
      method: 'POST',
      headers,
      body: startData
    });
    const passed = response.statusCode === 201 && response.body?.success === true;
    timerStarted = passed;
    recordTest('timerEndpoints', 'POST /time-entries/timer/start', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('timerEndpoints', 'POST /time-entries/timer/start', false, 500, null, error.message);
  }

  // Test 3: GET /time-entries/timer/status (should show active timer)
  if (timerStarted) {
    try {
      const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/timer/status`, { headers });
      const passed = response.statusCode === 200 && response.body?.success === true && response.body?.data?.isActive === true;
      recordTest('timerEndpoints', 'GET /time-entries/timer/status (Active)', passed, response.statusCode, response.body);
    } catch (error) {
      recordTest('timerEndpoints', 'GET /time-entries/timer/status (Active)', false, 500, null, error.message);
    }

    // Wait a moment to accumulate some timer time
    console.log('   ⏳ Waiting 2 seconds to accumulate timer time...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: POST /time-entries/timer/stop
    try {
      const stopData = {
        description: 'Completed timer testing via comprehensive test'
      };
      const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/timer/stop`, {
        method: 'POST',
        headers,
        body: stopData
      });
      const passed = response.statusCode === 200 && response.body?.success === true;
      recordTest('timerEndpoints', 'POST /time-entries/timer/stop', passed, response.statusCode, response.body);
    } catch (error) {
      recordTest('timerEndpoints', 'POST /time-entries/timer/stop', false, 500, null, error.message);
    }

    // Test 5: GET /time-entries/timer/status (should be no active timer after stop)
    try {
      const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/timer/status`, { headers });
      const passed = response.statusCode === 200 && response.body?.success === true && response.body?.data === null;
      recordTest('timerEndpoints', 'GET /time-entries/timer/status (After Stop)', passed, response.statusCode, response.body);
    } catch (error) {
      recordTest('timerEndpoints', 'GET /time-entries/timer/status (After Stop)', false, 500, null, error.message);
    }
  }

  // Test 6: Error case - try to stop timer when none is running
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries/timer/stop`, {
      method: 'POST',
      headers,
      body: { description: 'Test error case' }
    });
    const passed = response.statusCode === 404 && response.body?.success === false;
    recordTest('timerEndpoints', 'POST /time-entries/timer/stop (Error Case)', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('timerEndpoints', 'POST /time-entries/timer/stop (Error Case)', false, 500, null, error.message);
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

  // Test POST /reports/time (generate time report)
  try {
    const reportData = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      format: 'json',
      includeDetails: true
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/reports/time`, {
      method: 'POST',
      headers,
      body: reportData
    });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('reports', 'POST /reports/time', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('reports', 'POST /reports/time', false, 500, null, error.message);
  }

  // Test POST /reports/project (generate project report)
  try {
    const reportData = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      projectIds: ['proj_test_123'],
      format: 'json'
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/reports/project`, {
      method: 'POST',
      headers,
      body: reportData
    });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('reports', 'POST /reports/project', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('reports', 'POST /reports/project', false, 500, null, error.message);
  }

  // Test POST /reports/client (generate client report)
  try {
    const reportData = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      clientIds: ['client_test_123'],
      format: 'json'
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/reports/client`, {
      method: 'POST',
      headers,
      body: reportData
    });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('reports', 'POST /reports/client', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('reports', 'POST /reports/client', false, 500, null, error.message);
  }

  // Test POST /reports/export (export report)
  try {
    const exportData = {
      reportType: 'time',
      format: 'csv',
      startDate: '2024-01-01',
      endDate: '2024-01-31'
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/reports/export`, {
      method: 'POST',
      headers,
      body: exportData
    });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('reports', 'POST /reports/export', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('reports', 'POST /reports/export', false, 500, null, error.message);
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

  // Test POST /analytics/dashboard (generate dashboard)
  try {
    const dashboardData = {
      dateRange: 'last30days',
      includeCharts: true,
      includeMetrics: true
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/analytics/dashboard`, {
      method: 'POST',
      headers,
      body: dashboardData
    });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('analytics', 'POST /analytics/dashboard', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('analytics', 'POST /analytics/dashboard', false, 500, null, error.message);
  }

  // Test POST /analytics/dashboard/enhanced (enhanced dashboard)
  try {
    const enhancedData = {
      dateRange: 'last7days',
      includeProjectBreakdown: true,
      includeTimeDistribution: true,
      includeProductivityMetrics: true
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/analytics/dashboard/enhanced`, {
      method: 'POST',
      headers,
      body: enhancedData
    });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('analytics', 'POST /analytics/dashboard/enhanced', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('analytics', 'POST /analytics/dashboard/enhanced', false, 500, null, error.message);
  }

  // Test POST /analytics/events (track event)
  try {
    const eventData = {
      eventType: 'test_event',
      eventData: {
        source: 'comprehensive_test',
        timestamp: new Date().toISOString()
      }
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/analytics/events`, {
      method: 'POST',
      headers,
      body: eventData
    });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('analytics', 'POST /analytics/events', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('analytics', 'POST /analytics/events', false, 500, null, error.message);
  }

  // Test POST /analytics/real-time (real-time analytics)
  try {
    const realTimeData = {
      metrics: ['active_users', 'current_timers', 'today_hours'],
      refreshInterval: 30
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/analytics/real-time`, {
      method: 'POST',
      headers,
      body: realTimeData
    });
    const passed = response.statusCode === 200 && response.body?.success === true;
    recordTest('analytics', 'POST /analytics/real-time', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('analytics', 'POST /analytics/real-time', false, 500, null, error.message);
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

  // Test POST /invoices (generate invoice)
  let createdInvoiceId = null;
  try {
    const invoiceData = {
      clientId: 'client_test_123',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      description: 'Test invoice generated by comprehensive endpoint testing',
      hourlyRate: 100.00
    };
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/invoices`, {
      method: 'POST',
      headers,
      body: invoiceData
    });
    const passed = response.statusCode === 201 && response.body?.success === true;
    if (passed && response.body?.data?.id) {
      createdInvoiceId = response.body.data.id;
    }
    recordTest('invoices', 'POST /invoices', passed, response.statusCode, response.body);
  } catch (error) {
    recordTest('invoices', 'POST /invoices', false, 500, null, error.message);
  }

  // Test PUT /invoices/{id} (update invoice) - only if we created one
  if (createdInvoiceId) {
    try {
      const updateData = {
        description: 'Updated test invoice description',
        notes: 'Updated via comprehensive endpoint testing'
      };
      const response = await makeRequest(`${CONFIG.API_BASE_URL}/invoices/${createdInvoiceId}`, {
        method: 'PUT',
        headers,
        body: updateData
      });
      const passed = response.statusCode === 200 && response.body?.success === true;
      recordTest('invoices', 'PUT /invoices/{id}', passed, response.statusCode, response.body);
    } catch (error) {
      recordTest('invoices', 'PUT /invoices/{id}', false, 500, null, error.message);
    }

    // Test POST /invoices/{id}/send (send invoice)
    try {
      const sendData = {
        recipientEmail: 'test-recipient@example.com',
        subject: 'Test Invoice from Comprehensive Testing',
        message: 'This is a test invoice sent via automated testing.'
      };
      const response = await makeRequest(`${CONFIG.API_BASE_URL}/invoices/${createdInvoiceId}/send`, {
        method: 'POST',
        headers,
        body: sendData
      });
      const passed = response.statusCode === 200 && response.body?.success === true;
      recordTest('invoices', 'POST /invoices/{id}/send', passed, response.statusCode, response.body);
    } catch (error) {
      recordTest('invoices', 'POST /invoices/{id}/send', false, 500, null, error.message);
    }

    // Test PUT /invoices/{id}/status (update invoice status)
    try {
      const statusData = {
        status: 'sent',
        notes: 'Status updated via comprehensive testing'
      };
      const response = await makeRequest(`${CONFIG.API_BASE_URL}/invoices/${createdInvoiceId}/status`, {
        method: 'PUT',
        headers,
        body: statusData
      });
      const passed = response.statusCode === 200 && response.body?.success === true;
      recordTest('invoices', 'PUT /invoices/{id}/status', passed, response.statusCode, response.body);
    } catch (error) {
      recordTest('invoices', 'PUT /invoices/{id}/status', false, 500, null, error.message);
    }
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
    
    // Step 7: User Invitations
    await testUserInvitations(accessToken);
    
    // Step 8: Email Change
    await testEmailChange(accessToken, userId);
    
    // Step 9: Projects
    await testProjects(accessToken);
    
    // Step 10: Clients
    await testClients(accessToken);
    
    // Step 11: Time Entries
    await testTimeEntries(accessToken);
    
    // Step 12: Timer Endpoints (NEW)
    await testTimerEndpoints(accessToken);
    
    // Step 13: Reports
    await testReports(accessToken);
    
    // Step 14: Analytics
    await testAnalytics(accessToken);
    
    // Step 15: Invoices
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