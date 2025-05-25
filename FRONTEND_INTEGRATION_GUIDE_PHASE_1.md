# Frontend Integration Guide - User Profile Settings API (Phase 1)

## 🚀 Overview

This guide provides complete integration instructions for the **Phase 1** user profile settings API that has been deployed to the development environment. Phase 1 includes user profile management and preferences management with full CRUD operations.

## 📍 Deployment Status

✅ **Successfully Deployed to Development Environment**
- API Gateway URL: `https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/`
- All Lambda functions deployed and operational
- DynamoDB tables created and configured
- Authentication via Cognito JWT tokens enabled

## 🔗 Available API Endpoints

### Phase 1 Endpoints (Ready for Integration)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `GET` | `/users/{userId}/profile` | Get user profile | ✅ Ready |
| `PUT` | `/users/{userId}/profile` | Update user profile | ✅ Ready |
| `GET` | `/users/{userId}/preferences` | Get user preferences | ✅ Ready |
| `PUT` | `/users/{userId}/preferences` | Update user preferences | ✅ Ready |

## 🔐 Authentication Requirements

### JWT Token Setup
All endpoints require authentication via Cognito JWT tokens in the Authorization header:

```typescript
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${jwtToken}`,
};
```

### Authorization Rules
- **Self-Access**: Users can access/modify their own profile and preferences
- **Admin Override**: Admin users can access any user's profile and preferences
- **Role-Based**: User role is determined from JWT token claims (`custom:role`)

## 📋 API Reference

### 1. User Profile Management

#### GET /users/{userId}/profile

**Purpose**: Retrieve complete user profile information

**Request**:
```typescript
const response = await fetch(`${API_BASE_URL}/users/${userId}/profile`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`,
  },
});
```

**Response Structure**:
```typescript
interface UserProfileResponse {
  success: true;
  data: {
    id: string;
    email: string;
    name: string;
    jobTitle?: string;
    department?: string;
    hourlyRate?: number;
    role: 'admin' | 'manager' | 'employee';
    contactInfo?: {
      phone?: string;
      address?: string;
      emergencyContact?: string;
    };
    profilePicture?: string; // S3 URL
    startDate: string; // ISO date
    lastLogin?: string; // ISO datetime
    isActive: boolean;
    teamId?: string;
    createdAt: string; // ISO datetime
    updatedAt: string; // ISO datetime
  };
}
```

**Example Usage**:
```typescript
// Get current user's profile
const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getJwtToken()}`,
      },
    });

    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      console.error('Profile fetch error:', data.error);
      return null;
    }
  } catch (error) {
    console.error('Network error:', error);
    return null;
  }
};
```

#### PUT /users/{userId}/profile

**Purpose**: Update user profile information

**Request Structure**:
```typescript
interface UpdateUserProfileRequest {
  name?: string;
  jobTitle?: string;
  department?: string;
  hourlyRate?: number; // Requires admin approval for non-admin users
  contactInfo?: {
    phone?: string;
    address?: string;
    emergencyContact?: string;
  };
}
```

**Request**:
```typescript
const updateData: UpdateUserProfileRequest = {
  name: "John Smith",
  jobTitle: "Senior Developer",
  department: "Engineering",
  contactInfo: {
    phone: "+1-555-0123",
    address: "123 Main St, City, State",
    emergencyContact: "Jane Smith - Wife - +1-555-0124"
  }
};

