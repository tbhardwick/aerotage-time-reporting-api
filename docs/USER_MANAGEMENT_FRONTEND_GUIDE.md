# User Management API - Frontend Integration Guide

## 📋 Overview

This guide provides complete instructions for integrating with the Aerotage Time Reporting API's user management endpoints. All endpoints are live and operational in the development environment.

## 🌐 Environment Details

- **API Base URL**: `https://time-api-dev.aerotage.com`
- **Authentication**: AWS Cognito JWT tokens
- **Environment**: Development (production-ready)

## 🔐 Authentication Setup

### Cognito Configuration
```javascript
const cognitoConfig = {
  userPoolId: 'us-east-1_EsdlgX9Qg',
  clientId: '148r35u6uultp1rmfdu22i8amb',
  region: 'us-east-1'
};
```

### Authentication Flow
1. **Login with Cognito** to get JWT tokens
2. **Use AccessToken** for API authentication (NOT IdToken)
3. **Include in headers**: `Authorization: Bearer ${accessToken}`

### Example Authentication
```javascript
// Using AWS Amplify (recommended)
import { Auth } from 'aws-amplify';

// Configure Amplify
Auth.configure({
  region: 'us-east-1',
  userPoolId: 'us-east-1_EsdlgX9Qg',
  userPoolWebClientId: '148r35u6uultp1rmfdu22i8amb'
});

// Login and get token
const user = await Auth.signIn(email, password);
const session = await Auth.currentSession();
const accessToken = session.getAccessToken().getJwtToken();
```

## 📡 User Management Endpoints

### 1. List All Users
**Endpoint**: `GET /users`  
**Access**: Admin and Manager roles only

#### Request
```javascript
const response = await fetch(`${API_BASE_URL}/users`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});

const result = await response.json();
```

#### Response Format
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-123",
        "email": "john.doe@company.com",
        "name": "John Doe",
        "role": "employee",
        "department": "Engineering",
        "jobTitle": "Software Developer",
        "hourlyRate": 75.00,
        "isActive": true,
        "startDate": "2024-01-15",
        "createdAt": "2024-01-15T10:00:00Z",
        "updatedAt": "2024-01-15T10:00:00Z"
      }
    ],
    "total": 1
  }
}
```

#### Role-Based Filtering
- **Admin**: Sees all user data including hourly rates and permissions
- **Manager**: Sees limited user data (no hourly rates or sensitive info)
- **Employee**: Cannot access this endpoint (403 Forbidden)

### 2. Get Individual User
**Endpoint**: `GET /users/{userId}`  
**Access**: Users can access own data, Admin/Manager can access others

#### Request
```javascript
const userId = 'user-123';
const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});

const result = await response.json();
```

#### Response Format
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-123",
      "email": "john.doe@company.com",
      "name": "John Doe",
      "role": "employee",
      "department": "Engineering",
      "jobTitle": "Software Developer",
      "hourlyRate": 75.00,
      "permissions": {
        "features": ["time_tracking", "reports"],
        "projects": ["project-1", "project-2"]
      },
      "isActive": true,
      "startDate": "2024-01-15",
      "preferences": {
        "theme": "dark",
        "notifications": true,
        "timezone": "America/New_York"
      },
      "contactInfo": {
        "phone": "+1-555-0123",
        "address": "123 Main St, City, State 12345"
      },
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### 3. Update User
**Endpoint**: `PUT /users/{userId}`  
**Access**: Users can update own basic info, Admin can update everything

#### Request Body Structure
```javascript
// Employee updating own info (limited fields)
const updateData = {
  name: "John Smith",
  preferences: {
    theme: "dark",
    notifications: false,
    timezone: "America/Los_Angeles"
  },
  contactInfo: {
    phone: "+1-555-9876",
    address: "456 Oak Ave, City, State 54321"
  }
};

// Admin updating user (all fields allowed)
const adminUpdateData = {
  name: "John Smith",
  role: "manager",
  department: "Product",
  jobTitle: "Product Manager",
  hourlyRate: 85.00,
  permissions: {
    features: ["time_tracking", "reports", "user_management"],
    projects: ["project-1", "project-2", "project-3"]
  },
  isActive: true,
  preferences: {
    theme: "dark",
    notifications: false,
    timezone: "America/Los_Angeles"
  },
  contactInfo: {
    phone: "+1-555-9876",
    address: "456 Oak Ave, City, State 54321"
  }
};
```

#### Request
```javascript
const userId = 'user-123';
const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(updateData)
});

