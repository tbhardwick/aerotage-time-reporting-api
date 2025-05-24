# Troubleshooting Guide

## 🚨 Script and Setup Issues

### **Issue: "Username should be an email" Error**

**Problem**: When running `./scripts/setup-admin-user.sh`, you get:
```
An error occurred (InvalidParameterException) when calling the AdminCreateUser operation: Username should be an email.
```

**Cause**: The Cognito User Pool is configured with `signInAliases: { email: true }`, which means usernames must be email addresses.

**Solution**: ✅ **FIXED** - The script has been updated to use email addresses as usernames.

**Alternative Manual Fix**:
```bash
# Create admin user manually
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username "your-admin@domain.com" \
  --user-attributes \
    Name=email,Value="your-admin@domain.com" \
    Name=given_name,Value="Admin" \
    Name=family_name,Value="User" \
    Name=email_verified,Value=true \
    Name=custom:role,Value=admin \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS

# Add to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username "your-admin@domain.com" \
  --group-name admin
```

### **Issue: "User already exists" Error**

**Problem**: Script fails because user already exists.

**Solution**: Delete the existing user first:
```bash
# Delete existing user
aws cognito-idp admin-delete-user \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username "user@domain.com"

# Then re-run the script
./scripts/setup-admin-user.sh
```

### **Issue: AWS CLI Not Configured**

**Problem**: Script fails with AWS authentication errors.

**Solution**: Configure AWS CLI:
```bash
# Configure AWS CLI
aws configure

# Test configuration
aws sts get-caller-identity
```

## 📧 Email Delivery Issues

### **Issue: Password Reset Emails Not Received**

**Check These Locations**:
1. **Primary Inbox**: Most important check first
2. **Spam/Junk Folder**: Cognito emails often go here initially
3. **Promotions Tab**: Gmail sometimes categorizes here
4. **Corporate Email Filters**: May block AWS emails

**Troubleshooting Commands**:
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

### **Issue: Email Quota Exceeded**

**Problem**: Free tier limited to 50 emails/day.

**Solutions**:
1. **Wait**: Quota resets daily
2. **Upgrade to SES**: For production use
3. **Use Test Users**: Created via script/console instead

## 🔐 Authentication Issues

### **Issue: "UserNotFoundException" During Password Reset**

**Expected Behavior**: This is normal! Cognito doesn't reveal whether a user exists (security feature).

**Frontend Handling**:
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

### **Issue: "InvalidPasswordException" During Reset**

**Problem**: New password doesn't meet policy requirements.

**Password Policy**:
- Minimum 8 characters
- Must contain lowercase letter
- Must contain uppercase letter  
- Must contain number
- Symbols are optional

**Valid Example**: `NewPassword123`

### **Issue: "CodeExpiredException"**

**Problem**: Reset code expired (15-minute limit).

**Solution**: Request new reset code:
```typescript
// User must request a new code
await resetPassword({ username: email });
```

## 🖥️ Frontend Integration Issues

### **Issue: Amplify Configuration Errors**

**Problem**: Frontend can't connect to Cognito.

**Check Configuration**:
```typescript
// Verify these values in your aws-config.ts
const awsConfig = {
  Auth: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_EsdlgX9Qg',           // ✅ Check this
    userPoolWebClientId: '148r35u6uultp1rmfdu22i8amb', // ✅ Check this
    identityPoolId: 'us-east-1:d79776bb-4b8e-4654-a10a-a45b1adaa787' // ✅ Check this
  }
};
```

**Verify Values**:
```bash
# Get current deployment values
aws cloudformation describe-stacks \
  --stack-name AerotageAuth-dev \
  --query 'Stacks[0].Outputs'
```

### **Issue: CORS Errors**

**Problem**: Browser blocks API requests.

**Check**: API Gateway CORS configuration in `infrastructure/lib/api-stack.ts`

## 🔧 Infrastructure Issues

### **Issue: "Stack does not exist" During Deployment**

**Problem**: First-time deployment or stack was deleted.

**Solution**:
```bash
cd infrastructure/
npm install
npm run build
npm run deploy:dev
```

### **Issue: CDK Version Mismatch**

**Problem**: CDK version conflicts.

**Solution**:
```bash
# Update CDK globally
npm install -g aws-cdk@latest

# Update project dependencies
cd infrastructure/
npm update
```

### **Issue: "Region mismatch" Errors**

**Problem**: Resources created in different regions.

**Check**: All resources should be in `us-east-1`:
```bash
# Verify your default region
aws configure get region

# Should return: us-east-1
```

## 🧪 Testing Issues

### **Issue: Cannot Login with Created Users**

**Problem**: Users have temporary passwords and must be changed.

**Solution**: Users must change password on first login:
1. Login with temporary password
2. System will prompt for new password
3. Set new password meeting policy requirements
4. Complete login

### **Issue: Password Reset Test Fails**

**Checklist**:
- [ ] User exists in Cognito User Pool
- [ ] User's email is verified
- [ ] Email address is correct
- [ ] Check spam folder for reset code
- [ ] Code hasn't expired (15 minutes)
- [ ] New password meets policy requirements

## 📞 Getting Help

### **Debug Information to Collect**:

1. **Error Messages**: Copy exact error text
2. **AWS CLI Output**: Run commands with `--debug` flag
3. **CloudWatch Logs**: Check relevant log groups
4. **Configuration**: Verify all IDs and values

### **Useful Debug Commands**:

```bash
# Check user pool configuration
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-1_EsdlgX9Qg

# List users in pool
aws cognito-idp list-users \
  --user-pool-id us-east-1_EsdlgX9Qg

# Check user details
aws cognito-idp admin-get-user \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username "user@domain.com"

# View CloudWatch logs
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/cognito"
```

### **When to Contact Support**:

- Infrastructure deployment fails repeatedly
- AWS service errors persist
- Email delivery completely stops working
- Security concerns about configuration

---

## 🎯 Quick Recovery Commands

### **Reset Everything** (if needed):
```bash
# 1. Delete problematic users
aws cognito-idp admin-delete-user \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username "problem-user@domain.com"

# 2. Use manual user creation
./scripts/create-test-users-manual.sh

# 3. Test password reset with new user
```

### **Verify Setup**:
```bash
# 1. Check deployment
aws cloudformation describe-stacks --stack-name AerotageAuth-dev

# 2. Test user creation
aws cognito-idp list-users --user-pool-id us-east-1_EsdlgX9Qg

# 3. Check monitoring
aws cloudwatch describe-alarms --alarm-names aerotage-password-reset-high-volume-dev
```

**Most issues can be resolved by following this troubleshooting guide step by step!** 🚀 