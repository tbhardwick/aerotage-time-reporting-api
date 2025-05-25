# Backend Issue: Missing Profile Creation Functionality for New Users

## 🚨 **Critical Issue Summary**

The Phase 1 User Profile Settings API is returning **404 errors** for new users, preventing profile creation and breaking the onboarding flow. The frontend integration is working correctly, but the backend is missing essential profile creation functionality.

---

## 📊 **Issue Details**

### **Current Behavior** ❌
- **GET** `/users/{userId}/profile` → Returns **404 "PROFILE_NOT_FOUND"** for new users
- **PUT** `/users/{userId}/profile` → Returns **404 "PROFILE_NOT_FOUND"** when trying to create profiles

### **Expected Behavior** ✅  
- **GET** `/users/{userId}/profile` → Should return **default profile data** for new users
- **PUT** `/users/{userId}/profile` → Should **create new profiles** if they don't exist

---

## 🔍 **Evidence from Frontend Logs**

### **Authentication Working Correctly**
```
✅ Setting user in context: {id: '0408a498-40c1-7071-acc9-90665ef117c3', email: 'bhardwick@aerotage.com', ...}
✅ Token retrieved successfully, length: 1181
```

### **API Calls Working Correctly**
```
🔗 Making request to: https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/users/0408a498-40c1-7071-acc9-90665ef117c3/profile
📡 Response status: 404
❌ Failed to fetch user profile: {code: 'PROFILE_NOT_FOUND', message: 'User profile not found'}
```

### **Profile Creation Attempt Failing**
```
PUT https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/users/0408a498-40c1-7071-acc9-90665ef117c3/profile 404 (Not Found)
❌ Failed to update user profile: {code: 'PROFILE_NOT_FOUND', message: 'User profile not found'}
```

---

## 🛠️ **Required Backend Fixes**

### **1. Fix GET /users/{userId}/profile**

**Current**: Returns 404 for new users  
**Required**: Return default profile data for authenticated users

```javascript
// Expected GET Response for New Users
{
  "success": true,
  "data": {
    "id": "0408a498-40c1-7071-acc9-90665ef117c3",
    "email": "bhardwick@aerotage.com", // From JWT token
    "name": "bhardwick", // Default from email or JWT
    "role": "employee", // Default role
    "hourlyRate": null,
    "jobTitle": null,
    "department": null,
    "contactInfo": {},
    "profilePicture": null,
    "startDate": "2024-05-25T00:00:00Z", // Current date
    "lastLogin": "2024-05-25T09:53:00Z", // Current timestamp  
    "isActive": true,
    "teamId": null,
    "createdAt": "2024-05-25T09:53:00Z", // Current timestamp
    "updatedAt": "2024-05-25T09:53:00Z"
  }
}
```

### **2. Fix PUT /users/{userId}/profile**

**Current**: Returns 404 when profile doesn't exist  
**Required**: Create new profile if it doesn't exist (upsert behavior)

```javascript
// Should Accept This Request Body
{
  "name": "Thomas Hardwick",
  "jobTitle": "President", 
  "department": "Engineering",
  "contactInfo": {
    "phone": "+1-555-0123",
    "address": "123 Main St",
    "emergencyContact": "Jane Doe - Spouse - +1-555-0124"
  }
}

// Should Return Created Profile
{
  "success": true,
  "data": {
    "id": "0408a498-40c1-7071-acc9-90665ef117c3",
    "email": "bhardwick@aerotage.com",
    "name": "Thomas Hardwick", // Updated
    "jobTitle": "President", // Updated  
    "department": "Engineering", // Updated
    "hourlyRate": null,
    "role": "employee",
    "contactInfo": {
      "phone": "+1-555-0123", // Updated
      "address": "123 Main St", // Updated
      "emergencyContact": "Jane Doe - Spouse - +1-555-0124" // Updated
    },
    "profilePicture": null,
    "startDate": "2024-05-25T00:00:00Z",
    "lastLogin": "2024-05-25T09:53:00Z",
    "isActive": true,
    "teamId": null,
    "createdAt": "2024-05-25T09:53:00Z", // When first created
    "updatedAt": "2024-05-25T09:54:15Z" // When last updated
  }
}
```

---

## 📋 **Implementation Requirements**

