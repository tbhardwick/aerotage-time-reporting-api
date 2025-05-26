# API Reference Guide

## 🚀 **Aerotage Time Reporting API**

**Base URL**: `https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev//`  
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

## 🏢 **Team Management**

### **List Teams**
```http
GET /teams
Authorization: Bearer {token}
```

### **Create Team**
```http
POST /teams
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Engineering Team",
  "description": "Software development team",
  "managerId": "manager-user-id"
}
```

### **Update Team**
```http
PUT /teams/{teamId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Team Name",
  "description": "Updated description"
}
```

### **Add Team Member**
```http
POST /teams/{teamId}/members
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "user-id-123",
  "role": "member"
}
```

---

## 📊 **Project Management**

### **List Projects**
```http
GET /projects
Authorization: Bearer {token}
```

### **Create Project**
```http
POST /projects
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Website Redesign",
  "description": "Complete redesign of company website",
  "clientId": "client-id-123",
  "status": "active",
  "startDate": "2024-01-15",
  "endDate": "2024-03-15",
  "budget": 50000.00
}
```

### **Update Project**
```http
PUT /projects/{projectId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Project Name",
  "status": "completed"
}
```

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