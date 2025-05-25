# Backend Authorization Issues - User Profile Endpoints

## 🚨 **Critical Issue Summary**

The frontend is successfully authenticating users and sending correct JWT tokens, but the backend is rejecting API calls to user profile endpoints with 403 Forbidden errors. The authorization logic appears to be incorrectly validating user access to their own data.

## 📋 **Affected Endpoints**

### **1. User Preferences Endpoint**
- **URL**: `GET /users/{userId}/preferences`
- **Error**: "You can only access your own preferences"
- **Status Code**: 403 Forbidden

### **2. User Security Settings Endpoint**
- **URL**: `GET /users/{userId}/security-settings`
- **Error**: "You can only access your own security settings"
- **Status Code**: 403 Forbidden

### **3. User Sessions Endpoint**
- **URL**: `GET /users/{userId}/sessions`
- **Error**: "You can only view your own sessions"
- **Status Code**: 403 Forbidden

## 🔍 **Technical Analysis**

### **Frontend Implementation (Working Correctly)**

The frontend is correctly:

1. **Extracting User ID from JWT Token**:
   ```typescript
   // Frontend extracts user ID from JWT 'sub' claim
   const session = await fetchAuthSession();
   const idToken = session.tokens?.idToken;
   const tokenPayload = decodeJWTPayload(idToken.toString());
   const userId = tokenPayload.sub; // This is the correct user ID
   ```

2. **Sending Correct Authorization Headers**:
   ```
   Authorization: Bearer {JWT_TOKEN}
   Content-Type: application/json
   ```

3. **Using Correct User ID in URL Path**:
   ```
   GET /users/0408a498-40c1-7071-acc9-90665ef117c3/preferences
   ```

### **JWT Token Analysis**

The JWT token contains the following relevant claims:
```json
{
  "sub": "0408a498-40c1-7071-acc9-90665ef117c3",
  "email": "bhardwick@aerotage.com",
  "iat": 1234567890,
  "exp": 1234567890,
  "aud": "...",
  "iss": "..."
}
```

**Key Point**: The `sub` claim contains the user ID that should match the `{userId}` in the URL path.

## 🐛 **Root Cause Analysis**

The backend authorization logic is failing because:

### **Hypothesis 1: User ID Extraction Mismatch**
- **Issue**: Backend might be extracting user ID from a different JWT claim
- **Check**: Verify backend extracts user ID from `sub` claim, not `username`, `email`, or other fields
- **Expected**: `tokenPayload.sub === urlPathUserId`

### **Hypothesis 2: User Record Not Found**
- **Issue**: User might not exist in the backend database
- **Check**: Verify user record exists with ID `0408a498-40c1-7071-acc9-90665ef117c3`
- **Expected**: User should be found in users table/collection

### **Hypothesis 3: Authorization Logic Error**
- **Issue**: Authorization middleware might have incorrect comparison logic
- **Check**: Review authorization code for string comparison, case sensitivity, or type mismatches
- **Expected**: Proper string comparison between JWT user ID and URL user ID

### **Hypothesis 4: Missing User Permissions**
- **Issue**: User might not have required permissions for profile access
- **Check**: Verify user has necessary permissions/roles for self-access
- **Expected**: Users should always be able to access their own profile data

## 🔧 **Backend Investigation Steps**

### **Step 1: Verify JWT Token Processing**
```typescript
// Backend should extract user ID like this:
const token = request.headers.authorization?.replace('Bearer ', '');
const decodedToken = jwt.verify(token, secret);
const authenticatedUserId = decodedToken.sub; // Use 'sub' claim
```

### **Step 2: Check Authorization Logic**
```typescript
// Backend authorization should look like this:
const urlUserId = request.params.userId;
const authenticatedUserId = getAuthenticatedUserId(request);

if (authenticatedUserId !== urlUserId) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED_PROFILE_ACCESS',
      message: 'You can only access your own preferences'
    }
  });
}
```

### **Step 3: Database User Lookup**
```sql
-- Verify user exists in database
SELECT id, email, is_active, created_at 
FROM users 
WHERE id = '0408a498-40c1-7071-acc9-90665ef117c3';
```

### **Step 4: Check User Permissions**
```sql
-- Verify user has basic permissions
SELECT u.id, u.email, up.permission_name
FROM users u
LEFT JOIN user_permissions up ON u.id = up.user_id
WHERE u.id = '0408a498-40c1-7071-acc9-90665ef117c3';
```

## 📊 **Request/Response Analysis**

