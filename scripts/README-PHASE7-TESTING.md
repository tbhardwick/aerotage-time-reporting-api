# Phase 7: Invoicing & Billing API Testing Guide

## 🎯 Overview

This guide explains how to test the Phase 7 invoicing and billing endpoints using the automated testing script. The script tests all invoice-related functionality including generation, status management, payment tracking, and business logic validation.

## 📋 Prerequisites

### 1. Authentication Setup
- Valid Cognito user account with admin/manager permissions
- User credentials configured in the test script
- Active AWS infrastructure (development environment)

### 2. Test Environment
- Node.js installed (v18+ recommended)
- Network access to the API endpoints
- Valid API base URL and Cognito configuration

## 🚀 Running the Tests

### Quick Start
```bash
# Navigate to the scripts directory
cd scripts

# Run the invoice testing script
node test-invoices.js

# Or run it directly (if executable)
./test-invoices.js
```

### Configuration
The test script uses the following configuration (modify as needed):

```javascript
const CONFIG = {
  API_BASE_URL: 'https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev',
  COGNITO_CLIENT_ID: '148r35u6uultp1rmfdu22i8amb',
  COGNITO_USER_POOL_ID: 'us-east-1_EsdlgX9Qg',
  TEST_USER: {
    email: 'your-email@domain.com',
    password: 'your-password'
  }
};
```

## 🧪 Test Coverage

### Core Invoice Operations
1. **List Invoices** - Retrieve existing invoices with pagination
2. **Generate Invoice** - Create new invoices from time entries
3. **Generate Recurring Invoice** - Create recurring invoice configurations
4. **Update Invoice** - Modify invoice details and settings
5. **Send Invoice** - Email invoice delivery functionality
6. **Update Invoice Status** - Status transition management

### Payment Operations
7. **Record Payment** - Record partial payments
8. **Record Full Payment** - Complete payment processing with fees
9. **Payment Validation** - Business logic validation

### Advanced Features
10. **Invoice Filtering** - Test various filter combinations
11. **Status Transitions** - Validate business rule enforcement
12. **Error Handling** - Test invalid operations and edge cases

## 📊 Expected Test Results

### Successful Test Run
```
🚀 Starting Invoice & Billing API Tests
=========================================

🔐 Authenticating user...
✅ Authentication successful
🔄 Creating user session...
✅ Session created successfully

📋 Testing: List Invoices
Status: 200
✅ Invoices listed successfully
Found 5 invoices

📝 Testing: Generate Invoice
Status: 201
✅ Invoice generated successfully: invoice_1234567890_abc123def
Invoice Number: INV-2024-05-001
Total Amount: $108

🔄 Testing: Generate Recurring Invoice
Status: 201
✅ Recurring invoice generated successfully: invoice_1234567890_def456ghi
Invoice Number: INV-2024-05-002
Recurring: true

✏️ Testing: Update Invoice
Status: 200
✅ Invoice updated successfully
New Due Date: 2024-07-10
New Payment Terms: Net 45

📧 Testing: Send Invoice
Status: 200
✅ Invoice sent successfully
Status: sent

🔄 Testing: Update Invoice Status
Status: 200
✅ Invoice status updated successfully
New Status: viewed

💳 Testing: Record Payment
Status: 200
✅ Payment recorded successfully
Payment Amount: $500
Payment Method: Bank Transfer
Invoice Status: viewed

💰 Testing: Record Full Payment
Status: 200
✅ Full payment recorded successfully
Payment Amount: $108
Processor Fee: $3.13
Invoice Status: paid

🔍 Testing: Invoice Filtering
  🔎 Testing filter: By Status
  Status: 200
  ✅ By Status filter works - Found 2 invoices
  
  🔎 Testing filter: By Client
  Status: 200
  ✅ By Client filter works - Found 3 invoices
  
  [... additional filter tests ...]

🔄 Testing: Invoice Status Transitions
  🔄 Testing transition: Draft to Sent
  Status: 200
  ✅ Draft to Sent transition successful
  
  [... additional transition tests ...]

🚫 Testing: Invalid Operations (Error Handling)
  🚫 Testing: Generate invoice with invalid client
  ✅ Generate invoice with invalid client correctly handled
  
  [... additional error handling tests ...]

📊 Test Results Summary
========================
authentication          : ✅ PASS
listInvoices            : ✅ PASS
generateInvoice         : ✅ PASS
generateRecurringInvoice: ✅ PASS
updateInvoice           : ✅ PASS
sendInvoice             : ✅ PASS
updateInvoiceStatus     : ✅ PASS
recordPayment           : ✅ PASS
recordFullPayment       : ✅ PASS
invoiceFiltering        : ✅ PASS
statusTransitions       : ✅ PASS
errorHandling           : ✅ PASS

Overall: 12/12 tests passed
🎉 All invoice tests passed!

📋 Test Data Summary
====================
Created Invoices: 4
Recorded Payments: 2
Invoice IDs: invoice_1234567890_abc123def, invoice_1234567890_def456ghi, ...
Payment IDs: payment_1234567890_xyz789abc, payment_1234567890_mno456pqr
```

