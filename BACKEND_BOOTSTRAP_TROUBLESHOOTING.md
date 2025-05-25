# 🔧 Backend Session Bootstrap Fix - Troubleshooting Guide

## 📋 **Current Issue Summary**

**Status**: Bootstrap fix deployed but not working  
**Symptoms**: Frontend still getting CORS/403 errors on session creation  
**User ID**: `0408a498-40c1-7071-acc9-90665ef117c3`  
**Environment**: Development (`dev`)  
**API Base**: `https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev`

---

## 🚨 **Current Error Pattern**

The frontend is still seeing these errors when trying to create sessions:

```
Access to fetch at 'https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/users/0408a498-40c1-7071-acc9-90665ef117c3/sessions' from origin 'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.

POST https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/users/0408a498-40c1-7071-acc9-90665ef117c3/sessions net::ERR_FAILED 403 (Forbidden)
```

**What this indicates:**
- ✅ JWT token is valid (reaching the authorizer)
- ❌ Lambda authorizer is still returning DENY
- ❌ Request never reaches the actual Lambda function (no CORS headers)
- ❌ Bootstrap logic is not working as expected

---

## 🔍 **Step-by-Step Troubleshooting**

### **1. Verify Lambda Authorizer Deployment**

**Check if the custom authorizer is actually deployed:**

```bash
# List Lambda functions
aws lambda list-functions --query "Functions[?contains(FunctionName, 'authorizer')]"

# Verify the authorizer function exists
aws lambda get-function --function-name "aerotage-custom-authorizer-dev"
```

**Expected**: Function should exist and show recent `LastModified` date

---

### **2. Check API Gateway Authorizer Configuration**

**Verify API Gateway is using the custom authorizer:**

```bash
# Get API Gateway ID
aws apigateway get-rest-apis --query "items[?name=='aerotage-api-dev']"

# Check authorizer configuration (replace {api-id})
aws apigateway get-authorizers --rest-api-id {api-id}
```

**Expected**: Should show custom authorizer with Type: `TOKEN` pointing to your Lambda function

---

### **3. CloudWatch Logs Investigation**

**Check authorizer logs for bootstrap requests:**

```bash
# Get recent authorizer logs
aws logs filter-log-events \
  --log-group-name "/aws/lambda/aerotage-custom-authorizer-dev" \
  --start-time $(date -d '30 minutes ago' +%s)000 \
  --filter-pattern "0408a498-40c1-7071-acc9-90665ef117c3"
```

**Look for these patterns:**

✅ **If bootstrap is working:**
```
🚀 Detected session bootstrap request
Starting JWT-only validation for bootstrap
JWT-only validation successful for user: 0408a498-40c1-7071-acc9-90665ef117c3
✅ Allowing session bootstrap for user: 0408a498-40c1-7071-acc9-90665ef117c3 (no active sessions)
```

❌ **If bootstrap is NOT working:**
```
🔒 Applying normal session validation
JWT validation successful for user: 0408a498-40c1-7071-acc9-90665ef117c3
No active sessions found for user: 0408a498-40c1-7071-acc9-90665ef117c3
❌ Authorization failed: No active sessions for user
```

---

### **4. Method ARN Parsing Verification**

**Check if the authorizer is correctly parsing the Method ARN:**

**Add debug logging to your authorizer to see:**
```typescript
console.log('🔍 Method ARN:', event.methodArn);
console.log('🔍 Parsed HTTP method:', httpMethod);
console.log('🔍 Parsed resource path:', resourcePath);
console.log('🔍 Is bootstrap request?', isSessionBootstrapRequest(httpMethod, resourcePath));
```

**Expected Method ARN format:**
```
arn:aws:execute-api:us-east-1:123456789:abc123def4/dev/POST/users/0408a498-40c1-7071-acc9-90665ef117c3/sessions
```

**Your parsing should extract:**
- HTTP Method: `POST`
- Resource Path: `/users/0408a498-40c1-7071-acc9-90665ef117c3/sessions`

---

### **5. Bootstrap Detection Logic Check**

**Verify your `isSessionBootstrapRequest` function:**

