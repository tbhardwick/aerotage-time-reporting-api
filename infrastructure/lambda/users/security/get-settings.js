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
// Default security settings for new users
var DEFAULT_SECURITY_SETTINGS = {
    twoFactorEnabled: false,
    sessionTimeout: 480, // 8 hours
    allowMultipleSessions: true,
    passwordChangeRequired: false,
    passwordLastChanged: new Date().toISOString(),
    securitySettings: {
        requirePasswordChangeEvery: 0, // Never
        maxFailedLoginAttempts: 5,
        accountLockoutDuration: 30, // 30 minutes
    },
};
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, authContext, authenticatedUserId, userRole, command, result, securitySettings, item, passwordExpiresAt, passwordDate, response, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                console.log('Get user security settings request:', JSON.stringify(event, null, 2));
                userId = (_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required')];
                }
                authContext = event.requestContext.authorizer;
                authenticatedUserId = authContext === null || authContext === void 0 ? void 0 : authContext.userId;
                userRole = (authContext === null || authContext === void 0 ? void 0 : authContext.role) || 'employee';
                // Authorization check: users can only access their own security settings
                if (userId !== authenticatedUserId) {
                    return [2 /*return*/, createErrorResponse(403, types_1.ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 'You can only access your own security settings')];
                }
                command = new lib_dynamodb_1.GetCommand({
                    TableName: process.env.USER_SECURITY_SETTINGS_TABLE,
                    Key: { userId: userId },
                });
                return [4 /*yield*/, docClient.send(command)];
            case 1:
                result = _b.sent();
                securitySettings = void 0;
                if (!result.Item) {
                    // Return default security settings if none exist
                    securitySettings = DEFAULT_SECURITY_SETTINGS;
                }
                else {
                    item = result.Item;
                    passwordExpiresAt = void 0;
                    if (item.requirePasswordChangeEvery > 0) {
                        passwordDate = new Date(item.passwordLastChanged);
                        passwordDate.setDate(passwordDate.getDate() + item.requirePasswordChangeEvery);
                        passwordExpiresAt = passwordDate.toISOString();
                    }
                    securitySettings = {
                        twoFactorEnabled: item.twoFactorEnabled || false,
                        sessionTimeout: item.sessionTimeout || 480,
                        allowMultipleSessions: item.allowMultipleSessions !== false, // Default to true
                        passwordChangeRequired: false, // Always false in response
                        passwordLastChanged: item.passwordLastChanged || DEFAULT_SECURITY_SETTINGS.passwordLastChanged,
                        passwordExpiresAt: passwordExpiresAt,
                        securitySettings: {
                            requirePasswordChangeEvery: item.requirePasswordChangeEvery || 0,
                            maxFailedLoginAttempts: 5, // Fixed value for security
                            accountLockoutDuration: 30, // Fixed value for security
                        },
                    };
                }
                response = {
                    success: true,
                    data: securitySettings,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 2:
                error_1 = _b.sent();
                console.error('Get security settings error:', error_1);
                return [2 /*return*/, createErrorResponse(500, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Internal server error')];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
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