const result = await response.json();
```

#### Response Format
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-123",
      "email": "john.doe@company.com",
      "name": "John Smith",
      "role": "employee",
      "department": "Engineering",
      "jobTitle": "Software Developer",
      "hourlyRate": 75.00,
      "permissions": {
        "features": ["time_tracking", "reports"],
        "projects": ["project-1", "project-2"]
      },
      "isActive": true,
      "startDate": "2024-01-15",
      "preferences": {
        "theme": "dark",
        "notifications": false,
        "timezone": "America/Los_Angeles"
      },
      "contactInfo": {
        "phone": "+1-555-9876",
        "address": "456 Oak Ave, City, State 54321"
      },
      "updatedAt": "2024-01-20T15:30:00Z"
    }
  }
}
```

## 🔒 Authorization Rules

### Role-Based Access Control

#### Admin Role
- ✅ Can list all users with full data
- ✅ Can view any user's complete profile
- ✅ Can update any user's information including role, permissions, hourly rate
- ✅ Can activate/deactivate users

#### Manager Role
- ✅ Can list users with limited data (no hourly rates)
- ✅ Can view team members' profiles
- ❌ Cannot update other users' roles or permissions
- ❌ Cannot see hourly rates or sensitive financial data

#### Employee Role
- ❌ Cannot list all users
- ✅ Can view own profile only
- ✅ Can update own basic information (name, preferences, contact info)
- ❌ Cannot update role, permissions, or hourly rate

### Field-Level Permissions

#### Employee Self-Update (Allowed Fields)
- `name` - Display name
- `preferences` - User preferences (theme, notifications, timezone)
- `contactInfo` - Contact information (phone, address)

#### Admin Update (All Fields Allowed)
- `name` - Display name
- `role` - User role (admin, manager, employee)
- `department` - Department assignment
- `jobTitle` - Job title
- `hourlyRate` - Billing rate
- `permissions` - Feature and project permissions
- `isActive` - Account status
- `preferences` - User preferences
- `contactInfo` - Contact information

## 🚨 Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions for this operation"
  }
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found"
  }
}
```

#### 400 Bad Request
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

### Error Handling Example
```javascript
try {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  const result = await response.json();

  if (!result.success) {
    // Handle API error
    console.error('API Error:', result.error);
    
    switch (result.error.code) {
      case 'UNAUTHORIZED':
        // Redirect to login
        break;
      case 'FORBIDDEN':
        // Show permission denied message
        break;
      case 'USER_NOT_FOUND':
        // Show user not found message
        break;
      default:
        // Show generic error message
    }
    return;
  }

  // Handle success
  const users = result.data.users;
  console.log('Users loaded:', users);

} catch (error) {
  // Handle network or parsing errors
  console.error('Network error:', error);
}
```

## 🎯 Frontend Implementation Examples

### React Hook for User Management
```javascript
import { useState, useEffect } from 'react';
import { Auth } from 'aws-amplify';

const useUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE_URL = 'https://time-api-dev.aerotage.com';

  const getAuthHeaders = async () => {
    const session = await Auth.currentSession();
    const accessToken = session.getAccessToken().getJwtToken();
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'GET',
        headers
      });

      const result = await response.json();
      
      if (result.success) {
        setUsers(result.data.users);
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchUser = async (userId) => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'GET',
        headers
      });

      const result = await response.json();
      
      if (result.success) {
        setCurrentUser(result.data.user);
        return result.data.user;
      } else {
        setError(result.error.message);
        return null;
      }
    } catch (err) {
      setError('Failed to fetch user');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userId, updateData) => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData)
      });

      const result = await response.json();
      
      if (result.success) {
        setCurrentUser(result.data.user);
        // Update users list if user is in it
        setUsers(prev => prev.map(u => u.id === userId ? result.data.user : u));
        return result.data.user;
      } else {
        setError(result.error.message);
        return null;
      }
    } catch (err) {
      setError('Failed to update user');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    users,
    currentUser,
    loading,
    error,
    fetchUsers,
    fetchUser,
    updateUser
  };
};

export default useUserManagement;
```

### User List Component Example
```javascript
import React, { useEffect } from 'react';
import useUserManagement from './hooks/useUserManagement';

