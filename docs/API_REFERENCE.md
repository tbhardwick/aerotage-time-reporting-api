# API Reference Guide

## 🚀 **Aerotage Time Reporting API**

**Base URL**: `https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev/`  
**Authentication**: AWS Cognito JWT tokens  
**Content-Type**: `application/json`

## 📋 **Authentication**

All API endpoints (except public invitation endpoints) require authentication via JWT tokens obtained from AWS Cognito.

### **Headers Required**
```http
Authorization: Bearer {cognito-jwt-token}
Content-Type: application/json
```

### **Authentication Flow**
1. User authenticates with AWS Cognito
2. Cognito returns JWT token
3. Include token in `Authorization` header for all API calls
4. Backend validates token and extracts user information

---

## 👥 **User Management**

### **List Users**
```http
GET /users
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-id-123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "employee",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### **Get User Profile**
```http
GET /users/{userId}/profile
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-id-123",
    "email": "user@example.com",
    "name": "John Doe",
    "jobTitle": "Software Developer",
    "department": "Engineering",
    "hourlyRate": 75.00,
    "timezone": "America/New_York",
    "profilePicture": "https://s3.amazonaws.com/...",
    "bio": "Experienced developer...",
    "skills": ["JavaScript", "TypeScript", "AWS"],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-20T14:45:00Z"
  }
}
```

### **Update User Profile**
```http
PUT /users/{userId}/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "John Doe",
  "jobTitle": "Senior Software Developer",
  "department": "Engineering",
  "hourlyRate": 85.00,
  "timezone": "America/New_York",
  "bio": "Senior developer with 5+ years experience",
  "skills": ["JavaScript", "TypeScript", "AWS", "React"]
}
```

### **Get User Preferences**
```http
GET /users/{userId}/preferences
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "theme": "light",
    "language": "en",
    "dateFormat": "MM/DD/YYYY",
    "timeFormat": "12h",
    "timezone": "America/New_York",
    "notifications": {
      "email": true,
      "desktop": true,
      "mobile": false,
      "weeklyReports": true,
      "projectUpdates": true,
      "teamMessages": false
    },
    "dashboard": {
      "defaultView": "timesheet",
      "showWeekends": false,
      "autoStartTimer": true,
      "reminderInterval": 30
    }
  }
}
```

### **Update User Preferences**
```http
PUT /users/{userId}/preferences
Authorization: Bearer {token}
Content-Type: application/json

{
  "theme": "dark",
  "notifications": {
    "email": true,
    "desktop": false
  },
  "dashboard": {
    "defaultView": "dashboard",
    "showWeekends": true
  }
}
```

---

## 🔐 **Security & Authentication**

### **Change Password**
```http
PUT /users/{userId}/password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "CurrentPass123!",
  "newPassword": "NewSecurePass456!"
}
```

**Password Requirements:**
- Minimum 8 characters
- Must contain uppercase letter
- Must contain lowercase letter
- Must contain number
- Must contain special character
- Cannot reuse last 5 passwords

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password updated successfully"
  }
}
```

### **Get Security Settings**
```http
GET /users/{userId}/security-settings
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "twoFactorEnabled": false,
    "sessionTimeout": 480,
    "allowMultipleSessions": true,
    "passwordChangeRequired": false,
    "passwordLastChanged": "2024-01-15T10:30:00Z",
    "passwordExpiresAt": "2024-04-15T10:30:00Z",
    "securitySettings": {
      "requirePasswordChangeEvery": 90,
      "maxFailedLoginAttempts": 5,
      "accountLockoutDuration": 30
    }
  }
}
```

### **Update Security Settings**
```http
PUT /users/{userId}/security-settings
Authorization: Bearer {token}
Content-Type: application/json

{
  "sessionTimeout": 720,
  "allowMultipleSessions": false,
  "requirePasswordChangeEvery": 90
}
```

---

## 📱 **Session Management**

### **List User Sessions**
```http
GET /users/{userId}/sessions
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "session-id-123",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "loginTime": "2024-01-15T09:00:00Z",
      "lastActivity": "2024-01-15T11:30:00Z",
      "isCurrent": true,
      "location": {
        "city": "New York",
        "country": "United States"
      }
    }
  ]
}
```

### **Create Session**
```http
POST /users/{userId}/sessions
Authorization: Bearer {token}
Content-Type: application/json

{
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "loginTime": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
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

### **Terminate Session**
```http
DELETE /users/{userId}/sessions/{sessionId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Session terminated successfully"
  }
}
```

**Important Changes:**
- **Session Deletion**: This endpoint now **actually deletes** the session from the database, rather than just marking it as inactive
- **Permanent Removal**: The session record is completely removed and cannot be recovered
- **Current Session Protection**: Users cannot terminate their current session (use logout endpoint instead)

### **Logout (Complete Session Cleanup)**
```http
POST /logout
Authorization: Bearer {token}
Content-Type: application/json

