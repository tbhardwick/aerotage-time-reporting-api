# Troubleshooting Guide

## 🚨 **Aerotage Time Reporting API - Troubleshooting Guide**

This guide covers common issues, solutions, and debugging procedures for the Aerotage Time Reporting API backend infrastructure.

## 🔧 **Infrastructure and Deployment Issues**

### **CDK Bootstrap Issues**

#### **Issue: "Need to perform AWS CDK bootstrap"**
**Error Message:**
```
This stack uses assets, so the toolkit stack must be deployed to the environment
```

**Solution:**
```bash
# Bootstrap the environment
cd infrastructure
cdk bootstrap --profile aerotage-dev

# For specific regions
cdk bootstrap aws://ACCOUNT-NUMBER/us-east-1 --profile aerotage-dev
```

#### **Issue: CDK Version Mismatch**
**Error Message:**
```
This CDK CLI is not compatible with the CDK library used by your application
```

**Solution:**
```bash
# Update CDK globally
npm install -g aws-cdk@latest

# Update project dependencies
cd infrastructure
npm update

# Verify versions match
cdk --version
npm list aws-cdk-lib
```

### **AWS Credentials and Permissions**

#### **Issue: "User is not authorized to perform..."**
**Error Message:**
```
User: arn:aws:iam::123456789012:user/username is not authorized to perform: cloudformation:CreateStack
```

**Solution:**
```bash
# Check current user
aws sts get-caller-identity

# Verify IAM permissions
aws iam get-user
aws iam list-attached-user-policies --user-name YOUR_USERNAME

# Required permissions for CDK deployment:
# - CloudFormation full access
# - IAM role creation
# - Lambda function management
# - API Gateway management
# - DynamoDB table management
# - S3 bucket management
```

#### **Issue: AWS CLI Not Configured**
**Error Message:**
```
Unable to locate credentials
```

**Solution:**
```bash
# Configure AWS CLI
aws configure

# Or use environment variables
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-east-1

# Test configuration
aws sts get-caller-identity
```

### **Resource Conflicts**

#### **Issue: "Resource already exists"**
**Error Message:**
```
Resource of type 'AWS::S3::Bucket' with identifier 'aerotage-storage-dev' already exists
```

**Solution:**
```bash
# Check existing resources
aws cloudformation describe-stacks
aws s3 ls
aws dynamodb list-tables

# Option 1: Use existing resources (update CDK code)
# Option 2: Delete conflicting resources (if safe)
# Option 3: Use different resource names
```

#### **Issue: "Stack does not exist" During Deployment**
**Error Message:**
```
Stack with id AerotageAPI-dev does not exist
```

**Solution:**
```bash
# First-time deployment
cd infrastructure
npm install
npm run build
npm run deploy:dev

# Check if stacks exist
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
```

## 📧 **Email and SES Issues**

### **Email Delivery Problems**

#### **Issue: Password Reset Emails Not Received**
**Common Locations to Check:**
1. **Primary Inbox** - Check first
2. **Spam/Junk Folder** - AWS emails often filtered
3. **Promotions Tab** - Gmail categorization
4. **Corporate Email Filters** - May block AWS domains

**Debugging Commands:**
```bash
# Check SES sending statistics
aws ses get-send-statistics

# Verify email address
aws ses get-identity-verification-attributes --identities your-email@domain.com

# Check SES configuration
aws ses describe-configuration-set --configuration-set-name aerotage-email-config
```

#### **Issue: Email Quota Exceeded**
**Error Message:**
```
Sending quota exceeded
```

**Solution:**
```bash
# Check current quota (free tier: 200 emails/day)
aws ses get-send-quota

# Request quota increase or upgrade to SES
# For development: Use verified email addresses only
aws ses verify-email-identity --email-address test@example.com
```

#### **Issue: SES Domain Not Verified**
**Error Message:**
```
Email address not verified
```

