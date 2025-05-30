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
        'User-Agent': 'Enhanced-Bootstrap-Test/1.0',
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
 * Test bootstrap scenario with MANDATORY authentication pattern
 */
async function testBootstrapScenario(accessToken, scenarioName, testData) {
  console.log(`\n🚀 TESTING SCENARIO: ${scenarioName}`);
  console.log('='.repeat(scenarioName.length + 21));
  
  try {
    // Decode token to get user ID (MANDATORY pattern)
    const tokenParts = accessToken.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
    const userId = payload.sub;
    
    const result = await makeRequest(
      `${API_BASE_URL}/users/${userId}/sessions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: testData
      }
    );
    
    console.log(`\n📊 SCENARIO RESULT: ${result.status}`);
    
    if (result.status === 200 || result.status === 201) {
      console.log('🎉 SUCCESS: Bootstrap worked!');
      return { success: true, result };
    } else {
      console.log(`❌ FAILED: Status ${result.status}`);
      return { success: false, result };
    }
    
  } catch (error) {
    console.log('❌ FAILED: Network error -', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Run comprehensive bootstrap tests with MANDATORY authentication
 */
async function runBootstrapTests() {
  console.log('🔬 ENHANCED BOOTSTRAP TESTING WITH STANDARDIZED AUTH');
  console.log('====================================================');
  
  try {
    // Step 1: Authenticate using MANDATORY pattern
    console.log('🔐 Step 1: Authenticate with standardized pattern');
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    const accessToken = authResult.AccessToken; // MANDATORY: Use AccessToken
    
    console.log('✅ Authentication successful with standardized pattern');
    
    // Step 2: Test bootstrap scenarios
    const testScenarios = [
      {
        name: 'Standard Bootstrap Request',
        data: {
          userAgent: 'Enhanced-Bootstrap-Test/1.0',
          loginTime: new Date().toISOString()
        }
      },
      {
        name: 'Bootstrap with All Fields',
        data: {
          userAgent: 'Enhanced-Bootstrap-Test/1.0-Full',
          loginTime: new Date().toISOString(),
          ipAddress: '192.168.1.100'
        }
      }
    ];
    
    const results = [];
    for (const scenario of testScenarios) {
      const result = await testBootstrapScenario(accessToken, scenario.name, scenario.data);
      results.push({ scenario: scenario.name, ...result });
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Results summary
    const successfulTests = results.filter(r => r.success);
    console.log(`\n📊 RESULTS: ${successfulTests.length}/${results.length} tests passed`);
    
    if (successfulTests.length > 0) {
      console.log('🎉 BOOTSTRAP IS WORKING WITH STANDARDIZED AUTH!');
    } else {
      console.log('❌ Bootstrap tests failed - check API and authentication');
    }
    
  } catch (error) {
    console.error('💥 CRITICAL ERROR:', error.message);
  }
}

if (require.main === module) {
  runBootstrapTests().catch(console.error);
}

module.exports = { runBootstrapTests };
