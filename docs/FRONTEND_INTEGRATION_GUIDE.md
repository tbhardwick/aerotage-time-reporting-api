# Frontend Integration Guide

## 🔗 **Aerotage Time Reporting API - Frontend Integration Guide**

This guide provides comprehensive instructions for integrating the frontend Electron application with the Aerotage Time Reporting API backend.

## 📋 **Prerequisites**

### **Backend Requirements**
- ✅ Backend infrastructure deployed and operational
- ✅ API Gateway URL available
- ✅ Cognito User Pool configured
- ✅ All required Lambda functions deployed

### **Frontend Requirements**
- Electron desktop application (`aerotage_time_reporting_app` repository)
- React/TypeScript frontend framework
- AWS Amplify or AWS SDK for authentication
- HTTP client (fetch, axios, etc.)

---

## 🔧 **Configuration Setup**

### **1. Backend Configuration Values**

Update your frontend configuration with these current values:

```typescript
// src/config/aws-config.ts
export const awsConfig = {
  // API Configuration
  apiBaseUrl: 'https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev//',
  
  // AWS Cognito Configuration
  Auth: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_EsdlgX9Qg',
    userPoolWebClientId: '148r35u6uultp1rmfdu22i8amb',
    identityPoolId: 'us-east-1:d79776bb-4b8e-4654-a10a-a45b1adaa787',
    
    // Authentication flow settings
    authenticationFlowType: 'USER_SRP_AUTH',
    
    // Password policy (for validation)
    passwordPolicy: {
      minimumLength: 8,
      requireLowercase: true,
      requireUppercase: true,
      requireNumbers: true,
      requireSymbols: false
    }
  }
};
```

### **2. Environment Variables**

```bash
# .env.development
REACT_APP_API_BASE_URL=https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev//
REACT_APP_AWS_REGION=us-east-1
REACT_APP_USER_POOL_ID=us-east-1_EsdlgX9Qg
REACT_APP_USER_POOL_WEB_CLIENT_ID=148r35u6uultp1rmfdu22i8amb
REACT_APP_IDENTITY_POOL_ID=us-east-1:d79776bb-4b8e-4654-a10a-a45b1adaa787

# .env.production (when ready)
REACT_APP_API_BASE_URL=https://[production-url]/prod/
# ... other production values
```

---

## 🔐 **Authentication Integration**

### **1. AWS Amplify Setup**

```typescript
// src/config/amplify-config.ts
import { Amplify } from 'aws-amplify';
import { awsConfig } from './aws-config';

Amplify.configure({
  Auth: awsConfig.Auth
});

export default Amplify;
```

### **2. Authentication Service**

