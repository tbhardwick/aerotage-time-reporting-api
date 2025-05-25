# Phase 2 Session Creation - Backend Requirements

## 📋 Overview

The Phase 2 Security Features frontend has been successfully implemented and integrated. However, **one critical backend endpoint is missing** for complete functionality: **session creation during user login**.

Currently implemented:
- ✅ `GET /users/{userId}/sessions` - List user sessions
- ✅ `DELETE /users/{userId}/sessions/{sessionId}` - Terminate session
- ✅ `GET /users/{userId}/security-settings` - Get security settings
- ✅ `PUT /users/{userId}/security-settings` - Update security settings
- ✅ `PUT /users/{userId}/password` - Change password

**Missing:**
- ❌ `POST /users/{userId}/sessions` - Create new session record

## 🎯 Required Implementation

### **1. Session Creation Endpoint**

**Endpoint:** `POST /users/{userId}/sessions`

**Purpose:** Automatically create session records when users successfully authenticate

**Request Format:**
```typescript
POST /users/{userId}/sessions
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...",
  "ipAddress": "192.168.1.100", // Optional - detected by backend if not provided
  "loginTime": "2024-01-15T10:30:00Z"
}
```

**Response Format:**
```typescript
{
  "success": true,
  "data": {
    "id": "session-abc123def456",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...",
    "loginTime": "2024-01-15T10:30:00Z",
    "lastActivity": "2024-01-15T10:30:00Z",
    "isCurrent": true,
    "location": {
      "city": "New York",
      "country": "United States"
    }
  }
}
```

## 🔧 Implementation Details

### **Database Integration**

Use the existing `UserSessionsTable` from Phase 2:

```typescript
// DynamoDB Item Structure
{
  PK: "USER#0408a498-40c1-7071-acc9-90665ef117c3",
  SK: "SESSION#session-abc123def456",
  id: "session-abc123def456",
  userId: "0408a498-40c1-7071-acc9-90665ef117c3",
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  loginTime: "2024-01-15T10:30:00Z",
  lastActivity: "2024-01-15T10:30:00Z",
  location: {
    city: "New York",
    country: "United States"
  },
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T10:30:00Z"
}
```

### **Session ID Generation**

Generate unique session IDs using one of these approaches:

```typescript
// Option 1: UUID v4
const sessionId = uuidv4(); // e.g., "550e8400-e29b-41d4-a716-446655440000"

// Option 2: Prefixed timestamp + random
const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Option 3: Crypto random
const sessionId = `session-${crypto.randomBytes(16).toString('hex')}`;
```

### **IP Address Detection**

Extract real client IP address from request headers:

```typescript
const getClientIP = (event: APIGatewayProxyEvent): string => {
  // Check various headers in order of preference
  const xForwardedFor = event.headers['x-forwarded-for'];
  const xRealIP = event.headers['x-real-ip'];
  const cfConnectingIP = event.headers['cf-connecting-ip']; // Cloudflare
  const sourceIP = event.requestContext.identity.sourceIp;
  
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first (original client)
    return xForwardedFor.split(',')[0].trim();
  }
  
  return xRealIP || cfConnectingIP || sourceIP || 'unknown';
};
```

### **Geolocation (Optional Enhancement)**

Add location detection using IP geolocation:

```typescript
// Option 1: AWS Location Service
// Option 2: GeoIP database
// Option 3: Third-party API (ip-api.com, ipinfo.io)

const getLocationFromIP = async (ipAddress: string) => {
  try {
    // Example using ip-api.com (free tier)
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        city: data.city,
        country: data.country
      };
    }
  } catch (error) {
    console.log('Failed to get location for IP:', ipAddress);
  }
  
  return null; // Location is optional
};
```

## 🔒 Security Requirements

### **1. Authentication & Authorization**
- ✅ Require valid JWT token
- ✅ User can only create sessions for themselves
- ✅ Admin users can create sessions for other users (if needed)

### **2. Session Limits & Validation**
```typescript
// Check if multiple sessions are allowed
const userSecuritySettings = await getUserSecuritySettings(userId);

if (!userSecuritySettings.allowMultipleSessions) {
  // Terminate existing sessions before creating new one
  await terminateUserSessions(userId);
}

// Optional: Implement session limits (e.g., max 10 sessions per user)
const existingSessions = await getUserSessions(userId);
if (existingSessions.length >= MAX_SESSIONS_PER_USER) {
  // Terminate oldest session
  await terminateOldestSession(userId);
}
```

