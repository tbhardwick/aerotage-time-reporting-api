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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var types_1 = require("../../shared/types");
var client = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, authContext, authenticatedUserId, currentSessionId, currentUserAgent_1, currentIP_1, command, result, rawSessions, identifiedCurrentSessionId, sortedSessions, legacySessions, currentSession_1, _i, legacySessions_1, session, updateCurrentCommand, otherLegacySessions, sessions, identifiedCurrentSession_1, matchingSessions, response, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 6, , 7]);
                console.log('List user sessions request:', JSON.stringify(event, null, 2));
                userId = (_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required')];
                }
                authContext = event.requestContext.authorizer;
                authenticatedUserId = authContext === null || authContext === void 0 ? void 0 : authContext.userId;
                currentSessionId = authContext === null || authContext === void 0 ? void 0 : authContext.sessionId;
                console.log('Authorizer context:', JSON.stringify(authContext, null, 2));
                console.log('Current session ID from context:', currentSessionId);
                // Authorization check: users can only view their own sessions
                if (userId !== authenticatedUserId) {
                    return [2 /*return*/, createErrorResponse(403, types_1.ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 'You can only view your own sessions')];
                }
                currentUserAgent_1 = event.headers['User-Agent'] || event.headers['user-agent'] || '';
                currentIP_1 = getClientIP(event);
                console.log('Current request details for session matching:');
                console.log("  User Agent: ".concat(currentUserAgent_1));
                console.log("  IP Address: ".concat(currentIP_1));
                command = new lib_dynamodb_1.QueryCommand({
                    TableName: process.env.USER_SESSIONS_TABLE,
                    IndexName: 'UserIndex', // GSI for userId lookup
                    KeyConditionExpression: 'userId = :userId',
                    FilterExpression: 'isActive = :isActive AND expiresAt > :now',
                    ExpressionAttributeValues: {
                        ':userId': userId,
                        ':isActive': true,
                        ':now': new Date().toISOString(),
                    },
                    ScanIndexForward: false, // Get most recent first
                });
                return [4 /*yield*/, docClient.send(command)];
            case 1:
                result = _b.sent();
                rawSessions = result.Items || [];
                console.log("Found ".concat(rawSessions.length, " active sessions for user ").concat(userId));
                identifiedCurrentSessionId = currentSessionId;
                if (!identifiedCurrentSessionId && rawSessions.length > 0) {
                    sortedSessions = __spreadArray([], rawSessions, true).sort(function (a, b) {
                        return new Date(b.lastActivity || b.createdAt).getTime() -
                            new Date(a.lastActivity || a.createdAt).getTime();
                    });
                    // The most recently active session is likely the current one
                    identifiedCurrentSessionId = sortedSessions[0].sessionId;
                    console.log("No session ID from context, using most recent session: ".concat(identifiedCurrentSessionId));
                }
                legacySessions = rawSessions.filter(function (session) { return !session.sessionIdentifier; });
                if (!(legacySessions.length > 0 && identifiedCurrentSessionId)) return [3 /*break*/, 5];
                console.log("Found ".concat(legacySessions.length, " legacy sessions without sessionIdentifier. Migrating current session and cleaning up others."));
                currentSession_1 = null;
                for (_i = 0, legacySessions_1 = legacySessions; _i < legacySessions_1.length; _i++) {
                    session = legacySessions_1[_i];
                    if (session.sessionId === identifiedCurrentSessionId) {
                        currentSession_1 = session;
                        break;
                    }
                }
                if (!currentSession_1) return [3 /*break*/, 3];
                console.log("Migrating current session ".concat(currentSession_1.sessionId, " with sessionIdentifier: ").concat(identifiedCurrentSessionId));
                updateCurrentCommand = new lib_dynamodb_1.UpdateCommand({
                    TableName: process.env.USER_SESSIONS_TABLE,
                    Key: { sessionId: currentSession_1.sessionId },
                    UpdateExpression: 'SET sessionIdentifier = :sessionIdentifier, updatedAt = :now',
                    ExpressionAttributeValues: {
                        ':sessionIdentifier': identifiedCurrentSessionId,
                        ':now': new Date().toISOString(),
                    },
                });
                return [4 /*yield*/, docClient.send(updateCurrentCommand)];
            case 2:
                _b.sent();
                // Update the session in our local array
                currentSession_1.sessionIdentifier = identifiedCurrentSessionId;
                _b.label = 3;
            case 3:
                otherLegacySessions = legacySessions.filter(function (session) {
                    return session.sessionId !== (currentSession_1 === null || currentSession_1 === void 0 ? void 0 : currentSession_1.sessionId);
                });
                if (!(otherLegacySessions.length > 0)) return [3 /*break*/, 5];
                console.log("Invalidating ".concat(otherLegacySessions.length, " other legacy sessions"));
                return [4 /*yield*/, invalidateSpecificSessions(otherLegacySessions.map(function (s) { return s.sessionId; }))];
            case 4:
                _b.sent();
                _b.label = 5;
            case 5:
                sessions = rawSessions.map(function (item) {
                    // Parse location data if it exists
                    var location;
                    if (item.locationData) {
                        try {
                            location = typeof item.locationData === 'string'
                                ? JSON.parse(item.locationData)
                                : item.locationData;
                        }
                        catch (error) {
                            console.error('Error parsing location data:', error);
                        }
                    }
                    return {
                        id: item.sessionId,
                        ipAddress: item.ipAddress || 'Unknown',
                        userAgent: item.userAgent || 'Unknown',
                        loginTime: item.loginTime,
                        lastActivity: item.lastActivity,
                        isCurrent: false, // Will be set later
                        location: location,
                    };
                });
                identifiedCurrentSession_1 = null;
                matchingSessions = sessions.filter(function (session) {
                    return session.userAgent === currentUserAgent_1 && session.ipAddress === currentIP_1;
                });
                if (matchingSessions.length > 0) {
                    // Sort by last activity (most recent first)
                    matchingSessions.sort(function (a, b) {
                        var aTime = new Date(a.lastActivity || a.loginTime).getTime();
                        var bTime = new Date(b.lastActivity || b.loginTime).getTime();
                        return bTime - aTime;
                    });
                    // The most recently active matching session is the current one
                    identifiedCurrentSession_1 = matchingSessions[0].id;
                    console.log("Identified current session: ".concat(identifiedCurrentSession_1, " (most recent of ").concat(matchingSessions.length, " matching sessions)"));
                }
                // Mark only the identified current session
                sessions.forEach(function (session) {
                    session.isCurrent = session.id === identifiedCurrentSession_1;
                });
                // Sort sessions by last activity (most recent first)
                sessions.sort(function (a, b) {
                    if (a.isCurrent && !b.isCurrent)
                        return -1;
                    if (!a.isCurrent && b.isCurrent)
                        return 1;
                    var aTime = new Date(a.lastActivity || a.loginTime).getTime();
                    var bTime = new Date(b.lastActivity || b.loginTime).getTime();
                    return bTime - aTime;
                });
                console.log("Returning ".concat(sessions.length, " sessions, current session identified: ").concat(sessions.some(function (s) { return s.isCurrent; })));
                response = {
                    success: true,
                    data: sessions,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 6:
                error_1 = _b.sent();
                console.error('List sessions error:', error_1);
                return [2 /*return*/, createErrorResponse(500, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Internal server error')];
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
/**
 * Invalidate specific sessions by their IDs
 */
function invalidateSpecificSessions(sessionIds) {
    return __awaiter(this, void 0, void 0, function () {
        var updatePromises, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log("Invalidating ".concat(sessionIds.length, " specific sessions:"), sessionIds);
                    updatePromises = sessionIds.map(function (sessionId) {
                        var updateCommand = new lib_dynamodb_1.UpdateCommand({
                            TableName: process.env.USER_SESSIONS_TABLE,
                            Key: { sessionId: sessionId },
                            UpdateExpression: 'SET isActive = :false, updatedAt = :now, invalidationReason = :reason',
                            ExpressionAttributeValues: {
                                ':false': false,
                                ':now': new Date().toISOString(),
                                ':reason': 'legacy_session_cleanup'
                            },
                        });
                        return docClient.send(updateCommand);
                    });
                    return [4 /*yield*/, Promise.all(updatePromises)];
                case 1:
                    _a.sent();
                    console.log("Successfully invalidated ".concat(sessionIds.length, " specific sessions"));
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    console.error("Error invalidating specific sessions:", error_2);
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Invalidate all active sessions for a user
 */
function invalidateAllUserSessions(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var command, result, sessions, updatePromises, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    console.log("Invalidating all sessions for user: ".concat(userId));
                    command = new lib_dynamodb_1.QueryCommand({
                        TableName: process.env.USER_SESSIONS_TABLE,
                        IndexName: 'UserIndex',
                        KeyConditionExpression: 'userId = :userId',
                        FilterExpression: 'isActive = :isActive',
                        ExpressionAttributeValues: {
                            ':userId': userId,
                            ':isActive': true,
                        },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    sessions = result.Items || [];
                    if (sessions.length === 0) {
                        console.log('No active sessions found to invalidate');
                        return [2 /*return*/];
                    }
                    updatePromises = sessions.map(function (session) {
                        var updateCommand = new lib_dynamodb_1.UpdateCommand({
                            TableName: process.env.USER_SESSIONS_TABLE,
                            Key: { sessionId: session.sessionId },
                            UpdateExpression: 'SET isActive = :false, updatedAt = :now, invalidationReason = :reason',
                            ExpressionAttributeValues: {
                                ':false': false,
                                ':now': new Date().toISOString(),
                                ':reason': 'session_migration_security_update'
                            },
                        });
                        return docClient.send(updateCommand);
                    });
                    return [4 /*yield*/, Promise.all(updatePromises)];
                case 2:
                    _a.sent();
                    console.log("Successfully invalidated ".concat(sessions.length, " sessions for user ").concat(userId));
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    console.error("Error invalidating sessions for user ".concat(userId, ":"), error_3);
                    throw error_3;
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
