#!/usr/bin/env node

const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');

// Configuration
const COGNITO_CLIENT_ID = '148r35u6uultp1rmfdu22i8amb';
const COGNITO_REGION = 'us-east-1';

// Test credentials
const TEST_EMAIL = 'bhardwick@aerotage.com';
const TEST_PASSWORD = 'Aerotage*2025';

/**
 * Decode JWT token (without verification - for debugging only)
 */
function decodeJwtToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    // Decode header
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    
    // Decode payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    
    return { header, payload };
  } catch (error) {
    console.error('Error decoding JWT:', error.message);
    return null;
  }
}

/**
 * Get and analyze JWT token
 */
async function debugJwtToken() {
  const client = new CognitoIdentityProviderClient({ region: COGNITO_REGION });
  
  try {
    console.log('🔐 Getting JWT token...');
    console.log(`Email: ${TEST_EMAIL}`);
    
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: TEST_EMAIL,
        PASSWORD: TEST_PASSWORD,
      },
    });

    const response = await client.send(command);
    
    if (response.AuthenticationResult?.AccessToken) {
      const accessToken = response.AuthenticationResult.AccessToken;
      const idToken = response.AuthenticationResult.IdToken;
      
      console.log('✅ JWT tokens obtained successfully\n');
      
      // Decode Access Token
      console.log('📋 ACCESS TOKEN ANALYSIS:');
      console.log('=' .repeat(50));
      const accessDecoded = decodeJwtToken(accessToken);
      if (accessDecoded) {
        console.log('Header:', JSON.stringify(accessDecoded.header, null, 2));
        console.log('\nPayload:', JSON.stringify(accessDecoded.payload, null, 2));
        
        // Check for role information
        const payload = accessDecoded.payload;
        console.log('\n🔍 KEY INFORMATION:');
        console.log(`- User ID (sub): ${payload.sub || 'NOT FOUND'}`);
        console.log(`- Email: ${payload.email || 'NOT FOUND'}`);
        console.log(`- Username: ${payload.username || 'NOT FOUND'}`);
        console.log(`- Role (custom:role): ${payload['custom:role'] || 'NOT FOUND'}`);
        console.log(`- Team ID (custom:teamId): ${payload['custom:teamId'] || 'NOT FOUND'}`);
        console.log(`- Department (custom:department): ${payload['custom:department'] || 'NOT FOUND'}`);
        console.log(`- Token Use: ${payload.token_use || 'NOT FOUND'}`);
        console.log(`- Client ID: ${payload.client_id || 'NOT FOUND'}`);
      }
      
      // Decode ID Token
      if (idToken) {
        console.log('\n\n📋 ID TOKEN ANALYSIS:');
        console.log('=' .repeat(50));
        const idDecoded = decodeJwtToken(idToken);
        if (idDecoded) {
          console.log('Header:', JSON.stringify(idDecoded.header, null, 2));
          console.log('\nPayload:', JSON.stringify(idDecoded.payload, null, 2));
          
          // Check for role information in ID token
          const idPayload = idDecoded.payload;
          console.log('\n🔍 KEY INFORMATION:');
          console.log(`- User ID (sub): ${idPayload.sub || 'NOT FOUND'}`);
          console.log(`- Email: ${idPayload.email || 'NOT FOUND'}`);
          console.log(`- Role (custom:role): ${idPayload['custom:role'] || 'NOT FOUND'}`);
          console.log(`- Team ID (custom:teamId): ${idPayload['custom:teamId'] || 'NOT FOUND'}`);
          console.log(`- Department (custom:department): ${idPayload['custom:department'] || 'NOT FOUND'}`);
          console.log(`- Token Use: ${idPayload.token_use || 'NOT FOUND'}`);
        }
      }
      
      // Check what the authorizer would see
      console.log('\n\n🔧 AUTHORIZER CONTEXT ANALYSIS:');
      console.log('=' .repeat(50));
      const authPayload = accessDecoded?.payload || {};
      console.log('What the custom authorizer would extract:');
      console.log(`- userId: ${authPayload.sub || 'MISSING'}`);
      console.log(`- email: ${authPayload.email || 'MISSING'}`);
      console.log(`- role: ${authPayload['custom:role'] || 'employee (default)'}`);
      console.log(`- teamId: ${authPayload['custom:teamId'] || 'MISSING'}`);
      console.log(`- department: ${authPayload['custom:department'] || 'MISSING'}`);
      
      // Determine if user can access user management endpoints
      const userRole = authPayload['custom:role'] || 'employee';
      console.log('\n🚦 ACCESS PERMISSIONS:');
      console.log(`- Current role: ${userRole}`);
      console.log(`- Can list users: ${userRole === 'admin' || userRole === 'manager' ? '✅ YES' : '❌ NO'}`);
      console.log(`- Can view own profile: ✅ YES`);
      console.log(`- Can update own profile: ✅ YES`);
      console.log(`- Can manage other users: ${userRole === 'admin' ? '✅ YES' : '❌ NO'}`);
      
    } else {
      console.error('❌ No access token received');
    }
  } catch (error) {
    console.error('❌ Failed to get JWT token:', error.message);
    if (error.name === 'NotAuthorizedException') {
      console.error('   This usually means incorrect username/password');
    }
  }
}

// Run debug
if (require.main === module) {
  debugJwtToken().catch(console.error);
}

module.exports = { debugJwtToken }; 