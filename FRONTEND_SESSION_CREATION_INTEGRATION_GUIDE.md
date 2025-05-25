# Frontend Integration Guide: Session Creation Endpoint

## 🎯 Overview

The missing session creation endpoint has been **successfully implemented and deployed**! This completes Phase 2 of the Security Features, enabling automatic session tracking when users log in.

**What's New:**
- ✅ `POST /users/{userId}/sessions` - Create session records during login
- ✅ Sessions now appear in Security Settings → Active Sessions
- ✅ Real session data with IP addresses, locations, and timestamps
- ✅ Session management respects user security settings

## 📍 API Endpoint

### **POST /users/{userId}/sessions**

**URL:** `https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/users/{userId}/sessions`

**Purpose:** Create a new session record when a user successfully logs in

**Authentication:** Cognito JWT token required

---

## 📋 Request Format

### Headers
```http
POST /users/{userId}/sessions
Authorization: Bearer {cognito_jwt_token}
Content-Type: application/json
```

### Request Body
```typescript
{
  "userAgent": string,      // Required: Browser/client user agent
  "loginTime"?: string,     // Optional: ISO datetime, defaults to now
  "ipAddress"?: string      // Optional: Auto-detected from request if not provided
}
```

### Example Request
```typescript
const sessionData = {
  userAgent: navigator.userAgent,
  loginTime: new Date().toISOString()
};

const response = await fetch(`${API_BASE_URL}/users/${userId}/sessions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${cognitoJwtToken}`,
  },
  body: JSON.stringify(sessionData),
});
```

---

## 📤 Response Format

### Success Response (201 Created)
```typescript
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...",
    "loginTime": "2024-01-15T10:30:00.000Z",
    "lastActivity": "2024-01-15T10:30:00.000Z",
    "isCurrent": true,
    "location": {
      "city": "New York",
      "country": "United States"
    }
  }
}
```

### Error Responses

**400 Bad Request - Invalid Input**
```typescript
{
  "success": false,
  "error": {
    "code": "INVALID_PROFILE_DATA",
    "message": "userAgent is required and must be a string"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**403 Forbidden - Authorization Error**
```typescript
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED_PROFILE_ACCESS",
    "message": "You can only create sessions for yourself"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**500 Internal Server Error**
