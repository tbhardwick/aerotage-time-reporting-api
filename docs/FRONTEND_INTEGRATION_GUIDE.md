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
  apiBaseUrl: 'https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev/',
  
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
REACT_APP_API_BASE_URL=https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev/
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
      const accessToken = localStorage.getItem('accessToken');

      // Call backend logout endpoint for complete session cleanup
      if (accessToken) {
        try {
          await fetch(`${awsConfig.apiBaseUrl}logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
          });
        } catch (error) {
          console.warn('Backend logout failed:', error);
          // Continue with Cognito logout even if backend fails
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

### **2. User Management API** ✅ **Phase 1-3 - COMPLETE**

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

### **3. Security API** ✅ **Phase 1-3 - COMPLETE**

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

### **4. Session Management API** ✅ **Phase 1-3 - COMPLETE**

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

  // Terminate specific session (deletes from database)
  async terminateSession(userId: string, sessionId: string): Promise<void> {
    return apiClient.delete(`users/${userId}/sessions/${sessionId}`);
  }

  // Complete logout with session cleanup
  async logout(): Promise<{ message: string; sessionId?: string }> {
    return apiClient.post('logout', {});
  }
}

export const sessionApi = new SessionApi();
```

### **5. User Invitations API** ✅ **Phase 1-3 - COMPLETE**

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

### **6. Project Management API** ✅ **Phase 5 - COMPLETE**

```typescript
// src/services/project-api.ts
import { apiClient } from './api-client';

export interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  defaultHourlyRate: number;
  defaultBillable: boolean;
  budget?: {
    type: 'hours' | 'fixed';
    value: number;
    spent: number;
  };
  deadline?: string;
  teamMembers: Array<{
    userId: string;
    name?: string;
    role: string;
  }>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateProjectRequest {
  name: string;
  clientId: string;
  clientName: string;
  description?: string;
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
  defaultHourlyRate?: number;
  defaultBillable?: boolean;
  budget?: {
    type: 'hours' | 'fixed';
    value: number;
    spent?: number;
  };
  deadline?: string;
  teamMembers?: Array<{
    userId: string;
    role: string;
  }>;
  tags?: string[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
  defaultHourlyRate?: number;
  defaultBillable?: boolean;
  budget?: {
    type: 'hours' | 'fixed';
    value: number;
    spent: number;
  };
  deadline?: string;
  teamMembers?: Array<{
    userId: string;
    role: string;
  }>;
  tags?: string[];
}

export interface ProjectFilters {
  clientId?: string;
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
  limit?: number;
  offset?: number;
}

class ProjectApi {
  // List projects
  async listProjects(filters?: ProjectFilters): Promise<{ projects: Project[]; pagination: any }> {
    const params = new URLSearchParams();
    if (filters?.clientId) params.append('clientId', filters.clientId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ projects: Project[]; pagination: any }>(`projects${query}`);
  }

  // Create project
  async createProject(request: CreateProjectRequest): Promise<Project> {
    return apiClient.post<Project>('projects', request);
  }

  // Update project
  async updateProject(id: string, updates: UpdateProjectRequest): Promise<Project> {
    return apiClient.put<Project>(`projects/${id}`, updates);
  }

  // Delete project
  async deleteProject(id: string): Promise<void> {
    return apiClient.delete(`projects/${id}`);
  }
}

export const projectApi = new ProjectApi();
```

### **7. Client Management API** ✅ **Phase 5 - COMPLETE**

```typescript
// src/services/client-api.ts
import { apiClient } from './api-client';

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  defaultHourlyRate?: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateClientRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  defaultHourlyRate?: number;
  notes?: string;
}

export interface UpdateClientRequest {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  defaultHourlyRate?: number;
  notes?: string;
}

export interface ClientFilters {
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

class ClientApi {
  // List clients
  async listClients(filters?: ClientFilters): Promise<{ clients: Client[]; pagination: any }> {
    const params = new URLSearchParams();
    if (filters?.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ clients: Client[]; pagination: any }>(`clients${query}`);
  }

  // Create client
  async createClient(request: CreateClientRequest): Promise<Client> {
    return apiClient.post<Client>('clients', request);
  }

  // Update client
  async updateClient(id: string, updates: UpdateClientRequest): Promise<Client> {
    return apiClient.put<Client>(`clients/${id}`, updates);
  }

  // Delete client (soft delete)
  async deleteClient(id: string): Promise<void> {
    return apiClient.delete(`clients/${id}`);
  }
}

export const clientApi = new ClientApi();
```

### **8. Reporting & Analytics API** ✅ **Phase 6 - COMPLETE**

```typescript
// src/services/reporting-api.ts
import { apiClient } from './api-client';

export interface TimeReport {
  summary: {
    totalHours: number;
    totalRevenue: number;
    billableHours: number;
    nonBillableHours: number;
    averageHourlyRate: number;
  };
  groupedData: Array<{
    groupKey: string;
    totalHours: number;
    totalRevenue: number;
    entries: TimeEntry[];
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ProjectReport {
  summary: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalRevenue: number;
    averageProjectValue: number;
  };
  projects: Array<{
    id: string;
    name: string;
    client: string;
    status: string;
    totalHours: number;
    totalRevenue: number;
    budgetUtilization: number;
    teamSize: number;
    completionPercentage: number;
  }>;
}

export interface ClientReport {
  summary: {
    totalClients: number;
    activeClients: number;
    totalRevenue: number;
    averageClientValue: number;
  };
  clients: Array<{
    id: string;
    name: string;
    totalProjects: number;
    totalHours: number;
    totalRevenue: number;
    lastActivity: string;
    invoicesPaid: number;
    invoicesOverdue: number;
  }>;
}

export interface DashboardWidget {
  type: 'metric' | 'chart' | 'table' | 'progress';
  title: string;
  size: 'small' | 'medium' | 'large';
  config: {
    metric?: string;
    chartType?: 'line' | 'bar' | 'pie' | 'doughnut';
    timeframe?: string;
    filters?: Record<string, any>;
  };
}

export interface EnhancedDashboard {
  widgets: Array<{
    id: string;
    type: string;
    title: string;
    data: any;
    config: DashboardWidget['config'];
  }>;
  kpis: {
    totalRevenue: number;
    totalHours: number;
    activeProjects: number;
    utilizationRate: number;
  };
  trends: {
    revenue: Array<{ date: string; value: number }>;
    hours: Array<{ date: string; value: number }>;
    projects: Array<{ date: string; value: number }>;
  };
  forecasting?: {
    revenueProjection: number;
    hoursProjection: number;
    confidenceLevel: number;
  };
}

export interface RealTimeAnalytics {
  activeUsers: number;
  currentSessions: number;
  todayHours: number;
  todayRevenue: number;
  liveTimers: number;
  recentActivities: Array<{
    userId: string;
    userName: string;
    action: string;
    timestamp: string;
    details: string;
  }>;
  systemAlerts: Array<{
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

export interface PerformanceMonitoring {
  system: {
    apiResponseTime: number;
    databaseLatency: number;
    errorRate: number;
    uptime: number;
  };
  recommendations: Array<{
    category: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
    action: string;
  }>;
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
    timestamp: string;
  }>;
}

export interface ReportFilters {
  startDate: string;
  endDate: string;
  groupBy?: 'date' | 'week' | 'month' | 'project' | 'user' | 'client';
  includeDetails?: boolean;
  filters?: {
    userId?: string;
    projectId?: string;
    clientId?: string;
    billable?: boolean;
    status?: string;
  };
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ScheduleConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM format
  timezone: string;
}

export interface DeliveryConfig {
  email: {
    recipients: string[];
    subject: string;
    message?: string;
  };
  format: 'pdf' | 'csv' | 'excel';
  includeCharts: boolean;
}

class ReportingApi {
  // Generate time tracking reports
  async generateTimeReport(filters: ReportFilters): Promise<TimeReport> {
    return apiClient.post<TimeReport>('reports/time', filters);
  }

  // Generate project performance reports
  async generateProjectReport(filters: {
    startDate: string;
    endDate: string;
    includeFinancials?: boolean;
    includeTeamMetrics?: boolean;
    groupBy?: string;
    filters?: {
      projectId?: string;
      clientId?: string;
      status?: string;
      managerId?: string;
    };
  }): Promise<ProjectReport> {
    return apiClient.post<ProjectReport>('reports/projects', filters);
  }

  // Generate client reports
  async generateClientReport(filters: {
    startDate: string;
    endDate: string;
    includeBilling?: boolean;
    includeActivity?: boolean;
    includeInvoices?: boolean;
    filters?: {
      clientId?: string;
      isActive?: boolean;
      minRevenue?: number;
    };
  }): Promise<ClientReport> {
    return apiClient.post<ClientReport>('reports/clients', filters);
  }

  // Export reports in various formats
  async exportReport(data: {
    reportData: any;
    format: 'pdf' | 'csv' | 'excel';
    options?: {
      includeCharts?: boolean;
      includeRawData?: boolean;
      orientation?: 'portrait' | 'landscape';
      pageSize?: 'A4' | 'Letter' | 'Legal';
    };
    delivery?: {
      email?: string[];
      subject?: string;
      message?: string;
      downloadLink?: boolean;
      expiresIn?: number;
    };
  }): Promise<{ message: string }> {
    return apiClient.post('reports/export', data);
  }

  // Schedule automated reports
  async scheduleReport(config: {
    reportConfigId: string;
    schedule: ScheduleConfig;
    delivery: DeliveryConfig;
    enabled?: boolean;
  }): Promise<{ scheduleId: string; message: string }> {
    return apiClient.post('reports/schedule', config);
  }

  // List scheduled reports
  async listScheduledReports(filters?: {
    enabled?: boolean;
    limit?: number;
  }): Promise<{
    schedules: Array<{
      id: string;
      reportConfigId: string;
      schedule: ScheduleConfig;
      delivery: DeliveryConfig;
      enabled: boolean;
      createdAt: string;
      lastRun?: string;
      nextRun: string;
    }>;
    totalCount: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.enabled !== undefined) params.append('enabled', filters.enabled.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get(`reports/schedule${query}`);
  }

  // Update scheduled report
  async updateScheduledReport(scheduleId: string, updates: {
    schedule?: ScheduleConfig;
    delivery?: DeliveryConfig;
    enabled?: boolean;
  }): Promise<{ message: string }> {
    return apiClient.put(`reports/schedule/${scheduleId}`, updates);
  }

  // Delete scheduled report
  async deleteScheduledReport(scheduleId: string): Promise<{ message: string }> {
    return apiClient.delete(`reports/schedule/${scheduleId}`);
  }

  // Generate enhanced dashboard
  async generateEnhancedDashboard(config: {
    widgets: DashboardWidget[];
    timeframe?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    realTime?: boolean;
    includeForecasting?: boolean;
    includeBenchmarks?: boolean;
  }): Promise<EnhancedDashboard> {
    return apiClient.post<EnhancedDashboard>('analytics/dashboard/enhanced', config);
  }

  // Get real-time analytics
  async getRealTimeAnalytics(config: {
    metrics?: string[];
    includeActivities?: boolean;
    includeSessions?: boolean;
    includeAlerts?: boolean;
    refreshInterval?: number;
  }): Promise<RealTimeAnalytics> {
    return apiClient.post<RealTimeAnalytics>('analytics/real-time', config);
  }

  // Get performance monitoring data
  async getPerformanceMonitoring(config: {
    timeframe?: 'hour' | 'day' | 'week' | 'month';
    metrics?: string[];
    includeRecommendations?: boolean;
    includeAlerts?: boolean;
    includeComparisons?: boolean;
  }): Promise<PerformanceMonitoring> {
    return apiClient.post<PerformanceMonitoring>('analytics/performance', config);
  }

  // Track analytics events
  async trackEvent(event: {
    eventType: string;
    metadata?: Record<string, any>;
    timestamp?: string;
  }): Promise<{ eventId: string; timestamp: string; message: string }> {
    return apiClient.post('analytics/events', event);
  }

  // Advanced data filtering
  async filterData(config: {
    dataSource: 'time-entries' | 'projects' | 'clients' | 'users' | 'analytics-events';
    filters: Array<{
      field: string;
      operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
      value: any;
    }>;
    groupBy?: {
      fields: string[];
      dateGrouping?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
    };
    aggregations?: Array<{
      field: string;
      function: 'sum' | 'avg' | 'count' | 'min' | 'max';
      alias?: string;
    }>;
    sorting?: Array<{
      field: string;
      direction: 'asc' | 'desc';
    }>;
    pagination?: {
      limit: number;
      offset: number;
    };
    outputFormat?: 'summary' | 'detailed' | 'raw';
  }): Promise<{
    data: any[];
    summary?: Record<string, any>;
    pagination?: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    return apiClient.post('analytics/filter', config);
  }
}

export const reportingApi = new ReportingApi();
```

### **9. Time Entry Management API** ✅ **Phase 4 - COMPLETE**

```typescript
// src/services/time-entry-api.ts
import { apiClient } from './api-client';

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  taskId?: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // ISO datetime
  endTime?: string; // ISO datetime
  duration: number; // minutes
  isBillable: boolean;
  hourlyRate?: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  tags: string[];
  notes?: string;
  attachments?: string[];
  isTimerEntry: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimeEntryRequest {
  projectId: string;
  taskId?: string;
  description: string;
  date: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  isBillable?: boolean;
  hourlyRate?: number;
  tags?: string[];
  notes?: string;
}

export interface UpdateTimeEntryRequest {
  description?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  isBillable?: boolean;
  hourlyRate?: number;
  tags?: string[];
  notes?: string;
}

export interface TimeEntryFilters {
  startDate?: string;
  endDate?: string;
  projectId?: string;
  status?: 'draft' | 'submitted' | 'approved' | 'rejected';
  isBillable?: boolean;
  limit?: number;
  offset?: number;
}

export interface BulkTimeEntryResponse {
  successful: string[];
  failed: Array<{ id: string; error: string }>;
}

class TimeEntryApi {
  // List time entries
  async listTimeEntries(filters?: TimeEntryFilters): Promise<{ items: TimeEntry[]; pagination: any }> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.projectId) params.append('projectId', filters.projectId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.isBillable !== undefined) params.append('isBillable', filters.isBillable.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ items: TimeEntry[]; pagination: any }>(`time-entries${query}`);
  }

  // Create time entry
  async createTimeEntry(request: CreateTimeEntryRequest): Promise<TimeEntry> {
    return apiClient.post<TimeEntry>('time-entries', request);
  }

  // Update time entry
  async updateTimeEntry(id: string, updates: UpdateTimeEntryRequest): Promise<TimeEntry> {
    return apiClient.put<TimeEntry>(`time-entries/${id}`, updates);
  }

  // Delete time entry
  async deleteTimeEntry(id: string): Promise<void> {
    return apiClient.delete(`time-entries/${id}`);
  }

  // Submit time entries for approval
  async submitTimeEntries(timeEntryIds: string[]): Promise<BulkTimeEntryResponse> {
    return apiClient.post<BulkTimeEntryResponse>('time-entries/submit', { timeEntryIds });
  }

  // Approve time entries (managers only)
  async approveTimeEntries(timeEntryIds: string[]): Promise<BulkTimeEntryResponse> {
    return apiClient.post<BulkTimeEntryResponse>('time-entries/approve', { timeEntryIds });
  }

  // Reject time entries (managers only)
  async rejectTimeEntries(timeEntryIds: string[], reason: string): Promise<BulkTimeEntryResponse> {
    return apiClient.post<BulkTimeEntryResponse>('time-entries/reject', { timeEntryIds, reason });
  }
}

export const timeEntryApi = new TimeEntryApi();
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

## 🧾 **Phase 7: Invoice Management API** ✅ **NEW**

### **1. Invoice API Service**

```typescript
// src/services/invoice-api.ts
import { apiClient } from './api-client';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  projectIds: string[];
  timeEntryIds: string[];
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountRate: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  lineItems: InvoiceLineItem[];
  paymentTerms: string;
  isRecurring: boolean;
  recurringConfig?: RecurringInvoiceConfig;
  remindersSent: number;
  notes?: string;
  clientNotes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface InvoiceLineItem {
  id: string;
  type: 'time' | 'fixed' | 'expense';
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  taxable: boolean;
  timeEntryId?: string;
  projectId?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  externalPaymentId?: string;
  processorFee?: number;
  createdAt: string;
  updatedAt: string;
  recordedBy: string;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  layout: 'standard' | 'modern' | 'minimal' | 'detailed';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  logo?: string;
  companyInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
  };
  customFields: Array<{
    name: string;
    value: string;
    position: 'header' | 'footer' | 'lineItems';
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringInvoiceConfig {
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  autoSend: boolean;
  generateDaysBefore: number;
  invoicesGenerated: number;
  nextInvoiceDate: string;
}

export interface InvoiceFilters {
  status?: string;
  clientId?: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  isRecurring?: boolean;
  sortBy?: 'invoiceNumber' | 'issueDate' | 'dueDate' | 'totalAmount' | 'status' | 'clientName';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface CreateInvoiceRequest {
  clientId: string;
  projectIds?: string[];
  timeEntryIds?: string[];
  issueDate?: string;
  paymentTerms?: string;
  currency?: string;
  taxRate?: number;
  discountRate?: number;
  additionalLineItems?: Array<{
    type: 'fixed' | 'expense';
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    taxable?: boolean;
  }>;
  notes?: string;
  clientNotes?: string;
  isRecurring?: boolean;
  recurringConfig?: Partial<RecurringInvoiceConfig>;
  templateId?: string;
}

export interface UpdateInvoiceRequest {
  dueDate?: string;
  paymentTerms?: string;
  taxRate?: number;
  discountRate?: number;
  notes?: string;
  clientNotes?: string;
  lineItems?: InvoiceLineItem[];
}

export interface SendInvoiceRequest {
  recipientEmails: string[];
  subject?: string;
  message?: string;
  attachPdf?: boolean;
  sendCopy?: boolean;
  scheduleDate?: string;
}

export interface RecordPaymentRequest {
  operation: 'recordPayment';
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  externalPaymentId?: string;
  processorFee?: number;
}

class InvoiceApi {
  // List invoices with filtering
  async listInvoices(filters: InvoiceFilters = {}): Promise<{
    items: Invoice[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const endpoint = `invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get(endpoint);
  }

  // Generate new invoice
  async generateInvoice(request: CreateInvoiceRequest): Promise<Invoice> {
    return apiClient.post('invoices', request);
  }

  // Get invoice details
  async getInvoice(invoiceId: string): Promise<Invoice> {
    return apiClient.get(`invoices/${invoiceId}`);
  }

  // Update invoice (draft only)
  async updateInvoice(invoiceId: string, updates: UpdateInvoiceRequest): Promise<Invoice> {
    return apiClient.put(`invoices/${invoiceId}`, updates);
  }

  // Delete invoice (draft only)
  async deleteInvoice(invoiceId: string): Promise<void> {
    return apiClient.delete(`invoices/${invoiceId}`);
  }

  // Send invoice via email
  async sendInvoice(invoiceId: string, options: SendInvoiceRequest): Promise<Invoice> {
    return apiClient.post(`invoices/${invoiceId}/send`, options);
  }

  // Update invoice status
  async updateInvoiceStatus(invoiceId: string, status: string): Promise<Invoice> {
    return apiClient.put(`invoices/${invoiceId}/status`, { status });
  }

  // Record payment
  async recordPayment(invoiceId: string, payment: RecordPaymentRequest): Promise<{
    invoice: Invoice;
    payment: Payment;
  }> {
    return apiClient.put(`invoices/${invoiceId}/status`, payment);
  }

  // Download invoice PDF
  async downloadInvoicePdf(invoiceId: string, templateId?: string): Promise<Blob> {
    const endpoint = `invoices/${invoiceId}/pdf${templateId ? `?templateId=${templateId}` : ''}`;
    const token = localStorage.getItem('accessToken');
    
    const response = await fetch(`${apiClient['baseUrl']}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`PDF download failed: ${response.status}`);
    }
    
    return response.blob();
  }

  // List invoice payments
  async getInvoicePayments(invoiceId: string): Promise<{
    payments: Payment[];
    totalPaid: number;
    remainingBalance: number;
  }> {
    return apiClient.get(`invoices/${invoiceId}/payments`);
  }

  // Recurring invoice management
  async listRecurringInvoices(filters: { isActive?: boolean; frequency?: string } = {}): Promise<Invoice[]> {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });
    
    const endpoint = `invoices/recurring${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get(endpoint);
  }

  async processRecurringInvoices(): Promise<{
    processed: number;
    invoices: Invoice[];
  }> {
    return apiClient.post('invoices/recurring');
  }

  async updateRecurringConfig(invoiceId: string, config: Partial<RecurringInvoiceConfig>): Promise<Invoice> {
    return apiClient.put(`invoices/${invoiceId}/recurring`, config);
  }

  async stopRecurringInvoice(invoiceId: string): Promise<void> {
    return apiClient.delete(`invoices/${invoiceId}/recurring`);
  }

  // Template management
  async listTemplates(): Promise<InvoiceTemplate[]> {
    return apiClient.get('invoice-templates');
  }

  async getTemplate(templateId: string): Promise<InvoiceTemplate> {
    return apiClient.get(`invoice-templates/${templateId}`);
  }

  async createTemplate(template: Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<InvoiceTemplate> {
    return apiClient.post('invoice-templates', template);
  }

  async updateTemplate(templateId: string, updates: Partial<InvoiceTemplate>): Promise<InvoiceTemplate> {
    return apiClient.put(`invoice-templates/${templateId}`, updates);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    return apiClient.delete(`invoice-templates/${templateId}`);
  }
}

export const invoiceApi = new InvoiceApi();
```

### **2. Invoice Management Components**

```typescript
// src/components/InvoiceList.tsx
import React, { useState, useEffect } from 'react';
import { invoiceApi, Invoice, InvoiceFilters } from '../services/invoice-api';

export const InvoiceList: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<InvoiceFilters>({
    limit: 10,
    offset: 0,
    sortBy: 'issueDate',
    sortOrder: 'desc'
  });

  useEffect(() => {
    loadInvoices();
  }, [filters]);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const result = await invoiceApi.listInvoices(filters);
      setInvoices(result.items);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status, offset: 0 }));
  };

  const downloadPdf = async (invoiceId: string) => {
    try {
      const blob = await invoiceApi.downloadInvoicePdf(invoiceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

  if (isLoading) return <div>Loading invoices...</div>;

  return (
    <div className="invoice-list">
      <div className="filters">
        <button onClick={() => handleStatusFilter('')}>All</button>
        <button onClick={() => handleStatusFilter('draft')}>Draft</button>
        <button onClick={() => handleStatusFilter('sent')}>Sent</button>
        <button onClick={() => handleStatusFilter('paid')}>Paid</button>
        <button onClick={() => handleStatusFilter('overdue')}>Overdue</button>
      </div>

      <div className="invoice-grid">
        {invoices.map(invoice => (
          <div key={invoice.id} className={`invoice-card status-${invoice.status}`}>
            <div className="invoice-header">
              <h3>{invoice.invoiceNumber}</h3>
              <span className={`status ${invoice.status}`}>{invoice.status}</span>
            </div>
            
            <div className="invoice-details">
              <p><strong>Client:</strong> {invoice.clientName}</p>
              <p><strong>Amount:</strong> {invoice.currency} {invoice.totalAmount.toFixed(2)}</p>
              <p><strong>Due Date:</strong> {new Date(invoice.dueDate).toLocaleDateString()}</p>
              {invoice.isRecurring && <span className="recurring-badge">Recurring</span>}
            </div>

            <div className="invoice-actions">
              <button onClick={() => downloadPdf(invoice.id)}>Download PDF</button>
              {invoice.status === 'draft' && (
                <button onClick={() => {/* Navigate to edit */}}>Edit</button>
              )}
              {(invoice.status === 'sent' || invoice.status === 'viewed') && (
                <button onClick={() => {/* Open payment modal */}}>Record Payment</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### **3. Invoice Generation Component**

```typescript
// src/components/InvoiceGenerator.tsx
import React, { useState, useEffect } from 'react';
import { invoiceApi, CreateInvoiceRequest } from '../services/invoice-api';
import { clientApi } from '../services/client-api';
import { projectApi } from '../services/project-api';

export const InvoiceGenerator: React.FC = () => {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<CreateInvoiceRequest>({
    clientId: '',
    projectIds: [],
    timeEntryIds: [],
    taxRate: 0.08,
    discountRate: 0,
    paymentTerms: 'Net 30',
    currency: 'USD',
    additionalLineItems: []
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const clientList = await clientApi.listClients();
      setClients(clientList);
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const handleClientChange = async (clientId: string) => {
    setFormData(prev => ({ ...prev, clientId, projectIds: [], timeEntryIds: [] }));
    
    if (clientId) {
      try {
        const projectList = await projectApi.listProjects({ clientId });
        setProjects(projectList);
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
    }
  };

  const handleProjectChange = async (projectIds: string[]) => {
    setFormData(prev => ({ ...prev, projectIds, timeEntryIds: [] }));
    
    if (projectIds.length > 0) {
      try {
        // Load approved time entries for selected projects
        const entries = await Promise.all(
          projectIds.map(projectId => 
            timeEntryApi.listTimeEntries({ 
              projectId, 
              status: 'approved',
              startDate: '2024-01-01' // Adjust date range as needed
            })
          )
        );
        setTimeEntries(entries.flat());
      } catch (error) {
        console.error('Failed to load time entries:', error);
      }
    }
  };

  const generateInvoice = async () => {
    setIsLoading(true);
    try {
      const invoice = await invoiceApi.generateInvoice(formData);
      console.log('Invoice generated:', invoice);
      // Navigate to invoice details or show success message
    } catch (error) {
      console.error('Failed to generate invoice:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="invoice-generator">
      <h2>Generate Invoice</h2>
      
      <form onSubmit={(e) => { e.preventDefault(); generateInvoice(); }}>
        <div className="form-group">
          <label>Client:</label>
          <select 
            value={formData.clientId} 
            onChange={(e) => handleClientChange(e.target.value)}
            required
          >
            <option value="">Select Client</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>

        {projects.length > 0 && (
          <div className="form-group">
            <label>Projects:</label>
            <select 
              multiple 
              value={formData.projectIds} 
              onChange={(e) => handleProjectChange(Array.from(e.target.selectedOptions, option => option.value))}
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
        )}

        {timeEntries.length > 0 && (
          <div className="form-group">
            <label>Time Entries:</label>
            <div className="time-entries-list">
              {timeEntries.map(entry => (
                <label key={entry.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.timeEntryIds?.includes(entry.id)}
                    onChange={(e) => {
                      const timeEntryIds = e.target.checked
                        ? [...(formData.timeEntryIds || []), entry.id]
                        : (formData.timeEntryIds || []).filter(id => id !== entry.id);
                      setFormData(prev => ({ ...prev, timeEntryIds }));
                    }}
                  />
                  {entry.description} - {entry.duration}min - ${entry.hourlyRate * (entry.duration / 60)}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Tax Rate (%):</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={formData.taxRate}
              onChange={(e) => setFormData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) }))}
            />
          </div>

          <div className="form-group">
            <label>Discount Rate (%):</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={formData.discountRate}
              onChange={(e) => setFormData(prev => ({ ...prev, discountRate: parseFloat(e.target.value) }))}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Payment Terms:</label>
          <select 
            value={formData.paymentTerms} 
            onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
          >
            <option value="Net 15">Net 15</option>
            <option value="Net 30">Net 30</option>
            <option value="Net 45">Net 45</option>
            <option value="Due on receipt">Due on receipt</option>
          </select>
        </div>

        <div className="form-group">
          <label>Notes:</label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Internal notes (not visible to client)"
          />
        </div>

        <div className="form-group">
          <label>Client Notes:</label>
          <textarea
            value={formData.clientNotes || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, clientNotes: e.target.value }))}
            placeholder="Notes visible to client"
          />
        </div>

        <button type="submit" disabled={isLoading || !formData.clientId}>
          {isLoading ? 'Generating...' : 'Generate Invoice'}
        </button>
      </form>
    </div>
  );
};
```

### **4. Payment Recording Component**

```typescript
// src/components/PaymentRecorder.tsx
import React, { useState } from 'react';
import { invoiceApi, RecordPaymentRequest, Invoice } from '../services/invoice-api';

interface PaymentRecorderProps {
  invoice: Invoice;
  onPaymentRecorded: (updatedInvoice: Invoice) => void;
  onClose: () => void;
}

export const PaymentRecorder: React.FC<PaymentRecorderProps> = ({
  invoice,
  onPaymentRecorded,
  onClose
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<Omit<RecordPaymentRequest, 'operation'>>({
    amount: invoice.totalAmount,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Credit Card',
    reference: '',
    notes: ''
  });

  const recordPayment = async () => {
    setIsLoading(true);
    try {
      const result = await invoiceApi.recordPayment(invoice.id, {
        operation: 'recordPayment',
        ...paymentData
      });
      
      onPaymentRecorded(result.invoice);
      onClose();
    } catch (error) {
      console.error('Failed to record payment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="payment-recorder-modal">
      <div className="modal-content">
        <h3>Record Payment</h3>
        
        <div className="invoice-summary">
          <p><strong>Invoice:</strong> {invoice.invoiceNumber}</p>
          <p><strong>Total Amount:</strong> {invoice.currency} {invoice.totalAmount.toFixed(2)}</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); recordPayment(); }}>
          <div className="form-group">
            <label>Payment Amount:</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={invoice.totalAmount}
              value={paymentData.amount}
              onChange={(e) => setPaymentData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
              required
            />
          </div>

          <div className="form-group">
            <label>Payment Date:</label>
            <input
              type="date"
              value={paymentData.paymentDate}
              onChange={(e) => setPaymentData(prev => ({ ...prev, paymentDate: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label>Payment Method:</label>
            <select
              value={paymentData.paymentMethod}
              onChange={(e) => setPaymentData(prev => ({ ...prev, paymentMethod: e.target.value }))}
              required
            >
              <option value="Credit Card">Credit Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Check">Check</option>
              <option value="Cash">Cash</option>
              <option value="Wire Transfer">Wire Transfer</option>
              <option value="ACH">ACH</option>
              <option value="PayPal">PayPal</option>
            </select>
          </div>

          <div className="form-group">
            <label>Reference Number:</label>
            <input
              type="text"
              value={paymentData.reference}
              onChange={(e) => setPaymentData(prev => ({ ...prev, reference: e.target.value }))}
              placeholder="Transaction ID, check number, etc."
            />
          </div>

          <div className="form-group">
            <label>Notes:</label>
            <textarea
              value={paymentData.notes}
              onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional payment notes"
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

### **5. Reporting Dashboard Component**

```typescript
// src/components/ReportingDashboard.tsx
import React, { useState, useEffect } from 'react';
import { reportingApi, EnhancedDashboard, DashboardWidget } from '../services/reporting-api';

export const ReportingDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<EnhancedDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month');

  const defaultWidgets: DashboardWidget[] = [
    {
      type: 'metric',
      title: 'Total Revenue',
      size: 'medium',
      config: { metric: 'totalRevenue', timeframe }
    },
    {
      type: 'metric',
      title: 'Total Hours',
      size: 'medium',
      config: { metric: 'totalHours', timeframe }
    },
    {
      type: 'chart',
      title: 'Revenue Trend',
      size: 'large',
      config: { chartType: 'line', metric: 'revenue', timeframe }
    },
    {
      type: 'chart',
      title: 'Project Distribution',
      size: 'medium',
      config: { chartType: 'pie', metric: 'projects', timeframe }
    }
  ];

  useEffect(() => {
    loadDashboard();
  }, [timeframe]);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const dashboardData = await reportingApi.generateEnhancedDashboard({
        widgets: defaultWidgets,
        timeframe,
        realTime: true,
        includeForecasting: true,
        includeBenchmarks: true
      });
      setDashboard(dashboardData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div>Loading dashboard...</div>;
  if (!dashboard) return <div>Failed to load dashboard</div>;

  return (
    <div className="reporting-dashboard">
      <div className="dashboard-header">
        <h2>Analytics Dashboard</h2>
        <div className="timeframe-selector">
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as any)}>
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      <div className="kpi-section">
        <div className="kpi-card">
          <h3>Total Revenue</h3>
          <div className="kpi-value">${dashboard.kpis.totalRevenue.toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <h3>Total Hours</h3>
          <div className="kpi-value">{dashboard.kpis.totalHours.toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <h3>Active Projects</h3>
          <div className="kpi-value">{dashboard.kpis.activeProjects}</div>
        </div>
        <div className="kpi-card">
          <h3>Utilization Rate</h3>
          <div className="kpi-value">{(dashboard.kpis.utilizationRate * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div className="widgets-grid">
        {dashboard.widgets.map(widget => (
          <div key={widget.id} className={`widget widget-${widget.config.size}`}>
            <h4>{widget.title}</h4>
            <div className="widget-content">
              {widget.type === 'chart' && (
                <div className="chart-placeholder">
                  Chart: {widget.config.chartType} - {widget.config.metric}
                </div>
              )}
              {widget.type === 'metric' && (
                <div className="metric-display">
                  <span className="metric-value">{widget.data?.value || 0}</span>
                  <span className="metric-change">{widget.data?.change || '+0%'}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {dashboard.forecasting && (
        <div className="forecasting-section">
          <h3>Forecasting</h3>
          <div className="forecast-cards">
            <div className="forecast-card">
              <h4>Revenue Projection</h4>
              <div className="forecast-value">
                ${dashboard.forecasting.revenueProjection.toLocaleString()}
              </div>
              <div className="confidence">
                {(dashboard.forecasting.confidenceLevel * 100).toFixed(0)}% confidence
              </div>
            </div>
            <div className="forecast-card">
              <h4>Hours Projection</h4>
              <div className="forecast-value">
                {dashboard.forecasting.hoursProjection.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

### **6. Time Report Generator Component**

```typescript
// src/components/TimeReportGenerator.tsx
import React, { useState } from 'react';
import { reportingApi, ReportFilters, TimeReport } from '../services/reporting-api';

export const TimeReportGenerator: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    groupBy: 'date',
    includeDetails: true,
    limit: 100,
    offset: 0
  });
  const [report, setReport] = useState<TimeReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateReport = async () => {
    setIsLoading(true);
    try {
      const reportData = await reportingApi.generateTimeReport(filters);
      setReport(reportData);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = async (format: 'pdf' | 'csv' | 'excel') => {
    if (!report) return;
    
    try {
      await reportingApi.exportReport({
        reportData: report,
        format,
        options: {
          includeCharts: true,
          includeRawData: true,
          orientation: 'landscape'
        }
      });
      alert(`Report export initiated. You will receive an email with the ${format.toUpperCase()} file.`);
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  return (
    <div className="time-report-generator">
      <h2>Time Tracking Report</h2>
      
      <div className="report-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Start Date:</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          
          <div className="filter-group">
            <label>End Date:</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          
          <div className="filter-group">
            <label>Group By:</label>
            <select
              value={filters.groupBy}
              onChange={(e) => setFilters(prev => ({ ...prev, groupBy: e.target.value as any }))}
            >
              <option value="date">Date</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="project">Project</option>
              <option value="user">User</option>
              <option value="client">Client</option>
            </select>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label>Project ID:</label>
            <input
              type="text"
              value={filters.filters?.projectId || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                filters: { ...prev.filters, projectId: e.target.value }
              }))}
              placeholder="Filter by project"
            />
          </div>
          
          <div className="filter-group">
            <label>Billable Only:</label>
            <input
              type="checkbox"
              checked={filters.filters?.billable || false}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                filters: { ...prev.filters, billable: e.target.checked }
              }))}
            />
          </div>
        </div>

        <div className="filter-actions">
          <button onClick={generateReport} disabled={isLoading}>
            {isLoading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {report && (
        <div className="report-results">
          <div className="report-summary">
            <h3>Summary</h3>
            <div className="summary-cards">
              <div className="summary-card">
                <h4>Total Hours</h4>
                <div className="summary-value">{report.summary.totalHours.toFixed(2)}</div>
              </div>
              <div className="summary-card">
                <h4>Total Revenue</h4>
                <div className="summary-value">${report.summary.totalRevenue.toLocaleString()}</div>
              </div>
              <div className="summary-card">
                <h4>Billable Hours</h4>
                <div className="summary-value">{report.summary.billableHours.toFixed(2)}</div>
              </div>
              <div className="summary-card">
                <h4>Average Rate</h4>
                <div className="summary-value">${report.summary.averageHourlyRate.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="report-data">
            <div className="report-header">
              <h3>Report Data</h3>
              <div className="export-buttons">
                <button onClick={() => exportReport('pdf')}>Export PDF</button>
                <button onClick={() => exportReport('csv')}>Export CSV</button>
                <button onClick={() => exportReport('excel')}>Export Excel</button>
              </div>
            </div>
            
            <div className="grouped-data">
              {report.groupedData.map((group, index) => (
                <div key={index} className="group-section">
                  <h4>{group.groupKey}</h4>
                  <div className="group-summary">
                    <span>Hours: {group.totalHours.toFixed(2)}</span>
                    <span>Revenue: ${group.totalRevenue.toLocaleString()}</span>
                    <span>Entries: {group.entries.length}</span>
                  </div>
                  
                  {filters.includeDetails && (
                    <div className="group-entries">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Project</th>
                            <th>Hours</th>
                            <th>Rate</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.entries.map(entry => (
                            <tr key={entry.id}>
                              <td>{entry.date}</td>
                              <td>{entry.description}</td>
                              <td>{entry.projectId}</td>
                              <td>{(entry.duration / 60).toFixed(2)}</td>
                              <td>${entry.hourlyRate?.toFixed(2) || 0}</td>
                              <td>${((entry.duration / 60) * (entry.hourlyRate || 0)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
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
- [ ] **Project management endpoints (Phase 5)** ✅ **COMPLETE**
- [ ] **Client management endpoints (Phase 5)** ✅ **COMPLETE**
- [ ] **Time entry management endpoints (Phase 4)** ✅ **COMPLETE**
- [ ] **Reporting and analytics endpoints (Phase 6)** ✅ **COMPLETE**
- [ ] **Invoice management endpoints (Phase 7)** ✅ **COMPLETE**
- [ ] **Payment tracking endpoints (Phase 7)** ✅ **COMPLETE**
- [ ] **Invoice template management (Phase 7)** ✅ **COMPLETE**
- [ ] **Recurring invoice management (Phase 7)** ✅ **COMPLETE**

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
- [ ] **Project management interface (Phase 5)** ✅ **COMPLETE**
- [ ] **Client management interface (Phase 5)** ✅ **COMPLETE**
- [ ] **Time entry and timer interface (Phase 4)** ✅ **COMPLETE**
- [ ] **Reporting and analytics dashboard (Phase 6)** ✅ **COMPLETE**
- [ ] **Invoice generation and management interface (Phase 7)** ✅ **COMPLETE**
- [ ] **Payment recording and tracking interface (Phase 7)** ✅ **COMPLETE**
- [ ] **Invoice template customization interface (Phase 7)** ✅ **COMPLETE**
- [ ] **Recurring invoice configuration interface (Phase 7)** ✅ **COMPLETE**

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

### **✅ All Phases Complete - Ready for Integration**
1. **Implement Authentication**: Start with login/logout functionality
2. **Add User Management**: Profile and preferences management
3. **Implement Security Features**: Password change and security settings
4. **Add Session Management**: Multi-session tracking and control
5. **Implement Invitations**: User invitation management interface
6. **Add Client & Project Management**: Client and project CRUD operations (Phase 5) ✅ **COMPLETE**
7. **Implement Time Tracking**: Time entry management and approval workflows (Phase 4) ✅ **COMPLETE**
8. **Add Reporting Features**: Analytics and business intelligence (Phase 6) ✅ **COMPLETE**
9. **Implement Invoice Management**: Complete billing and payment system (Phase 7) ✅ **COMPLETE**
10. **Testing**: Comprehensive testing of all integrations
11. **Production Deployment**: Deploy frontend with backend integration

### **🎯 Complete Business Solution Integration Priority**
- **Authentication & User Management**: Core user functionality and security
- **Time Tracking**: Timer functionality and time entry management
- **Project & Client Management**: Business relationship management
- **Reporting & Analytics**: Business intelligence and performance monitoring
- **Invoice & Payment Management**: Complete billing and payment system
- **Advanced Features**: Automated workflows and integrations

This guide provides a complete foundation for integrating the frontend with the Aerotage Time Reporting API backend. All the necessary code examples, patterns, and best practices are included to ensure a smooth integration process. **With all phases (1-7) complete, this provides a comprehensive business management solution with time tracking, project management, client management, reporting, and full invoicing capabilities.**

---

## 📚 **Additional Documentation**

For enhanced API client implementation and response handling improvements:

- **[Frontend API Client Guide](./FRONTEND_API_CLIENT_GUIDE.md)** - ✨ **Enhanced API client implementation with automatic response unwrapping**

This new guide addresses API response structure inconsistencies and provides a better developer experience with automatic data extraction and improved type safety. 