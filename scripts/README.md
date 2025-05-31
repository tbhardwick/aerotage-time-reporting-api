# Scripts Directory

## 🚨 **CRITICAL: Development Patterns Authority**

**⚠️ MANDATORY**: All scripts must follow `.cursor/rules/aerotage-api-project-rule.mdc` (**SINGLE SOURCE OF TRUTH**) for:
- **Authentication patterns** (MANDATORY `getCognitoToken()` with AccessToken)
- **Database access** (MANDATORY repository pattern - NO direct DynamoDB)
- **Infrastructure assumptions** (8-stack architecture)
- **Testing patterns** (Standardized error handling and validation)

## 📁 **Operational & Testing Scripts**

This directory contains all operational scripts, testing utilities, and automation tools for the Aerotage Time Reporting API. These scripts support development, testing, deployment, and maintenance workflows.

## 🎯 **PRIMARY TESTING SCRIPT**

### **🧪 [test-all-endpoints.js](./test-all-endpoints.js) - COMPREHENSIVE API TESTING**

**⭐ RECOMMENDED**: This is the primary testing script that comprehensively tests all API endpoints across all functional domains.

```bash
# Run comprehensive endpoint testing
node scripts/test-all-endpoints.js
```

**Features:**
- ✅ **100% Test Coverage**: Tests all major functional domains
- 🔐 **Authentication Testing**: Validates Cognito token acquisition
- 📊 **Detailed Reporting**: Comprehensive test results with pass/fail statistics
- 🎯 **Domain-Specific Testing**: Organized by functional areas
- 🚀 **Production Ready**: Uses standardized authentication patterns

**Test Domains Covered:**
- Authentication & Health
- User Management & Profiles
- User Preferences & Sessions
- Projects & Clients
- Time Entries & Reports
- Analytics & Invoices

## 📋 **Utility Scripts**

### **🔐 Authentication & Setup**
- **[get-cognito-token.js](./get-cognito-token.js)** - MANDATORY authentication helper (used by all test scripts)
- **[setup-admin-user.sh](./setup-admin-user.sh)** - Admin user creation and configuration
- **[create-admin-user-record.js](./create-admin-user-record.js)** - Admin user DynamoDB record creation
- **[create-admin-dynamodb-record.sh](./create-admin-dynamodb-record.sh)** - Admin user database setup
- **[setup-admin-user-complete.sh](./setup-admin-user-complete.sh)** - Complete admin user setup
- **[create-test-users-manual.sh](./create-test-users-manual.sh)** - Manual test user creation

### **🔧 Build & Documentation**
- **[build-openapi.js](./build-openapi.js)** - OpenAPI specification builder
- **[update-documentation.js](./update-documentation.js)** - Documentation update automation
- **[update-api-urls.js](./update-api-urls.js)** - API URL configuration updates
- **[update-openapi-domains.sh](./update-openapi-domains.sh)** - OpenAPI domain updates

### **🌐 Domain & Deployment Management**
- **[deploy-custom-domain.sh](./deploy-custom-domain.sh)** - Custom domain deployment
- **[rollback-custom-domain.sh](./rollback-custom-domain.sh)** - Custom domain rollback
- **[test-domain-setup.sh](./test-domain-setup.sh)** - Domain setup validation
- **[verify-deployment.sh](./verify-deployment.sh)** - Deployment verification
- **[update-test-scripts-domains.sh](./update-test-scripts-domains.sh)** - Test script domain updates

### **📊 Analysis & Monitoring**
- **[analyze-auth-requirements.sh](./analyze-auth-requirements.sh)** - Authentication requirements analysis
- **[audit-dynamodb-gsi-capacity.sh](./audit-dynamodb-gsi-capacity.sh)** - DynamoDB GSI capacity auditing
- **[get-api-endpoints.sh](./get-api-endpoints.sh)** - API endpoint discovery and listing

### **🔧 Infrastructure & Maintenance**
- **[recreate-time-entries-table.sh](./recreate-time-entries-table.sh)** - Time entries table recreation
- **[integrate-typescript-fixes.sh](./integrate-typescript-fixes.sh)** - TypeScript integration fixes
- **[fix-test-authentication-conflicts.sh](./fix-test-authentication-conflicts.sh)** - Authentication conflict resolution

### **📊 Configuration & Data**
- **[api-outputs.json](./api-outputs.json)** - API deployment outputs and configuration

## 🚀 **Quick Start Guide**

### **🎯 Primary Testing Workflow**

```bash
# 1. Run comprehensive endpoint testing (RECOMMENDED)
node scripts/test-all-endpoints.js

# 2. Build/update OpenAPI documentation
node scripts/build-openapi.js dev https://time-api-dev.aerotage.com

# 3. Verify deployment status
bash scripts/verify-deployment.sh
```

### **🔧 Setup & Configuration**

```bash
# Set up admin user (if needed)
bash scripts/setup-admin-user-complete.sh

# Get current API endpoints
bash scripts/get-api-endpoints.sh

# Update documentation
node scripts/update-documentation.js
```

### **🌐 Domain Management**

```bash
# Deploy custom domain
bash scripts/deploy-custom-domain.sh

# Test domain setup
bash scripts/test-domain-setup.sh

# Rollback domain (if needed)
bash scripts/rollback-custom-domain.sh
```

## 📊 **Script Categories**

### **🎯 By Purpose**

#### **Primary Testing**
- **test-all-endpoints.js** - Comprehensive API endpoint testing (RECOMMENDED)

#### **Authentication & Setup**
- User management and authentication setup
- Admin user creation and configuration
- Test user management

#### **Build & Documentation**
- OpenAPI specification generation
- Documentation updates and maintenance
- API URL configuration management