```typescript
function isSessionBootstrapRequest(httpMethod: string, resourcePath: string): boolean {
  console.log('🔍 Bootstrap check:', { httpMethod, resourcePath });
  
  if (httpMethod !== 'POST') {
    console.log('❌ Not POST method');
    return false;
  }
  
  const sessionCreationPatterns = [
    /^\/users\/[^\/]+\/sessions\/?$/,  // /users/{userId}/sessions
    /^\/users\/\*\/sessions\/?$/       // /users/*/sessions (API Gateway pattern)
  ];
  
  const matches = sessionCreationPatterns.some(pattern => {
    const isMatch = pattern.test(resourcePath);
    console.log(`🔍 Pattern ${pattern} matches ${resourcePath}: ${isMatch}`);
    return isMatch;
  });
  
  console.log('🔍 Final bootstrap detection result:', matches);
  return matches;
}
```

**Test with the actual path:** `/users/0408a498-40c1-7071-acc9-90665ef117c3/sessions`

---

### **6. Session Existence Check**

**Verify the session checking logic:**

```typescript
// Add logging to your session check
console.log('🔍 Checking existing sessions for user:', userId);

const command = new QueryCommand({
  TableName: process.env.USER_SESSIONS_TABLE!,
  IndexName: 'UserIndex',
  KeyConditionExpression: 'userId = :userId',
  FilterExpression: 'isActive = :isActive AND expiresAt > :now',
  ExpressionAttributeValues: {
    ':userId': userId,
    ':isActive': true,
    ':now': new Date().toISOString(),
  },
});

const result = await dynamoClient.send(command);
console.log('🔍 Session query result:', {
  count: result.Items?.length || 0,
  items: result.Items
});
```

**Expected for new users**: Should return 0 sessions

---

### **7. Environment Variables Check**

**Verify required environment variables are set:**

```bash
# Check authorizer environment variables
aws lambda get-function-configuration \
  --function-name "aerotage-custom-authorizer-dev" \
  --query "Environment.Variables"
```

**Expected variables:**
- `USER_POOL_ID`: Your Cognito User Pool ID
- `USER_SESSIONS_TABLE`: DynamoDB table name (e.g., `aerotage-user-sessions-dev`)

---

### **8. IAM Permissions Verification**

**Check if authorizer has DynamoDB permissions:**

```bash
# Get authorizer execution role
ROLE_ARN=$(aws lambda get-function-configuration \
  --function-name "aerotage-custom-authorizer-dev" \
  --query "Role" --output text)

# Check attached policies
aws iam list-attached-role-policies --role-name ${ROLE_ARN##*/}
```

**Required permissions:**
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:Query",
    "dynamodb:GetItem"
  ],
  "Resource": [
    "arn:aws:dynamodb:*:*:table/aerotage-user-sessions-dev",
    "arn:aws:dynamodb:*:*:table/aerotage-user-sessions-dev/index/*"
  ]
}
```

---

### **9. DynamoDB Table Investigation**

**Check if sessions table exists and has correct structure:**

```bash
# Describe table
aws dynamodb describe-table --table-name "aerotage-user-sessions-dev"

# Check for existing sessions for test user
aws dynamodb query \
  --table-name "aerotage-user-sessions-dev" \
  --index-name "UserIndex" \
  --key-condition-expression "userId = :userId" \
  --expression-attribute-values '{":userId":{"S":"0408a498-40c1-7071-acc9-90665ef117c3"}}'
