"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var types_1 = require("../shared/types");
var validation_1 = require("../shared/validation");
var invitation_repository_1 = require("../shared/invitation-repository");
var email_service_1 = require("../shared/email-service");
var token_service_1 = require("../shared/token-service");
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var requestBody, validation, currentUserId, repository, emailService, emailExists, invitationData, invitation, frontendBaseUrl, invitationUrl, emailData, emailError_1, responseInvitation, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('Create user invitation request:', JSON.stringify(event, null, 2));
                _a.label = 1;
            case 1:
                _a.trys.push([1, 8, , 9]);
                // Parse request body
                if (!event.body) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.InvitationErrorCodes.INVALID_EMAIL, 'Request body is required')];
                }
                requestBody = JSON.parse(event.body);
                validation = validation_1.ValidationService.validateCreateInvitationRequest(requestBody);
                if (!validation.isValid) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, validation.errorCode || types_1.InvitationErrorCodes.INVALID_EMAIL, validation.errors.join(', '))];
                }
                currentUserId = (0, auth_helper_1.getCurrentUserId)(event);
                if (!currentUserId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, types_1.InvitationErrorCodes.INSUFFICIENT_PERMISSIONS, 'User authentication required')];
                }
                repository = new invitation_repository_1.InvitationRepository();
                emailService = new email_service_1.EmailService();
                return [4 /*yield*/, repository.checkEmailExists(requestBody.email)];
            case 2:
                emailExists = _a.sent();
                if (emailExists) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(409, types_1.InvitationErrorCodes.EMAIL_ALREADY_EXISTS, 'Email already has a pending invitation')];
                }
                invitationData = {
                    email: requestBody.email.toLowerCase(),
                    invitedBy: currentUserId,
                    role: requestBody.role,
                    department: requestBody.department,
                    jobTitle: requestBody.jobTitle,
                    hourlyRate: requestBody.hourlyRate,
                    permissions: requestBody.permissions,
                    personalMessage: requestBody.personalMessage,
                    expirationDays: 7, // Default from requirements
                };
                return [4 /*yield*/, repository.createInvitation(invitationData)];
            case 3:
                invitation = _a.sent();
                frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
                invitationUrl = "".concat(frontendBaseUrl, "/accept-invitation?token=").concat(invitation.invitationToken);
                emailData = {
                    inviterName: 'Admin', // TODO: Get actual inviter name from Users table
                    inviterEmail: 'admin@aerotage.com', // TODO: Get actual inviter email
                    role: invitation.role,
                    department: invitation.department,
                    jobTitle: invitation.jobTitle,
                    invitationUrl: invitationUrl,
                    expirationDate: token_service_1.TokenService.formatExpirationDate(invitation.expiresAt),
                    personalMessage: invitation.personalMessage,
                };
                _a.label = 4;
            case 4:
                _a.trys.push([4, 6, , 7]);
                return [4 /*yield*/, emailService.sendInvitationEmail(invitation.email, emailData)];
            case 5:
                _a.sent();
                return [3 /*break*/, 7];
            case 6:
                emailError_1 = _a.sent();
                console.error('Failed to send invitation email:', emailError_1);
                return [3 /*break*/, 7];
            case 7:
                responseInvitation = __assign(__assign({}, invitation), { invitationToken: '' });
                return [2 /*return*/, (0, response_helper_1.createSuccessResponse)(responseInvitation, 201, 'User invitation created successfully')];
            case 8:
                error_1 = _a.sent();
                console.error('Error creating user invitation:', error_1);
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred')];
            case 9: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
