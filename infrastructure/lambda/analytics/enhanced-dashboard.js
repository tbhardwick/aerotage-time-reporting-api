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
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, userRole, dashboardRequest, queryParams, dashboardData, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log('Enhanced dashboard request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                userRole = (user === null || user === void 0 ? void 0 : user.role) || 'employee';
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                dashboardRequest = void 0;
                if (event.httpMethod === 'POST' && event.body) {
                    try {
                        dashboardRequest = JSON.parse(event.body);
                    }
                    catch (_b) {
                        return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_JSON', 'Invalid JSON in request body')];
                    }
                }
                else {
                    // Default dashboard configuration
                    dashboardRequest = getDefaultDashboardConfig();
                }
                queryParams = event.queryStringParameters || {};
                if (queryParams.timeframe) {
                    dashboardRequest.timeframe = queryParams.timeframe;
                }
                if (queryParams.realTime === 'true') {
                    dashboardRequest.realTime = true;
                }
                if (queryParams.forecasting === 'true') {
                    dashboardRequest.includeForecasting = true;
                }
                if (queryParams.benchmarks === 'true') {
                    dashboardRequest.includeBenchmarks = true;
                }
                return [4 /*yield*/, generateEnhancedDashboard(dashboardRequest, userId, userRole)];
            case 1:
                dashboardData = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Cache-Control': dashboardRequest.realTime ? 'no-cache' : 'max-age=300', // 5 min cache for non-real-time
                        },
                        body: JSON.stringify({
                            success: true,
                            data: dashboardData,
                        }),
                    }];
            case 2:
                error_1 = _a.sent();
                console.error('Error generating enhanced dashboard:', error_1);
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'DASHBOARD_GENERATION_FAILED', 'Failed to generate enhanced dashboard')];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function getDefaultDashboardConfig() {
    return {
        widgets: [
            {
                id: 'revenue-kpi',
                type: 'kpi',
                title: 'Total Revenue',
                size: 'medium',
                position: { x: 0, y: 0 },
                config: {
                    metric: 'revenue',
                    comparison: 'previous_period',
                },
            },
            {
                id: 'utilization-gauge',
                type: 'gauge',
                title: 'Team Utilization',
                size: 'medium',
                position: { x: 1, y: 0 },
                config: {
                    metric: 'utilization',
                    target: 80,
                    threshold: 70,
                },
            },
            {
                id: 'revenue-trend',
                type: 'chart',
                title: 'Revenue Trend',
                size: 'large',
                position: { x: 0, y: 1 },
                config: {
                    metric: 'revenue',
                    chartType: 'line',
                    groupBy: 'month',
                },
            },
            {
                id: 'project-status',
                type: 'chart',
                title: 'Project Status',
                size: 'medium',
                position: { x: 2, y: 0 },
                config: {
                    metric: 'projects',
                    chartType: 'pie',
                    groupBy: 'status',
                },
            },
            {
                id: 'productivity-heatmap',
                type: 'heatmap',
                title: 'Productivity Heatmap',
                size: 'large',
                position: { x: 1, y: 1 },
                config: {
                    metric: 'productivity',
                    groupBy: 'user_day',
                },
            },
        ],
        timeframe: 'month',
        realTime: false,
        includeForecasting: true,
        includeBenchmarks: true,
    };
}
function generateEnhancedDashboard(request, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var dashboardId, dateRange, _a, timeEntries, projects, clients, users, widgets, summary, realTimeData, forecasting, benchmarks, alerts;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    dashboardId = "dashboard-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
                    dateRange = calculateDateRange(request.timeframe, request.customRange);
                    return [4 /*yield*/, Promise.all([
                            fetchTimeEntries(dateRange, userId, userRole),
                            fetchProjects(userId, userRole),
                            fetchClients(userId, userRole),
                            fetchUsers(userId, userRole),
                        ])];
                case 1:
                    _a = _b.sent(), timeEntries = _a[0], projects = _a[1], clients = _a[2], users = _a[3];
                    return [4 /*yield*/, Promise.all(request.widgets.map(function (widget) { return generateWidget(widget, timeEntries, projects, clients, users, dateRange); }))];
                case 2:
                    widgets = _b.sent();
                    summary = generateDashboardSummary(timeEntries, projects, clients, users);
                    if (!request.realTime) return [3 /*break*/, 4];
                    return [4 /*yield*/, generateRealTimeMetrics(userId, userRole)];
                case 3:
                    realTimeData = _b.sent();
                    _b.label = 4;
                case 4:
                    if (!request.includeForecasting) return [3 /*break*/, 6];
                    return [4 /*yield*/, generateForecastingData(timeEntries, projects, dateRange)];
                case 5:
                    forecasting = _b.sent();
                    _b.label = 6;
                case 6:
                    if (request.includeBenchmarks) {
                        benchmarks = generateBenchmarkData(summary);
                    }
                    alerts = generateAlerts(summary, realTimeData, forecasting);
                    return [2 /*return*/, {
                            dashboardId: dashboardId,
                            widgets: widgets,
                            summary: summary,
                            realTimeData: realTimeData,
                            forecasting: forecasting,
                            benchmarks: benchmarks,
                            alerts: alerts,
                            lastUpdated: new Date().toISOString(),
                            nextUpdate: request.realTime ?
                                new Date(Date.now() + 30000).toISOString() : // 30 seconds for real-time
                                new Date(Date.now() + 300000).toISOString(), // 5 minutes for standard
                        }];
            }
        });
    });
}
function calculateDateRange(timeframe, customRange) {
    var now = new Date();
    var startDate;
    var endDate = new Date(now);
    if (timeframe === 'custom' && customRange) {
        startDate = new Date(customRange.startDate);
        endDate = new Date(customRange.endDate);
    }
    else {
        switch (timeframe) {
            case 'day':
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay());
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'quarter':
                var quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
    }
    return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
    };
}
function fetchTimeEntries(dateRange, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var timeEntriesTable, filterExpression, expressionAttributeNames, expressionAttributeValues, command, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    timeEntriesTable = process.env.TIME_ENTRIES_TABLE_NAME;
                    if (!timeEntriesTable)
                        return [2 /*return*/, []];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    filterExpression = '#startDate BETWEEN :startDate AND :endDate';
                    expressionAttributeNames = { '#startDate': 'startDate' };
                    expressionAttributeValues = {
                        ':startDate': dateRange.startDate,
                        ':endDate': dateRange.endDate,
                    };
                    // Apply role-based filtering
                    if (userRole === 'employee') {
                        filterExpression += ' AND #userId = :userId';
                        expressionAttributeNames['#userId'] = 'userId';
                        expressionAttributeValues[':userId'] = userId;
                    }
                    command = new lib_dynamodb_1.ScanCommand({
                        TableName: timeEntriesTable,
                        FilterExpression: filterExpression,
                        ExpressionAttributeNames: expressionAttributeNames,
                        ExpressionAttributeValues: expressionAttributeValues,
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.Items || []];
                case 3:
                    error_2 = _a.sent();
                    console.error('Error fetching time entries:', error_2);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function fetchProjects(userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var projectsTable, command, result, projects, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    projectsTable = process.env.PROJECTS_TABLE_NAME;
                    if (!projectsTable)
                        return [2 /*return*/, []];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    command = new lib_dynamodb_1.ScanCommand({
                        TableName: projectsTable,
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 2:
                    result = _a.sent();
                    projects = result.Items || [];
                    // Apply role-based filtering
                    if (userRole === 'employee') {
                        projects = projects.filter(function (project) { var _a; return ((_a = project.teamMembers) === null || _a === void 0 ? void 0 : _a.includes(userId)) || project.managerId === userId; });
                    }
                    return [2 /*return*/, projects];
                case 3:
                    error_3 = _a.sent();
                    console.error('Error fetching projects:', error_3);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function fetchClients(userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var clientsTable, command, result, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    clientsTable = process.env.CLIENTS_TABLE_NAME;
                    if (!clientsTable)
                        return [2 /*return*/, []];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    command = new lib_dynamodb_1.ScanCommand({
                        TableName: clientsTable,
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.Items || []];
                case 3:
                    error_4 = _a.sent();
                    console.error('Error fetching clients:', error_4);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function fetchUsers(userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var usersTable, command, result, users, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    usersTable = process.env.USERS_TABLE_NAME;
                    if (!usersTable)
                        return [2 /*return*/, []];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    command = new lib_dynamodb_1.ScanCommand({
                        TableName: usersTable,
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 2:
                    result = _a.sent();
                    users = result.Items || [];
                    // Apply role-based filtering
                    if (userRole === 'employee') {
                        users = users.filter(function (user) { return user.userId === userId; });
                    }
                    return [2 /*return*/, users];
                case 3:
                    error_5 = _a.sent();
                    console.error('Error fetching users:', error_5);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function generateWidget(widget, timeEntries, projects, clients, users, dateRange) {
    return __awaiter(this, void 0, void 0, function () {
        var data, metadata;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            metadata = {
                lastUpdated: new Date().toISOString(),
                dataPoints: 0,
            };
            switch (widget.type) {
                case 'kpi':
                    data = generateKPIData(widget.config.metric, timeEntries, projects, clients);
                    metadata.trend = calculateTrend(data.current, data.previous);
                    metadata.changePercent = calculateChangePercent(data.current, data.previous);
                    metadata.status = getKPIStatus(data.current, widget.config.target, widget.config.threshold);
                    break;
                case 'gauge':
                    data = generateGaugeData(widget.config.metric, timeEntries, projects, users);
                    metadata.status = getGaugeStatus(data.value, widget.config.target, widget.config.threshold);
                    break;
                case 'chart':
                    data = generateChartData(widget.config, timeEntries, projects, clients, dateRange);
                    metadata.dataPoints = ((_c = (_b = (_a = data.datasets) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.length) || 0;
                    break;
                case 'table':
                    data = generateTableData(widget.config, timeEntries, projects, clients);
                    metadata.dataPoints = ((_d = data.rows) === null || _d === void 0 ? void 0 : _d.length) || 0;
                    break;
                case 'heatmap':
                    data = generateHeatmapData(widget.config, timeEntries, users, dateRange);
                    metadata.dataPoints = ((_e = data.data) === null || _e === void 0 ? void 0 : _e.length) || 0;
                    break;
                case 'trend':
                    data = generateTrendData(widget.config, timeEntries, projects, dateRange);
                    metadata.trend = data.trend;
                    metadata.changePercent = data.changePercent;
                    break;
                default:
                    data = { message: 'Widget type not implemented' };
            }
            return [2 /*return*/, {
                    id: widget.id,
                    type: widget.type,
                    title: widget.title,
                    data: data,
                    metadata: metadata,
                }];
        });
    });
}
function generateKPIData(metric, timeEntries, projects, clients) {
    switch (metric) {
        case 'revenue':
            var totalRevenue = timeEntries
                .filter(function (entry) { return entry.billable; })
                .reduce(function (sum, entry) { return sum + (entry.hours * entry.hourlyRate); }, 0);
            return {
                current: totalRevenue,
                previous: totalRevenue * 0.85, // Mock previous period
                unit: 'currency',
                format: 'USD',
            };
        case 'hours':
            var totalHours = timeEntries.reduce(function (sum, entry) { return sum + entry.hours; }, 0);
            return {
                current: totalHours,
                previous: totalHours * 0.92,
                unit: 'hours',
                format: 'decimal',
            };
        case 'projects':
            var activeProjects = projects.filter(function (p) { return p.status === 'active'; }).length;
            return {
                current: activeProjects,
                previous: Math.floor(activeProjects * 0.9),
                unit: 'count',
                format: 'integer',
            };
        case 'utilization':
            var workingHours = timeEntries.length * 8; // Assume 8 hours per day
            var actualHours = timeEntries.reduce(function (sum, entry) { return sum + entry.hours; }, 0);
            var utilization = workingHours > 0 ? (actualHours / workingHours) * 100 : 0;
            return {
                current: utilization,
                previous: utilization * 0.95,
                unit: 'percentage',
                format: 'decimal',
            };
        default:
            return { current: 0, previous: 0, unit: 'unknown' };
    }
}
function generateGaugeData(metric, timeEntries, projects, users) {
    switch (metric) {
        case 'utilization':
            var totalPossibleHours = users.length * 40 * 4; // 40 hours/week * 4 weeks
            var totalActualHours = timeEntries.reduce(function (sum, entry) { return sum + entry.hours; }, 0);
            var utilization = totalPossibleHours > 0 ? (totalActualHours / totalPossibleHours) * 100 : 0;
            return {
                value: Math.round(utilization),
                min: 0,
                max: 100,
                unit: '%',
                segments: [
                    { min: 0, max: 60, color: '#ff4444', label: 'Low' },
                    { min: 60, max: 80, color: '#ffaa00', label: 'Good' },
                    { min: 80, max: 100, color: '#00aa00', label: 'Excellent' },
                ],
            };
        case 'productivity':
            var avgProductivity = timeEntries.reduce(function (sum, entry) { return sum + (entry.productivityScore || 75); }, 0) / timeEntries.length;
            return {
                value: Math.round(avgProductivity),
                min: 0,
                max: 100,
                unit: '%',
                segments: [
                    { min: 0, max: 50, color: '#ff4444', label: 'Poor' },
                    { min: 50, max: 75, color: '#ffaa00', label: 'Average' },
                    { min: 75, max: 100, color: '#00aa00', label: 'High' },
                ],
            };
        default:
            return { value: 0, min: 0, max: 100, unit: '%' };
    }
}
function generateChartData(config, timeEntries, projects, clients, dateRange) {
    switch (config.metric) {
        case 'revenue':
            if (config.groupBy === 'month') {
                var monthlyData = groupByMonth(timeEntries, dateRange);
                return {
                    type: config.chartType || 'line',
                    labels: monthlyData.map(function (d) { return d.month; }),
                    datasets: [{
                            label: 'Revenue',
                            data: monthlyData.map(function (d) { return d.revenue; }),
                            borderColor: '#007bff',
                            backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        }],
                };
            }
            break;
        case 'projects':
            if (config.groupBy === 'status') {
                var statusCounts = projects.reduce(function (acc, project) {
                    acc[project.status] = (acc[project.status] || 0) + 1;
                    return acc;
                }, {});
                return {
                    type: 'pie',
                    labels: Object.keys(statusCounts),
                    datasets: [{
                            data: Object.values(statusCounts),
                            backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#6c757d'],
                        }],
                };
            }
            break;
        default:
            return { type: 'line', labels: [], datasets: [] };
    }
}
function generateTableData(config, timeEntries, projects, clients) {
    switch (config.metric) {
        case 'top_projects':
            var projectHours = projects.map(function (project) {
                var hours = timeEntries
                    .filter(function (entry) { return entry.projectId === project.projectId; })
                    .reduce(function (sum, entry) { return sum + entry.hours; }, 0);
                return {
                    name: project.name,
                    hours: hours,
                    budget: project.budget,
                    utilization: project.budget > 0 ? (hours / project.budgetHours) * 100 : 0,
                };
            }).sort(function (a, b) { return b.hours - a.hours; }).slice(0, 10);
            return {
                headers: ['Project', 'Hours', 'Budget', 'Utilization'],
                rows: projectHours.map(function (p) { return [
                    p.name,
                    p.hours.toFixed(1),
                    "$".concat(p.budget.toLocaleString()),
                    "".concat(p.utilization.toFixed(1), "%"),
                ]; }),
            };
        default:
            return { headers: [], rows: [] };
    }
}
function generateHeatmapData(config, timeEntries, users, dateRange) {
    if (config.groupBy === 'user_day') {
        var heatmapData_1 = [];
        var startDate_1 = new Date(dateRange.startDate);
        var endDate_1 = new Date(dateRange.endDate);
        users.forEach(function (user) {
            var _loop_1 = function (d) {
                var dayEntries = timeEntries.filter(function (entry) {
                    return entry.userId === user.userId &&
                        entry.startDate.startsWith(d.toISOString().split('T')[0]);
                });
                var dayHours = dayEntries.reduce(function (sum, entry) { return sum + entry.hours; }, 0);
                heatmapData_1.push({
                    x: d.toISOString().split('T')[0],
                    y: user.name || user.email || 'Unknown User',
                    value: dayHours,
                });
            };
            for (var d = new Date(startDate_1); d <= endDate_1; d.setDate(d.getDate() + 1)) {
                _loop_1(d);
            }
        });
        return {
            data: heatmapData_1,
            colorScale: {
                min: 0,
                max: 8,
                colors: ['#ffffff', '#c6e48b', '#7bc96f', '#239a3b', '#196127'],
            },
        };
    }
    return { data: [] };
}
function generateTrendData(config, timeEntries, projects, dateRange) {
    var weeklyData = groupByWeek(timeEntries, dateRange);
    var values = weeklyData.map(function (d) { return d.value; });
    if (values.length < 2) {
        return { trend: 'stable', changePercent: 0, data: weeklyData };
    }
    var firstHalf = values.slice(0, Math.floor(values.length / 2));
    var secondHalf = values.slice(Math.floor(values.length / 2));
    var firstAvg = firstHalf.reduce(function (sum, v) { return sum + v; }, 0) / firstHalf.length;
    var secondAvg = secondHalf.reduce(function (sum, v) { return sum + v; }, 0) / secondHalf.length;
    var changePercent = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    var trend = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable';
    return {
        trend: trend,
        changePercent: Math.round(changePercent),
        data: weeklyData,
        forecast: generateSimpleForecast(values),
    };
}
function groupByMonth(timeEntries, dateRange) {
    var months = new Map();
    timeEntries.forEach(function (entry) {
        var month = entry.startDate.substring(0, 7); // YYYY-MM
        if (!months.has(month)) {
            months.set(month, { month: month, hours: 0, revenue: 0 });
        }
        var data = months.get(month);
        if (data) {
            data.hours += entry.hours;
            if (entry.billable) {
                data.revenue += entry.hours * entry.hourlyRate;
            }
        }
    });
    return Array.from(months.values()).sort(function (a, b) { return a.month.localeCompare(b.month); });
}
function groupByWeek(timeEntries, dateRange) {
    var weeks = new Map();
    timeEntries.forEach(function (entry) {
        var date = new Date(entry.startDate);
        var weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        var weekKey = weekStart.toISOString().split('T')[0];
        if (!weeks.has(weekKey)) {
            weeks.set(weekKey, { week: weekKey, value: 0 });
        }
        var weekData = weeks.get(weekKey);
        if (weekData) {
            weekData.value += entry.hours;
        }
    });
    return Array.from(weeks.values()).sort(function (a, b) { return a.week.localeCompare(b.week); });
}
function generateDashboardSummary(timeEntries, projects, clients, users) {
    var totalHours = timeEntries.reduce(function (sum, entry) { return sum + entry.hours; }, 0);
    var billableHours = timeEntries.filter(function (entry) { return entry.billable; }).reduce(function (sum, entry) { return sum + entry.hours; }, 0);
    var totalRevenue = timeEntries
        .filter(function (entry) { return entry.billable; })
        .reduce(function (sum, entry) { return sum + (entry.hours * entry.hourlyRate); }, 0);
    var activeProjects = projects.filter(function (p) { return p.status === 'active'; }).length;
    var totalPossibleHours = users.length * 40 * 4; // 40 hours/week * 4 weeks
    var teamUtilization = totalPossibleHours > 0 ? (totalHours / totalPossibleHours) * 100 : 0;
    var averageHourlyRate = billableHours > 0 ? totalRevenue / billableHours : 0;
    return {
        totalRevenue: Math.round(totalRevenue),
        totalHours: Math.round(totalHours * 10) / 10,
        activeProjects: activeProjects,
        teamUtilization: Math.round(teamUtilization),
        averageHourlyRate: Math.round(averageHourlyRate),
        profitMargin: 65, // Mock data
        clientSatisfaction: 87, // Mock data
        productivityScore: 78, // Mock data
    };
}
function generateRealTimeMetrics(userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var now, todayStart;
        return __generator(this, function (_a) {
            now = new Date();
            todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return [2 /*return*/, {
                    activeUsers: 12,
                    currentSessions: 8,
                    todayHours: 45.5,
                    todayRevenue: 3420,
                    liveProjects: 6,
                    recentActivities: [
                        {
                            userId: 'user1',
                            userName: 'John Doe',
                            action: 'Started timer',
                            timestamp: new Date(Date.now() - 300000).toISOString(),
                            details: { project: 'Website Redesign' },
                        },
                        {
                            userId: 'user2',
                            userName: 'Jane Smith',
                            action: 'Completed task',
                            timestamp: new Date(Date.now() - 600000).toISOString(),
                            details: { task: 'Database optimization' },
                        },
                    ],
                }];
        });
    });
}
function generateForecastingData(timeEntries, projects, dateRange) {
    return __awaiter(this, void 0, void 0, function () {
        var monthlyRevenue, recentRevenue, avgGrowth, lastRevenue, nextMonthProjection, nextQuarterProjection;
        return __generator(this, function (_a) {
            monthlyRevenue = groupByMonth(timeEntries, dateRange);
            recentRevenue = monthlyRevenue.slice(-3).map(function (m) { return m.revenue; });
            avgGrowth = recentRevenue.length > 1 ?
                (recentRevenue[recentRevenue.length - 1] - recentRevenue[0]) / (recentRevenue.length - 1) : 0;
            lastRevenue = recentRevenue[recentRevenue.length - 1] || 0;
            nextMonthProjection = lastRevenue + avgGrowth;
            nextQuarterProjection = lastRevenue + (avgGrowth * 3);
            return [2 /*return*/, {
                    revenueProjection: {
                        nextMonth: Math.round(nextMonthProjection),
                        nextQuarter: Math.round(nextQuarterProjection),
                        confidence: 75,
                        trend: avgGrowth > 0 ? 'increasing' : avgGrowth < 0 ? 'decreasing' : 'stable',
                    },
                    utilizationProjection: {
                        nextWeek: 82,
                        nextMonth: 78,
                        confidence: 68,
                    },
                    projectCompletion: {
                        onTimeProjects: projects.filter(function (p) { return p.status === 'completed' && !p.isOverdue; }).length,
                        delayedProjects: projects.filter(function (p) { return p.isOverdue; }).length,
                        averageDelay: 3.2, // days
                    },
                }];
        });
    });
}
function generateBenchmarkData(summary) {
    // Mock industry benchmarks - in production, these would come from industry data
    var industryAverages = {
        utilization: 75,
        hourlyRate: 85,
        profitMargin: 60,
        clientRetention: 85,
    };
    return {
        industryAverages: industryAverages,
        companyPerformance: {
            utilizationVsIndustry: ((summary.teamUtilization - industryAverages.utilization) / industryAverages.utilization) * 100,
            rateVsIndustry: ((summary.averageHourlyRate - industryAverages.hourlyRate) / industryAverages.hourlyRate) * 100,
            marginVsIndustry: ((summary.profitMargin - industryAverages.profitMargin) / industryAverages.profitMargin) * 100,
            retentionVsIndustry: 5, // Mock data
        },
    };
}
function generateAlerts(summary, realTime, forecasting) {
    var _a;
    var alerts = [];
    // Low utilization alert
    if (summary.teamUtilization < 70) {
        alerts.push({
            id: "alert-".concat(Date.now(), "-1"),
            type: 'warning',
            title: 'Low Team Utilization',
            message: "Team utilization is ".concat(summary.teamUtilization, "%, below the target of 75%"),
            metric: 'utilization',
            currentValue: summary.teamUtilization,
            threshold: 75,
            timestamp: new Date().toISOString(),
            acknowledged: false,
        });
    }
    // Revenue decline alert
    if ((forecasting === null || forecasting === void 0 ? void 0 : forecasting.revenueProjection.trend) === 'decreasing') {
        alerts.push({
            id: "alert-".concat(Date.now(), "-2"),
            type: 'critical',
            title: 'Revenue Decline Forecast',
            message: 'Revenue is projected to decline next month based on current trends',
            metric: 'revenue',
            currentValue: forecasting.revenueProjection.nextMonth,
            threshold: 0,
            timestamp: new Date().toISOString(),
            acknowledged: false,
        });
    }
    // Overdue projects alert
    if (((_a = forecasting === null || forecasting === void 0 ? void 0 : forecasting.projectCompletion) === null || _a === void 0 ? void 0 : _a.delayedProjects) && forecasting.projectCompletion.delayedProjects > 0) {
        alerts.push({
            id: "alert-".concat(Date.now(), "-3"),
            type: 'warning',
            title: 'Overdue Projects',
            message: "".concat(forecasting.projectCompletion.delayedProjects, " projects are overdue"),
            metric: 'projects',
            currentValue: forecasting.projectCompletion.delayedProjects,
            threshold: 0,
            timestamp: new Date().toISOString(),
            acknowledged: false,
        });
    }
    return alerts;
}
// Utility functions
function calculateTrend(current, previous) {
    var change = ((current - previous) / previous) * 100;
    return change > 5 ? 'up' : change < -5 ? 'down' : 'stable';
}
function calculateChangePercent(current, previous) {
    return previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
}
function getKPIStatus(current, target, threshold) {
    if (!target && !threshold)
        return 'good';
    if (threshold && current < threshold)
        return 'critical';
    if (target && current < target * 0.9)
        return 'warning';
    return 'good';
}
function getGaugeStatus(value, target, threshold) {
    if (threshold && value < threshold)
        return 'critical';
    if (target && value < target)
        return 'warning';
    return 'good';
}
function generateSimpleForecast(values) {
    if (values.length < 2)
        return [];
    var firstValue = values[0];
    var lastValue = values[values.length - 1];
    if (firstValue === undefined || lastValue === undefined)
        return [];
    var trend = (lastValue - firstValue) / (values.length - 1);
    return [
        lastValue + trend,
        lastValue + (trend * 2),
        lastValue + (trend * 3),
    ];
}
