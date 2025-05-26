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

**Note**: Users cannot terminate their current session for security reasons.

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

## ⏱️ **Time Tracking**

### **List Time Entries**
```http
GET /time-entries?startDate=2024-01-01&endDate=2024-01-31&userId=user-123
Authorization: Bearer {token}
```

### **Create Time Entry**
```http
POST /time-entries
Authorization: Bearer {token}
Content-Type: application/json

{
  "projectId": "project-123",
  "description": "Frontend development work",
  "startTime": "2024-01-15T09:00:00Z",
  "endTime": "2024-01-15T12:00:00Z",
  "hours": 3.0,
  "billable": true
}
```

### **Update Time Entry**
```http
PUT /time-entries/{entryId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "description": "Updated description",
  "hours": 3.5
}
```

### **Delete Time Entry**
```http
DELETE /time-entries/{entryId}
Authorization: Bearer {token}
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

## 🧾 **Invoicing**

### **List Invoices**
```http
GET /invoices
Authorization: Bearer {token}
```

### **Create Invoice**
```http
POST /invoices
Authorization: Bearer {token}
Content-Type: application/json

{
  "clientId": "client-123",
  "projectId": "project-123",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "description": "Monthly development work"
}
```

### **Send Invoice**
```http
POST /invoices/{invoiceId}/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "recipientEmail": "client@example.com",
  "message": "Please find attached your invoice for January 2024."
}
```

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