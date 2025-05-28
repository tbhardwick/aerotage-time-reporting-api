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
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, userRole, monitorRequest, queryParams, performanceData, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log('Performance monitor request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                userRole = (user === null || user === void 0 ? void 0 : user.role) || 'employee';
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                // Only admins and managers can access performance monitoring
                if (userRole === 'employee') {
                    return [2 /*return*/, {
                            statusCode: 403,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'ACCESS_DENIED',
                                    message: 'Performance monitoring requires admin or manager role',
                                },
                            }),
                        }];
                }
                monitorRequest = void 0;
                if (event.body) {
                    try {
                        monitorRequest = JSON.parse(event.body);
                    }
                    catch (error) {
                        return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_JSON', 'Invalid JSON in request body')];
                    }
                }
                else {
                    // Default configuration
                    monitorRequest = {
                        timeframe: 'day',
                        metrics: ['system', 'api', 'database', 'user'],
                        includeRecommendations: true,
                        includeAlerts: true,
                        includeComparisons: true,
                    };
                }
                queryParams = event.queryStringParameters || {};
                if (queryParams.timeframe) {
                    monitorRequest.timeframe = queryParams.timeframe;
                }
                return [4 /*yield*/, generatePerformanceMonitoring(monitorRequest, userId, userRole)];
            case 1:
                performanceData = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Cache-Control': 'max-age=300', // 5 minute cache
                        },
                        body: JSON.stringify({
                            success: true,
                            data: performanceData,
                        }),
                    }];
            case 2:
                error_1 = _a.sent();
                console.error('Error generating performance monitoring:', error_1);
                return [2 /*return*/, {
                        statusCode: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify({
                            success: false,
                            error: {
                                code: 'PERFORMANCE_MONITORING_FAILED',
                                message: 'Failed to generate performance monitoring data',
                            },
                        }),
                    }];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function generatePerformanceMonitoring(request, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var timestamp, timeRange, _a, systemPerformance, apiPerformance, databasePerformance, userExperience, recommendations, alerts, comparisons, summary;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    timestamp = new Date().toISOString();
                    timeRange = calculateTimeRange(request.timeframe);
                    return [4 /*yield*/, Promise.all([
                            generateSystemPerformance(timeRange),
                            generateApiPerformance(timeRange),
                            generateDatabasePerformance(timeRange),
                            generateUserExperience(timeRange),
                        ])];
                case 1:
                    _a = _b.sent(), systemPerformance = _a[0], apiPerformance = _a[1], databasePerformance = _a[2], userExperience = _a[3];
                    if (request.includeRecommendations) {
                        recommendations = generatePerformanceRecommendations(systemPerformance, apiPerformance, databasePerformance);
                    }
                    if (request.includeAlerts) {
                        alerts = generatePerformanceAlerts(systemPerformance, apiPerformance, databasePerformance);
                    }
                    if (!request.includeComparisons) return [3 /*break*/, 3];
                    return [4 /*yield*/, generatePerformanceComparisons(timeRange)];
                case 2:
                    comparisons = _b.sent();
                    _b.label = 3;
                case 3:
                    summary = generatePerformanceSummary(systemPerformance, apiPerformance, databasePerformance, userExperience);
                    return [2 /*return*/, {
                            timestamp: timestamp,
                            timeframe: request.timeframe,
                            systemPerformance: systemPerformance,
                            apiPerformance: apiPerformance,
                            databasePerformance: databasePerformance,
                            userExperience: userExperience,
                            recommendations: recommendations,
                            alerts: alerts,
                            comparisons: comparisons,
                            summary: summary,
                        }];
            }
        });
    });
}
function calculateTimeRange(timeframe) {
    var endTime = new Date();
    var startTime;
    var periodMinutes;
    switch (timeframe) {
        case 'hour':
            startTime = new Date(endTime.getTime() - (60 * 60 * 1000));
            periodMinutes = 5; // 5-minute intervals
            break;
        case 'day':
            startTime = new Date(endTime.getTime() - (24 * 60 * 60 * 1000));
            periodMinutes = 60; // 1-hour intervals
            break;
        case 'week':
            startTime = new Date(endTime.getTime() - (7 * 24 * 60 * 60 * 1000));
            periodMinutes = 360; // 6-hour intervals
            break;
        case 'month':
            startTime = new Date(endTime.getTime() - (30 * 24 * 60 * 60 * 1000));
            periodMinutes = 1440; // 1-day intervals
            break;
        default:
            startTime = new Date(endTime.getTime() - (24 * 60 * 60 * 1000));
            periodMinutes = 60;
    }
    return { startTime: startTime, endTime: endTime, periodMinutes: periodMinutes };
}
function generateSystemPerformance(timeRange) {
    return __awaiter(this, void 0, void 0, function () {
        var generateMetricData;
        return __generator(this, function (_a) {
            generateMetricData = function (baseValue, unit) {
                var dataPoints = Array.from({ length: 24 }, function () {
                    return baseValue + (Math.random() - 0.5) * baseValue * 0.3;
                });
                var current = dataPoints[dataPoints.length - 1];
                var average = dataPoints.reduce(function (sum, val) { return sum + val; }, 0) / dataPoints.length;
                var min = Math.min.apply(Math, dataPoints);
                var max = Math.max.apply(Math, dataPoints);
                var previousAverage = average * (0.9 + Math.random() * 0.2);
                var changePercent = ((average - previousAverage) / previousAverage) * 100;
                return {
                    current: Math.round(current * 100) / 100,
                    average: Math.round(average * 100) / 100,
                    min: Math.round(min * 100) / 100,
                    max: Math.round(max * 100) / 100,
                    trend: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable',
                    changePercent: Math.round(changePercent),
                    unit: unit,
                    dataPoints: dataPoints.map(function (val) { return Math.round(val * 100) / 100; }),
                    timestamps: dataPoints.map(function (_, i) {
                        return new Date(timeRange.startTime.getTime() + (i * 60 * 60 * 1000)).toISOString();
                    }),
                };
            };
            return [2 /*return*/, {
                    cpuUtilization: generateMetricData(45, '%'),
                    memoryUtilization: generateMetricData(60, '%'),
                    diskUtilization: generateMetricData(35, '%'),
                    networkThroughput: generateMetricData(150, 'MB/s'),
                    lambdaConcurrency: generateMetricData(25, 'concurrent'),
                    lambdaDuration: generateMetricData(850, 'ms'),
                    lambdaErrors: generateMetricData(2.5, '%'),
                    lambdaThrottles: generateMetricData(0.5, '%'),
                }];
        });
    });
}
function generateApiPerformance(timeRange) {
    return __awaiter(this, void 0, void 0, function () {
        var generateMetricData, endpointPerformance, slowestEndpoints, errorProneEndpoints;
        return __generator(this, function (_a) {
            generateMetricData = function (baseValue, unit) {
                var dataPoints = Array.from({ length: 24 }, function () {
                    return baseValue + (Math.random() - 0.5) * baseValue * 0.2;
                });
                var current = dataPoints[dataPoints.length - 1];
                var average = dataPoints.reduce(function (sum, val) { return sum + val; }, 0) / dataPoints.length;
                var min = Math.min.apply(Math, dataPoints);
                var max = Math.max.apply(Math, dataPoints);
                var previousAverage = average * (0.95 + Math.random() * 0.1);
                var changePercent = ((average - previousAverage) / previousAverage) * 100;
                return {
                    current: Math.round(current * 100) / 100,
                    average: Math.round(average * 100) / 100,
                    min: Math.round(min * 100) / 100,
                    max: Math.round(max * 100) / 100,
                    trend: changePercent > 3 ? 'up' : changePercent < -3 ? 'down' : 'stable',
                    changePercent: Math.round(changePercent),
                    unit: unit,
                    dataPoints: dataPoints.map(function (val) { return Math.round(val * 100) / 100; }),
                    timestamps: dataPoints.map(function (_, i) {
                        return new Date(timeRange.startTime.getTime() + (i * 60 * 60 * 1000)).toISOString();
                    }),
                };
            };
            endpointPerformance = [
                {
                    endpoint: '/reports/time',
                    method: 'GET',
                    responseTime: 245,
                    throughput: 150,
                    errorRate: 1.2,
                    successRate: 98.8,
                    p95ResponseTime: 380,
                    p99ResponseTime: 650,
                },
                {
                    endpoint: '/analytics/dashboard',
                    method: 'GET',
                    responseTime: 180,
                    throughput: 200,
                    errorRate: 0.8,
                    successRate: 99.2,
                    p95ResponseTime: 290,
                    p99ResponseTime: 450,
                },
                {
                    endpoint: '/time-entries',
                    method: 'POST',
                    responseTime: 120,
                    throughput: 300,
                    errorRate: 2.1,
                    successRate: 97.9,
                    p95ResponseTime: 200,
                    p99ResponseTime: 350,
                },
            ];
            slowestEndpoints = [
                { endpoint: '/reports/export', method: 'POST', value: 3200, unit: 'ms', impact: 'high' },
                { endpoint: '/reports/project', method: 'GET', value: 890, unit: 'ms', impact: 'medium' },
                { endpoint: '/analytics/advanced', method: 'POST', value: 650, unit: 'ms', impact: 'medium' },
            ];
            errorProneEndpoints = [
                { endpoint: '/reports/export', method: 'POST', value: 5.2, unit: '%', impact: 'high' },
                { endpoint: '/time-entries', method: 'POST', value: 2.1, unit: '%', impact: 'medium' },
                { endpoint: '/projects', method: 'PUT', value: 1.8, unit: '%', impact: 'low' },
            ];
            return [2 /*return*/, {
                    responseTime: generateMetricData(220, 'ms'),
                    throughput: generateMetricData(180, 'req/min'),
                    errorRate: generateMetricData(1.5, '%'),
                    successRate: generateMetricData(98.5, '%'),
                    endpointPerformance: endpointPerformance,
                    slowestEndpoints: slowestEndpoints,
                    errorProneEndpoints: errorProneEndpoints,
                }];
        });
    });
}
function generateDatabasePerformance(timeRange) {
    return __awaiter(this, void 0, void 0, function () {
        var generateMetricData, tablePerformance, slowestQueries;
        return __generator(this, function (_a) {
            generateMetricData = function (baseValue, unit) {
                var dataPoints = Array.from({ length: 24 }, function () {
                    return baseValue + (Math.random() - 0.5) * baseValue * 0.25;
                });
                var current = dataPoints[dataPoints.length - 1];
                var average = dataPoints.reduce(function (sum, val) { return sum + val; }, 0) / dataPoints.length;
                var min = Math.min.apply(Math, dataPoints);
                var max = Math.max.apply(Math, dataPoints);
                var previousAverage = average * (0.92 + Math.random() * 0.16);
                var changePercent = ((average - previousAverage) / previousAverage) * 100;
                return {
                    current: Math.round(current * 100) / 100,
                    average: Math.round(average * 100) / 100,
                    min: Math.round(min * 100) / 100,
                    max: Math.round(max * 100) / 100,
                    trend: changePercent > 4 ? 'up' : changePercent < -4 ? 'down' : 'stable',
                    changePercent: Math.round(changePercent),
                    unit: unit,
                    dataPoints: dataPoints.map(function (val) { return Math.round(val * 100) / 100; }),
                    timestamps: dataPoints.map(function (_, i) {
                        return new Date(timeRange.startTime.getTime() + (i * 60 * 60 * 1000)).toISOString();
                    }),
                };
            };
            tablePerformance = [
                {
                    tableName: 'aerotage-time-entries-dev',
                    readLatency: 12.5,
                    writeLatency: 18.2,
                    readThroughput: 45.8,
                    writeThroughput: 23.1,
                    throttledRequests: 0,
                    consumedCapacity: 67.3,
                },
                {
                    tableName: 'aerotage-projects-dev',
                    readLatency: 8.9,
                    writeLatency: 15.6,
                    readThroughput: 32.4,
                    writeThroughput: 12.7,
                    throttledRequests: 0,
                    consumedCapacity: 34.2,
                },
                {
                    tableName: 'aerotage-report-cache-dev',
                    readLatency: 6.2,
                    writeLatency: 11.8,
                    readThroughput: 89.5,
                    writeThroughput: 45.3,
                    throttledRequests: 0,
                    consumedCapacity: 78.9,
                },
            ];
            slowestQueries = [
                {
                    query: 'Scan on time-entries with complex filter',
                    table: 'aerotage-time-entries-dev',
                    duration: 450,
                    frequency: 12,
                    impact: 'high',
                },
                {
                    query: 'Query on UserProjectIndex',
                    table: 'aerotage-projects-dev',
                    duration: 180,
                    frequency: 35,
                    impact: 'medium',
                },
                {
                    query: 'Batch write to analytics-events',
                    table: 'aerotage-analytics-events-dev',
                    duration: 120,
                    frequency: 67,
                    impact: 'low',
                },
            ];
            return [2 /*return*/, {
                    readLatency: generateMetricData(9.2, 'ms'),
                    writeLatency: generateMetricData(15.1, 'ms'),
                    readThroughput: generateMetricData(55.7, 'RCU'),
                    writeThroughput: generateMetricData(27.1, 'WCU'),
                    throttledRequests: generateMetricData(0.1, 'count'),
                    consumedCapacity: generateMetricData(60.2, '%'),
                    tablePerformance: tablePerformance,
                    slowestQueries: slowestQueries,
                }];
        });
    });
}
function generateUserExperience(timeRange) {
    return __awaiter(this, void 0, void 0, function () {
        var generateMetricData;
        return __generator(this, function (_a) {
            generateMetricData = function (baseValue, unit) {
                var dataPoints = Array.from({ length: 24 }, function () {
                    return baseValue + (Math.random() - 0.5) * baseValue * 0.15;
                });
                var current = dataPoints[dataPoints.length - 1];
                var average = dataPoints.reduce(function (sum, val) { return sum + val; }, 0) / dataPoints.length;
                var min = Math.min.apply(Math, dataPoints);
                var max = Math.max.apply(Math, dataPoints);
                var previousAverage = average * (0.95 + Math.random() * 0.1);
                var changePercent = ((average - previousAverage) / previousAverage) * 100;
                return {
                    current: Math.round(current * 100) / 100,
                    average: Math.round(average * 100) / 100,
                    min: Math.round(min * 100) / 100,
                    max: Math.round(max * 100) / 100,
                    trend: changePercent > 2 ? 'up' : changePercent < -2 ? 'down' : 'stable',
                    changePercent: Math.round(changePercent),
                    unit: unit,
                    dataPoints: dataPoints.map(function (val) { return Math.round(val * 100) / 100; }),
                    timestamps: dataPoints.map(function (_, i) {
                        return new Date(timeRange.startTime.getTime() + (i * 60 * 60 * 1000)).toISOString();
                    }),
                };
            };
            return [2 /*return*/, {
                    averageSessionDuration: generateMetricData(28.5, 'minutes'),
                    bounceRate: generateMetricData(12.3, '%'),
                    pageLoadTime: generateMetricData(1.8, 'seconds'),
                    userSatisfactionScore: generateMetricData(4.2, '/5'),
                    activeUsers: generateMetricData(45, 'users'),
                    sessionCount: generateMetricData(156, 'sessions'),
                }];
        });
    });
}
function generatePerformanceRecommendations(systemPerf, apiPerf, dbPerf) {
    var recommendations = [];
    // API Performance recommendations
    if (apiPerf.responseTime.average > 500) {
        recommendations.push({
            id: 'api-response-time',
            type: 'optimization',
            priority: 'high',
            title: 'Optimize API Response Times',
            description: 'Average API response time is above 500ms, impacting user experience',
            impact: 'Reduce response time by 30-40%',
            effort: 'medium',
            estimatedImprovement: '200-300ms faster responses',
            implementation: [
                'Implement response caching for frequently accessed endpoints',
                'Optimize database queries and add proper indexing',
                'Consider implementing pagination for large datasets',
                'Add compression for large response payloads',
            ],
            metrics: ['responseTime', 'userSatisfaction'],
        });
    }
    // Database Performance recommendations
    if (dbPerf.readLatency.average > 20) {
        recommendations.push({
            id: 'db-read-optimization',
            type: 'optimization',
            priority: 'medium',
            title: 'Optimize Database Read Performance',
            description: 'Database read latency is higher than optimal',
            impact: 'Improve read performance by 25-35%',
            effort: 'medium',
            estimatedImprovement: '5-10ms faster reads',
            implementation: [
                'Review and optimize Global Secondary Indexes',
                'Implement read replicas for read-heavy workloads',
                'Use DynamoDB Accelerator (DAX) for caching',
                'Optimize query patterns and avoid scans',
            ],
            metrics: ['readLatency', 'responseTime'],
        });
    }
    // System Performance recommendations
    if (systemPerf.lambdaDuration.average > 1000) {
        recommendations.push({
            id: 'lambda-optimization',
            type: 'optimization',
            priority: 'high',
            title: 'Optimize Lambda Function Performance',
            description: 'Lambda functions are taking longer than optimal to execute',
            impact: 'Reduce execution time by 20-30%',
            effort: 'low',
            estimatedImprovement: '200-300ms faster execution',
            implementation: [
                'Increase Lambda memory allocation for CPU-intensive functions',
                'Optimize cold start performance with provisioned concurrency',
                'Minimize package size and dependencies',
                'Use connection pooling for database connections',
            ],
            metrics: ['lambdaDuration', 'responseTime'],
        });
    }
    // Scaling recommendations
    if (systemPerf.lambdaConcurrency.average > 80) {
        recommendations.push({
            id: 'scaling-optimization',
            type: 'scaling',
            priority: 'medium',
            title: 'Implement Auto-Scaling Strategies',
            description: 'High concurrency levels indicate need for better scaling',
            impact: 'Improve system reliability and performance under load',
            effort: 'high',
            estimatedImprovement: 'Better handling of traffic spikes',
            implementation: [
                'Configure auto-scaling for DynamoDB tables',
                'Implement SQS for asynchronous processing',
                'Use CloudFront for static content caching',
                'Consider implementing circuit breakers',
            ],
            metrics: ['concurrency', 'throughput', 'errorRate'],
        });
    }
    return recommendations;
}
function generatePerformanceAlerts(systemPerf, apiPerf, dbPerf) {
    var alerts = [];
    var now = new Date();
    // High response time alert
    if (apiPerf.responseTime.current > 1000) {
        alerts.push({
            id: "alert-".concat(now.getTime(), "-response-time"),
            type: 'latency',
            severity: apiPerf.responseTime.current > 2000 ? 'critical' : 'warning',
            title: 'High API Response Time',
            message: "Current response time is ".concat(apiPerf.responseTime.current, "ms"),
            metric: 'responseTime',
            currentValue: apiPerf.responseTime.current,
            threshold: 1000,
            timestamp: now.toISOString(),
            duration: 15, // minutes
            affectedComponents: ['API Gateway', 'Lambda Functions'],
        });
    }
    // High error rate alert
    if (apiPerf.errorRate.current > 5) {
        alerts.push({
            id: "alert-".concat(now.getTime(), "-error-rate"),
            type: 'error',
            severity: apiPerf.errorRate.current > 10 ? 'critical' : 'warning',
            title: 'High API Error Rate',
            message: "Current error rate is ".concat(apiPerf.errorRate.current, "%"),
            metric: 'errorRate',
            currentValue: apiPerf.errorRate.current,
            threshold: 5,
            timestamp: now.toISOString(),
            duration: 10,
            affectedComponents: ['API Endpoints', 'Lambda Functions'],
        });
    }
    // Database throttling alert
    if (dbPerf.throttledRequests.current > 0) {
        alerts.push({
            id: "alert-".concat(now.getTime(), "-db-throttling"),
            type: 'capacity',
            severity: 'critical',
            title: 'Database Throttling Detected',
            message: "".concat(dbPerf.throttledRequests.current, " throttled requests detected"),
            metric: 'throttledRequests',
            currentValue: dbPerf.throttledRequests.current,
            threshold: 0,
            timestamp: now.toISOString(),
            duration: 5,
            affectedComponents: ['DynamoDB Tables'],
        });
    }
    // High Lambda duration alert
    if (systemPerf.lambdaDuration.current > 5000) {
        alerts.push({
            id: "alert-".concat(now.getTime(), "-lambda-duration"),
            type: 'performance',
            severity: 'warning',
            title: 'High Lambda Execution Time',
            message: "Lambda execution time is ".concat(systemPerf.lambdaDuration.current, "ms"),
            metric: 'lambdaDuration',
            currentValue: systemPerf.lambdaDuration.current,
            threshold: 5000,
            timestamp: now.toISOString(),
            duration: 8,
            affectedComponents: ['Lambda Functions'],
        });
    }
    return alerts;
}
function generatePerformanceComparisons(timeRange) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // Mock comparison data - in production, fetch historical data
            return [2 /*return*/, {
                    previousPeriod: {
                        responseTime: 280,
                        throughput: 165,
                        errorRate: 2.1,
                        userSatisfaction: 4.0,
                    },
                    improvement: {
                        responseTime: -12.5, // 12.5% improvement (negative is better)
                        throughput: 9.1, // 9.1% improvement
                        errorRate: -28.6, // 28.6% improvement (negative is better)
                        userSatisfaction: 5.0, // 5% improvement
                    },
                    benchmarks: {
                        industryAverage: 350,
                        bestPractice: 200,
                        currentPerformance: 245,
                    },
                }];
        });
    });
}
function generatePerformanceSummary(systemPerf, apiPerf, dbPerf, userExp) {
    // Calculate overall performance score
    var responseTimeScore = Math.max(0, 100 - (apiPerf.responseTime.average / 10));
    var errorRateScore = Math.max(0, 100 - (apiPerf.errorRate.average * 10));
    var throughputScore = Math.min(100, apiPerf.throughput.average / 2);
    var userSatisfactionScore = (userExp.userSatisfactionScore.average / 5) * 100;
    var overallScore = Math.round((responseTimeScore + errorRateScore + throughputScore + userSatisfactionScore) / 4);
    var performanceGrade = overallScore >= 90 ? 'A' :
        overallScore >= 80 ? 'B' :
            overallScore >= 70 ? 'C' :
                overallScore >= 60 ? 'D' : 'F';
    var topIssues = [];
    if (apiPerf.responseTime.average > 500)
        topIssues.push('High API response times');
    if (apiPerf.errorRate.average > 3)
        topIssues.push('Elevated error rates');
    if (dbPerf.readLatency.average > 20)
        topIssues.push('Database read latency');
    if (systemPerf.lambdaDuration.average > 1000)
        topIssues.push('Lambda execution time');
    var improvements = [];
    if (apiPerf.responseTime.trend === 'down')
        improvements.push('Response times improving');
    if (apiPerf.errorRate.trend === 'down')
        improvements.push('Error rates decreasing');
    if (userExp.userSatisfactionScore.trend === 'up')
        improvements.push('User satisfaction increasing');
    var nextActions = [
        'Implement caching for frequently accessed data',
        'Optimize database query patterns',
        'Monitor and tune Lambda memory allocation',
        'Set up automated performance alerts',
    ];
    return {
        overallScore: overallScore,
        performanceGrade: performanceGrade,
        keyMetrics: {
            responseTime: Math.round(apiPerf.responseTime.average),
            throughput: Math.round(apiPerf.throughput.average),
            errorRate: Math.round(apiPerf.errorRate.average * 10) / 10,
            availability: 99.9, // Mock availability
        },
        topIssues: topIssues,
        improvements: improvements,
        nextActions: nextActions,
    };
}