**Solution:**
```bash
# Verify domain (production)
aws ses verify-domain-identity --domain aerotage.com

# Verify individual email (development)
aws ses verify-email-identity --email-address noreply@aerotage.com

# Check verification status
aws ses get-identity-verification-attributes --identities aerotage.com
```

## 🔐 **Authentication and Cognito Issues**

### **User Management Problems**

#### **Issue: "Username should be an email" Error**
**Error Message:**
```
InvalidParameterException: Username should be an email
```

**Cause:** Cognito User Pool configured with `signInAliases: { email: true }`

**Solution:**
```bash
# Use email addresses as usernames
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username "user@domain.com" \
  --user-attributes \
    Name=email,Value="user@domain.com" \
    Name=email_verified,Value=true
```

#### **Issue: "User already exists" Error**
**Solution:**
```bash
# Delete existing user first
aws cognito-idp admin-delete-user \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username "user@domain.com"

# Then create new user
./scripts/setup-admin-user.sh
```

#### **Issue: "UserNotFoundException" During Password Reset**
**Expected Behavior:** This is normal! Cognito doesn't reveal whether a user exists (security feature).

**Frontend Handling:**
```typescript
try {
  await resetPassword({ username: email });
  // Always show success message regardless
  showMessage('If this email is registered, you will receive a reset code.');
} catch (error) {
  // Don't reveal user existence
  showMessage('If this email is registered, you will receive a reset code.');
}
```

### **Password and Security Issues**

#### **Issue: "InvalidPasswordException" During Reset**
**Error Message:**
```
Password does not conform to policy
```

**Password Policy Requirements:**
- Minimum 8 characters
- Must contain lowercase letter
- Must contain uppercase letter
- Must contain number
- Symbols are optional

**Valid Example:** `NewPassword123`

#### **Issue: "CodeExpiredException"**
**Error Message:**
```
Invalid verification code provided, please try again
```

**Solution:**
```bash
# Reset codes expire in 15 minutes
# User must request a new code
aws cognito-idp forgot-password \
  --client-id 148r35u6uultp1rmfdu22i8amb \
  --username "user@domain.com"
```

## 📱 **Session Management Issues**

### **Session Identification Problems**

#### **Issue: "isCurrent: false" for All Sessions**
**Root Cause:** Frontend not creating session records in backend

**Solution:**
```typescript
// Add session creation after Cognito login
const createSession = async (userId: string, accessToken: string) => {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      userAgent: navigator.userAgent,
      loginTime: new Date().toISOString()
    })
  });
  return response.json();
};
```

#### **Issue: "SESSION_MIGRATION_REQUIRED" Error**
**Error Code:** 401 with `SESSION_MIGRATION_REQUIRED`

**Solution:**
```typescript
// Handle migration in frontend
const handleSessionMigration = async (error: any) => {
  if (error.code === 'SESSION_MIGRATION_REQUIRED') {
    localStorage.clear();
    window.location.href = '/login';
    return;
  }
  throw error;
};
```

## 🌐 **API and Frontend Integration Issues**

### **CORS and Network Issues**

#### **Issue: CORS Errors**
**Error Message:**
```
Access to fetch at 'https://api.aerotage.com' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution:** Check API Gateway CORS configuration in `infrastructure/lib/api-stack.ts`

#### **Issue: "net::ERR_NAME_NOT_RESOLVED"**
**Error Message:**
```
GET https://0sty9mf3f7.execute-api.us-east-1.amazonaws.com/dev/user-invitations
net::ERR_NAME_NOT_RESOLVED
```

**Root Cause:** Using outdated API Gateway URL

**Solution:**
```bash
# Get current API URL
aws cloudformation describe-stacks \
  --stack-name AerotageAPI-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text