const response = await fetch(`${API_BASE_URL}/users/${userId}/profile`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`,
  },
  body: JSON.stringify(updateData),
});
```

**Response**: Updated profile object (same structure as GET)

**Example Usage**:
```typescript
const updateUserProfile = async (
  userId: string, 
  updates: UpdateUserProfileRequest
): Promise<UserProfile | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getJwtToken()}`,
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.error.message);
    }
  } catch (error) {
    console.error('Profile update error:', error);
    throw error;
  }
};
```

### 2. User Preferences Management

#### GET /users/{userId}/preferences

**Purpose**: Retrieve user application preferences (returns defaults if none exist)

**Request**:
```typescript
const response = await fetch(`${API_BASE_URL}/users/${userId}/preferences`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`,
  },
});
```

**Response Structure**:
```typescript
interface UserPreferencesResponse {
  success: true;
  data: {
    theme: 'light' | 'dark';
    notifications: boolean;
    timezone: string; // e.g., "America/New_York"
    timeTracking: {
      defaultTimeEntryDuration: number; // minutes
      autoStartTimer: boolean;
      showTimerInMenuBar: boolean;
      defaultBillableStatus: boolean;
      reminderInterval: number; // minutes, 0 = disabled
      workingHours: {
        start: string; // HH:MM format
        end: string; // HH:MM format
      };
      timeGoals: {
        daily: number; // hours
        weekly: number; // hours
        notifications: boolean;
      };
    };
    formatting: {
      currency: string; // e.g., "USD"
      dateFormat: string; // e.g., "MM/DD/YYYY"
      timeFormat: '12h' | '24h';
    };
    updatedAt: string; // ISO datetime
  };
}
```

**Default Values** (returned for new users):
```typescript
const DEFAULT_PREFERENCES = {
  theme: 'light',
  notifications: true,
  timezone: 'America/New_York',
  timeTracking: {
    defaultTimeEntryDuration: 60, // 1 hour
    autoStartTimer: false,
    showTimerInMenuBar: true,
    defaultBillableStatus: true,
    reminderInterval: 0, // disabled
    workingHours: {
      start: '09:00',
      end: '17:00',
    },
    timeGoals: {
      daily: 8.0,
      weekly: 40.0,
      notifications: true,
    },
  },
  formatting: {
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
  },
};
```

#### PUT /users/{userId}/preferences

**Purpose**: Update user preferences (supports partial updates)

**Request Structure**:
```typescript
interface UpdateUserPreferencesRequest {
  theme?: 'light' | 'dark';
  notifications?: boolean;
  timezone?: string;
  timeTracking?: {
    defaultTimeEntryDuration?: number;
    autoStartTimer?: boolean;
    showTimerInMenuBar?: boolean;
    defaultBillableStatus?: boolean;
    reminderInterval?: number;
    workingHours?: {
      start?: string;
      end?: string;
    };
    timeGoals?: {
      daily?: number;
      weekly?: number;
      notifications?: boolean;
    };
  };
  formatting?: {
    currency?: string;
    dateFormat?: string;
    timeFormat?: '12h' | '24h';
  };
}
```

**Example Usage**:
```typescript
// Update just the theme
const updateTheme = async (userId: string, theme: 'light' | 'dark') => {
  const updates: UpdateUserPreferencesRequest = { theme };
  
  const response = await fetch(`${API_BASE_URL}/users/${userId}/preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getJwtToken()}`,
    },
    body: JSON.stringify(updates),
  });
  
  return response.json();
};

// Update working hours
const updateWorkingHours = async (userId: string, start: string, end: string) => {
  const updates: UpdateUserPreferencesRequest = {
    timeTracking: {
      workingHours: { start, end }
    }
  };
  
  const response = await fetch(`${API_BASE_URL}/users/${userId}/preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getJwtToken()}`,
    },
    body: JSON.stringify(updates),
  });
  
  return response.json();
};
```

## 🛠️ Integration Implementation Guide

### 1. TypeScript Types

Add these types to your frontend codebase:

```typescript
// types/user-profile.ts
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  jobTitle?: string;
  department?: string;
  hourlyRate?: number;
  role: 'admin' | 'manager' | 'employee';
  contactInfo?: {
    phone?: string;
    address?: string;
    emergencyContact?: string;
  };
  profilePicture?: string;
  startDate: string;
  lastLogin?: string;
  isActive: boolean;
  teamId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  notifications: boolean;
  timezone: string;
  timeTracking: {
    defaultTimeEntryDuration: number;
    autoStartTimer: boolean;
    showTimerInMenuBar: boolean;
    defaultBillableStatus: boolean;
    reminderInterval: number;
    workingHours: {
      start: string;
      end: string;
    };
    timeGoals: {
      daily: number;
      weekly: number;
      notifications: boolean;
    };
  };
  formatting: {
    currency: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
  };
  updatedAt: string;
}

export interface UpdateUserProfileRequest {
  name?: string;
  jobTitle?: string;
  department?: string;
  hourlyRate?: number;
  contactInfo?: {
    phone?: string;
    address?: string;
    emergencyContact?: string;
  };
}

export interface UpdateUserPreferencesRequest {
  theme?: 'light' | 'dark';
  notifications?: boolean;
  timezone?: string;
  timeTracking?: {
    defaultTimeEntryDuration?: number;
    autoStartTimer?: boolean;
    showTimerInMenuBar?: boolean;
    defaultBillableStatus?: boolean;
    reminderInterval?: number;
    workingHours?: {
      start?: string;
      end?: string;
    };
    timeGoals?: {
      daily?: number;
      weekly?: number;
      notifications?: boolean;
    };
  };
  formatting?: {
    currency?: string;
    dateFormat?: string;
    timeFormat?: '12h' | '24h';
  };
}
```

