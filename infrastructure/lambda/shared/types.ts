// User Invitation Types
export interface UserInvitation {
  id: string;
  email: string;
  invitedBy: string;
  role: 'admin' | 'manager' | 'employee';
  department?: string;
  jobTitle?: string;
  hourlyRate?: number;
  permissions: {
    features: string[];
    projects: string[];
  };
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  invitationToken: string;
  tokenHash: string;
  expiresAt: string;
  acceptedAt?: string;
  onboardingCompleted: boolean;
  personalMessage?: string;
  createdAt: string;
  updatedAt: string;
  emailSentAt: string;
  resentCount: number;
  lastResentAt?: string;
}

// API Request/Response Types
export interface CreateInvitationRequest {
  email: string;
  role: 'admin' | 'manager' | 'employee';
  department?: string;
  jobTitle?: string;
  hourlyRate?: number;
  permissions: {
    features: string[];
    projects: string[];
  };
  personalMessage?: string;
}

export interface InvitationFilters {
  status?: 'pending' | 'accepted' | 'expired' | 'cancelled';
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'expiresAt' | 'email';
  sortOrder?: 'asc' | 'desc';
}

export interface ResendOptions {
  extendExpiration?: boolean;
  personalMessage?: string;
}

export interface InvitationValidation {
  invitation: {
    id: string;
    email: string;
    role: 'admin' | 'manager' | 'employee';
    department?: string;
    jobTitle?: string;
    hourlyRate?: number;
    permissions: {
      features: string[];
      projects: string[];
    };
    expiresAt: string;
    isExpired: boolean;
  };
}

export interface AcceptInvitationRequest {
  token: string;
  userData: {
    name: string;
    password: string;
    contactInfo?: {
      phone?: string;
      address?: string;
      emergencyContact?: string;
    };
    preferences: {
      theme: 'light' | 'dark';
      notifications: boolean;
      timezone: string;
    };
  };
}

