import { InvitationErrorCodes } from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  errorCode?: InvitationErrorCodes;
}

// Validation parameter interfaces
interface ProjectRequest {
  name?: string;
  clientId?: string;
  clientName?: string;
  status?: string;
  defaultBillable?: boolean;
  teamMembers?: unknown[];
  tags?: unknown[];
  createdBy?: string;
  description?: string;
  defaultHourlyRate?: number;
  budget?: {
    type?: string;
    value?: number;
    spent?: number;
  };
  deadline?: string;
}

interface ClientRequest {
  name?: string;
  isActive?: boolean;
  createdBy?: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  defaultHourlyRate?: number;
  notes?: string;
}

interface ProjectFilters {
  clientId?: string;
  status?: string;
  teamMember?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: string;
}

interface ClientFilters {
  isActive?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: string;
}

interface InvitationFilters {
  status?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: string;
}

export class ValidationService {
  /**
   * Validates email format using RFC 5322 compliant regex
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email.toLowerCase());
  }

  /**
   * Validates role is one of the allowed values
   */
  static validateRole(role: string): boolean {
    const allowedRoles = ['admin', 'manager', 'employee'];
    return allowedRoles.includes(role);
  }

  /**
   * Validates permissions structure
   */
  static validatePermissions(permissions: Record<string, unknown>): boolean {
    if (!permissions || typeof permissions !== 'object') {
      return false;
    }

    if (!Array.isArray(permissions.features) || !Array.isArray(permissions.projects)) {
      return false;
    }

    // Validate features array contains only strings
    if (!permissions.features.every((feature: unknown) => typeof feature === 'string')) {
      return false;
    }

    // Validate projects array contains only strings
    if (!permissions.projects.every((project: unknown) => typeof project === 'string')) {
      return false;
    }

    return true;
  }

  /**
   * Validates hourly rate if provided
   */
  static validateHourlyRate(hourlyRate?: number): boolean {
    if (hourlyRate === undefined) return true;
    return typeof hourlyRate === 'number' && hourlyRate >= 0 && hourlyRate <= 1000;
  }