### 2. API Service Layer

Create a service layer for API interactions:

```typescript
// services/profileApi.ts
import { UserProfile, UserPreferences, UpdateUserProfileRequest, UpdateUserPreferencesRequest } from '../types/user-profile';

const API_BASE_URL = 'https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev';

class ProfileApiService {
  private getAuthHeaders(): HeadersInit {
    const token = this.getJwtToken(); // Implement this based on your auth system
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  private getJwtToken(): string {
    // Implement based on your authentication system
    // This should return the current user's JWT token
    throw new Error('getJwtToken not implemented');
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/profile`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to fetch profile');
    }

    return data.data;
  }

  async updateUserProfile(userId: string, updates: UpdateUserProfileRequest): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/profile`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to update profile');
    }

    return data.data;
  }

  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/preferences`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to fetch preferences');
    }

    return data.data;
  }

  async updateUserPreferences(userId: string, updates: UpdateUserPreferencesRequest): Promise<UserPreferences> {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/preferences`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to update preferences');
    }

    return data.data;
  }
}

export const profileApi = new ProfileApiService();
```

### 3. React Hooks (Optional)

Create React hooks for easier integration:

```typescript
// hooks/useUserProfile.ts
import { useState, useEffect } from 'react';
import { UserProfile, UpdateUserProfileRequest } from '../types/user-profile';
import { profileApi } from '../services/profileApi';

export const useUserProfile = (userId: string) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const profileData = await profileApi.getUserProfile(userId);
        setProfile(profileData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  const updateProfile = async (updates: UpdateUserProfileRequest) => {
    try {
      setLoading(true);
      const updatedProfile = await profileApi.updateUserProfile(userId, updates);
      setProfile(updatedProfile);
      setError(null);
      return updatedProfile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Update failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    profile,
    loading,
    error,
    updateProfile,
    refetch: () => {
      if (userId) {
        const fetchProfile = async () => {
          try {
            setLoading(true);
            const profileData = await profileApi.getUserProfile(userId);
            setProfile(profileData);
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          } finally {
            setLoading(false);
          }
        };
        fetchProfile();
      }
    },
  };
};

// hooks/useUserPreferences.ts
import { useState, useEffect } from 'react';
import { UserPreferences, UpdateUserPreferencesRequest } from '../types/user-profile';
import { profileApi } from '../services/profileApi';

export const useUserPreferences = (userId: string) => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setLoading(true);
        const preferencesData = await profileApi.getUserPreferences(userId);
        setPreferences(preferencesData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setPreferences(null);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchPreferences();
    }
  }, [userId]);

  const updatePreferences = async (updates: UpdateUserPreferencesRequest) => {
    try {
      setLoading(true);
      const updatedPreferences = await profileApi.updateUserPreferences(userId, updates);
      setPreferences(updatedPreferences);
      setError(null);
      return updatedPreferences;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Update failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    refetch: () => {
      if (userId) {
        const fetchPreferences = async () => {
          try {
            setLoading(true);
            const preferencesData = await profileApi.getUserPreferences(userId);
            setPreferences(preferencesData);
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          } finally {
            setLoading(false);
          }
        };
        fetchPreferences();
      }
    },
  };
};
```

### 4. Example Component Usage

```typescript
// components/ProfileSettings.tsx
import React from 'react';
import { useUserProfile, useUserPreferences } from '../hooks';

interface ProfileSettingsProps {
  userId: string;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ userId }) => {
  const { profile, loading: profileLoading, updateProfile } = useUserProfile(userId);
  const { preferences, loading: preferencesLoading, updatePreferences } = useUserPreferences(userId);

  const handleNameUpdate = async (newName: string) => {
    try {
      await updateProfile({ name: newName });
      // Handle success (show toast, etc.)
    } catch (error) {
      // Handle error (show error message, etc.)
      console.error('Failed to update name:', error);
    }
  };

  const handleThemeChange = async (theme: 'light' | 'dark') => {
    try {
      await updatePreferences({ theme });
      // Handle success
    } catch (error) {
      // Handle error
      console.error('Failed to update theme:', error);
    }
  };

  if (profileLoading || preferencesLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h2>Profile Settings</h2>
      
      {/* Profile Information */}
      <div>
        <h3>Profile</h3>
        <p>Name: {profile?.name}</p>
        <p>Email: {profile?.email}</p>
        <p>Job Title: {profile?.jobTitle || 'Not set'}</p>
        {/* Add form inputs for editing */}
      </div>

      {/* Preferences */}
      <div>
        <h3>Preferences</h3>
        <p>Theme: {preferences?.theme}</p>
        <p>Timezone: {preferences?.timezone}</p>
        <p>Daily Goal: {preferences?.timeTracking.timeGoals.daily} hours</p>
        {/* Add form inputs for editing */}
      </div>
    </div>
  );
};

export default ProfileSettings;
```

## 🚨 Error Handling

### Standard Error Response Format

All endpoints return errors in this format:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `PROFILE_NOT_FOUND` | 404 | User profile not found |
| `UNAUTHORIZED_PROFILE_ACCESS` | 403 | User cannot access this profile |
| `INVALID_PROFILE_DATA` | 400 | Invalid input data |
| `INVALID_TIMEZONE` | 400 | Invalid timezone format |
| `INVALID_CURRENCY` | 400 | Invalid currency code |
| `INVALID_TIME_FORMAT` | 400 | Invalid time format |

### Error Handling Example

```typescript
const handleApiError = (error: any) => {
  if (error.response?.data?.error) {
    const { code, message } = error.response.data.error;
    
    switch (code) {
      case 'UNAUTHORIZED_PROFILE_ACCESS':
        // Handle permission error
        showErrorToast('You do not have permission to access this profile');
        break;
      case 'INVALID_PROFILE_DATA':
        // Handle validation error
        showErrorToast(`Invalid data: ${message}`);
        break;
      default:
        showErrorToast(message || 'An unexpected error occurred');
    }
  } else {
    showErrorToast('Network error. Please try again.');
  }
};
```

## ✅ Testing Checklist

### Profile Management Testing
- [ ] **Get Profile**: Test fetching user profile data
- [ ] **Update Profile**: Test updating various profile fields
- [ ] **Validation**: Test input validation for all fields
- [ ] **Authorization**: Test self-access vs admin access
- [ ] **Contact Info**: Test phone number validation
- [ ] **Hourly Rate**: Test admin-only hourly rate changes

### Preferences Testing
- [ ] **Get Preferences**: Test fetching preferences (including defaults)
- [ ] **Update Preferences**: Test partial preference updates
- [ ] **Theme**: Test theme switching
- [ ] **Time Tracking**: Test time tracking preferences
- [ ] **Working Hours**: Test working hours validation
- [ ] **Formatting**: Test currency and date format changes
- [ ] **Timezone**: Test timezone validation

### Error Handling Testing
- [ ] **401 Unauthorized**: Test invalid JWT tokens
- [ ] **403 Forbidden**: Test cross-user access prevention
- [ ] **404 Not Found**: Test accessing non-existent users
- [ ] **400 Bad Request**: Test invalid input data
- [ ] **Network Errors**: Test offline/network failure scenarios

## 🔧 Development Environment

### API Configuration
- **Development API URL**: `https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev`
- **Environment**: `dev`
- **Authentication**: Cognito JWT tokens required

### Cognito Configuration
Use these values for Cognito integration:
- **User Pool ID**: `us-east-1_EsdlgX9Qg`
- **App Client ID**: `148r35u6uultp1rmfdu22i8amb`
- **Region**: `us-east-1`

## 📋 Next Steps

### Immediate Actions
1. **Implement API Service**: Create the service layer with authentication
2. **Add Types**: Include TypeScript types in your project
3. **Test Endpoints**: Verify API connectivity and authentication
4. **Update UI**: Connect existing UI components to the API

### Phase 2 Preparation
The following endpoints are planned for Phase 2:
- Password change functionality
- Two-factor authentication
- Security settings management
- Session management

### Support & Questions
- Review the implementation status document for detailed progress tracking
- Check the Lambda function logs in CloudWatch for debugging
- Test API endpoints using the provided examples
- Contact the backend team for any clarification needed

---

## 🎯 Success Criteria

✅ **Profile Management**
- Users can view their complete profile information
- Users can update personal and professional details
- Admins can access other users' profiles
- Input validation works correctly

✅ **Preferences Management**
- Users receive sensible defaults for new accounts
- Partial preference updates work correctly
- Theme and formatting preferences are applied
- Time tracking preferences are saved properly

✅ **Security & Authorization**
- JWT authentication is enforced
- Users can only access their own data (unless admin)
- All input is properly validated
- Error responses are informative and consistent

This completes the Phase 1 integration requirements. The API is ready for frontend integration and testing! 