{}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logout successful",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Features:**
- **Current Session Cleanup**: Finds and deletes the current session based on user agent and IP
- **Expired Session Cleanup**: Automatically cleans up any expired sessions for the user
- **Session ID Return**: Returns the ID of the session that was deleted
- **Complete Logout**: Should be called before signing out from Cognito for proper backend cleanup

**Recommended Logout Flow:**
```javascript
// 1. Call backend logout endpoint
await fetch(`${apiBaseUrl}/logout`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})
});

// 2. Sign out from Cognito
await Auth.signOut();

// 3. Clear local storage
localStorage.clear();
```

---

## 📧 **User Invitations**

### **Create User Invitation**
```http
POST /user-invitations
Authorization: Bearer {token}
Content-Type: application/json

{
  "email": "newuser@example.com",
  "role": "employee",
  "teamId": "team_123",
  "department": "Engineering",
  "jobTitle": "Software Developer",
  "hourlyRate": 75.00,
  "permissions": {
    "features": ["timeTracking", "reporting"],
    "projects": ["project_456"]
  },
  "personalMessage": "Welcome to the team!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "invitation-id-123",
    "email": "newuser@example.com",
    "role": "employee",
    "status": "pending",
    "invitationToken": "abc123def456...",
    "expiresAt": "2024-01-22T10:30:00Z",
    "createdAt": "2024-01-15T10:30:00Z",
    "invitedBy": "admin@example.com"
  }
}
```

### **List Invitations**
```http
GET /user-invitations?status=pending&limit=50&offset=0
Authorization: Bearer {token}
```

**Query Parameters:**
- `status`: `pending`, `accepted`, `expired`, `cancelled`
- `limit`: Number of results (default: 50, max: 100)
- `offset`: Pagination offset (default: 0)

### **Resend Invitation**
```http
POST /user-invitations/{id}/resend
Authorization: Bearer {token}
Content-Type: application/json

{
  "extendExpiration": true,
  "personalMessage": "Reminder: Please accept your invitation"
}
```

### **Cancel Invitation**
```http
DELETE /user-invitations/{id}
Authorization: Bearer {token}
```

### **Validate Invitation Token** (Public)
```http
GET /user-invitations/validate/{token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "invitation": {
      "email": "newuser@example.com",
      "role": "employee",
      "department": "Engineering",
      "jobTitle": "Software Developer",
      "expiresAt": "2024-01-22T10:30:00Z"
    }
  }
}
```

### **Accept Invitation** (Public)
```http
POST /user-invitations/accept
Content-Type: application/json

{
  "token": "abc123def456...",
  "userData": {
    "name": "John Doe",
    "password": "SecurePass123!",
    "preferences": {
      "theme": "light",
      "notifications": true,
      "timezone": "America/New_York"
    }
  }
}
```

---

## 🏢 **Client Management** ✅ **Phase 5 - NEW**

### **List Clients**
```http
GET /clients?isActive=true&limit=50&offset=0
Authorization: Bearer {token}
```

**Query Parameters:**
- `isActive`: Filter by active status (`true`, `false`)
- `limit`: Number of results (default: 50, max: 100)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "id": "client_1234567890_abcdef",
        "name": "Acme Corporation",
        "email": "contact@acme.com",
        "phone": "+1-555-0123",
        "address": "123 Business St, Suite 100, Business City, BC 12345",
        "contactPerson": "John Smith",
        "defaultHourlyRate": 150,
        "isActive": true,
        "notes": "Long-term client with multiple projects",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-20T14:45:00Z",
        "createdBy": "user-id-123"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### **Create Client**
```http
POST /clients
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "New Client Corp",
  "email": "contact@newclient.com",
  "phone": "+1-555-9876",
  "address": "456 Corporate Ave, Business City, BC 54321",
  "contactPerson": "Jane Doe",
  "defaultHourlyRate": 175,
  "notes": "New client onboarded in Q1 2024"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "client_1234567890_newclient",
    "name": "New Client Corp",
    "email": "contact@newclient.com",
    "phone": "+1-555-9876",
    "address": "456 Corporate Ave, Business City, BC 54321",
    "contactPerson": "Jane Doe",
    "defaultHourlyRate": 175,
    "isActive": true,
    "notes": "New client onboarded in Q1 2024",
    "createdAt": "2024-01-25T09:15:00Z",
    "updatedAt": "2024-01-25T09:15:00Z",
    "createdBy": "user-id-123"
  },
  "message": "Client created successfully"
}
```

