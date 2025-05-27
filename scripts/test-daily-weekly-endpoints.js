#!/usr/bin/env node

/**
 * Daily and Weekly Time Tracking Endpoints Test Script
 * 
 * This script tests all the new endpoints added for the daily/weekly time tracking feature:
 * - Work schedule management
 * - Daily summary
 * - Weekly overview
 * - Quick time entry
 */

const https = require('https');
const readline = require('readline');

// Configuration
const API_BASE_URL = 'https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev';
const TEST_USER_EMAIL = 'test@aerotage.com'; // You'll need to provide a valid test user
const TEST_PROJECT_ID = 'test-project-123'; // You'll need to provide a valid project ID

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE_URL + path);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function promptForInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function testEndpoint(name, method, path, data = null, token = null, expectedStatus = 200) {
  log(`\n${colors.blue}Testing: ${name}${colors.reset}`);
  log(`${method} ${path}`);
  
  if (data) {
    log(`Request body: ${JSON.stringify(data, null, 2)}`);
  }

  try {
    const response = await makeRequest(method, path, data, token);
    
    if (response.statusCode === expectedStatus) {
      log(`✅ ${colors.green}SUCCESS${colors.reset} - Status: ${response.statusCode}`);
      if (response.data && typeof response.data === 'object') {
        log(`Response: ${JSON.stringify(response.data, null, 2)}`);
      }
      return { success: true, response };
    } else {
      log(`❌ ${colors.red}FAILED${colors.reset} - Expected: ${expectedStatus}, Got: ${response.statusCode}`);
      log(`Response: ${JSON.stringify(response.data, null, 2)}`);
      return { success: false, response };
    }
  } catch (error) {
    log(`❌ ${colors.red}ERROR${colors.reset} - ${error.message}`);
    return { success: false, error };
  }
}

