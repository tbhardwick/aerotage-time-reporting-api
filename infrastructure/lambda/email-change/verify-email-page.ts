import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { EmailChangeRepository } from '../shared/email-change-repository';
import { TokenService } from '../shared/token-service';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Email verification page request:', JSON.stringify(event, null, 2));

  try {
    // Get token and type from query parameters
    const token = event.queryStringParameters?.token;
    const emailType = event.queryStringParameters?.type;
    
    if (!token || !emailType) {
      return createErrorPage('Missing Parameters', 'The email verification link appears to be invalid. Please check the link in your email or contact your administrator.');
    }

    if (emailType !== 'current' && emailType !== 'new') {
      return createErrorPage('Invalid Email Type', 'The email verification link has an invalid type parameter. Please check the link in your email.');
    }

    // Validate token format
    if (!TokenService.validateTokenFormat(token)) {
      return createErrorPage('Invalid Verification Token', 'The verification token format is invalid. Please check the link in your email or contact your administrator.');
    }

    try {
      const repository = new EmailChangeRepository();
      
      // Get email change request by token
      const emailChangeRequest = await repository.getRequestByVerificationToken(token, emailType);

      if (!emailChangeRequest) {
        return createErrorPage('Invalid Verification Link', 'This email verification token is not valid. It may have expired or the link may be corrupted.');
      }

      // Check if already verified
      const isCurrentEmail = emailType === 'current';
      const isAlreadyVerified = isCurrentEmail 
        ? emailChangeRequest.currentEmailVerified 
        : emailChangeRequest.newEmailVerified;

      if (isAlreadyVerified) {
        return createSuccessPage('Email Already Verified', `This ${emailType} email address has already been verified. The email change process will continue automatically.`);
      }

      // Check if request is expired or cancelled
      if (emailChangeRequest.status === 'cancelled') {
        return createErrorPage('Request Cancelled', 'This email change request has been cancelled. Please contact your administrator if you believe this is an error.');
      }

      if (emailChangeRequest.status === 'completed') {
        return createSuccessPage('Request Already Completed', 'This email change request has already been completed successfully.');
      }

      // If we get here, show the verification page
      return createVerificationPage(emailChangeRequest, token, emailType);

    } catch (dbError) {
      console.error('Database error:', dbError);
      return createErrorPage('System Error', 'We encountered an error while processing your email verification. Please try again later or contact your administrator.');
    }

  } catch (error) {
    console.error('Error processing email verification page:', error);
    return createErrorPage('System Error', 'We encountered an unexpected error. Please try again later or contact your administrator.');
  }
};