### **Update Client**
```http
PUT /clients/{clientId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "phone": "+1-555-1111",
  "defaultHourlyRate": 200,
  "notes": "Updated contact information and rates for 2024"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "client_1234567890_abcdef",
    "name": "Acme Corporation",
    "email": "contact@acme.com",
    "phone": "+1-555-1111",
    "address": "123 Business St, Suite 100, Business City, BC 12345",
    "contactPerson": "John Smith",
    "defaultHourlyRate": 200,
    "isActive": true,
    "notes": "Updated contact information and rates for 2024",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-25T11:20:00Z",
    "createdBy": "user-id-123"
  },
  "message": "Client updated successfully"
}
```

### **Delete Client (Soft Delete)**
```http
DELETE /clients/{clientId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": null,
  "message": "Client deactivated successfully"
}
```

**Note**: Clients with active projects cannot be deleted. The system will return an error with details about associated projects that must be handled first.

---

## 📊 **Project Management** ✅ **Phase 5 - NEW**

### **List Projects**
```http
GET /projects?clientId=client_123&status=active&limit=50&offset=0
Authorization: Bearer {token}
```

**Query Parameters:**
- `clientId`: Filter by client ID
- `status`: Filter by status (`active`, `paused`, `completed`, `cancelled`)
- `limit`: Number of results (default: 50, max: 100)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "project_1234567890_website",
        "name": "Website Redesign Project",
        "clientId": "client_1234567890_abcdef",
        "clientName": "Acme Corporation",
        "description": "Complete redesign of company website with modern UI/UX",
        "status": "active",
        "defaultHourlyRate": 150,
        "defaultBillable": true,
        "budget": {
          "type": "hours",
          "value": 200,
          "spent": 45
        },
        "deadline": "2024-06-30",
        "teamMembers": [
          {
            "userId": "user-id-123",
            "name": "John Developer",
            "role": "lead"
          }
        ],
        "tags": ["web", "design", "frontend"],
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-20T14:45:00Z",
        "createdBy": "user-id-123"
      }
    ],
    "pagination": {
      "total": 12,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### **Create Project**
```http
POST /projects
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Mobile App Development",
  "clientId": "client_1234567890_abcdef",
  "clientName": "Acme Corporation",
  "description": "Native mobile app for iOS and Android platforms",
  "status": "active",
  "defaultHourlyRate": 175,
  "defaultBillable": true,
  "budget": {
    "type": "fixed",
    "value": 50000,
    "spent": 0
  },
  "deadline": "2024-09-15",
  "teamMembers": [
    {
      "userId": "user-id-456",
      "role": "lead"
    }
  ],
  "tags": ["mobile", "ios", "android", "react-native"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "project_1234567890_mobileapp",
    "name": "Mobile App Development",
    "clientId": "client_1234567890_abcdef",
    "clientName": "Acme Corporation",
    "description": "Native mobile app for iOS and Android platforms",
    "status": "active",
    "defaultHourlyRate": 175,
    "defaultBillable": true,
    "budget": {
      "type": "fixed",
      "value": 50000,
      "spent": 0
    },
    "deadline": "2024-09-15",
    "teamMembers": [
      {
        "userId": "user-id-456",
        "name": "Jane Developer",
        "role": "lead"
      }
    ],
    "tags": ["mobile", "ios", "android", "react-native"],
    "createdAt": "2024-01-25T09:30:00Z",
    "updatedAt": "2024-01-25T09:30:00Z",
    "createdBy": "user-id-123"
  },
  "message": "Project created successfully"
}
```

### **Update Project**
```http
PUT /projects/{projectId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "description": "Updated project scope to include web portal",
  "status": "paused",
  "budget": {
    "type": "fixed",
    "value": 60000,
    "spent": 15000
  },
  "tags": ["mobile", "ios", "android", "react-native", "web"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "project_1234567890_mobileapp",
    "name": "Mobile App Development",
    "clientId": "client_1234567890_abcdef",
    "clientName": "Acme Corporation",
    "description": "Updated project scope to include web portal",
    "status": "paused",
    "defaultHourlyRate": 175,
    "defaultBillable": true,
    "budget": {
      "type": "fixed",
      "value": 60000,
      "spent": 15000
    },
    "deadline": "2024-09-15",
    "teamMembers": [
      {
        "userId": "user-id-456",
        "name": "Jane Developer",
        "role": "lead"
      }
    ],
    "tags": ["mobile", "ios", "android", "react-native", "web"],
    "createdAt": "2024-01-25T09:30:00Z",
    "updatedAt": "2024-01-25T14:15:00Z",
    "createdBy": "user-id-123"
  },
  "message": "Project updated successfully"
}
```

### **Delete Project**
```http
DELETE /projects/{projectId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": null,
  "message": "Project deleted successfully"
}
```

**Note**: Projects with associated time entries may require additional confirmation or may be archived instead of deleted, depending on business rules.

---

## ⏱️ **Time Tracking** ✅ **Phase 4 - COMPLETE**

### **List Time Entries**
```http
GET /time-entries?startDate=2024-01-01&endDate=2024-01-31&projectId=project-123
Authorization: Bearer {token}
```

**Query Parameters:**
- `startDate`: Filter by start date (YYYY-MM-DD)
- `endDate`: Filter by end date (YYYY-MM-DD)
- `projectId`: Filter by project ID
- `status`: Filter by status (`draft`, `submitted`, `approved`, `rejected`)
- `isBillable`: Filter by billable status (`true`, `false`)
- `limit`: Number of results (default: 50, max: 100)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "te_1234567890_abcdef",
        "userId": "user-id-123",
        "projectId": "project-id-456",
        "description": "Frontend development work",
        "date": "2024-01-15",
        "startTime": "2024-01-15T09:00:00Z",
        "endTime": "2024-01-15T12:00:00Z",
        "duration": 180,
        "isBillable": true,
        "hourlyRate": 75.00,
        "status": "approved",
        "tags": ["development", "frontend"],
        "notes": "Completed user interface updates",
        "isTimerEntry": false,
        "createdAt": "2024-01-15T09:00:00Z",
        "updatedAt": "2024-01-16T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### **Create Time Entry**
```http
POST /time-entries
Authorization: Bearer {token}
Content-Type: application/json

{
  "projectId": "project-id-456",
  "description": "Backend API development",
  "date": "2024-01-15",
  "startTime": "2024-01-15T09:00:00Z",
  "endTime": "2024-01-15T12:00:00Z",
  "duration": 180,
  "isBillable": true,
  "hourlyRate": 85.00,
  "tags": ["development", "backend", "api"],
  "notes": "Implemented user authentication endpoints"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "te_1234567890_newentry",
    "userId": "user-id-123",
    "projectId": "project-id-456",
    "description": "Backend API development",
    "date": "2024-01-15",
    "startTime": "2024-01-15T09:00:00Z",
    "endTime": "2024-01-15T12:00:00Z",
    "duration": 180,
    "isBillable": true,
    "hourlyRate": 85.00,
    "status": "draft",
    "tags": ["development", "backend", "api"],
    "notes": "Implemented user authentication endpoints",
    "isTimerEntry": false,
    "createdAt": "2024-01-15T12:05:00Z",
    "updatedAt": "2024-01-15T12:05:00Z"
  },
  "message": "Time entry created successfully"
}
```

### **Update Time Entry**
```http
PUT /time-entries/{entryId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "description": "Updated: Backend API development with testing",
  "duration": 240,
  "notes": "Added comprehensive unit tests"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "te_1234567890_newentry",
    "userId": "user-id-123",
    "projectId": "project-id-456",
    "description": "Updated: Backend API development with testing",
    "date": "2024-01-15",
    "startTime": "2024-01-15T09:00:00Z",
    "endTime": "2024-01-15T13:00:00Z",
    "duration": 240,
    "isBillable": true,
    "hourlyRate": 85.00,
    "status": "draft",
    "tags": ["development", "backend", "api"],
    "notes": "Added comprehensive unit tests",
    "isTimerEntry": false,
    "createdAt": "2024-01-15T12:05:00Z",
    "updatedAt": "2024-01-15T14:20:00Z"
  },
  "message": "Time entry updated successfully"
}
```

### **Delete Time Entry**
```http
DELETE /time-entries/{entryId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": null,
  "message": "Time entry deleted successfully"
}
```

**Note**: Only time entries with status `draft` or `rejected` can be deleted.

### **Submit Time Entries for Approval**
```http
POST /time-entries/submit
Authorization: Bearer {token}
Content-Type: application/json

{
  "timeEntryIds": [
    "te_1234567890_entry1",
    "te_1234567890_entry2",
    "te_1234567890_entry3"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "successful": [
      "te_1234567890_entry1",
      "te_1234567890_entry2"
    ],
    "failed": [
      {
        "id": "te_1234567890_entry3",
        "error": "TIME_ENTRY_ALREADY_SUBMITTED"
      }
    ]
  },
  "message": "Bulk submission completed"
}
```

### **Approve Time Entries** (Managers Only)
```http
POST /time-entries/approve
Authorization: Bearer {token}
Content-Type: application/json

{
  "timeEntryIds": [
    "te_1234567890_entry1",
    "te_1234567890_entry2"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "successful": [
      "te_1234567890_entry1",
      "te_1234567890_entry2"
    ],
    "failed": []
  },
  "message": "Time entries approved successfully"
}
```

### **Reject Time Entries** (Managers Only)
```http
POST /time-entries/reject
Authorization: Bearer {token}
Content-Type: application/json

{
  "timeEntryIds": [
    "te_1234567890_entry1"
  ],
  "reason": "Insufficient detail in description. Please provide more specific information about the work performed."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "successful": [
      "te_1234567890_entry1"
    ],
    "failed": []
  },
  "message": "Time entries rejected successfully"
}
```

---

## 📈 **Reporting**

### **Time Reports**
```http
GET /reports/time?startDate=2024-01-01&endDate=2024-01-31&userId=user-123
Authorization: Bearer {token}
```

### **Project Reports**
```http
GET /reports/projects?projectId=project-123&startDate=2024-01-01
Authorization: Bearer {token}
```

### **User Reports**
```http
GET /reports/users?userId=user-123&period=monthly
Authorization: Bearer {token}
```

---

## 🧾 **Invoice Management** ✅ **Phase 7 - COMPLETE**

### **List Invoices**
```http
GET /invoices?status=draft&clientId=client-123&limit=50&offset=0
Authorization: Bearer {token}
```

**Query Parameters:**
- `status`: Filter by status (`draft`, `sent`, `viewed`, `paid`, `overdue`, `cancelled`, `refunded`)
- `clientId`: Filter by client ID
- `projectId`: Filter by project ID
- `dateFrom`: Filter invoices from date (YYYY-MM-DD)
- `dateTo`: Filter invoices to date (YYYY-MM-DD)
- `amountMin`: Minimum invoice amount
- `amountMax`: Maximum invoice amount
- `isRecurring`: Filter by recurring status (`true`, `false`)
- `sortBy`: Sort field (`invoiceNumber`, `issueDate`, `dueDate`, `totalAmount`, `status`, `clientName`)
- `sortOrder`: Sort order (`asc`, `desc`)
- `limit`: Number of results (default: 10, max: 100)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "invoice_1748304106141_3p09dziuq",
        "invoiceNumber": "INV-2025-05-006",
        "clientId": "test-client-123",
        "clientName": "Acme Corporation",
        "projectIds": ["project-456"],
        "timeEntryIds": ["te_123", "te_124"],
        "status": "sent",
        "issueDate": "2025-01-15",
        "dueDate": "2025-02-14",
        "subtotal": 2500.00,
        "taxRate": 0.08,
        "taxAmount": 200.00,
        "discountRate": 0.05,
        "discountAmount": 125.00,
        "totalAmount": 2575.00,
        "currency": "USD",
        "lineItems": [
          {
            "id": "line_123",
            "type": "time",
            "description": "Frontend Development",
            "quantity": 20,
            "rate": 125.00,
            "amount": 2500.00,
            "taxable": true,
            "timeEntryId": "te_123",
            "projectId": "project-456"
          }
        ],
        "paymentTerms": "Net 30",
        "isRecurring": false,
        "remindersSent": 1,
        "notes": "Monthly development work",
        "clientNotes": "Thank you for your business!",
        "createdAt": "2025-01-15T10:30:00Z",
        "updatedAt": "2025-01-15T14:45:00Z",
        "createdBy": "user-id-123"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### **Generate Invoice**
```http
POST /invoices
Authorization: Bearer {token}
Content-Type: application/json

{
  "clientId": "client-123",
  "projectIds": ["project-456"],
  "timeEntryIds": ["te_123", "te_124"],
  "issueDate": "2025-01-15",
  "paymentTerms": "Net 30",
  "currency": "USD",
  "taxRate": 0.08,
  "discountRate": 0.05,
  "additionalLineItems": [
    {
      "type": "fixed",
      "description": "Setup Fee",
      "quantity": 1,
      "rate": 500.00,
      "amount": 500.00,
      "taxable": true
    }
  ],
  "notes": "Monthly development invoice",
  "clientNotes": "Thank you for your business!",
  "isRecurring": false,
  "templateId": "template-123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "invoice_1748304106141_3p09dziuq",
    "invoiceNumber": "INV-2025-05-006",
    "clientId": "client-123",
    "clientName": "Acme Corporation",
    "projectIds": ["project-456"],
    "timeEntryIds": ["te_123", "te_124"],
    "status": "draft",
    "issueDate": "2025-01-15",
    "dueDate": "2025-02-14",
    "subtotal": 3000.00,
    "taxRate": 0.08,
    "taxAmount": 240.00,
    "discountRate": 0.05,
    "discountAmount": 150.00,
    "totalAmount": 3090.00,
    "currency": "USD",
    "lineItems": [
      {
        "id": "line_123",
        "type": "time",
        "description": "Frontend Development",
        "quantity": 20,
        "rate": 125.00,
        "amount": 2500.00,
        "taxable": true,
        "timeEntryId": "te_123",
        "projectId": "project-456"
      },
      {
        "id": "line_124",
        "type": "fixed",
        "description": "Setup Fee",
        "quantity": 1,
        "rate": 500.00,
        "amount": 500.00,
        "taxable": true
      }
    ],
    "paymentTerms": "Net 30",
    "isRecurring": false,
    "remindersSent": 0,
    "notes": "Monthly development invoice",
    "clientNotes": "Thank you for your business!",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z",
    "createdBy": "user-id-123"
  },
  "message": "Invoice generated successfully"
}
```

### **Generate Recurring Invoice**
```http
POST /invoices
Authorization: Bearer {token}
Content-Type: application/json

{
  "clientId": "client-123",
  "projectIds": ["project-456"],
  "issueDate": "2025-01-15",
  "paymentTerms": "Net 15",
  "currency": "USD",
  "taxRate": 0.08,
  "additionalLineItems": [
    {
      "type": "fixed",
      "description": "Monthly Retainer",
      "quantity": 1,
      "rate": 5000.00,
      "amount": 5000.00,
      "taxable": true
    }
  ],
  "isRecurring": true,
  "recurringConfig": {
    "frequency": "monthly",
    "interval": 1,
    "startDate": "2025-01-15",
    "isActive": true,
    "autoSend": false,
    "generateDaysBefore": 3
  },
  "notes": "Monthly retainer invoice",
  "clientNotes": "Monthly retainer for ongoing services"
}
```

### **Update Invoice**
```http
PUT /invoices/{invoiceId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "dueDate": "2025-03-15",
  "paymentTerms": "Net 45",
  "taxRate": 0.10,
  "discountRate": 0.10,
  "notes": "Updated payment terms",
  "clientNotes": "Extended payment terms as requested"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "invoice_1748304106141_3p09dziuq",
    "invoiceNumber": "INV-2025-05-006",
    "dueDate": "2025-03-15",
    "paymentTerms": "Net 45",
    "taxRate": 0.10,
    "taxAmount": 300.00,
    "discountRate": 0.10,
    "discountAmount": 300.00,
    "totalAmount": 3000.00,
    "notes": "Updated payment terms",
    "clientNotes": "Extended payment terms as requested",
    "updatedAt": "2025-01-16T09:15:00Z"
  },
  "message": "Invoice updated successfully"
}
```

**Note**: Only draft invoices can be updated. Sent invoices require status changes or payment recording.

### **Send Invoice**
```http
POST /invoices/{invoiceId}/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "recipientEmails": ["client@acme.com", "accounting@acme.com"],
  "subject": "Invoice INV-2025-05-006 from Aerotage",
  "message": "Please find your invoice attached. Payment is due within 30 days.",
  "attachPdf": true,
  "sendCopy": false,
  "scheduleDate": "2025-01-16T09:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "invoice_1748304106141_3p09dziuq",
    "status": "sent",
    "updatedAt": "2025-01-16T09:00:00Z"
  },
  "message": "Invoice sent successfully"
}
```

### **Update Invoice Status**
```http
PUT /invoices/{invoiceId}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "viewed"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice_1748304106141_3p09dziuq",
      "status": "viewed",
      "updatedAt": "2025-01-16T10:30:00Z"
    }
  },
  "message": "Invoice status updated successfully"
}
```

### **Record Payment**
```http
PUT /invoices/{invoiceId}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "operation": "recordPayment",
  "amount": 1500.00,
  "paymentDate": "2025-01-20",
  "paymentMethod": "Bank Transfer",
  "reference": "TXN-20250120-001",
  "notes": "Partial payment received",
  "externalPaymentId": "stripe_pi_1234567890",
  "processorFee": 43.50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice_1748304106141_3p09dziuq",
      "status": "viewed",
      "totalAmount": 3000.00,
      "updatedAt": "2025-01-20T14:30:00Z"
    },
    "payment": {
      "id": "payment_1748304109093_d5txnin9j",
      "invoiceId": "invoice_1748304106141_3p09dziuq",
      "amount": 1500.00,
      "currency": "USD",
      "paymentDate": "2025-01-20",
      "paymentMethod": "Bank Transfer",
      "reference": "TXN-20250120-001",
      "notes": "Partial payment received",
      "status": "completed",
      "externalPaymentId": "stripe_pi_1234567890",
      "processorFee": 43.50,
      "createdAt": "2025-01-20T14:30:00Z",
      "recordedBy": "user-id-123"
    }
  },
  "message": "Payment recorded successfully"
}
```

### **Record Full Payment**
```http
PUT /invoices/{invoiceId}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "operation": "recordPayment",
  "amount": 3000.00,
  "paymentDate": "2025-01-25",
  "paymentMethod": "Credit Card",
  "reference": "CC-20250125-002",
  "notes": "Full payment received",
  "externalPaymentId": "stripe_pi_0987654321",
  "processorFee": 87.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice_1748304106141_3p09dziuq",
      "status": "paid",
      "paidDate": "2025-01-25",
      "totalAmount": 3000.00,
      "updatedAt": "2025-01-25T11:45:00Z"
    },
    "payment": {
      "id": "payment_1748304172353_fwl0d6m37",
      "invoiceId": "invoice_1748304106141_3p09dziuq",
      "amount": 3000.00,
      "currency": "USD",
      "paymentDate": "2025-01-25",
      "paymentMethod": "Credit Card",
      "reference": "CC-20250125-002",
      "notes": "Full payment received",
      "status": "completed",
      "externalPaymentId": "stripe_pi_0987654321",
      "processorFee": 87.00,
      "createdAt": "2025-01-25T11:45:00Z",
      "recordedBy": "user-id-123"
    }
  },
  "message": "Payment recorded successfully"
}
```

**Note**: When full payment is recorded, invoice status automatically changes to "paid".

### **Download Invoice PDF**
```http
GET /invoices/{invoiceId}/pdf?templateId=template-123
Authorization: Bearer {token}
```

**Response:**
- **Content-Type**: `application/pdf`
- **Content-Disposition**: `attachment; filename="INV-2025-05-006.pdf"`
- Binary PDF data

### **List Invoice Payments**
```http
GET /invoices/{invoiceId}/payments
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "payment_1748304109093_d5txnin9j",
        "amount": 1500.00,
        "paymentDate": "2025-01-20",
        "paymentMethod": "Bank Transfer",
        "reference": "TXN-20250120-001",
        "status": "completed",
        "processorFee": 43.50,
        "createdAt": "2025-01-20T14:30:00Z"
      },
      {
        "id": "payment_1748304172353_fwl0d6m37",
        "amount": 1500.00,
        "paymentDate": "2025-01-25",
        "paymentMethod": "Credit Card",
        "reference": "CC-20250125-002",
        "status": "completed",
        "processorFee": 43.50,
        "createdAt": "2025-01-25T11:45:00Z"
      }
    ],
    "totalPaid": 3000.00,
    "remainingBalance": 0.00
  }
}
```

### **List Recurring Invoices**
```http
GET /invoices/recurring?isActive=true&frequency=monthly
Authorization: Bearer {token}
```

**Query Parameters:**
- `isActive`: Filter by active status (`true`, `false`)
- `frequency`: Filter by frequency (`weekly`, `monthly`, `quarterly`, `yearly`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "invoice_1748304106457_rduz9ienj",
      "invoiceNumber": "INV-2025-05-007",
      "clientId": "client-123",
      "clientName": "Acme Corporation",
      "isRecurring": true,
      "recurringConfig": {
        "frequency": "monthly",
        "interval": 1,
        "startDate": "2025-01-15",
        "isActive": true,
        "autoSend": false,
        "generateDaysBefore": 3,
        "invoicesGenerated": 3,
        "nextInvoiceDate": "2025-04-15"
      },
      "totalAmount": 5400.00,
      "status": "draft"
    }
  ]
}
```

### **Process Recurring Invoices**
```http
POST /invoices/recurring
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "processed": 2,
    "invoices": [
      {
        "id": "invoice_1748304180001_auto1",
        "invoiceNumber": "INV-2025-05-020",
        "clientId": "client-123",
        "totalAmount": 5400.00,
        "status": "draft"
      },
      {
        "id": "invoice_1748304180002_auto2",
        "invoiceNumber": "INV-2025-05-021",
        "clientId": "client-456",
        "totalAmount": 3200.00,
        "status": "draft"
      }
    ]
  }
}
```

### **Update Recurring Configuration**
```http
PUT /invoices/{invoiceId}/recurring
Authorization: Bearer {token}
Content-Type: application/json

