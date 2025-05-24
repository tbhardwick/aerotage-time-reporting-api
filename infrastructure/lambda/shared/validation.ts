import { CreateInvitationRequest, AcceptInvitationRequest, InvitationErrorCodes } from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  errorCode?: InvitationErrorCodes;
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
  static validatePermissions(permissions: any): boolean {
    if (!permissions || typeof permissions !== 'object') {
      return false;
    }

    if (!Array.isArray(permissions.features) || !Array.isArray(permissions.projects)) {
      return false;
    }

    // Validate features array contains only strings
    if (!permissions.features.every((feature: any) => typeof feature === 'string')) {
      return false;
    }

    // Validate projects array contains only strings
    if (!permissions.projects.every((project: any) => typeof project === 'string')) {
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
    } catch (error) {
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
  static validateCreateInvitationRequest(request: any): ValidationResult {
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
    } else if (!this.validatePermissions(request.permissions)) {
      errors.push('Permissions must contain features and projects arrays');
    }

    // Optional fields validation
    if (request.teamId && typeof request.teamId !== 'string') {
      errors.push('Team ID must be a string');
    }

    if (request.department && typeof request.department !== 'string') {
      errors.push('Department must be a string');
    }

    if (request.jobTitle && typeof request.jobTitle !== 'string') {
      errors.push('Job title must be a string');
    }

    if (request.hourlyRate !== undefined && !this.validateHourlyRate(request.hourlyRate)) {
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
  static validateAcceptInvitationRequest(request: any): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!request.token || typeof request.token !== 'string') {
      errors.push('Token is required and must be a string');
    }

    if (!request.userData || typeof request.userData !== 'object') {
      errors.push('User data is required');
      return { isValid: false, errors };
    }

    const { userData } = request;

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
      const { preferences } = userData;

      if (!this.validateTheme(preferences.theme)) {
        errors.push('Theme must be either "light" or "dark"');
      }

      if (typeof preferences.notifications !== 'boolean') {
        errors.push('Notifications preference must be a boolean');
      }

      if (!preferences.timezone || !this.validateTimezone(preferences.timezone)) {
        errors.push('Valid timezone is required');
      }
    }

    // Optional contact info validation
    if (userData.contactInfo) {
      const { contactInfo } = userData;
      
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
  static validateInvitationFilters(filters: any): ValidationResult {
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
} 