const UserList = () => {
  const { users, loading, error, fetchUsers } = useUserManagement();

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="user-list">
      <h2>Active Users</h2>
      <div className="users-grid">
        {users.map(user => (
          <div key={user.id} className="user-card">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
            <p>{user.jobTitle} - {user.department}</p>
            <span className={`role-badge ${user.role}`}>
              {user.role.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList;
```

### User Profile Component Example
```javascript
import React, { useState, useEffect } from 'react';
import useUserManagement from './hooks/useUserManagement';

const UserProfile = ({ userId }) => {
  const { currentUser, loading, error, fetchUser, updateUser } = useUserManagement();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (userId) {
      fetchUser(userId);
    }
  }, [userId]);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name,
        preferences: { ...currentUser.preferences },
        contactInfo: { ...currentUser.contactInfo }
      });
    }
  }, [currentUser]);

  const handleSave = async () => {
    const result = await updateUser(userId, formData);
    if (result) {
      setIsEditing(false);
    }
  };

  if (loading) return <div>Loading user profile...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!currentUser) return <div>User not found</div>;

  return (
    <div className="user-profile">
      <div className="profile-header">
        <h2>{currentUser.name}</h2>
        <button onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {isEditing ? (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="form-group">
            <label>Name:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({
                ...formData,
                name: e.target.value
              })}
            />
          </div>

          <div className="form-group">
            <label>Theme:</label>
            <select
              value={formData.preferences?.theme || 'light'}
              onChange={(e) => setFormData({
                ...formData,
                preferences: {
                  ...formData.preferences,
                  theme: e.target.value
                }
              })}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className="form-group">
            <label>Phone:</label>
            <input
              type="tel"
              value={formData.contactInfo?.phone || ''}
              onChange={(e) => setFormData({
                ...formData,
                contactInfo: {
                  ...formData.contactInfo,
                  phone: e.target.value
                }
              })}
            />
          </div>

          <button type="submit">Save Changes</button>
        </form>
      ) : (
        <div className="profile-details">
          <p><strong>Email:</strong> {currentUser.email}</p>
          <p><strong>Role:</strong> {currentUser.role}</p>
          <p><strong>Department:</strong> {currentUser.department}</p>
          <p><strong>Job Title:</strong> {currentUser.jobTitle}</p>
          <p><strong>Theme:</strong> {currentUser.preferences?.theme}</p>
          <p><strong>Phone:</strong> {currentUser.contactInfo?.phone}</p>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
```

## 🧪 Testing the Integration

### Test Credentials
```javascript
const testCredentials = {
  email: 'bhardwick@aerotage.com',
  password: 'Aerotage*2025'
};
```

### Quick Test Script
```javascript
// Test script to verify API integration
const testUserManagement = async () => {
  try {
    // 1. Authenticate
    const user = await Auth.signIn(testCredentials.email, testCredentials.password);
    const session = await Auth.currentSession();
    const accessToken = session.getAccessToken().getJwtToken();

    console.log('✅ Authentication successful');

    // 2. Test list users
    const usersResponse = await fetch(`${API_BASE_URL}/users`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const usersResult = await usersResponse.json();
    
    if (usersResult.success) {
      console.log('✅ Users list:', usersResult.data.users.length, 'users found');
    } else {
      console.error('❌ Users list failed:', usersResult.error);
    }

    // 3. Test get current user
    const userInfo = await Auth.currentUserInfo();
    const currentUserResponse = await fetch(`${API_BASE_URL}/users/${userInfo.id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const currentUserResult = await currentUserResponse.json();
    
    if (currentUserResult.success) {
      console.log('✅ Current user profile loaded');
    } else {
      console.error('❌ Current user profile failed:', currentUserResult.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};
```

## 📚 Additional Resources

- **API Documentation**: Interactive Swagger UI available (check with backend team for URL)
- **OpenAPI Specification**: Complete API specification in `/docs/openapi.yaml`
- **Frontend Integration Guide**: `/docs/FRONTEND_INTEGRATION_GUIDE.md` for all phases
- **Troubleshooting**: `/docs/TROUBLESHOOTING.md` for common issues

## 🆘 Support

If you encounter issues:

1. **Check authentication** - Ensure you're using AccessToken, not IdToken
2. **Verify permissions** - Check user role and endpoint access requirements
3. **Review error responses** - API provides detailed error information
4. **Check CloudWatch logs** - Backend team can help with server-side debugging

For additional support, contact the backend development team with:
- Specific endpoint being called
- Request headers and body
- Complete error response
- User role and permissions

---

**Last Updated**: January 2024  
**API Version**: Development  
**Status**: ✅ Production Ready 