```

**Expected**: Table should exist with `UserIndex` GSI on `userId`

---

### **10. End-to-End Authorization Flow Test**

**Add comprehensive logging to trace the full flow:**

```typescript
export const handler = async (event: any): Promise<any> => {
  console.log('🚀 Custom authorizer invoked');
  console.log('📋 Event:', JSON.stringify(event, null, 2));
  
  try {
    // Extract token
    const token = extractToken(event);
    console.log('🎫 Token extracted, length:', token?.length);
    
    // Parse method ARN
    const { httpMethod, resourcePath } = parseMethodArn(event.methodArn);
    console.log('🔍 Parsed request:', { httpMethod, resourcePath });
    
    // Check if bootstrap request
    const isBootstrap = isSessionBootstrapRequest(httpMethod, resourcePath);
    console.log('🐣 Is bootstrap request:', isBootstrap);
    
    if (isBootstrap) {
      console.log('🎯 Processing as bootstrap request');
      
      // JWT-only validation
      const jwtResult = await validateJwtOnly(token);
      console.log('✅ JWT validation result:', jwtResult.success);
      
      if (jwtResult.success) {
        const userId = jwtResult.userId;
        console.log('👤 User ID from JWT:', userId);
        
        // Check for existing sessions
        const hasActiveSessions = await checkUserHasActiveSessions(userId);
        console.log('📊 User has active sessions:', hasActiveSessions);
        
        if (!hasActiveSessions) {
          console.log('🎉 Allowing bootstrap - no active sessions found');
          return generateBootstrapPolicy(userId, 'Allow', event.methodArn);
        } else {
          console.log('⚠️ User has sessions, falling through to normal validation');
        }
      }
    }
    
    console.log('🔒 Processing as normal request (requires session)');
    // Continue with normal validation...
    
  } catch (error) {
    console.error('❌ Authorizer error:', error);
    return generatePolicy(null, 'Deny', event.methodArn);
  }
};
```

---

## 🧪 **Testing the Fix**

### **Manual Test from AWS Console**

**Test the authorizer directly:**

```bash
# Create test event (replace with actual values)
aws lambda invoke \
  --function-name "aerotage-custom-authorizer-dev" \
  --payload '{
    "type": "TOKEN",
    "authorizationToken": "Bearer YOUR_JWT_TOKEN_HERE",
    "methodArn": "arn:aws:execute-api:us-east-1:123456789:abc123def4/dev/POST/users/0408a498-40c1-7071-acc9-90665ef117c3/sessions"
  }' \
  response.json

# Check response
cat response.json
```

**Expected response for bootstrap:**
```json
{
  "principalId": "0408a498-40c1-7071-acc9-90665ef117c3",
  "policyDocument": {
    "Version": "2012-10-17",
    "Statement": [{
      "Action": "execute-api:Invoke",
      "Effect": "Allow",
      "Resource": "arn:aws:execute-api:*:*:*"
    }]
  }
}
```

### **Frontend Integration Test**

**Once fixed, frontend should see:**

```javascript
// Run this in browser console
await window.sessionValidation.testSessionBootstrapFix()

// Expected output:
// 🎉 Normal session creation succeeded - backend bootstrap fix is working!
// ✅ Session ID: [some-uuid]
// 🎉 BOOTSTRAP FIX IS WORKING PERFECTLY!
```

---

## 🔧 **Common Issues & Solutions**

### **Issue 1: Method ARN Parsing**
**Problem**: Authorizer not correctly parsing the Method ARN  
**Solution**: Add logging and verify ARN format matches expectations

### **Issue 2: Bootstrap Detection**
**Problem**: `isSessionBootstrapRequest` returning false  
**Solution**: Check regex patterns match actual resource paths

### **Issue 3: Session Query Failing**
**Problem**: DynamoDB query throwing errors  
**Solution**: Verify table name, GSI, and IAM permissions

### **Issue 4: JWT Validation Issues**
**Problem**: JWT validation failing in bootstrap mode  
**Solution**: Ensure JWT validation works independently of session checks

### **Issue 5: Wrong Environment**
**Problem**: Testing against wrong environment  
**Solution**: Verify you're testing dev environment and correct API Gateway

### **Issue 6: Caching Issues**
**Problem**: Old authorizer code still running  
**Solution**: Clear authorizer cache or wait 5 minutes for TTL

---

## 🎯 **Next Steps**

1. **Check CloudWatch logs first** - This will show exactly what the authorizer is doing
2. **Add debug logging** - Temporarily add extensive logging to trace the flow
3. **Test Method ARN parsing** - Verify the bootstrap detection logic
4. **Verify DynamoDB access** - Ensure session queries work
5. **Test manually** - Use AWS CLI to invoke authorizer directly

### **When It's Working**

You'll see these logs:
```
🚀 Detected session bootstrap request
🎯 Attempting normal session creation (testing backend bootstrap fix)...
🎉 Normal session creation succeeded - backend bootstrap fix is working!
```

And frontend will successfully create sessions and proceed to the main app.

---

## 📞 **Support Information**

**Test User**: `0408a498-40c1-7071-acc9-90665ef117c3`  
**Environment**: `dev`  
**Expected Endpoint**: `POST /users/{userId}/sessions`  
**Frontend Origin**: `http://localhost:3000`

**Key Files to Check:**
- Lambda authorizer function code
- API Gateway authorizer configuration  
- DynamoDB table permissions
- CloudWatch logs for authorizer

The frontend is working correctly and will automatically work once the backend bootstrap fix is properly deployed and functional. 