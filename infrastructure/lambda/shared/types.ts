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

// Create User Request Type
export interface CreateUserRequest {
  email: string;
  name: string;
  role?: 'admin' | 'manager' | 'employee';
  department?: string;
  jobTitle?: string;
  hourlyRate?: number;
  permissions?: {
    features: string[];
    projects: string[];
  };
  startDate?: string; // ISO date
  contactInfo?: {
    phone?: string;
    address?: string;
    emergencyContact?: string;
  };
}

// User Error Codes
export enum UserErrorCodes {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  INVALID_USER_DATA = 'INVALID_USER_DATA',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  INVALID_EMAIL_FORMAT = 'INVALID_EMAIL_FORMAT',
  INVALID_ROLE = 'INVALID_ROLE',
  INVALID_HOURLY_RATE = 'INVALID_HOURLY_RATE',
  USER_CREATION_FAILED = 'USER_CREATION_FAILED',
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
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

export interface SuccessResponse<T = Record<string, unknown>> {
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

// ==========================
// Invoice & Billing Types - Phase 7
// ==========================

// Core Invoice Types
export interface Invoice {
  id: string;
  invoiceNumber: string; // Auto-generated unique number (e.g., "INV-2024-001")
  clientId: string;
  clientName: string;
  projectIds: string[]; // Projects included in this invoice
  timeEntryIds: string[]; // Time entries included in this invoice
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  
  // Invoice Details
  issueDate: string; // ISO date
  dueDate: string; // ISO date
  paidDate?: string; // ISO date when payment was received
  
  // Financial Information
  subtotal: number; // Total before tax
  taxRate?: number; // Tax percentage (e.g., 0.08 for 8%)
  taxAmount?: number; // Calculated tax amount
  discountRate?: number; // Discount percentage
  discountAmount?: number; // Calculated discount amount
  totalAmount: number; // Final amount after tax and discount
  currency: string; // e.g., "USD", "EUR"
  
  // Line Items
  lineItems: InvoiceLineItem[];
  
  // Template and Customization
  templateId?: string; // Reference to invoice template
  customFields?: Record<string, unknown>; // Custom fields from template
  
  // Payment Information
  paymentTerms: string; // e.g., "Net 30", "Due on receipt"
  paymentMethod?: string; // e.g., "Bank Transfer", "Credit Card"
  paymentReference?: string; // Payment confirmation number
  
  // Recurring Invoice Information
  isRecurring: boolean;
  recurringConfig?: RecurringInvoiceConfig;
  parentInvoiceId?: string; // For recurring invoices, reference to original
  
  // File Storage
  pdfUrl?: string; // S3 URL to generated PDF
  attachments?: string[]; // Additional file attachments
  
  // Communication
  sentAt?: string; // ISO datetime when invoice was sent
  viewedAt?: string; // ISO datetime when client first viewed
  remindersSent: number; // Count of payment reminders sent
  lastReminderSent?: string; // ISO datetime of last reminder
  
  // Notes and Comments
  notes?: string; // Internal notes
  clientNotes?: string; // Notes visible to client
  
  // Audit Trail
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
  createdBy: string; // User ID who created the invoice
  sentBy?: string; // User ID who sent the invoice
}

// Invoice Line Item
export interface InvoiceLineItem {
  id: string;
  type: 'time' | 'expense' | 'fixed' | 'discount';
  description: string;
  quantity: number; // Hours for time entries, quantity for other items
  rate: number; // Hourly rate or unit price
  amount: number; // quantity * rate
  
  // Time Entry Reference (for time-based line items)
  timeEntryId?: string;
  projectId?: string;
  projectName?: string;
  date?: string; // ISO date for time entries
  
  // Tax Information
  taxable: boolean;
  taxRate?: number;
  taxAmount?: number;
}

// Recurring Invoice Configuration
export interface RecurringInvoiceConfig {
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number; // e.g., 2 for "every 2 months"
  startDate: string; // ISO date when recurring starts
  endDate?: string; // ISO date when recurring ends (null for indefinite)
  nextInvoiceDate: string; // ISO date for next invoice generation
  maxInvoices?: number; // Maximum number of invoices to generate
  invoicesGenerated: number; // Count of invoices generated so far
  isActive: boolean; // Whether recurring is currently active
  
