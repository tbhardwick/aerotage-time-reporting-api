# Password Reset Feature - Backend Implementation Requirements

## 📋 Overview

The frontend application has been updated to include complete password reset functionality using AWS Amplify's `resetPassword` and `confirmResetPassword` methods. This document outlines the required backend infrastructure changes needed to support this feature.

## 🎯 Frontend Implementation Status

### ✅ **Completed Frontend Changes**
- Added "Forgot Password" link to login form
- Implemented email input form for password reset requests
- Created reset code confirmation form with new password input
- Integrated AWS Amplify v6 password reset methods
- Full user flow: Request → Email → Code Entry → Password Reset → Login

### 📱 **User Flow Implemented**
1. **Login Page** → User clicks "Forgot your password?"
2. **Email Form** → User enters email address → Calls `resetPassword()`
3. **Reset Code Form** → User enters 6-digit code + new password → Calls `confirmResetPassword()`
4. **Success** → User redirected back to login with success message

## 🔧 Required Backend Changes

### 1. AWS Cognito User Pool Configuration

#### **Password Policy Settings**
Update the Cognito User Pool with appropriate password policies:

```typescript
// In your Cognito CDK stack (aerotage-time-reporting-api repository)
const userPool = new cognito.UserPool(this, 'AerotageUserPool', {
  userPoolName: `aerotage-time-${stage}`,
  
  // ✅ REQUIRED: Password policy configuration
  passwordPolicy: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: false, // Optional - adjust per security requirements
  },
  
  // ✅ REQUIRED: Enable email as sign-in alias
  signInAliases: {
    email: true,
    username: false,
  },
  
  // ✅ REQUIRED: Account recovery settings
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
  
  // ✅ REQUIRED: Disable self-signup (admin-only user creation)
  selfSignUpEnabled: false,
  
  // Other existing configuration...
});
```

#### **User Pool Client Configuration**
Ensure the user pool client supports password reset flows:

```typescript
const userPoolClient = userPool.addClient('AerotageAppClient', {
  userPoolClientName: `aerotage-time-app-${stage}`,
  
  // ✅ REQUIRED: Enable authentication flows
  authFlows: {
    userPassword: true,
    userSrp: true,
    adminUserPassword: true,
    custom: true,
  },
  
  // ✅ REQUIRED: Security settings
  preventUserExistenceErrors: true,
  
  // ✅ REQUIRED: Write attributes for password reset
  writeAttributes: new cognito.ClientAttributes()
    .withStandardAttributes({
      email: true,
      emailVerified: true,
    }),
  
  // Token validity periods
  accessTokenValidity: Duration.hours(1),
  idTokenValidity: Duration.hours(1),
  refreshTokenValidity: Duration.days(30),
  
  // Other existing configuration...
});
```

### 2. Email Configuration

#### **Option A: Default Cognito Email (Quick Setup)**
```typescript
// Use Cognito's built-in email service (free tier: 50 emails/day)
const userPool = new cognito.UserPool(this, 'AerotageUserPool', {
  // ... other configuration
  
  // ✅ BASIC: Use default Cognito email
  email: cognito.UserPoolEmail.withCognito(),
});
```

#### **Option B: Amazon SES Integration (Recommended for Production)**
```typescript
// Use Amazon SES for professional email delivery
const userPool = new cognito.UserPool(this, 'AerotageUserPool', {
  // ... other configuration
  
  // ✅ RECOMMENDED: Use SES for email delivery
  email: cognito.UserPoolEmail.withSES({
    fromEmail: 'noreply@aerotage.com',
    fromName: 'Aerotage Time App',
    sesRegion: 'us-east-1',
    sesVerifiedDomain: 'aerotage.com', // Optional: if using verified domain
  }),
});
```

**SES Setup Requirements (if using Option B):**
1. Verify sender email address in SES console
2. Configure DKIM and SPF records
3. Request production access (move out of sandbox)
4. Set up bounce and complaint handling

### 3. Email Templates (Optional but Recommended)

