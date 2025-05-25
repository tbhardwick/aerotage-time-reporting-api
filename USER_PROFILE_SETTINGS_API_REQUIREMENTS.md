# User Profile & Settings Management - Backend API Requirements

## Overview

This document outlines the backend API requirements for the User Profile & Settings Management feature in the Aerotage Time Reporting Application. The frontend has been implemented with comprehensive UI components and state management, now requiring backend API endpoints to support profile management, preferences, security settings, and notifications.

## 🎯 Feature Scope

The Profile & Settings feature includes:

1. **Profile Management** - Personal and professional information
2. **Application Preferences** - UI, time tracking, and regional settings  
3. **Security Settings** - Password management, 2FA, session controls
4. **Notification Preferences** - Email, system, and timing configurations

## 📋 Current Implementation Status

### ✅ Frontend Completed
- React components for all settings sections
- Context integration for state management
- TypeScript interfaces for all form data
- Comprehensive validation and error handling
- Responsive UI with proper accessibility

### 🚧 Backend Required
All API endpoints and data persistence layers need implementation.

## 🔧 Required API Endpoints

### 1. User Profile Management

#### GET /api/users/{userId}/profile
**Purpose**: Retrieve user profile information  
**Authentication**: Required (user can only access own profile unless admin)

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "id": "string",
    "email": "string",
    "name": "string", 
    "jobTitle": "string",
    "department": "string",
    "hourlyRate": "number",
    "role": "admin|manager|employee",
    "contactInfo": {
      "phone": "string",
      "address": "string", 
      "emergencyContact": "string"
    },
    "profilePicture": "string", // URL
    "startDate": "string", // ISO date
    "lastLogin": "string", // ISO datetime
    "isActive": "boolean",
    "teamId": "string",
    "createdAt": "string", // ISO datetime
    "updatedAt": "string"  // ISO datetime
  }
}
```

#### PUT /api/users/{userId}/profile
**Purpose**: Update user profile information  
**Authentication**: Required (user can only update own profile unless admin)

**Request Body**:
```json
{
  "name": "string",
  "jobTitle": "string", 
  "department": "string",
  "hourlyRate": "number", // Optional, may require admin approval
  "contactInfo": {
    "phone": "string",
    "address": "string",
    "emergencyContact": "string"
  }
}
```

**Response**: Updated profile object (same structure as GET)

**Business Rules**:
- Email cannot be changed through this endpoint
- Role changes require admin privileges
- Hourly rate changes may require approval workflow
- Profile picture upload handled separately

#### POST /api/users/{userId}/profile/picture
**Purpose**: Upload profile picture  
**Authentication**: Required  
**Content-Type**: multipart/form-data

**Request**: File upload with image validation
**Response**:
```json
{
  "success": true,
  "data": {
    "profilePicture": "string" // New image URL
  }
}
```

### 2. User Preferences Management

#### GET /api/users/{userId}/preferences
**Purpose**: Retrieve user application preferences  
**Authentication**: Required

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "theme": "light|dark",
    "notifications": "boolean",
    "timezone": "string", // e.g., "America/New_York"
    "timeTracking": {
      "defaultTimeEntryDuration": "number", // minutes
      "autoStartTimer": "boolean",
      "showTimerInMenuBar": "boolean", 
      "defaultBillableStatus": "boolean",
      "reminderInterval": "number", // minutes, 0 = disabled
      "workingHours": {
        "start": "string", // HH:MM format
        "end": "string"    // HH:MM format
      },
      "timeGoals": {
        "daily": "number",  // hours
        "weekly": "number", // hours
        "notifications": "boolean"
      }
    },
    "formatting": {
      "currency": "string", // e.g., "USD"
      "dateFormat": "string", // e.g., "MM/DD/YYYY"
      "timeFormat": "12h|24h"
    },
    "updatedAt": "string" // ISO datetime
  }
}
```

#### PUT /api/users/{userId}/preferences
**Purpose**: Update user preferences  
**Authentication**: Required

**Request Body**: Same structure as GET response data (excluding updatedAt)
**Response**: Updated preferences object

### 3. Security Management

#### PUT /api/users/{userId}/password
**Purpose**: Change user password  
**Authentication**: Required

**Request Body**:
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

**Validation Requirements**:
- Minimum 8 characters
- Must contain letters, numbers, and symbols
- Current password verification required
- Password history check (prevent reuse of last 5 passwords)

#### GET /api/users/{userId}/security-settings
**Purpose**: Retrieve security configuration  
**Authentication**: Required

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "twoFactorEnabled": "boolean",
    "sessionTimeout": "number", // minutes
    "allowMultipleSessions": "boolean", 
    "passwordChangeRequired": "boolean",
    "passwordLastChanged": "string", // ISO datetime
    "passwordExpiresAt": "string", // ISO datetime, null if no expiry
    "securitySettings": {
      "requirePasswordChangeEvery": "number", // days, 0 = never
      "maxFailedLoginAttempts": "number",
      "accountLockoutDuration": "number" // minutes
    }
  }
}
```

#### PUT /api/users/{userId}/security-settings
**Purpose**: Update security settings  
**Authentication**: Required

**Request Body**:
```json
{
  "sessionTimeout": "number",
  "allowMultipleSessions": "boolean",
  "requirePasswordChangeEvery": "number"
}
```

#### POST /api/users/{userId}/two-factor/enable
**Purpose**: Initiate 2FA setup  
**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "qrCode": "string", // Base64 encoded QR code image
    "manualEntryKey": "string", // For manual app setup
    "backupCodes": ["string"] // Array of backup codes
  }
}
```

