#!/usr/bin/env node

const { getCognitoToken } = require('./scripts/get-cognito-token');

async function debugInvoiceAuth() {
  try {
    console.log('🔍 DEBUGGING INVOICE AUTHENTICATION\n');
    
    // Get token
    console.log('🔐 Getting JWT token...');
    const authResult = await getCognitoToken('bhardwick@aerotage.com', 'Aerotage*2025');
    
    console.log('📊 Auth Result Keys:', Object.keys(authResult));
    console.log('🎫 AccessToken length:', authResult.AccessToken?.length || 'undefined');
    console.log('🎫 IdToken length:', authResult.IdToken?.length || 'undefined');
    
    // Check if tokens are valid JWT format
    const accessTokenParts = authResult.AccessToken?.split('.') || [];
    const idTokenParts = authResult.IdToken?.split('.') || [];
    
    console.log('🔍 AccessToken parts:', accessTokenParts.length);
    console.log('🔍 IdToken parts:', idTokenParts.length);
    
    // Show first and last 20 characters of each token
    if (authResult.AccessToken) {
      const token = authResult.AccessToken;
      console.log('🎫 AccessToken preview:', 
        token.substring(0, 20) + '...' + token.substring(token.length - 20)
      );
    }
    
    if (authResult.IdToken) {
      const token = authResult.IdToken;
      console.log('🎫 IdToken preview:', 
        token.substring(0, 20) + '...' + token.substring(token.length - 20)
      );
    }
    
    // Test both tokens with a simple request
    const https = require('https');
    
    function testToken(token, tokenType) {
      return new Promise((resolve) => {
        const options = {
          hostname: 'k60bobrd9h.execute-api.us-east-1.amazonaws.com',
          port: 443,
          path: '/dev/invoices',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            resolve({
              tokenType,
              status: res.statusCode,
              response: data.substring(0, 200) // First 200 chars
            });
          });
        });

        req.on('error', (error) => {
          resolve({
            tokenType,
            status: 'ERROR',
            response: error.message
          });
        });

        req.end();
      });
    }
    
    console.log('\n🧪 Testing tokens against /invoices endpoint...\n');
    
    const accessTokenResult = await testToken(authResult.AccessToken, 'AccessToken');
    console.log('📊 AccessToken result:', accessTokenResult);
    
    const idTokenResult = await testToken(authResult.IdToken, 'IdToken');
    console.log('📊 IdToken result:', idTokenResult);
    
    // Also test against working user endpoint
    console.log('\n🧪 Testing AccessToken against /users endpoint...\n');
    
    const userTestResult = await new Promise((resolve) => {
      const options = {
        hostname: 'k60bobrd9h.execute-api.us-east-1.amazonaws.com',
        port: 443,
        path: '/dev/users',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authResult.AccessToken}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            response: data.substring(0, 200)
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          status: 'ERROR',
          response: error.message
        });
      });

      req.end();
    });
    
    console.log('📊 Users endpoint result:', userTestResult);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugInvoiceAuth(); 