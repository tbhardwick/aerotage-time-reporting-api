#!/usr/bin/env node

/**
 * Get JWT Token from AWS Cognito
 * This script authenticates with Cognito and returns a JWT token for API testing
 */

const https = require('https');
const crypto = require('crypto');

// Cognito Configuration
const COGNITO_CONFIG = {
  userPoolId: 'us-east-1_EsdlgX9Qg',
  clientId: '148r35u6uultp1rmfdu22i8amb',
  region: 'us-east-1'
};

// User credentials
const USERNAME = 'Bhardwick@aerotage.com';
const PASSWORD = 'Aerotage*2025';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

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

async function authenticateUser() {
  try {
    log(`${colors.blue}Authenticating with AWS Cognito...${colors.reset}`);
    log(`User Pool ID: ${COGNITO_CONFIG.userPoolId}`);
    log(`Client ID: ${COGNITO_CONFIG.clientId}`);
    log(`Username: ${USERNAME}`);
    
    // Step 1: Initiate authentication
    const authPayload = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CONFIG.clientId,
      AuthParameters: {
        USERNAME: USERNAME,
        PASSWORD: PASSWORD
      }
    };

    log(`\n${colors.yellow}Step 1: Initiating authentication...${colors.reset}`);
    const authResponse = await makeAwsRequest(
      'cognito-idp',
      'AWSCognitoIdentityProviderService.InitiateAuth',
      authPayload
    );

    if (authResponse.AuthenticationResult) {
      const { AccessToken, IdToken, RefreshToken } = authResponse.AuthenticationResult;
      
      log(`${colors.green}✅ Authentication successful!${colors.reset}`);
      log(`\n${colors.bold}JWT Tokens:${colors.reset}`);
      log(`${colors.yellow}Access Token:${colors.reset}`);
      log(AccessToken);
      log(`\n${colors.yellow}ID Token:${colors.reset}`);
      log(IdToken);
      log(`\n${colors.yellow}Refresh Token:${colors.reset}`);
      log(RefreshToken);
      
      // Export commands for easy use
      log(`\n${colors.bold}Export commands for testing:${colors.reset}`);
      log(`${colors.green}export JWT_TOKEN="${IdToken}"${colors.reset}`);
      log(`${colors.green}export ACCESS_TOKEN="${AccessToken}"${colors.reset}`);
      log(`${colors.green}export REFRESH_TOKEN="${RefreshToken}"${colors.reset}`);
      
      return {
        accessToken: AccessToken,
        idToken: IdToken,
        refreshToken: RefreshToken
      };
    } else if (authResponse.ChallengeName) {
      log(`${colors.red}❌ Authentication challenge required: ${authResponse.ChallengeName}${colors.reset}`);
      log('This script doesn\'t handle authentication challenges yet.');
      return null;
    } else {
      log(`${colors.red}❌ Unexpected authentication response${colors.reset}`);
      log(JSON.stringify(authResponse, null, 2));
      return null;
    }
    
  } catch (error) {
    log(`${colors.red}❌ Authentication failed: ${error.message}${colors.reset}`);
    
    if (error.message.includes('NotAuthorizedException')) {
      log(`${colors.yellow}Possible issues:${colors.reset}`);
      log('1. Incorrect username or password');
      log('2. User account is disabled');
      log('3. User needs to reset password');
    } else if (error.message.includes('UserNotFoundException')) {
      log(`${colors.yellow}User not found. Please check the username.${colors.reset}`);
    } else if (error.message.includes('InvalidParameterException')) {
      log(`${colors.yellow}Invalid parameters. Please check the configuration.${colors.reset}`);
    }
    
    return null;
  }
}

// Run the authentication
if (require.main === module) {
  authenticateUser().then(tokens => {
    if (tokens) {
      log(`\n${colors.green}Ready to test endpoints!${colors.reset}`);
      log(`\n${colors.yellow}Next steps:${colors.reset}`);
      log('1. Copy the export command above and run it in your terminal');
      log('2. Get a project ID by running:');
      log(`   curl -H "Authorization: Bearer $JWT_TOKEN" "https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev/projects"`);
      log('3. Set PROJECT_ID environment variable');
      log('4. Run the test scripts:');
      log('   - ./scripts/test-endpoints-curl.sh');
      log('   - ./scripts/test-daily-weekly-endpoints.js');
    } else {
      process.exit(1);
    }
  }).catch(error => {
    log(`${colors.red}Script error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { authenticateUser }; 