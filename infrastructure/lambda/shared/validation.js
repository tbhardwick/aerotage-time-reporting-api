"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationService = void 0;
var types_1 = require("./types");
var ValidationService = /** @class */ (function () {
    function ValidationService() {
    }
    /**
     * Validates email format using RFC 5322 compliant regex
     */
    ValidationService.validateEmail = function (email) {
        var emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return emailRegex.test(email.toLowerCase());
    };
    /**
     * Validates role is one of the allowed values
     */
    ValidationService.validateRole = function (role) {
        var allowedRoles = ['admin', 'manager', 'employee'];
        return allowedRoles.includes(role);
    };
    /**
     * Validates permissions structure
     */
    ValidationService.validatePermissions = function (permissions) {
        if (!permissions || typeof permissions !== 'object') {
            return false;
        }
        if (!Array.isArray(permissions.features) || !Array.isArray(permissions.projects)) {
            return false;
        }
        // Validate features array contains only strings
        if (!permissions.features.every(function (feature) { return typeof feature === 'string'; })) {
            return false;
        }
        // Validate projects array contains only strings
        if (!permissions.projects.every(function (project) { return typeof project === 'string'; })) {
            return false;
        }
        return true;
    };
    /**
     * Validates hourly rate if provided
     */
    ValidationService.validateHourlyRate = function (hourlyRate) {
        if (hourlyRate === undefined)
            return true;
        return typeof hourlyRate === 'number' && hourlyRate >= 0 && hourlyRate <= 1000;
    };
    /**
     * Validates password meets policy requirements
     */
    ValidationService.validatePassword = function (password) {
        var errors = [];
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
            errors: errors,
            errorCode: errors.length > 0 ? types_1.InvitationErrorCodes.PASSWORD_POLICY_VIOLATION : undefined,
        };
    };
    /**
     * Validates timezone string
     */
    ValidationService.validateTimezone = function (timezone) {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
            return true;
        }
        catch (_a) {
            return false;
        }
    };
    /**
     * Validates theme preference
     */
    ValidationService.validateTheme = function (theme) {
        return ['light', 'dark'].includes(theme);
    };
    /**
     * Validates create invitation request
     */
    ValidationService.validateCreateInvitationRequest = function (request) {
        var errors = [];
        // Required fields
        if (!request.email || typeof request.email !== 'string') {
            errors.push('Email is required and must be a string');
        }
        else if (!this.validateEmail(request.email)) {
            errors.push('Email format is invalid');
            return {
                isValid: false,
                errors: errors,
                errorCode: types_1.InvitationErrorCodes.INVALID_EMAIL,
            };
        }
        if (!request.role || typeof request.role !== 'string') {
            errors.push('Role is required and must be a string');
        }
        else if (!this.validateRole(request.role)) {
            errors.push('Role must be one of: admin, manager, employee');
        }
        if (!request.permissions) {
            errors.push('Permissions are required');
        }
        else if (!this.validatePermissions(request.permissions)) {
            errors.push('Permissions must contain features and projects arrays');
        }
        // Optional fields validation
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
            errors: errors,
        };
    };
    /**
     * Validates accept invitation request
     */
    ValidationService.validateAcceptInvitationRequest = function (request) {
        var errors = [];
        // Required fields
        if (!request.token || typeof request.token !== 'string') {
            errors.push('Token is required and must be a string');
        }
        if (!request.userData || typeof request.userData !== 'object') {
            errors.push('User data is required');
            return { isValid: false, errors: errors };
        }
        var userData = request.userData;
        if (!userData.name || typeof userData.name !== 'string') {
            errors.push('Name is required and must be a string');
        }
        if (!userData.password || typeof userData.password !== 'string') {
            errors.push('Password is required and must be a string');
        }
        else {
            var passwordValidation = this.validatePassword(userData.password);
            if (!passwordValidation.isValid) {
                errors.push.apply(errors, passwordValidation.errors);
                return {
                    isValid: false,
                    errors: errors,
                    errorCode: passwordValidation.errorCode,
                };
            }
        }
        if (!userData.preferences || typeof userData.preferences !== 'object') {
            errors.push('Preferences are required');
        }
        else {
            var preferences = userData.preferences;
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
            var contactInfo = userData.contactInfo;
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
            errors: errors,
        };
    };
    /**
     * Sanitizes string input to prevent injection attacks
     */
    ValidationService.sanitizeString = function (input) {
        return input
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .trim()
            .substring(0, 1000); // Limit length
    };
    /**
     * Validates invitation filters for listing
     */
    ValidationService.validateInvitationFilters = function (filters) {
        var errors = [];
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
            errors: errors,
        };
    };
    /**
     * Validates create project request
     */
    ValidationService.validateCreateProjectRequest = function (request) {
        var errors = [];
        // Required fields
        if (!request.name || typeof request.name !== 'string') {
            errors.push('Project name is required and must be a string');
        }
        else if (request.name.length < 2 || request.name.length > 100) {
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
            }
            else {
                if (!['hours', 'amount'].includes(request.budget.type)) {
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
            errors: errors,
        };
    };
    /**
     * Validates update project request
     */
    ValidationService.validateUpdateProjectRequest = function (request) {
        var errors = [];
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
            }
            else {
                if (!['hours', 'amount'].includes(request.budget.type)) {
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
            errors: errors,
        };
    };
    /**
     * Validates create client request
     */
    ValidationService.validateCreateClientRequest = function (request) {
        var errors = [];
        // Required fields
        if (!request.name || typeof request.name !== 'string') {
            errors.push('Client name is required and must be a string');
        }
        else if (request.name.length < 2 || request.name.length > 100) {
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
            errors: errors,
        };
    };
    /**
     * Validates update client request
     */
    ValidationService.validateUpdateClientRequest = function (request) {
        var errors = [];
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
            errors: errors,
        };
    };
    /**
     * Validates project filters for listing
     */
    ValidationService.validateProjectFilters = function (filters) {
        var errors = [];
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
            errors: errors,
        };
    };
    /**
     * Validates client filters for listing
     */
    ValidationService.validateClientFilters = function (filters) {
        var errors = [];
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
            errors: errors,
        };
    };
    /**
     * Validates invoice filters for listing
     */
    ValidationService.validateInvoiceFilters = function (filters) {
        var errors = [];
        if (filters.clientId && typeof filters.clientId !== 'string') {
            errors.push('Client ID must be a string');
        }
        if (filters.projectId && typeof filters.projectId !== 'string') {
            errors.push('Project ID must be a string');
        }
        if (filters.status && !['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'refunded'].includes(filters.status)) {
            errors.push('Status must be one of: draft, sent, viewed, paid, overdue, cancelled, refunded');
        }
        if (filters.isRecurring !== undefined && typeof filters.isRecurring !== 'boolean') {
            errors.push('Recurring status must be a boolean');
        }
        if (filters.dateFrom && typeof filters.dateFrom !== 'string') {
            errors.push('Date from must be a string (ISO date)');
        }
        if (filters.dateTo && typeof filters.dateTo !== 'string') {
            errors.push('Date to must be a string (ISO date)');
        }
        if (filters.dueDateFrom && typeof filters.dueDateFrom !== 'string') {
            errors.push('Due date from must be a string (ISO date)');
        }
        if (filters.dueDateTo && typeof filters.dueDateTo !== 'string') {
            errors.push('Due date to must be a string (ISO date)');
        }
        if (filters.amountMin !== undefined && (typeof filters.amountMin !== 'number' || filters.amountMin < 0)) {
            errors.push('Amount minimum must be a non-negative number');
        }
        if (filters.amountMax !== undefined && (typeof filters.amountMax !== 'number' || filters.amountMax < 0)) {
            errors.push('Amount maximum must be a non-negative number');
        }
        if (filters.amountMin !== undefined && filters.amountMax !== undefined && filters.amountMin > filters.amountMax) {
            errors.push('Amount minimum cannot be greater than amount maximum');
        }
        if (filters.currency && typeof filters.currency !== 'string') {
            errors.push('Currency must be a string');
        }
        if (filters.limit && (typeof filters.limit !== 'number' || filters.limit < 1 || filters.limit > 100)) {
            errors.push('Limit must be a number between 1 and 100');
        }
        if (filters.offset && (typeof filters.offset !== 'number' || filters.offset < 0)) {
            errors.push('Offset must be a non-negative number');
        }
        if (filters.sortBy && !['invoiceNumber', 'issueDate', 'dueDate', 'totalAmount', 'status'].includes(filters.sortBy)) {
            errors.push('SortBy must be one of: invoiceNumber, issueDate, dueDate, totalAmount, status');
        }
        if (filters.sortOrder && !['asc', 'desc'].includes(filters.sortOrder)) {
            errors.push('SortOrder must be either "asc" or "desc"');
        }
        return {
            isValid: errors.length === 0,
            errors: errors,
        };
    };
    /**
     * Validates create invoice request
     */
    ValidationService.validateCreateInvoiceRequest = function (request) {
        var errors = [];
        // Required fields
        if (!request.clientId || typeof request.clientId !== 'string') {
            errors.push('Client ID is required and must be a string');
        }
        // Optional fields validation
        if (request.projectIds && !Array.isArray(request.projectIds)) {
            errors.push('Project IDs must be an array');
        }
        if (request.timeEntryIds && !Array.isArray(request.timeEntryIds)) {
            errors.push('Time entry IDs must be an array');
        }
        if (request.templateId && typeof request.templateId !== 'string') {
            errors.push('Template ID must be a string');
        }
        if (request.issueDate && typeof request.issueDate !== 'string') {
            errors.push('Issue date must be a string (ISO date)');
        }
        if (request.dueDate && typeof request.dueDate !== 'string') {
            errors.push('Due date must be a string (ISO date)');
        }
        if (request.paymentTerms && typeof request.paymentTerms !== 'string') {
            errors.push('Payment terms must be a string');
        }
        if (request.currency && typeof request.currency !== 'string') {
            errors.push('Currency must be a string');
        }
        if (request.taxRate !== undefined && (typeof request.taxRate !== 'number' || request.taxRate < 0 || request.taxRate > 1)) {
            errors.push('Tax rate must be a number between 0 and 1 (e.g., 0.08 for 8%)');
        }
        if (request.discountRate !== undefined && (typeof request.discountRate !== 'number' || request.discountRate < 0 || request.discountRate > 1)) {
            errors.push('Discount rate must be a number between 0 and 1 (e.g., 0.1 for 10%)');
        }
        if (request.additionalLineItems && !Array.isArray(request.additionalLineItems)) {
            errors.push('Additional line items must be an array');
        }
        else if (request.additionalLineItems) {
            // Validate each line item
            request.additionalLineItems.forEach(function (item, index) {
                if (!item.type || !['time', 'expense', 'fixed', 'discount'].includes(item.type)) {
                    errors.push("Line item ".concat(index + 1, ": type must be one of: time, expense, fixed, discount"));
                }
                if (!item.description || typeof item.description !== 'string') {
                    errors.push("Line item ".concat(index + 1, ": description is required and must be a string"));
                }
                if (typeof item.quantity !== 'number' || item.quantity <= 0) {
                    errors.push("Line item ".concat(index + 1, ": quantity must be a positive number"));
                }
                if (typeof item.rate !== 'number' || item.rate < 0) {
                    errors.push("Line item ".concat(index + 1, ": rate must be a non-negative number"));
                }
                if (typeof item.amount !== 'number' || item.amount < 0) {
                    errors.push("Line item ".concat(index + 1, ": amount must be a non-negative number"));
                }
                if (typeof item.taxable !== 'boolean') {
                    errors.push("Line item ".concat(index + 1, ": taxable must be a boolean"));
                }
            });
        }
        if (request.notes && typeof request.notes !== 'string') {
            errors.push('Notes must be a string');
        }
        if (request.clientNotes && typeof request.clientNotes !== 'string') {
            errors.push('Client notes must be a string');
        }
        if (request.isRecurring !== undefined && typeof request.isRecurring !== 'boolean') {
            errors.push('Recurring status must be a boolean');
        }
        if (request.recurringConfig) {
            if (typeof request.recurringConfig !== 'object') {
                errors.push('Recurring config must be an object');
            }
            else {
                var config = request.recurringConfig;
                if (!config.frequency || !['weekly', 'monthly', 'quarterly', 'yearly'].includes(config.frequency)) {
                    errors.push('Recurring frequency must be one of: weekly, monthly, quarterly, yearly');
                }
                if (typeof config.interval !== 'number' || config.interval < 1) {
                    errors.push('Recurring interval must be a positive number');
                }
                if (!config.startDate || typeof config.startDate !== 'string') {
                    errors.push('Recurring start date is required and must be a string (ISO date)');
                }
                if (config.endDate && typeof config.endDate !== 'string') {
                    errors.push('Recurring end date must be a string (ISO date)');
                }
                if (config.maxInvoices !== undefined && (typeof config.maxInvoices !== 'number' || config.maxInvoices < 1)) {
                    errors.push('Max invoices must be a positive number');
                }
                if (typeof config.isActive !== 'boolean') {
                    errors.push('Recurring active status must be a boolean');
                }
                if (typeof config.autoSend !== 'boolean') {
                    errors.push('Auto send must be a boolean');
                }
                if (typeof config.generateDaysBefore !== 'number' || config.generateDaysBefore < 0) {
                    errors.push('Generate days before must be a non-negative number');
                }
            }
        }
        // Validate that at least one of projectIds or timeEntryIds is provided
        if ((!request.projectIds || request.projectIds.length === 0) &&
            (!request.timeEntryIds || request.timeEntryIds.length === 0) &&
            (!request.additionalLineItems || request.additionalLineItems.length === 0)) {
            errors.push('At least one of projectIds, timeEntryIds, or additionalLineItems must be provided');
        }
        return {
            isValid: errors.length === 0,
            errors: errors,
        };
    };
    /**
     * Validates update invoice request
     */
    ValidationService.validateUpdateInvoiceRequest = function (request) {
        var errors = [];
        // All fields are optional for updates, but if provided must be valid
        if (request.status !== undefined && !['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'refunded'].includes(request.status)) {
            errors.push('Status must be one of: draft, sent, viewed, paid, overdue, cancelled, refunded');
        }
        if (request.dueDate !== undefined && typeof request.dueDate !== 'string') {
            errors.push('Due date must be a string (ISO date)');
        }
        if (request.paymentTerms !== undefined && typeof request.paymentTerms !== 'string') {
            errors.push('Payment terms must be a string');
        }
        if (request.taxRate !== undefined && (typeof request.taxRate !== 'number' || request.taxRate < 0 || request.taxRate > 1)) {
            errors.push('Tax rate must be a number between 0 and 1 (e.g., 0.08 for 8%)');
        }
        if (request.discountRate !== undefined && (typeof request.discountRate !== 'number' || request.discountRate < 0 || request.discountRate > 1)) {
            errors.push('Discount rate must be a number between 0 and 1 (e.g., 0.1 for 10%)');
        }
        if (request.lineItems !== undefined) {
            if (!Array.isArray(request.lineItems)) {
                errors.push('Line items must be an array');
            }
            else {
                // Validate each line item
                request.lineItems.forEach(function (item, index) {
                    if (!item.id || typeof item.id !== 'string') {
                        errors.push("Line item ".concat(index + 1, ": id is required and must be a string"));
                    }
                    if (!item.type || !['time', 'expense', 'fixed', 'discount'].includes(item.type)) {
                        errors.push("Line item ".concat(index + 1, ": type must be one of: time, expense, fixed, discount"));
                    }
                    if (!item.description || typeof item.description !== 'string') {
                        errors.push("Line item ".concat(index + 1, ": description is required and must be a string"));
                    }
                    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
                        errors.push("Line item ".concat(index + 1, ": quantity must be a positive number"));
                    }
                    if (typeof item.rate !== 'number' || item.rate < 0) {
                        errors.push("Line item ".concat(index + 1, ": rate must be a non-negative number"));
                    }
                    if (typeof item.amount !== 'number' || item.amount < 0) {
                        errors.push("Line item ".concat(index + 1, ": amount must be a non-negative number"));
                    }
                    if (typeof item.taxable !== 'boolean') {
                        errors.push("Line item ".concat(index + 1, ": taxable must be a boolean"));
                    }
                });
            }
        }
        if (request.notes !== undefined && typeof request.notes !== 'string') {
            errors.push('Notes must be a string');
        }
        if (request.clientNotes !== undefined && typeof request.clientNotes !== 'string') {
            errors.push('Client notes must be a string');
        }
        if (request.customFields !== undefined && typeof request.customFields !== 'object') {
            errors.push('Custom fields must be an object');
        }
        return {
            isValid: errors.length === 0,
            errors: errors,
        };
    };
    /**
     * Validates send invoice request
     */
    ValidationService.validateSendInvoiceRequest = function (request) {
        var _this = this;
        var errors = [];
        // All fields are optional for sending invoices
        if (request.recipientEmails !== undefined) {
            if (!Array.isArray(request.recipientEmails)) {
                errors.push('Recipient emails must be an array');
            }
            else {
                request.recipientEmails.forEach(function (email, index) {
                    if (typeof email !== 'string' || !_this.validateEmail(email)) {
                        errors.push("Recipient email ".concat(index + 1, " must be a valid email address"));
                    }
                });
            }
        }
        if (request.subject !== undefined && typeof request.subject !== 'string') {
            errors.push('Subject must be a string');
        }
        if (request.message !== undefined && typeof request.message !== 'string') {
            errors.push('Message must be a string');
        }
        if (request.attachPdf !== undefined && typeof request.attachPdf !== 'boolean') {
            errors.push('Attach PDF must be a boolean');
        }
        if (request.sendCopy !== undefined && typeof request.sendCopy !== 'boolean') {
            errors.push('Send copy must be a boolean');
        }
        if (request.scheduleDate !== undefined && typeof request.scheduleDate !== 'string') {
            errors.push('Schedule date must be a string (ISO datetime)');
        }
        return {
            isValid: errors.length === 0,
            errors: errors,
        };
    };
    /**
     * Validates record payment request
     */
    ValidationService.validateRecordPaymentRequest = function (request) {
        var errors = [];
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
            errors: errors,
        };
    };
    /**
     * Validate create user request
     */
    ValidationService.validateCreateUserRequest = function (request) {
        var errors = [];
        // Required fields
        if (!request.email || typeof request.email !== 'string') {
            errors.push('email is required and must be a string');
        }
        else if (!this.validateEmail(request.email)) {
            errors.push('email must be a valid email address');
        }
        if (!request.name || typeof request.name !== 'string') {
            errors.push('name is required and must be a string');
        }
        else if (request.name.trim().length < 2) {
            errors.push('name must be at least 2 characters long');
        }
        // Optional fields validation
        if (request.role && typeof request.role === 'string') {
            var validRoles = ['admin', 'manager', 'employee'];
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
            var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(request.startDate)) {
                errors.push('startDate must be a valid ISO date (YYYY-MM-DD)');
            }
        }
        // Validate permissions if provided
        if (request.permissions) {
            if (typeof request.permissions !== 'object' || request.permissions === null) {
                errors.push('permissions must be an object');
            }
            else {
                var permissions = request.permissions;
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
            }
            else {
                var contactInfo = request.contactInfo;
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
            errors: errors
        };
    };
    return ValidationService;
}());
exports.ValidationService = ValidationService;