  // Auto-generation settings
  autoSend: boolean; // Automatically send generated invoices
  generateDaysBefore: number; // Days before due date to generate
  
  // Template settings for recurring invoices
  templateId?: string;
  customFields?: Record<string, unknown>;
}

// Invoice Template
export interface InvoiceTemplate {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  
  // Template Design
  layout: 'standard' | 'modern' | 'minimal' | 'detailed';
  colorScheme: {
    primary: string; // Hex color
    secondary: string; // Hex color
    accent: string; // Hex color
  };
  
  // Company Information
  companyInfo: {
    name: string;
    logo?: string; // S3 URL to logo image
    address: string;
    phone?: string;
    email?: string;
    website?: string;
    taxId?: string; // Tax identification number
  };
  
  // Template Fields
  fields: {
    showProjectDetails: boolean;
    showTimeEntryDetails: boolean;
    showTaskBreakdown: boolean;
    showHourlyRates: boolean;
    groupByProject: boolean;
    groupByDate: boolean;
    includeNotes: boolean;
    includeAttachments: boolean;
  };
  
  // Custom Fields
  customFields: InvoiceTemplateField[];
  
  // Terms and Conditions
  paymentTerms: string;
  termsAndConditions?: string;
  footerText?: string;
  
  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Invoice Template Custom Field
export interface InvoiceTemplateField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  required: boolean;
  defaultValue?: string | number | boolean;
  options?: string[]; // For select type
  placeholder?: string;
  helpText?: string;
}

// Payment Tracking
export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paymentDate: string; // ISO date
  paymentMethod: string; // e.g., "Bank Transfer", "Credit Card", "Check"
  reference?: string; // Payment reference number
  notes?: string;
  
  // Payment Status
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  
  // External Integration
  externalPaymentId?: string; // ID from payment processor
  processorFee?: number; // Fee charged by payment processor
  
  // Audit
  createdAt: string;
  updatedAt: string;
  recordedBy: string; // User ID who recorded the payment
}

// Invoice Request Types
export interface CreateInvoiceRequest {
  clientId: string;
  projectIds?: string[];
  timeEntryIds?: string[];
  templateId?: string;
  
  // Invoice Details
  issueDate?: string; // Defaults to today
  dueDate?: string; // Calculated based on payment terms
  paymentTerms?: string; // Defaults to client's default
  
  // Financial
  currency?: string; // Defaults to client's default
  taxRate?: number;
  discountRate?: number;
  
  // Additional Items
  additionalLineItems?: Omit<InvoiceLineItem, 'id'>[];
  
  // Notes
  notes?: string;
  clientNotes?: string;
  
  // Recurring
  isRecurring?: boolean;
  recurringConfig?: Omit<RecurringInvoiceConfig, 'invoicesGenerated' | 'nextInvoiceDate'>;
}

export interface UpdateInvoiceRequest {
  status?: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  dueDate?: string;
  paymentTerms?: string;
  taxRate?: number;
  discountRate?: number;
  lineItems?: InvoiceLineItem[];
  notes?: string;
  clientNotes?: string;
  customFields?: Record<string, unknown>;
}

export interface InvoiceFilters {
  clientId?: string;
  projectId?: string;
  status?: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  isRecurring?: boolean;
  dateFrom?: string; // ISO date
  dateTo?: string; // ISO date
  dueDateFrom?: string; // ISO date
  dueDateTo?: string; // ISO date
  amountMin?: number;
  amountMax?: number;
  currency?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'invoiceNumber' | 'issueDate' | 'dueDate' | 'totalAmount' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface SendInvoiceRequest {
  recipientEmails?: string[]; // Override default client email
  subject?: string; // Custom email subject
  message?: string; // Custom email message
  attachPdf: boolean; // Whether to attach PDF
  sendCopy: boolean; // Send copy to sender
  scheduleDate?: string; // ISO datetime to schedule sending
}

export interface RecordPaymentRequest {
  amount: number;
  paymentDate: string; // ISO date
  paymentMethod: string;
  reference?: string;
  notes?: string;
  externalPaymentId?: string;
  processorFee?: number;
}

// Invoice Generation Options
export interface GenerateInvoiceOptions {
  timeEntryFilters?: {
    dateFrom: string;
    dateTo: string;
    projectIds?: string[];
    status?: 'approved'; // Only approved time entries
    isBillable?: boolean; // Only billable time entries
  };
  grouping: {
    byProject: boolean;
    byDate: boolean;
    byTask: boolean;
  };
  includeExpenses: boolean;
  templateId?: string;
  autoCalculateTax: boolean;
  roundingPrecision: number; // Decimal places for rounding
}

// Invoice Statistics
export interface InvoiceStats {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  averagePaymentTime: number; // Days
  