```typescript
// src/services/auth-service.ts
import { Auth } from 'aws-amplify';
import { apiClient } from './api-client';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  groups: string[];
}

class AuthService {
  // Login with session creation
  async login(credentials: LoginCredentials): Promise<{ user: User; session: any }> {
    try {
      // Step 1: Authenticate with Cognito
      const cognitoUser = await Auth.signIn(credentials.email, credentials.password);
      
      // Step 2: Get JWT token and user info
      const session = await Auth.currentSession();
      const accessToken = session.getIdToken().getJwtToken();
      const userInfo = await Auth.currentUserInfo();
      
      // Step 3: Create backend session record
      const backendSession = await this.createBackendSession(userInfo.id, accessToken);
      
      // Step 4: Store session info
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('userId', userInfo.id);
      localStorage.setItem('sessionId', backendSession.id);
      
      return {
        user: {
          id: userInfo.id,
          email: userInfo.attributes.email,
          name: userInfo.attributes.name || userInfo.attributes.email,
          role: userInfo.attributes['custom:role'] || 'employee',
          groups: userInfo.signInUserSession?.idToken?.payload['cognito:groups'] || []
        },
        session: backendSession
      };
    } catch (error) {
      console.error('Login failed:', error);
      throw this.handleAuthError(error);
    }
  }

  // Create backend session record
  private async createBackendSession(userId: string, accessToken: string) {
    try {
      const response = await fetch(`${awsConfig.apiBaseUrl}users/${userId}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          userAgent: navigator.userAgent,
          loginTime: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Session creation failed: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Backend session creation failed:', error);
      // Don't fail login if session creation fails
      return { id: 'temp-session' };
    }
  }

  // Logout with session cleanup
  async logout(): Promise<void> {
    try {
      const userId = localStorage.getItem('userId');
      const sessionId = localStorage.getItem('sessionId');
      const accessToken = localStorage.getItem('accessToken');

      // Terminate backend session if available
      if (userId && sessionId && accessToken && sessionId !== 'temp-session') {
        try {
          await fetch(`${awsConfig.apiBaseUrl}users/${userId}/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
        } catch (error) {
          console.warn('Backend session termination failed:', error);
        }
      }

      // Sign out from Cognito
      await Auth.signOut();
      
      // Clear local storage
      localStorage.clear();
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear local storage even if logout fails
      localStorage.clear();
      throw error;
    }
  }

  // Password reset
  async resetPassword(email: string): Promise<void> {
    try {
      await Auth.forgotPassword(email);
    } catch (error) {
      // Don't reveal whether user exists (security feature)
      console.log('Password reset requested for:', email);
    }
  }

  // Confirm password reset
  async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
    try {
      await Auth.forgotPasswordSubmit(email, code, newPassword);
    } catch (error) {
      console.error('Password reset confirmation failed:', error);
      throw this.handleAuthError(error);
    }
  }

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    try {
      const userInfo = await Auth.currentUserInfo();
      if (!userInfo) return null;

      return {
        id: userInfo.id,
        email: userInfo.attributes.email,
        name: userInfo.attributes.name || userInfo.attributes.email,
        role: userInfo.attributes['custom:role'] || 'employee',
        groups: userInfo.signInUserSession?.idToken?.payload['cognito:groups'] || []
      };
    } catch (error) {
      return null;
    }
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      await Auth.currentSession();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Handle authentication errors
  private handleAuthError(error: any): Error {
    switch (error.code) {
      case 'UserNotConfirmedException':
        return new Error('Please verify your email address before logging in.');
      case 'NotAuthorizedException':
        return new Error('Invalid email or password.');
      case 'UserNotFoundException':
        return new Error('Invalid email or password.');
      case 'InvalidPasswordException':
        return new Error('Password does not meet requirements.');
      case 'CodeExpiredException':
        return new Error('Reset code has expired. Please request a new one.');
      case 'InvalidParameterException':
        return new Error('Invalid input. Please check your information.');
      default:
        return new Error(error.message || 'Authentication failed.');
    }
  }
}

export const authService = new AuthService();
```

### **3. Session Migration Handling**

```typescript
// src/services/session-migration.ts
export const handleSessionMigration = (error: any) => {
  if (error.response?.status === 401 && 
      error.response?.data?.code === 'SESSION_MIGRATION_REQUIRED') {
    // Clear local storage and force re-login
    localStorage.clear();
    
    // Show user-friendly message
    alert('Your session needs to be updated. Please log in again.');
    
    // Redirect to login page
    window.location.href = '/login';
    return true;
  }
  return false;
};

// Add to your HTTP interceptor
axios.interceptors.response.use(
  response => response,
  error => {
    if (handleSessionMigration(error)) {
      return Promise.resolve(); // Prevent error propagation
    }
    return Promise.reject(error);
  }
);
```

---

## 📡 **API Client Implementation**

### **1. Base API Client**

```typescript
// src/services/api-client.ts
import { awsConfig } from '../config/aws-config';
import { handleSessionMigration } from './session-migration';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = awsConfig.apiBaseUrl;
  }

  // Generic request method
  private async request<T>(
    method: string,
    endpoint: string,
    options: {
      body?: any;
      headers?: Record<string, string>;
      requireAuth?: boolean;
    } = {}
  ): Promise<T> {
    const { body, headers = {}, requireAuth = true } = options;

    // Add authentication header
    if (requireAuth) {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No authentication token available');
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Set content type for JSON requests
    if (body && typeof body === 'object') {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      // Handle session migration
      if (response.status === 401 && data.code === 'SESSION_MIGRATION_REQUIRED') {
        handleSessionMigration({ response: { status: 401, data } });
        throw new Error('Session migration required');
      }

      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      return data.data;
    } catch (error) {
      console.error(`API request failed: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  // HTTP method helpers
  async get<T>(endpoint: string, requireAuth = true): Promise<T> {
    return this.request<T>('GET', endpoint, { requireAuth });
  }

  async post<T>(endpoint: string, body?: any, requireAuth = true): Promise<T> {
    return this.request<T>('POST', endpoint, { body, requireAuth });
  }

  async put<T>(endpoint: string, body?: any, requireAuth = true): Promise<T> {
    return this.request<T>('PUT', endpoint, { body, requireAuth });
  }

  async delete<T>(endpoint: string, requireAuth = true): Promise<T> {
    return this.request<T>('DELETE', endpoint, { requireAuth });
  }
}

export const apiClient = new ApiClient();
```

### **2. User Management API**

```typescript
// src/services/user-api.ts
import { apiClient } from './api-client';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  jobTitle?: string;
  department?: string;
  hourlyRate?: number;
  timezone?: string;
  profilePicture?: string;
  bio?: string;
  skills?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  timezone: string;
  notifications: {
    email: boolean;
    desktop: boolean;
    mobile: boolean;
    weeklyReports: boolean;
    projectUpdates: boolean;
    teamMessages: boolean;
  };
  dashboard: {
    defaultView: string;
    showWeekends: boolean;
    autoStartTimer: boolean;
    reminderInterval: number;
  };
}

export interface UpdateProfileRequest {
  name?: string;
  jobTitle?: string;
  department?: string;
  hourlyRate?: number;
  timezone?: string;
  bio?: string;
  skills?: string[];
}

export interface UpdatePreferencesRequest {
  theme?: 'light' | 'dark';
  notifications?: Partial<UserPreferences['notifications']>;
  dashboard?: Partial<UserPreferences['dashboard']>;
}

class UserApi {
  // Get user profile
  async getUserProfile(userId: string): Promise<UserProfile> {
    return apiClient.get<UserProfile>(`users/${userId}/profile`);
  }

  // Update user profile
  async updateUserProfile(userId: string, updates: UpdateProfileRequest): Promise<UserProfile> {
    return apiClient.put<UserProfile>(`users/${userId}/profile`, updates);
  }

  // Get user preferences
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    return apiClient.get<UserPreferences>(`users/${userId}/preferences`);
  }

  // Update user preferences
  async updateUserPreferences(userId: string, updates: UpdatePreferencesRequest): Promise<UserPreferences> {
    return apiClient.put<UserPreferences>(`users/${userId}/preferences`, updates);
  }

  // List all users (admin only)
  async listUsers(): Promise<UserProfile[]> {
    return apiClient.get<UserProfile[]>('users');
  }
}

export const userApi = new UserApi();
```

### **3. Security API**

```typescript
// src/services/security-api.ts
import { apiClient } from './api-client';

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  allowMultipleSessions: boolean;
  passwordChangeRequired: boolean;
  passwordLastChanged: string;
  passwordExpiresAt?: string;
  securitySettings: {
    requirePasswordChangeEvery: number;
    maxFailedLoginAttempts: number;
    accountLockoutDuration: number;
  };
}

export interface UpdateSecuritySettingsRequest {
  sessionTimeout?: number;
  allowMultipleSessions?: boolean;
  requirePasswordChangeEvery?: number;
}

class SecurityApi {
  // Change password
  async changePassword(userId: string, request: ChangePasswordRequest): Promise<void> {
    return apiClient.put(`users/${userId}/password`, request);
  }

  // Get security settings
  async getSecuritySettings(userId: string): Promise<SecuritySettings> {
    return apiClient.get<SecuritySettings>(`users/${userId}/security-settings`);
  }

  // Update security settings
  async updateSecuritySettings(userId: string, updates: UpdateSecuritySettingsRequest): Promise<SecuritySettings> {
    return apiClient.put<SecuritySettings>(`users/${userId}/security-settings`, updates);
  }
}

export const securityApi = new SecurityApi();
```

### **4. Session Management API**

```typescript
// src/services/session-api.ts
import { apiClient } from './api-client';

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

export interface CreateSessionRequest {
  userAgent: string;
  loginTime: string;
}

class SessionApi {
  // List user sessions
  async getUserSessions(userId: string): Promise<UserSession[]> {
    return apiClient.get<UserSession[]>(`users/${userId}/sessions`);
  }

  // Create session record
  async createSession(userId: string, request?: Partial<CreateSessionRequest>): Promise<UserSession> {
    const sessionData = {
      userAgent: request?.userAgent || navigator.userAgent,
      loginTime: request?.loginTime || new Date().toISOString()
    };
    return apiClient.post<UserSession>(`users/${userId}/sessions`, sessionData);
  }

  // Terminate session
  async terminateSession(userId: string, sessionId: string): Promise<void> {
    return apiClient.delete(`users/${userId}/sessions/${sessionId}`);
  }
}

export const sessionApi = new SessionApi();
```

### **5. User Invitations API**

```typescript
// src/services/invitation-api.ts
import { apiClient } from './api-client';

export interface UserInvitation {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  teamId?: string;
  department?: string;
  jobTitle?: string;
  hourlyRate?: number;
  permissions?: {
    features: string[];
    projects: string[];
  };
  personalMessage?: string;
  invitationToken?: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: string;
}

export interface CreateInvitationRequest {
  email: string;
  role: 'admin' | 'manager' | 'employee';
  teamId?: string;
  department?: string;
  jobTitle?: string;
  hourlyRate?: number;
  permissions?: {
    features: string[];
    projects: string[];
  };
  personalMessage?: string;
}

export interface ResendInvitationRequest {
  extendExpiration?: boolean;
  personalMessage?: string;
}

export interface AcceptInvitationRequest {
  token: string;
  userData: {
    name: string;
    password: string;
    preferences?: {
      theme?: 'light' | 'dark';
      notifications?: boolean;
      timezone?: string;
    };
  };
}

export interface InvitationFilters {
  status?: 'pending' | 'accepted' | 'expired' | 'cancelled';
  limit?: number;
  offset?: number;
}

class InvitationApi {
  // List invitations
  async listInvitations(filters?: InvitationFilters): Promise<UserInvitation[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<UserInvitation[]>(`user-invitations${query}`);
  }

  // Create invitation
  async createInvitation(request: CreateInvitationRequest): Promise<UserInvitation> {
    return apiClient.post<UserInvitation>('user-invitations', request);
  }

  // Resend invitation
  async resendInvitation(id: string, request?: ResendInvitationRequest): Promise<UserInvitation> {
    return apiClient.post<UserInvitation>(`user-invitations/${id}/resend`, request);
  }

  // Cancel invitation
  async cancelInvitation(id: string): Promise<void> {
    return apiClient.delete(`user-invitations/${id}`);
  }

  // Validate invitation token (public)
  async validateInvitationToken(token: string): Promise<{ valid: boolean; invitation?: any }> {
    return apiClient.get(`user-invitations/validate/${token}`, false);
  }

  // Accept invitation (public)
  async acceptInvitation(request: AcceptInvitationRequest): Promise<void> {
    return apiClient.post('user-invitations/accept', request, false);
  }
}

export const invitationApi = new InvitationApi();
```

---

## 🎨 **React Context Integration**

### **1. Authentication Context**

```typescript
// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, User } from '../services/auth-service';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { user: loggedInUser } = await authService.login({ email, password });
      setUser(loggedInUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    await authService.resetPassword(email);
  };

  const confirmPasswordReset = async (email: string, code: string, newPassword: string) => {
    await authService.confirmPasswordReset(email, code, newPassword);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    resetPassword,
    confirmPasswordReset,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

### **2. User Data Context**

```typescript
// src/contexts/UserContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { userApi, UserProfile, UserPreferences } from '../services/user-api';

interface UserContextType {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  isLoading: boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserData();
    } else {
      setProfile(null);
      setPreferences(null);
    }
  }, [isAuthenticated, user]);

  const loadUserData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const [userProfile, userPreferences] = await Promise.all([
        userApi.getUserProfile(user.id),
        userApi.getUserPreferences(user.id)
      ]);
      setProfile(userProfile);
      setPreferences(userPreferences);
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    
    try {
      const updatedProfile = await userApi.updateUserProfile(user.id, updates);
      setProfile(updatedProfile);
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!user) return;
    
    try {
      const updatedPreferences = await userApi.updateUserPreferences(user.id, updates);
      setPreferences(updatedPreferences);
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    }
  };

  const refreshUserData = async () => {
    await loadUserData();
  };

  const value: UserContextType = {
    profile,
    preferences,
    isLoading,
    updateProfile,
    updatePreferences,
    refreshUserData,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
```

---

## 🧩 **Component Examples**

### **1. Login Component**

```typescript
// src/components/LoginForm.tsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const LoginForm: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email">Email:</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      
      <div>
        <label htmlFor="password">Password:</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <div className="error">{error}</div>}

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};
```

### **2. Session Management Component**

```typescript
// src/components/SessionManager.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { sessionApi, UserSession } from '../services/session-api';

export const SessionManager: React.FC = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;
    
    try {
      const userSessions = await sessionApi.getUserSessions(user.id);
      setSessions(userSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    if (!user) return;
    
    try {
      await sessionApi.terminateSession(user.id, sessionId);
      await loadSessions(); // Refresh list
    } catch (error) {
      console.error('Failed to terminate session:', error);
    }
  };

  if (isLoading) return <div>Loading sessions...</div>;

  return (
    <div>
      <h3>Active Sessions</h3>
      {sessions.map((session) => (
        <div key={session.id} className={`session ${session.isCurrent ? 'current' : ''}`}>
          <div>
            <strong>{session.isCurrent ? 'Current Session' : 'Other Session'}</strong>
          </div>
          <div>IP: {session.ipAddress}</div>
          <div>Login: {new Date(session.loginTime).toLocaleString()}</div>
          <div>Last Activity: {new Date(session.lastActivity).toLocaleString()}</div>
          {session.location && (
            <div>Location: {session.location.city}, {session.location.country}</div>
          )}
          {!session.isCurrent && (
            <button onClick={() => terminateSession(session.id)}>
              Terminate Session
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
```

---

## 🚨 **Error Handling**

### **1. Global Error Handler**

```typescript
// src/utils/error-handler.ts
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export const handleApiError = (error: any): string => {
  // Handle session migration
  if (error.response?.status === 401 && 
      error.response?.data?.code === 'SESSION_MIGRATION_REQUIRED') {
    return 'Your session needs to be updated. Please log in again.';
  }

  // Handle common API errors
  switch (error.response?.data?.code) {
    case 'VALIDATION_ERROR':
      return `Invalid input: ${error.response.data.details?.reason || error.response.data.message}`;
    case 'UNAUTHORIZED':
      return 'You are not authorized to perform this action.';
    case 'FORBIDDEN':
      return 'You do not have permission to access this resource.';
    case 'NOT_FOUND':
      return 'The requested resource was not found.';
    case 'DUPLICATE_RESOURCE':
      return 'This resource already exists.';
    case 'ACCOUNT_LOCKED':
      return 'Your account has been locked due to too many failed login attempts.';
    case 'PASSWORD_POLICY_VIOLATION':
      return 'Password does not meet security requirements.';
    case 'RATE_LIMIT_EXCEEDED':
      return 'Too many requests. Please try again later.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
};
```

### **2. Error Boundary Component**

```typescript
// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We're sorry, but something unexpected happened.</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 🧪 **Testing Integration**

### **1. API Service Tests**

```typescript
// src/services/__tests__/auth-service.test.ts
import { authService } from '../auth-service';
import { Auth } from 'aws-amplify';

jest.mock('aws-amplify');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('login should authenticate and create session', async () => {
    const mockUser = {
      id: 'user-123',
      attributes: {
        email: 'test@example.com',
        name: 'Test User'
      }
    };

    (Auth.signIn as jest.Mock).mockResolvedValue(mockUser);
    (Auth.currentSession as jest.Mock).mockResolvedValue({
      getIdToken: () => ({ getJwtToken: () => 'mock-token' })
    });
    (Auth.currentUserInfo as jest.Mock).mockResolvedValue(mockUser);

    // Mock fetch for session creation
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: { id: 'session-123' }
      })
    });

    const result = await authService.login({
      email: 'test@example.com',
      password: 'password'
    });

    expect(result.user.email).toBe('test@example.com');
    expect(localStorage.getItem('accessToken')).toBe('mock-token');
  });
});
```

---

## 📋 **Integration Checklist**

### **✅ Authentication Setup**
- [ ] AWS Amplify configured with correct Cognito settings
- [ ] Login/logout functionality implemented
- [ ] Session creation after Cognito authentication
- [ ] Password reset flow implemented
- [ ] Error handling for authentication failures

### **✅ API Integration**
- [ ] Base API client with authentication headers
- [ ] User profile management endpoints
- [ ] User preferences endpoints
- [ ] Security settings endpoints
- [ ] Session management endpoints
- [ ] User invitation endpoints

### **✅ State Management**
- [ ] Authentication context implemented
- [ ] User data context implemented
- [ ] Session migration handling
- [ ] Error state management

### **✅ UI Components**
- [ ] Login/logout forms
- [ ] User profile management
- [ ] Security settings interface
- [ ] Session management interface
- [ ] User invitation management

### **✅ Error Handling**
- [ ] Global error handler
- [ ] API error mapping
- [ ] User-friendly error messages
- [ ] Session migration handling

### **✅ Testing**
- [ ] Unit tests for API services
- [ ] Integration tests for authentication flow
- [ ] Component testing with mocked APIs
- [ ] End-to-end testing

---

## 🚀 **Next Steps**

1. **Implement Authentication**: Start with login/logout functionality
2. **Add User Management**: Profile and preferences management
3. **Implement Security Features**: Password change and security settings
4. **Add Session Management**: Multi-session tracking and control
5. **Implement Invitations**: User invitation management interface
6. **Testing**: Comprehensive testing of all integrations
7. **Production Deployment**: Deploy frontend with backend integration

This guide provides a complete foundation for integrating the frontend with the Aerotage Time Reporting API backend. All the necessary code examples, patterns, and best practices are included to ensure a smooth integration process. 