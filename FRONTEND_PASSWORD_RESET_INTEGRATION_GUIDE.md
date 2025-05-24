# Frontend Password Reset Integration Guide

## 📋 Overview

This guide provides step-by-step instructions for integrating and testing the password reset functionality with the Aerotage Time Reporting frontend application.

## ✅ Backend Deployment Status

**✅ Password Reset Backend**: Successfully deployed to `dev` environment  
**✅ Cognito Configuration**: Updated with password reset support  
**✅ Monitoring**: CloudWatch alarms and dashboard configured  
**✅ Email Service**: Default Cognito email service enabled (50 emails/day limit)

## 🚀 Quick Start (Ready to Test Now!)

**For immediate testing**, you only need:

1. **Update frontend AWS config** with the values below
2. **Create a test user** via AWS Console or script
3. **Test password reset** in your frontend

The admin email issue is **optional** and only affects production alerts, not password reset functionality.

## 🔧 Frontend Configuration

### **1. AWS Configuration Values**

**Copy these exact values into your frontend `aws-config.ts`:**

```typescript
// src/aws-config.ts (or equivalent)
const awsConfig = {
  Auth: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_EsdlgX9Qg',
    userPoolWebClientId: '148r35u6uultp1rmfdu22i8amb',
    identityPoolId: 'us-east-1:d79776bb-4b8e-4654-a10a-a45b1adaa787',
    
    // ✅ Password reset configuration
    passwordResetConfig: {
      enabled: true,
      codeDeliveryMethod: 'EMAIL',
      codeExpirationMinutes: 15,
    },
    
    // ✅ Password policy for frontend validation
    passwordPolicy: {
      minLength: 8,
      requireLowercase: true,
      requireUppercase: true,
      requireDigits: true,
      requireSymbols: false, // Optional per backend configuration
    }
  },
  
  // ✅ API Gateway configuration
  API: {
    endpoints: [
      {
        name: 'AerotageTimeAPI',
        endpoint: 'https://0sty9mf3f7.execute-api.us-east-1.amazonaws.com/dev',
        region: 'us-east-1'
      }
    ]
  }
};

export default awsConfig;
```

### **2. Configuration Summary Table**

| Configuration | Value | Purpose |
|---------------|-------|---------|
| **Region** | `us-east-1` | AWS region |
| **User Pool ID** | `us-east-1_EsdlgX9Qg` | Cognito authentication |
| **User Pool Client ID** | `148r35u6uultp1rmfdu22i8amb` | Frontend app client |
| **Identity Pool ID** | `us-east-1:d79776bb-4b8e-4654-a10a-a45b1adaa787` | AWS resource access |
| **API Gateway URL** | `https://0sty9mf3f7.execute-api.us-east-1.amazonaws.com/dev` | Backend API calls |
| **Password Reset** | ✅ Enabled | Email-based reset |
| **Email Limit** | 50/day | Cognito free tier |

### **3. Verify Amplify Integration**

Ensure your application is using the correct Amplify configuration:

```typescript
// src/main.ts or App.tsx
import { Amplify } from 'aws-amplify';
import awsConfig from './aws-config';

Amplify.configure(awsConfig);
```

## 🧪 Testing the Password Reset Feature

