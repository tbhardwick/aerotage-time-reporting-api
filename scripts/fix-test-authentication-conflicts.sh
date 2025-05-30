#!/bin/bash

# 🔐 Fix Test Scripts Authentication Conflicts
# Resolves all authentication conflicts before authentication standardization

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${RED}🔐 TEST SCRIPTS AUTHENTICATION FIX${NC}"
echo -e "${YELLOW}Resolving authentication conflicts before standardization${NC}"
echo ""

# Track fix stats
TOTAL_FIXES=0
SUCCESSFUL_FIXES=0
FAILED_FIXES=0

# Standard API base URL (from cursor rules)
API_BASE_URL="https://time-api-dev.aerotage.com"

# Function to safely backup and fix a file
fix_file() {
    local file="$1"
    local description="$2"
    
    TOTAL_FIXES=$((TOTAL_FIXES + 1))
    
    if [ -f "$file" ]; then
        echo -e "${YELLOW}Fixing:${NC} $file"
        echo -e "${BLUE}  Issue:${NC} $description"
        
        # Create backup
        cp "$file" "${file}.backup"
        echo -e "${PURPLE}  ✅ Backup created: ${file}.backup${NC}"
        
        return 0
    else
        echo -e "${YELLOW}Missing:${NC} $file (already deleted or moved)"
        return 1
    fi
}

# Function to delete a conflicting file
delete_conflicting_file() {
    local file="$1"
    local reason="$2"
    
    TOTAL_FIXES=$((TOTAL_FIXES + 1))
    
    if [ -f "$file" ]; then
        echo -e "${YELLOW}Deleting:${NC} $file"
        echo -e "${BLUE}  Reason:${NC} $reason"
        rm "$file"
        SUCCESSFUL_FIXES=$((SUCCESSFUL_FIXES + 1))
        echo -e "${GREEN}  ✅ Deleted${NC}"
    else
        echo -e "${YELLOW}Missing:${NC} $file (already deleted)"
        SUCCESSFUL_FIXES=$((SUCCESSFUL_FIXES + 1))
    fi
    echo ""
}

echo -e "${BLUE}📋 PHASE 1: Delete Duplicate/Conflicting Files${NC}"
echo "=============================================="

delete_conflicting_file "scripts/get-jwt-token.js" "Duplicate implementation with wrong patterns"

echo -e "${BLUE}📋 PHASE 2: Fix test-live-bootstrap.js${NC}"
echo "========================================"

if fix_file "scripts/test-live-bootstrap.js" "Direct AWS SDK usage + IdToken + Direct DynamoDB"; then
    cat > scripts/test-live-bootstrap.js << 'EOF'
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
EOF

    SUCCESSFUL_FIXES=$((SUCCESSFUL_FIXES + 1))
    echo -e "${GREEN}  ✅ Fixed: Converted to use getCognitoToken() + AccessToken${NC}"
else
    FAILED_FIXES=$((FAILED_FIXES + 1))
fi
echo ""

echo -e "${BLUE}📋 PHASE 3: Fix test-time-entries.js${NC}"
echo "=================================="

if fix_file "scripts/test-time-entries.js" "Direct Cognito API calls + Mixed token usage"; then
    cat > scripts/test-time-entries.js << 'EOF'
#!/usr/bin/env node

const { getCognitoToken } = require('./get-cognito-token');
const https = require('https');
const { URL } = require('url');

// Configuration using MANDATORY patterns
const CONFIG = {
  API_BASE_URL: 'https://time-api-dev.aerotage.com',
  TEST_USER: {
    email: 'bhardwick@aerotage.com',
    password: 'Aerotage*2025'
  }
};

// Test data
const TEST_PROJECT_ID = 'test-project-123';
const TEST_TIME_ENTRIES = [];

// Utility functions
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

