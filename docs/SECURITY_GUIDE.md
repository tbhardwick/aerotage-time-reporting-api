# Security Guide

## 🔐 **Aerotage Time Reporting API - Security Implementation**

This guide covers all security features, configurations, and best practices implemented in the Aerotage Time Reporting API.

---

## 🏗️ **Security Architecture**

### **Authentication Stack**
- **AWS Cognito User Pool**: Enterprise-grade user authentication
- **JWT Tokens**: Stateless authentication with 1-hour expiry
- **Role-Based Access Control**: Admin, Manager, Employee roles
- **Multi-Factor Authentication**: SMS and TOTP support
- **Device Tracking**: Challenge required on new devices

### **Authorization Model**
- **Role Hierarchy**: Admin > Manager > Employee
- **Resource-Based Permissions**: User can only access own resources
- **API Gateway Integration**: Cognito authorizer on all endpoints
- **Lambda Validation**: Additional authorization checks in functions

---

## 🔑 **Authentication Features**

### **User Pool Configuration**
```typescript
// Current Cognito User Pool Settings
{
  userPoolId: 'us-east-1_EsdlgX9Qg',
  userPoolWebClientId: '148r35u6uultp1rmfdu22i8amb',
  identityPoolId: 'us-east-1:d79776bb-4b8e-4654-a10a-a45b1adaa787',
  
  // Authentication flows
  authenticationFlowType: 'USER_SRP_AUTH',
  
  // Security settings
  advancedSecurityMode: 'ENFORCED',
  deviceTracking: 'CHALLENGE_REQUIRED',
  selfSignUpEnabled: false, // Admin-only user creation
}
```

### **Password Policy**
- **Minimum Length**: 8 characters
- **Requirements**: 
  - Lowercase letters (required)
  - Uppercase letters (required)
  - Numbers (required)
  - Special characters (optional)
- **Password History**: Prevents reuse of last 5 passwords
- **Temporary Password Validity**: 7 days
- **Password Expiration**: Configurable (default: 90 days)

### **Account Security**
- **Account Lockout**: After 5 failed login attempts
- **Lockout Duration**: 30 minutes (configurable)
- **User Existence Protection**: Enabled (doesn't reveal if email exists)
- **Email Verification**: Required for account activation
- **Sign-in Aliases**: Email only

---

## 🔒 **Password Management**

### **Password Reset Implementation**

#### **Backend Configuration**
- **Email Service**: Default Cognito Email Service (50 emails/day)
- **Reset Code Expiration**: 15 minutes
- **Code Generation**: Cryptographically secure 6-digit codes
- **Rate Limiting**: Built-in Cognito protection

#### **API Integration**
```typescript
// Frontend implementation
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

#### **Security Features**
- **No Information Leakage**: Doesn't reveal if user exists
- **Audit Logging**: All reset attempts logged to CloudWatch
- **Rate Limiting**: Automatic protection against abuse
- **Code Validation**: Secure validation with expiration

### **Password Change API**
```http
PUT /users/{userId}/password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "CurrentPass123!",
  "newPassword": "NewSecurePass456!"
}
```

**Validation Rules**:
- Current password must be verified
- New password must meet policy requirements
- Cannot reuse last 5 passwords
- Password history is maintained securely

---

## 🛡️ **Security Settings Management**

### **User Security Configuration**
```typescript
interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number; // 15 minutes to 30 days
  allowMultipleSessions: boolean;
  passwordChangeRequired: boolean;
  passwordLastChanged: string;
  passwordExpiresAt: string;
  securitySettings: {
    requirePasswordChangeEvery: number; // days
    maxFailedLoginAttempts: number;
    accountLockoutDuration: number; // minutes
  };
}
```

### **Security Settings API**
```http
GET /users/{userId}/security-settings
PUT /users/{userId}/security-settings
Authorization: Bearer {token}
```

**Configurable Options**:
- Session timeout (15 minutes to 30 days)
- Multiple session allowance
- Password change frequency
- Failed login attempt limits
- Account lockout duration

---

## 📱 **Session Management Security**

### **Session Tracking**
- **Multi-Session Support**: Track concurrent sessions
- **Session Details**: IP address, user agent, location
- **Current Session Identification**: Prevent self-termination
- **Automatic Cleanup**: Expired sessions removed automatically
- **Security Logging**: All session events logged

### **Session Security Features**
```typescript
interface SessionRecord {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  loginTime: string;
  lastActivity: string;
  isCurrent: boolean;
  location: {
    city: string;
    country: string;
  };
}
```

### **Session Termination & Cleanup**

#### **Individual Session Termination**
```http
DELETE /users/{userId}/sessions/{sessionId}
Authorization: Bearer {token}
```

**Security Rules**:
- **Database Deletion**: Sessions are permanently deleted from database (not just marked inactive)
- **Current Session Protection**: Users cannot terminate their current session
- **Admin Override**: Admin can terminate any session
- **Audit Logging**: All termination events logged
- **JWT Validity**: JWT tokens remain valid until expiry

#### **Complete Logout with Cleanup**
```http
POST /logout
Authorization: Bearer {token}
Content-Type: application/json