function createVerificationPage(emailChangeRequest: any, token: string, emailType: string): APIGatewayProxyResult {
  const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
  
  // Use the custom domain if available, otherwise fall back to API Gateway URL
  const apiUrl = process.env.API_BASE_URL || 'https://time-api-dev.aerotage.com';
  
  const emailAddress = emailType === 'current' ? emailChangeRequest.currentEmail : emailChangeRequest.newEmail;
  const otherEmailType = emailType === 'current' ? 'new' : 'current';
  const otherEmailAddress = emailType === 'current' ? emailChangeRequest.newEmail : emailChangeRequest.currentEmail;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Email Address - Aerotage Time Reporting</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            max-width: 500px;
            width: 100%;
        }
        
        .logo {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .logo h1 {
            color: #667eea;
            font-size: 28px;
            font-weight: 700;
        }
        
        .logo p {
            color: #666;
            margin-top: 5px;
        }
        
        .verification-details {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border-left: 4px solid #667eea;
        }
        
        .verification-details h3 {
            color: #374151;
            margin-bottom: 15px;
            font-size: 18px;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        
        .detail-label {
            font-weight: 600;
            color: #6b7280;
        }
        
        .detail-value {
            color: #374151;
        }
        
        .btn {
            background: #667eea;
            color: white;
            padding: 14px 28px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.3s ease;
            width: 100%;
        }
        
        .btn:hover {
            background: #5a67d8;
        }
        
        .btn:disabled {
            background: #9ca3af;
            cursor: not-allowed;
        }
        
        .error-message {
            background: #fee;
            color: #c53030;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            border: 1px solid #fecaca;
        }
        
        .loading {
            display: none;
            text-align: center;
            color: #6b7280;
            margin-top: 20px;
        }
        
        .success {
            display: none;
            background: #f0fff4;
            color: #2d5016;
            padding: 20px;
            border-radius: 6px;
            border: 1px solid #9ae6b4;
            text-align: center;
        }
        
        .info {
            background: #eff6ff;
            color: #1e40af;
            padding: 15px;
            border-radius: 6px;
            margin-top: 20px;
            border: 1px solid #bfdbfe;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1>Aerotage</h1>
            <p>Time Reporting System</p>
        </div>
        
        <div class="verification-details">
            <h3>Email Verification</h3>
            <div class="detail-row">
                <span class="detail-label">Verifying:</span>
                <span class="detail-value">${emailAddress}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Email Type:</span>
                <span class="detail-value">${emailType === 'current' ? 'Current Email' : 'New Email'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Request ID:</span>
                <span class="detail-value">${emailChangeRequest.id}</span>
            </div>
        </div>
        
        <div id="verificationForm">
            <p style="margin-bottom: 20px; color: #6b7280;">
                Click the button below to verify your ${emailType} email address for the email change request.
            </p>
            
            <div id="errorMessage" class="error-message" style="display: none;"></div>
            
            <button type="button" class="btn" id="verifyBtn">Verify Email Address</button>
            
            <div id="loading" class="loading">
                Verifying your email address...
            </div>
            
            <div id="success" class="success">
                <h3>Email Verified Successfully!</h3>
                <p id="successMessage"></p>
                <div id="nextSteps" class="info" style="display: none;">
                    <p id="nextStepsMessage"></p>
                </div>
                <p style="margin-top: 15px;">
                    <a href="${frontendBaseUrl}" style="color: #667eea; text-decoration: none; font-weight: 600;">Return to Application →</a>
                </p>
            </div>
        </div>
    </div>
    
    <script>
        const verifyBtn = document.getElementById('verifyBtn');
        const loading = document.getElementById('loading');
        const errorMessage = document.getElementById('errorMessage');
        const success = document.getElementById('success');
        const verificationForm = document.getElementById('verificationForm');
        const successMessage = document.getElementById('successMessage');
        const nextSteps = document.getElementById('nextSteps');
        const nextStepsMessage = document.getElementById('nextStepsMessage');
        
        verifyBtn.addEventListener('click', async function() {
            // Clear previous errors
            errorMessage.style.display = 'none';
            
            // Show loading state
            verifyBtn.disabled = true;
            loading.style.display = 'block';
            
            try {
                const response = await fetch('${apiUrl}/email-change/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        token: '${token}',
                        emailType: '${emailType}'
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    verificationForm.style.display = 'none';
                    success.style.display = 'block';
                    
                    // Set success message
                    successMessage.textContent = data.data.message || 'Your ${emailType} email address has been verified successfully.';
                    
                    // Handle next steps
                    if (data.data.nextStep) {
                        nextSteps.style.display = 'block';
                        switch (data.data.nextStep) {
                            case 'verify_other_email':
                                nextStepsMessage.textContent = 'Please check your ${otherEmailType} email (${otherEmailAddress}) for another verification link.';
                                break;
                            case 'pending_approval':
                                nextStepsMessage.textContent = 'Both email addresses have been verified. Your email change request is now pending admin approval.';
                                break;
                            case 'auto_approved':
                                nextStepsMessage.textContent = 'Your email change has been automatically approved and will be processed shortly.';
                                break;
                            default:
                                nextSteps.style.display = 'none';
                        }
                    }
                } else {
                    showError(data.error?.message || 'Failed to verify email address. Please try again.');
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Network error. Please check your connection and try again.');
            } finally {
                verifyBtn.disabled = false;
                loading.style.display = 'none';
            }
        });
        
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
    </script>
</body>
</html>
  `;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    body: html,
  };
}

function createErrorPage(title: string, message: string): APIGatewayProxyResult {
  const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Aerotage Time Reporting</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        
        .logo {
            margin-bottom: 30px;
        }
        
        .logo h1 {
            color: #667eea;
            font-size: 28px;
            font-weight: 700;
        }
        
        .logo p {
            color: #666;
            margin-top: 5px;
        }
        
        .error-icon {
            font-size: 64px;
            color: #ef4444;
            margin-bottom: 20px;
        }
        
        .error-title {
            font-size: 24px;
            color: #374151;
            margin-bottom: 15px;
            font-weight: 600;
        }
        
        .error-message {
            color: #6b7280;
            margin-bottom: 30px;
            font-size: 16px;
        }
        
        .btn {
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: background-color 0.3s ease;
        }
        
        .btn:hover {
            background: #5a67d8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1>Aerotage</h1>
            <p>Time Reporting System</p>
        </div>
        
        <div class="error-icon">⚠️</div>
        <h2 class="error-title">${title}</h2>
        <p class="error-message">${message}</p>
        
        <a href="${frontendBaseUrl}" class="btn">Return to Application</a>
    </div>
</body>
</html>
  `;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    body: html,
  };
}

function createSuccessPage(title: string, message: string): APIGatewayProxyResult {
  const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Aerotage Time Reporting</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        
        .logo {
            margin-bottom: 30px;
        }
        
        .logo h1 {
            color: #667eea;
            font-size: 28px;
            font-weight: 700;
        }
        
        .logo p {
            color: #666;
            margin-top: 5px;
        }
        
        .success-icon {
            font-size: 64px;
            color: #10b981;
            margin-bottom: 20px;
        }
        
        .success-title {
            font-size: 24px;
            color: #374151;
            margin-bottom: 15px;
            font-weight: 600;
        }
        
        .success-message {
            color: #6b7280;
            margin-bottom: 30px;
            font-size: 16px;
        }
        
        .btn {
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: background-color 0.3s ease;
        }
        
        .btn:hover {
            background: #5a67d8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1>Aerotage</h1>
            <p>Time Reporting System</p>
        </div>
        
        <div class="success-icon">✅</div>
        <h2 class="success-title">${title}</h2>
        <p class="success-message">${message}</p>
        
        <a href="${frontendBaseUrl}" class="btn">Return to Application</a>
    </div>
</body>
</html>
  `;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    body: html,
  };
} 