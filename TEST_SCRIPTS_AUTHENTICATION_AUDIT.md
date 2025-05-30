# 🔐 Test Scripts Authentication Audit

**Critical authentication conflicts found in test scripts that MUST be resolved before authentication standardization implementation.**

## 🚨 **URGENT: 5 Major Conflicts Identified**

### **❌ CONFLICT 1: Dual Authentication Implementations**

**Problem**: Multiple files duplicate `getCognitoToken()` functionality with different patterns

**Conflicting Files**:
- ✅ **`scripts/get-cognito-token.js`** - **CORRECT** (follows cursor rules)
- ❌ **`scripts/get-jwt-token.js`** - **DUPLICATE** implementation with different interface
- ❌ **`scripts/test-live-bootstrap.js`** - **Direct AWS SDK** usage
- ❌ **`scripts/test-time-entries.js`** - **Direct Cognito API** calls
- ❌ **`scripts/test-invoices.js`** - **Direct Cognito API** calls  
- ❌ **`scripts/test-invoices-quick.js`** - **Direct Cognito API** calls

### **❌ CONFLICT 2: Token Type Inconsistency**

**MANDATORY Pattern**: Use `AccessToken` only
**Current Issues**:

| Script | Current Usage | MANDATORY Should Be |
|--------|---------------|-------------------|
| `test-live-bootstrap.js` | `IdToken` ❌ | `AccessToken` ✅ |
| `get-jwt-token.js` | Promotes `IdToken` export ❌ | `AccessToken` ✅ |
| `test-time-entries.js` | Mixed `idToken`/`accessToken` ❌ | `AccessToken` only ✅ |

### **❌ CONFLICT 3: Direct AWS SDK Usage**

**FORBIDDEN Pattern**: Direct AWS SDK imports in test scripts
**Violating Files**:
- `scripts/test-live-bootstrap.js` - `CognitoIdentityProviderClient`, `DynamoDBClient`
- Must use shared helpers only

### **❌ CONFLICT 4: Direct Database Access**

**FORBIDDEN Pattern**: Direct DynamoDB operations in test scripts
**Violating Files**:
- `scripts/test-live-bootstrap.js` - Direct DynamoDB session cleanup
- Must use repository patterns

### **❌ CONFLICT 5: Inconsistent API Base URLs**

**Current URLs Vary**:
- `get-cognito-token.js`: Not applicable (auth only)
- `test-live-bootstrap.js`: `https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev`
- `test-time-entries.js`: `https://time-api-dev.aerotage.com`
- `test-profile-endpoint.js`: `https://time-api-dev.aerotage.com`

**Should be standardized** to cursor rules environment variables

## 📊 **Compliance Analysis**

### **✅ COMPLIANT Scripts (8 scripts)**
- `scripts/test-profile-endpoint.js` - Uses `getCognitoToken()`, `AccessToken`
- `scripts/test-session-creation.js` - Uses `getCognitoToken()`, `AccessToken`
- `scripts/test-phase5-endpoints.js` - Uses `getCognitoToken()`, `AccessToken`
- `scripts/test-phase6-core.js` - Uses `getCognitoToken()`, `AccessToken`
- `scripts/test-phase6-endpoints.js` - Uses `getCognitoToken()`, `AccessToken`
- `scripts/test-invoices-endpoint.js` - Uses `getCognitoToken()`, `AccessToken`
- `scripts/debug-auth.js` - Uses `getCognitoToken()`, `AccessToken`

### **❌ NON-COMPLIANT Scripts (5 scripts)**
- `scripts/get-jwt-token.js` - **DUPLICATE + WRONG PATTERNS**
- `scripts/test-live-bootstrap.js` - **AWS SDK + IdToken + Direct DB**
- `scripts/test-time-entries.js` - **Direct Cognito + Mixed tokens**
- `scripts/test-invoices.js` - **Direct Cognito**
- `scripts/test-invoices-quick.js` - **Direct Cognito**

## 🎯 **MANDATORY Standardization Requirements**

### **Authentication Pattern (MANDATORY)**
```javascript
const { getCognitoToken } = require('./get-cognito-token');

async function testEndpoints() {
  const authResult = await getCognitoToken('bhardwick@aerotage.com', 'Aerotage*2025');
  const token = authResult.AccessToken; // USE AccessToken, NOT IdToken
  
  const response = await makeRequest(`${API_BASE_URL}/endpoint`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
}
```

### **FORBIDDEN Patterns**
```javascript
// ❌ FORBIDDEN: Direct AWS SDK
const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');

// ❌ FORBIDDEN: Direct Cognito API calls  
const authResponse = await makeRequest('https://cognito-idp.us-east-1.amazonaws.com/', {
  method: 'POST',
  headers: { 'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth' }
});

// ❌ FORBIDDEN: IdToken usage
const token = authResponse.body.AuthenticationResult.IdToken;

// ❌ FORBIDDEN: Direct DynamoDB access
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
```

## 🛠️ **Resolution Strategy**

### **Phase 1: Immediate Fixes (Critical)**
1. **Delete duplicate authentication file**: `scripts/get-jwt-token.js`
2. **Standardize non-compliant scripts** to use `getCognitoToken()` + `AccessToken`
3. **Remove direct AWS SDK** imports from test scripts
4. **Remove direct DynamoDB** operations from test scripts

### **Phase 2: Environment Standardization**  
1. **Standardize API base URLs** across all test scripts
2. **Add environment variable** support for different environments
3. **Consolidate common test utilities**

### **Phase 3: Verification**
1. **Test all scripts** with standardized authentication
2. **Verify no conflicts** with Lambda function authentication patterns
3. **Update documentation** to reflect standardized patterns

## ⚠️ **CRITICAL IMPACT**

**If these conflicts are NOT resolved before authentication standardization**:

1. **Test scripts will fail** during authentication standardization
2. **AI will receive conflicting patterns** leading to inconsistent implementation  
3. **Lambda functions may adopt wrong patterns** from conflicting test examples
4. **Authentication standardization will be delayed** due to conflicts

## 📋 **Next Steps Required**

1. **Run fix script** to resolve all authentication conflicts
2. **Test all scripts** after fixes to ensure they work
3. **Proceed with authentication standardization** once conflicts resolved

---

**TOTAL SCRIPTS**: 13 test scripts  
**COMPLIANT**: 8 scripts (61.5%)  
**NON-COMPLIANT**: 5 scripts (38.5%)  
**CRITICAL CONFLICTS**: 5 major conflicts identified  
**RESOLUTION REQUIRED**: Before authentication standardization begins 