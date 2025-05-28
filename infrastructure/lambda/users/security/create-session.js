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
var uuid_1 = require("uuid");
var types_1 = require("../../shared/types");
var client = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, authorizerContext, authenticatedUserId, requestBody, validation, ipAddress, userAgent, loginTime, loginTimestamp, now, timeDiff, fiveMinutesInMs, authHeader, sessionToken, sessionId, sessionIdentifier, currentTime, securitySettings, sessionTimeoutMs, expiresAt, location_1, sessionData, command, responseData, response, error_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 6, , 7]);
                console.log('🔥 SESSION CREATION LAMBDA INVOKED 🔥');
                console.log('='.repeat(50));
                console.log('📋 SESSION CREATION DEBUG DETAILS:');
                console.log("   Timestamp: ".concat(new Date().toISOString()));
                console.log("   HTTP Method: ".concat(event.httpMethod));
                console.log("   Resource Path: ".concat(event.resource));
                console.log("   Path Parameters:", JSON.stringify(event.pathParameters, null, 2));
                console.log("   Request Context:", JSON.stringify(event.requestContext, null, 2));
                console.log("   Headers:", JSON.stringify(event.headers, null, 2));
                console.log("   Body:", event.body);
                console.log('📋 Full event object:', JSON.stringify(event, null, 2));
                // Extract user ID from path parameters
                console.log('\n🔍 STEP 1: User ID Extraction and Validation');
                console.log('-'.repeat(45));
                userId = (_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.id;
                console.log("   User ID from path: ".concat(userId));
                if (!userId) {
                    console.log('❌ FAILED: No user ID in path parameters');
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required')];
                }
                console.log('✅ SUCCESS: User ID extracted from path');
                // Get authenticated user from context
                console.log('\n🔍 STEP 2: Authorization Context Analysis');
                console.log('-'.repeat(42));
                authorizerContext = event.requestContext.authorizer;
                authenticatedUserId = (authorizerContext === null || authorizerContext === void 0 ? void 0 : authorizerContext.userId) || ((_b = authorizerContext === null || authorizerContext === void 0 ? void 0 : authorizerContext.claims) === null || _b === void 0 ? void 0 : _b.sub);
                console.log("   Authorizer context:", JSON.stringify(authorizerContext, null, 2));
                console.log("   Authenticated user ID: ".concat(authenticatedUserId));
                console.log("   Path user ID: ".concat(userId));
                // Authorization check: users can only create sessions for themselves
                console.log('\n🔍 STEP 3: Authorization Validation');
                console.log('-'.repeat(35));
                if (userId !== authenticatedUserId) {
                    console.log('❌ AUTHORIZATION FAILED: User ID mismatch');
                    console.log("   Path user ID: ".concat(userId));
                    console.log("   Authenticated user ID: ".concat(authenticatedUserId));
                    return [2 /*return*/, createErrorResponse(403, types_1.ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 'You can only create sessions for yourself')];
                }
                console.log('✅ SUCCESS: Authorization validation passed');
                requestBody = void 0;
                try {
                    requestBody = JSON.parse(event.body || '{}');
                }
                catch (error) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Invalid JSON in request body')];
                }
                validation = validateSessionCreationRequest(requestBody);
                if (!validation.isValid) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validation.message)];
                }
                ipAddress = getClientIP(event);
                userAgent = requestBody.userAgent || 'Unknown';
                loginTime = requestBody.loginTime || new Date().toISOString();
                loginTimestamp = new Date(loginTime);
                now = new Date();
                timeDiff = now.getTime() - loginTimestamp.getTime();
                fiveMinutesInMs = 5 * 60 * 1000;
                if (timeDiff > fiveMinutesInMs || timeDiff < -fiveMinutesInMs) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Login time must be within the last 5 minutes')];
                }
                authHeader = event.headers.Authorization || event.headers.authorization;
                sessionToken = (authHeader === null || authHeader === void 0 ? void 0 : authHeader.replace('Bearer ', '')) || '';
                sessionId = (0, uuid_1.v4)();
                sessionIdentifier = sessionId;
                currentTime = new Date().toISOString();
                console.log('Generated stable session identifier:', sessionIdentifier);
                console.log('Session creation time:', currentTime);
                return [4 /*yield*/, getUserSecuritySettings(userId)];
            case 1:
                securitySettings = _c.sent();
                if (!!securitySettings.allowMultipleSessions) return [3 /*break*/, 3];
                // Terminate existing active sessions
                return [4 /*yield*/, terminateUserSessions(userId, sessionToken)];
            case 2:
                // Terminate existing active sessions
                _c.sent();
                _c.label = 3;
            case 3:
                sessionTimeoutMs = securitySettings.sessionTimeout * 60 * 1000;
                expiresAt = new Date(loginTimestamp.getTime() + sessionTimeoutMs).toISOString();
                return [4 /*yield*/, getLocationFromIP(ipAddress)];
            case 4:
                location_1 = _c.sent();
                sessionData = {
                    PK: "SESSION#".concat(sessionId),
                    SK: "SESSION#".concat(sessionId),
                    GSI1PK: "USER#".concat(userId),
                    GSI1SK: "SESSION#".concat(currentTime),
                    sessionId: sessionId,
                    userId: userId,
                    sessionToken: sessionToken,
                    sessionIdentifier: sessionIdentifier, // Store the stable session identifier
                    ipAddress: ipAddress,
                    userAgent: userAgent,
                    loginTime: loginTime,
                    lastActivity: currentTime, // Use current time to ensure this is the most recent
                    expiresAt: expiresAt,
                    isActive: true,
                    locationData: location_1 ? JSON.stringify(location_1) : undefined,
                    createdAt: currentTime,
                    updatedAt: currentTime,
                };
                console.log('Session data to be stored:', {
                    sessionId: sessionId,
                    userId: userId,
                    sessionIdentifier: sessionIdentifier,
                    ipAddress: ipAddress,
                    userAgent: userAgent,
                    loginTime: loginTime,
                    expiresAt: expiresAt
                });
                command = new lib_dynamodb_1.PutCommand({
                    TableName: process.env.USER_SESSIONS_TABLE,
                    Item: sessionData,
                });
                return [4 /*yield*/, docClient.send(command)];
            case 5:
                _c.sent();
                responseData = {
                    id: sessionId,
                    ipAddress: ipAddress,
                    userAgent: userAgent,
                    loginTime: loginTime,
                    lastActivity: loginTime,
                    isCurrent: true, // New sessions are always current
                    location: location_1,
                };
                response = {
                    success: true,
                    data: responseData,
                };
                return [2 /*return*/, {
                        statusCode: 201,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 6:
                error_1 = _c.sent();
                console.error('Create session error:', error_1);
                return [2 /*return*/, createErrorResponse(500, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Failed to create session record')];
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function validateSessionCreationRequest(body) {
    // userAgent is required
    if (!body.userAgent || typeof body.userAgent !== 'string') {
        return { isValid: false, message: 'userAgent is required and must be a string' };
    }
    // userAgent length check
    if (body.userAgent.length > 1000) {
        return { isValid: false, message: 'userAgent must be less than 1000 characters' };
    }
    // loginTime validation (if provided)
    if (body.loginTime) {
        if (typeof body.loginTime !== 'string') {
            return { isValid: false, message: 'loginTime must be an ISO datetime string' };
        }
        var loginTime = new Date(body.loginTime);
        if (isNaN(loginTime.getTime())) {
            return { isValid: false, message: 'loginTime must be a valid ISO datetime string' };
        }
    }
    // ipAddress validation (if provided)
    if (body.ipAddress) {
        if (typeof body.ipAddress !== 'string') {
            return { isValid: false, message: 'ipAddress must be a string' };
        }
        // Basic IP address format validation
        var ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        if (!ipRegex.test(body.ipAddress)) {
            return { isValid: false, message: 'ipAddress must be a valid IPv4 or IPv6 address' };
        }
    }
    return { isValid: true, message: '' };
}
function getClientIP(event) {
    // Check various headers in order of preference
    var xForwardedFor = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
    var xRealIP = event.headers['x-real-ip'] || event.headers['X-Real-IP'];
    var cfConnectingIP = event.headers['cf-connecting-ip'] || event.headers['CF-Connecting-IP'];
    var sourceIP = event.requestContext.identity.sourceIp;
    if (xForwardedFor) {
        // X-Forwarded-For can contain multiple IPs, take the first (original client)
        return xForwardedFor.split(',')[0].trim();
    }
    return xRealIP || cfConnectingIP || sourceIP || 'unknown';
}
function getLocationFromIP(ipAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var response, data, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    // Skip location lookup for local/private IP addresses
                    if (ipAddress === 'unknown' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.') || ipAddress === '127.0.0.1') {
                        return [2 /*return*/, undefined];
                    }
                    return [4 /*yield*/, fetch("http://ip-api.com/json/".concat(ipAddress, "?fields=status,city,country"))];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.json()];
                case 2:
                    data = _a.sent();
                    if (data.status === 'success' && data.city && data.country) {
                        return [2 /*return*/, {
                                city: data.city,
                                country: data.country
                            }];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    console.log('Failed to get location for IP:', ipAddress, error_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, undefined]; // Location is optional
            }
        });
    });
}
function getUserSecuritySettings(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var command, result, settings, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    command = new lib_dynamodb_1.QueryCommand({
                        TableName: process.env.USER_SECURITY_SETTINGS_TABLE,
                        KeyConditionExpression: 'PK = :pk AND SK = :sk',
                        ExpressionAttributeValues: {
                            ':pk': "USER#".concat(userId),
                            ':sk': 'SECURITY',
                        },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    if (result.Items && result.Items.length > 0) {
                        settings = result.Items[0];
                        return [2 /*return*/, {
                                sessionTimeout: settings.sessionTimeout || 480, // Default 8 hours
                                allowMultipleSessions: settings.allowMultipleSessions !== false, // Default true
                            }];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error getting user security settings:', error_3);
                    return [3 /*break*/, 3];
                case 3: 
                // Return default settings if not found or error
                return [2 /*return*/, {
                        sessionTimeout: 480, // 8 hours
                        allowMultipleSessions: true,
                    }];
            }
        });
    });
}
function terminateUserSessions(userId, currentSessionToken) {
    return __awaiter(this, void 0, void 0, function () {
        var command, result, updatePromises, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    command = new lib_dynamodb_1.QueryCommand({
                        TableName: process.env.USER_SESSIONS_TABLE,
                        IndexName: 'UserIndex',
                        KeyConditionExpression: 'userId = :userId',
                        FilterExpression: 'isActive = :isActive AND sessionToken <> :currentToken',
                        ExpressionAttributeValues: {
                            ':userId': userId,
                            ':isActive': true,
                            ':currentToken': currentSessionToken,
                        },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    if (!(result.Items && result.Items.length > 0)) return [3 /*break*/, 3];
                    updatePromises = result.Items.map(function (session) {
                        var updateCommand = new lib_dynamodb_1.PutCommand({
                            TableName: process.env.USER_SESSIONS_TABLE,
                            Item: __assign(__assign({}, session), { isActive: false, updatedAt: new Date().toISOString() }),
                        });
                        return docClient.send(updateCommand);
                    });
                    return [4 /*yield*/, Promise.all(updatePromises)];
                case 2:
                    _a.sent();
                    console.log("Terminated ".concat(result.Items.length, " existing sessions for user ").concat(userId));
                    _a.label = 3;
                case 3: return [3 /*break*/, 5];
                case 4:
                    error_4 = _a.sent();
                    console.error('Error terminating user sessions:', error_4);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
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