{
  "frequency": "quarterly",
  "interval": 1,
  "isActive": true,
  "autoSend": true,
  "generateDaysBefore": 7
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "invoice_1748304106457_rduz9ienj",
    "recurringConfig": {
      "frequency": "quarterly",
      "interval": 1,
      "startDate": "2025-01-15",
      "isActive": true,
      "autoSend": true,
      "generateDaysBefore": 7,
      "invoicesGenerated": 3,
      "nextInvoiceDate": "2025-07-15"
    },
    "updatedAt": "2025-01-30T10:00:00Z"
  }
}
```

### **Stop Recurring Invoice**
```http
DELETE /invoices/{invoiceId}/recurring
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Recurring invoice stopped"
}
```

### **Invoice Templates**

#### **List Templates**
```http
GET /invoice-templates
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "template-123",
      "name": "Standard Invoice",
      "isDefault": true,
      "layout": "standard",
      "colors": {
        "primary": "#2563eb",
        "secondary": "#64748b",
        "accent": "#059669"
      },
      "logo": "https://s3.amazonaws.com/company-logo.png",
      "companyInfo": {
        "name": "Aerotage Design Group",
        "address": "123 Business St, Suite 100",
        "phone": "+1-555-0123",
        "email": "billing@aerotage.com",
        "website": "https://aerotage.com"
      },
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

