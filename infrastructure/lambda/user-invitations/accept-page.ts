import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createErrorResponse } from '../shared/response-helper';
import { InvitationRepository } from '../shared/invitation-repository';
import { TokenService } from '../shared/token-service';
import { UserInvitation } from '../shared/types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Accept invitation page request:', JSON.stringify(event, null, 2));

  try {
    // Get token from query parameters
    const token = event.queryStringParameters?.token;
    
    if (!token) {
      return createErrorPage('Missing invitation token', 'The invitation link appears to be invalid. Please check the link in your email or contact your administrator.');
    }

    // Validate token format
    if (!TokenService.validateTokenFormat(token)) {
      return createErrorPage('Invalid invitation token', 'The invitation token format is invalid. Please check the link in your email or contact your administrator.');
    }

    try {
      const repository = new InvitationRepository();
      
      // Get invitation by token hash
      const tokenHash = TokenService.hashToken(token);
      const invitation = await repository.getInvitationByTokenHash(tokenHash);

      if (!invitation) {
        return createErrorPage('Invalid invitation', 'This invitation token is not valid. It may have been cancelled or the link may be corrupted.');
      }

      // Check invitation status
      if (invitation.status === 'accepted') {
        return createSuccessPage('Invitation Already Accepted', 'This invitation has already been accepted. If you need access to your account, please contact your administrator.');
      }

      if (invitation.status === 'cancelled') {
        return createErrorPage('Invitation Cancelled', 'This invitation has been cancelled. Please contact your administrator if you believe this is an error.');
      }

      // Check if invitation is expired
      const isExpired = TokenService.isExpired(invitation.expiresAt);
      if (isExpired) {
        // Update invitation status to expired
        await repository.updateInvitation(invitation.id, {
          status: 'expired',
        });
        return createErrorPage('Invitation Expired', 'This invitation has expired. Please contact your administrator to request a new invitation.');
      }

      // If we get here, the invitation is valid - show the acceptance form
      return createAcceptancePage(invitation, token);

    } catch (dbError) {
      console.error('Database error:', dbError);
      return createErrorPage('System Error', 'We encountered an error while processing your invitation. Please try again later or contact your administrator.');
    }

  } catch (error) {
    console.error('Error processing invitation page:', error);
    return createErrorPage('System Error', 'We encountered an unexpected error. Please try again later or contact your administrator.');
  }
};