export interface AcceptInvitationResponse {
  user: User;
  invitation: UserInvitation;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string;
  jobTitle?: string;
  hourlyRate?: number;
  invitationId?: string;
  onboardedAt?: string;
  invitedBy?: string;
  isActive: boolean;
  startDate: string;
  permissions: {
    features: string[];
    projects: string[];
  };
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
    timezone: string;
  };
  contactInfo?: {
    phone?: string;
    address?: string;
    emergencyContact?: string;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Error Types
export enum InvitationErrorCodes {
  INVALID_EMAIL = 'INVALID_EMAIL',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  INVITATION_NOT_FOUND = 'INVITATION_NOT_FOUND',
  INVITATION_EXPIRED = 'INVITATION_EXPIRED',
  INVITATION_ALREADY_ACCEPTED = 'INVITATION_ALREADY_ACCEPTED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  PASSWORD_POLICY_VIOLATION = 'PASSWORD_POLICY_VIOLATION',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export interface ErrorResponse {
  success: false;
  error: {
    code: InvitationErrorCodes | ProfileSettingsErrorCodes | string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

// Pagination Types
export interface PaginationResponse<T> {
  success: true;
  data: {
    items: T[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

// DynamoDB Item Types
export interface UserInvitationDynamoItem {
  PK: string; // "INVITATION#{id}"
  SK: string; // "INVITATION#{id}"
  GSI1PK: string; // "EMAIL#{email}"
  GSI1SK: string; // "INVITATION#{createdAt}"
  GSI2PK?: string; // "STATUS#{status}"
  GSI2SK?: string; // "INVITATION#{createdAt}"
  tokenHash: string; // For TokenHashIndexV2
  id: string;
  email: string;
  invitedBy: string;
  role: string;
  department?: string;
  jobTitle?: string;
  hourlyRate?: number;
  permissions: string; // JSON serialized
  status: string;
  invitationToken: string;
  expiresAt: string;
  acceptedAt?: string;
  onboardingCompleted: boolean;
  personalMessage?: string;
  createdAt: string;
  updatedAt: string;
  emailSentAt: string;
  resentCount: number;
  lastResentAt?: string;
}

// ==========================
// User Profile Settings Types
// ==========================

// Extended User Profile Types
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
  profilePicture?: string; // S3 URL
  startDate: string; // ISO date
  lastLogin?: string; // ISO datetime
  isActive: boolean;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

export interface UpdateUserProfileRequest {
  name?: string;
  jobTitle?: string;
  department?: string;
  hourlyRate?: number; // May require admin approval
  contactInfo?: {
    phone?: string;
    address?: string;
    emergencyContact?: string;
  };
}

// User Preferences Types
export interface UserPreferences {
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

// Security Settings Types
export interface UserSecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number; // minutes
  allowMultipleSessions: boolean;
  passwordChangeRequired: boolean;
  passwordLastChanged: string; // ISO datetime
  passwordExpiresAt?: string; // ISO datetime, null if no expiry
  securitySettings: {
    requirePasswordChangeEvery: number; // days, 0 = never
    maxFailedLoginAttempts: number;
    accountLockoutDuration: number; // minutes
  };
}

export interface UpdateUserSecuritySettingsRequest {
  sessionTimeout?: number;
  allowMultipleSessions?: boolean;
  requirePasswordChangeEvery?: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface EnableTwoFactorResponse {
  qrCode: string; // Base64 encoded QR code image
  manualEntryKey: string; // For manual app setup
  backupCodes: string[]; // Array of backup codes
}

export interface VerifyTwoFactorRequest {
  verificationCode: string; // 6-digit code from authenticator app
}

export interface DisableTwoFactorRequest {
  password: string; // Current password for verification
  verificationCode: string; // Current 2FA code
}

// User Session Types
export interface UserSession {
  id: string;
  ipAddress: string;
  userAgent: string;
  loginTime: string; // ISO datetime
  lastActivity: string; // ISO datetime
  isCurrent: boolean;
  location?: {
    city: string;
    country: string;
  };
}

// Notification Settings Types
export interface UserNotificationSettings {
  email: {
    enabled: boolean;
    frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  };
  system: {
    enabled: boolean;
  };
  timeTracking: {
    timerReminders: boolean;
    reminderInterval: number; // minutes
    goalNotifications: boolean;
  };
  workEvents: {
    timeEntrySubmissionReminders: boolean;
    approvalNotifications: boolean;
    projectDeadlineReminders: boolean;
    overdueTaskNotifications: boolean;
  };
  billing: {
    invoiceStatusUpdates: boolean;
    paymentReminders: boolean;
  };
  team: {
    activityUpdates: boolean;
    invitationUpdates: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
    weekendsQuiet: boolean;
  };
  updatedAt: string; // ISO datetime
}

export interface UpdateUserNotificationSettingsRequest {
  email?: {
    enabled?: boolean;
    frequency?: 'immediate' | 'daily' | 'weekly' | 'never';
  };
  system?: {
    enabled?: boolean;
  };
  timeTracking?: {
    timerReminders?: boolean;
    reminderInterval?: number;
    goalNotifications?: boolean;
  };
  workEvents?: {
    timeEntrySubmissionReminders?: boolean;
    approvalNotifications?: boolean;
    projectDeadlineReminders?: boolean;
    overdueTaskNotifications?: boolean;
  };
  billing?: {
    invoiceStatusUpdates?: boolean;
    paymentReminders?: boolean;
  };
  team?: {
    activityUpdates?: boolean;
    invitationUpdates?: boolean;
  };
  quietHours?: {
    enabled?: boolean;
    start?: string;
    end?: string;
    weekendsQuiet?: boolean;
  };
}

// Profile Settings Error Types
export enum ProfileSettingsErrorCodes {
  // Profile errors
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',
  UNAUTHORIZED_PROFILE_ACCESS = 'UNAUTHORIZED_PROFILE_ACCESS',
  INVALID_PROFILE_DATA = 'INVALID_PROFILE_DATA',
  
  // Password errors
  INVALID_CURRENT_PASSWORD = 'INVALID_CURRENT_PASSWORD',
  PASSWORD_POLICY_VIOLATION = 'PASSWORD_POLICY_VIOLATION',
  PASSWORD_RECENTLY_USED = 'PASSWORD_RECENTLY_USED',
  PASSWORD_CHANGE_RATE_LIMITED = 'PASSWORD_CHANGE_RATE_LIMITED',
  
  // 2FA errors
  TWO_FACTOR_ALREADY_ENABLED = 'TWO_FACTOR_ALREADY_ENABLED',
  TWO_FACTOR_NOT_ENABLED = 'TWO_FACTOR_NOT_ENABLED',
  INVALID_VERIFICATION_CODE = 'INVALID_VERIFICATION_CODE',
  BACKUP_CODE_INVALID = 'BACKUP_CODE_INVALID',
  
  // Session errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  CANNOT_TERMINATE_CURRENT_SESSION = 'CANNOT_TERMINATE_CURRENT_SESSION',
  SESSION_MIGRATION_REQUIRED = 'SESSION_MIGRATION_REQUIRED',
  
  // Upload errors
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  
  // Validation errors
  INVALID_TIMEZONE = 'INVALID_TIMEZONE',
  INVALID_CURRENCY = 'INVALID_CURRENCY',
  INVALID_TIME_FORMAT = 'INVALID_TIME_FORMAT',
  INVALID_DATE_FORMAT = 'INVALID_DATE_FORMAT',
}

// DynamoDB Item Types for Profile Settings
export interface UserPreferencesDynamoItem {
  PK: string; // "USER#{userId}"
  SK: string; // "PREFERENCES"
  userId: string;
  theme: string;
  notifications: boolean;
  timezone: string;
  timeTracking: string; // JSON serialized
  formatting: string; // JSON serialized
  createdAt: string;
  updatedAt: string;
}

export interface UserSecuritySettingsDynamoItem {
  PK: string; // "USER#{userId}"
  SK: string; // "SECURITY"
  userId: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string; // Encrypted
  sessionTimeout: number;
  allowMultipleSessions: boolean;
  requirePasswordChangeEvery: number;
  passwordLastChanged: string;
  failedLoginAttempts: number;
  accountLockedUntil?: string;
  backupCodes?: string; // Encrypted JSON array
  createdAt: string;
  updatedAt: string;
}

export interface UserNotificationSettingsDynamoItem {
  PK: string; // "USER#{userId}"
  SK: string; // "NOTIFICATIONS"
  userId: string;
  email: string; // JSON serialized
  system: string; // JSON serialized
  timeTracking: string; // JSON serialized
  workEvents: string; // JSON serialized
  billing: string; // JSON serialized
  team: string; // JSON serialized
  quietHours: string; // JSON serialized
  createdAt: string;
  updatedAt: string;
}

export interface UserSessionDynamoItem {
  PK: string; // "SESSION#{sessionId}"
  SK: string; // "SESSION#{sessionId}"
  GSI1PK: string; // "USER#{userId}"
  GSI1SK: string; // "SESSION#{createdAt}"
  sessionId: string;
  userId: string;
  sessionToken: string;
  ipAddress: string;
  userAgent: string;
  loginTime: string;
  lastActivity: string;
  expiresAt: string;
  isActive: boolean;
  locationData?: string; // JSON serialized
  createdAt: string;
}

export interface PasswordHistoryDynamoItem {
  PK: string; // "USER#{userId}"
  SK: string; // "PASSWORD#{timestamp}"
  userId: string;
  passwordHash: string; // Bcrypted
  createdAt: string;
}

// ==========================
// Time Entry Types - Phase 4
// ==========================

// Core Time Entry Types
export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  taskId?: string;
  description: string;
  date: string; // ISO date (YYYY-MM-DD)
  startTime?: string; // ISO datetime for timer entries
  endTime?: string; // ISO datetime for timer entries
  duration: number; // minutes
  isBillable: boolean;
  hourlyRate?: number; // Override project rate if specified
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  tags: string[];
  notes?: string;
  attachments?: string[]; // S3 URLs
  submittedAt?: string; // ISO datetime
  approvedAt?: string; // ISO datetime
  rejectedAt?: string; // ISO datetime
  approvedBy?: string; // User ID
  rejectionReason?: string;
  isTimerEntry: boolean; // True if created via timer
  timerStartedAt?: string; // ISO datetime
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

// Time Entry Request Types
export interface CreateTimeEntryRequest {
  projectId: string;
  taskId?: string;
  description: string;
  date: string; // ISO date
  startTime?: string; // ISO datetime
  endTime?: string; // ISO datetime
  duration?: number; // minutes - calculated if not provided
  isBillable?: boolean; // Defaults to project setting
  hourlyRate?: number; // Override project rate
  tags?: string[];
  notes?: string;
  attachments?: string[];
}

export interface UpdateTimeEntryRequest {
  projectId?: string;
  taskId?: string;
  description?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  isBillable?: boolean;
  hourlyRate?: number;
  tags?: string[];
  notes?: string;
  attachments?: string[];
}

export interface TimeEntryFilters {
  userId?: string;
  projectId?: string;
  taskId?: string;
  status?: 'draft' | 'submitted' | 'approved' | 'rejected';
  isBillable?: boolean;
  dateFrom?: string; // ISO date
  dateTo?: string; // ISO date
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'date' | 'duration' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// Timer Types
export interface TimerSession {
  id: string;
  userId: string;
  projectId: string;
  taskId?: string;
  description: string;
  startTime: string; // ISO datetime
  isActive: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
}

export interface StartTimerRequest {
  projectId: string;
  taskId?: string;
  description: string;
  tags?: string[];
  notes?: string;
}

export interface StopTimerRequest {
  timeEntryData?: {
    isBillable?: boolean;
    hourlyRate?: number;
    finalDescription?: string;
    finalTags?: string[];
    finalNotes?: string;
  };
}

// Bulk Operations
export interface SubmitTimeEntriesRequest {
  timeEntryIds: string[];
  submissionNotes?: string;
}

export interface ApproveTimeEntriesRequest {
  timeEntryIds: string[];
  approvalNotes?: string;
}

export interface RejectTimeEntriesRequest {
  timeEntryIds: string[];
  rejectionReason: string;
  rejectionNotes?: string;
}

export interface BulkTimeEntryResponse {
  successful: string[]; // Time entry IDs
  failed: {
    id: string;
    error: string;
  }[];
}

// Time Entry Analytics
export interface TimeEntryStats {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  totalEntries: number;
  averageHoursPerDay: number;
  mostUsedProject: {
    projectId: string;
    projectName: string;
    hours: number;
  };
  dailyBreakdown: {
    date: string;
    hours: number;
    billableHours: number;
    entries: number;
  }[];
}

// Project and Task Types (for time entry context)
export interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  defaultHourlyRate?: number;
  defaultBillable: boolean;
  budget?: {
    type: 'hours' | 'amount';
    value: number;
    spent: number;
  };
  deadline?: string; // ISO date
  teamMembers: string[]; // User IDs
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string; // User ID
  estimatedHours?: number;
  actualHours: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string; // ISO date
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Client Types (for project context)
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

// Time Entry Error Types
export enum TimeEntryErrorCodes {
  // Time entry errors
  TIME_ENTRY_NOT_FOUND = 'TIME_ENTRY_NOT_FOUND',
  UNAUTHORIZED_TIME_ENTRY_ACCESS = 'UNAUTHORIZED_TIME_ENTRY_ACCESS',
  INVALID_TIME_ENTRY_DATA = 'INVALID_TIME_ENTRY_DATA',
  TIME_ENTRY_ALREADY_SUBMITTED = 'TIME_ENTRY_ALREADY_SUBMITTED',
  TIME_ENTRY_ALREADY_APPROVED = 'TIME_ENTRY_ALREADY_APPROVED',
  TIME_ENTRY_NOT_SUBMITTED = 'TIME_ENTRY_NOT_SUBMITTED',
  
  // Timer errors
  TIMER_ALREADY_RUNNING = 'TIMER_ALREADY_RUNNING',
  NO_ACTIVE_TIMER = 'NO_ACTIVE_TIMER',
  TIMER_SESSION_NOT_FOUND = 'TIMER_SESSION_NOT_FOUND',
  
  // Project/Task errors
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  PROJECT_ACCESS_DENIED = 'PROJECT_ACCESS_DENIED',
  TASK_ACCESS_DENIED = 'TASK_ACCESS_DENIED',
  
  // Validation errors
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  INVALID_TIME_RANGE = 'INVALID_TIME_RANGE',
  DURATION_MISMATCH = 'DURATION_MISMATCH',
  NEGATIVE_DURATION = 'NEGATIVE_DURATION',
  FUTURE_DATE_NOT_ALLOWED = 'FUTURE_DATE_NOT_ALLOWED',
  
  // Approval workflow errors
  INSUFFICIENT_APPROVAL_PERMISSIONS = 'INSUFFICIENT_APPROVAL_PERMISSIONS',
  CANNOT_APPROVE_OWN_ENTRIES = 'CANNOT_APPROVE_OWN_ENTRIES',
  BULK_OPERATION_PARTIAL_FAILURE = 'BULK_OPERATION_PARTIAL_FAILURE',
}

// DynamoDB Item Types for Time Entries
export interface TimeEntryDynamoItem {
  PK: string; // "TIME_ENTRY#{id}"
  SK: string; // "TIME_ENTRY#{id}"
  GSI1PK: string; // "USER#{userId}"
  GSI1SK: string; // "DATE#{date}#TIME_ENTRY#{id}"
  GSI2PK: string; // "PROJECT#{projectId}"
  GSI2SK: string; // "DATE#{date}#TIME_ENTRY#{id}"
  GSI3PK: string; // "STATUS#{status}"
  GSI3SK: string; // "DATE#{date}#TIME_ENTRY#{id}"
  GSI4PK?: string; // "APPROVAL#{status}" (for approval workflow)
  GSI4SK?: string; // "SUBMITTED_AT#{submittedAt}#TIME_ENTRY#{id}"
  id: string;
  userId: string;
  projectId: string;
  taskId?: string;
  description: string;
  date: string;
  startTime?: string;
  endTime?: string;
  duration: number;
  isBillable: boolean;
  hourlyRate?: number;
  status: string;
  tags: string; // JSON serialized array
  notes?: string;
  attachments?: string; // JSON serialized array
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  isTimerEntry: boolean;
  timerStartedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimerSessionDynamoItem {
  PK: string; // "TIMER#{userId}"
  SK: string; // "ACTIVE"
  id: string;
  userId: string;
  projectId: string;
  taskId?: string;
  description: string;
  startTime: string;
  isActive: boolean;
  tags: string; // JSON serialized array
  notes?: string;
  createdAt: string;
  expiresAt: string; // TTL for cleanup
}

export interface ProjectDynamoItem {
  PK: string; // "PROJECT#{id}"
  SK: string; // "PROJECT#{id}"
  GSI1PK: string; // "CLIENT#{clientId}"
  GSI1SK: string; // "PROJECT#{name}"
  GSI2PK: string; // "STATUS#{status}"
  GSI2SK: string; // "PROJECT#{createdAt}"
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  description?: string;
  status: string;
  defaultHourlyRate?: number;
  defaultBillable: boolean;
  budget?: string; // JSON serialized
  deadline?: string;
  teamMembers: string; // JSON serialized array
  tags: string; // JSON serialized array
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TaskDynamoItem {
  PK: string; // "TASK#{id}"
  SK: string; // "TASK#{id}"
  GSI1PK: string; // "PROJECT#{projectId}"
  GSI1SK: string; // "TASK#{name}"
  GSI2PK: string; // "STATUS#{status}"
  GSI2SK: string; // "TASK#{createdAt}"
  GSI3PK?: string; // "ASSIGNED#{assignedTo}"
  GSI3SK?: string; // "TASK#{dueDate}#{id}"
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: string;
  assignedTo?: string;
  estimatedHours?: number;
  actualHours: number;
  priority: string;
  dueDate?: string;
  tags: string; // JSON serialized array
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ClientDynamoItem {
  PK: string; // "CLIENT#{id}"
  SK: string; // "CLIENT#{id}"
  GSI1PK: string; // "STATUS#{isActive}"
  GSI1SK: string; // "CLIENT#{name}"
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