### **Successful Request Pattern**
```http
GET /users/0408a498-40c1-7071-acc9-90665ef117c3/preferences
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### **Current Error Response**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED_PROFILE_ACCESS",
    "message": "You can only access your own preferences"
  },
  "timestamp": "2025-05-25T20:45:06.814Z"
}
```

### **Expected Success Response**
```json
{
  "success": true,
  "data": {
    "theme": "light",
    "notifications": true,
    "timezone": "UTC",
    "language": "en"
  }
}
```

## 🛠️ **Recommended Fixes**

### **Fix 1: Verify JWT User ID Extraction**
```typescript
// Ensure backend extracts user ID from correct JWT claim
const getUserIdFromToken = (token: string): string => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded.sub; // Use 'sub' claim, not 'id' or 'username'
};
```

### **Fix 2: Add Debug Logging**
```typescript
// Add logging to authorization middleware
const authorizeUserAccess = (req, res, next) => {
  const urlUserId = req.params.userId;
  const tokenUserId = getUserIdFromToken(req.headers.authorization);
  
  console.log('Authorization Debug:', {
    urlUserId,
    tokenUserId,
    match: urlUserId === tokenUserId,
    urlType: typeof urlUserId,
    tokenType: typeof tokenUserId
  });
  
  if (tokenUserId !== urlUserId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED_PROFILE_ACCESS',
        message: `You can only access your own data. Token: ${tokenUserId}, URL: ${urlUserId}`
      }
    });
  }
  
  next();
};
```

### **Fix 3: Ensure User Record Exists**
```typescript
// Check if user exists before authorization
const checkUserExists = async (userId: string) => {
  const user = await db.users.findById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  return user;
};
```

### **Fix 4: Handle Missing Preferences Gracefully**
```typescript
// Return default preferences if none exist
const getUserPreferences = async (userId: string) => {
  let preferences = await db.userPreferences.findByUserId(userId);
  
  if (!preferences) {
    // Create default preferences for new users
    preferences = await db.userPreferences.create({
      userId,
      theme: 'light',
      notifications: true,
      timezone: 'UTC',
      language: 'en'
    });
  }
  
  return preferences;
};
```

## 🧪 **Testing Recommendations**

### **Test Case 1: Valid User Access**
```bash
# Should return 200 OK
curl -X GET \
  "https://api.example.com/users/0408a498-40c1-7071-acc9-90665ef117c3/preferences" \
  -H "Authorization: Bearer {VALID_JWT_TOKEN}"
```

### **Test Case 2: Invalid User Access**
```bash
# Should return 403 Forbidden
curl -X GET \
  "https://api.example.com/users/different-user-id/preferences" \
  -H "Authorization: Bearer {VALID_JWT_TOKEN}"
```

### **Test Case 3: Missing Authorization**
```bash
# Should return 401 Unauthorized
curl -X GET \
  "https://api.example.com/users/0408a498-40c1-7071-acc9-90665ef117c3/preferences"
```

## 📝 **User Information**

### **Test User Details**
- **User ID**: `0408a498-40c1-7071-acc9-90665ef117c3`
- **Email**: `bhardwick@aerotage.com`
- **JWT Sub Claim**: `0408a498-40c1-7071-acc9-90665ef117c3`
- **Expected Role**: Employee/User (should have self-access permissions)

## 🚀 **Priority Actions**

1. **HIGH**: Add debug logging to authorization middleware
2. **HIGH**: Verify JWT user ID extraction uses `sub` claim
3. **HIGH**: Check if user record exists in database
4. **MEDIUM**: Review authorization logic for string comparison issues
5. **MEDIUM**: Ensure default preferences are created for new users
6. **LOW**: Add comprehensive error messages for debugging

## 📞 **Contact Information**

If you need additional information or have questions about the frontend implementation, please refer to:

- **Frontend Repository**: `aerotage_time_reporting_app`
- **JWT Utility Functions**: `src/renderer/utils/jwt.ts` (deleted, but logic is in ProtectedRoute.tsx)
- **API Client**: `src/renderer/services/profileApi.ts`
- **Error Handling**: `src/renderer/services/authErrorHandler.ts`

## ✅ **Success Criteria**

The issue will be resolved when:

1. ✅ User can access their own preferences without 403 errors
2. ✅ User can access their own security settings without 403 errors  
3. ✅ User can view their own sessions without 403 errors
4. ✅ Authorization properly distinguishes between self-access and cross-user access
5. ✅ Default preferences are created for users who don't have them yet

---

**Note**: The frontend authorization fixes are complete and working correctly. This is purely a backend authorization/permissions issue that needs to be resolved in the `aerotage-time-reporting-api` repository. 