async function testCreateTimeEntry(accessToken) {
  console.log('\n📝 Testing: Create Time Entry');
  
  const timeEntryData = {
    projectId: TEST_PROJECT_ID,
    description: 'Test time entry from automated script',
    date: new Date().toISOString().split('T')[0],
    duration: 120,
    isBillable: true,
    tags: ['testing', 'automation'],
    notes: 'Created by test script'
  };

  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: timeEntryData
    });

    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 201 && response.body.success) {
      const timeEntryId = response.body.data.id;
      TEST_TIME_ENTRIES.push(timeEntryId);
      console.log('✅ Time entry created successfully:', timeEntryId);
      return timeEntryId;
    } else {
      console.log('❌ Failed to create time entry');
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating time entry:', error.message);
    return null;
  }
}

async function testListTimeEntries(accessToken) {
  console.log('\n📋 Testing: List Time Entries');
  
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/time-entries?limit=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      console.log('✅ Time entries listed successfully');
      return true;
    } else {
      console.log('❌ Failed to list time entries');
      return false;
    }
  } catch (error) {
    console.error('❌ Error listing time entries:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Time Entry API Tests with MANDATORY Auth Pattern');
  console.log('=============================================================');
  
  const results = {
    authentication: false,
    createTimeEntry: false,
    listTimeEntries: false
  };

  try {
    // Step 1: Authenticate using MANDATORY pattern
    console.log('🔐 Step 1: Authenticate using MANDATORY pattern');
    const authResult = await getCognitoToken(CONFIG.TEST_USER.email, CONFIG.TEST_USER.password);
    const accessToken = authResult.AccessToken; // MANDATORY: Use AccessToken only
    
    console.log('✅ Authentication successful with standardized pattern');
    results.authentication = true;

    // Step 2: Create time entry
    const timeEntryId = await testCreateTimeEntry(accessToken);
    results.createTimeEntry = !!timeEntryId;

    // Step 3: List time entries
    results.listTimeEntries = await testListTimeEntries(accessToken);

  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
  }

  // Print summary
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${test.padEnd(20)}: ${status}`);
  });

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  console.log(`\nOverall: ${passedTests}/${totalTests} tests passed`);
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, CONFIG };
EOF

    SUCCESSFUL_FIXES=$((SUCCESSFUL_FIXES + 1))
    echo -e "${GREEN}  ✅ Fixed: Converted to use getCognitoToken() + AccessToken only${NC}"
else
    FAILED_FIXES=$((FAILED_FIXES + 1))
fi
echo ""

echo -e "${BLUE}📋 PHASE 4: Fix test-invoices.js${NC}"
echo "============================="

if fix_file "scripts/test-invoices.js" "Direct Cognito API calls"; then
    # Get just the beginning of the file to preserve most of the functionality
    # but replace the authentication parts
    sed -i.bak '1,110c\
#!/usr/bin/env node\
\
const { getCognitoToken } = require("./get-cognito-token");\
const https = require("https");\
\
// Configuration using MANDATORY patterns\
const CONFIG = {\
  API_BASE_URL: "https://time-api-dev.aerotage.com",\
  TEST_USER: {\
    email: "bhardwick@aerotage.com",\
    password: "Aerotage*2025"\
  }\
};\
\
// Utility functions\
function makeRequest(url, options = {}) {\
  return new Promise((resolve, reject) => {\
    const urlObj = new URL(url);\
    const requestOptions = {\
      hostname: urlObj.hostname,\
      port: urlObj.port || 443,\
      path: urlObj.pathname + urlObj.search,\
      method: options.method || "GET",\
      headers: {\
        "Content-Type": "application/json",\
        ...options.headers\
      }\
    };\
\
    const req = https.request(requestOptions, (res) => {\
      let data = "";\
      res.on("data", (chunk) => data += chunk);\
      res.on("end", () => {\
        try {\
          const response = {\
            statusCode: res.statusCode,\
            headers: res.headers,\
            body: data ? JSON.parse(data) : null\
          };\
          resolve(response);\
        } catch (error) {\
          resolve({\
            statusCode: res.statusCode,\
            headers: res.headers,\
            body: data\
          });\
        }\
      });\
    });\
\
    req.on("error", reject);\
\
    if (options.body) {\
      req.write(JSON.stringify(options.body));\
    }\
\
    req.end();\
  });\
}\
\
// MANDATORY authentication function\
async function authenticateUser() {\
  console.log("🔐 Authenticating user with MANDATORY pattern...");\
  \
  try {\
    const authResult = await getCognitoToken(CONFIG.TEST_USER.email, CONFIG.TEST_USER.password);\
    const accessToken = authResult.AccessToken; // MANDATORY: Use AccessToken only\
    \
    console.log("✅ Authentication successful with standardized pattern");\
    return { accessToken };\
  } catch (error) {\
    console.error("❌ Authentication failed:", error.message);\
    throw error;\
  }\
}\
' scripts/test-invoices.js
    
    # Fix any remaining references to idToken in the file
    sed -i.bak2 's/idToken/accessToken/g' scripts/test-invoices.js
    sed -i.bak3 's/IdToken/AccessToken/g' scripts/test-invoices.js
    
    SUCCESSFUL_FIXES=$((SUCCESSFUL_FIXES + 1))
    echo -e "${GREEN}  ✅ Fixed: Converted to use getCognitoToken() + AccessToken${NC}"
else
    FAILED_FIXES=$((FAILED_FIXES + 1))
fi
echo ""

echo -e "${BLUE}📋 PHASE 5: Fix test-invoices-quick.js${NC}"
echo "====================================="

if fix_file "scripts/test-invoices-quick.js" "Direct Cognito API calls"; then
    # Replace the authentication function with MANDATORY pattern
    sed -i.bak '1,90c\
#!/usr/bin/env node\
\
const { getCognitoToken } = require("./get-cognito-token");\
const https = require("https");\
\
// Configuration using MANDATORY patterns\
const CONFIG = {\
  API_BASE_URL: "https://time-api-dev.aerotage.com",\
  TEST_USER: {\
    email: "bhardwick@aerotage.com",\
    password: "Aerotage*2025"\
  }\
};\
\
function makeRequest(url, options = {}) {\
  return new Promise((resolve, reject) => {\
    const urlObj = new URL(url);\
    const requestOptions = {\
      hostname: urlObj.hostname,\
      port: urlObj.port || 443,\
      path: urlObj.pathname + urlObj.search,\
      method: options.method || "GET",\
      headers: {\
        "Content-Type": "application/json",\
        ...options.headers\
      }\
    };\
\
    const req = https.request(requestOptions, (res) => {\
      let data = "";\
      res.on("data", (chunk) => data += chunk);\
      res.on("end", () => {\
        try {\
          resolve({\
            statusCode: res.statusCode,\
            headers: res.headers,\
            body: JSON.parse(data)\
          });\
        } catch (e) {\
          resolve({\
            statusCode: res.statusCode,\
            headers: res.headers,\
            body: data\
          });\
        }\
      });\
    });\
\
    req.on("error", reject);\
    if (options.body) {\
      req.write(JSON.stringify(options.body));\
    }\
    req.end();\
  });\
}\
\
// MANDATORY authentication function\
async function authenticate() {\
  console.log("🔐 Authenticating with MANDATORY pattern...");\
  \
  try {\
    const authResult = await getCognitoToken(CONFIG.TEST_USER.email, CONFIG.TEST_USER.password);\
    const accessToken = authResult.AccessToken; // MANDATORY: Use AccessToken only\
    \
    console.log("✅ Authentication successful with standardized pattern");\
    return accessToken;\
  } catch (error) {\
    console.error("❌ Authentication failed:", error.message);\
    throw error;\
  }\
}\
' scripts/test-invoices-quick.js
    
    # Fix API base URL references
    sed -i.bak2 's|CONFIG.COGNITO_CLIENT_ID|CONFIG.API_BASE_URL|g' scripts/test-invoices-quick.js
    sed -i.bak3 's/IdToken/AccessToken/g' scripts/test-invoices-quick.js
    
    SUCCESSFUL_FIXES=$((SUCCESSFUL_FIXES + 1))
    echo -e "${GREEN}  ✅ Fixed: Converted to use getCognitoToken() + AccessToken${NC}"
else
    FAILED_FIXES=$((FAILED_FIXES + 1))
fi
echo ""

echo -e "${BLUE}📋 PHASE 6: Standardize API Base URLs${NC}"
echo "===================================="

# List of files that should have standardized API base URL
API_URL_FILES=(
    "scripts/test-profile-endpoint.js"
    "scripts/test-session-creation.js"
    "scripts/test-phase5-endpoints.js"
    "scripts/test-phase6-core.js"
    "scripts/test-phase6-endpoints.js"
    "scripts/test-invoices-endpoint.js"
    "scripts/debug-auth.js"
    "scripts/test-daily-weekly-endpoints.js"
)

for file in "${API_URL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${YELLOW}Standardizing API URL in:${NC} $file"
        # Replace various API base URL patterns with the standard one
        sed -i.bak "s|https://.*\.execute-api\.us-east-1\.amazonaws\.com/dev|$API_BASE_URL|g" "$file"
        sed -i.bak2 "s|https://time-api-dev\.aerotage\.com|$API_BASE_URL|g" "$file"
        echo -e "${GREEN}  ✅ Standardized API base URL${NC}"
    fi
done
echo ""

echo -e "${GREEN}✅ AUTHENTICATION CONFLICTS RESOLUTION COMPLETED${NC}"
echo "================================================="
echo -e "${GREEN}Total fixes attempted: $TOTAL_FIXES${NC}"
echo -e "${GREEN}Successfully fixed: $SUCCESSFUL_FIXES${NC}"
echo -e "${RED}Failed fixes: $FAILED_FIXES${NC}"
echo ""

# Clean up backup files
echo -e "${BLUE}📁 Cleaning up backup files...${NC}"
find scripts/ -name "*.backup*" -o -name "*.bak*" | head -10 | while read backup_file; do
    if [ -f "$backup_file" ]; then
        echo -e "${YELLOW}Removing backup: $backup_file${NC}"
        rm "$backup_file"
    fi
done

echo ""
echo -e "${BLUE}📋 VERIFICATION STEPS:${NC}"
echo "======================"
echo -e "${YELLOW}1. Test a compliant script to ensure authentication works:${NC}"
echo "   ./scripts/test-profile-endpoint.js"
echo ""
echo -e "${YELLOW}2. Test a fixed script to ensure fixes work:${NC}"
echo "   ./scripts/test-time-entries.js"
echo ""
echo -e "${YELLOW}3. Verify no more authentication conflicts exist:${NC}"
echo '   grep -r "IdToken" scripts/ --include="*.js" | grep -v get-cognito-token.js'
echo ""
echo -e "${YELLOW}4. Check for remaining AWS SDK imports:${NC}"
echo '   grep -r "CognitoIdentityProviderClient\|DynamoDBClient" scripts/ --include="*.js"'
echo ""

if [ $FAILED_FIXES -eq 0 ]; then
    echo -e "${GREEN}🎯 ALL AUTHENTICATION CONFLICTS RESOLVED!${NC}"
    echo -e "${GREEN}🔐 Ready to proceed with authentication standardization${NC}"
    echo -e "${GREEN}📚 All test scripts now follow MANDATORY cursor rules patterns${NC}"
else
    echo -e "${RED}⚠️  Some fixes failed. Manual intervention may be required.${NC}"
    echo -e "${YELLOW}Check the error messages above and fix manually if needed.${NC}"
fi

echo ""
echo -e "${BLUE}📊 SUMMARY: Test scripts authentication standardized${NC}"
echo -e "${BLUE}🎯 Ready for Lambda function authentication standardization${NC}" 