function createAcceptancePage(invitation: UserInvitation, token: string): APIGatewayProxyResult {
  const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
  const apiUrl = `https://${process.env.API_GATEWAY_ID || '0z6kxagbh2'}.execute-api.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.STAGE || 'dev'}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accept Invitation - Aerotage Time Reporting</title>
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
        
        .invitation-details {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border-left: 4px solid #667eea;
        }
        
        .invitation-details h3 {
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
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #374151;
        }
        
        input[type="text"], 
        input[type="email"], 
        input[type="password"],
        input[type="tel"],
        select,
        textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 6px;
            font-size: 16px;
            transition: border-color 0.3s ease;
        }
        
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .password-requirements {
            font-size: 12px;
            color: #6b7280;
            margin-top: 5px;
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
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1>Aerotage</h1>
            <p>Time Reporting System</p>
        </div>
        
        <div class="invitation-details">
            <h3>Invitation Details</h3>
            <div class="detail-row">
                <span class="detail-label">Email:</span>
                <span class="detail-value">${invitation.email}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Role:</span>
                <span class="detail-value">${invitation.role}</span>
            </div>
            ${invitation.department ? `
            <div class="detail-row">
                <span class="detail-label">Department:</span>
                <span class="detail-value">${invitation.department}</span>
            </div>
            ` : ''}
            ${invitation.jobTitle ? `
            <div class="detail-row">
                <span class="detail-label">Job Title:</span>
                <span class="detail-value">${invitation.jobTitle}</span>
            </div>
            ` : ''}
        </div>
        
        <form id="acceptForm">
            <div class="form-group">
                <label for="name">Full Name *</label>
                <input type="text" id="name" name="name" required>
            </div>
            
            <div class="form-group">
                <label for="password">Password *</label>
                <input type="password" id="password" name="password" required>
                <div class="password-requirements">
                    Password must be at least 8 characters with uppercase, lowercase, number, and special character.
                </div>
            </div>
            
            <div class="form-group">
                <label for="confirmPassword">Confirm Password *</label>
                <input type="password" id="confirmPassword" name="confirmPassword" required>
            </div>
            
            <div class="form-group">
                <label for="phone">Phone Number</label>
                <input type="tel" id="phone" name="phone">
            </div>
            
            <div class="form-group">
                <label for="timezone">Timezone *</label>
                <select id="timezone" name="timezone" required>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="America/Anchorage">Alaska Time (AKT)</option>
                    <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="theme">Preferred Theme</label>
                <select id="theme" name="theme">
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </div>
            
            <div id="errorMessage" class="error-message" style="display: none;"></div>
            
            <button type="submit" class="btn" id="submitBtn">Accept Invitation</button>
            
            <div id="loading" class="loading">
                Processing your invitation...
            </div>
            
            <div id="success" class="success">
                <h3>Welcome to Aerotage!</h3>
                <p>Your account has been created successfully. You can now log in to the system.</p>
                <p><a href="${frontendBaseUrl}" style="color: #667eea; text-decoration: none; font-weight: 600;">Go to Login →</a></p>
            </div>
        </form>
    </div>
    
    <script>
        const form = document.getElementById('acceptForm');
        const submitBtn = document.getElementById('submitBtn');
        const loading = document.getElementById('loading');
        const errorMessage = document.getElementById('errorMessage');
        const success = document.getElementById('success');
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Clear previous errors
            errorMessage.style.display = 'none';
            
            // Validate passwords match
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
                showError('Passwords do not match');
                return;
            }
            
            // Validate password strength
            if (!validatePassword(password)) {
                showError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
                return;
            }
            
            // Show loading state
            submitBtn.disabled = true;
            loading.style.display = 'block';
            
            try {
                const response = await fetch('${apiUrl}/user-invitations/accept', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        token: '${token}',
                        userData: {
                            name: document.getElementById('name').value,
                            password: password,
                            contactInfo: {
                                phone: document.getElementById('phone').value || undefined,
                            },
                            preferences: {
                                theme: document.getElementById('theme').value,
                                notifications: true,
                                timezone: document.getElementById('timezone').value,
                            }
                        }
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    form.style.display = 'none';
                    success.style.display = 'block';
                } else {
                    showError(data.error?.message || 'Failed to accept invitation. Please try again.');
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Network error. Please check your connection and try again.');
            } finally {
                submitBtn.disabled = false;
                loading.style.display = 'none';
            }
        });
        
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
        
        function validatePassword(password) {
            const minLength = password.length >= 8;
            const hasUpper = /[A-Z]/.test(password);
            const hasLower = /[a-z]/.test(password);
            const hasNumber = /\\d/.test(password);
            const hasSpecial = /[!@#$%^&*()_+\\-=\\[\\]{};':"\\\\|,.<>\\/?]/.test(password);
            
            return minLength && hasUpper && hasLower && hasNumber && hasSpecial;
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
        
        .contact-info {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        
        .contact-info h3 {
            color: #374151;
            margin-bottom: 10px;
        }
        
        .contact-info p {
            color: #6b7280;
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
        
        <div class="contact-info">
            <h3>Need Help?</h3>
            <p>Contact your administrator or email support at <a href="mailto:support@aerotage.com" style="color: #667eea;">support@aerotage.com</a></p>
        </div>
    </div>
</body>
</html>
  `;

  return {
    statusCode: 400,
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
            padding: 14px 28px;
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
        
        <a href="${frontendBaseUrl}" class="btn">Go to Login</a>
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