### **3. Input Validation**
```typescript
const validateSessionCreationRequest = (body: any) => {
  const schema = {
    userAgent: { type: 'string', required: true, maxLength: 1000 },
    ipAddress: { type: 'string', required: false, pattern: IP_ADDRESS_REGEX },
    loginTime: { type: 'string', required: true, format: 'iso-datetime' }
  };
  
  // Validate against schema
  // Sanitize userAgent string
  // Validate IP address format
  // Ensure loginTime is recent (within last 5 minutes)
};
```

## 🚀 Lambda Function Implementation

### **File Structure**
```
src/lambda/user-sessions/
├── create-session.ts          # POST /users/{userId}/sessions
├── list-sessions.ts           # GET /users/{userId}/sessions (existing)
├── terminate-session.ts       # DELETE /users/{userId}/sessions/{sessionId} (existing)
└── utils/
    ├── session-utils.ts       # Session management utilities
    └── geolocation.ts         # IP geolocation utilities
```

### **Example Lambda Function**
```typescript
// src/lambda/user-sessions/create-session.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { userId } = event.pathParameters!;
    const requestBody = JSON.parse(event.body || '{}');
    
    // Validate JWT and check authorization
    const decodedToken = await validateJwtToken(event.headers.Authorization);
    if (decodedToken.sub !== userId && !isAdmin(decodedToken)) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED_SESSION_ACCESS',
            message: 'You can only create sessions for yourself'
          }
        })
      };
    }
    
    // Extract session data
    const sessionId = uuidv4();
    const ipAddress = getClientIP(event);
    const userAgent = requestBody.userAgent;
    const loginTime = requestBody.loginTime || new Date().toISOString();
    const location = await getLocationFromIP(ipAddress);
    
    // Create session record
    const sessionData = {
      PK: `USER#${userId}`,
      SK: `SESSION#${sessionId}`,
      id: sessionId,
      userId,
      ipAddress,
      userAgent,
      loginTime,
      lastActivity: loginTime,
      location,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await dynamodb.send(new PutCommand({
      TableName: process.env.USER_SESSIONS_TABLE!,
      Item: sessionData
    }));
    
    // Return session data (without internal DynamoDB keys)
    const response = {
      id: sessionData.id,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      loginTime: sessionData.loginTime,
      lastActivity: sessionData.lastActivity,
      isCurrent: true, // New sessions are always current
      location: sessionData.location
    };
    
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: response
      })
    };
    
  } catch (error) {
    console.error('Error creating session:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'SESSION_CREATION_FAILED',
          message: 'Failed to create session record'
        }
      })
    };
  }
};
```

## 🛠️ API Gateway Integration

### **Add Route to Existing API**
```typescript
// Add to existing API Gateway stack
const sessionsResource = api.root
  .resourceForPath('/users/{userId}/sessions');

// POST /users/{userId}/sessions
sessionsResource.addMethod('POST', new LambdaIntegration(createSessionLambda), {
  authorizer: cognitoAuthorizer,
  requestValidator: requestValidator,
  methodResponses: [
    {
      statusCode: '201',
      responseModels: {
        'application/json': sessionResponseModel
      }
    },
    {
      statusCode: '400',
      responseModels: {
        'application/json': errorResponseModel
      }
    }
  ]
});
```

## 📊 Testing Requirements

### **Unit Tests**
```typescript
describe('Create Session Lambda', () => {
  it('should create session with valid request', async () => {
    const event = mockAPIGatewayEvent({
      pathParameters: { userId: 'test-user-id' },
      body: JSON.stringify({
        userAgent: 'Mozilla/5.0...',
        loginTime: '2024-01-15T10:30:00Z'
      }),
      headers: { Authorization: 'Bearer valid-jwt-token' }
    });
    
    const result = await handler(event, mockContext, mockCallback);
    
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.id).toBeDefined();
  });
  
  it('should reject unauthorized requests', async () => {
    // Test without valid JWT
    // Test user trying to create session for different user
  });
  
  it('should handle session limits correctly', async () => {
    // Test multiple session restrictions
    // Test session limit enforcement
  });
});
```

### **Integration Tests**
```bash
# Test session creation
curl -X POST \
  https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/users/test-user-id/sessions \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "loginTime": "2024-01-15T10:30:00Z"
  }'

# Verify session appears in GET request
curl -X GET \
  https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/users/test-user-id/sessions \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

