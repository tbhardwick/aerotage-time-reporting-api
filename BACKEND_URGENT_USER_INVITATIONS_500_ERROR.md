# ✅ RESOLVED: User Invitations 500 Error - Backend Investigation Required

**Date:** December 2024  
**Priority:** High - ✅ RESOLVED  
**Repository:** aerotage-time-reporting-api  
**Frontend Repository:** aerotage_time_reporting_app  
**Issue:** User invitation creation failing with 500 Internal Server Error  

> **🎉 STATUS: COMPLETELY RESOLVED**  
> **Root Cause:** DynamoDB marshalling error - AWS SDK v3 missing `removeUndefinedValues: true`  
> **Fix:** Updated all `marshall()` calls in invitation-repository.ts  
> **Deployed:** ✅ AerotageAPI-dev stack successfully deployed  
> **See:** `BACKEND_URGENT_USER_INVITATIONS_500_ERROR_RESOLVED.md` for complete resolution details  

---

## 📋 Issue Summary

The user invitation system frontend is **fully implemented and functional**, but backend Lambda functions are returning **500 Internal Server Error** when attempting to create user invitations. All investigation points to backend infrastructure issues.

### ✅ What's Working
- ✅ Frontend API integration complete
- ✅ API Gateway endpoints deployed and reachable
- ✅ Authentication working (requests get past 403 barrier)
- ✅ Request payload correctly formatted
- ✅ All user invitation endpoints exist

### ❌ What's Failing
- ❌ Lambda function crashes during execution
- ❌ Generic error response returned instead of specific details
- ❌ User invitations cannot be created

---

## 🔍 Investigation Results

### API Endpoint Status (via `debug-api.js`)
```
✅ GET /user-invitations: 403 Forbidden (good - endpoint exists, needs auth)
✅ POST /user-invitations: 403 Forbidden (good - endpoint exists, needs auth)
✅ All other endpoints: 403 Forbidden (confirming API Gateway working)
```

**Result:** All endpoints are deployed and accessible. Issue is **post-authentication**.

### Frontend Error Details
**Request Payload (correctly formatted):**
```json
{
  "email": "brad.hardwick@aerotage.com",
  "role": "employee",
  "hourlyRate": 100,
  "permissions": {
    "features": ["timeTracking"],
    "projects": []
  }
}
```

**Server Response:**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred"
  },
  "timestamp": "2025-05-24T23:09:17.127Z"
}
```

**HTTP Status:** 500 Internal Server Error

---

## 🎯 Root Cause Analysis

The Lambda function is **receiving the request** but **crashing during execution**. The generic error message indicates proper error handling structure but **masking the real underlying issue**.

### 🔴 Most Likely Causes (in order of probability):

#### 1. Missing DynamoDB Table (**HIGHEST PROBABILITY**)
```bash
# Check if UserInvitations table exists
aws dynamodb describe-table --table-name UserInvitations-dev --region us-east-1
```

**Expected Error in Lambda:**
```
ResourceNotFoundException: Requested resource not found
Cannot do operations on a non-existent table
```

#### 2. Missing Environment Variables
Lambda expects these environment variables:
```bash
FRONTEND_BASE_URL=https://time.aerotage.com
SES_FROM_EMAIL=noreply@aerotage.com
SES_REPLY_TO_EMAIL=support@aerotage.com
INVITATION_EXPIRY_DAYS=7
```

#### 3. Missing IAM Permissions
Lambda execution role needs:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/UserInvitations*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendTemplatedEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

#### 4. Missing SES Configuration
- SES email templates not created
- SES domain not verified
- SES in sandbox mode blocking emails

### 🟡 Possible Secondary Issues:

#### 5. Runtime Dependencies
Missing AWS SDK v3 packages in Lambda:
```json
{
  "@aws-sdk/client-dynamodb": "^3.x.x",
  "@aws-sdk/client-ses": "^3.x.x",
  "@aws-sdk/lib-dynamodb": "^3.x.x"
}
```

#### 6. Code Bugs
- Null reference exceptions
- Improper async/await handling
- JSON parsing errors

---

## 🔧 Immediate Action Items

### 1. **Check CloudWatch Logs (CRITICAL)**
```bash
# Get actual Lambda error details
aws logs filter-log-events \
  --log-group-name /aws/lambda/user-invitations-create-dev \
  --start-time $(date -d '30 minutes ago' +%s)000 \
  --filter-pattern "ERROR"

# Alternative log group names to check:
# /aws/lambda/aerotage-time-api-dev-createUserInvitation
# /aws/lambda/UserInvitationsFunction-dev
```

### 2. **Verify DynamoDB Infrastructure**
```bash
# Check if table exists
aws dynamodb list-tables --region us-east-1 | grep -i invitation

# Describe table if it exists
aws dynamodb describe-table --table-name UserInvitations-dev --region us-east-1

# Check CloudFormation stack
aws cloudformation describe-stacks --stack-name AerotageTimeAPI-dev --region us-east-1
```

### 3. **Check Lambda Configuration**
```bash
# Get function configuration
aws lambda get-function-configuration --function-name user-invitations-create-dev

# Check environment variables
aws lambda get-function-configuration \
  --function-name user-invitations-create-dev \
  --query 'Environment.Variables'
