# Frontend Password Reset Integration Guide

## 📋 Overview

This guide provides step-by-step instructions for integrating and testing the password reset functionality with the Aerotage Time Reporting frontend application.

## ✅ Backend Deployment Status

**✅ Password Reset Backend**: Successfully deployed to `dev` environment  
**✅ Cognito Configuration**: Updated with password reset support  
**✅ Monitoring**: CloudWatch alarms and dashboard configured  
**✅ Email Service**: Default Cognito email service enabled (50 emails/day limit)

## 🔧 Frontend Configuration

### **1. Update AWS Configuration**

Update your frontend `aws-config.ts` file with the deployed values:

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
  }
};

export default awsConfig;
```

### **2. Verify Amplify Integration**

Ensure your application is using the correct Amplify configuration:

```typescript
// src/main.ts or App.tsx
import { Amplify } from 'aws-amplify';
import awsConfig from './aws-config';

Amplify.configure(awsConfig);
```

## 🧪 Testing the Password Reset Feature

### **🚨 IMPORTANT: Admin User Setup Required**

Before testing, you need to address the admin user issue:

#### **Option 1: Update Admin Email (Recommended)**
```bash
# Update the admin email in monitoring stack to a real address
# Edit: infrastructure/lib/monitoring-stack.ts line ~38
# Change: 'admin@aerotage.com' 
# To: 'your-real-admin@email.com'

# Then redeploy:
cd infrastructure/
npm run deploy:dev
```

#### **Option 2: Create Test Users via AWS Console**
1. Go to [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Select User Pool: `aerotage-time-dev`
3. Click "Create user"
4. Use your real email address for testing
5. Set temporary password
6. Enable "Mark email as verified"

### **3. Frontend Testing Steps**

#### **Test Scenario 1: Valid User Password Reset**

```typescript
// Example test implementation
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';

// Step 1: Request password reset
const testPasswordReset = async () => {
  try {
    const email = 'your-test-user@yourdomain.com'; // Use actual test email
    
    console.log('🔄 Requesting password reset for:', email);
    const result = await resetPassword({ username: email });
    
    console.log('✅ Password reset initiated:', result);
    // User should receive email with 6-digit code
    
  } catch (error) {
    console.error('❌ Password reset failed:', error);
    // Handle error cases
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
    // Handle error cases (invalid code, expired code, weak password, etc.)
  }
};
```

#### **Test Scenario 2: Invalid Email Handling**

```typescript
const testInvalidEmail = async () => {
  try {
    // This should NOT reveal whether the email exists (security feature)
    await resetPassword({ username: 'nonexistent@example.com' });
    console.log('✅ Request completed (no information leakage)');
  } catch (error) {
    console.log('Error handled:', error);
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

### **🔍 Current User Invitation Status**

Based on the deployed infrastructure, there IS an invitation system available:

#### **Available API Endpoints:**
- **✅ InviteUser**: `aerotage-inviteuser-dev` Lambda function
- **✅ CreateUser**: `aerotage-createuser-dev` Lambda function
- **✅ GetUsers**: `aerotage-getusers-dev` Lambda function

#### **Testing User Invitation:**

```typescript
// Example API call to invite a user
const inviteUser = async (userData: {
  email: string;
  givenName: string;
  familyName: string;
  role: 'admin' | 'manager' | 'employee';
  teamId?: string;
  hourlyRate?: number;
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/invite`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (response.ok) {
      console.log('✅ User invitation sent');
      // User will receive email with temporary password
    } else {
      console.error('❌ Invitation failed:', await response.text());
    }
  } catch (error) {
    console.error('❌ Invitation error:', error);
  }
};

// Example usage
await inviteUser({
  email: 'newuser@yourdomain.com',
  givenName: 'John',
  familyName: 'Doe',
  role: 'employee',
  teamId: 'team-123',
  hourlyRate: 50,
});
```

## 🔧 Admin User Setup Solutions

### **Solution 1: Create Proper Admin User**

```bash
# Using AWS CLI to create admin user with real email
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username admin \
  --user-attributes \
    Name=email,Value=your-real-admin@email.com \
    Name=given_name,Value=Admin \
    Name=family_name,Value=User \
    Name=email_verified,Value=true \
    Name=custom:role,Value=admin \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS

