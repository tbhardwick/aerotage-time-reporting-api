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
var crypto_1 = require("crypto");
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
// Valid event types for validation
var VALID_EVENT_TYPES = [
    // User actions
    'user_login',
    'user_logout',
    'user_profile_update',
    'user_preferences_update',
    'user_action',
    // Time tracking
    'timer_start',
    'timer_stop',
    'timer_pause',
    'time_entry_create',
    'time_entry_update',
    'time_entry_delete',
    'time_entry_submit',
    'time_entry_approve',
    'time_entry_reject',
    // Project management
    'project_create',
    'project_update',
    'project_delete',
    'project_view',
    // Client management
    'client_create',
    'client_update',
    'client_delete',
    'client_view',
    // Reporting
    'report_generate',
    'report_export',
    'report_schedule',
    'dashboard_view',
    // System events
    'api_error',
    'performance_metric',
    'feature_usage',
];
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, sessionId, requestBody, rateLimitCheck, analyticsEvent, error_1;
    var _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 5, , 6]);
                console.log('Track analytics event request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                sessionId = (_b = event.requestContext.authorizer) === null || _b === void 0 ? void 0 : _b.sessionId;
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                requestBody = void 0;
                try {
                    requestBody = JSON.parse(event.body || '{}');
                }
                catch (error) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_JSON', 'Invalid JSON in request body')];
                }
                // Validate required fields
                if (!requestBody.eventType) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'MISSING_EVENT_TYPE', 'eventType is required')];
                }
                // Validate event type
                if (!VALID_EVENT_TYPES.includes(requestBody.eventType)) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_EVENT_TYPE', "Invalid event type. Must be one of: ".concat(VALID_EVENT_TYPES.join(', ')))];
                }
                return [4 /*yield*/, checkRateLimit(userId)];
            case 1:
                rateLimitCheck = _c.sent();
                if (!rateLimitCheck.allowed) {
                    return [2 /*return*/, {
                            statusCode: 429,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                                'Retry-After': '60',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'RATE_LIMIT_EXCEEDED',
                                    message: 'Too many events. Please try again later.',
                                    retryAfter: 60,
                                },
                            }),
                        }];
                }
                _a = {
                    eventId: (0, crypto_1.randomUUID)(),
                    userId: userId,
                    eventType: requestBody.eventType,
                    timestamp: requestBody.timestamp || new Date().toISOString(),
                    sessionId: sessionId,
                    metadata: requestBody.metadata || {},
                    ipAddress: getClientIP(event),
                    userAgent: event.headers['User-Agent'] || event.headers['user-agent']
                };
                return [4 /*yield*/, getLocationFromIP(getClientIP(event))];
            case 2:
                analyticsEvent = (_a.location = _c.sent(),
                    _a.expiresAt = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60),
                    _a);
                // Store the event
                return [4 /*yield*/, storeAnalyticsEvent(analyticsEvent)];
            case 3:
                // Store the event
                _c.sent();
                // Update rate limiting counter
                return [4 /*yield*/, updateRateLimit(userId)];
            case 4:
                // Update rate limiting counter
                _c.sent();
                return [2 /*return*/, (0, response_helper_1.createSuccessResponse)({
                        eventId: analyticsEvent.eventId,
                        timestamp: analyticsEvent.timestamp,
                        message: 'Event tracked successfully',
                    }, 201)];
            case 5:
                error_1 = _c.sent();
                console.error('Error tracking analytics event:', error_1);
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_ERROR', 'Failed to track analytics event')];
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function storeAnalyticsEvent(analyticsEvent) {
    return __awaiter(this, void 0, void 0, function () {
        var analyticsTable, command;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    analyticsTable = process.env.ANALYTICS_EVENTS_TABLE_NAME;
                    if (!analyticsTable) {
                        throw new Error('ANALYTICS_EVENTS_TABLE_NAME environment variable not set');
                    }
                    command = new lib_dynamodb_1.PutCommand({
                        TableName: analyticsTable,
                        Item: analyticsEvent,
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    _a.sent();
                    console.log('Analytics event stored:', analyticsEvent.eventId);
                    return [2 /*return*/];
            }
        });
    });
}
function getClientIP(event) {
    var _a;
    // Try to get real IP from various headers (CloudFront, ALB, etc.)
    var xForwardedFor = event.headers['X-Forwarded-For'] || event.headers['x-forwarded-for'];
    if (xForwardedFor) {
        return xForwardedFor.split(',')[0].trim();
    }
    var xRealIP = event.headers['X-Real-IP'] || event.headers['x-real-ip'];
    if (xRealIP) {
        return xRealIP;
    }
    return ((_a = event.requestContext.identity) === null || _a === void 0 ? void 0 : _a.sourceIp) || 'unknown';
}
function getLocationFromIP(ipAddress) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // In production, integrate with a geolocation service like MaxMind or ipapi.co
            // For now, return undefined to avoid external dependencies
            try {
                // Placeholder for geolocation logic
                // const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
                // const data = await response.json();
                // return {
                //   country: data.country_name,
                //   region: data.region,
                //   city: data.city,
                // };
                return [2 /*return*/, undefined];
            }
            catch (error) {
                console.error('Error getting location from IP:', error);
                return [2 /*return*/, undefined];
            }
            return [2 /*return*/];
        });
    });
}
function checkRateLimit(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var rateLimitTable, currentHour, rateLimitKey;
        return __generator(this, function (_a) {
            // Simple rate limiting: 1000 events per hour per user
            // In production, use Redis or DynamoDB with TTL for more sophisticated rate limiting
            try {
                rateLimitTable = process.env.RATE_LIMIT_TABLE_NAME;
                if (!rateLimitTable) {
                    // If no rate limit table, allow all requests
                    return [2 /*return*/, { allowed: true, remaining: 999 }];
                }
                currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
                rateLimitKey = "".concat(userId, "-").concat(currentHour);
                // For now, return allowed (implement proper rate limiting in production)
                return [2 /*return*/, { allowed: true, remaining: 999 }];
            }
            catch (error) {
                console.error('Error checking rate limit:', error);
                // On error, allow the request
                return [2 /*return*/, { allowed: true, remaining: 999 }];
            }
            return [2 /*return*/];
        });
    });
}
function updateRateLimit(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var currentHour, rateLimitKey;
        return __generator(this, function (_a) {
            // Update rate limiting counter
            // Implementation depends on the rate limiting strategy chosen
            try {
                currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
                rateLimitKey = "".concat(userId, "-").concat(currentHour);
                // Placeholder for rate limit update logic
                console.log('Rate limit updated for:', rateLimitKey);
            }
            catch (error) {
                console.error('Error updating rate limit:', error);
                // Don't throw - rate limit update failure shouldn't break event tracking
            }
            return [2 /*return*/];
        });
    });
}