#### **Custom Password Reset Email Template**
```typescript
// Custom email template for password reset
new cognito.CfnUserPoolUICustomizationAttachment(this, 'EmailCustomization', {
  userPoolId: userPool.userPoolId,
  clientId: userPoolClient.userPoolClientId,
  // Add custom CSS and email templates here
});

// Or use CloudFormation to set email templates
const emailTemplate = {
  EmailMessage: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">Reset Your Aerotage Time Password</h2>
      <p>You requested a password reset for your Aerotage Time account.</p>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
        <h3 style="margin: 0; font-size: 24px; letter-spacing: 3px;">{####}</h3>
        <p style="margin: 10px 0 0 0; color: #6b7280;">Enter this code to reset your password</p>
      </div>
      <p><strong>This code expires in 15 minutes.</strong></p>
      <p>If you didn't request this reset, please ignore this email.</p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px;">Aerotage Design Group, Inc.</p>
    </div>
  `,
  EmailSubject: 'Reset Your Aerotage Time Password',
  SmsMessage: 'Your Aerotage Time password reset code: {####}',
};
```

### 4. Security Configuration

#### **Rate Limiting and Security Policies**
```typescript
// Configure security policies
const userPool = new cognito.UserPool(this, 'AerotageUserPool', {
  // ... other configuration
  
  // ✅ SECURITY: Account lockout policies
  deviceTracking: {
    challengeRequiredOnNewDevice: true,
    deviceOnlyRememberedOnUserPrompt: true,
  },
  
  // ✅ SECURITY: Advanced security features
  advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
  
  // ✅ SECURITY: Lambda triggers for additional validation
  lambdaTriggers: {
    preAuthentication: preAuthLambda, // Optional: additional security checks
    postAuthentication: postAuthLambda, // Optional: logging/audit
  },
});
```

#### **CloudWatch Monitoring**
```typescript
// Add CloudWatch alarms for password reset monitoring
new cloudwatch.Alarm(this, 'PasswordResetAlarm', {
  alarmName: `aerotage-password-reset-high-volume-${stage}`,
  metric: new cloudwatch.Metric({
    namespace: 'AWS/Cognito',
    metricName: 'ForgotPasswordRequests',
    dimensionsMap: {
      UserPool: userPool.userPoolId,
    },
    statistic: 'Sum',
  }),
  threshold: 50, // Alert if more than 50 reset requests per hour
  evaluationPeriods: 1,
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
});
```

## 🧪 Testing Requirements

### **Backend Testing Checklist**
- [ ] Deploy Cognito configuration to development environment
- [ ] Verify email delivery (test with real email addresses)
- [ ] Test password reset flow end-to-end
- [ ] Validate security policies (rate limiting, code expiration)
- [ ] Test error scenarios (invalid email, expired code, etc.)

### **Frontend Integration Testing**
1. **Valid Email Test**: Enter valid user email → Should receive reset code
2. **Invalid Email Test**: Enter non-existent email → Should show appropriate error
3. **Code Validation**: Enter correct/incorrect codes → Verify behavior
4. **Password Policy**: Test new passwords against policy requirements
5. **Flow Completion**: Complete full reset → Should be able to login with new password

### **Test Scenarios to Validate**
```bash
# Test Cases for API Team
1. Password reset request with valid email
2. Password reset request with invalid/non-existent email
3. Reset code validation with correct code
4. Reset code validation with incorrect code
5. Reset code validation with expired code
6. Password reset with weak password (should fail policy)
7. Password reset with strong password (should succeed)
8. Multiple reset requests (rate limiting test)
```

## 🚨 Security Considerations

### **Built-in Cognito Security Features**
- ✅ **Code Expiration**: Reset codes expire in 15 minutes (default)
- ✅ **Rate Limiting**: Cognito automatically rate limits reset requests
- ✅ **Secure Code Generation**: Cryptographically secure 6-digit codes
- ✅ **User Existence Protection**: Doesn't reveal if email exists or not

### **Additional Security Measures**
1. **Monitoring**: Set up CloudWatch alarms for unusual activity
2. **Audit Logging**: Log all password reset attempts
3. **Email Validation**: Ensure emails are sent only to verified addresses
4. **IP Tracking**: Consider logging IP addresses for reset requests
5. **Account Lockout**: Configure temporary lockout after multiple failed attempts

## 📋 Deployment Checklist

### **Pre-Deployment**
- [ ] Review password policy requirements with security team
- [ ] Configure email settings (SES or default Cognito)
- [ ] Set up CloudWatch monitoring and alarms
- [ ] Prepare email templates (if using custom templates)

### **Deployment Steps**
1. **Development Environment**
   ```bash
   # Deploy to dev environment first
   npm run deploy:dev
   ```

2. **Configuration Validation**
   ```bash
   # Verify Cognito configuration
   aws cognito-idp describe-user-pool --user-pool-id <pool-id>
   ```

3. **Frontend Configuration Update**
   - Update frontend `aws-config.ts` if User Pool ID changes
   - Verify frontend connects to correct environment

4. **End-to-End Testing**
   - Test password reset flow with real email addresses
   - Validate all error scenarios

### **Post-Deployment**
- [ ] Monitor CloudWatch logs for errors
- [ ] Test with different email providers (Gmail, Outlook, etc.)
- [ ] Verify email deliverability (check spam folders)
- [ ] Document any additional configuration for operations team

## 🔗 Frontend Integration Points

### **AWS Amplify Methods Used**
```typescript
// Methods already implemented in frontend
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';

// Request password reset
await resetPassword({ username: email });

// Confirm password reset with code
await confirmResetPassword({
  username: email,
  confirmationCode: code,
  newPassword: newPassword,
});
```

### **Error Handling**
The frontend handles these error scenarios:
- Network connectivity issues
- Invalid email addresses
- Incorrect reset codes
- Password policy violations
- Expired reset codes
- Rate limiting responses

## 📞 Support Information

### **Common Issues and Solutions**
1. **Email Not Received**: Check SES configuration, spam folders, email quotas
2. **Code Expired**: Default 15-minute expiration, user must request new code
3. **Password Policy Errors**: Frontend validates against same policy as backend
4. **Rate Limiting**: Cognito built-in protection, educate users about limits

### **Monitoring and Debugging**
- **CloudWatch Logs**: `/aws/cognito/userpool/<pool-id>`
- **SES Bounce/Complaint Handling**: Configure SNS notifications
- **API Gateway Logs**: Monitor for authentication errors

## 🎯 Success Criteria

### **Functional Requirements**
- ✅ Users can request password reset via email
- ✅ Reset codes are delivered within 5 minutes
- ✅ Users can successfully reset passwords using valid codes
- ✅ Invalid attempts are properly rejected
- ✅ New passwords meet security policy requirements

### **Security Requirements**
- ✅ Reset codes expire after 15 minutes
- ✅ Rate limiting prevents abuse
- ✅ No information leakage about account existence
- ✅ All attempts are logged for audit purposes

### **Performance Requirements**
- ✅ Email delivery within 5 minutes
- ✅ Reset process completes within 30 seconds
- ✅ System handles concurrent reset requests efficiently

---

**📧 Contact**: Frontend team available for integration testing and troubleshooting
**⚡ Priority**: High - Required for production release
**🗓️ Timeline**: Please prioritize for next development sprint 