  // Status Breakdown
  statusBreakdown: {
    draft: number;
    sent: number;
    viewed: number;
    paid: number;
    overdue: number;
    cancelled: number;
  };
  
  // Monthly Breakdown
  monthlyBreakdown: {
    month: string; // YYYY-MM
    invoiced: number;
    paid: number;
    outstanding: number;
  }[];
}

// Invoice Error Types
export enum InvoiceErrorCodes {
  // Invoice errors
  INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND',
  UNAUTHORIZED_INVOICE_ACCESS = 'UNAUTHORIZED_INVOICE_ACCESS',
  INVALID_INVOICE_DATA = 'INVALID_INVOICE_DATA',
  INVOICE_ALREADY_SENT = 'INVOICE_ALREADY_SENT',
  INVOICE_ALREADY_PAID = 'INVOICE_ALREADY_PAID',
  INVOICE_CANNOT_BE_MODIFIED = 'INVOICE_CANNOT_BE_MODIFIED',
  
  // Template errors
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  INVALID_TEMPLATE_DATA = 'INVALID_TEMPLATE_DATA',
  TEMPLATE_IN_USE = 'TEMPLATE_IN_USE',
  
  // Payment errors
  PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
  INVALID_PAYMENT_AMOUNT = 'INVALID_PAYMENT_AMOUNT',
  PAYMENT_EXCEEDS_INVOICE = 'PAYMENT_EXCEEDS_INVOICE',
  PAYMENT_ALREADY_RECORDED = 'PAYMENT_ALREADY_RECORDED',
  
  // Generation errors
  NO_BILLABLE_TIME_ENTRIES = 'NO_BILLABLE_TIME_ENTRIES',
  INVALID_TIME_ENTRY_SELECTION = 'INVALID_TIME_ENTRY_SELECTION',
  TIME_ENTRIES_ALREADY_INVOICED = 'TIME_ENTRIES_ALREADY_INVOICED',
  
  // Recurring invoice errors
  INVALID_RECURRING_CONFIG = 'INVALID_RECURRING_CONFIG',
  RECURRING_INVOICE_LIMIT_REACHED = 'RECURRING_INVOICE_LIMIT_REACHED',
  RECURRING_INVOICE_ENDED = 'RECURRING_INVOICE_ENDED',
  
  // Email errors
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  INVALID_EMAIL_RECIPIENTS = 'INVALID_EMAIL_RECIPIENTS',
  
  // PDF errors
  PDF_GENERATION_FAILED = 'PDF_GENERATION_FAILED',
  PDF_UPLOAD_FAILED = 'PDF_UPLOAD_FAILED',
  
  // Validation errors
  INVALID_CURRENCY = 'INVALID_CURRENCY',
  INVALID_TAX_RATE = 'INVALID_TAX_RATE',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  NEGATIVE_AMOUNT = 'NEGATIVE_AMOUNT',
}

// DynamoDB Item Types for Invoices
export interface InvoiceDynamoItem {
  PK: string; // "INVOICE#{id}"
  SK: string; // "INVOICE#{id}"
  GSI1PK: string; // "CLIENT#{clientId}"
  GSI1SK: string; // "INVOICE#{issueDate}#{invoiceNumber}"
  GSI2PK: string; // "STATUS#{status}"
  GSI2SK: string; // "INVOICE#{dueDate}#{id}"
  GSI3PK: string; // "INVOICE_NUMBER#{invoiceNumber}"
  GSI3SK: string; // "INVOICE#{id}"
  
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  projectIds: string; // JSON serialized array
  timeEntryIds: string; // JSON serialized array
  status: string;
  
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  discountRate?: number;
  discountAmount?: number;
  totalAmount: number;
  currency: string;
  
