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
exports.trackRealTimeActivity = trackRealTimeActivity;
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, userRole, analyticsRequest, queryParams, analyticsData, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log('Real-time analytics request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                userRole = (user === null || user === void 0 ? void 0 : user.role) || 'employee';
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                analyticsRequest = void 0;
                if (event.body) {
                    try {
                        analyticsRequest = JSON.parse(event.body);
                    }
                    catch (error) {
                        return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_JSON', 'Invalid JSON in request body')];
                    }
                }
                else {
                    // Default configuration
                    analyticsRequest = {
                        metrics: ['activeUsers', 'currentSessions', 'todayHours', 'todayRevenue', 'liveTimers'],
                        includeActivities: true,
                        includeSessions: true,
                        includeAlerts: true,
                        refreshInterval: 30,
                    };
                }
                queryParams = event.queryStringParameters || {};
                if (queryParams.refreshInterval) {
                    analyticsRequest.refreshInterval = parseInt(queryParams.refreshInterval);
                }
                if (queryParams.includeActivities === 'false') {
                    analyticsRequest.includeActivities = false;
                }
                if (queryParams.includeSessions === 'false') {
                    analyticsRequest.includeSessions = false;
                }
                if (queryParams.includeAlerts === 'false') {
                    analyticsRequest.includeAlerts = false;
                }
                return [4 /*yield*/, generateRealTimeAnalytics(analyticsRequest, userId, userRole)];
            case 1:
                analyticsData = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0',
                        },
                        body: JSON.stringify({
                            success: true,
                            data: analyticsData,
                        }),
                    }];
            case 2:
                error_1 = _a.sent();
                console.error('Error generating real-time analytics:', error_1);
                return [2 /*return*/, {
                        statusCode: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify({
                            success: false,
                            error: {
                                code: 'REAL_TIME_ANALYTICS_FAILED',
                                message: 'Failed to generate real-time analytics',
                            },
                        }),
                    }];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function generateRealTimeAnalytics(request, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var timestamp, refreshInterval, metrics, activities, sessions, alerts;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    timestamp = new Date().toISOString();
                    refreshInterval = request.refreshInterval || 30;
                    return [4 /*yield*/, generateRealTimeMetrics(request.metrics, userId, userRole)];
                case 1:
                    metrics = _a.sent();
                    if (!request.includeActivities) return [3 /*break*/, 3];
                    return [4 /*yield*/, generateActivityFeed(userId, userRole)];
                case 2:
                    activities = _a.sent();
                    _a.label = 3;
                case 3:
                    if (!request.includeSessions) return [3 /*break*/, 5];
                    return [4 /*yield*/, generateActiveSessions(userId, userRole)];
                case 4:
                    sessions = _a.sent();
                    _a.label = 5;
                case 5:
                    if (!request.includeAlerts) return [3 /*break*/, 7];
                    return [4 /*yield*/, generateRealTimeAlerts(userId, userRole)];
                case 6:
                    alerts = _a.sent();
                    _a.label = 7;
                case 7: return [2 /*return*/, {
                        timestamp: timestamp,
                        metrics: metrics,
                        activities: activities,
                        sessions: sessions,
                        alerts: alerts,
                        nextRefresh: new Date(Date.now() + (refreshInterval * 1000)).toISOString(),
                        refreshInterval: refreshInterval,
                    }];
            }
        });
    });
}
function generateRealTimeMetrics(requestedMetrics, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var now, todayStart, _a, timeEntries, sessions, analyticsEvents, activeUsers, currentSessions, todayHours, todayRevenue, liveTimers, recentEntries, systemLoad, responseTime, errorRate, throughput;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    now = new Date();
                    todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    return [4 /*yield*/, Promise.all([
                            fetchTodayTimeEntries(todayStart, userId, userRole),
                            fetchActiveSessions(userId, userRole),
                            fetchRecentAnalyticsEvents(userId, userRole),
                        ])];
                case 1:
                    _a = _b.sent(), timeEntries = _a[0], sessions = _a[1], analyticsEvents = _a[2];
                    return [4 /*yield*/, calculateActiveUsers(sessions)];
                case 2:
                    activeUsers = _b.sent();
                    currentSessions = sessions.length;
                    todayHours = timeEntries.reduce(function (sum, entry) { return sum + (entry.hours || 0); }, 0);
                    todayRevenue = timeEntries
                        .filter(function (entry) { return entry.billable; })
                        .reduce(function (sum, entry) { return sum + ((entry.hours || 0) * (entry.hourlyRate || 0)); }, 0);
                    return [4 /*yield*/, calculateLiveTimers(userId, userRole)];
                case 3:
                    liveTimers = _b.sent();
                    recentEntries = timeEntries.filter(function (entry) {
                        var entryTime = new Date(entry.createdAt || entry.startDate);
                        return (now.getTime() - entryTime.getTime()) < (60 * 60 * 1000); // Last hour
                    }).length;
                    return [4 /*yield*/, calculateSystemLoad()];
                case 4:
                    systemLoad = _b.sent();
                    return [4 /*yield*/, calculateAverageResponseTime()];
                case 5:
                    responseTime = _b.sent();
                    return [4 /*yield*/, calculateErrorRate()];
                case 6:
                    errorRate = _b.sent();
                    return [4 /*yield*/, calculateThroughput()];
                case 7:
                    throughput = _b.sent();
                    return [2 /*return*/, {
                            activeUsers: activeUsers,
                            currentSessions: currentSessions,
                            todayHours: Math.round(todayHours * 10) / 10,
                            todayRevenue: Math.round(todayRevenue),
                            liveTimers: liveTimers,
                            recentEntries: recentEntries,
                            systemLoad: systemLoad,
                            responseTime: responseTime,
                            errorRate: errorRate,
                            throughput: throughput,
                        }];
            }
        });
    });
}
function generateActivityFeed(userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var analyticsTable, oneHourAgo, queryParams, command, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    analyticsTable = process.env.ANALYTICS_EVENTS_TABLE_NAME;
                    if (!analyticsTable)
                        return [2 /*return*/, []];
                    oneHourAgo = new Date(Date.now() - (60 * 60 * 1000)).toISOString();
                    queryParams = {
                        TableName: analyticsTable,
                        IndexName: 'EventTypeTimestampIndex',
                        KeyConditionExpression: '#eventType = :eventType AND #timestamp > :timestamp',
                        ExpressionAttributeNames: {
                            '#eventType': 'eventType',
                            '#timestamp': 'timestamp',
                        },
                        ExpressionAttributeValues: {
                            ':eventType': 'activity',
                            ':timestamp': oneHourAgo,
                        },
                        ScanIndexForward: false, // Most recent first
                        Limit: 50,
                    };
                    // Apply role-based filtering
                    if (userRole === 'employee') {
                        queryParams.FilterExpression = '#userId = :userId';
                        queryParams.ExpressionAttributeNames['#userId'] = 'userId';
                        queryParams.ExpressionAttributeValues[':userId'] = userId;
                    }
                    command = new lib_dynamodb_1.QueryCommand(queryParams);
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, (result.Items || []).map(function (item) {
                            var _a, _b, _c, _d, _e;
                            return ({
                                id: item.eventId,
                                userId: item.userId,
                                userName: ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.userName) || 'Unknown User',
                                action: ((_b = item.metadata) === null || _b === void 0 ? void 0 : _b.action) || 'Unknown Action',
                                timestamp: item.timestamp,
                                details: ((_c = item.metadata) === null || _c === void 0 ? void 0 : _c.details) || {},
                                type: ((_d = item.metadata) === null || _d === void 0 ? void 0 : _d.type) || 'system',
                                priority: ((_e = item.metadata) === null || _e === void 0 ? void 0 : _e.priority) || 'low',
                            });
                        })];
                case 2:
                    error_2 = _a.sent();
                    console.error('Error generating activity feed:', error_2);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function generateActiveSessions(userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var sessionsTable, fifteenMinutesAgo, scanParams, command, result, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    sessionsTable = process.env.USER_SESSIONS_TABLE_NAME;
                    if (!sessionsTable)
                        return [2 /*return*/, []];
                    fifteenMinutesAgo = new Date(Date.now() - (15 * 60 * 1000)).toISOString();
                    scanParams = {
                        TableName: sessionsTable,
                        FilterExpression: '#lastActivity > :lastActivity AND #status = :status',
                        ExpressionAttributeNames: {
                            '#lastActivity': 'lastActivity',
                            '#status': 'status',
                        },
                        ExpressionAttributeValues: {
                            ':lastActivity': fifteenMinutesAgo,
                            ':status': 'active',
                        },
                    };
                    // Apply role-based filtering
                    if (userRole === 'employee') {
                        scanParams.FilterExpression += ' AND #userId = :userId';
                        scanParams.ExpressionAttributeNames['#userId'] = 'userId';
                        scanParams.ExpressionAttributeValues[':userId'] = userId;
                    }
                    command = new lib_dynamodb_1.ScanCommand(scanParams);
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, (result.Items || []).map(function (session) {
                            var _a, _b, _c, _d;
                            return ({
                                sessionId: session.sessionId,
                                userId: session.userId,
                                userName: ((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.userName) || 'Unknown User',
                                startTime: session.startTime,
                                lastActivity: session.lastActivity,
                                ipAddress: session.ipAddress || 'Unknown',
                                userAgent: session.userAgent || 'Unknown',
                                location: (_b = session.metadata) === null || _b === void 0 ? void 0 : _b.location,
                                activeTimers: ((_c = session.metadata) === null || _c === void 0 ? void 0 : _c.activeTimers) || 0,
                                todayHours: ((_d = session.metadata) === null || _d === void 0 ? void 0 : _d.todayHours) || 0,
                                status: determineSessionStatus(session.lastActivity),
                            });
                        })];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error generating active sessions:', error_3);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function generateRealTimeAlerts(userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var alerts, now, responseTime, errorRate, liveTimers, recentSessions, uniqueIPs, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    alerts = [];
                    now = new Date();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    return [4 /*yield*/, calculateAverageResponseTime()];
                case 2:
                    responseTime = _a.sent();
                    if (responseTime > 2000) { // 2 seconds
                        alerts.push({
                            id: "alert-".concat(now.getTime(), "-performance"),
                            type: 'performance',
                            severity: responseTime > 5000 ? 'critical' : 'warning',
                            title: 'High Response Time',
                            message: "Average response time is ".concat(responseTime, "ms"),
                            timestamp: now.toISOString(),
                            acknowledged: false,
                            autoResolve: true,
                            metadata: { responseTime: responseTime },
                        });
                    }
                    return [4 /*yield*/, calculateErrorRate()];
                case 3:
                    errorRate = _a.sent();
                    if (errorRate > 5) { // 5%
                        alerts.push({
                            id: "alert-".concat(now.getTime(), "-errors"),
                            type: 'system',
                            severity: errorRate > 10 ? 'critical' : 'warning',
                            title: 'High Error Rate',
                            message: "Error rate is ".concat(errorRate, "%"),
                            timestamp: now.toISOString(),
                            acknowledged: false,
                            autoResolve: true,
                            metadata: { errorRate: errorRate },
                        });
                    }
                    return [4 /*yield*/, calculateLiveTimers(userId, userRole)];
                case 4:
                    liveTimers = _a.sent();
                    if (liveTimers > 50) { // Many active timers
                        alerts.push({
                            id: "alert-".concat(now.getTime(), "-timers"),
                            type: 'business',
                            severity: 'info',
                            title: 'High Timer Activity',
                            message: "".concat(liveTimers, " active timers running"),
                            timestamp: now.toISOString(),
                            acknowledged: false,
                            autoResolve: true,
                            metadata: { liveTimers: liveTimers },
                        });
                    }
                    return [4 /*yield*/, fetchActiveSessions(userId, userRole)];
                case 5:
                    recentSessions = _a.sent();
                    uniqueIPs = new Set(recentSessions.map(function (s) { return s.ipAddress; })).size;
                    if (uniqueIPs > 20) { // Many different IPs
                        alerts.push({
                            id: "alert-".concat(now.getTime(), "-security"),
                            type: 'security',
                            severity: 'warning',
                            title: 'Unusual Access Pattern',
                            message: "".concat(uniqueIPs, " unique IP addresses active"),
                            timestamp: now.toISOString(),
                            acknowledged: false,
                            autoResolve: false,
                            metadata: { uniqueIPs: uniqueIPs },
                        });
                    }
                    return [3 /*break*/, 7];
                case 6:
                    error_4 = _a.sent();
                    console.error('Error generating real-time alerts:', error_4);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/, alerts];
            }
        });
    });
}
// Helper functions
function fetchTodayTimeEntries(todayStart, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var timeEntriesTable, scanParams, command, result, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    timeEntriesTable = process.env.TIME_ENTRIES_TABLE_NAME;
                    if (!timeEntriesTable)
                        return [2 /*return*/, []];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    scanParams = {
                        TableName: timeEntriesTable,
                        FilterExpression: '#startDate >= :todayStart',
                        ExpressionAttributeNames: {
                            '#startDate': 'startDate',
                        },
                        ExpressionAttributeValues: {
                            ':todayStart': todayStart.toISOString(),
                        },
                    };
                    // Apply role-based filtering
                    if (userRole === 'employee') {
                        scanParams.FilterExpression += ' AND #userId = :userId';
                        scanParams.ExpressionAttributeNames['#userId'] = 'userId';
                        scanParams.ExpressionAttributeValues[':userId'] = userId;
                    }
                    command = new lib_dynamodb_1.ScanCommand(scanParams);
                    return [4 /*yield*/, docClient.send(command)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.Items || []];
                case 3:
                    error_5 = _a.sent();
                    console.error('Error fetching today time entries:', error_5);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function fetchActiveSessions(userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var sessionsTable, fifteenMinutesAgo, scanParams, command, result, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sessionsTable = process.env.USER_SESSIONS_TABLE_NAME;
                    if (!sessionsTable)
                        return [2 /*return*/, []];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    fifteenMinutesAgo = new Date(Date.now() - (15 * 60 * 1000)).toISOString();
                    scanParams = {
                        TableName: sessionsTable,
                        FilterExpression: '#lastActivity > :lastActivity',
                        ExpressionAttributeNames: {
                            '#lastActivity': 'lastActivity',
                        },
                        ExpressionAttributeValues: {
                            ':lastActivity': fifteenMinutesAgo,
                        },
                    };
                    // Apply role-based filtering
                    if (userRole === 'employee') {
                        scanParams.FilterExpression += ' AND #userId = :userId';
                        scanParams.ExpressionAttributeNames['#userId'] = 'userId';
                        scanParams.ExpressionAttributeValues[':userId'] = userId;
                    }
                    command = new lib_dynamodb_1.ScanCommand(scanParams);
                    return [4 /*yield*/, docClient.send(command)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.Items || []];
                case 3:
                    error_6 = _a.sent();
                    console.error('Error fetching active sessions:', error_6);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function fetchRecentAnalyticsEvents(userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var analyticsTable, oneHourAgo, scanParams, command, result, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    analyticsTable = process.env.ANALYTICS_EVENTS_TABLE_NAME;
                    if (!analyticsTable)
                        return [2 /*return*/, []];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    oneHourAgo = new Date(Date.now() - (60 * 60 * 1000)).toISOString();
                    scanParams = {
                        TableName: analyticsTable,
                        FilterExpression: '#timestamp > :timestamp',
                        ExpressionAttributeNames: {
                            '#timestamp': 'timestamp',
                        },
                        ExpressionAttributeValues: {
                            ':timestamp': oneHourAgo,
                        },
                    };
                    // Apply role-based filtering
                    if (userRole === 'employee') {
                        scanParams.FilterExpression += ' AND #userId = :userId';
                        scanParams.ExpressionAttributeNames['#userId'] = 'userId';
                        scanParams.ExpressionAttributeValues[':userId'] = userId;
                    }
                    command = new lib_dynamodb_1.ScanCommand(scanParams);
                    return [4 /*yield*/, docClient.send(command)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.Items || []];
                case 3:
                    error_7 = _a.sent();
                    console.error('Error fetching recent analytics events:', error_7);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function calculateActiveUsers(sessions) {
    return __awaiter(this, void 0, void 0, function () {
        var uniqueUsers;
        return __generator(this, function (_a) {
            uniqueUsers = new Set(sessions.map(function (session) { return session.userId; }));
            return [2 /*return*/, uniqueUsers.size];
        });
    });
}
function calculateLiveTimers(userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // Mock implementation - in production, query active timers from time entries
            // where status = 'running' or similar
            return [2 /*return*/, Math.floor(Math.random() * 25) + 5]; // 5-30 active timers
        });
    });
}
function calculateSystemLoad() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // Mock system load - in production, this would come from CloudWatch metrics
            return [2 /*return*/, Math.round((Math.random() * 50 + 25) * 10) / 10]; // 25-75%
        });
    });
}
function calculateAverageResponseTime() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // Mock response time - in production, this would come from CloudWatch metrics
            return [2 /*return*/, Math.round(Math.random() * 1000 + 200)]; // 200-1200ms
        });
    });
}
function calculateErrorRate() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // Mock error rate - in production, this would come from CloudWatch metrics
            return [2 /*return*/, Math.round((Math.random() * 5) * 10) / 10]; // 0-5%
        });
    });
}
function calculateThroughput() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // Mock throughput - in production, this would come from CloudWatch metrics
            return [2 /*return*/, Math.round(Math.random() * 100 + 50)]; // 50-150 requests/minute
        });
    });
}
function determineSessionStatus(lastActivity) {
    var lastActivityTime = new Date(lastActivity).getTime();
    var now = Date.now();
    var minutesSinceActivity = (now - lastActivityTime) / (1000 * 60);
    if (minutesSinceActivity < 5)
        return 'active';
    if (minutesSinceActivity < 15)
        return 'idle';
    return 'away';
}
// Track real-time activity
function trackRealTimeActivity(userId_1, action_1, details_1) {
    return __awaiter(this, arguments, void 0, function (userId, action, details, type, priority) {
        var analyticsTable, event_1, command, error_8;
        if (type === void 0) { type = 'system'; }
        if (priority === void 0) { priority = 'low'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    analyticsTable = process.env.ANALYTICS_EVENTS_TABLE_NAME;
                    if (!analyticsTable)
                        return [2 /*return*/];
                    event_1 = {
                        eventId: "activity-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9)),
                        userId: userId,
                        eventType: 'activity',
                        timestamp: new Date().toISOString(),
                        metadata: {
                            action: action,
                            details: details,
                            type: type,
                            priority: priority,
                            realTime: true,
                        },
                    };
                    command = new lib_dynamodb_1.PutCommand({
                        TableName: analyticsTable,
                        Item: event_1,
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_8 = _a.sent();
                    console.error('Error tracking real-time activity:', error_8);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
