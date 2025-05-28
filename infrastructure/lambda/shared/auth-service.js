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
exports.AuthService = void 0;
var jsonwebtoken_1 = require("jsonwebtoken");
var jwks_rsa_1 = require("jwks-rsa");
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var client = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
var AuthService = /** @class */ (function () {
    function AuthService() {
    }
    /**
     * Enhanced JWT validation that also checks session status
     */
    AuthService.validateAuthentication = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var jwtResult, userId, sessionResult, error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        console.log('Starting enhanced authentication validation');
                        return [4 /*yield*/, this.validateJwtToken(token)];
                    case 1:
                        jwtResult = _a.sent();
                        if (!jwtResult.isValid) {
                            console.log('JWT validation failed:', jwtResult.errorMessage);
                            return [2 /*return*/, jwtResult];
                        }
                        userId = jwtResult.userId;
                        console.log("JWT validation successful for user: ".concat(userId));
                        return [4 /*yield*/, this.validateUserSession(userId)];
                    case 2:
                        sessionResult = _a.sent();
                        if (!sessionResult.hasActiveSessions) {
                            console.log("No active sessions found for user: ".concat(userId), sessionResult);
                            return [2 /*return*/, {
                                    isValid: false,
                                    errorMessage: 'No active sessions for user'
                                }];
                        }
                        console.log("Session validation successful for user: ".concat(userId, ", active sessions: ").concat(sessionResult.sessionCount));
                        return [2 /*return*/, {
                                isValid: true,
                                userId: userId,
                                userClaims: jwtResult.userClaims
                            }];
                    case 3:
                        error_1 = _a.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : 'Authentication failed';
                        console.error('Authentication validation error:', error_1);
                        return [2 /*return*/, {
                                isValid: false,
                                errorMessage: errorMessage
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * JWT-only validation for bootstrap scenarios (doesn't check session status)
     */
    AuthService.validateJwtOnly = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var jwtResult, userId, error_2, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        console.log('Starting JWT-only validation for bootstrap');
                        return [4 /*yield*/, this.validateJwtToken(token)];
                    case 1:
                        jwtResult = _a.sent();
                        if (!jwtResult.isValid) {
                            console.log('JWT validation failed:', jwtResult.errorMessage);
                            return [2 /*return*/, jwtResult];
                        }
                        userId = jwtResult.userId;
                        console.log("JWT-only validation successful for user: ".concat(userId));
                        return [2 /*return*/, {
                                isValid: true,
                                userId: userId,
                                userClaims: jwtResult.userClaims
                            }];
                    case 2:
                        error_2 = _a.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : 'JWT validation failed';
                        console.error('JWT-only validation error:', error_2);
                        return [2 /*return*/, {
                                isValid: false,
                                errorMessage: errorMessage
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if user has any active sessions (for bootstrap logic)
     */
    AuthService.checkUserHasActiveSessions = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionResult, error_3, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        console.log("\uD83D\uDD0D AUTH SERVICE: Checking active sessions for user ".concat(userId));
                        return [4 /*yield*/, this.validateUserSession(userId)];
                    case 1:
                        sessionResult = _a.sent();
                        console.log("\uD83D\uDCCA AUTH SERVICE: Session check result - Has active sessions: ".concat(sessionResult.hasActiveSessions, ", Count: ").concat(sessionResult.sessionCount));
                        return [2 /*return*/, sessionResult.hasActiveSessions];
                    case 2:
                        error_3 = _a.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : 'Unknown error';
                        console.error("\u274C AUTH SERVICE: Error checking sessions for user ".concat(userId, ":"), errorMessage);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validates JWT token signature and expiration
     */
    AuthService.validateJwtToken = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        var getKey = function (header, callback) {
                            _this.jwksClient.getSigningKey(header.kid, function (err, key) {
                                if (err) {
                                    console.error('Error getting signing key:', err);
                                    callback(err);
                                    return;
                                }
                                var signingKey = key === null || key === void 0 ? void 0 : key.getPublicKey();
                                callback(null, signingKey);
                            });
                        };
                        jsonwebtoken_1.default.verify(token, getKey, {
                            issuer: "https://cognito-idp.".concat(process.env.AWS_REGION || 'us-east-1', ".amazonaws.com/").concat(process.env.USER_POOL_ID),
                            algorithms: ['RS256'],
                        }, function (err, decoded) {
                            if (err) {
                                console.error('JWT verification failed:', err);
                                resolve({
                                    isValid: false,
                                    errorMessage: "JWT validation failed: ".concat(err.message)
                                });
                            }
                            else {
                                var userId = decoded.sub;
                                if (!userId) {
                                    resolve({
                                        isValid: false,
                                        errorMessage: 'Invalid JWT payload: missing user ID'
                                    });
                                }
                                else {
                                    resolve({
                                        isValid: true,
                                        userId: userId,
                                        userClaims: decoded
                                    });
                                }
                            }
                        });
                    })];
            });
        });
    };
    /**
     * Checks if user has at least one active session
     */
    AuthService.validateUserSession = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var command, result, sessions, currentTime, validSessions, _i, sessions_1, session, lastActivity, sessionTimeoutMinutes, timeDiffMinutes, sessionError_1, error_4, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 10, , 11]);
                        console.log("Checking active sessions for user: ".concat(userId));
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
                        });
                        return [4 /*yield*/, docClient.send(command)];
                    case 1:
                        result = _a.sent();
                        sessions = result.Items || [];
                        console.log("Found ".concat(sessions.length, " potentially active sessions for user ").concat(userId));
                        currentTime = new Date();
                        validSessions = [];
                        _i = 0, sessions_1 = sessions;
                        _a.label = 2;
                    case 2:
                        if (!(_i < sessions_1.length)) return [3 /*break*/, 9];
                        session = sessions_1[_i];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 7, , 8]);
                        lastActivity = new Date(session.lastActivity);
                        sessionTimeoutMinutes = session.sessionTimeout || 480;
                        timeDiffMinutes = (currentTime.getTime() - lastActivity.getTime()) / (1000 * 60);
                        if (!(timeDiffMinutes <= sessionTimeoutMinutes)) return [3 /*break*/, 4];
                        validSessions.push(session);
                        console.log("Valid session found: ".concat(session.sessionId, ", last activity: ").concat(session.lastActivity));
                        return [3 /*break*/, 6];
                    case 4:
                        console.log("Session expired: ".concat(session.sessionId, ", last activity: ").concat(session.lastActivity, ", timeout: ").concat(sessionTimeoutMinutes, "min"));
                        // Mark expired session as inactive
                        return [4 /*yield*/, this.markSessionExpired(session.sessionId)];
                    case 5:
                        // Mark expired session as inactive
                        _a.sent();
                        _a.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        sessionError_1 = _a.sent();
                        console.error("Error validating session ".concat(session.sessionId, ":"), sessionError_1);
                        return [3 /*break*/, 8];
                    case 8:
                        _i++;
                        return [3 /*break*/, 2];
                    case 9: return [2 /*return*/, {
                            hasActiveSessions: validSessions.length > 0,
                            sessionCount: validSessions.length
                        }];
                    case 10:
                        error_4 = _a.sent();
                        errorMessage = error_4 instanceof Error ? error_4.message : 'Session validation error';
                        console.error("Session validation failed for user ".concat(userId, ":"), error_4);
                        return [2 /*return*/, {
                                hasActiveSessions: false,
                                sessionCount: 0,
                                errorMessage: "Session validation error: ".concat(errorMessage)
                            }];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Mark expired sessions as inactive
     */
    AuthService.markSessionExpired = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var updateCommand, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        updateCommand = new lib_dynamodb_1.UpdateCommand({
                            TableName: process.env.USER_SESSIONS_TABLE,
                            Key: { sessionId: sessionId },
                            UpdateExpression: 'SET isActive = :false, expiredAt = :now',
                            ExpressionAttributeValues: {
                                ':false': false,
                                ':now': new Date().toISOString()
                            }
                        });
                        return [4 /*yield*/, docClient.send(updateCommand)];
                    case 1:
                        _a.sent();
                        console.log("Session ".concat(sessionId, " marked as expired"));
                        return [3 /*break*/, 3];
                    case 2:
                        error_5 = _a.sent();
                        console.error("Failed to mark session ".concat(sessionId, " as expired:"), error_5);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Extract and clean Bearer token from Authorization header
     */
    AuthService.extractBearerToken = function (authorizationHeader) {
        if (!authorizationHeader) {
            return null;
        }
        var parts = authorizationHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return null;
        }
        return parts[1] || null;
    };
    AuthService.jwksClient = (0, jwks_rsa_1.default)({
        jwksUri: "https://cognito-idp.".concat(process.env.AWS_REGION || 'us-east-1', ".amazonaws.com/").concat(process.env.USER_POOL_ID, "/.well-known/jwks.json"),
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 10 * 60 * 1000, // 10 minutes
    });
    return AuthService;
}());
exports.AuthService = AuthService;