  lineItems: string; // JSON serialized array
  templateId?: string;
  customFields?: string; // JSON serialized
  
  paymentTerms: string;
  paymentMethod?: string;
  paymentReference?: string;
  
  isRecurring: boolean;
  recurringConfig?: string; // JSON serialized
  parentInvoiceId?: string;
  
  pdfUrl?: string;
  attachments?: string; // JSON serialized array
  
  sentAt?: string;
  viewedAt?: string;
  remindersSent: number;
  lastReminderSent?: string;
  
  notes?: string;
  clientNotes?: string;
  
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  sentBy?: string;
}

export interface InvoiceTemplateDynamoItem {
  PK: string; // "TEMPLATE#{id}"
  SK: string; // "TEMPLATE#{id}"
  GSI1PK: string; // "TEMPLATE_TYPE#invoice"
  GSI1SK: string; // "TEMPLATE#{name}"
  
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  
  layout: string;
  colorScheme: string; // JSON serialized
  companyInfo: string; // JSON serialized
  fields: string; // JSON serialized
  customFields: string; // JSON serialized array
  
  paymentTerms: string;
  termsAndConditions?: string;
  footerText?: string;
  
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface PaymentDynamoItem {
  PK: string; // "PAYMENT#{id}"
  SK: string; // "PAYMENT#{id}"
  GSI1PK: string; // "INVOICE#{invoiceId}"
  GSI1SK: string; // "PAYMENT#{paymentDate}#{id}"
  GSI2PK: string; // "STATUS#{status}"
  GSI2SK: string; // "PAYMENT#{paymentDate}#{id}"
  
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  
  status: string;
  externalPaymentId?: string;
  processorFee?: number;
  
  createdAt: string;
  updatedAt: string;
  recordedBy: string;
}

// ✅ NEW - Daily and Weekly Time Tracking Types
export interface UserWorkSchedule {
  userId: string;
  schedule: {
    monday: WorkDaySchedule;
    tuesday: WorkDaySchedule;
    wednesday: WorkDaySchedule;
    thursday: WorkDaySchedule;
    friday: WorkDaySchedule;
    saturday: WorkDaySchedule;
    sunday: WorkDaySchedule;
  };
  timezone: string;
  weeklyTargetHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkDaySchedule {
  start: string | null; // HH:MM format or null for non-working day
  end: string | null; // HH:MM format or null for non-working day
  targetHours: number; // Target hours for this day
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  totalMinutes: number;
  totalHours: number;
  billableMinutes: number;
  billableHours: number;
  nonBillableMinutes: number;
  nonBillableHours: number;
  targetMinutes: number;
  targetHours: number;
  completionPercentage: number;
  entriesCount: number;
  projectBreakdown: ProjectTimeBreakdown[];
  timeGaps: TimeGap[];
  workingHours: {
    firstEntry: string | null; // HH:MM
    lastEntry: string | null; // HH:MM
    totalSpan: string | null; // "Xh Ym"
  };
}

export interface ProjectTimeBreakdown {
  projectId: string;
  projectName: string;
  clientName: string;
  minutes: number;
  hours: number;
  percentage: number;
}

export interface TimeGap {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMinutes: number;
  suggestedAction: 'break' | 'untracked' | 'extend_previous' | 'add_entry';
  suggestions?: GapSuggestion[];
}

export interface GapSuggestion {
  action: 'add_break' | 'extend_previous' | 'add_entry';
  description: string;
  entryId?: string; // For extend_previous action
}

export interface WeeklyOverview {
  weekInfo: {
    weekStartDate: string; // YYYY-MM-DD (Monday)
    weekEndDate: string; // YYYY-MM-DD (Friday)
    weekNumber: number;
    year: number;
  };
  dailySummaries: DailySummary[];
  weeklyTotals: {
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    targetHours: number;
    completionPercentage: number;
    totalEntries: number;
  };
  patterns: {
    mostProductiveDay: string;
    leastProductiveDay: string;
    averageStartTime: string; // HH:MM
    averageEndTime: string; // HH:MM
    longestWorkDay: string;
    shortestWorkDay: string;
  };
  projectDistribution: WeeklyProjectBreakdown[];
  comparison?: {
    previousWeek: {
      totalHours: number;
      change: string; // "+3.5" or "-2.0"
      changePercentage: string; // "+10.0%" or "-5.5%"
    };
  };
}

export interface WeeklyProjectBreakdown {
  projectId: string;
  projectName: string;
  clientName: string;
  totalHours: number;
  percentage: number;
  dailyBreakdown: {
    date: string; // YYYY-MM-DD
    hours: number;
  }[];
}

export interface TimeGapAnalysis {
  date: string; // YYYY-MM-DD
  workingHours: {
    start: string; // HH:MM
    end: string; // HH:MM
    totalMinutes: number;
  };
  trackedTime: {
    totalMinutes: number;
    percentage: number;
  };
  gaps: TimeGap[];
  recommendations: GapRecommendation[];
}

export interface GapRecommendation {
  type: 'fill_gap' | 'adjust_schedule' | 'break_reminder';
  message: string;
  action: string;
}

// Request/Response Types
export interface DailySummaryRequest {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  userId?: string;
  includeGaps?: boolean;
  targetHours?: number;
}

export interface DailySummaryResponse {
  summaries: DailySummary[];
  periodSummary: {
    totalDays: number;
    workDays: number;
    totalHours: number;
    averageHoursPerDay: number;
    targetHours: number;
    completionPercentage: number;
  };
}

export interface WeeklyOverviewRequest {
  weekStartDate: string; // YYYY-MM-DD (Monday)
  userId?: string;
  includeComparison?: boolean;
}

export interface TimeGapAnalysisRequest {
  date: string; // YYYY-MM-DD
  userId?: string;
  workStartTime?: string; // HH:MM
  workEndTime?: string; // HH:MM
  minimumGapMinutes?: number;
}

export interface QuickTimeEntryRequest {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  projectId: string;
  description: string;
  isBillable?: boolean;
  fillGap?: boolean;
}

export interface UpdateWorkScheduleRequest {
  schedule?: {
    [key in keyof UserWorkSchedule['schedule']]?: WorkDaySchedule;
  };
  timezone?: string;
}

// DynamoDB Item Types
export interface UserWorkScheduleDynamoItem {
  PK: string; // "USER#{userId}"
  SK: string; // "WORK_SCHEDULE"
  userId: string;
  schedule: string; // JSON serialized
  timezone: string;
  weeklyTargetHours: number;
  createdAt: string;
  updatedAt: string;
}

// Error Codes
export enum TimeTrackingErrorCodes {
  // Work schedule errors
  WORK_SCHEDULE_NOT_FOUND = 'WORK_SCHEDULE_NOT_FOUND',
  INVALID_WORK_SCHEDULE = 'INVALID_WORK_SCHEDULE',
  INVALID_TIMEZONE = 'INVALID_TIMEZONE',
  INVALID_TIME_FORMAT = 'INVALID_TIME_FORMAT',
  
