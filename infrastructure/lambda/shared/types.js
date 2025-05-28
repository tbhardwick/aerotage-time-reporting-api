"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeTrackingErrorCodes = exports.InvoiceErrorCodes = exports.TimeEntryErrorCodes = exports.ProfileSettingsErrorCodes = exports.InvitationErrorCodes = exports.UserErrorCodes = void 0;
// User Error Codes
var UserErrorCodes;
(function (UserErrorCodes) {
    UserErrorCodes["USER_NOT_FOUND"] = "USER_NOT_FOUND";
    UserErrorCodes["USER_ALREADY_EXISTS"] = "USER_ALREADY_EXISTS";
    UserErrorCodes["INVALID_USER_DATA"] = "INVALID_USER_DATA";
    UserErrorCodes["INSUFFICIENT_PERMISSIONS"] = "INSUFFICIENT_PERMISSIONS";
    UserErrorCodes["EMAIL_ALREADY_EXISTS"] = "EMAIL_ALREADY_EXISTS";
    UserErrorCodes["INVALID_EMAIL_FORMAT"] = "INVALID_EMAIL_FORMAT";
    UserErrorCodes["INVALID_ROLE"] = "INVALID_ROLE";
    UserErrorCodes["INVALID_HOURLY_RATE"] = "INVALID_HOURLY_RATE";
    UserErrorCodes["USER_CREATION_FAILED"] = "USER_CREATION_FAILED";
})(UserErrorCodes || (exports.UserErrorCodes = UserErrorCodes = {}));
// Error Types
var InvitationErrorCodes;
(function (InvitationErrorCodes) {
    InvitationErrorCodes["INVALID_EMAIL"] = "INVALID_EMAIL";
    InvitationErrorCodes["EMAIL_ALREADY_EXISTS"] = "EMAIL_ALREADY_EXISTS";
    InvitationErrorCodes["INVITATION_NOT_FOUND"] = "INVITATION_NOT_FOUND";
    InvitationErrorCodes["INVITATION_EXPIRED"] = "INVITATION_EXPIRED";
    InvitationErrorCodes["INVITATION_ALREADY_ACCEPTED"] = "INVITATION_ALREADY_ACCEPTED";
    InvitationErrorCodes["INSUFFICIENT_PERMISSIONS"] = "INSUFFICIENT_PERMISSIONS";
    InvitationErrorCodes["EMAIL_SEND_FAILED"] = "EMAIL_SEND_FAILED";
    InvitationErrorCodes["INVALID_TOKEN"] = "INVALID_TOKEN";
    InvitationErrorCodes["PASSWORD_POLICY_VIOLATION"] = "PASSWORD_POLICY_VIOLATION";
    InvitationErrorCodes["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
})(InvitationErrorCodes || (exports.InvitationErrorCodes = InvitationErrorCodes = {}));
// Profile Settings Error Types
var ProfileSettingsErrorCodes;
(function (ProfileSettingsErrorCodes) {
    // Profile errors
    ProfileSettingsErrorCodes["PROFILE_NOT_FOUND"] = "PROFILE_NOT_FOUND";
    ProfileSettingsErrorCodes["UNAUTHORIZED_PROFILE_ACCESS"] = "UNAUTHORIZED_PROFILE_ACCESS";
    ProfileSettingsErrorCodes["INVALID_PROFILE_DATA"] = "INVALID_PROFILE_DATA";
    // Password errors
    ProfileSettingsErrorCodes["INVALID_CURRENT_PASSWORD"] = "INVALID_CURRENT_PASSWORD";
    ProfileSettingsErrorCodes["PASSWORD_POLICY_VIOLATION"] = "PASSWORD_POLICY_VIOLATION";
    ProfileSettingsErrorCodes["PASSWORD_RECENTLY_USED"] = "PASSWORD_RECENTLY_USED";
    ProfileSettingsErrorCodes["PASSWORD_CHANGE_RATE_LIMITED"] = "PASSWORD_CHANGE_RATE_LIMITED";
    // 2FA errors
    ProfileSettingsErrorCodes["TWO_FACTOR_ALREADY_ENABLED"] = "TWO_FACTOR_ALREADY_ENABLED";
    ProfileSettingsErrorCodes["TWO_FACTOR_NOT_ENABLED"] = "TWO_FACTOR_NOT_ENABLED";
    ProfileSettingsErrorCodes["INVALID_VERIFICATION_CODE"] = "INVALID_VERIFICATION_CODE";
    ProfileSettingsErrorCodes["BACKUP_CODE_INVALID"] = "BACKUP_CODE_INVALID";
    // Session errors
    ProfileSettingsErrorCodes["SESSION_NOT_FOUND"] = "SESSION_NOT_FOUND";
    ProfileSettingsErrorCodes["CANNOT_TERMINATE_CURRENT_SESSION"] = "CANNOT_TERMINATE_CURRENT_SESSION";
    ProfileSettingsErrorCodes["SESSION_MIGRATION_REQUIRED"] = "SESSION_MIGRATION_REQUIRED";
    // Upload errors
    ProfileSettingsErrorCodes["INVALID_FILE_TYPE"] = "INVALID_FILE_TYPE";
    ProfileSettingsErrorCodes["FILE_TOO_LARGE"] = "FILE_TOO_LARGE";
    ProfileSettingsErrorCodes["UPLOAD_FAILED"] = "UPLOAD_FAILED";
    // Validation errors
    ProfileSettingsErrorCodes["INVALID_TIMEZONE"] = "INVALID_TIMEZONE";
    ProfileSettingsErrorCodes["INVALID_CURRENCY"] = "INVALID_CURRENCY";
    ProfileSettingsErrorCodes["INVALID_TIME_FORMAT"] = "INVALID_TIME_FORMAT";
    ProfileSettingsErrorCodes["INVALID_DATE_FORMAT"] = "INVALID_DATE_FORMAT";
})(ProfileSettingsErrorCodes || (exports.ProfileSettingsErrorCodes = ProfileSettingsErrorCodes = {}));
// Time Entry Error Types
var TimeEntryErrorCodes;
(function (TimeEntryErrorCodes) {
    // Time entry errors
    TimeEntryErrorCodes["TIME_ENTRY_NOT_FOUND"] = "TIME_ENTRY_NOT_FOUND";
    TimeEntryErrorCodes["UNAUTHORIZED_TIME_ENTRY_ACCESS"] = "UNAUTHORIZED_TIME_ENTRY_ACCESS";
    TimeEntryErrorCodes["INVALID_TIME_ENTRY_DATA"] = "INVALID_TIME_ENTRY_DATA";
    TimeEntryErrorCodes["TIME_ENTRY_ALREADY_SUBMITTED"] = "TIME_ENTRY_ALREADY_SUBMITTED";
    TimeEntryErrorCodes["TIME_ENTRY_ALREADY_APPROVED"] = "TIME_ENTRY_ALREADY_APPROVED";
    TimeEntryErrorCodes["TIME_ENTRY_NOT_SUBMITTED"] = "TIME_ENTRY_NOT_SUBMITTED";
    // Timer errors
    TimeEntryErrorCodes["TIMER_ALREADY_RUNNING"] = "TIMER_ALREADY_RUNNING";
    TimeEntryErrorCodes["NO_ACTIVE_TIMER"] = "NO_ACTIVE_TIMER";
    TimeEntryErrorCodes["TIMER_SESSION_NOT_FOUND"] = "TIMER_SESSION_NOT_FOUND";
    // Project/Task errors
    TimeEntryErrorCodes["PROJECT_NOT_FOUND"] = "PROJECT_NOT_FOUND";
    TimeEntryErrorCodes["TASK_NOT_FOUND"] = "TASK_NOT_FOUND";
    TimeEntryErrorCodes["PROJECT_ACCESS_DENIED"] = "PROJECT_ACCESS_DENIED";
    TimeEntryErrorCodes["TASK_ACCESS_DENIED"] = "TASK_ACCESS_DENIED";
    // Validation errors
    TimeEntryErrorCodes["INVALID_DATE_RANGE"] = "INVALID_DATE_RANGE";
    TimeEntryErrorCodes["INVALID_TIME_RANGE"] = "INVALID_TIME_RANGE";
    TimeEntryErrorCodes["DURATION_MISMATCH"] = "DURATION_MISMATCH";
    TimeEntryErrorCodes["NEGATIVE_DURATION"] = "NEGATIVE_DURATION";
    TimeEntryErrorCodes["FUTURE_DATE_NOT_ALLOWED"] = "FUTURE_DATE_NOT_ALLOWED";
    // Approval workflow errors
    TimeEntryErrorCodes["INSUFFICIENT_APPROVAL_PERMISSIONS"] = "INSUFFICIENT_APPROVAL_PERMISSIONS";
    TimeEntryErrorCodes["CANNOT_APPROVE_OWN_ENTRIES"] = "CANNOT_APPROVE_OWN_ENTRIES";
    TimeEntryErrorCodes["BULK_OPERATION_PARTIAL_FAILURE"] = "BULK_OPERATION_PARTIAL_FAILURE";
})(TimeEntryErrorCodes || (exports.TimeEntryErrorCodes = TimeEntryErrorCodes = {}));
// Invoice Error Types
var InvoiceErrorCodes;
(function (InvoiceErrorCodes) {
    // Invoice errors
    InvoiceErrorCodes["INVOICE_NOT_FOUND"] = "INVOICE_NOT_FOUND";
    InvoiceErrorCodes["UNAUTHORIZED_INVOICE_ACCESS"] = "UNAUTHORIZED_INVOICE_ACCESS";
    InvoiceErrorCodes["INVALID_INVOICE_DATA"] = "INVALID_INVOICE_DATA";
    InvoiceErrorCodes["INVOICE_ALREADY_SENT"] = "INVOICE_ALREADY_SENT";
    InvoiceErrorCodes["INVOICE_ALREADY_PAID"] = "INVOICE_ALREADY_PAID";
    InvoiceErrorCodes["INVOICE_CANNOT_BE_MODIFIED"] = "INVOICE_CANNOT_BE_MODIFIED";
    // Template errors
    InvoiceErrorCodes["TEMPLATE_NOT_FOUND"] = "TEMPLATE_NOT_FOUND";
    InvoiceErrorCodes["INVALID_TEMPLATE_DATA"] = "INVALID_TEMPLATE_DATA";
    InvoiceErrorCodes["TEMPLATE_IN_USE"] = "TEMPLATE_IN_USE";
    // Payment errors
    InvoiceErrorCodes["PAYMENT_NOT_FOUND"] = "PAYMENT_NOT_FOUND";
    InvoiceErrorCodes["INVALID_PAYMENT_AMOUNT"] = "INVALID_PAYMENT_AMOUNT";
    InvoiceErrorCodes["PAYMENT_EXCEEDS_INVOICE"] = "PAYMENT_EXCEEDS_INVOICE";
    InvoiceErrorCodes["PAYMENT_ALREADY_RECORDED"] = "PAYMENT_ALREADY_RECORDED";
    // Generation errors
    InvoiceErrorCodes["NO_BILLABLE_TIME_ENTRIES"] = "NO_BILLABLE_TIME_ENTRIES";
    InvoiceErrorCodes["INVALID_TIME_ENTRY_SELECTION"] = "INVALID_TIME_ENTRY_SELECTION";
    InvoiceErrorCodes["TIME_ENTRIES_ALREADY_INVOICED"] = "TIME_ENTRIES_ALREADY_INVOICED";
    // Recurring invoice errors
    InvoiceErrorCodes["INVALID_RECURRING_CONFIG"] = "INVALID_RECURRING_CONFIG";
    InvoiceErrorCodes["RECURRING_INVOICE_LIMIT_REACHED"] = "RECURRING_INVOICE_LIMIT_REACHED";
    InvoiceErrorCodes["RECURRING_INVOICE_ENDED"] = "RECURRING_INVOICE_ENDED";
    // Email errors
    InvoiceErrorCodes["EMAIL_SEND_FAILED"] = "EMAIL_SEND_FAILED";
    InvoiceErrorCodes["INVALID_EMAIL_RECIPIENTS"] = "INVALID_EMAIL_RECIPIENTS";
    // PDF errors
    InvoiceErrorCodes["PDF_GENERATION_FAILED"] = "PDF_GENERATION_FAILED";
    InvoiceErrorCodes["PDF_UPLOAD_FAILED"] = "PDF_UPLOAD_FAILED";
    // Validation errors
    InvoiceErrorCodes["INVALID_CURRENCY"] = "INVALID_CURRENCY";
    InvoiceErrorCodes["INVALID_TAX_RATE"] = "INVALID_TAX_RATE";
    InvoiceErrorCodes["INVALID_DATE_RANGE"] = "INVALID_DATE_RANGE";
    InvoiceErrorCodes["NEGATIVE_AMOUNT"] = "NEGATIVE_AMOUNT";
})(InvoiceErrorCodes || (exports.InvoiceErrorCodes = InvoiceErrorCodes = {}));
// Error Codes
var TimeTrackingErrorCodes;
(function (TimeTrackingErrorCodes) {
    // Work schedule errors
    TimeTrackingErrorCodes["WORK_SCHEDULE_NOT_FOUND"] = "WORK_SCHEDULE_NOT_FOUND";
    TimeTrackingErrorCodes["INVALID_WORK_SCHEDULE"] = "INVALID_WORK_SCHEDULE";
    TimeTrackingErrorCodes["INVALID_TIMEZONE"] = "INVALID_TIMEZONE";
    TimeTrackingErrorCodes["INVALID_TIME_FORMAT"] = "INVALID_TIME_FORMAT";
    // Gap analysis errors
    TimeTrackingErrorCodes["INVALID_DATE_FOR_ANALYSIS"] = "INVALID_DATE_FOR_ANALYSIS";
    TimeTrackingErrorCodes["NO_TIME_ENTRIES_FOUND"] = "NO_TIME_ENTRIES_FOUND";
    TimeTrackingErrorCodes["INVALID_WORKING_HOURS"] = "INVALID_WORKING_HOURS";
    // Daily/weekly summary errors
    TimeTrackingErrorCodes["INVALID_DATE_RANGE"] = "INVALID_DATE_RANGE";
    TimeTrackingErrorCodes["DATE_RANGE_TOO_LARGE"] = "DATE_RANGE_TOO_LARGE";
    TimeTrackingErrorCodes["FUTURE_DATE_NOT_ALLOWED"] = "FUTURE_DATE_NOT_ALLOWED";
    // Quick entry errors
    TimeTrackingErrorCodes["TIME_OVERLAP_DETECTED"] = "TIME_OVERLAP_DETECTED";
    TimeTrackingErrorCodes["INVALID_TIME_RANGE"] = "INVALID_TIME_RANGE";
    TimeTrackingErrorCodes["GAP_ALREADY_FILLED"] = "GAP_ALREADY_FILLED";
    TimeTrackingErrorCodes["INVALID_TIME_ENTRY_DATA"] = "INVALID_TIME_ENTRY_DATA";
})(TimeTrackingErrorCodes || (exports.TimeTrackingErrorCodes = TimeTrackingErrorCodes = {}));