{}
```

**Security Features**:
- **Current Session Cleanup**: Automatically finds and deletes current session
- **Expired Session Cleanup**: Removes all expired sessions for the user
- **Session Identification**: Uses user agent and IP to identify current session
- **Comprehensive Cleanup**: Ensures no orphaned session records
- **Audit Trail**: Complete logout process logged

#### **Automated Session Cleanup**
- **Background Job**: Runs every 6 hours automatically
- **Cleanup Criteria**:
  - Sessions past expiration date
  - Inactive sessions (isActive = false)
  - Orphaned sessions (older than 30 days)
- **Batch Processing**: Efficient cleanup of large session volumes
- **Error Handling**: Graceful handling of cleanup failures

---

## 🔍 **Monitoring & Alerting**

### **CloudWatch Security Monitoring**

#### **Password Reset Monitoring**
- **High Volume Alarm**: >50 reset requests/hour
- **Confirmation Errors**: >10 failed confirmations/15 minutes
- **Dashboard Widget**: Dedicated password reset monitoring
- **SNS Integration**: Alerts sent to `aerotage-alerts-{stage}`

#### **Authentication Monitoring**
- **Failed Login Attempts**: Track and alert on patterns
- **Account Lockouts**: Monitor lockout frequency
- **Unusual Login Patterns**: Geographic and time-based analysis
- **Token Validation Failures**: Monitor invalid token usage

#### **Session Monitoring**
- **Concurrent Sessions**: Track multiple session usage
- **Session Anomalies**: Unusual session patterns
- **Geographic Tracking**: Monitor login locations
- **Device Tracking**: New device challenges

### **Security Metrics**
```typescript
// Key security metrics tracked
{
  authenticationAttempts: number;
  failedLogins: number;
  accountLockouts: number;
  passwordResets: number;
  sessionCreations: number;
  sessionTerminations: number;
  securityPolicyViolations: number;
}
```

---

## 🚨 **Security Incident Response**

### **Automated Responses**
- **Account Lockout**: Automatic after failed attempts
- **Rate Limiting**: Built-in protection against abuse
- **Session Termination**: Suspicious activity detection
- **Alert Generation**: Real-time security alerts

### **Manual Response Procedures**
1. **Investigate Alerts**: Review CloudWatch logs and metrics
2. **User Communication**: Notify affected users if needed
3. **Access Revocation**: Terminate sessions if compromised
4. **Password Reset**: Force password reset if needed
5. **Documentation**: Log incident details and resolution

### **Security Audit Trail**
All security events are logged with:
- **Timestamp**: Exact time of event
- **User ID**: Affected user identifier
- **IP Address**: Source of request
- **Action**: Specific security action taken
- **Result**: Success or failure status
- **Additional Context**: Relevant security details

---

## 🔧 **Security Configuration**

### **Environment-Specific Settings**

#### **Development Environment**
- **Cognito Email**: Default service (50 emails/day)
- **Logging Level**: DEBUG for security events
- **Session Timeout**: 8 hours (development convenience)
- **MFA**: Optional for testing

#### **Production Environment**
- **SES Integration**: High-volume email service
- **Logging Level**: INFO/WARN for security events
- **Session Timeout**: 1 hour (security-focused)
- **MFA**: Enforced for admin accounts

### **Security Headers**
```typescript
// API Gateway CORS configuration
{
  "Access-Control-Allow-Origin": "*", // Configure for production domain
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block"
}
```

---

## 🧪 **Security Testing**

### **Automated Security Tests**
- **Authentication Tests**: Valid/invalid credentials
- **Authorization Tests**: Role-based access control
- **Password Policy Tests**: Policy enforcement
- **Session Tests**: Multi-session scenarios
- **Rate Limiting Tests**: Abuse protection
- **Input Validation Tests**: SQL injection, XSS prevention

### **Security Test Scenarios**
```bash
# Test password reset flow
curl -X POST "${API_URL}/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Test invalid token access
curl -X GET "${API_URL}/users/profile" \
  -H "Authorization: Bearer invalid-token"

