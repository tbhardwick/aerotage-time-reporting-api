"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
var invitation_repository_1 = require("../shared/invitation-repository");
var token_service_1 = require("../shared/token-service");
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var token, repository, tokenHash, invitation, isExpired, dbError_1, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log('Accept invitation page request:', JSON.stringify(event, null, 2));
                _b.label = 1;
            case 1:
                _b.trys.push([1, 8, , 9]);
                token = (_a = event.queryStringParameters) === null || _a === void 0 ? void 0 : _a.token;
                if (!token) {
                    return [2 /*return*/, createErrorPage('Missing invitation token', 'The invitation link appears to be invalid. Please check the link in your email or contact your administrator.')];
                }
                // Validate token format
                if (!token_service_1.TokenService.validateTokenFormat(token)) {
                    return [2 /*return*/, createErrorPage('Invalid invitation token', 'The invitation token format is invalid. Please check the link in your email or contact your administrator.')];
                }
                _b.label = 2;
            case 2:
                _b.trys.push([2, 6, , 7]);
                repository = new invitation_repository_1.InvitationRepository();
                tokenHash = token_service_1.TokenService.hashToken(token);
                return [4 /*yield*/, repository.getInvitationByTokenHash(tokenHash)];
            case 3:
                invitation = _b.sent();
                if (!invitation) {
                    return [2 /*return*/, createErrorPage('Invalid invitation', 'This invitation token is not valid. It may have been cancelled or the link may be corrupted.')];
                }
                // Check invitation status
                if (invitation.status === 'accepted') {
                    return [2 /*return*/, createSuccessPage('Invitation Already Accepted', 'This invitation has already been accepted. If you need access to your account, please contact your administrator.')];
                }
                if (invitation.status === 'cancelled') {
                    return [2 /*return*/, createErrorPage('Invitation Cancelled', 'This invitation has been cancelled. Please contact your administrator if you believe this is an error.')];
                }
                isExpired = token_service_1.TokenService.isExpired(invitation.expiresAt);
                if (!isExpired) return [3 /*break*/, 5];
                // Update invitation status to expired
                return [4 /*yield*/, repository.updateInvitation(invitation.id, {
                        status: 'expired',
                    })];
            case 4:
                // Update invitation status to expired
                _b.sent();
                return [2 /*return*/, createErrorPage('Invitation Expired', 'This invitation has expired. Please contact your administrator to request a new invitation.')];
            case 5: 
            // If we get here, the invitation is valid - show the acceptance form
            return [2 /*return*/, createAcceptancePage(invitation, token)];
            case 6:
                dbError_1 = _b.sent();
                console.error('Database error:', dbError_1);
                return [2 /*return*/, createErrorPage('System Error', 'We encountered an error while processing your invitation. Please try again later or contact your administrator.')];
            case 7: return [3 /*break*/, 9];
            case 8:
                error_1 = _b.sent();
                console.error('Error processing invitation page:', error_1);
                return [2 /*return*/, createErrorPage('System Error', 'We encountered an unexpected error. Please try again later or contact your administrator.')];
            case 9: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function createAcceptancePage(invitation, token) {
    var frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
    var apiUrl = "https://".concat(process.env.API_GATEWAY_ID || '0z6kxagbh2', ".execute-api.").concat(process.env.AWS_REGION || 'us-east-1', ".amazonaws.com/").concat(process.env.STAGE || 'dev');
    var html = "\n<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Accept Invitation - Aerotage Time Reporting</title>\n    <style>\n        * {\n            margin: 0;\n            padding: 0;\n            box-sizing: border-box;\n        }\n        \n        body {\n            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;\n            line-height: 1.6;\n            color: #333;\n            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n            min-height: 100vh;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            padding: 20px;\n        }\n        \n        .container {\n            background: white;\n            padding: 40px;\n            border-radius: 12px;\n            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);\n            max-width: 500px;\n            width: 100%;\n        }\n        \n        .logo {\n            text-align: center;\n            margin-bottom: 30px;\n        }\n        \n        .logo h1 {\n            color: #667eea;\n            font-size: 28px;\n            font-weight: 700;\n        }\n        \n        .logo p {\n            color: #666;\n            margin-top: 5px;\n        }\n        \n        .invitation-details {\n            background: #f8fafc;\n            padding: 20px;\n            border-radius: 8px;\n            margin-bottom: 30px;\n            border-left: 4px solid #667eea;\n        }\n        \n        .invitation-details h3 {\n            color: #374151;\n            margin-bottom: 15px;\n            font-size: 18px;\n        }\n        \n        .detail-row {\n            display: flex;\n            justify-content: space-between;\n            margin-bottom: 8px;\n        }\n        \n        .detail-label {\n            font-weight: 600;\n            color: #6b7280;\n        }\n        \n        .detail-value {\n            color: #374151;\n        }\n        \n        .form-group {\n            margin-bottom: 20px;\n        }\n        \n        label {\n            display: block;\n            margin-bottom: 8px;\n            font-weight: 600;\n            color: #374151;\n        }\n        \n        input[type=\"text\"], \n        input[type=\"email\"], \n        input[type=\"password\"],\n        input[type=\"tel\"],\n        select,\n        textarea {\n            width: 100%;\n            padding: 12px;\n            border: 2px solid #e5e7eb;\n            border-radius: 6px;\n            font-size: 16px;\n            transition: border-color 0.3s ease;\n        }\n        \n        input:focus, select:focus, textarea:focus {\n            outline: none;\n            border-color: #667eea;\n            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);\n        }\n        \n        .password-requirements {\n            font-size: 12px;\n            color: #6b7280;\n            margin-top: 5px;\n        }\n        \n        .btn {\n            background: #667eea;\n            color: white;\n            padding: 14px 28px;\n            border: none;\n            border-radius: 6px;\n            font-size: 16px;\n            font-weight: 600;\n            cursor: pointer;\n            transition: background-color 0.3s ease;\n            width: 100%;\n        }\n        \n        .btn:hover {\n            background: #5a67d8;\n        }\n        \n        .btn:disabled {\n            background: #9ca3af;\n            cursor: not-allowed;\n        }\n        \n        .error-message {\n            background: #fee;\n            color: #c53030;\n            padding: 12px;\n            border-radius: 6px;\n            margin-bottom: 20px;\n            border: 1px solid #fecaca;\n        }\n        \n        .loading {\n            display: none;\n            text-align: center;\n            color: #6b7280;\n            margin-top: 20px;\n        }\n        \n        .success {\n            display: none;\n            background: #f0fff4;\n            color: #2d5016;\n            padding: 20px;\n            border-radius: 6px;\n            border: 1px solid #9ae6b4;\n            text-align: center;\n        }\n    </style>\n</head>\n<body>\n    <div class=\"container\">\n        <div class=\"logo\">\n            <h1>Aerotage</h1>\n            <p>Time Reporting System</p>\n        </div>\n        \n        <div class=\"invitation-details\">\n            <h3>Invitation Details</h3>\n            <div class=\"detail-row\">\n                <span class=\"detail-label\">Email:</span>\n                <span class=\"detail-value\">".concat(invitation.email, "</span>\n            </div>\n            <div class=\"detail-row\">\n                <span class=\"detail-label\">Role:</span>\n                <span class=\"detail-value\">").concat(invitation.role, "</span>\n            </div>\n            ").concat(invitation.department ? "\n            <div class=\"detail-row\">\n                <span class=\"detail-label\">Department:</span>\n                <span class=\"detail-value\">".concat(invitation.department, "</span>\n            </div>\n            ") : '', "\n            ").concat(invitation.jobTitle ? "\n            <div class=\"detail-row\">\n                <span class=\"detail-label\">Job Title:</span>\n                <span class=\"detail-value\">".concat(invitation.jobTitle, "</span>\n            </div>\n            ") : '', "\n        </div>\n        \n        <form id=\"acceptForm\">\n            <div class=\"form-group\">\n                <label for=\"name\">Full Name *</label>\n                <input type=\"text\" id=\"name\" name=\"name\" required>\n            </div>\n            \n            <div class=\"form-group\">\n                <label for=\"password\">Password *</label>\n                <input type=\"password\" id=\"password\" name=\"password\" required>\n                <div class=\"password-requirements\">\n                    Password must be at least 8 characters with uppercase, lowercase, number, and special character.\n                </div>\n            </div>\n            \n            <div class=\"form-group\">\n                <label for=\"confirmPassword\">Confirm Password *</label>\n                <input type=\"password\" id=\"confirmPassword\" name=\"confirmPassword\" required>\n            </div>\n            \n            <div class=\"form-group\">\n                <label for=\"phone\">Phone Number</label>\n                <input type=\"tel\" id=\"phone\" name=\"phone\">\n            </div>\n            \n            <div class=\"form-group\">\n                <label for=\"timezone\">Timezone *</label>\n                <select id=\"timezone\" name=\"timezone\" required>\n                    <option value=\"America/New_York\">Eastern Time (ET)</option>\n                    <option value=\"America/Chicago\">Central Time (CT)</option>\n                    <option value=\"America/Denver\">Mountain Time (MT)</option>\n                    <option value=\"America/Los_Angeles\">Pacific Time (PT)</option>\n                    <option value=\"America/Anchorage\">Alaska Time (AKT)</option>\n                    <option value=\"Pacific/Honolulu\">Hawaii Time (HT)</option>\n                </select>\n            </div>\n            \n            <div class=\"form-group\">\n                <label for=\"theme\">Preferred Theme</label>\n                <select id=\"theme\" name=\"theme\">\n                    <option value=\"light\">Light</option>\n                    <option value=\"dark\">Dark</option>\n                </select>\n            </div>\n            \n            <div id=\"errorMessage\" class=\"error-message\" style=\"display: none;\"></div>\n            \n            <button type=\"submit\" class=\"btn\" id=\"submitBtn\">Accept Invitation</button>\n            \n            <div id=\"loading\" class=\"loading\">\n                Processing your invitation...\n            </div>\n            \n            <div id=\"success\" class=\"success\">\n                <h3>Welcome to Aerotage!</h3>\n                <p>Your account has been created successfully. You can now log in to the system.</p>\n                <p><a href=\"").concat(frontendBaseUrl, "\" style=\"color: #667eea; text-decoration: none; font-weight: 600;\">Go to Login \u2192</a></p>\n            </div>\n        </form>\n    </div>\n    \n    <script>\n        const form = document.getElementById('acceptForm');\n        const submitBtn = document.getElementById('submitBtn');\n        const loading = document.getElementById('loading');\n        const errorMessage = document.getElementById('errorMessage');\n        const success = document.getElementById('success');\n        \n        form.addEventListener('submit', async function(e) {\n            e.preventDefault();\n            \n            // Clear previous errors\n            errorMessage.style.display = 'none';\n            \n            // Validate passwords match\n            const password = document.getElementById('password').value;\n            const confirmPassword = document.getElementById('confirmPassword').value;\n            \n            if (password !== confirmPassword) {\n                showError('Passwords do not match');\n                return;\n            }\n            \n            // Validate password strength\n            if (!validatePassword(password)) {\n                showError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');\n                return;\n            }\n            \n            // Show loading state\n            submitBtn.disabled = true;\n            loading.style.display = 'block';\n            \n            try {\n                const response = await fetch('").concat(apiUrl, "/user-invitations/accept', {\n                    method: 'POST',\n                    headers: {\n                        'Content-Type': 'application/json',\n                    },\n                    body: JSON.stringify({\n                        token: '").concat(token, "',\n                        userData: {\n                            name: document.getElementById('name').value,\n                            password: password,\n                            contactInfo: {\n                                phone: document.getElementById('phone').value || undefined,\n                            },\n                            preferences: {\n                                theme: document.getElementById('theme').value,\n                                notifications: true,\n                                timezone: document.getElementById('timezone').value,\n                            }\n                        }\n                    })\n                });\n                \n                const data = await response.json();\n                \n                if (response.ok && data.success) {\n                    form.style.display = 'none';\n                    success.style.display = 'block';\n                } else {\n                    showError(data.error?.message || 'Failed to accept invitation. Please try again.');\n                }\n            } catch (error) {\n                console.error('Error:', error);\n                showError('Network error. Please check your connection and try again.');\n            } finally {\n                submitBtn.disabled = false;\n                loading.style.display = 'none';\n            }\n        });\n        \n        function showError(message) {\n            errorMessage.textContent = message;\n            errorMessage.style.display = 'block';\n        }\n        \n        function validatePassword(password) {\n            const minLength = password.length >= 8;\n            const hasUpper = /[A-Z]/.test(password);\n            const hasLower = /[a-z]/.test(password);\n            const hasNumber = /\\d/.test(password);\n            const hasSpecial = /[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]/.test(password);\n            \n            return minLength && hasUpper && hasLower && hasNumber && hasSpecial;\n        }\n    </script>\n</body>\n</html>\n  ");
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        body: html,
    };
}
function createErrorPage(title, message) {
    var html = "\n<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>".concat(title, " - Aerotage Time Reporting</title>\n    <style>\n        * {\n            margin: 0;\n            padding: 0;\n            box-sizing: border-box;\n        }\n        \n        body {\n            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;\n            line-height: 1.6;\n            color: #333;\n            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n            min-height: 100vh;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            padding: 20px;\n        }\n        \n        .container {\n            background: white;\n            padding: 40px;\n            border-radius: 12px;\n            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);\n            max-width: 500px;\n            width: 100%;\n            text-align: center;\n        }\n        \n        .logo {\n            margin-bottom: 30px;\n        }\n        \n        .logo h1 {\n            color: #667eea;\n            font-size: 28px;\n            font-weight: 700;\n        }\n        \n        .logo p {\n            color: #666;\n            margin-top: 5px;\n        }\n        \n        .error-icon {\n            font-size: 64px;\n            color: #ef4444;\n            margin-bottom: 20px;\n        }\n        \n        .error-title {\n            font-size: 24px;\n            color: #374151;\n            margin-bottom: 15px;\n            font-weight: 600;\n        }\n        \n        .error-message {\n            color: #6b7280;\n            margin-bottom: 30px;\n            font-size: 16px;\n        }\n        \n        .contact-info {\n            background: #f8fafc;\n            padding: 20px;\n            border-radius: 8px;\n            border-left: 4px solid #667eea;\n        }\n        \n        .contact-info h3 {\n            color: #374151;\n            margin-bottom: 10px;\n        }\n        \n        .contact-info p {\n            color: #6b7280;\n        }\n    </style>\n</head>\n<body>\n    <div class=\"container\">\n        <div class=\"logo\">\n            <h1>Aerotage</h1>\n            <p>Time Reporting System</p>\n        </div>\n        \n        <div class=\"error-icon\">\u26A0\uFE0F</div>\n        <h2 class=\"error-title\">").concat(title, "</h2>\n        <p class=\"error-message\">").concat(message, "</p>\n        \n        <div class=\"contact-info\">\n            <h3>Need Help?</h3>\n            <p>Contact your administrator or email support at <a href=\"mailto:support@aerotage.com\" style=\"color: #667eea;\">support@aerotage.com</a></p>\n        </div>\n    </div>\n</body>\n</html>\n  ");
    return {
        statusCode: 400,
        headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        body: html,
    };
}
function createSuccessPage(title, message) {
    var frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
    var html = "\n<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>".concat(title, " - Aerotage Time Reporting</title>\n    <style>\n        * {\n            margin: 0;\n            padding: 0;\n            box-sizing: border-box;\n        }\n        \n        body {\n            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;\n            line-height: 1.6;\n            color: #333;\n            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n            min-height: 100vh;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            padding: 20px;\n        }\n        \n        .container {\n            background: white;\n            padding: 40px;\n            border-radius: 12px;\n            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);\n            max-width: 500px;\n            width: 100%;\n            text-align: center;\n        }\n        \n        .logo {\n            margin-bottom: 30px;\n        }\n        \n        .logo h1 {\n            color: #667eea;\n            font-size: 28px;\n            font-weight: 700;\n        }\n        \n        .logo p {\n            color: #666;\n            margin-top: 5px;\n        }\n        \n        .success-icon {\n            font-size: 64px;\n            color: #10b981;\n            margin-bottom: 20px;\n        }\n        \n        .success-title {\n            font-size: 24px;\n            color: #374151;\n            margin-bottom: 15px;\n            font-weight: 600;\n        }\n        \n        .success-message {\n            color: #6b7280;\n            margin-bottom: 30px;\n            font-size: 16px;\n        }\n        \n        .btn {\n            background: #667eea;\n            color: white;\n            padding: 14px 28px;\n            border: none;\n            border-radius: 6px;\n            font-size: 16px;\n            font-weight: 600;\n            text-decoration: none;\n            display: inline-block;\n            transition: background-color 0.3s ease;\n        }\n        \n        .btn:hover {\n            background: #5a67d8;\n        }\n    </style>\n</head>\n<body>\n    <div class=\"container\">\n        <div class=\"logo\">\n            <h1>Aerotage</h1>\n            <p>Time Reporting System</p>\n        </div>\n        \n        <div class=\"success-icon\">\u2705</div>\n        <h2 class=\"success-title\">").concat(title, "</h2>\n        <p class=\"success-message\">").concat(message, "</p>\n        \n        <a href=\"").concat(frontendBaseUrl, "\" class=\"btn\">Go to Login</a>\n    </div>\n</body>\n</html>\n  ");
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        body: html,
    };
}
