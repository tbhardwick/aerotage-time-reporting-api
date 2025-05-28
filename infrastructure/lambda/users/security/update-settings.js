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
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var types_1 = require("../../shared/types");
var client = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, updateData, authContext, authenticatedUserId, validationError, getCommand, getResult, now, existingSettings, updatedSettings, putCommand, passwordExpiresAt, passwordDate, responseData, response, error_1;
    var _a, _b, _c, _d, _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                _h.trys.push([0, 3, , 4]);
                console.log('Update user security settings request:', JSON.stringify(event, null, 2));
                userId = (_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required')];
                }
                // Parse request body
                if (!event.body) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required')];
                }
                updateData = JSON.parse(event.body);
                authContext = event.requestContext.authorizer;
                authenticatedUserId = authContext === null || authContext === void 0 ? void 0 : authContext.userId;
                // Authorization check: users can only update their own security settings
                if (userId !== authenticatedUserId) {
                    return [2 /*return*/, createErrorResponse(403, types_1.ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 'You can only update your own security settings')];
                }
                validationError = validateUpdateRequest(updateData);
                if (validationError) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validationError)];
                }
                getCommand = new lib_dynamodb_1.GetCommand({
                    TableName: process.env.USER_SECURITY_SETTINGS_TABLE,
                    Key: { userId: userId },
                });
                return [4 /*yield*/, docClient.send(getCommand)];
            case 1:
                getResult = _h.sent();
                now = new Date().toISOString();
                existingSettings = getResult.Item || {};
                updatedSettings = {
                    userId: userId,
                    twoFactorEnabled: existingSettings.twoFactorEnabled || false,
                    sessionTimeout: (_c = (_b = updateData.sessionTimeout) !== null && _b !== void 0 ? _b : existingSettings.sessionTimeout) !== null && _c !== void 0 ? _c : 480,
                    allowMultipleSessions: (_e = (_d = updateData.allowMultipleSessions) !== null && _d !== void 0 ? _d : existingSettings.allowMultipleSessions) !== null && _e !== void 0 ? _e : true,
                    requirePasswordChangeEvery: (_g = (_f = updateData.requirePasswordChangeEvery) !== null && _f !== void 0 ? _f : existingSettings.requirePasswordChangeEvery) !== null && _g !== void 0 ? _g : 0,
                    passwordLastChanged: existingSettings.passwordLastChanged || now,
                    failedLoginAttempts: existingSettings.failedLoginAttempts || 0,
                    twoFactorSecret: existingSettings.twoFactorSecret,
                    backupCodes: existingSettings.backupCodes,
                    accountLockedUntil: existingSettings.accountLockedUntil,
                    createdAt: existingSettings.createdAt || now,
                    updatedAt: now,
                };
                putCommand = new lib_dynamodb_1.PutCommand({
                    TableName: process.env.USER_SECURITY_SETTINGS_TABLE,
                    Item: updatedSettings,
                });
                return [4 /*yield*/, docClient.send(putCommand)];
            case 2:
                _h.sent();
                passwordExpiresAt = void 0;
                if (updatedSettings.requirePasswordChangeEvery > 0) {
                    passwordDate = new Date(updatedSettings.passwordLastChanged);
                    passwordDate.setDate(passwordDate.getDate() + updatedSettings.requirePasswordChangeEvery);
                    passwordExpiresAt = passwordDate.toISOString();
                }
                responseData = {
                    twoFactorEnabled: updatedSettings.twoFactorEnabled,
                    sessionTimeout: updatedSettings.sessionTimeout,
                    allowMultipleSessions: updatedSettings.allowMultipleSessions,
                    passwordChangeRequired: false,
                    passwordLastChanged: updatedSettings.passwordLastChanged,
                    passwordExpiresAt: passwordExpiresAt,
                    securitySettings: {
                        requirePasswordChangeEvery: updatedSettings.requirePasswordChangeEvery,
                        maxFailedLoginAttempts: 5, // Fixed value
                        accountLockoutDuration: 30, // Fixed value
                    },
                };
                response = {
                    success: true,
                    data: responseData,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _h.sent();
                console.error('Update security settings error:', error_1);
                return [2 /*return*/, createErrorResponse(500, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Internal server error')];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function validateUpdateRequest(data) {
    // Validate session timeout
    if (data.sessionTimeout !== undefined) {
        if (typeof data.sessionTimeout !== 'number' || data.sessionTimeout < 15 || data.sessionTimeout > 43200) {
            return 'Session timeout must be between 15 minutes and 30 days (43200 minutes)';
        }
    }
    // Validate allow multiple sessions
    if (data.allowMultipleSessions !== undefined) {
        if (typeof data.allowMultipleSessions !== 'boolean') {
            return 'Allow multiple sessions must be a boolean value';
        }
    }
    // Validate password change frequency
    if (data.requirePasswordChangeEvery !== undefined) {
        if (typeof data.requirePasswordChangeEvery !== 'number' || data.requirePasswordChangeEvery < 0 || data.requirePasswordChangeEvery > 365) {
            return 'Password change frequency must be between 0 (never) and 365 days';
        }
    }
    return null;
}
function createErrorResponse(statusCode, errorCode, message) {
    var response = {
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
        body: JSON.stringify(response),
    };
}