  // Gap analysis errors
  INVALID_DATE_FOR_ANALYSIS = 'INVALID_DATE_FOR_ANALYSIS',
  NO_TIME_ENTRIES_FOUND = 'NO_TIME_ENTRIES_FOUND',
  INVALID_WORKING_HOURS = 'INVALID_WORKING_HOURS',
  
  // Daily/weekly summary errors
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  DATE_RANGE_TOO_LARGE = 'DATE_RANGE_TOO_LARGE',
  FUTURE_DATE_NOT_ALLOWED = 'FUTURE_DATE_NOT_ALLOWED',
  
  // Quick entry errors
  TIME_OVERLAP_DETECTED = 'TIME_OVERLAP_DETECTED',
  INVALID_TIME_RANGE = 'INVALID_TIME_RANGE',
  GAP_ALREADY_FILLED = 'GAP_ALREADY_FILLED',
  INVALID_TIME_ENTRY_DATA = 'INVALID_TIME_ENTRY_DATA',
}

// ===========================
// Email Change Workflow Types
// ===========================

export interface EmailChangeRequest {
  id: string;
  userId: string;
  currentEmail: string;
  newEmail: string;
  status: 'pending_verification' | 'pending_approval' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  reason: 'name_change' | 'company_change' | 'personal_preference' | 'security_concern' | 'other';
  customReason?: string;
  