### **Database Schema Updates**
Ensure the `users` table can handle:
- **Auto-creation** of profiles for authenticated Cognito users
- **Upsert operations** (create if not exists, update if exists)
- **Default values** for required fields

### **Lambda Function Updates**

#### **GET /users/{userId}/profile Lambda**
```javascript
// Pseudo-code for required logic
async function getUserProfile(userId) {
  // 1. Check if profile exists in database
  let profile = await db.getProfile(userId);
  
  if (!profile) {
    // 2. If not exists, create default profile from JWT token
    const jwtPayload = extractJwtPayload(event.headers.Authorization);
    profile = await db.createDefaultProfile({
      id: userId,
      email: jwtPayload.email || jwtPayload.username,
      name: jwtPayload.name || jwtPayload.username.split('@')[0],
      role: 'employee', // Default role
      isActive: true,
      startDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: profile
    })
  };
}
```

#### **PUT /users/{userId}/profile Lambda**
```javascript
// Pseudo-code for required logic  
async function updateUserProfile(userId, updates) {
  // 1. Try to update existing profile
  let profile = await db.updateProfile(userId, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
  
  if (!profile) {
    // 2. If profile doesn't exist, create it with updates
    const jwtPayload = extractJwtPayload(event.headers.Authorization);
    profile = await db.createProfile({
      id: userId,
      email: jwtPayload.email || jwtPayload.username,
      role: 'employee', // Default role
      isActive: true,
      startDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...updates // Apply the updates
    });
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: profile
    })
  };
}
```

---

## 🧪 **Testing Requirements**

### **Test Cases to Verify**

1. **New User Profile Creation**
   - GET `/users/{new-user-id}/profile` → Returns default profile (200)
   - PUT `/users/{new-user-id}/profile` → Creates profile (200)

2. **Existing User Profile Updates**  
   - GET `/users/{existing-user-id}/profile` → Returns existing profile (200)
   - PUT `/users/{existing-user-id}/profile` → Updates existing profile (200)

3. **Authentication Validation**
   - All requests without valid JWT → 401 Unauthorized
   - Requests for other users (non-admin) → 403 Forbidden

### **Test User Data**
```
User ID: 0408a498-40c1-7071-acc9-90665ef117c3
Email: bhardwick@aerotage.com
JWT Token: Valid Cognito token (1181 characters)
```

---

## 📈 **Priority & Impact**

### **Priority: HIGH** 🔴
This is blocking the entire user onboarding flow and preventing users from accessing core functionality.

### **Impact**
- **Users cannot create profiles** → Cannot save personal information
- **Users cannot set preferences** → Cannot customize app experience  
- **Frontend integration blocked** → Phase 1 deployment is non-functional
- **User experience broken** → New users see error screens instead of onboarding

---

## ✅ **Success Criteria**

After the fix, the following should work:

1. **New User Flow**:
   - User logs in → GET profile returns defaults → User edits → PUT creates profile ✅

2. **Existing User Flow**:  
   - User logs in → GET profile returns saved data → User edits → PUT updates profile ✅

3. **Frontend Integration**:
   - No more 404 errors ✅
   - Profile creation form works ✅  
   - Preferences setup works ✅
   - Data persists across sessions ✅

---

## 📞 **Next Steps**

### **For Backend Team**
1. **Immediate**: Fix the GET endpoint to return defaults for new users
2. **Immediate**: Fix the PUT endpoint to create profiles (upsert behavior)
3. **Testing**: Verify with the provided test user ID
4. **Deployment**: Deploy fixes to development environment

### **For Frontend Team**  
1. **Ready**: Frontend integration is complete and working
2. **Waiting**: For backend fixes to be deployed
3. **Testing**: Will verify integration once backend is fixed

---

## 📋 **Integration Verification**

Once backend fixes are deployed, you can verify with:

```bash
# Test GET for new user (should return defaults, not 404)
curl -X GET \
  "https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/users/0408a498-40c1-7071-acc9-90665ef117c3/profile" \
  -H "Authorization: Bearer {JWT_TOKEN}"

# Test PUT for profile creation (should create, not 404)  
curl -X PUT \
  "https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/users/0408a498-40c1-7071-acc9-90665ef117c3/profile" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "jobTitle": "Developer"}'
```

The frontend is ready and will work immediately once these backend issues are resolved! 🚀 