# Update frontend configuration
# Current URL: https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev//
```

### **Authentication Integration Issues**

#### **Issue: Amplify Configuration Errors**
**Problem:** Frontend can't connect to Cognito

**Check Configuration:**
```typescript
// Verify these values in aws-config.ts
const awsConfig = {
  Auth: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_EsdlgX9Qg',
    userPoolWebClientId: '148r35u6uultp1rmfdu22i8amb',
    identityPoolId: 'us-east-1:d79776bb-4b8e-4654-a10a-a45b1adaa787'
  }
};
```

**Verify Values:**
```bash
# Get current deployment values
aws cloudformation describe-stacks \
  --stack-name AerotageAuth-dev \
  --query 'Stacks[0].Outputs'
```

## 🗄️ **Database and DynamoDB Issues**

### **Table and Index Issues**

#### **Issue: "ResourceNotFoundException"**
**Error Message:**
```
Requested resource not found: Table: aerotage-main-table-dev not found
```

**Solution:**
```bash
# Check if tables exist
aws dynamodb list-tables --region us-east-1

# Redeploy database stack
cd infrastructure
cdk deploy AerotageDatabase-dev --profile aerotage-dev
```

#### **Issue: "ProvisionedThroughputExceededException"**
**Error Message:**
```
The level of configured provisioned throughput for the table was exceeded
```

**Solution:**
```bash
# Check table metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=aerotage-main-table-dev

# Increase provisioned capacity or switch to on-demand
```

### **Data Access Issues**

#### **Issue: "ValidationException" in DynamoDB**
**Error Message:**
```
One or more parameter values were invalid
```

**Common Causes:**
- Invalid attribute types
- Missing required attributes
- Incorrect key structure

**Debugging:**
```bash
# Check table schema
aws dynamodb describe-table --table-name aerotage-main-table-dev

# Verify item structure
aws dynamodb get-item \
  --table-name aerotage-main-table-dev \
  --key '{"PK":{"S":"USER#123"},"SK":{"S":"PROFILE"}}'
```

## 🚀 **Lambda Function Issues**

### **Function Execution Problems**

#### **Issue: Lambda Timeout**
**Error Message:**
```
Task timed out after 30.00 seconds
```

**Solution:**
```bash
# Check function configuration
aws lambda get-function-configuration --function-name aerotage-users-list-dev

# Increase timeout in CDK stack
timeout: Duration.seconds(60)
```

#### **Issue: "Code size exceeds maximum"**
**Error Message:**
```
Unzipped size must be smaller than 262144000 bytes
```

**Solution:**
```bash
# Check bundle size
cd infrastructure
npm run build
ls -la dist/

# Optimize dependencies
# Remove unused packages
# Use webpack bundling
```

#### **Issue: Lambda Cold Starts**
**Problem:** Slow initial response times

**Solutions:**
- Use provisioned concurrency for critical functions
- Optimize bundle size
- Keep connections warm
- Use appropriate memory allocation

### **Environment and Configuration Issues**

#### **Issue: Environment Variables Not Set**
**Error Message:**
```
Environment variable TABLE_NAME is not defined
```

**Solution:** Check CDK stack environment variable configuration:
```typescript
// In Lambda function definition
environment: {
  TABLE_NAME: props.tableName,
  USER_POOL_ID: props.userPoolId,
  REGION: Stack.of(this).region
}
```

## 🔍 **Debugging and Monitoring**

### **CloudWatch Logs**

#### **Viewing Lambda Logs**
```bash
# Tail logs in real-time
aws logs tail /aws/lambda/aerotage-users-list-dev --follow

# Get recent logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/aerotage-users-list-dev \
  --start-time $(date -d '1 hour ago' +%s)000

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/aerotage-users-list-dev \
  --filter-pattern "ERROR"
```

#### **API Gateway Logs**
```bash
# Enable API Gateway logging in CDK
deployOptions: {
  loggingLevel: apigateway.MethodLoggingLevel.INFO,
  dataTraceEnabled: true
}