```typescript
{
  "success": false,
  "error": {
    "code": "INVALID_PROFILE_DATA",
    "message": "Failed to create session record"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 🛠 Integration Instructions

### 1. Update API Service

Add the session creation method to your API service:

```typescript
// services/profileApi.ts
export const profileApi = {
  // ... existing methods ...

  /**
   * Create a new session record for the user
   */
  async createSession(userId: string, sessionData?: {
    userAgent?: string;
    loginTime?: string;
    ipAddress?: string;
  }): Promise<UserSession> {
    const body = {
      userAgent: sessionData?.userAgent || navigator.userAgent,
      loginTime: sessionData?.loginTime || new Date().toISOString(),
      ...(sessionData?.ipAddress && { ipAddress: sessionData.ipAddress })
    };

    const response = await fetch(`${API_BASE_URL}/users/${userId}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getJwtToken()}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error?.message || 'Failed to create session');
    }
    
    return data.data;
  },

  // ... existing methods ...
};
```

### 2. Update Login Flow

Modify your login process to create sessions automatically:

```typescript
// components/auth/LoginForm.tsx or similar
const handleSuccessfulLogin = async (cognitoUser: any) => {
  try {
    // Extract user ID from Cognito user
    const userId = cognitoUser.userId || cognitoUser.username || cognitoUser.sub;
    
    if (userId) {
      console.log('🆕 Creating session record for user:', userId);
      
      // Create session record
      const sessionData = await profileApi.createSession(userId, {
        userAgent: navigator.userAgent,
        loginTime: new Date().toISOString()
      });
      
      console.log('✅ Session record created successfully:', sessionData);
      
      // Store session ID if needed for current session tracking
      localStorage.setItem('currentSessionId', sessionData.id);
    }
    
    // Continue with existing login flow...
    onLoginSuccess(cognitoUser);
    
  } catch (error) {
    console.error('❌ Failed to create session record:', error);
    // Don't block login flow if session creation fails
    onLoginSuccess(cognitoUser);
  }
};
```

### 3. TypeScript Types

Add these types to your frontend project:

```typescript
// types/api.ts
export interface CreateSessionRequest {
  userAgent: string;
  loginTime?: string;
  ipAddress?: string;
}

export interface UserSession {
  id: string;
  ipAddress: string;
  userAgent: string;
  loginTime: string;
  lastActivity: string;
  isCurrent: boolean;
  location?: {
    city: string;
    country: string;
  };
}

export interface CreateSessionResponse {
  success: true;
  data: UserSession;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
  timestamp: string;
}
```

---

## 🔒 Security Features

### Automatic Security Enforcement

The endpoint automatically handles user security settings:

1. **Multiple Sessions Control**
   - If user has `allowMultipleSessions: false`, existing sessions are terminated
   - If `allowMultipleSessions: true`, multiple sessions coexist

2. **Session Timeout**
   - Session expiry is calculated based on user's `sessionTimeout` setting
   - Default: 8 hours (480 minutes)

3. **Authorization**
   - Users can only create sessions for themselves
   - JWT token must be valid and not expired

### Input Validation

- **userAgent**: Required, max 1000 characters
- **loginTime**: Must be ISO datetime, within last 5 minutes
- **ipAddress**: Optional, validates IPv4/IPv6 format if provided

---

## 🧪 Testing Guide

### 1. Test Session Creation
```typescript
// Test basic session creation
const testSessionCreation = async () => {
  try {
    const userId = 'your-test-user-id';
    const session = await profileApi.createSession(userId);
    console.log('Session created:', session);
    console.assert(session.id, 'Session should have an ID');
    console.assert(session.isCurrent === true, 'New session should be current');
  } catch (error) {
    console.error('Session creation failed:', error);
  }
};
```

### 2. Verify Session Appears in Security Settings
```typescript
// After creating a session, check if it appears in the sessions list
const testSessionsList = async () => {
  const userId = 'your-test-user-id';
  
  // Create a session
  await profileApi.createSession(userId);
  
  // Fetch sessions list
  const sessions = await profileApi.getUserSessions(userId);
  
  console.assert(sessions.length > 0, 'Sessions list should not be empty');
  console.assert(sessions.some(s => s.isCurrent), 'Should have at least one current session');
};
```

### 3. Test Error Handling
```typescript
// Test invalid input
const testErrorHandling = async () => {
  try {
    await fetch(`${API_BASE_URL}/users/test-user/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token',
      },
      body: JSON.stringify({ /* missing userAgent */ }),
    });
  } catch (error) {
    console.log('Expected error caught:', error);
  }
};
```

---

## 🐛 Troubleshooting

### Common Issues

**1. "Unauthorized" Error**
```typescript
// Check if JWT token is valid and not expired
const token = getJwtToken();
if (!token || isTokenExpired(token)) {
  // Refresh token or re-authenticate
}
```

**2. "userAgent is required" Error**
```typescript
// Ensure userAgent is provided
const sessionData = {
  userAgent: navigator.userAgent || 'Unknown Client',
  loginTime: new Date().toISOString()
};
```

**3. "Login time must be within the last 5 minutes" Error**
```typescript
// Use current time instead of stale timestamp
const sessionData = {
  userAgent: navigator.userAgent,
  loginTime: new Date().toISOString() // Use current time
};
```

### Debug Logging

Enable debug logging to troubleshoot issues:

```typescript
const DEBUG_SESSIONS = true;