## 🔧 Test Features

### 1. Invoice Generation
- **Basic Invoice**: Creates invoice with line items, tax, and discount
- **Recurring Invoice**: Sets up automated recurring billing
- **Time Entry Integration**: Links approved time entries to invoices
- **Financial Calculations**: Validates tax, discount, and total calculations

### 2. Payment Processing
- **Partial Payments**: Records payments less than invoice total
- **Full Payments**: Completes invoice payment with status update
- **Payment Methods**: Tests various payment method types
- **Processor Fees**: Handles payment processing fees

### 3. Status Management
- **Status Transitions**: Tests valid status changes (draft → sent → viewed → paid)
- **Business Rules**: Validates transition restrictions
- **Automatic Updates**: Verifies status changes on payment

### 4. Filtering & Search
- **Status Filtering**: Filter by invoice status
- **Client Filtering**: Filter by client ID
- **Date Range**: Filter by issue date or due date
- **Amount Range**: Filter by invoice amount
- **Recurring Filter**: Filter recurring vs one-time invoices
- **Sorting**: Sort by various fields (amount, date, status)

### 5. Error Handling
- **Invalid Data**: Tests validation of input data
- **Business Logic**: Tests business rule enforcement
- **Not Found**: Tests handling of non-existent resources
- **Unauthorized**: Tests permission validation

## 🐛 Troubleshooting

### Common Issues

#### Authentication Failures
```
❌ Authentication failed: Invalid credentials
```
**Solution**: Verify user credentials in CONFIG section

#### API Endpoint Errors
```
❌ Error listing invoices: ENOTFOUND
```
**Solution**: Check API_BASE_URL configuration and network connectivity

#### Permission Errors
```
❌ Failed to generate invoice: Insufficient permissions
```
**Solution**: Ensure test user has admin or manager role

#### Validation Errors
```
❌ Failed to generate invoice: Client ID is required
```
**Solution**: Check test data configuration (clientId, projectId)

### Debug Mode
To enable detailed debugging, modify the script to log full responses:

```javascript
// Add this to see full API responses
console.log('Full Response:', JSON.stringify(response, null, 2));
```

## 📈 Performance Expectations

### Response Times
- **List Operations**: < 200ms
- **Create Operations**: < 500ms
- **Update Operations**: < 300ms
- **Payment Operations**: < 400ms

### Success Rates
- **All Tests**: Should achieve 100% pass rate
- **Individual Operations**: > 99% success rate
- **Error Handling**: Should properly catch and handle all errors

## 🔄 Continuous Testing

### Integration with CI/CD
```bash
# Add to your CI/CD pipeline
npm test:invoices || exit 1
```

### Automated Monitoring
```bash
# Run tests every hour
0 * * * * cd /path/to/project && node scripts/test-invoices.js
```

## 📚 Related Documentation

- **[API Reference](../docs/API_REFERENCE.md)** - Complete endpoint documentation
- **[Phase 7 Implementation](../docs/PROJECT_STATUS.md)** - Implementation status
- **[Frontend Integration](../docs/FRONTEND_INTEGRATION_GUIDE.md)** - Integration guide
- **[Troubleshooting](../docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🎯 Next Steps

After successful testing:

1. **Frontend Integration**: Use test results to guide frontend implementation
2. **Production Testing**: Run tests against staging environment
3. **Performance Testing**: Conduct load testing with multiple concurrent requests
4. **Security Testing**: Validate authentication and authorization
5. **User Acceptance Testing**: Conduct end-to-end business workflow testing

## 📞 Support

For issues with the testing script or API endpoints:

1. Check the troubleshooting section above
2. Review the API documentation
3. Check CloudWatch logs for detailed error information
4. Verify infrastructure deployment status

---

**Last Updated**: May 26, 2025  
**Script Version**: 1.0  
**API Version**: Phase 7 Complete 