#### POST /api/users/{userId}/two-factor/verify
**Purpose**: Complete 2FA setup  
**Authentication**: Required

**Request Body**:
```json
{
  "verificationCode": "string" // 6-digit code from authenticator app
}
```

#### DELETE /api/users/{userId}/two-factor
**Purpose**: Disable 2FA  
**Authentication**: Required

**Request Body**:
```json
{
  "password": "string", // Current password for verification
  "verificationCode": "string" // Current 2FA code
}
```

#### GET /api/users/{userId}/sessions
**Purpose**: List active user sessions  
**Authentication**: Required

**Response Structure**:
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "ipAddress": "string",
      "userAgent": "string",
      "loginTime": "string", // ISO datetime
      "lastActivity": "string", // ISO datetime
      "isCurrent": "boolean",
      "location": {
        "city": "string",
        "country": "string"
      }
    }
  ]
}
```

#### DELETE /api/users/{userId}/sessions/{sessionId}
**Purpose**: Terminate a specific session  
**Authentication**: Required

### 4. Notification Preferences

#### GET /api/users/{userId}/notification-settings
**Purpose**: Retrieve notification preferences  
**Authentication**: Required

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "email": {
      "enabled": "boolean",
      "frequency": "immediate|daily|weekly|never"
    },
    "system": {
      "enabled": "boolean"
    },
    "timeTracking": {
      "timerReminders": "boolean",
      "reminderInterval": "number", // minutes
      "goalNotifications": "boolean"
    },
    "workEvents": {
      "timeEntrySubmissionReminders": "boolean",
      "approvalNotifications": "boolean", 
      "projectDeadlineReminders": "boolean",
      "overdueTaskNotifications": "boolean"
    },
    "billing": {
      "invoiceStatusUpdates": "boolean",
      "paymentReminders": "boolean"
    },
    "team": {
      "activityUpdates": "boolean",
      "invitationUpdates": "boolean"
    },
    "quietHours": {
      "enabled": "boolean",
      "start": "string", // HH:MM format
      "end": "string",   // HH:MM format
      "weekendsQuiet": "boolean"
    },
    "updatedAt": "string" // ISO datetime
  }
}
```

#### PUT /api/users/{userId}/notification-settings
**Purpose**: Update notification preferences  
**Authentication**: Required

**Request Body**: Same structure as GET response data (excluding updatedAt)
**Response**: Updated notification settings object

## 🗄️ Database Schema Updates

### Users Table Extensions
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Contact information (consider separate table for normalization)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255);
```

### New Tables Required

#### user_preferences
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(10) DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  notifications_enabled BOOLEAN DEFAULT true,
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Time tracking preferences
  default_time_entry_duration INTEGER DEFAULT 60, -- minutes
  auto_start_timer BOOLEAN DEFAULT false,
  show_timer_in_menu_bar BOOLEAN DEFAULT true,
  default_billable_status BOOLEAN DEFAULT true,
  timer_reminder_interval INTEGER DEFAULT 0, -- minutes, 0 = disabled
  working_hours_start TIME DEFAULT '09:00',
  working_hours_end TIME DEFAULT '17:00',
  daily_time_goal DECIMAL(4,2) DEFAULT 8.0, -- hours
  weekly_time_goal DECIMAL(5,2) DEFAULT 40.0, -- hours
  goal_notifications_enabled BOOLEAN DEFAULT true,
  
  -- Formatting preferences
  currency VARCHAR(3) DEFAULT 'USD',
  date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
  time_format VARCHAR(3) DEFAULT '12h' CHECK (time_format IN ('12h', '24h')),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
```

#### user_security_settings
```sql
CREATE TABLE user_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret VARCHAR(255), -- Encrypted
  session_timeout INTEGER DEFAULT 480, -- minutes
  allow_multiple_sessions BOOLEAN DEFAULT true,
  require_password_change_every INTEGER DEFAULT 0, -- days, 0 = never
  password_last_changed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  failed_login_attempts INTEGER DEFAULT 0,
  account_locked_until TIMESTAMP,
  backup_codes TEXT[], -- Encrypted array
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_user_security_user_id ON user_security_settings(user_id);
```

