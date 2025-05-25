const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');

async function getToken() {
  const client = new CognitoIdentityProviderClient({ region: 'us-east-1' });
  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: '148r35u6uultp1rmfdu22i8amb',
    AuthParameters: {
      USERNAME: 'bhardwick@aerotage.com',
      PASSWORD: 'Aerotage*2025'
    }
  });
  
  try {
    const response = await client.send(command);
    console.log(response.AuthenticationResult.IdToken);
  } catch (error) {
    console.error('Token error:', error.message);
  }
}

getToken(); 