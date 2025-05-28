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
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
var bcrypt = require("bcryptjs");
var types_1 = require("../../shared/types");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({});
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, _a, currentPassword, newPassword, authContext, authenticatedUserId, userRole, userEmail, passwordValidation, isPasswordReused, securitySettings, lockoutTime, cognitoError_1, response, error_1;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 11, , 12]);
                console.log('Change password request:', JSON.stringify(__assign(__assign({}, event), { body: '[REDACTED]' }), null, 2));
                userId = (_b = event.pathParameters) === null || _b === void 0 ? void 0 : _b.id;
                if (!userId) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required')];
                }
                // Parse request body
                if (!event.body) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required')];
                }
                _a = JSON.parse(event.body), currentPassword = _a.currentPassword, newPassword = _a.newPassword;
                authContext = event.requestContext.authorizer;
                authenticatedUserId = authContext === null || authContext === void 0 ? void 0 : authContext.userId;
                userRole = (authContext === null || authContext === void 0 ? void 0 : authContext.role) || 'employee';
                userEmail = authContext === null || authContext === void 0 ? void 0 : authContext.email;
                // Authorization check: users can only change their own password
                if (userId !== authenticatedUserId) {
                    return [2 /*return*/, createErrorResponse(403, types_1.ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 'You can only change your own password')];
                }
                passwordValidation = validatePassword(newPassword);
                if (!passwordValidation.isValid) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, passwordValidation.message)];
                }
                return [4 /*yield*/, checkPasswordHistory(userId, newPassword)];
            case 1:
                isPasswordReused = _c.sent();
                if (isPasswordReused) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Password cannot be one of your last 5 passwords')];
                }
                return [4 /*yield*/, getUserSecuritySettings(userId)];
            case 2:
                securitySettings = _c.sent();
                if (securitySettings && securitySettings.accountLockedUntil) {
                    lockoutTime = new Date(securitySettings.accountLockedUntil);
                    if (lockoutTime > new Date()) {
                        return [2 /*return*/, createErrorResponse(423, types_1.ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 'Account is temporarily locked due to failed login attempts')];
                    }
                }
                _c.label = 3;
            case 3:
                _c.trys.push([3, 5, , 6]);
                return [4 /*yield*/, cognitoClient.send(new client_cognito_identity_provider_1.AdminSetUserPasswordCommand({
                        UserPoolId: process.env.COGNITO_USER_POOL_ID,
                        Username: userEmail,
                        Password: newPassword,
                        Permanent: true,
                    }))];
            case 4:
                _c.sent();
                return [3 /*break*/, 6];
            case 5:
                cognitoError_1 = _c.sent();
                console.error('Cognito password update error:', cognitoError_1);
                return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Failed to update password')];
            case 6: 
            // Store password in history
            return [4 /*yield*/, storePasswordHistory(userId, newPassword)];
            case 7:
                // Store password in history
                _c.sent();
                // Update security settings with new password change timestamp
                return [4 /*yield*/, updatePasswordChangeTimestamp(userId)];
            case 8:
                // Update security settings with new password change timestamp
                _c.sent();
                if (!(securitySettings && securitySettings.failedLoginAttempts > 0)) return [3 /*break*/, 10];
                return [4 /*yield*/, resetFailedLoginAttempts(userId)];
            case 9:
                _c.sent();
                _c.label = 10;
            case 10:
                response = {
                    success: true,
                    data: {
                        message: 'Password updated successfully'
                    },
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
                console.error('Change password error:', error_1);
                return [2 /*return*/, createErrorResponse(500, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Internal server error')];
            case 12: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function validatePassword(password) {
    if (!password || password.length < 8) {
        return { isValid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Za-z]/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one letter' };
    }
    if (!/\d/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one number' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one special character' };
    }
    return { isValid: true, message: '' };
}
function checkPasswordHistory(userId, newPassword) {
    return __awaiter(this, void 0, void 0, function () {
        var command, result, _i, _a, item, isMatch, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 6, , 7]);
                    command = new lib_dynamodb_1.QueryCommand({
                        TableName: process.env.PASSWORD_HISTORY_TABLE,
                        KeyConditionExpression: 'userId = :userId',
                        ExpressionAttributeValues: {
                            ':userId': userId,
                        },
                        ScanIndexForward: false, // Get most recent first
                        Limit: 5,
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _b.sent();
                    if (!result.Items || result.Items.length === 0) {
                        return [2 /*return*/, false];
                    }
                    _i = 0, _a = result.Items;
                    _b.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 5];
                    item = _a[_i];
                    return [4 /*yield*/, bcrypt.compare(newPassword, item.passwordHash)];
                case 3:
                    isMatch = _b.sent();
                    if (isMatch) {
                        return [2 /*return*/, true];
                    }
                    _b.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, false];
                case 6:
                    error_2 = _b.sent();
                    console.error('Error checking password history:', error_2);
                    return [2 /*return*/, false]; // Allow password change if history check fails
                case 7: return [2 /*return*/];
            }
        });
    });
}
function storePasswordHistory(userId, password) {
    return __awaiter(this, void 0, void 0, function () {
        var passwordHash, now, historyCommand, historyResult, itemsToDelete, _i, itemsToDelete_1, item, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, , 9]);
                    return [4 /*yield*/, bcrypt.hash(password, 12)];
                case 1:
                    passwordHash = _a.sent();
                    now = new Date().toISOString();
                    return [4 /*yield*/, docClient.send(new lib_dynamodb_1.PutCommand({
                            TableName: process.env.PASSWORD_HISTORY_TABLE,
                            Item: {
                                userId: userId,
                                createdAt: now,
                                passwordHash: passwordHash,
                                expiresAt: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year TTL
                            },
                        }))];
                case 2:
                    _a.sent();
                    historyCommand = new lib_dynamodb_1.QueryCommand({
                        TableName: process.env.PASSWORD_HISTORY_TABLE,
                        KeyConditionExpression: 'userId = :userId',
                        ExpressionAttributeValues: {
                            ':userId': userId,
                        },
                        ScanIndexForward: false,
                        Limit: 10, // Get more than we need to clean up
                    });
                    return [4 /*yield*/, docClient.send(historyCommand)];
                case 3:
                    historyResult = _a.sent();
                    if (!(historyResult.Items && historyResult.Items.length > 5)) return [3 /*break*/, 7];
                    itemsToDelete = historyResult.Items.slice(5);
                    _i = 0, itemsToDelete_1 = itemsToDelete;
                    _a.label = 4;
                case 4:
                    if (!(_i < itemsToDelete_1.length)) return [3 /*break*/, 7];
                    item = itemsToDelete_1[_i];
                    return [4 /*yield*/, docClient.send(new lib_dynamodb_1.DeleteCommand({
                            TableName: process.env.PASSWORD_HISTORY_TABLE,
                            Key: {
                                userId: item.userId,
                                createdAt: item.createdAt,
                            },
                        }))];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7: return [3 /*break*/, 9];
                case 8:
                    error_3 = _a.sent();
                    console.error('Error storing password history:', error_3);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
function getUserSecuritySettings(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var command, result, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    command = new lib_dynamodb_1.GetCommand({
                        TableName: process.env.USER_SECURITY_SETTINGS_TABLE,
                        Key: { userId: userId },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.Item || null];
                case 2:
                    error_4 = _a.sent();
                    console.error('Error getting security settings:', error_4);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function updatePasswordChangeTimestamp(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var now, existingSettings, settings, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    now = new Date().toISOString();
                    return [4 /*yield*/, getUserSecuritySettings(userId)];
                case 1:
                    existingSettings = _a.sent();
                    settings = __assign(__assign({ userId: userId, twoFactorEnabled: false, sessionTimeout: 480, allowMultipleSessions: true, requirePasswordChangeEvery: 0, failedLoginAttempts: 0, createdAt: (existingSettings === null || existingSettings === void 0 ? void 0 : existingSettings.createdAt) || now }, existingSettings), { passwordLastChanged: now, updatedAt: now });
                    return [4 /*yield*/, docClient.send(new lib_dynamodb_1.PutCommand({
                            TableName: process.env.USER_SECURITY_SETTINGS_TABLE,
                            Item: settings,
                        }))];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_5 = _a.sent();
                    console.error('Error updating password change timestamp:', error_5);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function resetFailedLoginAttempts(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var existingSettings, updatedSettings, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, getUserSecuritySettings(userId)];
                case 1:
                    existingSettings = _a.sent();
                    if (!existingSettings)
                        return [2 /*return*/];
                    updatedSettings = __assign(__assign({}, existingSettings), { failedLoginAttempts: 0, accountLockedUntil: undefined, updatedAt: new Date().toISOString() });
                    return [4 /*yield*/, docClient.send(new lib_dynamodb_1.PutCommand({
                            TableName: process.env.USER_SECURITY_SETTINGS_TABLE,
                            Item: updatedSettings,
                        }))];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_6 = _a.sent();
                    console.error('Error resetting failed login attempts:', error_6);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
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