```

### 4. **Verify SES Setup**
```bash
# Check SES configuration
aws ses describe-configuration-set --configuration-set-name aerotage-time-dev

# List email templates
aws ses list-templates --region us-east-1

# Check domain verification
aws ses get-identity-verification-attributes \
  --identities aerotage.com --region us-east-1
```

---

## 🏗️ Expected Infrastructure (From Requirements)

Based on `USER_INVITATION_API_REQUIREMENTS.md`, these should be deployed:

### DynamoDB Table: `UserInvitations`
```typescript
{
  PK: string; // "INVITATION#{id}"
  SK: string; // "INVITATION#{id}"
  GSI1PK: string; // "EMAIL#{email}"
  GSI1SK: string; // "INVITATION#{createdAt}"
  id: string;
  email: string;
  invitedBy: string;
  role: 'admin' | 'manager' | 'employee';
  // ... other fields
}
```

### Lambda Functions
- `user-invitations-create`
- `user-invitations-list`
- `user-invitations-resend`
- `user-invitations-cancel`
- `user-invitations-validate`
- `user-invitations-accept`

### SES Email Templates
- `aerotage-user-invitation-dev`
- `aerotage-invitation-reminder-dev`
- `aerotage-user-welcome-dev`

---

## 🔧 Quick Fixes

### 1. **Improve Lambda Error Logging**
Update Lambda error handling to return specific errors:

```javascript
// CURRENT (generic error):
catch (error) {
  return {
    statusCode: 500,
    body: JSON.stringify({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred' // ❌ Too generic
      }
    })
  };
}

// IMPROVED (specific error):
catch (error) {
  console.error('Invitation creation failed:', error);
  
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let errorMessage = error.message;
  
  if (error.name === 'ResourceNotFoundException') {
    errorCode = 'TABLE_NOT_FOUND';
    errorMessage = 'UserInvitations table does not exist';
  } else if (error.name === 'ValidationException') {
    errorCode = 'INVALID_REQUEST';
    errorMessage = 'Invalid request data';
  } else if (error.name === 'AccessDeniedException') {
    errorCode = 'INSUFFICIENT_PERMISSIONS';
    errorMessage = 'Lambda lacks required permissions';
  }
  
  return {
    statusCode: 500,
    body: JSON.stringify({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    })
  };
}
```

### 2. **Create Missing Table (if needed)**
```bash
# Deploy the CDK stack that should create the table
cd infrastructure
npm run deploy
```

### 3. **Test Backend Independently**
```bash
# Test Lambda function directly
aws lambda invoke \
  --function-name user-invitations-create-dev \
  --payload '{"email":"test@example.com","role":"employee","permissions":{"features":["timeTracking"],"projects":[]}}' \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json
```

---

## 📊 Testing & Verification

### Once Fixed, Verify:
1. **DynamoDB Table Operations**
   ```bash
   aws dynamodb scan --table-name UserInvitations-dev --limit 5
   ```

2. **SES Email Sending**
   ```bash
   aws ses send-email \
     --source noreply@aerotage.com \
     --destination ToAddresses=test@example.com \
     --message Subject={Data="Test"},Body={Text={Data="Test message"}}
   ```

3. **Lambda Function Health**
   ```bash
   aws logs filter-log-events \
     --log-group-name /aws/lambda/user-invitations-create-dev \
     --filter-pattern "SUCCESS"
   ```

### Frontend Testing
Once backend is fixed, frontend testing will show:
```
✅ POST /user-invitations: 201 Created (success!)
✅ Email sent via SES
✅ UserInvitation record created in DynamoDB
✅ Frontend invitation list updates
```

---

## 📞 Support Information

### Related Documentation
- **Backend Repo:** `aerotage-time-reporting-api`
- **Requirements:** `USER_INVITATION_API_REQUIREMENTS.md`
- **Implementation:** `USER_INVITATION_IMPLEMENTATION_SUMMARY.md`

### Frontend Status
- ✅ **API Client:** Fully implemented with all 6 invitation methods
- ✅ **UI Components:** InvitationForm, InvitationList, AcceptInvitationPage
- ✅ **State Management:** React Context with invitation actions
- ✅ **Error Handling:** Enhanced with detailed logging
- ✅ **Integration:** Ready for backend once fixed

### Contact
- **Frontend Lead:** Ready to test once backend issues resolved
- **Debug Scripts:** `debug-api.js` available for endpoint testing
- **Logs:** Frontend providing detailed error information

---

## 🎯 Expected Resolution Time

**Critical Path:**
1. ⏱️ **5 minutes:** Check CloudWatch logs for actual error
2. ⏱️ **15 minutes:** Verify/create missing DynamoDB table
3. ⏱️ **10 minutes:** Configure missing environment variables
4. ⏱️ **15 minutes:** Set up IAM permissions
5. ⏱️ **10 minutes:** Test and verify fix

**Total Estimated Time:** ~1 hour

---

## 🚨 Summary

**The frontend invitation system is 100% complete and ready.** This is purely a backend infrastructure issue. The Lambda function is deployed but missing critical dependencies (most likely the DynamoDB table).

**Immediate Action:** Check CloudWatch logs for the actual error, then systematically verify each infrastructure component listed above.

**Once fixed:** The entire invitation system will work end-to-end, including email sending, token validation, and user registration flow. 