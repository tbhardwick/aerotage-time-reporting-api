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
    var userId, sessionId, authContext, authenticatedUserId, currentUserAgent_1, currentIP_1, getCommand, getResult, session, queryCommand, queryResult, activeSessions, matchingSessions, currentSessionId, isCurrentSession, deleteCommand, response, error_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 4, , 5]);
                console.log('Terminate session request:', JSON.stringify(event, null, 2));
                userId = (_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.id;
                sessionId = (_b = event.pathParameters) === null || _b === void 0 ? void 0 : _b.sessionId;
                if (!userId) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required')];
                }
                if (!sessionId) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 'Session ID is required')];
                }
                authContext = event.requestContext.authorizer;
                authenticatedUserId = authContext === null || authContext === void 0 ? void 0 : authContext.userId;
                // Authorization check: users can only terminate their own sessions
                if (userId !== authenticatedUserId) {
                    return [2 /*return*/, createErrorResponse(403, types_1.ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 'You can only terminate your own sessions')];
                }
                currentUserAgent_1 = event.headers['User-Agent'] || event.headers['user-agent'] || '';
                currentIP_1 = getClientIP(event);
                console.log('Current request details for session matching:');
                console.log("  User Agent: ".concat(currentUserAgent_1));
                console.log("  IP Address: ".concat(currentIP_1));
                getCommand = new lib_dynamodb_1.GetCommand({
                    TableName: process.env.USER_SESSIONS_TABLE,
                    Key: { sessionId: sessionId },
                });
                return [4 /*yield*/, docClient.send(getCommand)];
            case 1:
                getResult = _c.sent();
                if (!getResult.Item) {
                    return [2 /*return*/, createErrorResponse(404, types_1.ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 'Session not found')];
                }
                session = getResult.Item;
                // Verify the session belongs to the authenticated user
                if (session.userId !== authenticatedUserId) {
                    return [2 /*return*/, createErrorResponse(403, types_1.ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 'You can only terminate your own sessions')];
                }
                // Check if session is already inactive
                if (!session.isActive) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 'Session is already inactive')];
                }
                // Check if session has expired
                if (new Date(session.expiresAt) <= new Date()) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 'Session has already expired')];
                }
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
            case 2:
                queryResult = _c.sent();
                activeSessions = queryResult.Items || [];
                matchingSessions = activeSessions.filter(function (s) {
                    return s.userAgent === currentUserAgent_1 && s.ipAddress === currentIP_1;
                });
                currentSessionId = null;
                if (matchingSessions.length > 0) {
                    // Sort by last activity (most recent first)
                    matchingSessions.sort(function (a, b) {
                        var aTime = new Date(a.lastActivity || a.loginTime).getTime();
                        var bTime = new Date(b.lastActivity || b.loginTime).getTime();
                        return bTime - aTime;
                    });
                    // The most recently active matching session is the current one
                    currentSessionId = matchingSessions[0].sessionId;
                    console.log("Identified current session: ".concat(currentSessionId, " (most recent of ").concat(matchingSessions.length, " matching sessions)"));
                }
                isCurrentSession = sessionId === currentSessionId;
                if (isCurrentSession) {
                    console.log('Preventing termination of current session:', {
                        sessionId: sessionId,
                        reason: 'Cannot terminate current session'
                    });
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.CANNOT_TERMINATE_CURRENT_SESSION, 'You cannot terminate your current session')];
                }
                deleteCommand = new lib_dynamodb_1.DeleteCommand({
                    TableName: process.env.USER_SESSIONS_TABLE,
                    Key: { sessionId: sessionId },
                });
                return [4 /*yield*/, docClient.send(deleteCommand)];
            case 3:
                _c.sent();
                console.log('Session deleted successfully:', {
                    sessionId: sessionId,
                    userId: userId,
                    terminatedBy: authenticatedUserId
                });
                response = {
                    success: true,
                    data: {
                        message: 'Session terminated successfully'
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
            case 4:
                error_1 = _c.sent();
                console.error('Terminate session error:', error_1);
                return [2 /*return*/, createErrorResponse(500, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Internal server error')];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
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