#### **Infrastructure & Deployment**
- Custom domain management
- Deployment verification and validation
- Infrastructure maintenance and monitoring

### **🔧 By Technology**

#### **Node.js Scripts (.js)**
- **test-all-endpoints.js** - Primary testing script
- **get-cognito-token.js** - Authentication helper (MANDATORY for all tests)
- **build-openapi.js** - Documentation generation
- **update-documentation.js** - Documentation maintenance

#### **Shell Scripts (.sh)**
- Environment setup and configuration
- Infrastructure management commands
- Domain and deployment management
- System administration utilities

## 🔐 **Authentication Requirements**

### **🚨 MANDATORY Test Authentication Pattern**
**⚠️ CRITICAL**: Follow `.cursor/rules/aerotage-api-project-rule.mdc` (**SINGLE SOURCE OF TRUTH**) for authentication patterns.

All test scripts MUST use this MANDATORY pattern:

```javascript
const { getCognitoToken } = require('./get-cognito-token');

async function testEndpoints() {
  const authResult = await getCognitoToken('bhardwick@aerotage.com', 'Aerotage*2025');
  const token = authResult.AccessToken; // USE AccessToken, NOT IdToken
  
  const response = await makeRequest(`${API_BASE_URL}/endpoint`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
}
```

### **Configuration Requirements**
```javascript
const CONFIG = {
  API_BASE_URL: 'https://time-api-dev.aerotage.com',
  COGNITO_CLIENT_ID: '148r35u6uultp1rmfdu22i8amb',
  COGNITO_USER_POOL_ID: 'us-east-1_EsdlgX9Qg',
  TEST_USER: {
    email: 'bhardwick@aerotage.com',
    password: 'Aerotage*2025'
  }
};
```

## 📈 **Testing Best Practices**

### **🎯 Recommended Testing Flow**
1. **Start with comprehensive testing**: `node scripts/test-all-endpoints.js`
2. **Verify specific functionality** if issues are found
3. **Update documentation** after changes: `node scripts/build-openapi.js`
4. **Validate deployment**: `bash scripts/verify-deployment.sh`

### **🔧 Development Workflow**
1. **Environment Setup**: Use setup scripts for initial configuration
2. **Primary Testing**: Always use `test-all-endpoints.js` for validation
3. **Documentation**: Keep OpenAPI docs updated with `build-openapi.js`
4. **Deployment**: Use domain management scripts for production deployment

## 📝 **Notes**

- **Script Cleanup**: Redundant testing scripts have been removed in favor of the comprehensive `test-all-endpoints.js`
- **Authentication**: All scripts use the standardized `get-cognito-token.js` helper
- **Documentation**: OpenAPI documentation is automatically updated with environment-specific URLs
- **Deployment**: Custom domain management is fully automated through shell scripts

## 📚 **Related Documentation**

### **Core Documentation**
- **[API Reference](../docs/API_REFERENCE.md)** - Complete endpoint documentation
- **[Project Status](../docs/PROJECT_STATUS.md)** - Current implementation status
- **[Frontend Integration](../docs/FRONTEND_INTEGRATION_GUIDE.md)** - Integration guide

### **Testing Documentation**
- **[README-PHASE7-TESTING.md](./README-PHASE7-TESTING.md)** - Detailed Phase 7 testing guide
- **[Authentication Test Results](../docs/testing/AUTHENTICATION_FIX_TEST_RESULTS.md)** - Testing validation

### **Development Documentation**
- **[Project Organization](../PROJECT_ORGANIZATION.md)** - File structure guide
- **[Development Guide](../docs/DEVELOPMENT.md)** - Development setup
- **[Troubleshooting](../docs/TROUBLESHOOTING.md)** - Issue resolution

## 🎯 **Best Practices**

### **Script Development**
1. **Consistent Configuration**: Use standardized config patterns
2. **Error Handling**: Implement comprehensive error handling
3. **Logging**: Include detailed logging for debugging
4. **Documentation**: Document script purpose and usage
5. **Testing**: Test scripts in multiple environments

### **Testing Practices**
1. **Incremental Testing**: Start with basic connectivity
2. **Comprehensive Coverage**: Test all business functions
3. **Error Scenarios**: Include negative testing
4. **Performance Validation**: Monitor response times
5. **Security Testing**: Validate authentication and authorization

### **Maintenance**
1. **Regular Updates**: Keep scripts current with API changes
2. **Version Control**: Track script changes with git
3. **Documentation**: Update documentation with script changes
4. **Cleanup**: Remove obsolete scripts and test data
5. **Monitoring**: Monitor script performance and reliability

---

## 🎉 **Complete Testing Suite**

The scripts directory provides a **comprehensive testing and operational suite** for the Aerotage Time Reporting API:

### **✅ What's Available**
- **Complete Business Function Testing**: All 46+ API endpoints
- **Phase-Specific Validation**: Individual phase testing capabilities
- **Environment Management**: Setup and configuration automation
- **Documentation Generation**: Automated documentation updates
- **Integration Testing**: End-to-end workflow validation

### **🚀 Production Ready**
All scripts support the **complete business management solution** with:
- **Time Tracking & Approval Workflows**
- **Project & Client Management**
- **Reporting & Business Intelligence**
- **Complete Invoicing & Billing System**
- **User Management & Security**

Use these scripts to validate, test, and maintain your Aerotage Time Reporting API deployment.

---

**Last Updated**: May 27, 2025  
**Scripts Version**: 2.0  
**API Coverage**: ✅ **All Phases 1-7 Complete**  
**Total Scripts**: 18 | **Test Coverage**: 46+ Endpoints 