  /**
   * Validates password meets policy requirements
   */
  static validatePassword(password: string): ValidationResult {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
      errorCode: errors.length > 0 ? InvitationErrorCodes.PASSWORD_POLICY_VIOLATION : undefined,
    };
  }

  /**
   * Validates timezone string
   */
  static validateTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates theme preference
   */
  static validateTheme(theme: string): boolean {
    return ['light', 'dark'].includes(theme);
  }

  /**
   * Validates create invitation request
   */
  static validateCreateInvitationRequest(request: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!request.email || typeof request.email !== 'string') {
      errors.push('Email is required and must be a string');
    } else if (!this.validateEmail(request.email)) {
      errors.push('Email format is invalid');
      return {
        isValid: false,
        errors,
        errorCode: InvitationErrorCodes.INVALID_EMAIL,
      };
    }

    if (!request.role || typeof request.role !== 'string') {
      errors.push('Role is required and must be a string');
    } else if (!this.validateRole(request.role)) {
      errors.push('Role must be one of: admin, manager, employee');
    }

    if (!request.permissions) {
      errors.push('Permissions are required');
    } else if (!this.validatePermissions(request.permissions as Record<string, unknown>)) {
      errors.push('Permissions must contain features and projects arrays');
    }

    // Optional fields validation
    if (request.department && typeof request.department !== 'string') {
      errors.push('Department must be a string');
    }

    if (request.jobTitle && typeof request.jobTitle !== 'string') {
      errors.push('Job title must be a string');
    }

    if (request.hourlyRate !== undefined && request.hourlyRate !== null && !this.validateHourlyRate(request.hourlyRate as number)) {
      errors.push('Hourly rate must be a positive number less than 1000');
    }

    if (request.personalMessage && typeof request.personalMessage !== 'string') {
      errors.push('Personal message must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates accept invitation request
   */
  static validateAcceptInvitationRequest(request: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!request.token || typeof request.token !== 'string') {
      errors.push('Token is required and must be a string');
    }

    if (!request.userData || typeof request.userData !== 'object') {
      errors.push('User data is required');
      return { isValid: false, errors };
    }

    const userData = request.userData as Record<string, unknown>; // Type assertion for validation

    if (!userData.name || typeof userData.name !== 'string') {
      errors.push('Name is required and must be a string');
    }

    if (!userData.password || typeof userData.password !== 'string') {
      errors.push('Password is required and must be a string');
    } else {
      const passwordValidation = this.validatePassword(userData.password);
      if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors);
        return {
          isValid: false,
          errors,
          errorCode: passwordValidation.errorCode,
        };
      }
    }

    if (!userData.preferences || typeof userData.preferences !== 'object') {
      errors.push('Preferences are required');
    } else {
      const preferences = userData.preferences as Record<string, unknown>;

      if (!this.validateTheme(preferences.theme as string)) {
        errors.push('Theme must be either "light" or "dark"');
      }

      if (typeof preferences.notifications !== 'boolean') {
        errors.push('Notifications preference must be a boolean');
      }

      if (!preferences.timezone || !this.validateTimezone(preferences.timezone as string)) {
        errors.push('Valid timezone is required');
      }
    }

    // Optional contact info validation
    if (userData.contactInfo) {
      const contactInfo = userData.contactInfo as Record<string, unknown>;
      
      if (contactInfo.phone && typeof contactInfo.phone !== 'string') {
        errors.push('Phone must be a string');
      }

      if (contactInfo.address && typeof contactInfo.address !== 'string') {
        errors.push('Address must be a string');
      }

      if (contactInfo.emergencyContact && typeof contactInfo.emergencyContact !== 'string') {
        errors.push('Emergency contact must be a string');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitizes string input to prevent injection attacks
   */
  static sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .trim()
      .substring(0, 1000); // Limit length
  }

  /**
   * Validates invitation filters for listing
   */
  static validateInvitationFilters(filters: InvitationFilters): ValidationResult {
    const errors: string[] = [];

    if (filters.status && !['pending', 'accepted', 'expired', 'cancelled'].includes(filters.status)) {
      errors.push('Status must be one of: pending, accepted, expired, cancelled');
    }

    if (filters.limit && (typeof filters.limit !== 'number' || filters.limit < 1 || filters.limit > 100)) {
      errors.push('Limit must be a number between 1 and 100');
    }

    if (filters.offset && (typeof filters.offset !== 'number' || filters.offset < 0)) {
      errors.push('Offset must be a non-negative number');
    }

    if (filters.sortBy && !['createdAt', 'expiresAt', 'email'].includes(filters.sortBy)) {
      errors.push('SortBy must be one of: createdAt, expiresAt, email');
    }

    if (filters.sortOrder && !['asc', 'desc'].includes(filters.sortOrder)) {
      errors.push('SortOrder must be either "asc" or "desc"');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates create project request
   */
  static validateCreateProjectRequest(request: ProjectRequest): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!request.name || typeof request.name !== 'string') {
      errors.push('Project name is required and must be a string');
    } else if (request.name.length < 2 || request.name.length > 100) {
      errors.push('Project name must be between 2 and 100 characters');
    }

    if (!request.clientId || typeof request.clientId !== 'string') {
      errors.push('Client ID is required and must be a string');
    }

    if (!request.clientName || typeof request.clientName !== 'string') {
      errors.push('Client name is required and must be a string');
    }

    if (!request.status || !['active', 'paused', 'completed', 'cancelled'].includes(request.status)) {
      errors.push('Status must be one of: active, paused, completed, cancelled');
    }

    if (typeof request.defaultBillable !== 'boolean') {
      errors.push('Default billable status is required and must be a boolean');
    }

    if (!request.teamMembers || !Array.isArray(request.teamMembers)) {
      errors.push('Team members must be an array');
    }

    if (!request.tags || !Array.isArray(request.tags)) {
      errors.push('Tags must be an array');
    }

    if (!request.createdBy || typeof request.createdBy !== 'string') {
      errors.push('Created by is required and must be a string');
    }

    // Optional fields validation
    if (request.description && typeof request.description !== 'string') {
      errors.push('Description must be a string');
    }

    if (request.defaultHourlyRate !== undefined && !this.validateHourlyRate(request.defaultHourlyRate)) {
      errors.push('Default hourly rate must be a positive number less than 1000');
    }

    if (request.budget) {
      if (typeof request.budget !== 'object') {
        errors.push('Budget must be an object');
      } else {
        if (request.budget.type && !['hours', 'amount'].includes(request.budget.type)) {
          errors.push('Budget type must be either "hours" or "amount"');
        }
        if (typeof request.budget.value !== 'number' || request.budget.value <= 0) {
          errors.push('Budget value must be a positive number');
        }
        if (typeof request.budget.spent !== 'number' || request.budget.spent < 0) {
          errors.push('Budget spent must be a non-negative number');
        }
      }
    }

    if (request.deadline && typeof request.deadline !== 'string') {
      errors.push('Deadline must be a string (ISO date)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates update project request
   */
  static validateUpdateProjectRequest(request: ProjectRequest): ValidationResult {
    const errors: string[] = [];

    // All fields are optional for updates, but if provided must be valid
    if (request.name !== undefined) {
      if (typeof request.name !== 'string' || request.name.length < 2 || request.name.length > 100) {
        errors.push('Project name must be a string between 2 and 100 characters');
      }
    }

    if (request.clientId !== undefined && typeof request.clientId !== 'string') {
      errors.push('Client ID must be a string');
    }

    if (request.clientName !== undefined && typeof request.clientName !== 'string') {
      errors.push('Client name must be a string');
    }

    if (request.status !== undefined && !['active', 'paused', 'completed', 'cancelled'].includes(request.status)) {
      errors.push('Status must be one of: active, paused, completed, cancelled');
    }

    if (request.defaultBillable !== undefined && typeof request.defaultBillable !== 'boolean') {
      errors.push('Default billable status must be a boolean');
    }

    if (request.teamMembers !== undefined && !Array.isArray(request.teamMembers)) {
      errors.push('Team members must be an array');
    }

    if (request.tags !== undefined && !Array.isArray(request.tags)) {
      errors.push('Tags must be an array');
    }

    if (request.description !== undefined && typeof request.description !== 'string') {
      errors.push('Description must be a string');
    }

    if (request.defaultHourlyRate !== undefined && !this.validateHourlyRate(request.defaultHourlyRate)) {
      errors.push('Default hourly rate must be a positive number less than 1000');
    }

    if (request.budget !== undefined) {
      if (typeof request.budget !== 'object') {
        errors.push('Budget must be an object');
      } else {
        if (request.budget.type && !['hours', 'amount'].includes(request.budget.type)) {
          errors.push('Budget type must be either "hours" or "amount"');
        }
        if (typeof request.budget.value !== 'number' || request.budget.value <= 0) {
          errors.push('Budget value must be a positive number');
        }
        if (typeof request.budget.spent !== 'number' || request.budget.spent < 0) {
          errors.push('Budget spent must be a non-negative number');
        }
      }
    }

    if (request.deadline !== undefined && typeof request.deadline !== 'string') {
      errors.push('Deadline must be a string (ISO date)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates create client request
   */
  static validateCreateClientRequest(request: ClientRequest): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!request.name || typeof request.name !== 'string') {
      errors.push('Client name is required and must be a string');
    } else if (request.name.length < 2 || request.name.length > 100) {
      errors.push('Client name must be between 2 and 100 characters');
    }

    if (typeof request.isActive !== 'boolean') {
      errors.push('Active status is required and must be a boolean');
    }

    if (!request.createdBy || typeof request.createdBy !== 'string') {
      errors.push('Created by is required and must be a string');
    }

    // Optional fields validation
    if (request.email && (typeof request.email !== 'string' || !this.validateEmail(request.email))) {
      errors.push('Email must be a valid email address');
    }

    if (request.phone && typeof request.phone !== 'string') {
      errors.push('Phone must be a string');
    }

    if (request.address && typeof request.address !== 'string') {
      errors.push('Address must be a string');
    }

    if (request.contactPerson && typeof request.contactPerson !== 'string') {
      errors.push('Contact person must be a string');
    }

    if (request.defaultHourlyRate !== undefined && !this.validateHourlyRate(request.defaultHourlyRate)) {
      errors.push('Default hourly rate must be a positive number less than 1000');
    }

    if (request.notes && typeof request.notes !== 'string') {
      errors.push('Notes must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates update client request
   */
  static validateUpdateClientRequest(request: Partial<ClientRequest>): ValidationResult {
    const errors: string[] = [];

    // All fields are optional for updates, but if provided must be valid
    if (request.name !== undefined) {
      if (typeof request.name !== 'string' || request.name.length < 2 || request.name.length > 100) {
        errors.push('Client name must be a string between 2 and 100 characters');
      }
    }

    if (request.isActive !== undefined && typeof request.isActive !== 'boolean') {
      errors.push('Active status must be a boolean');
    }

    if (request.email !== undefined && (typeof request.email !== 'string' || !this.validateEmail(request.email))) {
      errors.push('Email must be a valid email address');
    }

    if (request.phone !== undefined && typeof request.phone !== 'string') {
      errors.push('Phone must be a string');
    }

    if (request.address !== undefined && typeof request.address !== 'string') {
      errors.push('Address must be a string');
    }

    if (request.contactPerson !== undefined && typeof request.contactPerson !== 'string') {
      errors.push('Contact person must be a string');
    }

    if (request.defaultHourlyRate !== undefined && !this.validateHourlyRate(request.defaultHourlyRate)) {
      errors.push('Default hourly rate must be a positive number less than 1000');
    }

    if (request.notes !== undefined && typeof request.notes !== 'string') {
      errors.push('Notes must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates project filters for listing
   */
  static validateProjectFilters(filters: ProjectFilters): ValidationResult {
    const errors: string[] = [];

    if (filters.clientId && typeof filters.clientId !== 'string') {
      errors.push('Client ID must be a string');
    }

    if (filters.status && !['active', 'paused', 'completed', 'cancelled'].includes(filters.status)) {
      errors.push('Status must be one of: active, paused, completed, cancelled');
    }

    if (filters.teamMember && typeof filters.teamMember !== 'string') {
      errors.push('Team member must be a string');
    }

    if (filters.limit && (typeof filters.limit !== 'number' || filters.limit < 1 || filters.limit > 100)) {
      errors.push('Limit must be a number between 1 and 100');
    }

    if (filters.offset && (typeof filters.offset !== 'number' || filters.offset < 0)) {
      errors.push('Offset must be a non-negative number');
    }

    if (filters.sortBy && !['name', 'createdAt', 'deadline'].includes(filters.sortBy)) {
      errors.push('SortBy must be one of: name, createdAt, deadline');
    }

    if (filters.sortOrder && !['asc', 'desc'].includes(filters.sortOrder)) {
      errors.push('SortOrder must be either "asc" or "desc"');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates client filters for listing
   */
  static validateClientFilters(filters: ClientFilters): ValidationResult {
    const errors: string[] = [];

    if (filters.isActive !== undefined && typeof filters.isActive !== 'boolean') {
      errors.push('Active status must be a boolean');
    }

    if (filters.limit && (typeof filters.limit !== 'number' || filters.limit < 1 || filters.limit > 100)) {
      errors.push('Limit must be a number between 1 and 100');
    }

    if (filters.offset && (typeof filters.offset !== 'number' || filters.offset < 0)) {
      errors.push('Offset must be a non-negative number');
    }

    if (filters.sortBy && !['name', 'createdAt'].includes(filters.sortBy)) {
      errors.push('SortBy must be one of: name, createdAt');
    }

    if (filters.sortOrder && !['asc', 'desc'].includes(filters.sortOrder)) {
      errors.push('SortOrder must be either "asc" or "desc"');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates record payment request
   */
  static validateRecordPaymentRequest(request: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (typeof request.amount !== 'number' || request.amount <= 0) {
      errors.push('Amount is required and must be a positive number');
    }

    if (!request.paymentDate || typeof request.paymentDate !== 'string') {
      errors.push('Payment date is required and must be a string (ISO date)');
    }

    if (!request.paymentMethod || typeof request.paymentMethod !== 'string') {
      errors.push('Payment method is required and must be a string');
    }

    // Optional fields validation
    if (request.reference !== undefined && typeof request.reference !== 'string') {
      errors.push('Reference must be a string');
    }

    if (request.notes !== undefined && typeof request.notes !== 'string') {
      errors.push('Notes must be a string');
    }

    if (request.externalPaymentId !== undefined && typeof request.externalPaymentId !== 'string') {
      errors.push('External payment ID must be a string');
    }

    if (request.processorFee !== undefined && (typeof request.processorFee !== 'number' || request.processorFee < 0)) {
      errors.push('Processor fee must be a non-negative number');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate create user request
   */
  static validateCreateUserRequest(request: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!request.email || typeof request.email !== 'string') {
      errors.push('email is required and must be a string');
    } else if (!this.validateEmail(request.email)) {
      errors.push('email must be a valid email address');
    }

    if (!request.name || typeof request.name !== 'string') {
      errors.push('name is required and must be a string');
    } else if (request.name.trim().length < 2) {
      errors.push('name must be at least 2 characters long');
    }

    // Optional fields validation
    if (request.role && typeof request.role === 'string') {
      const validRoles = ['admin', 'manager', 'employee'];
      if (!validRoles.includes(request.role)) {
        errors.push('role must be one of: admin, manager, employee');
      }
    }

    if (request.department && typeof request.department !== 'string') {
      errors.push('department must be a string');
    }

    if (request.jobTitle && typeof request.jobTitle !== 'string') {
      errors.push('jobTitle must be a string');
    }

    if (request.hourlyRate !== undefined) {
      if (typeof request.hourlyRate !== 'number' || request.hourlyRate < 0) {
        errors.push('hourlyRate must be a positive number');
      }
    }

    if (request.startDate && typeof request.startDate === 'string') {
      // Simple date validation for YYYY-MM-DD format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(request.startDate)) {
        errors.push('startDate must be a valid ISO date (YYYY-MM-DD)');
      }
    }

    // Validate permissions if provided
    if (request.permissions) {
      if (typeof request.permissions !== 'object' || request.permissions === null) {
        errors.push('permissions must be an object');
      } else {
        const permissions = request.permissions as Record<string, unknown>;
        
        if (permissions.features && !Array.isArray(permissions.features)) {
          errors.push('permissions.features must be an array');
        }
        
        if (permissions.projects && !Array.isArray(permissions.projects)) {
          errors.push('permissions.projects must be an array');
        }
      }
    }

    // Validate contact info if provided
    if (request.contactInfo) {
      if (typeof request.contactInfo !== 'object' || request.contactInfo === null) {
        errors.push('contactInfo must be an object');
      } else {
        const contactInfo = request.contactInfo as Record<string, unknown>;
        
        if (contactInfo.phone && typeof contactInfo.phone !== 'string') {
          errors.push('contactInfo.phone must be a string');
        }
        
        if (contactInfo.address && typeof contactInfo.address !== 'string') {
          errors.push('contactInfo.address must be a string');
        }
        
        if (contactInfo.emergencyContact && typeof contactInfo.emergencyContact !== 'string') {
          errors.push('contactInfo.emergencyContact must be a string');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
} 