  // Verification tracking
  currentEmailVerified: boolean;
  newEmailVerified: boolean;
  currentEmailVerificationToken?: string;
  newEmailVerificationToken?: string;
  verificationTokensExpiresAt?: string; // ISO datetime
  
  // Approval tracking
  approvedBy?: string;
  approvedAt?: string; // ISO datetime
  rejectedBy?: string;
  rejectedAt?: string; // ISO datetime
  rejectionReason?: string;
  
  // Completion tracking
  completedAt?: string; // ISO datetime
  estimatedCompletionTime?: string; // ISO datetime
  
  // Audit fields
  requestedAt: string; // ISO datetime
  verifiedAt?: string; // ISO datetime
  cancelledAt?: string; // ISO datetime
  cancelledBy?: string;
  
  // Metadata
  ipAddress?: string;
  userAgent?: string;
}

export interface EmailChangeAuditLog {
  id: string;
  requestId: string;
  action: 'created' | 'current_email_verified' | 'new_email_verified' | 'approved' | 'rejected' | 'completed' | 'cancelled' | 'verification_resent';
  performedBy?: string;
  performedAt: string; // ISO datetime
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// API Request/Response Types
export interface CreateEmailChangeRequest {
  newEmail: string;
  reason: 'name_change' | 'company_change' | 'personal_preference' | 'security_concern' | 'other';
  customReason?: string;
}

export interface EmailVerificationRequest {
  token: string;
  emailType: 'current' | 'new';
}

export interface EmailChangeRequestFilters {
  status?: 'pending_verification' | 'pending_approval' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  userId?: string;
  reason?: string;
  dateFrom?: string; // ISO date
  dateTo?: string; // ISO date
  limit?: number;
  offset?: number;
  sortBy?: 'requestedAt' | 'status' | 'reason';
  sortOrder?: 'asc' | 'desc';
}

export interface ResendVerificationRequest {
  emailType: 'current' | 'new';
}

export interface ApproveEmailChangeRequest {
  approvalNotes?: string;
}

export interface RejectEmailChangeRequest {
  rejectionReason: string;
}

// Response Types
export interface EmailChangeRequestResponse {
  success: boolean;
  data: {
    requestId: string;
    status: string;
    currentEmail: string;
    newEmail: string;
    reason: string;
    customReason?: string;
    requestedAt: string;
    estimatedCompletionTime?: string;
    verificationRequired: {
      currentEmail: boolean;
      newEmail: boolean;
    };
    nextSteps: string[];
  };
  message: string;
}

export interface EmailVerificationResponse {
  success: boolean;
  data: {
    requestId: string;
    emailType: 'current' | 'new';
    verified: boolean;
    verificationStatus: {
      currentEmailVerified: boolean;
      newEmailVerified: boolean;
    };
    nextStep: 'verify_other_email' | 'pending_approval' | 'auto_approved' | 'processing';
    message: string;
  };
}

export interface EmailChangeRequestsResponse {
  success: boolean;
  data: {
    requests: EmailChangeRequest[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

export interface CancelRequestResponse {
  success: boolean;
  data: {
    requestId: string;
    status: 'cancelled';
    cancelledAt: string;
    cancelledBy: string;
  };
  message: string;
}

export interface ResendVerificationResponse {
  success: boolean;
  data: {
    requestId: string;
    emailType: 'current' | 'new';
    emailAddress: string;
    resentAt: string;
    expiresAt: string;
  };
  message: string;
}

export interface ApproveRequestResponse {
  success: boolean;
  data: {
    requestId: string;
    status: 'approved';
    approvedAt: string;
    approvedBy: {
      id: string;
      name: string;
    };
    estimatedCompletionTime?: string;
  };
  message: string;
}

export interface RejectRequestResponse {
  success: boolean;
  data: {
    requestId: string;
    status: 'rejected';
    rejectedAt: string;
    rejectedBy: {
      id: string;
      name: string;
    };
    rejectionReason: string;
  };
  message: string;
}

// Error Codes
export enum EmailChangeErrorCodes {
  // Request errors
  EMAIL_CHANGE_REQUEST_NOT_FOUND = 'EMAIL_CHANGE_REQUEST_NOT_FOUND',
  ACTIVE_REQUEST_EXISTS = 'ACTIVE_REQUEST_EXISTS',
  COOLDOWN_ACTIVE = 'COOLDOWN_ACTIVE',
  INVALID_NEW_EMAIL = 'INVALID_NEW_EMAIL',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  SAME_AS_CURRENT_EMAIL = 'SAME_AS_CURRENT_EMAIL',
  
  // Verification errors
  INVALID_VERIFICATION_TOKEN = 'INVALID_VERIFICATION_TOKEN',
  VERIFICATION_TOKEN_EXPIRED = 'VERIFICATION_TOKEN_EXPIRED',
  EMAIL_ALREADY_VERIFIED = 'EMAIL_ALREADY_VERIFIED',
  VERIFICATION_RATE_LIMITED = 'VERIFICATION_RATE_LIMITED',
  
  // Approval errors
  INSUFFICIENT_APPROVAL_PERMISSIONS = 'INSUFFICIENT_APPROVAL_PERMISSIONS',
  REQUEST_NOT_PENDING_APPROVAL = 'REQUEST_NOT_PENDING_APPROVAL',
  REQUEST_NOT_APPROVED = 'REQUEST_NOT_APPROVED',
  
  // Cancellation errors
  CANNOT_CANCEL_REQUEST = 'CANNOT_CANCEL_REQUEST',
  REQUEST_ALREADY_COMPLETED = 'REQUEST_ALREADY_COMPLETED',
  
  // Email errors
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  INVALID_EMAIL_TYPE = 'INVALID_EMAIL_TYPE',
  
  // Validation errors
  INVALID_REASON = 'INVALID_REASON',
  CUSTOM_REASON_REQUIRED = 'CUSTOM_REASON_REQUIRED',
  INVALID_REQUEST_DATA = 'INVALID_REQUEST_DATA',
  
  // System errors
  EMAIL_CHANGE_FAILED = 'EMAIL_CHANGE_FAILED',
  AUDIT_LOG_FAILED = 'AUDIT_LOG_FAILED',
}

// DynamoDB Item Types
export interface EmailChangeRequestDynamoItem {
  id: string;
  userId: string;
  currentEmail: string;
  newEmail: string;
  status: string;
  reason: string;
  customReason?: string;
  
  currentEmailVerified: boolean;
  newEmailVerified: boolean;
  currentEmailVerificationToken?: string;
  newEmailVerificationToken?: string;
  verificationTokensExpiresAt?: string;
  
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  
  completedAt?: string;
  estimatedCompletionTime?: string;
  
  requestedAt: string;
  verifiedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  
  ipAddress?: string;
  userAgent?: string;
}

export interface EmailChangeAuditLogDynamoItem {
  id: string;
  requestId: string;
  action: string;
  performedBy?: string;
  performedAt: string;
  details?: string; // JSON serialized
  ipAddress?: string;
  userAgent?: string;
}

// Configuration Types
export interface EmailChangeConfig {
  verificationTokenExpiryHours: number;
  maxActiveRequestsPerUser: number;
  requestCooldownHours: number;
  autoApprovalReasons: string[];
  adminApprovalRequired: {
    roles: string[];
    reasons: string[];
    domainChanges: boolean;
  };
  emailTemplates: {
    verificationSubject: string;
    verificationTemplate: string;
    approvalNotificationTemplate: string;
    completionNotificationTemplate: string;
  };
}

export interface ProcessEmailChangeRequest {
  // This request type is intentionally minimal as processing is typically automated
  // Additional fields can be added if manual processing options are needed
  force?: boolean; // Force processing even if there are warnings
  notes?: string; // Optional processing notes
}

export interface ProcessEmailChangeResponse {
  success: boolean;
  data: {
    requestId: string;
    status: 'completed';
    oldEmail: string;
    newEmail: string;
    completedAt: string;
    processedBy: {
      id: string;
      name: string;
    };
  };
  message: string;
} 