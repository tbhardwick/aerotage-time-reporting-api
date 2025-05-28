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
var invitation_repository_1 = require("../shared/invitation-repository");
var email_service_1 = require("../shared/email-service");
var token_service_1 = require("../shared/token-service");
var user_repository_1 = require("../shared/user-repository");
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var requestBody, repository, emailService, tokenHash, invitation, isExpired, userRepository, user, updatedInvitation, frontendBaseUrl, emailData, emailError_1, response, error_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                console.log('Accept invitation request:', JSON.stringify(event, null, 2));
                _c.label = 1;
            case 1:
                _c.trys.push([1, 11, , 12]);
                // Parse request body
                if (!event.body) {
                    return [2 /*return*/, createErrorResponse(400, types_1.InvitationErrorCodes.INVALID_TOKEN, 'Request body is required')];
                }
                requestBody = JSON.parse(event.body);
                // Basic validation
                if (!requestBody.token || !((_a = requestBody.userData) === null || _a === void 0 ? void 0 : _a.name) || !((_b = requestBody.userData) === null || _b === void 0 ? void 0 : _b.password)) {
                    return [2 /*return*/, createErrorResponse(400, types_1.InvitationErrorCodes.INVALID_TOKEN, 'Missing required fields')];
                }
                repository = new invitation_repository_1.InvitationRepository();
                emailService = new email_service_1.EmailService();
                tokenHash = token_service_1.TokenService.hashToken(requestBody.token);
                return [4 /*yield*/, repository.getInvitationByTokenHash(tokenHash)];
            case 2:
                invitation = _c.sent();
                if (!invitation) {
                    return [2 /*return*/, createErrorResponse(404, types_1.InvitationErrorCodes.INVALID_TOKEN, 'Invalid token')];
                }
                // Check if invitation has already been accepted
                if (invitation.status === 'accepted') {
                    return [2 /*return*/, createErrorResponse(409, types_1.InvitationErrorCodes.INVITATION_ALREADY_ACCEPTED, 'Invitation has already been accepted')];
                }
                // Check if invitation has been cancelled
                if (invitation.status === 'cancelled') {
                    return [2 /*return*/, createErrorResponse(410, types_1.InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation has been cancelled')];
                }
                isExpired = token_service_1.TokenService.isExpired(invitation.expiresAt);
                if (!isExpired) return [3 /*break*/, 4];
                return [4 /*yield*/, repository.updateInvitation(invitation.id, {
                        status: 'expired',
                    })];
            case 3:
                _c.sent();
                return [2 /*return*/, createErrorResponse(410, types_1.InvitationErrorCodes.INVITATION_EXPIRED, 'Invitation has expired')];
            case 4:
                userRepository = new user_repository_1.UserRepository();
                return [4 /*yield*/, userRepository.createUser({
                        email: invitation.email,
                        name: requestBody.userData.name,
                        role: invitation.role,
                        department: invitation.department,
                        jobTitle: invitation.jobTitle,
                        hourlyRate: invitation.hourlyRate,
                        permissions: invitation.permissions,
                        preferences: requestBody.userData.preferences,
                        contactInfo: requestBody.userData.contactInfo,
                        invitationId: invitation.id,
                        invitedBy: invitation.invitedBy,
                    })];
            case 5:
                user = _c.sent();
                return [4 /*yield*/, repository.acceptInvitation(invitation.id)];
            case 6:
                updatedInvitation = _c.sent();
                _c.label = 7;
            case 7:
                _c.trys.push([7, 9, , 10]);
                frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
                emailData = {
                    userName: user.name,
                    dashboardUrl: frontendBaseUrl,
                };
                return [4 /*yield*/, emailService.sendWelcomeEmail(user.email, emailData)];
            case 8:
                _c.sent();
                return [3 /*break*/, 10];
            case 9:
                emailError_1 = _c.sent();
                console.error('Failed to send welcome email:', emailError_1);
                return [3 /*break*/, 10];
            case 10:
                response = {
                    success: true,
                    data: {
                        user: user,
                        invitation: __assign(__assign({}, updatedInvitation), { invitationToken: '', tokenHash: '' }),
                    },
                    message: 'Invitation accepted successfully',
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 11:
                error_1 = _c.sent();
                console.error('Error accepting invitation:', error_1);
                return [2 /*return*/, {
                        statusCode: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify({
                            success: false,
                            error: {
                                code: 'INTERNAL_SERVER_ERROR',
                                message: 'An internal server error occurred',
                            },
                            timestamp: new Date().toISOString(),
                        }),
                    }];
            case 12: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
/**
 * Creates standardized error response
 */
function createErrorResponse(statusCode, errorCode, message) {
    var errorResponse = {
        success: false,
        error: {
            code: errorCode,
            message: message,
        },
        timestamp: new Date().toISOString(),
    };
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(errorResponse),
    };
}
