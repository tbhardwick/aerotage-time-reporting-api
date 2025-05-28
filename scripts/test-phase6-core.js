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
 * Test basic dashboard (GET request)
 */
async function testBasicDashboard(accessToken) {
  console.log(`\n📊 TESTING BASIC DASHBOARD (GET)`);
  console.log('='.repeat(60));

  try {
    const response = await makeRequest(`${API_BASE_URL}/analytics/dashboard?timeframe=month&realTime=false`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const dashboard = response.body.data;
      console.log(`✅ Basic dashboard retrieved successfully!`);
      console.log(`🆔 Dashboard ID: ${dashboard.dashboardId}`);
      console.log(`📊 Widgets: ${dashboard.widgets.length}`);
      console.log(`⏰ Last Updated: ${dashboard.lastUpdated}`);
      
      return {
        success: true,
        dashboard
      };
    } else {
      console.log(`❌ Basic dashboard retrieval failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Basic dashboard error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test analytics event tracking (POST)
 */
async function testEventTracking(accessToken) {
  console.log(`\n📈 TESTING ANALYTICS EVENT TRACKING`);
  console.log('='.repeat(60));

  const eventData = {
    eventType: 'user_action',
    action: 'test_script_execution',
    metadata: {
      scriptName: 'test-phase6-core.js',
      timestamp: new Date().toISOString(),
      userAgent: 'Node.js Test Script',
      testPhase: 'phase6-core'
    }
  };

  console.log(`📤 Tracking analytics event:`, eventData);

  try {
    const response = await makeRequest(`${API_BASE_URL}/analytics/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: eventData
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const trackingResult = response.body.data;
      console.log(`✅ Analytics event tracked successfully!`);
      console.log(`🆔 Event ID: ${trackingResult.eventId}`);
      console.log(`📊 Event Type: ${trackingResult.eventType}`);
      console.log(`⏰ Timestamp: ${trackingResult.timestamp}`);
      
      return {
        success: true,
        trackingResult
      };
    } else {
      console.log(`❌ Analytics event tracking failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Analytics event tracking error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test real-time analytics (GET with query params)
 */
async function testRealTimeAnalytics(accessToken) {
  console.log(`\n⚡ TESTING REAL-TIME ANALYTICS (GET)`);
  console.log('='.repeat(60));

  try {
    const response = await makeRequest(`${API_BASE_URL}/analytics/real-time?refreshInterval=30&includeActivities=true&includeSessions=true&includeAlerts=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const analytics = response.body.data;
      console.log(`✅ Real-time analytics retrieved successfully!`);
      console.log(`👥 Active Users: ${analytics.metrics.activeUsers}`);
      console.log(`🔗 Current Sessions: ${analytics.metrics.currentSessions}`);
      console.log(`⏰ Today Hours: ${analytics.metrics.todayHours}`);
      console.log(`💰 Today Revenue: $${analytics.metrics.todayRevenue}`);
      console.log(`🔄 Next Refresh: ${analytics.nextRefresh}`);
      
      return {
        success: true,
        analytics
      };
    } else {
      console.log(`❌ Real-time analytics retrieval failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Real-time analytics error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test performance monitoring (GET with query params)
 */
async function testPerformanceMonitoring(accessToken) {
  console.log(`\n🔧 TESTING PERFORMANCE MONITORING (GET)`);
  console.log('='.repeat(60));

  try {
    const response = await makeRequest(`${API_BASE_URL}/analytics/performance?timeframe=day&includeRecommendations=true&includeAlerts=true&includeComparisons=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const performance = response.body.data;
      console.log(`✅ Performance monitoring retrieved successfully!`);
      console.log(`📊 Overall Score: ${performance.summary.overallScore}`);
      console.log(`🎯 Performance Grade: ${performance.summary.performanceGrade}`);
      console.log(`⚡ Response Time: ${performance.summary.keyMetrics.responseTime}ms`);
      console.log(`📈 Throughput: ${performance.summary.keyMetrics.throughput} req/min`);
      console.log(`❌ Error Rate: ${performance.summary.keyMetrics.errorRate}%`);
      
      return {
        success: true,
        performance
      };
    } else {
      console.log(`❌ Performance monitoring retrieval failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Performance monitoring error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test enhanced dashboard with POST configuration
 */
async function testEnhancedDashboard(accessToken) {
  console.log(`\n📊 TESTING ENHANCED DASHBOARD (POST)`);
  console.log('='.repeat(60));

  const dashboardConfig = {
    widgets: [
      {
        id: 'revenue-kpi',
        type: 'kpi',
        title: 'Total Revenue',
        size: 'medium',
        position: { x: 0, y: 0 },
        config: {
          metric: 'revenue',
          comparison: 'previous_period'
        }
      },
      {
        id: 'utilization-gauge',
        type: 'gauge',
        title: 'Team Utilization',
        size: 'medium',
        position: { x: 1, y: 0 },
        config: {
          metric: 'utilization',
          target: 80,
          threshold: 70
        }
      }
    ],
    timeframe: 'month',
    realTime: false,
    includeForecasting: true,
    includeBenchmarks: true
  };

  console.log(`📤 Generating enhanced dashboard:`, dashboardConfig);

  try {
    const response = await makeRequest(`${API_BASE_URL}/analytics/dashboard/enhanced`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: dashboardConfig
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const dashboard = response.body.data;
      console.log(`✅ Enhanced dashboard generated successfully!`);
      console.log(`🆔 Dashboard ID: ${dashboard.dashboardId}`);
      console.log(`📊 Widgets: ${dashboard.widgets.length}`);
      console.log(`💰 Total Revenue: $${dashboard.summary.totalRevenue}`);
      console.log(`⏰ Last Updated: ${dashboard.lastUpdated}`);
      
      return {
        success: true,
        dashboard
      };
    } else {
      console.log(`❌ Enhanced dashboard generation failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Enhanced dashboard generation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Core test flow for Phase 6 analytics
 */
async function runPhase6CoreTests() {
  console.log(`\n🚀 TESTING PHASE 6 CORE - ANALYTICS & DASHBOARD`);
  console.log('='.repeat(80));
  console.log(`📧 Test User: ${TEST_USER.email}`);
  console.log(`🕐 Test Time: ${new Date().toISOString()}`);
  console.log(`🌐 API Base URL: ${API_BASE_URL}`);

  const testResults = {
    authentication: false,
    basicDashboard: false,
    eventTracking: false,
    realTimeAnalytics: false,
    performanceMonitoring: false,
    enhancedDashboard: false
  };

  try {
    // Step 1: Authenticate
    console.log(`\n🔐 Step 1: Authenticate with Cognito`);
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    
    if (!authResult.success) {
      console.log(`❌ Authentication failed: ${authResult.error}`);
      return testResults;
    }

    const { token: accessToken, userId } = authResult;
    console.log(`✅ Authentication successful for user: ${userId}`);
    testResults.authentication = true;

    // Step 2: Basic Dashboard
    console.log(`\n📊 Step 2: Basic Dashboard`);
    const basicDashboardResult = await testBasicDashboard(accessToken);
    testResults.basicDashboard = basicDashboardResult.success;

    // Step 3: Event Tracking
    console.log(`\n📈 Step 3: Analytics Event Tracking`);
    const eventTrackingResult = await testEventTracking(accessToken);
    testResults.eventTracking = eventTrackingResult.success;

    // Step 4: Real-Time Analytics
    console.log(`\n⚡ Step 4: Real-Time Analytics`);
    const realTimeResult = await testRealTimeAnalytics(accessToken);
    testResults.realTimeAnalytics = realTimeResult.success;

    // Step 5: Performance Monitoring
    console.log(`\n🔧 Step 5: Performance Monitoring`);
    const performanceResult = await testPerformanceMonitoring(accessToken);
    testResults.performanceMonitoring = performanceResult.success;

    // Step 6: Enhanced Dashboard
    console.log(`\n📊 Step 6: Enhanced Dashboard`);
    const enhancedDashboardResult = await testEnhancedDashboard(accessToken);
    testResults.enhancedDashboard = enhancedDashboardResult.success;

  } catch (error) {
    console.error(`\n❌ TEST FAILED WITH ERROR:`, error);
  }

  // Summary
  console.log(`\n📊 PHASE 6 CORE TEST SUMMARY`);
  console.log('='.repeat(80));
  
  const testSteps = [
    { name: 'Authentication', result: testResults.authentication },
    { name: 'Basic Dashboard', result: testResults.basicDashboard },
    { name: 'Event Tracking', result: testResults.eventTracking },
    { name: 'Real-Time Analytics', result: testResults.realTimeAnalytics },
    { name: 'Performance Monitoring', result: testResults.performanceMonitoring },
    { name: 'Enhanced Dashboard', result: testResults.enhancedDashboard }
  ];

  testSteps.forEach(step => {
    const status = step.result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${step.name}`);
  });

  const passedTests = testSteps.filter(step => step.result).length;
  const totalTests = testSteps.length;
  
  console.log(`\n🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log(`🎉 ALL PHASE 6 CORE ENDPOINTS ARE WORKING CORRECTLY!`);
  } else {
    console.log(`🚨 Some tests failed. Please review the output above for details.`);
  }

  return testResults;
}

// CLI interface
if (require.main === module) {
  console.log(`
🧪 Phase 6 Core Analytics Test Suite

This script will test the core Phase 6 analytics endpoints:
- Basic Dashboard (GET)
- Analytics Event Tracking (POST)
- Real-Time Analytics (GET)
- Performance Monitoring (GET)
- Enhanced Dashboard (POST)

Using test credentials:
- Email: ${TEST_USER.email}
- API: ${API_BASE_URL}

Starting core tests...
`);

  runPhase6CoreTests();
}

module.exports = {
  runPhase6CoreTests,
  testBasicDashboard,
  testEventTracking,
  testRealTimeAnalytics,
  testPerformanceMonitoring,
  testEnhancedDashboard
}; 