# Add admin to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username admin \
  --group-name admin
```

### **Solution 2: Update Monitoring Email**

```typescript
// Edit: infrastructure/lib/monitoring-stack.ts
// Line 38: Replace admin@aerotage.com with real email

if (stage === 'prod') {
  this.alertTopic.addSubscription(
    new subscriptions.EmailSubscription('your-real-admin@email.com') // ← Update this
  );
}
```

Then redeploy:
```bash
cd infrastructure/
npm run deploy:dev
```

## 📧 Email Delivery Testing

### **Check Email Delivery**

1. **Primary Inbox**: Check the recipient's primary inbox
2. **Spam/Junk Folder**: Cognito emails often go to spam initially
3. **Email Filtering**: Check if corporate email filters are blocking AWS emails

### **Email Content Example**

Users will receive emails similar to:
```
Subject: Password Reset - Aerotage Time Reporting

Your password reset code: 123456

This code expires in 15 minutes.
```

### **Troubleshooting Email Issues**

```bash
# Check Cognito logs for email delivery
aws logs filter-log-events \
  --log-group-name /aws/cognito/userpool/us-east-1_EsdlgX9Qg \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --filter-pattern "ERROR"

# Check password reset alarm status
aws cloudwatch describe-alarms \
  --alarm-names aerotage-password-reset-high-volume-dev
```

## 🛠️ Error Handling

### **Common Error Scenarios**

```typescript
const handlePasswordResetErrors = (error: any) => {
  switch (error.code) {
    case 'UserNotFoundException':
      // Don't reveal if user exists - show generic message
      showMessage('If this email is registered, you will receive a reset code.');
      break;
      
    case 'InvalidParameterException':
      showMessage('Invalid email format. Please check and try again.');
      break;
      
    case 'TooManyRequestsException':
      showMessage('Too many requests. Please wait before trying again.');
      break;
      
    case 'CodeExpiredException':
      showMessage('Reset code has expired. Please request a new one.');
      break;
      
    case 'InvalidPasswordException':
      showMessage('Password does not meet requirements. Must be 8+ characters with uppercase, lowercase, and numbers.');
      break;
      
    case 'CodeMismatchException':
      showMessage('Invalid reset code. Please check and try again.');
      break;
      
    default:
      showMessage('Password reset failed. Please try again later.');
      console.error('Password reset error:', error);
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
- [ ] AWS configuration updated with correct values
- [ ] Amplify properly configured
- [ ] Password reset form implemented
- [ ] Error handling implemented
- [ ] Success flow tested

### **Backend Functionality Testing**
- [ ] Admin user created with real email
- [ ] Test user created for password reset testing
- [ ] Email delivery confirmed (check spam folders)
- [ ] Password policy validation working
- [ ] Error scenarios handled properly

### **User Experience Testing**
- [ ] Password reset flow intuitive
- [ ] Error messages helpful and secure
- [ ] Email instructions clear
- [ ] Success confirmation displayed
- [ ] Redirect to login after success

### **Security Testing**
- [ ] Invalid emails don't reveal user existence
- [ ] Expired codes properly rejected
- [ ] Weak passwords rejected
- [ ] Rate limiting prevents abuse
- [ ] Monitoring alerts function

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
   - Check spam/junk folders
   - Verify email address is correct
   - Check Cognito email quota (50/day for free tier)

2. **"Code expired"**
   - Codes expire in 15 minutes
   - Request new reset code
   - Check system time synchronization

3. **"Invalid password"**
   - Must be 8+ characters
   - Require uppercase, lowercase, numbers
   - Symbols are optional

### **Getting Help**

- **CloudWatch Logs**: Check Cognito and Lambda logs
- **AWS Console**: Monitor Cognito user pool metrics
- **Support**: Contact backend team with specific error messages

---

## 🎯 Next Steps

1. **Implement Frontend Changes**: Update AWS config and test password reset flow
2. **Create Admin User**: Set up proper admin account with real email
3. **Test User Invitation**: Use existing invite system to create test users
4. **Monitor Performance**: Check CloudWatch dashboard for metrics
5. **Plan Production**: Prepare for production deployment with SES integration

The password reset functionality is fully operational and ready for frontend integration! 🚀 