#### **Create Template**
```http
POST /invoice-templates
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Modern Invoice",
  "layout": "modern",
  "colors": {
    "primary": "#7c3aed",
    "secondary": "#6b7280",
    "accent": "#10b981"
  },
  "logo": "https://s3.amazonaws.com/new-logo.png",
  "companyInfo": {
    "name": "Aerotage Design Group",
    "address": "123 Business St, Suite 100",
    "phone": "+1-555-0123",
    "email": "billing@aerotage.com",
    "website": "https://aerotage.com"
  },
  "customFields": [
    {
      "name": "Project Manager",
      "value": "John Doe",
      "position": "header"
    }
  ],
  "isDefault": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "template-456",
    "name": "Modern Invoice",
    "isDefault": false,
    "layout": "modern",
    "colors": {
      "primary": "#7c3aed",
      "secondary": "#6b7280",
      "accent": "#10b981"
    },
    "logo": "https://s3.amazonaws.com/new-logo.png",
    "companyInfo": {
      "name": "Aerotage Design Group",
      "address": "123 Business St, Suite 100",
      "phone": "+1-555-0123",
      "email": "billing@aerotage.com",
      "website": "https://aerotage.com"
    },
    "customFields": [
      {
        "name": "Project Manager",
        "value": "John Doe",
        "position": "header"
      }
    ],
    "createdAt": "2025-01-30T14:20:00Z",
    "updatedAt": "2025-01-30T14:20:00Z"
  }
}
```