async function runTests() {
  log(`${colors.bold}${colors.blue}Daily and Weekly Time Tracking Endpoints Test${colors.reset}`);
  log(`API Base URL: ${API_BASE_URL}`);
  
  // Get authentication token
  const token = await promptForInput('\nPlease enter your JWT token (from Cognito): ');
  if (!token) {
    log(`${colors.red}No token provided. Exiting.${colors.reset}`);
    return;
  }

  // Get test data
  const projectId = await promptForInput(`\nEnter a valid project ID (default: ${TEST_PROJECT_ID}): `) || TEST_PROJECT_ID;
  
  const results = [];

  // Test 1: Get work schedule (should return 404 for new user or existing schedule)
  const test1 = await testEndpoint(
    'Get Work Schedule',
    'GET',
    '/users/work-schedule',
    null,
    token,
    200 // Expecting 200 if exists, or we'll see what we get
  );
  results.push(test1);

  // Test 2: Create/Update work schedule
  const workScheduleData = {
    schedule: {
      monday: { start: '09:00', end: '17:00', targetHours: 8 },
      tuesday: { start: '09:00', end: '17:00', targetHours: 8 },
      wednesday: { start: '09:00', end: '17:00', targetHours: 8 },
      thursday: { start: '09:00', end: '17:00', targetHours: 8 },
      friday: { start: '09:00', end: '16:00', targetHours: 7 },
      saturday: { start: null, end: null, targetHours: 0 },
      sunday: { start: null, end: null, targetHours: 0 }
    },
    timezone: 'America/New_York'
  };

  const test2 = await testEndpoint(
    'Update Work Schedule',
    'PUT',
    '/users/work-schedule',
    workScheduleData,
    token,
    200
  );
  results.push(test2);

  // Test 3: Get work schedule again (should now exist)
  const test3 = await testEndpoint(
    'Get Work Schedule (after update)',
    'GET',
    '/users/work-schedule',
    null,
    token,
    200
  );
  results.push(test3);

  // Test 4: Quick add time entry
  const today = new Date().toISOString().split('T')[0];
  const quickEntryData = {
    date: today,
    startTime: '10:00',
    endTime: '11:00',
    projectId: projectId,
    description: 'Test time entry from verification script',
    isBillable: true,
    fillGap: false
  };

  const test4 = await testEndpoint(
    'Quick Add Time Entry',
    'POST',
    '/time-entries/quick-add',
    quickEntryData,
    token,
    201
  );
  results.push(test4);

  // Test 5: Daily summary for today
  const test5 = await testEndpoint(
    'Daily Summary',
    'GET',
    `/time-entries/daily-summary?startDate=${today}&endDate=${today}&includeGaps=true`,
    null,
    token,
    200
  );
  results.push(test5);

  // Test 6: Weekly overview for current week
  const currentWeek = getMonday(new Date()).toISOString().split('T')[0];
  const test6 = await testEndpoint(
    'Weekly Overview',
    'GET',
    `/time-entries/weekly-overview?weekStartDate=${currentWeek}&includeComparison=true`,
    null,
    token,
    200
  );
  results.push(test6);

  // Test 7: Daily summary with date range
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastWeekStr = lastWeek.toISOString().split('T')[0];

  const test7 = await testEndpoint(
    'Daily Summary (Date Range)',
    'GET',
    `/time-entries/daily-summary?startDate=${lastWeekStr}&endDate=${today}&includeGaps=false`,
    null,
    token,
    200
  );
  results.push(test7);

  // Test 8: Test error handling - invalid date format
  const test8 = await testEndpoint(
    'Daily Summary (Invalid Date)',
    'GET',
    '/time-entries/daily-summary?startDate=invalid&endDate=2024-01-01',
    null,
    token,
    400
  );
  results.push(test8);

  // Test 9: Test error handling - future date
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);
  const futureDateStr = futureDate.toISOString().split('T')[0];

  const test9 = await testEndpoint(
    'Daily Summary (Future Date)',
    'GET',
    `/time-entries/daily-summary?startDate=${futureDateStr}&endDate=${futureDateStr}`,
    null,
    token,
    400
  );
  results.push(test9);

  // Test 10: Test error handling - invalid work schedule
  const invalidScheduleData = {
    schedule: {
      monday: { start: '17:00', end: '09:00', targetHours: 8 } // Invalid: start after end
    }
  };

  const test10 = await testEndpoint(
    'Update Work Schedule (Invalid)',
    'PUT',
    '/users/work-schedule',
    invalidScheduleData,
    token,
    400
  );
  results.push(test10);

  // Summary
  log(`\n${colors.bold}${colors.blue}Test Results Summary${colors.reset}`);
  log('='.repeat(50));
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  log(`Total tests: ${total}`);
  log(`Successful: ${colors.green}${successful}${colors.reset}`);
  log(`Failed: ${colors.red}${total - successful}${colors.reset}`);
  
  if (successful === total) {
    log(`\n🎉 ${colors.green}All tests passed! The daily/weekly time tracking endpoints are working correctly.${colors.reset}`);
  } else {
    log(`\n⚠️  ${colors.yellow}Some tests failed. Please check the output above for details.${colors.reset}`);
  }

  // Additional verification suggestions
  log(`\n${colors.bold}Additional Verification Steps:${colors.reset}`);
  log('1. Check the DynamoDB tables in AWS Console:');
  log('   - aerotage-user-work-schedules-dev');
  log('   - aerotage-time-entries-dev');
  log('2. Check CloudWatch logs for the Lambda functions:');
  log('   - aerotage-getworkschedule-dev');
  log('   - aerotage-updateworkschedule-dev');
  log('   - aerotage-dailysummary-dev');
  log('   - aerotage-weeklyoverview-dev');
  log('   - aerotage-quickaddtimeentry-dev');
  log('3. Test the endpoints with different user roles (employee, manager, admin)');
  log('4. Test with larger date ranges and more time entries');
}

// Helper function to get Monday of current week
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testEndpoint, makeRequest }; 