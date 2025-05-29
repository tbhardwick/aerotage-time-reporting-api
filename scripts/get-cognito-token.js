#!/usr/bin/env node

/**
 * Get Cognito Token Helper
 * This module provides authentication functionality for test scripts
 */

const https = require('https');

// Cognito Configuration
const COGNITO_CONFIG = {
  userPoolId: 'us-east-1_EsdlgX9Qg',
  clientId: '148r35u6uultp1rmfdu22i8amb',
  region: 'us-east-1'
};

/**
 * Make AWS Cognito request
 */
function makeAwsRequest(service, target, payload) {
  return new Promise((resolve, reject) => {
    const jsonPayload = JSON.stringify(payload);
    
    const options = {
      hostname: `cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com`,
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': target,
        'Content-Length': Buffer.byteLength(jsonPayload)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (res.statusCode === 200) {
            resolve(parsedData);
          } else {
            reject(new Error(`AWS Error: ${parsedData.message || parsedData.__type || 'Unknown error'}`));
          }
        } catch (error) {
          reject(new Error(`Parse error: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(jsonPayload);
    req.end();
  });
}

/**
 * Get Cognito token for user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{success: boolean, token?: string, userId?: string, error?: string}>}
 */
async function getCognitoToken(email, password) {
  try {
    console.log(`🔐 Authenticating user: ${email}`);
    
    // Step 1: Initiate authentication
    const authPayload = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CONFIG.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    };

    const authResponse = await makeAwsRequest(
      'cognito-idp',
      'AWSCognitoIdentityProviderService.InitiateAuth',
      authPayload
    );

    if (authResponse.AuthenticationResult) {
      const { AccessToken, IdToken } = authResponse.AuthenticationResult;
      
      // Decode the access token to get user ID
      const tokenParts = AccessToken.split('.');
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
      const userId = payload.sub;
      
      console.log(`✅ Authentication successful for user: ${userId}`);
      
      return {
        success: true,
        AccessToken: AccessToken,
        IdToken: IdToken,
        token: AccessToken,
        idToken: IdToken,
        userId: userId
      };
    } else if (authResponse.ChallengeName) {
      console.log(`❌ Authentication challenge required: ${authResponse.ChallengeName}`);
      return {
        success: false,
        error: `Authentication challenge required: ${authResponse.ChallengeName}`
      };
    } else {
      console.log(`❌ Unexpected authentication response`);
      return {
        success: false,
        error: 'Unexpected authentication response'
      };
    }
    
  } catch (error) {
    console.log(`❌ Authentication failed: ${error.message}`);
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { getCognitoToken }; 