#### user_notification_settings
```sql
CREATE TABLE user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Email notifications
  email_enabled BOOLEAN DEFAULT true,
  email_frequency VARCHAR(20) DEFAULT 'daily' CHECK (email_frequency IN ('immediate', 'daily', 'weekly', 'never')),
  
  -- System notifications
  system_notifications_enabled BOOLEAN DEFAULT true,
  
  -- Time tracking notifications
  timer_reminders_enabled BOOLEAN DEFAULT true,
  timer_reminder_interval INTEGER DEFAULT 30, -- minutes
  goal_notifications_enabled BOOLEAN DEFAULT true,
  
  -- Work event notifications
  time_entry_submission_reminders BOOLEAN DEFAULT true,
  approval_notifications BOOLEAN DEFAULT true,
  project_deadline_reminders BOOLEAN DEFAULT true,
  overdue_task_notifications BOOLEAN DEFAULT true,
  
  -- Billing notifications
  invoice_status_updates BOOLEAN DEFAULT true,
  payment_reminders BOOLEAN DEFAULT true,
  
  -- Team notifications
  team_activity_updates BOOLEAN DEFAULT false,
  user_invitation_updates BOOLEAN DEFAULT true,
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '18:00',
  quiet_hours_end TIME DEFAULT '09:00',
  weekends_quiet BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_user_notification_user_id ON user_notification_settings(user_id);
```

#### user_sessions
```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  location_data JSONB, -- City, country, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active, expires_at);
```

#### password_history
```sql
CREATE TABLE password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL, -- Bcrypted
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_history_user_id ON password_history(user_id);
```

## 🔐 Security Requirements

### Authentication & Authorization
- All endpoints require valid JWT authentication
- Users can only access/modify their own profile and settings
- Admin users can access other users' profiles (read-only for sensitive data)
- Rate limiting on password change attempts (max 3 per hour)
- Account lockout after 5 failed login attempts

### Data Encryption
- Two-factor authentication secrets must be encrypted at rest
- Backup codes must be encrypted with user-specific keys
- Password history must use bcrypt with high salt rounds
- Profile pictures must be scanned for malware

### Input Validation
- All user inputs must be sanitized and validated
- File uploads limited to specific image types and sizes
- Timezone validation against standard timezone database
- Phone number format validation based on country codes

### Session Management
- JWT tokens should have reasonable expiration times
- Support for session invalidation across devices
- Track and limit concurrent sessions per user
- Automatic session cleanup for expired/inactive sessions

## 📧 Notification System Integration

### Email Templates Required
1. **Profile Update Confirmation** - Notify when profile changes are made
2. **Password Change Confirmation** - Security notification for password changes
3. **2FA Enabled/Disabled** - Security notifications for 2FA changes
4. **New Session Alert** - Notify when account accessed from new device/location
5. **Security Settings Changed** - Notify when security settings are modified

### Background Jobs
- **Session Cleanup** - Remove expired sessions (run every hour)
- **Notification Delivery** - Process queued notifications based on user preferences
- **Security Monitoring** - Detect suspicious activity patterns
- **Password Expiration Reminders** - Warn users before forced password changes

## 🚀 Implementation Priorities

### Phase 1: Core Profile Management (High Priority)
- [ ] Basic profile GET/PUT endpoints
- [ ] User preferences management
- [ ] Database schema creation
- [ ] Input validation and sanitization

### Phase 2: Security Features (High Priority)
- [ ] Password change functionality
- [ ] Basic security settings
- [ ] Session management
- [ ] Account lockout protection

### Phase 3: Advanced Security (Medium Priority)
- [ ] Two-factor authentication
- [ ] Active session management
- [ ] Password history tracking
- [ ] Security monitoring

### Phase 4: Enhanced Features (Low Priority)
- [ ] Profile picture upload
- [ ] Notification preferences
- [ ] Advanced session analytics
- [ ] Audit logging

## 🧪 Testing Requirements

### Unit Tests
- All API endpoints with various input scenarios
- Database operations and constraints
- Security validation functions
- Password hashing and verification

### Integration Tests
- End-to-end profile update workflows
- Security setting changes
- Email notification delivery
- Session management across devices

### Security Tests
- Authentication bypass attempts
- Authorization boundary testing
- Input injection attempts
- Rate limiting verification
- Session hijacking prevention

## 📋 Acceptance Criteria

### User Profile Management
- ✅ Users can view their complete profile information
- ✅ Users can update personal and professional details  
- ✅ Profile changes are validated and saved securely
- ✅ Users receive confirmation of profile updates
- ✅ Admin users can view other users' profiles (with restrictions)

### Security Management
- ✅ Users can change passwords with proper validation
- ✅ Two-factor authentication can be enabled/disabled
- ✅ Users can view and manage active sessions
- ✅ Security events are logged and monitored
- ✅ Account lockout prevents brute force attacks

### Application Preferences
- ✅ Users can customize UI theme and formatting
- ✅ Time tracking preferences are applied consistently
- ✅ Regional settings work correctly (timezone, currency)
- ✅ Preferences are preserved across sessions

### Notification Management
- ✅ Users can configure all notification types
- ✅ Quiet hours are respected for all notifications
- ✅ Email frequency settings are honored
- ✅ System notifications work on supported platforms

---

## 📞 Support & Documentation

For questions about implementation details or clarification on requirements, please:

1. Review the frontend components in `src/renderer/components/settings/`
2. Check the TypeScript interfaces for exact data structures
3. Test the frontend implementation for expected user workflows
4. Consult the project architecture documentation for integration patterns

This comprehensive backend implementation will complete the Profile & Settings management feature and provide users with full control over their account configuration and security settings. 