# View API Gateway logs
aws logs describe-log-groups --log-group-name-prefix "API-Gateway"
```

### **Performance Monitoring**

#### **Lambda Performance**
```bash
# Check function metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=aerotage-users-list-dev \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average,Maximum
```

#### **API Gateway Performance**
```bash
# Check API metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiName,Value=AerotageAPI-dev \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average,Maximum
```

## 🛠️ **Development and Testing Issues**

### **Local Development Problems**

#### **Issue: Cannot Login with Created Users**
**Problem:** Users have temporary passwords

**Solution:**
1. Login with temporary password
2. System prompts for new password
3. Set new password meeting policy requirements
4. Complete login

#### **Issue: Password Reset Test Fails**
**Checklist:**
- [ ] User exists in Cognito User Pool
- [ ] User's email is verified
- [ ] Email address is correct
- [ ] Check spam folder for reset code
- [ ] Code hasn't expired (15 minutes)
- [ ] New password meets policy requirements

### **Build and Compilation Issues**

#### **Issue: TypeScript Compilation Errors**
**Solution:**
```bash
# Check TypeScript configuration
cat tsconfig.json

# Clean build
rm -rf dist/
npm run build

# Check for type errors
npx tsc --noEmit
```

#### **Issue: ESLint Errors**
**Solution:**
```bash
# Run linting
npm run lint

# Auto-fix issues
npm run lint:fix

# Check specific files
npx eslint infrastructure/lambda/users/list.ts
```

## 🔄 **Recovery Procedures**

### **Quick Recovery Commands**

#### **Reset Everything** (Development Only)
```bash
# 1. Delete problematic users
aws cognito-idp admin-delete-user \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username "problem-user@domain.com"

# 2. Redeploy infrastructure
cd infrastructure
npm run deploy:dev

# 3. Create test users
./scripts/setup-admin-user.sh
```

#### **Verify Setup**
```bash
# 1. Check deployment
aws cloudformation describe-stacks --stack-name AerotageAPI-dev

# 2. Test API endpoint
curl -X GET "https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev//health"

# 3. Check user creation
aws cognito-idp list-users --user-pool-id us-east-1_EsdlgX9Qg

# 4. Check monitoring
aws cloudwatch describe-alarms
```

### **Emergency Rollback**
```bash
# Rollback to previous deployment
git log --oneline -10
git checkout <previous-working-commit>
cd infrastructure
npm run deploy:dev

# Or use CloudFormation rollback
aws cloudformation cancel-update-stack --stack-name AerotageAPI-dev
```

## 📞 **Getting Help**

### **Debug Information to Collect**

When reporting issues, include:

1. **Error Messages**: Copy exact error text
2. **AWS CLI Output**: Run commands with `--debug` flag
3. **CloudWatch Logs**: Recent log entries
4. **Configuration**: Verify all IDs and values
5. **Environment**: Development/staging/production
6. **Timestamps**: When the issue occurred

### **Useful Debug Commands**

```bash
# System information
node --version
npm --version
aws --version
cdk --version

# AWS configuration
aws configure list
aws sts get-caller-identity

# Infrastructure status
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
aws lambda list-functions --region us-east-1
aws dynamodb list-tables --region us-east-1

# API testing
curl -X GET "https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev//health"
```

### **Escalation Path**

1. **Check this troubleshooting guide**
2. **Review CloudWatch logs**
3. **Check AWS service status**
4. **Consult AWS documentation**
5. **Contact development team**
6. **Open AWS support case** (if needed)

---

## 🎯 **Prevention Best Practices**

### **Development Practices**
- Always test in development environment first
- Use proper error handling in all functions
- Implement comprehensive logging
- Monitor resource usage and costs
- Keep dependencies up to date

### **Deployment Practices**
- Use infrastructure as code (CDK)
- Implement proper CI/CD pipelines
- Test deployments in staging
- Have rollback procedures ready
- Monitor deployments closely

### **Monitoring Practices**
- Set up CloudWatch alarms
- Monitor key metrics regularly
- Review logs for errors
- Track performance trends
- Set up cost alerts

---

This troubleshooting guide covers the most common issues encountered with the Aerotage Time Reporting API. Keep this guide updated as new issues are discovered and resolved. 