# Test rate limiting
for i in {1..60}; do
  curl -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com", "password": "wrong"}'
done
```

### **Manual Security Testing**
- **Penetration Testing**: Third-party security assessment
- **Vulnerability Scanning**: Regular automated scans
- **Code Review**: Security-focused code reviews
- **Compliance Audit**: Regular compliance checks

---

## 📋 **Security Compliance**

### **Data Protection**
- **Encryption at Rest**: All DynamoDB tables encrypted
- **Encryption in Transit**: HTTPS/TLS for all communications
- **Key Management**: AWS KMS for encryption keys
- **Data Minimization**: Only collect necessary user data
- **Data Retention**: Configurable retention policies

### **Access Control**
- **Principle of Least Privilege**: Minimal required permissions
- **Role Separation**: Clear role boundaries
- **Regular Access Review**: Periodic permission audits
- **Privileged Access**: Enhanced security for admin accounts

### **Audit Requirements**
- **Comprehensive Logging**: All security events logged
- **Log Retention**: Configurable retention periods
- **Log Integrity**: Tamper-evident logging
- **Regular Audits**: Scheduled security reviews

---

## 🔮 **Future Security Enhancements**

### **Planned Improvements**
- **Custom Email Templates**: Enhanced password reset emails
- **Advanced MFA**: Hardware token support
- **Risk-Based Authentication**: Adaptive authentication
- **Behavioral Analytics**: User behavior monitoring
- **Zero Trust Architecture**: Enhanced security model

### **SES Integration for Production**
```typescript
// Future SES configuration
email: cognito.UserPoolEmail.withSES({
  fromEmail: 'noreply@aerotage.com',
  fromName: 'Aerotage Time App',
  replyToEmail: 'support@aerotage.com',
})
```

---

## 📞 **Security Support**

### **Security Contacts**
- **Security Team**: security@aerotage.com
- **Incident Response**: incidents@aerotage.com
- **Vulnerability Reports**: security-reports@aerotage.com

### **Emergency Procedures**
1. **Immediate Response**: Contact security team
2. **System Isolation**: Isolate affected components
3. **User Notification**: Inform affected users
4. **Incident Documentation**: Record all details
5. **Post-Incident Review**: Analyze and improve

---

## ✅ **Security Checklist**

### **Implementation Status**
- ✅ **Authentication**: AWS Cognito with JWT tokens
- ✅ **Authorization**: Role-based access control
- ✅ **Password Security**: Strong policies and reset flow
- ✅ **Session Management**: Secure multi-session tracking
- ✅ **Monitoring**: Comprehensive security logging
- ✅ **Encryption**: Data encrypted in transit and at rest
- ✅ **Input Validation**: All inputs validated and sanitized
- ✅ **Rate Limiting**: Protection against abuse
- ✅ **Audit Trail**: Complete security event logging

### **Production Readiness**
- ✅ **Security Testing**: Comprehensive test coverage
- ✅ **Monitoring**: Real-time security monitoring
- ✅ **Incident Response**: Procedures documented
- ✅ **Compliance**: Security best practices implemented
- 📋 **SES Integration**: Planned for production
- 📋 **Custom Templates**: Enhanced email security
- 📋 **Advanced MFA**: Hardware token support

---

**🔐 The Aerotage Time Reporting API implements enterprise-grade security features with comprehensive monitoring, audit trails, and incident response capabilities.** 