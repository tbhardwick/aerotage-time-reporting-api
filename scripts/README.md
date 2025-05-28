# Scripts Directory

## 📁 **Operational & Testing Scripts**

This directory contains all operational scripts, testing utilities, and automation tools for the Aerotage Time Reporting API. These scripts support development, testing, deployment, and maintenance workflows.

## 📋 **Available Scripts**

### **🧪 API Testing Scripts**

#### **Core Business Function Tests**
- **[test-invoices.js](./test-invoices.js)** - Complete invoicing and billing system testing
- **[test-invoices-quick.js](./test-invoices-quick.js)** - Quick invoice functionality validation
- **[test-time-entries.js](./test-time-entries.js)** - Time tracking and approval workflow testing

#### **Phase-Specific Integration Tests**
- **[test-phase5-endpoints.js](./test-phase5-endpoints.js)** - Project and client management testing
- **[test-phase6-core.js](./test-phase6-core.js)** - Reporting and analytics core testing
- **[test-phase6-endpoints.js](./test-phase6-endpoints.js)** - Complete reporting endpoints testing

#### **Integration & Bootstrap Tests**
- **[test-live-bootstrap.js](./test-live-bootstrap.js)** - Live environment bootstrap testing
- **[test-bootstrap-direct.js](./test-bootstrap-direct.js)** - Direct bootstrap functionality testing
- **[test-simple-curl.sh](./test-simple-curl.sh)** - Basic API connectivity testing

### **⚙️ Setup & Configuration Scripts**

#### **Environment Setup**
- **[setup-admin-user.sh](./setup-admin-user.sh)** - Admin user creation and configuration
- **[create-test-users-manual.sh](./create-test-users-manual.sh)** - Manual test user creation

#### **Infrastructure Management**
- **[recreate-time-entries-table.sh](./recreate-time-entries-table.sh)** - Time entries table recreation
- **[get-api-endpoints.sh](./get-api-endpoints.sh)** - API endpoint discovery and listing

### **🔧 Build & Documentation Scripts**

#### **Documentation Generation**
- **[build-openapi.js](./build-openapi.js)** - OpenAPI specification builder
- **[update-documentation.js](./update-documentation.js)** - Documentation update automation
- **[update-api-urls.js](./update-api-urls.js)** - API URL configuration updates

### **📊 Test Data & Legacy Files**
- **[api-outputs.json](./api-outputs.json)** - Legacy API test output data

## 🚀 **Quick Start Guide**

### **Running API Tests**

#### **Complete Business Function Testing**
```bash
# Test all invoice and billing functionality
npm run test:invoices

# Quick invoice functionality check
npm run test:invoices:quick

# Test time tracking and approval workflows
npm run test:time-entries

# Test all API endpoints
npm run test:api
```

#### **Phase-Specific Testing**
```bash
# Test project and client management (Phase 5)
node scripts/test-phase5-endpoints.js

# Test reporting and analytics (Phase 6)
node scripts/test-phase6-core.js
node scripts/test-phase6-endpoints.js
```

#### **Basic Connectivity Testing**
```bash
# Quick API connectivity check
bash scripts/test-simple-curl.sh

# Live environment bootstrap test
node scripts/test-live-bootstrap.js
```

### **Environment Setup**
```bash
# Set up admin user
bash scripts/setup-admin-user.sh

# Create test users manually
bash scripts/create-test-users-manual.sh

# Get current API endpoints
bash scripts/get-api-endpoints.sh
```

### **Documentation & Build**
```bash
# Build OpenAPI documentation
npm run build:docs
# or
node scripts/build-openapi.js

# Update all documentation
npm run update:docs
# or
node scripts/update-documentation.js
```

## 📊 **Script Categories**

### **🎯 By Purpose**

#### **Development & Testing**
- API endpoint testing and validation
- Integration testing across business functions
- Performance and load testing utilities
- Authentication and security testing

#### **Operations & Maintenance**
- Environment setup and configuration
- User management and administration
- Infrastructure maintenance and updates
- Documentation generation and updates

#### **Deployment Support**
- Environment validation and verification
- Configuration management and updates
- API endpoint discovery and documentation
- Build and deployment automation

### **🔧 By Technology**

#### **Node.js Scripts (.js)**
- API testing and integration scripts
- Documentation generation and build tools
- Configuration management utilities
- Data processing and validation tools

#### **Shell Scripts (.sh)**
- Environment setup and configuration
- Infrastructure management commands
- System administration utilities
- Quick connectivity and validation tests

## 📋 **Script Usage Patterns**

### **Testing Workflow**
1. **Basic Connectivity**: `bash test-simple-curl.sh`
2. **Core Functions**: `npm run test:api`
3. **Specific Features**: `npm run test:invoices`
4. **Integration**: `node test-live-bootstrap.js`

### **Development Workflow**
1. **Environment Setup**: `bash setup-admin-user.sh`
2. **API Testing**: `npm run test:time-entries`
3. **Documentation**: `npm run build:docs`
4. **Validation**: `bash get-api-endpoints.sh`

### **Deployment Workflow**
1. **Pre-deployment**: `node test-bootstrap-direct.js`
2. **Post-deployment**: `npm run test:api`
3. **Documentation**: `npm run update:docs`
4. **Verification**: `bash test-simple-curl.sh`

## 🔐 **Authentication Requirements**

### **Test Scripts Authentication**
Most test scripts require valid AWS Cognito credentials:

```javascript
const CONFIG = {
  API_BASE_URL: 'https://time-api-dev.aerotage.com',
  COGNITO_CLIENT_ID: '148r35u6uultp1rmfdu22i8amb',
  COGNITO_USER_POOL_ID: 'us-east-1_EsdlgX9Qg',
  TEST_USER: {
    email: 'your-email@domain.com',
    password: 'your-password'
  }
};
```

### **Required Permissions**
- **Admin/Manager Role**: For full API testing
- **Valid Cognito Account**: Active user in the user pool
- **Network Access**: Connectivity to AWS API Gateway

## 📈 **Performance Expectations**

### **Test Execution Times**
- **Quick Tests**: 30-60 seconds
- **Complete API Tests**: 2-5 minutes
- **Phase-Specific Tests**: 1-3 minutes
- **Integration Tests**: 3-10 minutes

### **Success Criteria**
- **API Response Times**: < 200ms average
- **Test Pass Rates**: > 95% success rate
- **Error Handling**: Proper error responses
- **Authentication**: 100% JWT validation

## 🐛 **Troubleshooting**

### **Common Issues**

#### **Authentication Failures**
```bash
❌ Authentication failed: Invalid credentials
```
**Solution**: Verify credentials in script configuration

#### **Network Connectivity**
```bash
❌ ENOTFOUND: API endpoint not reachable
```
**Solution**: Check API_BASE_URL and network connectivity

#### **Permission Errors**
```bash
❌ Insufficient permissions for operation
```
**Solution**: Ensure user has appropriate role (admin/manager)

#### **Environment Issues**
```bash
❌ Infrastructure not deployed
```
**Solution**: Deploy infrastructure with `npm run deploy:dev`

### **Debug Mode**
Enable detailed logging in scripts:
```javascript
// Add to any script for detailed debugging
console.log('Debug:', JSON.stringify(response, null, 2));
```

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