## 🔄 Frontend Integration Points

### **Automatic Session Creation**
The frontend is already configured to call this endpoint during login:

```typescript
// src/renderer/components/auth/LoginForm.tsx (line ~135)
const cognitoUser = await getCurrentUser();
const userId = cognitoUser.userId || cognitoUser.username;

if (userId) {
  console.log('🆕 Creating session record for user:', userId);
  await profileApi.createSession(userId); // This calls the POST endpoint
  console.log('✅ Session record created successfully');
}
```

### **Expected Frontend Behavior After Implementation**
1. **User logs in** → Frontend calls `POST /users/{userId}/sessions`
2. **Session created** → Backend returns session data
3. **User views Security Settings** → Sessions appear in Active Sessions list
4. **User can terminate sessions** → Uses existing `DELETE` endpoint

## ⚠️ Error Handling

### **Expected Error Scenarios**
```typescript
// 400 Bad Request - Invalid input
{
  "success": false,
  "error": {
    "code": "INVALID_SESSION_DATA",
    "message": "Invalid userAgent or loginTime format"
  }
}

// 403 Forbidden - Unauthorized
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED_SESSION_ACCESS", 
    "message": "You can only create sessions for yourself"
  }
}

// 409 Conflict - Session limit exceeded
{
  "success": false,
  "error": {
    "code": "SESSION_LIMIT_EXCEEDED",
    "message": "Maximum number of sessions reached. Please terminate some sessions."
  }
}

// 500 Internal Server Error
{
  "success": false,
  "error": {
    "code": "SESSION_CREATION_FAILED",
    "message": "Failed to create session record"
  }
}
```

## 📅 Implementation Timeline

### **Priority: High**
This is the only missing piece for complete Phase 2 functionality.

### **Estimated Effort**
- **Implementation**: 4-6 hours
- **Testing**: 2-3 hours  
- **Deployment**: 1 hour
- **Total**: 1 development day

### **Dependencies**
- ✅ Phase 2 infrastructure (already deployed)
- ✅ User Sessions table (already exists)
- ✅ JWT authentication (already working)
- ✅ Frontend integration (already implemented)

## 🚀 Deployment Instructions

### **1. Implement Lambda Function**
```bash
# Add the create-session.ts Lambda function
# Update API Gateway routes
# Deploy to dev environment
```

### **2. Test Implementation**
```bash
# Run unit tests
npm test src/lambda/user-sessions/create-session.test.ts

# Test integration
npm run test:integration -- sessions
```

### **3. Deploy to Development**
```bash
# Deploy updated stack
cdk deploy AerotageUserProfileApi-dev

# Verify endpoint is available
curl -X OPTIONS https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/users/test/sessions
```

### **4. Frontend Testing**
```bash
# Frontend should now show sessions after login
# Test complete login → session creation → session display flow
```

## ✅ Acceptance Criteria

### **Backend Requirements**
- [ ] `POST /users/{userId}/sessions` endpoint implemented
- [ ] Session creation returns proper response format
- [ ] JWT authentication enforced
- [ ] IP address detection working
- [ ] Session limits respected (if configured)
- [ ] Error handling for all scenarios
- [ ] Unit tests passing
- [ ] Integration tests passing

### **Frontend Integration**
- [ ] Sessions appear after login (no longer empty)
- [ ] Session creation logs appear in browser console
- [ ] Real sessions can be terminated via API
- [ ] Session refresh button shows real data
- [ ] No more "No sessions found" warnings

### **End-to-End Flow**
- [ ] User logs in → Session created automatically
- [ ] User views Security Settings → Current session appears
- [ ] User can terminate other sessions
- [ ] User logs out → Session can be terminated
- [ ] Multiple logins create multiple sessions (if allowed)

---

## 📞 Questions & Support

### **Technical Questions**
- Should session creation be synchronous or asynchronous?
- Do we need session heartbeat/activity tracking?
- Should we implement session cleanup for expired sessions?

### **Business Requirements** 
- What's the maximum number of sessions per user?
- How long should sessions persist?
- Do we need audit logging for session creation?

### **Deployment Coordination**
- When should this be deployed to development?
- Do we need to coordinate with frontend deployment?
- Any specific testing requirements?

---

**Status**: ⏳ **Waiting for Backend Implementation**  
**Frontend**: ✅ **Ready and Integrated**  
**Priority**: 🔥 **High - Required for Phase 2 Completion** 