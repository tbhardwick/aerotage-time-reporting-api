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
    var authContext, userId, currentUserAgent, currentIP, currentSessionId, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                console.log('Logout request:', JSON.stringify(event, null, 2));
                authContext = event.requestContext.authorizer;
                userId = authContext === null || authContext === void 0 ? void 0 : authContext.userId;
                if (!userId) {
                    return [2 /*return*/, createErrorResponse(401, types_1.ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 'User authentication required')];
                }
                currentUserAgent = event.headers['User-Agent'] || event.headers['user-agent'] || '';
                currentIP = getClientIP(event);
                console.log('Logout request details:');
                console.log("  User ID: ".concat(userId));
                console.log("  User Agent: ".concat(currentUserAgent));
                console.log("  IP Address: ".concat(currentIP));
                return [4 /*yield*/, findAndDeleteCurrentSession(userId, currentUserAgent, currentIP)];
            case 1:
                currentSessionId = _a.sent();
                if (currentSessionId) {
                    console.log("Successfully deleted current session: ".concat(currentSessionId));
                }
                else {
                    console.log('No current session found to delete');
                }
                // Also clean up any expired sessions for this user
                return [4 /*yield*/, cleanupExpiredSessions(userId)];
            case 2:
                // Also clean up any expired sessions for this user
                _a.sent();
                response = {
                    success: true,
                    data: {
                        message: 'Logout successful',
                        sessionId: currentSessionId || undefined,
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
            case 3:
                error_1 = _a.sent();
                console.error('Logout error:', error_1);
                return [2 /*return*/, createErrorResponse(500, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Logout failed')];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
/**
 * Find and delete the current session based on user agent and IP
 */
function findAndDeleteCurrentSession(userId, userAgent, ipAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var queryCommand, result, activeSessions, matchingSessions, currentSession, sessionId, deleteCommand, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    queryCommand = new lib_dynamodb_1.QueryCommand({
                        TableName: process.env.USER_SESSIONS_TABLE,
                        IndexName: 'UserIndex',
                        KeyConditionExpression: 'userId = :userId',
                        FilterExpression: 'isActive = :isActive AND expiresAt > :now',
                        ExpressionAttributeValues: {
                            ':userId': userId,
                            ':isActive': true,
                            ':now': new Date().toISOString(),
                        },
                    });
                    return [4 /*yield*/, docClient.send(queryCommand)];
                case 1:
                    result = _a.sent();
                    activeSessions = result.Items || [];
                    console.log("Found ".concat(activeSessions.length, " active sessions for user ").concat(userId));
                    matchingSessions = activeSessions.filter(function (s) {
                        return s.userAgent === userAgent && s.ipAddress === ipAddress;
                    });
                    if (matchingSessions.length === 0) {
                        console.log('No matching sessions found for current request');
                        return [2 /*return*/, null];
                    }
                    // Sort by last activity (most recent first) and take the most recent one
                    matchingSessions.sort(function (a, b) {
                        var aTime = new Date(a.lastActivity || a.loginTime).getTime();
                        var bTime = new Date(b.lastActivity || b.loginTime).getTime();
                        return bTime - aTime;
                    });
                    currentSession = matchingSessions[0];
                    sessionId = currentSession.sessionId;
                    console.log("Identified current session to delete: ".concat(sessionId));
                    deleteCommand = new lib_dynamodb_1.DeleteCommand({
                        TableName: process.env.USER_SESSIONS_TABLE,
                        Key: { sessionId: sessionId },
                    });
                    return [4 /*yield*/, docClient.send(deleteCommand)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, sessionId];
                case 3:
                    error_2 = _a.sent();
                    console.error('Error finding and deleting current session:', error_2);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Clean up expired sessions for the user
 */
function cleanupExpiredSessions(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var queryCommand, result, allSessions, now_1, expiredSessions, deletePromises, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    queryCommand = new lib_dynamodb_1.QueryCommand({
                        TableName: process.env.USER_SESSIONS_TABLE,
                        IndexName: 'UserIndex',
                        KeyConditionExpression: 'userId = :userId',
                        ExpressionAttributeValues: {
                            ':userId': userId,
                        },
                    });
                    return [4 /*yield*/, docClient.send(queryCommand)];
                case 1:
                    result = _a.sent();
                    allSessions = result.Items || [];
                    now_1 = new Date();
                    expiredSessions = allSessions.filter(function (session) {
                        // Session is expired if:
                        // 1. expiresAt is in the past, OR
                        // 2. isActive is false, OR
                        // 3. lastActivity is too old based on session timeout
                        var expiresAt = new Date(session.expiresAt);
                        var lastActivity = new Date(session.lastActivity || session.loginTime);
                        var sessionTimeoutMinutes = session.sessionTimeout || 480; // Default 8 hours
                        var timeoutMs = sessionTimeoutMinutes * 60 * 1000;
                        return (expiresAt <= now_1 ||
                            !session.isActive ||
                            (now_1.getTime() - lastActivity.getTime()) > timeoutMs);
                    });
                    console.log("Found ".concat(expiredSessions.length, " expired sessions to clean up"));
                    deletePromises = expiredSessions.map(function (session) {
                        var deleteCommand = new lib_dynamodb_1.DeleteCommand({
                            TableName: process.env.USER_SESSIONS_TABLE,
                            Key: { sessionId: session.sessionId },
                        });
                        return docClient.send(deleteCommand);
                    });
                    return [4 /*yield*/, Promise.all(deletePromises)];
                case 2:
                    _a.sent();
                    if (expiredSessions.length > 0) {
                        console.log("Cleaned up ".concat(expiredSessions.length, " expired sessions"));
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    console.error('Error cleaning up expired sessions:', error_3);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
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
