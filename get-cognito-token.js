#!/usr/bin/env node

const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');

// Cognito Configuration
const COGNITO_CONFIG = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_EsdlgX9Qg',
  clientId: '148r35u6uultp1rmfdu22i8amb'
};

async function getCognitoToken(email, password) {
  console.log(`🔐 Getting Cognito JWT token for: ${email}`);
  
  const client = new CognitoIdentityProviderClient({ 
    region: COGNITO_CONFIG.region 
  });
  
  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: COGNITO_CONFIG.clientId,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password
    }
  });
  
  try {
    const response = await client.send(command);
    
    if (response.AuthenticationResult && response.AuthenticationResult.IdToken) {
      const token = response.AuthenticationResult.IdToken;
      console.log(`✅ Token obtained successfully`);
      console.log(`🎫 Token length: ${token.length} characters`);
      
      // Decode token to show claims
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      console.log(`👤 User ID: ${decoded.sub}`);
      console.log(`📧 Email: ${decoded.email}`);
      console.log(`🕐 Issued: ${new Date(decoded.iat * 1000).toISOString()}`);
      console.log(`⏰ Expires: ${new Date(decoded.exp * 1000).toISOString()}`);
      
      return {
        success: true,
        token,
        userId: decoded.sub,
        email: decoded.email,
        claims: decoded
      };
    } else {
      console.log(`❌ No token in response`);
      return { success: false, error: 'No token in response' };
    }
  } catch (error) {
    console.log(`❌ Authentication failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
🔐 Cognito Token Generator

Usage: node get-cognito-token.js <email> <password>

Example:
  node get-cognito-token.js user@example.com password123
`);
    process.exit(1);
  }

  const [email, password] = args;
  getCognitoToken(email, password);
}

module.exports = { getCognitoToken }; 