const createSessionWithLogging = async (userId: string) => {
  if (DEBUG_SESSIONS) {
    console.group('🔧 Session Creation Debug');
    console.log('User ID:', userId);
    console.log('User Agent:', navigator.userAgent);
    console.log('JWT Token:', getJwtToken()?.substring(0, 50) + '...');
  }
  
  try {
    const session = await profileApi.createSession(userId);
    if (DEBUG_SESSIONS) {
      console.log('✅ Session created successfully:', session);
    }
    return session;
  } catch (error) {
    if (DEBUG_SESSIONS) {
      console.error('❌ Session creation failed:', error);
    }
    throw error;
  } finally {
    if (DEBUG_SESSIONS) {
      console.groupEnd();
    }
  }
};
```

---

## 🔄 Integration Workflow

### Complete Login Flow with Session Creation

```typescript
// Complete example of login flow with session creation
const handleLogin = async (email: string, password: string) => {
  try {
    // 1. Authenticate with Cognito
    console.log('🔐 Authenticating user...');
    const authResult = await Auth.signIn(email, password);
    
    // 2. Get JWT token
    const session = await Auth.currentSession();
    const jwtToken = session.getIdToken().getJwtToken();
    
    // 3. Get user details
    const cognitoUser = await Auth.currentAuthenticatedUser();
    const userId = cognitoUser.username;
    
    // 4. Create session record
    console.log('🆕 Creating session record...');
    const sessionData = await profileApi.createSession(userId, {
      userAgent: navigator.userAgent,
      loginTime: new Date().toISOString()
    });
    
    // 5. Store session info
    localStorage.setItem('currentSessionId', sessionData.id);
    localStorage.setItem('loginTime', sessionData.loginTime);
    
    // 6. Update UI state
    setIsAuthenticated(true);
    setCurrentUser(cognitoUser);
    
    console.log('✅ Login completed successfully');
    
  } catch (error) {
    console.error('❌ Login failed:', error);
    throw error;
  }
};
```

---

## 📊 Expected Results

After implementing this endpoint, you should see:

### ✅ **Before vs After**

**BEFORE (Without Session Creation):**
- Login successful, but no session records created
- Security Settings → Active Sessions shows "No sessions found"
- Session management features non-functional

**AFTER (With Session Creation):**
- Login creates session records automatically
- Security Settings → Active Sessions shows real session data
- Users can view session details (IP, location, time)
- Users can terminate other sessions (but not current one)
- Multiple sessions work according to user security settings

### 📱 **Frontend UI Changes**

**Security Settings Page:**
```typescript
// Sessions will now display real data instead of empty state
const SessionsList = () => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  
  useEffect(() => {
    // This will now return actual session data!
    profileApi.getUserSessions(userId).then(setSessions);
  }, [userId]);
  
  if (sessions.length === 0) {
    return <div>No active sessions</div>; // This should rarely show now
  }
  
  return (
    <div>
      {sessions.map(session => (
        <SessionCard 
          key={session.id}
          session={session}
          isCurrent={session.isCurrent}
          onTerminate={() => profileApi.terminateSession(userId, session.id)}
        />
      ))}
    </div>
  );
};
```

---

## 🎉 Success Criteria

Your integration is successful when:

- ✅ Sessions are created automatically during login
- ✅ Security Settings page shows real session data
- ✅ Current session is properly identified (`isCurrent: true`)
- ✅ Location data appears (when available)
- ✅ Session termination works for other sessions
- ✅ Console shows successful session creation logs
- ✅ No more "No sessions found" messages in Security Settings

---

## 🔗 Related Documentation

- **Phase 2 Implementation Summary**: `PHASE_2_IMPLEMENTATION_SUMMARY.md`
- **Original Requirements**: `PHASE_2_SESSION_CREATION_BACKEND_REQUIREMENTS.md`
- **Phase 1 Integration Guide**: `FRONTEND_INTEGRATION_GUIDE_PHASE_1.md`

---

## 🆘 Support

**API Endpoint**: `https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/`

**Questions or Issues?**
- Check CloudWatch logs for Lambda function errors
- Verify JWT token is valid and not expired
- Ensure user ID matches the authenticated user
- Test with curl to isolate frontend vs backend issues

**Status**: ✅ **Ready for Production Use** 