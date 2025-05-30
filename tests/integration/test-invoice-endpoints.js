#!/usr/bin/env node

const { getCognitoToken } = require('../../scripts/get-cognito-token');
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
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
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
 * Test invoice endpoints
 */
async function testInvoiceEndpoints() {
  try {
    console.log('\n🧪 INVOICE ENDPOINTS TEST SUITE\n');
    console.log('Testing the following endpoints:');
    console.log('- GET /invoices');
    console.log('- POST /invoices');
    console.log('- PUT /invoices/{id}');
    console.log('- POST /invoices/{id}/send');
    console.log('- PUT /invoices/{id}/status');
    console.log('\n================================================================================\n');

    console.log('🔐 Getting JWT token...');
    
    // Get authentication token using the working method
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    const { token: accessToken } = authResult;
    
    console.log('✅ JWT token obtained successfully\n');

    // Test 1: List invoices
    console.log('📋 TESTING GET /invoices');
    console.log('============================================================');
    const listResponse = await makeRequest(`${API_BASE_URL}/invoices`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log('📡 Response Status:', listResponse.status);
    console.log('📋 Response Body:', JSON.stringify(listResponse.data, null, 2));
    
    if (listResponse.status === 200) {
      console.log('✅ List invoices endpoint working correctly');
    } else {
      console.log('❌ List invoices endpoint failed');
    }
    console.log('');

    // Test 2: Create invoice
    console.log('📝 TESTING POST /invoices');
    console.log('============================================================');
    const createInvoiceData = {
      clientId: 'test-client-123',
      projectIds: ['test-project-123'],
      timeEntryIds: [],
      additionalLineItems: [
        {
          description: 'Test Service',
          quantity: 1,
          rate: 100.00,
          amount: 100.00
        }
      ],
      paymentTerms: 'Net 30',
      currency: 'USD',
      notes: 'Test invoice creation'
    };

    const createResponse = await makeRequest(`${API_BASE_URL}/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: createInvoiceData
    });
    
    console.log('📡 Response Status:', createResponse.status);
    console.log('📋 Response Body:', JSON.stringify(createResponse.data, null, 2));
    
    let testInvoiceId = null;
    if (createResponse.status === 201 && createResponse.data.success) {
      console.log('✅ Create invoice endpoint working correctly');
      testInvoiceId = createResponse.data.data.id;
      console.log('📄 Created invoice ID:', testInvoiceId);
    } else {
      console.log('❌ Create invoice endpoint failed');
      // Use a dummy ID for remaining tests
      testInvoiceId = 'test-invoice-123';
    }
    console.log('');

    // Test 3: Update invoice (only if we have a valid invoice ID)
    if (testInvoiceId && createResponse.status === 201) {
      console.log('✏️ TESTING PUT /invoices/{id}');
      console.log('============================================================');
      const updateData = {
        notes: 'Updated test invoice notes',
        paymentTerms: 'Net 15'
      };

      const updateResponse = await makeRequest(`${API_BASE_URL}/invoices/${testInvoiceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: updateData
      });
      
      console.log('📡 Response Status:', updateResponse.status);
      console.log('📋 Response Body:', JSON.stringify(updateResponse.data, null, 2));
      
      if (updateResponse.status === 200) {
        console.log('✅ Update invoice endpoint working correctly');
      } else {
        console.log('❌ Update invoice endpoint failed');
      }
      console.log('');

      // Test 4: Send invoice
      console.log('📧 TESTING POST /invoices/{id}/send');
      console.log('============================================================');
      const sendData = {
        recipientEmail: 'test@example.com',
        subject: 'Test Invoice',
        message: 'Please find your invoice attached.'
      };

      const sendResponse = await makeRequest(`${API_BASE_URL}/invoices/${testInvoiceId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: sendData
      });
      
      console.log('📡 Response Status:', sendResponse.status);
      console.log('📋 Response Body:', JSON.stringify(sendResponse.data, null, 2));
      
      if (sendResponse.status === 200) {
        console.log('✅ Send invoice endpoint working correctly');
      } else {
        console.log('❌ Send invoice endpoint failed');
      }
      console.log('');

      // Test 5: Update invoice status
      console.log('🔄 TESTING PUT /invoices/{id}/status');
      console.log('============================================================');
      const statusData = {
        status: 'sent'
      };

      const statusResponse = await makeRequest(`${API_BASE_URL}/invoices/${testInvoiceId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: statusData
      });
      
      console.log('📡 Response Status:', statusResponse.status);
      console.log('📋 Response Body:', JSON.stringify(statusResponse.data, null, 2));
      
      if (statusResponse.status === 200) {
        console.log('✅ Update status endpoint working correctly');
      } else {
        console.log('❌ Update status endpoint failed');
      }
      console.log('');
    } else {
      console.log('⏭️ Skipping update, send, and status tests (no valid invoice created)');
      console.log('');
    }

    console.log('📊 INVOICE ENDPOINTS TEST SUMMARY');
    console.log('================================================================================');
    console.log('🎯 All invoice endpoints have been tested');
    console.log('📋 Check the responses above to see if they return placeholder data or actual functionality');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
testInvoiceEndpoints(); 