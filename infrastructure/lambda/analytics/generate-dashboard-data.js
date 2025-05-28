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
    var userId, user, userRole, queryParams, dashboardRequest, validPeriods, dashboardData, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log('Generate dashboard data request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                userRole = (user === null || user === void 0 ? void 0 : user.role) || 'employee';
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                queryParams = event.queryStringParameters || {};
                dashboardRequest = {
                    period: queryParams.period || 'month',
                    metrics: queryParams.metrics ? queryParams.metrics.split(',') : undefined,
                    compareWith: queryParams.compareWith,
                };
                validPeriods = ['day', 'week', 'month', 'quarter', 'year'];
                if (!validPeriods.includes(dashboardRequest.period)) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'INVALID_PERIOD',
                                    message: "Invalid period. Must be one of: ".concat(validPeriods.join(', ')),
                                },
                            }),
                        }];
                }
                return [4 /*yield*/, generateDashboardData(dashboardRequest, userId, userRole)];
            case 1:
                dashboardData = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify({
                            success: true,
                            data: dashboardData,
                        }),
                    }];
            case 2:
                error_1 = _a.sent();
                console.error('Error generating dashboard data:', error_1);
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_ERROR', 'Failed to generate dashboard data')];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function generateDashboardData(request, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var generatedAt, dateRange, dataFilter, _a, timeEntries, projects, clients, previousPeriodData, kpis, trends, charts, alerts;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    generatedAt = new Date().toISOString();
                    dateRange = getDateRange(request.period);
                    dataFilter = userRole === 'employee' ? { userId: userId } : {};
                    return [4 /*yield*/, Promise.all([
                            getTimeEntriesData(dateRange, dataFilter),
                            getProjectsData(dataFilter),
                            getClientsData(dataFilter),
                            request.compareWith ? getPreviousPeriodData(request.period, dataFilter) : Promise.resolve(null),
                        ])];
                case 1:
                    _a = _b.sent(), timeEntries = _a[0], projects = _a[1], clients = _a[2], previousPeriodData = _a[3];
                    kpis = calculateKPIs(timeEntries, projects, clients);
                    trends = calculateTrends(kpis, previousPeriodData);
                    charts = generateChartData(timeEntries, projects, clients, request.period);
                    alerts = generateAlerts(kpis, trends, projects);
                    return [2 /*return*/, {
                            kpis: kpis,
                            trends: trends,
                            charts: charts,
                            alerts: alerts,
                            generatedAt: generatedAt,
                            period: request.period,
                        }];
            }
        });
    });
}
function getDateRange(period) {
    var now = new Date();
    var endDate = now.toISOString().split('T')[0];
    var startDate = endDate; // Default to same day
    switch (period) {
        case 'day':
            startDate = endDate;
            break;
        case 'week':
            var weekStart = new Date(now);
            weekStart.setDate(now.getDate() - 7);
            startDate = weekStart.toISOString().split('T')[0];
            break;
        case 'month':
            var monthStart = new Date(now);
            monthStart.setDate(1);
            startDate = monthStart.toISOString().split('T')[0];
            break;
        case 'quarter':
            var quarterStart = new Date(now);
            quarterStart.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
            startDate = quarterStart.toISOString().split('T')[0];
            break;
        case 'year':
            var yearStart = new Date(now.getFullYear(), 0, 1);
            startDate = yearStart.toISOString().split('T')[0];
            break;
        default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    return { startDate: startDate, endDate: endDate };
}
function getTimeEntriesData(dateRange, filter) {
    return __awaiter(this, void 0, void 0, function () {
        var timeEntriesTable, queryParams, command, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    timeEntriesTable = process.env.TIME_ENTRIES_TABLE_NAME;
                    if (!timeEntriesTable) {
                        console.warn('TIME_ENTRIES_TABLE_NAME not set, returning empty data');
                        return [2 /*return*/, []];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    queryParams = {
                        TableName: timeEntriesTable,
                        FilterExpression: '#date BETWEEN :startDate AND :endDate',
                        ExpressionAttributeNames: {
                            '#date': 'date',
                        },
                        ExpressionAttributeValues: {
                            ':startDate': dateRange.startDate,
                            ':endDate': dateRange.endDate,
                        },
                    };
                    // Add user filter for employees
                    if (filter.userId) {
                        queryParams.FilterExpression += ' AND #userId = :userId';
                        queryParams.ExpressionAttributeNames['#userId'] = 'userId';
                        queryParams.ExpressionAttributeValues[':userId'] = filter.userId;
                    }
                    command = new lib_dynamodb_1.ScanCommand(queryParams);
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
function getProjectsData(filter) {
    return __awaiter(this, void 0, void 0, function () {
        var projectsTable, command, result, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    projectsTable = process.env.PROJECTS_TABLE_NAME;
                    if (!projectsTable) {
                        console.warn('PROJECTS_TABLE_NAME not set, returning empty data');
                        return [2 /*return*/, []];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    command = new lib_dynamodb_1.ScanCommand({
                        TableName: projectsTable,
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.Items || []];
                case 3:
                    error_3 = _a.sent();
                    console.error('Error fetching projects:', error_3);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getClientsData(filter) {
    return __awaiter(this, void 0, void 0, function () {
        var clientsTable, command, result, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    clientsTable = process.env.CLIENTS_TABLE_NAME;
                    if (!clientsTable) {
                        console.warn('CLIENTS_TABLE_NAME not set, returning empty data');
                        return [2 /*return*/, []];
                    }
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
function getPreviousPeriodData(period, filter) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // Get data from previous period for trend calculation
            // This is a simplified implementation - in production, implement proper period calculation
            return [2 /*return*/, null];
        });
    });
}
function calculateKPIs(timeEntries, projects, clients) {
    // Calculate total hours and revenue
    var totalHours = timeEntries.reduce(function (sum, entry) {
        return sum + (entry.duration ? entry.duration / 3600 : 0); // Convert seconds to hours
    }, 0);
    var billableEntries = timeEntries.filter(function (entry) { return entry.billable; });
    var billableHours = billableEntries.reduce(function (sum, entry) {
        return sum + (entry.duration ? entry.duration / 3600 : 0);
    }, 0);
    var totalRevenue = billableEntries.reduce(function (sum, entry) {
        var hours = entry.duration ? entry.duration / 3600 : 0;
        var rate = entry.hourlyRate || 0;
        return sum + (hours * rate);
    }, 0);
    // Calculate utilization rate
    var utilizationRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
    // Count active projects and clients
    var activeProjects = projects.filter(function (project) { return project.status === 'active'; }).length;
    var activeClients = clients.filter(function (client) { return client.isActive; }).length;
    // Calculate team productivity (simplified metric)
    var uniqueUsers = new Set(timeEntries.map(function (entry) { return entry.userId; })).size;
    var teamProductivity = uniqueUsers > 0 ? totalHours / uniqueUsers : 0;
    return {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalHours: Math.round(totalHours * 100) / 100,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        activeProjects: activeProjects,
        activeClients: activeClients,
        teamProductivity: Math.round(teamProductivity * 100) / 100,
    };
}
function calculateTrends(currentKPIs, previousData) {
    // If no previous data, return zero growth
    if (!previousData) {
        return {
            revenueGrowth: 0,
            hoursGrowth: 0,
            projectGrowth: 0,
            clientGrowth: 0,
        };
    }
    // Calculate percentage growth
    var calculateGrowth = function (current, previous) {
        if (previous === 0)
            return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    };
    return {
        revenueGrowth: Math.round(calculateGrowth(currentKPIs.totalRevenue, previousData.totalRevenue) * 100) / 100,
        hoursGrowth: Math.round(calculateGrowth(currentKPIs.totalHours, previousData.totalHours) * 100) / 100,
        projectGrowth: Math.round(calculateGrowth(currentKPIs.activeProjects, previousData.activeProjects) * 100) / 100,
        clientGrowth: Math.round(calculateGrowth(currentKPIs.activeClients, previousData.activeClients) * 100) / 100,
    };
}
function generateChartData(timeEntries, projects, clients, period) {
    // Revenue by month (simplified - group by month)
    var revenueByMonth = generateRevenueByMonth(timeEntries);
    // Hours by project
    var hoursByProject = generateHoursByProject(timeEntries, projects);
    // Utilization by user
    var utilizationByUser = generateUtilizationByUser(timeEntries);
    // Client activity
    var clientActivity = generateClientActivity(timeEntries, projects, clients);
    return {
        revenueByMonth: revenueByMonth,
        hoursByProject: hoursByProject,
        utilizationByUser: utilizationByUser,
        clientActivity: clientActivity,
    };
}
function generateRevenueByMonth(timeEntries) {
    var monthlyRevenue = new Map();
    timeEntries.forEach(function (entry) {
        if (entry.billable && entry.date) {
            var month = entry.date.substring(0, 7); // YYYY-MM
            var hours = entry.duration ? entry.duration / 3600 : 0;
            var revenue = hours * (entry.hourlyRate || 0);
            monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + revenue);
        }
    });
    return Array.from(monthlyRevenue.entries())
        .map(function (_a) {
        var month = _a[0], revenue = _a[1];
        return ({
            label: month,
            value: Math.round(revenue * 100) / 100,
            date: month,
        });
    })
        .sort(function (a, b) { return a.date.localeCompare(b.date); });
}
function generateHoursByProject(timeEntries, projects) {
    var projectHours = new Map();
    var projectNames = new Map();
    // Build project name lookup
    projects.forEach(function (project) {
        projectNames.set(project.id, project.name);
    });
    timeEntries.forEach(function (entry) {
        if (entry.projectId) {
            var hours = entry.duration ? entry.duration / 3600 : 0;
            projectHours.set(entry.projectId, (projectHours.get(entry.projectId) || 0) + hours);
        }
    });
    return Array.from(projectHours.entries())
        .map(function (_a) {
        var projectId = _a[0], hours = _a[1];
        return ({
            label: projectNames.get(projectId) || 'Unknown Project',
            value: Math.round(hours * 100) / 100,
            metadata: { projectId: projectId },
        });
    })
        .sort(function (a, b) { return b.value - a.value; })
        .slice(0, 10); // Top 10 projects
}
function generateUtilizationByUser(timeEntries) {
    var userStats = new Map();
    timeEntries.forEach(function (entry) {
        if (entry.userId) {
            var hours = entry.duration ? entry.duration / 3600 : 0;
            var stats = userStats.get(entry.userId) || { total: 0, billable: 0, name: entry.userName || 'Unknown User' };
            stats.total += hours;
            if (entry.billable) {
                stats.billable += hours;
            }
            userStats.set(entry.userId, stats);
        }
    });
    return Array.from(userStats.entries())
        .map(function (_a) {
        var userId = _a[0], stats = _a[1];
        return ({
            label: stats.name,
            value: stats.total > 0 ? Math.round((stats.billable / stats.total) * 10000) / 100 : 0, // Utilization percentage
            metadata: { userId: userId, totalHours: stats.total, billableHours: stats.billable },
        });
    })
        .sort(function (a, b) { return b.value - a.value; });
}
function generateClientActivity(timeEntries, projects, clients) {
    var clientHours = new Map();
    var clientNames = new Map();
    var projectClientMap = new Map();
    // Build lookup maps
    clients.forEach(function (client) {
        clientNames.set(client.id, client.name);
    });
    projects.forEach(function (project) {
        if (project.clientId) {
            projectClientMap.set(project.id, project.clientId);
        }
    });
    timeEntries.forEach(function (entry) {
        if (entry.projectId) {
            var clientId = projectClientMap.get(entry.projectId);
            if (clientId) {
                var hours = entry.duration ? entry.duration / 3600 : 0;
                clientHours.set(clientId, (clientHours.get(clientId) || 0) + hours);
            }
        }
    });
    return Array.from(clientHours.entries())
        .map(function (_a) {
        var clientId = _a[0], hours = _a[1];
        return ({
            label: clientNames.get(clientId) || 'Unknown Client',
            value: Math.round(hours * 100) / 100,
            metadata: { clientId: clientId },
        });
    })
        .sort(function (a, b) { return b.value - a.value; })
        .slice(0, 10); // Top 10 clients
}
function generateAlerts(kpis, trends, projects) {
    var alerts = [];
    var now = new Date().toISOString();
    // Low utilization alert
    if (kpis.utilizationRate < 70) {
        alerts.push({
            id: "utilization-".concat(Date.now()),
            type: 'warning',
            title: 'Low Utilization Rate',
            message: "Current utilization rate is ".concat(kpis.utilizationRate, "%. Consider reviewing project allocation."),
            severity: kpis.utilizationRate < 50 ? 'high' : 'medium',
            createdAt: now,
            actionRequired: true,
        });
    }
    // Negative revenue growth alert
    if (trends.revenueGrowth < -10) {
        alerts.push({
            id: "revenue-decline-".concat(Date.now()),
            type: 'error',
            title: 'Revenue Decline',
            message: "Revenue has decreased by ".concat(Math.abs(trends.revenueGrowth), "% compared to the previous period."),
            severity: 'high',
            createdAt: now,
            actionRequired: true,
        });
    }
    // Overdue projects alert (simplified check)
    var overdueProjects = projects.filter(function (project) {
        if (project.endDate && project.status === 'active') {
            return new Date(project.endDate) < new Date();
        }
        return false;
    });
    if (overdueProjects.length > 0) {
        alerts.push({
            id: "overdue-projects-".concat(Date.now()),
            type: 'warning',
            title: 'Overdue Projects',
            message: "".concat(overdueProjects.length, " project(s) are past their deadline."),
            severity: 'medium',
            createdAt: now,
            actionRequired: true,
        });
    }
    return alerts;
}
