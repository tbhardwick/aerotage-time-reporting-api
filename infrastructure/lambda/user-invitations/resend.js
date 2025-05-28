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
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var invitationId, currentUserId, resendOptions, repository, emailService, invitation, updatedInvitation, frontendBaseUrl, invitationUrl, emailData, emailError_1, responseInvitation, response, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log('Resend user invitation request:', JSON.stringify(event, null, 2));
                _b.label = 1;
            case 1:
                _b.trys.push([1, 8, , 9]);
                invitationId = (_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.id;
                if (!invitationId) {
                    return [2 /*return*/, createErrorResponse(400, types_1.InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation ID is required')];
                }
                currentUserId = getCurrentUserId(event);
                if (!currentUserId) {
                    return [2 /*return*/, createErrorResponse(401, types_1.InvitationErrorCodes.INSUFFICIENT_PERMISSIONS, 'User authentication required')];
                }
                resendOptions = {
                    extendExpiration: true, // Default value
                };
                if (event.body) {
                    try {
                        resendOptions = __assign(__assign({}, resendOptions), JSON.parse(event.body));
                    }
                    catch (parseError) {
                        return [2 /*return*/, createErrorResponse(400, types_1.InvitationErrorCodes.INVALID_EMAIL, 'Invalid request body format')];
                    }
                }
                repository = new invitation_repository_1.InvitationRepository();
                emailService = new email_service_1.EmailService();
                return [4 /*yield*/, repository.getInvitationById(invitationId)];
            case 2:
                invitation = _b.sent();
                if (!invitation) {
                    return [2 /*return*/, createErrorResponse(404, types_1.InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation not found')];
                }
                // Check if invitation is still pending
                if (invitation.status !== 'pending') {
                    return [2 /*return*/, createErrorResponse(400, types_1.InvitationErrorCodes.INVITATION_ALREADY_ACCEPTED, 'Invitation is no longer pending')];
                }
                // Check resend limit (max 3 resends per invitation)
                if (invitation.resentCount >= 3) {
                    return [2 /*return*/, createErrorResponse(400, types_1.InvitationErrorCodes.RATE_LIMIT_EXCEEDED, 'Maximum resend limit reached')];
                }
                return [4 /*yield*/, repository.resendInvitation(invitationId, resendOptions.extendExpiration, resendOptions.personalMessage)];
            case 3:
                updatedInvitation = _b.sent();
                frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
                invitationUrl = "".concat(frontendBaseUrl, "/accept-invitation?token=").concat(updatedInvitation.invitationToken);
                emailData = {
                    inviterName: 'Admin', // TODO: Get actual inviter name from Users table
                    inviterEmail: 'admin@aerotage.com', // TODO: Get actual inviter email
                    role: updatedInvitation.role,
                    department: updatedInvitation.department,
                    jobTitle: updatedInvitation.jobTitle,
                    invitationUrl: invitationUrl,
                    expirationDate: token_service_1.TokenService.formatExpirationDate(updatedInvitation.expiresAt),
                    personalMessage: updatedInvitation.personalMessage,
                };
                _b.label = 4;
            case 4:
                _b.trys.push([4, 6, , 7]);
                return [4 /*yield*/, emailService.sendReminderEmail(updatedInvitation.email, emailData)];
            case 5:
                _b.sent();
                return [3 /*break*/, 7];
            case 6:
                emailError_1 = _b.sent();
                console.error('Failed to send reminder email:', emailError_1);
                return [2 /*return*/, createErrorResponse(500, types_1.InvitationErrorCodes.EMAIL_SEND_FAILED, 'Failed to send reminder email')];
            case 7:
                responseInvitation = __assign(__assign({}, updatedInvitation), { invitationToken: '', tokenHash: '' });
                response = {
                    success: true,
                    data: {
                        id: responseInvitation.id,
                        expiresAt: responseInvitation.expiresAt,
                        resentAt: responseInvitation.lastResentAt,
                    },
                    message: 'Invitation resent successfully',
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 8:
                error_1 = _b.sent();
                console.error('Error resending user invitation:', error_1);
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
            case 9: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
/**
 * Extracts current user ID from authorization context
 */
function getCurrentUserId(event) {
    var _a;
    var authContext = event.requestContext.authorizer;
    // Primary: get from custom authorizer context
    if (authContext === null || authContext === void 0 ? void 0 : authContext.userId) {
        return authContext.userId;
    }
    // Fallback: try to get from Cognito claims (for backward compatibility)
    if ((_a = authContext === null || authContext === void 0 ? void 0 : authContext.claims) === null || _a === void 0 ? void 0 : _a.sub) {
        return authContext.claims.sub;
    }
    return null;
}
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
