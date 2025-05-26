#!/usr/bin/env node

const { getCognitoToken } = require('./get-cognito-token');
const https = require('https');

// Configuration
const API_BASE_URL = 'https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev';
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
 * Test time report generation
 */
async function testGenerateTimeReport(accessToken) {
  console.log(`\n📊 TESTING TIME REPORT GENERATION`);
  console.log('='.repeat(60));

  const reportParams = {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    groupBy: 'month',
    includeDetails: true,
    filters: {
      billable: true
    }
  };

  console.log(`📤 Generating time report:`, reportParams);

  try {
    const response = await makeRequest(`${API_BASE_URL}/reports/time`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: reportParams
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const report = response.body.data;
      console.log(`✅ Time report generated successfully!`);
      console.log(`🆔 Report ID: ${report.reportId}`);
      console.log(`📊 Total Hours: ${report.summary.totalHours}`);
      console.log(`💰 Total Revenue: $${report.summary.totalRevenue}`);
      console.log(`📈 Data Points: ${report.data.length}`);
      
      return {
        success: true,
        report
      };
    } else {
      console.log(`❌ Time report generation failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Time report generation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test project report generation
 */
async function testGenerateProjectReport(accessToken) {
  console.log(`\n📁 TESTING PROJECT REPORT GENERATION`);
  console.log('='.repeat(60));

  const reportParams = {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    includeFinancials: true,
    includeTeamMetrics: true,
    groupBy: 'project'
  };

  console.log(`📤 Generating project report:`, reportParams);

  try {
    const response = await makeRequest(`${API_BASE_URL}/reports/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: reportParams
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const report = response.body.data;
      console.log(`✅ Project report generated successfully!`);
      console.log(`🆔 Report ID: ${report.reportId}`);
      console.log(`📊 Total Projects: ${report.summary.totalProjects}`);
      console.log(`💰 Total Budget: $${report.summary.totalBudget}`);
      console.log(`📈 Active Projects: ${report.summary.activeProjects}`);
      
      return {
        success: true,
        report
      };
    } else {
      console.log(`❌ Project report generation failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Project report generation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test client report generation
 */
async function testGenerateClientReport(accessToken) {
  console.log(`\n🏢 TESTING CLIENT REPORT GENERATION`);
  console.log('='.repeat(60));

  const reportParams = {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    includeBilling: true,
    includeActivity: true,
    includeInvoices: true
  };

  console.log(`📤 Generating client report:`, reportParams);

  try {
    const response = await makeRequest(`${API_BASE_URL}/reports/clients`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: reportParams
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const report = response.body.data;
      console.log(`✅ Client report generated successfully!`);
      console.log(`🆔 Report ID: ${report.reportId}`);
      console.log(`🏢 Total Clients: ${report.summary.totalClients}`);
      console.log(`💰 Total Revenue: $${report.summary.totalRevenue}`);
      console.log(`📊 Active Clients: ${report.summary.activeClients}`);
      
      return {
        success: true,
        report
      };
    } else {
      console.log(`❌ Client report generation failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Client report generation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test enhanced dashboard
 */
async function testEnhancedDashboard(accessToken) {
  console.log(`\n📊 TESTING ENHANCED DASHBOARD`);
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
 * Test real-time analytics
 */
async function testRealTimeAnalytics(accessToken) {
  console.log(`\n⚡ TESTING REAL-TIME ANALYTICS`);
  console.log('='.repeat(60));

  const analyticsConfig = {
    metrics: ['activeUsers', 'currentSessions', 'todayHours', 'todayRevenue', 'liveTimers'],
    includeActivities: true,
    includeSessions: true,
    includeAlerts: true,
    refreshInterval: 30
  };

  console.log(`📤 Getting real-time analytics:`, analyticsConfig);

  try {
    const response = await makeRequest(`${API_BASE_URL}/analytics/real-time`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: analyticsConfig
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
      console.log(`⏱️ Live Timers: ${analytics.metrics.liveTimers}`);
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
 * Test performance monitoring
 */
async function testPerformanceMonitoring(accessToken) {
  console.log(`\n🔧 TESTING PERFORMANCE MONITORING`);
  console.log('='.repeat(60));

  const monitorConfig = {
    timeframe: 'day',
    metrics: ['system', 'api', 'database', 'user'],
    includeRecommendations: true,
    includeAlerts: true,
    includeComparisons: true
  };

  console.log(`📤 Getting performance monitoring:`, monitorConfig);

  try {
    const response = await makeRequest(`${API_BASE_URL}/analytics/performance`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: monitorConfig
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
 * Test report export functionality
 */
async function testReportExport(accessToken, reportData) {
  console.log(`\n📤 TESTING REPORT EXPORT`);
  console.log('='.repeat(60));

  const exportConfig = {
    reportData: reportData,
    format: 'pdf',
    options: {
      includeCharts: true,
      includeRawData: true,
      orientation: 'portrait',
      pageSize: 'A4'
    },
    delivery: {
      email: ['bhardwick@aerotage.com'],
      subject: 'Test Report Export',
      message: 'This is a test export from the automated test script',
      downloadLink: true,
      expiresIn: 24
    }
  };

  console.log(`📤 Exporting report:`, exportConfig);

  try {
    const response = await makeRequest(`${API_BASE_URL}/reports/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: exportConfig
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.message) {
      console.log(`✅ Report export endpoint working (placeholder implementation)!`);
      console.log(`📋 Message: ${response.body.message}`);
      
      return {
        success: true,
        exportResult: response.body
      };
    } else {
      console.log(`❌ Report export failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Report export error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test advanced filtering
 */
async function testAdvancedFiltering(accessToken) {
  console.log(`\n🔍 TESTING ADVANCED FILTERING`);
  console.log('='.repeat(60));

  const filterConfig = {
    dataSource: 'time-entries',
    filters: [
      {
        field: 'billable',
        operator: 'equals',
        value: true,
        logicalOperator: 'AND'
      },
      {
        field: 'hours',
        operator: 'greater_than',
        value: 1,
        logicalOperator: 'AND'
      },
      {
        field: 'startDate',
        operator: 'date_range',
        value: '2024-01-01',
        secondValue: '2024-12-31'
      }
    ],
    groupBy: {
      fields: ['projectId'],
      dateGrouping: 'month'
    },
    aggregations: [
      {
        field: 'hours',
        function: 'sum',
        alias: 'total_hours'
      },
      {
        field: 'hours',
        function: 'avg',
        alias: 'avg_hours'
      }
    ],
    sorting: [
      {
        field: 'total_hours',
        direction: 'desc'
      }
    ],
    pagination: {
      limit: 50,
      offset: 0
    },
    outputFormat: 'detailed'
  };

  console.log(`📤 Applying advanced filters:`, filterConfig);

  try {
    const response = await makeRequest(`${API_BASE_URL}/analytics/filter`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: filterConfig
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const filterResult = response.body.data;
      console.log(`✅ Advanced filtering completed successfully!`);
      console.log(`🆔 Filter ID: ${filterResult.filterId}`);
      console.log(`📊 Result Count: ${filterResult.resultCount}`);
      console.log(`⏱️ Execution Time: ${filterResult.executionTime}ms`);
      console.log(`📈 Data Points: ${filterResult.data.length}`);
      
      return {
        success: true,
        filterResult
      };
    } else {
      console.log(`❌ Advanced filtering failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Advanced filtering error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test report scheduling
 */
async function testReportScheduling(accessToken, reportConfigId) {
  console.log(`\n📅 TESTING REPORT SCHEDULING`);
  console.log('='.repeat(60));

  const scheduleConfig = {
    reportConfigId: reportConfigId || 'test-config-id',
    schedule: {
      frequency: 'weekly',
      time: '09:00',
      timezone: 'America/New_York',
      dayOfWeek: 1, // Monday
      startDate: '2024-01-01',
      endDate: '2024-12-31'
    },
    delivery: {
      recipients: ['bhardwick@aerotage.com'],
      subject: 'Weekly Time Report',
      message: 'Your weekly time report is ready',
      format: 'pdf',
      includeAttachment: true,
      includeDownloadLink: true
    },
    enabled: true
  };

  console.log(`📤 Creating report schedule:`, scheduleConfig);

  try {
    const response = await makeRequest(`${API_BASE_URL}/reports/schedule`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: scheduleConfig
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 201 && response.body.success) {
      const scheduleResult = response.body.data;
      console.log(`✅ Report scheduling completed successfully!`);
      console.log(`🆔 Schedule ID: ${scheduleResult.scheduleId}`);
      console.log(`📊 Status: ${scheduleResult.status}`);
      console.log(`⏰ Next Run: ${scheduleResult.nextRun}`);
      
      return {
        success: true,
        scheduleResult
      };
    } else {
      console.log(`❌ Report scheduling failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Report scheduling error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test analytics event tracking
 */
async function testAnalyticsEventTracking(accessToken) {
  console.log(`\n📈 TESTING ANALYTICS EVENT TRACKING`);
  console.log('='.repeat(60));

  const eventData = {
    eventType: 'user_action',
    action: 'test_script_execution',
    metadata: {
      scriptName: 'test-phase6-endpoints.js',
      timestamp: new Date().toISOString(),
      userAgent: 'Node.js Test Script',
      testPhase: 'phase6'
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

    if (response.statusCode === 201 && response.body.success) {
      const trackingResult = response.body.data;
      console.log(`✅ Analytics event tracked successfully!`);
      console.log(`🆔 Event ID: ${trackingResult.eventId}`);
      console.log(`⏰ Timestamp: ${trackingResult.timestamp}`);
      console.log(`📊 Message: ${trackingResult.message}`);
      
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
 * Complete test flow for Phase 6
 */
async function runPhase6Tests() {
  console.log(`\n🚀 TESTING PHASE 6 - REPORTING & ANALYTICS`);
  console.log('='.repeat(80));
  console.log(`📧 Test User: ${TEST_USER.email}`);
  console.log(`🕐 Test Time: ${new Date().toISOString()}`);
  console.log(`🌐 API Base URL: ${API_BASE_URL}`);

  const testResults = {
    authentication: false,
    generateTimeReport: false,
    generateProjectReport: false,
    generateClientReport: false,
    enhancedDashboard: false,
    realTimeAnalytics: false,
    performanceMonitoring: false,
    reportExport: false,
    advancedFiltering: false,
    reportScheduling: false,
    analyticsEventTracking: false
  };

  let generatedReport = null;

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

    // Step 2: Generate Time Report
    console.log(`\n📊 Step 2: Generate Time Report`);
    const timeReportResult = await testGenerateTimeReport(accessToken);
    testResults.generateTimeReport = timeReportResult.success;
    if (timeReportResult.success) {
      generatedReport = timeReportResult.report;
    }

    // Step 3: Generate Project Report
    console.log(`\n📁 Step 3: Generate Project Report`);
    const projectReportResult = await testGenerateProjectReport(accessToken);
    testResults.generateProjectReport = projectReportResult.success;

    // Step 4: Generate Client Report
    console.log(`\n🏢 Step 4: Generate Client Report`);
    const clientReportResult = await testGenerateClientReport(accessToken);
    testResults.generateClientReport = clientReportResult.success;

    // Step 5: Enhanced Dashboard
    console.log(`\n📊 Step 5: Enhanced Dashboard`);
    const dashboardResult = await testEnhancedDashboard(accessToken);
    testResults.enhancedDashboard = dashboardResult.success;

    // Step 6: Real-Time Analytics
    console.log(`\n⚡ Step 6: Real-Time Analytics`);
    const realTimeResult = await testRealTimeAnalytics(accessToken);
    testResults.realTimeAnalytics = realTimeResult.success;

    // Step 7: Performance Monitoring
    console.log(`\n🔧 Step 7: Performance Monitoring`);
    const performanceResult = await testPerformanceMonitoring(accessToken);
    testResults.performanceMonitoring = performanceResult.success;

    // Step 8: Report Export
    if (generatedReport) {
      console.log(`\n📤 Step 8: Report Export`);
      const exportResult = await testReportExport(accessToken, generatedReport);
      testResults.reportExport = exportResult.success;
    }

    // Step 9: Advanced Filtering
    console.log(`\n🔍 Step 9: Advanced Filtering`);
    const filteringResult = await testAdvancedFiltering(accessToken);
    testResults.advancedFiltering = filteringResult.success;

    // Step 10: Report Scheduling
    console.log(`\n📅 Step 10: Report Scheduling`);
    const schedulingResult = await testReportScheduling(accessToken);
    testResults.reportScheduling = schedulingResult.success;

    // Step 11: Analytics Event Tracking
    console.log(`\n📈 Step 11: Analytics Event Tracking`);
    const trackingResult = await testAnalyticsEventTracking(accessToken);
    testResults.analyticsEventTracking = trackingResult.success;

  } catch (error) {
    console.error(`\n❌ TEST FAILED WITH ERROR:`, error);
  }

  // Summary
  console.log(`\n📊 PHASE 6 TEST SUMMARY`);
  console.log('='.repeat(80));
  
  const testSteps = [
    { name: 'Authentication', result: testResults.authentication },
    { name: 'Generate Time Report', result: testResults.generateTimeReport },
    { name: 'Generate Project Report', result: testResults.generateProjectReport },
    { name: 'Generate Client Report', result: testResults.generateClientReport },
    { name: 'Enhanced Dashboard', result: testResults.enhancedDashboard },
    { name: 'Real-Time Analytics', result: testResults.realTimeAnalytics },
    { name: 'Performance Monitoring', result: testResults.performanceMonitoring },
    { name: 'Report Export', result: testResults.reportExport },
    { name: 'Advanced Filtering', result: testResults.advancedFiltering },
    { name: 'Report Scheduling', result: testResults.reportScheduling },
    { name: 'Analytics Event Tracking', result: testResults.analyticsEventTracking }
  ];

  testSteps.forEach(step => {
    const status = step.result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${step.name}`);
  });

  const passedTests = testSteps.filter(step => step.result).length;
  const totalTests = testSteps.length;
  
  console.log(`\n🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log(`🎉 ALL PHASE 6 ENDPOINTS ARE WORKING CORRECTLY!`);
  } else {
    console.log(`🚨 Some tests failed. Please review the output above for details.`);
  }

  return testResults;
}

// CLI interface
if (require.main === module) {
  console.log(`
🧪 Phase 6 Endpoint Test Suite

This script will test all Phase 6 endpoints:
- Time Report Generation
- Project Report Generation  
- Client Report Generation
- Enhanced Dashboard
- Real-Time Analytics
- Performance Monitoring
- Report Export (PDF/CSV/Excel)
- Advanced Filtering
- Report Scheduling
- Analytics Event Tracking

Using test credentials:
- Email: ${TEST_USER.email}
- API: ${API_BASE_URL}

Starting tests...
`);

  runPhase6Tests();
}

module.exports = {
  runPhase6Tests,
  testGenerateTimeReport,
  testGenerateProjectReport,
  testGenerateClientReport,
  testEnhancedDashboard,
  testRealTimeAnalytics,
  testPerformanceMonitoring,
  testReportExport,
  testAdvancedFiltering,
  testReportScheduling,
  testAnalyticsEventTracking
}; 