### **Option 1: Create Test User via AWS Console (Recommended)**
1. Go to [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Select User Pool: `aerotage-time-dev`
3. Click "Create user"
4. **Username**: Use an email address (e.g., `test@yourdomain.com`)
5. **Email**: Same email address
6. Set temporary password: `TempPass123!`
7. **✅ Enable "Mark email as verified"**
8. **✅ Enable "Send an invitation to this new user?"** = NO

### **Option 2: Use the Fixed Setup Script**
```bash
# Run the automated setup script
./scripts/setup-admin-user.sh
```

### **3. Frontend Testing Implementation**

#### **Test Scenario 1: Complete Password Reset Flow**

```typescript
// Example test implementation
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';

// Step 1: Request password reset
const testPasswordReset = async () => {
  try {
    const email = 'test@yourdomain.com'; // Use actual test email
    
    console.log('🔄 Requesting password reset for:', email);
    const result = await resetPassword({ username: email });
    
    console.log('✅ Password reset initiated:', result);
    console.log('📧 Check email for 6-digit code');
    
    return result;
    
  } catch (error) {
    console.error('❌ Password reset failed:', error);
    // Handle error cases - see error handling section below
  }
};

// Step 2: Confirm password reset with code
const confirmPasswordReset = async (email: string, code: string, newPassword: string) => {
  try {
    console.log('🔄 Confirming password reset...');
    await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword: newPassword,
    });
    
    console.log('✅ Password reset successful!');
    // Redirect to login page with success message
    
  } catch (error) {
    console.error('❌ Password confirmation failed:', error);
    // Handle specific error cases (see error handling section)
  }
};

// Complete test flow
const runPasswordResetTest = async () => {
  const testEmail = 'test@yourdomain.com';
  
  // Step 1: Request reset
  await testPasswordReset();
  
  // Step 2: Get code from email and confirm
  // const code = prompt('Enter the 6-digit code from email:');
  // const newPassword = 'NewPassword123!';
  // await confirmPasswordReset(testEmail, code, newPassword);
};
```

#### **Test Scenario 2: Security - Invalid Email Handling**

```typescript
const testInvalidEmail = async () => {
  try {
    // This should NOT reveal whether the email exists (security feature)
    await resetPassword({ username: 'nonexistent@example.com' });
    console.log('✅ Request completed (no information leakage)');
  } catch (error) {
    console.log('Error handled properly:', error);
  }
};
```

#### **Test Scenario 3: Password Policy Validation**

```typescript
const testPasswordPolicy = async (email: string, code: string) => {
  const weakPasswords = [
    'weak',           // Too short
    'nodigits',       // No digits  
    'NOCAPS',         // No lowercase
    'nocaps123',      // No uppercase
  ];
  
  for (const password of weakPasswords) {
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword: password,
      });
    } catch (error) {
      console.log(`❌ Correctly rejected weak password: ${password}`, error);
    }
  }
  
  // Test valid password
  try {
    await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword: 'ValidPass123', // Meets all requirements
    });
    console.log('✅ Strong password accepted');
  } catch (error) {
    console.error('❌ Strong password rejected:', error);
  }
};
```

## 👥 User Management & Invitation System

### **🔍 User Invitation System (Already Available)**

Your backend has a working invitation system:

#### **Available API Endpoints:**
- **✅ InviteUser**: `POST /users/invite`
- **✅ CreateUser**: `POST /users`
- **✅ GetUsers**: `GET /users`

#### **Frontend Integration Example:**

```typescript
import { API } from 'aws-amplify';

// Invite a new user
const inviteUser = async (userData: {
  email: string;
  givenName: string;
  familyName: string;
  role: 'admin' | 'manager' | 'employee';
  teamId?: string;
  hourlyRate?: number;
}) => {
  try {
    const response = await API.post('AerotageTimeAPI', '/users/invite', {
      body: userData
    });
    
    console.log('✅ User invitation sent:', response);
    // User will receive email with temporary password
    return response;
    
  } catch (error) {
    console.error('❌ Invitation failed:', error);
    throw error;
  }
};

// Example usage
const inviteNewEmployee = async () => {
  await inviteUser({
    email: 'newuser@yourdomain.com',
    givenName: 'John',
    familyName: 'Doe',
    role: 'employee',
    teamId: 'team-123',
    hourlyRate: 50,
  });
};
```

## 🔧 Admin User Setup (Optional - Production Alerts Only)

**⚠️ Note**: The admin email issue only affects production alert notifications, not password reset functionality or development testing.

### **Create Admin User (if needed)**

```bash
# Using AWS CLI to create admin user with real email
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username "your-admin@yourdomain.com" \
  --user-attributes \
    Name=email,Value="your-admin@yourdomain.com" \
    Name=given_name,Value="Admin" \
    Name=family_name,Value="User" \
    Name=email_verified,Value=true \
    Name=custom:role,Value=admin \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS

# Add admin to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username "your-admin@yourdomain.com" \
  --group-name admin
```

## 📧 Email Delivery Testing

### **Check Email Delivery**

1. **Primary Inbox**: Check the recipient's primary inbox first
2. **Spam/Junk Folder**: Cognito emails often go here initially
3. **Promotions Tab**: Gmail sometimes categorizes here
4. **Corporate Email Filters**: May block AWS emails

### **Email Content Example**

Users will receive emails similar to:
```
Subject: Your verification code
From: no-reply@verificationemail.com

Your verification code is: 123456

This code will expire in 15 minutes.
```

### **Troubleshooting Email Issues**

```bash
# Check Cognito logs for email delivery issues
aws logs filter-log-events \
  --log-group-name /aws/cognito/userpool/us-east-1_EsdlgX9Qg \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --filter-pattern "ERROR"

# Check email quota (50/day for free tier)
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --query 'UserPool.EmailConfiguration'
```

## 🛠️ Error Handling

### **Complete Error Handling Implementation**

```typescript
const handlePasswordResetErrors = (error: any) => {
  switch (error.code) {
    case 'UserNotFoundException':
      // Don't reveal if user exists - show generic message
      return 'If this email is registered, you will receive a reset code.';
      
    case 'InvalidParameterException':
      return 'Invalid email format. Please check and try again.';
      
    case 'TooManyRequestsException':
      return 'Too many requests. Please wait before trying again.';
      
    case 'CodeExpiredException':
      return 'Reset code has expired. Please request a new one.';
      
    case 'InvalidPasswordException':
      return 'Password does not meet requirements. Must be 8+ characters with uppercase, lowercase, and numbers.';
      
    case 'CodeMismatchException':
      return 'Invalid reset code. Please check and try again.';
      
    case 'LimitExceededException':
      return 'Too many attempts. Please try again later.';
      
    case 'NotAuthorizedException':
      return 'Invalid verification code provided.';
      
    default:
      console.error('Password reset error:', error);
      return 'Password reset failed. Please try again later.';
  }
};

// Usage in your components
const handleResetPassword = async (email: string) => {
  try {
    await resetPassword({ username: email });
    setMessage('If this email is registered, you will receive a reset code.');
    setStep('confirm'); // Move to code confirmation step
  } catch (error) {
    const errorMessage = handlePasswordResetErrors(error);
    setMessage(errorMessage);
  }
};

const handleConfirmReset = async (email: string, code: string, newPassword: string) => {
  try {
    await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword: newPassword,
    });
    setMessage('Password reset successful! You can now log in.');
    router.push('/login'); // Redirect to login
  } catch (error) {
    const errorMessage = handlePasswordResetErrors(error);
    setMessage(errorMessage);
  }
};
```

## 📊 Monitoring & Analytics

### **CloudWatch Dashboard**
- **URL**: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=AerotageTimeAPI-dev
- **Password Reset Widget**: Monitor reset request volume and errors

### **Key Metrics to Track**
- Password reset request count
- Successful vs failed confirmations  
- Email delivery success rates
- User journey completion rates

## ✅ Testing Checklist

### **Frontend Integration Testing**
- [ ] AWS configuration updated with correct values from this guide
- [ ] Amplify properly configured and imported
- [ ] Password reset form implemented with proper error handling
- [ ] Success flow tested end-to-end
- [ ] User redirect to login after successful reset

### **Backend Functionality Testing**
- [ ] Test user created via AWS Console or script
- [ ] Email delivery confirmed (check spam folders)
- [ ] Password policy validation working
- [ ] Error scenarios handled properly
- [ ] Invalid email attempts don't reveal user existence

### **User Experience Testing**
- [ ] Password reset flow intuitive and clear
- [ ] Error messages helpful and secure
- [ ] Email instructions clear to users
- [ ] Success confirmation displayed
- [ ] Proper loading states during API calls

### **Security Testing**
- [ ] Invalid emails don't reveal user existence
- [ ] Expired codes properly rejected (15-minute limit)
- [ ] Weak passwords rejected per policy
- [ ] Rate limiting prevents abuse
- [ ] No sensitive information in error messages

## 🚀 Production Deployment Considerations

### **Before Production Deployment:**

1. **Email Service Upgrade**
   ```typescript
   // Consider upgrading to Amazon SES for production
   email: cognito.UserPoolEmail.withSES({
     fromEmail: 'noreply@aerotage.com',
     fromName: 'Aerotage Time App',
   }),
   ```

2. **Admin Email Configuration**
   - Update all admin emails to real addresses
   - Set up proper alert routing
   - Configure SNS subscriptions for operations team

3. **Monitoring Enhancement**
   - Set up custom dashboards for password reset metrics
   - Configure anomaly detection
   - Implement detailed audit logging

## 📞 Support & Troubleshooting

### **Common Issues**

1. **"Email not received"**
   - Check spam/junk folders first
   - Verify email address is correct
   - Check Cognito email quota (50/day for free tier)
   - Try with different email provider (Gmail, Outlook, etc.)

2. **"Code expired"**
   - Codes expire in 15 minutes
   - Request new reset code
   - Check system time synchronization

3. **"Invalid password"**
   - Must be 8+ characters
   - Require uppercase, lowercase, numbers
   - Symbols are optional

4. **"Amplify configuration errors"**
   - Double-check all IDs in aws-config.ts
   - Ensure Amplify.configure() is called before any auth operations
   - Check browser console for detailed error messages

### **Debug Commands**

```bash
# Verify deployment values
aws cloudformation describe-stacks \
  --stack-name AerotageAuth-dev \
  --query 'Stacks[0].Outputs'

# Check user pool configuration
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-1_EsdlgX9Qg

# List users for testing
aws cognito-idp list-users \
  --user-pool-id us-east-1_EsdlgX9Qg
```

---

## 🎯 Next Steps

### **Immediate Actions (30 minutes)**
1. **✅ Update Frontend Config**: Copy AWS configuration values above
2. **✅ Create Test User**: Via AWS Console (Option 1 above)
3. **✅ Test Password Reset**: Implement basic test in your frontend
4. **✅ Test Error Handling**: Try invalid emails and codes

### **Integration Phase (1-2 hours)**
1. **Implement UI Components**: Password reset form and confirmation
2. **Add Error Handling**: Use error handling code above
3. **Test User Journey**: Complete end-to-end flow
4. **Test Edge Cases**: Expired codes, weak passwords, etc.

### **Production Preparation**
1. **Monitor Performance**: Check CloudWatch dashboard
2. **Plan SES Upgrade**: For higher email volume
3. **Document Process**: For operations team
4. **Security Review**: Validate all security requirements

## 🚀 **The password reset functionality is fully operational and ready for frontend integration!**

**Start with the Quick Start section above for immediate testing!** 

All backend infrastructure is deployed and working. The frontend team can begin integration immediately using the configuration values and examples provided in this guide. 