### **Invoice Status Workflow**

**Status Transitions:**
1. `draft` → `sent` (via send endpoint)
2. `sent` → `viewed` (client views invoice)
3. `viewed` → `paid` (payment recorded)
4. `sent/viewed` → `overdue` (past due date)
5. `any` → `cancelled` (manual cancellation)
6. `paid` → `refunded` (refund processed)

**Business Rules:**
- Only `draft` invoices can be edited
- Payments can be recorded for `sent`, `viewed`, or `overdue` invoices
- Recurring invoices generate new drafts automatically
- Full payment automatically sets status to `paid`
- Partial payments keep current status until fully paid

---

## 🏪 **Client Management**

### **List Clients**
```http
GET /clients
Authorization: Bearer {token}
```

### **Create Client**
```http
POST /clients
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Acme Corporation",
  "email": "contact@acme.com",
  "phone": "+1-555-123-4567",
  "address": {
    "street": "123 Business Ave",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  }
}
```

---

## ❌ **Error Responses**

### **Standard Error Format**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  }
}
```

### **Common HTTP Status Codes**
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `423` - Locked (account locked)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### **Common Error Codes**
- `VALIDATION_ERROR` - Input validation failed
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `DUPLICATE_RESOURCE` - Resource already exists
- `ACCOUNT_LOCKED` - User account is locked
- `PASSWORD_POLICY_VIOLATION` - Password doesn't meet requirements
- `SESSION_MIGRATION_REQUIRED` - Legacy session needs migration
- `RATE_LIMIT_EXCEEDED` - Too many requests

---

## 🔧 **Development Information**

### **Environment URLs**
- **Development**: `https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev//`
- **Staging**: `https://[staging-url]/staging/`
- **Production**: `https://[production-url]/prod/`

### **AWS Resources**
- **Cognito User Pool ID**: `us-east-1_EsdlgX9Qg`
- **Cognito App Client ID**: `148r35u6uultp1rmfdu22i8amb`
- **Identity Pool ID**: `us-east-1:d79776bb-4b8e-4654-a10a-a45b1adaa787`

### **Rate Limits**
- **General API**: 1000 requests/minute per user
- **Authentication**: 100 requests/minute per IP
- **Invitation Creation**: 10 invitations/hour per admin
- **Password Reset**: 5 attempts/hour per user

---

This API reference covers all currently implemented endpoints in the Aerotage Time Reporting API. For implementation details and integration guides, see the additional documentation in the `/docs` folder. 