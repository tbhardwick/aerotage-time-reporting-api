import { EmailChangeErrorCodes } from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class EmailChangeValidation {
  // Validate email change request
  static validateCreateEmailChangeRequest(request: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    // Check required fields
    if (!request.newEmail) {
      errors.push('New email address is required');
    }

    if (!request.reason) {
      errors.push('Reason for email change is required');
    }

    // Validate email format
    if (request.newEmail && typeof request.newEmail === 'string') {
      if (!this.isValidEmail(request.newEmail)) {
        errors.push('Invalid email format');
      }
    }

    // Validate reason
    if (request.reason && typeof request.reason === 'string') {
      const validReasons = ['name_change', 'company_change', 'personal_preference', 'security_concern', 'other'];
      if (!validReasons.includes(request.reason)) {
        errors.push(`Invalid reason. Must be one of: ${validReasons.join(', ')}`);
      }

      // Check if custom reason is required
      if (request.reason === 'other' && (!request.customReason || typeof request.customReason !== 'string' || request.customReason.trim() === '')) {
        errors.push('Custom reason is required when reason is "other"');
      }
    }

    // Validate custom reason length
    if (request.customReason && typeof request.customReason === 'string') {
      if (request.customReason.length > 500) {
        errors.push('Custom reason must be 500 characters or less');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate email verification request
  static validateEmailVerificationRequest(request: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!request.token || typeof request.token !== 'string') {
      errors.push('Verification token is required');
    }

    if (!request.emailType || typeof request.emailType !== 'string') {
      errors.push('Email type is required');
    } else if (!['current', 'new'].includes(request.emailType)) {
      errors.push('Email type must be either "current" or "new"');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate resend verification request
  static validateResendVerificationRequest(request: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!request.emailType || typeof request.emailType !== 'string') {
      errors.push('Email type is required');
    } else if (!['current', 'new'].includes(request.emailType)) {
      errors.push('Email type must be either "current" or "new"');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate approve request
  static validateApproveRequest(request: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    // Approval notes are optional, but if provided should be reasonable length
    if (request.approvalNotes && typeof request.approvalNotes === 'string') {
      if (request.approvalNotes.length > 1000) {
        errors.push('Approval notes must be 1000 characters or less');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate reject request
  static validateRejectRequest(request: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!request.rejectionReason || typeof request.rejectionReason !== 'string') {
      errors.push('Rejection reason is required');
    } else if (request.rejectionReason.trim() === '') {
      errors.push('Rejection reason cannot be empty');
    } else if (request.rejectionReason.length > 1000) {
      errors.push('Rejection reason must be 1000 characters or less');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate email format
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Check if new email is same as current email
  static isSameEmail(currentEmail: string, newEmail: string): boolean {
    return currentEmail.toLowerCase() === newEmail.toLowerCase();
  }

  // Validate token format (should be 64 character hex string)
  static isValidToken(token: string): boolean {
    const tokenRegex = /^[a-f0-9]{64}$/;
    return tokenRegex.test(token);
  }

  // Check if token is expired
  static isTokenExpired(expiresAt: string): boolean {
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    return now > expirationDate;
  }

  // Validate request filters
  static validateRequestFilters(filters: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    // Validate status filter
    if (filters.status && typeof filters.status === 'string') {
      const validStatuses = ['pending_verification', 'pending_approval', 'approved', 'rejected', 'completed', 'cancelled'];
      if (!validStatuses.includes(filters.status)) {
        errors.push(`Invalid status filter. Must be one of: ${validStatuses.join(', ')}`);
      }
    }

    // Validate reason filter
    if (filters.reason && typeof filters.reason === 'string') {
      const validReasons = ['name_change', 'company_change', 'personal_preference', 'security_concern', 'other'];
      if (!validReasons.includes(filters.reason)) {
        errors.push(`Invalid reason filter. Must be one of: ${validReasons.join(', ')}`);
      }
    }

    // Validate date filters
    if (filters.dateFrom && typeof filters.dateFrom === 'string') {
      if (!this.isValidDate(filters.dateFrom)) {
        errors.push('Invalid dateFrom format. Must be YYYY-MM-DD');
      }
    }

    if (filters.dateTo && typeof filters.dateTo === 'string') {
      if (!this.isValidDate(filters.dateTo)) {
        errors.push('Invalid dateTo format. Must be YYYY-MM-DD');
      }
    }

    // Validate pagination
    if (filters.limit !== undefined) {
      const limit = Number(filters.limit);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        errors.push('Limit must be a number between 1 and 100');
      }
    }

    if (filters.offset !== undefined) {
      const offset = Number(filters.offset);
      if (isNaN(offset) || offset < 0) {
        errors.push('Offset must be a non-negative number');
      }
    }

    // Validate sort options
    if (filters.sortBy && typeof filters.sortBy === 'string') {
      const validSortFields = ['requestedAt', 'status', 'reason'];
      if (!validSortFields.includes(filters.sortBy)) {
        errors.push(`Invalid sortBy field. Must be one of: ${validSortFields.join(', ')}`);
      }
    }

    if (filters.sortOrder && typeof filters.sortOrder === 'string') {
      if (!['asc', 'desc'].includes(filters.sortOrder)) {
        errors.push('Invalid sortOrder. Must be "asc" or "desc"');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate date format (YYYY-MM-DD)
  static isValidDate(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  // Business rule validations
  static validateBusinessRules(
    currentEmail: string,
    newEmail: string,
    reason: string,
    hasActiveRequest: boolean,
    lastRequestTime?: string
  ): ValidationResult {
    const errors: string[] = [];

    // Check if new email is same as current
    if (this.isSameEmail(currentEmail, newEmail)) {
      errors.push(EmailChangeErrorCodes.SAME_AS_CURRENT_EMAIL);
    }

    // Check for active request
    if (hasActiveRequest) {
      errors.push(EmailChangeErrorCodes.ACTIVE_REQUEST_EXISTS);
    }

    // Check cooldown period (24 hours)
    if (lastRequestTime) {
      const lastRequest = new Date(lastRequestTime);
      const cooldownEnd = new Date(lastRequest.getTime() + 24 * 60 * 60 * 1000);
      const now = new Date();

      if (now < cooldownEnd) {
        errors.push(EmailChangeErrorCodes.COOLDOWN_ACTIVE);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate user permissions for request operations
  static validateUserPermissions(
    currentUserId: string,
    requestUserId: string,
    userRole: string,
    operation: 'view' | 'cancel' | 'approve' | 'reject'
  ): ValidationResult {
    const errors: string[] = [];

    switch (operation) {
      case 'view':
      case 'cancel':
        // Users can view/cancel their own requests, admins can view/cancel any
        if (currentUserId !== requestUserId && userRole !== 'admin') {
          errors.push('Insufficient permissions to perform this operation');
        }
        break;

      case 'approve':
      case 'reject':
        // Only admins and managers can approve/reject
        if (!['admin', 'manager'].includes(userRole)) {
          errors.push(EmailChangeErrorCodes.INSUFFICIENT_APPROVAL_PERMISSIONS);
        }
        // Users cannot approve their own requests
        if (currentUserId === requestUserId) {
          errors.push(EmailChangeErrorCodes.CANNOT_APPROVE_OWN_REQUEST);
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
} 