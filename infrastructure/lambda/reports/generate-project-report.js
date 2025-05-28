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
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var crypto_1 = require("crypto");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, userRole, queryParams, filters, cacheKey, cachedReport, reportData, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                console.log('Generate project report request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                userRole = (user === null || user === void 0 ? void 0 : user.role) || 'employee';
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                // Check permissions - only managers and admins can view project reports
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
                                    code: 'INSUFFICIENT_PERMISSIONS',
                                    message: 'Project reports require manager or admin privileges',
                                },
                            }),
                        }];
                }
                queryParams = event.queryStringParameters || {};
                filters = {
                    dateRange: {
                        startDate: queryParams.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        endDate: queryParams.endDate || new Date().toISOString().split('T')[0],
                        preset: queryParams.preset,
                    },
                    projectIds: queryParams.projectId ? [queryParams.projectId] : undefined,
                    clientIds: queryParams.clientId ? [queryParams.clientId] : undefined,
                    status: queryParams.status ? queryParams.status.split(',') : undefined,
                    includeMetrics: queryParams.includeMetrics === 'true',
                    groupBy: queryParams.groupBy || 'project',
                    sortBy: queryParams.sortBy || 'actualHours',
                    sortOrder: queryParams.sortOrder || 'desc',
                    limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
                    offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
                };
                cacheKey = generateCacheKey('project-report', filters, userId);
                return [4 /*yield*/, getCachedReport(cacheKey)];
            case 1:
                cachedReport = _a.sent();
                if (cachedReport) {
                    console.log('Returning cached project report');
                    return [2 /*return*/, {
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: true,
                                data: cachedReport,
                            }),
                        }];
                }
                return [4 /*yield*/, generateProjectReport(filters, userId, userRole)];
            case 2:
                reportData = _a.sent();
                // Cache the report (30 minutes TTL for project reports)
                return [4 /*yield*/, cacheReport(cacheKey, reportData, 1800)];
            case 3:
                // Cache the report (30 minutes TTL for project reports)
                _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify({
                            success: true,
                            data: reportData,
                        }),
                    }];
            case 4:
                error_1 = _a.sent();
                console.error('Error generating project report:', error_1);
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_ERROR', 'Failed to generate project report')];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function generateProjectReport(filters, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var reportId, generatedAt, _a, projects, timeEntries, clients, reportData, summary, sortedData, paginatedData;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    reportId = "project-report-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
                    generatedAt = new Date().toISOString();
                    return [4 /*yield*/, Promise.all([
                            getProjectsData(filters),
                            getTimeEntriesForProjects(filters),
                            getClientsData(),
                        ])];
                case 1:
                    _a = _b.sent(), projects = _a[0], timeEntries = _a[1], clients = _a[2];
                    return [4 /*yield*/, transformProjectData(projects, timeEntries, clients, filters)];
                case 2:
                    reportData = _b.sent();
                    summary = calculateProjectSummary(reportData);
                    sortedData = sortProjectData(reportData, filters.sortBy || 'actualHours', filters.sortOrder || 'desc');
                    paginatedData = applyPagination(sortedData, filters.offset || 0, filters.limit || 50);
                    return [2 /*return*/, {
                            reportId: reportId,
                            reportType: 'project',
                            generatedAt: generatedAt,
                            filters: filters,
                            summary: summary,
                            data: paginatedData.data,
                            pagination: {
                                hasMore: paginatedData.hasMore,
                                totalCount: sortedData.length,
                                nextCursor: paginatedData.nextCursor,
                            },
                            cacheInfo: {
                                cached: false,
                                cacheKey: generateCacheKey('project-report', filters, userId),
                                expiresAt: new Date(Date.now() + 1800 * 1000).toISOString(),
                            },
                        }];
            }
        });
    });
}
function getProjectsData(filters) {
    return __awaiter(this, void 0, void 0, function () {
        var projectsTable, queryParams, filterExpressions, expressionAttributeNames, expressionAttributeValues, command, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    projectsTable = process.env.PROJECTS_TABLE;
                    if (!projectsTable) {
                        throw new Error('PROJECTS_TABLE environment variable not set');
                    }
                    queryParams = {
                        TableName: projectsTable,
                    };
                    filterExpressions = [];
                    expressionAttributeNames = {};
                    expressionAttributeValues = {};
                    if (filters.projectIds && filters.projectIds.length > 0) {
                        filterExpressions.push('#id IN (:projectIds)');
                        expressionAttributeNames['#id'] = 'id';
                        expressionAttributeValues[':projectIds'] = filters.projectIds;
                    }
                    if (filters.clientIds && filters.clientIds.length > 0) {
                        filterExpressions.push('#clientId IN (:clientIds)');
                        expressionAttributeNames['#clientId'] = 'clientId';
                        expressionAttributeValues[':clientIds'] = filters.clientIds;
                    }
                    if (filters.status && filters.status.length > 0) {
                        filterExpressions.push('#status IN (:statuses)');
                        expressionAttributeNames['#status'] = 'status';
                        expressionAttributeValues[':statuses'] = filters.status;
                    }
                    if (filterExpressions.length > 0) {
                        queryParams.FilterExpression = filterExpressions.join(' AND ');
                        queryParams.ExpressionAttributeNames = expressionAttributeNames;
                        queryParams.ExpressionAttributeValues = expressionAttributeValues;
                    }
                    command = new lib_dynamodb_1.ScanCommand(queryParams);
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.Items || []];
            }
        });
    });
}
function getTimeEntriesForProjects(filters) {
    return __awaiter(this, void 0, void 0, function () {
        var timeEntriesTable, queryParams, command, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    timeEntriesTable = process.env.TIME_ENTRIES_TABLE;
                    if (!timeEntriesTable) {
                        throw new Error('TIME_ENTRIES_TABLE environment variable not set');
                    }
                    queryParams = {
                        TableName: timeEntriesTable,
                        FilterExpression: 'begins_with(PK, :pkPrefix) AND #date BETWEEN :startDate AND :endDate',
                        ExpressionAttributeNames: {
                            '#date': 'date',
                        },
                        ExpressionAttributeValues: {
                            ':startDate': filters.dateRange.startDate,
                            ':endDate': filters.dateRange.endDate,
                            ':pkPrefix': 'TIME_ENTRY#',
                        },
                    };
                    // Add project filter if specified
                    if (filters.projectIds && filters.projectIds.length > 0) {
                        queryParams.FilterExpression += ' AND #projectId IN (:projectIds)';
                        queryParams.ExpressionAttributeNames['#projectId'] = 'projectId';
                        queryParams.ExpressionAttributeValues[':projectIds'] = filters.projectIds;
                    }
                    command = new lib_dynamodb_1.ScanCommand(queryParams);
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.Items || []];
            }
        });
    });
}
function getClientsData() {
    return __awaiter(this, void 0, void 0, function () {
        var clientsTable, clients, command, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    clientsTable = process.env.CLIENTS_TABLE;
                    clients = new Map();
                    if (!clientsTable) {
                        return [2 /*return*/, clients];
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
                    if (result.Items) {
                        result.Items.forEach(function (client) {
                            clients.set(client.id, client);
                        });
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    console.error('Error fetching clients:', error_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, clients];
            }
        });
    });
}
function transformProjectData(projects, timeEntries, clients, filters) {
    return __awaiter(this, void 0, void 0, function () {
        var timeByProject, teamMembersByProject;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    timeByProject = new Map();
                    timeEntries.forEach(function (entry) {
                        if (entry.projectId) {
                            if (!timeByProject.has(entry.projectId)) {
                                timeByProject.set(entry.projectId, []);
                            }
                            timeByProject.get(entry.projectId).push(entry);
                        }
                    });
                    return [4 /*yield*/, getTeamMembersByProject(projects)];
                case 1:
                    teamMembersByProject = _a.sent();
                    return [2 /*return*/, projects.map(function (project) {
                            var client = clients.get(project.clientId);
                            var projectTimeEntries = timeByProject.get(project.id) || [];
                            var teamMembers = teamMembersByProject.get(project.id) || [];
                            // Calculate actual hours and cost
                            var actualHours = projectTimeEntries.reduce(function (sum, entry) {
                                return sum + (entry.duration ? (entry.duration || 0) / 60 : 0);
                            }, 0);
                            var actualCost = projectTimeEntries.reduce(function (sum, entry) {
                                var hours = entry.duration ? (entry.duration || 0) / 60 : 0;
                                var rate = entry.hourlyRate || project.hourlyRate || 0;
                                return sum + (hours * rate);
                            }, 0);
                            // Get budget information
                            var budgetHours = project.budgetHours || 0;
                            var budgetCost = project.budgetCost || (budgetHours * (project.hourlyRate || 0));
                            // Calculate metrics
                            var hoursVariance = actualHours - budgetHours;
                            var costVariance = actualCost - budgetCost;
                            var utilizationRate = budgetHours > 0 ? (actualHours / budgetHours) * 100 : 0;
                            var profitMargin = budgetCost > 0 ? ((budgetCost - actualCost) / budgetCost) * 100 : 0;
                            var efficiency = actualHours > 0 ? (budgetHours / actualHours) * 100 : 100;
                            // Calculate completion percentage
                            var completionPercentage = calculateCompletionPercentage(project, actualHours, budgetHours);
                            // Check status flags
                            var isOverBudget = actualCost > budgetCost;
                            var isOverdue = project.endDate && new Date(project.endDate) < new Date() && project.status === 'active';
                            // Get recent activity
                            var recentActivity = getRecentActivity(projectTimeEntries);
                            return {
                                projectId: project.id,
                                projectName: project.name,
                                clientId: project.clientId || '',
                                clientName: (client === null || client === void 0 ? void 0 : client.name) || 'Unknown Client',
                                status: project.status || 'unknown',
                                startDate: project.startDate || '',
                                endDate: project.endDate || '',
                                budgetHours: Math.round(budgetHours * 100) / 100,
                                actualHours: Math.round(actualHours * 100) / 100,
                                budgetCost: Math.round(budgetCost * 100) / 100,
                                actualCost: Math.round(actualCost * 100) / 100,
                                utilizationRate: Math.round(utilizationRate * 100) / 100,
                                profitMargin: Math.round(profitMargin * 100) / 100,
                                teamMembers: teamMembers,
                                completionPercentage: Math.round(completionPercentage * 100) / 100,
                                hoursVariance: Math.round(hoursVariance * 100) / 100,
                                costVariance: Math.round(costVariance * 100) / 100,
                                isOverBudget: isOverBudget,
                                isOverdue: isOverdue,
                                efficiency: Math.round(efficiency * 100) / 100,
                                recentActivity: recentActivity,
                            };
                        })];
            }
        });
    });
}
function getTeamMembersByProject(projects) {
    return __awaiter(this, void 0, void 0, function () {
        var teamMembers;
        return __generator(this, function (_a) {
            teamMembers = new Map();
            projects.forEach(function (project) {
                // Placeholder - in production, fetch actual team members
                teamMembers.set(project.id, project.teamMembers || []);
            });
            return [2 /*return*/, teamMembers];
        });
    });
}
function calculateCompletionPercentage(project, actualHours, budgetHours) {
    // Simple completion calculation based on hours
    if (project.status === 'completed')
        return 100;
    if (project.status === 'cancelled')
        return 0;
    if (budgetHours === 0)
        return 0;
    return Math.min((actualHours / budgetHours) * 100, 100);
}
function getRecentActivity(timeEntries) {
    if (timeEntries.length === 0)
        return 'No recent activity';
    // Sort by date and get the most recent entry
    var sortedEntries = timeEntries.sort(function (a, b) { return b.date.localeCompare(a.date); });
    var mostRecent = sortedEntries[0];
    var daysSince = Math.floor((Date.now() - new Date(mostRecent.date).getTime()) / (24 * 60 * 60 * 1000));
    if (daysSince === 0)
        return 'Active today';
    if (daysSince === 1)
        return 'Active yesterday';
    if (daysSince < 7)
        return "Active ".concat(daysSince, " days ago");
    if (daysSince < 30)
        return "Active ".concat(Math.floor(daysSince / 7), " weeks ago");
    return "Active ".concat(Math.floor(daysSince / 30), " months ago");
}
function calculateProjectSummary(data) {
    var totalProjects = data.length;
    var activeProjects = data.filter(function (p) { return p.status === 'active'; }).length;
    var completedProjects = data.filter(function (p) { return p.status === 'completed'; }).length;
    var overdueProjects = data.filter(function (p) { return p.isOverdue; }).length;
    var overBudgetProjects = data.filter(function (p) { return p.isOverBudget; }).length;
    var totalBudgetHours = data.reduce(function (sum, p) { return sum + p.budgetHours; }, 0);
    var totalActualHours = data.reduce(function (sum, p) { return sum + p.actualHours; }, 0);
    var totalBudgetCost = data.reduce(function (sum, p) { return sum + p.budgetCost; }, 0);
    var totalActualCost = data.reduce(function (sum, p) { return sum + p.actualCost; }, 0);
    var averageUtilization = data.length > 0 ?
        data.reduce(function (sum, p) { return sum + p.utilizationRate; }, 0) / data.length : 0;
    var averageProfitMargin = data.length > 0 ?
        data.reduce(function (sum, p) { return sum + p.profitMargin; }, 0) / data.length : 0;
    var allTeamMembers = new Set();
    data.forEach(function (p) { return p.teamMembers.forEach(function (member) { return allTeamMembers.add(member); }); });
    return {
        totalProjects: totalProjects,
        activeProjects: activeProjects,
        completedProjects: completedProjects,
        overdueProjects: overdueProjects,
        overBudgetProjects: overBudgetProjects,
        totalBudgetHours: Math.round(totalBudgetHours * 100) / 100,
        totalActualHours: Math.round(totalActualHours * 100) / 100,
        totalBudgetCost: Math.round(totalBudgetCost * 100) / 100,
        totalActualCost: Math.round(totalActualCost * 100) / 100,
        averageUtilization: Math.round(averageUtilization * 100) / 100,
        averageProfitMargin: Math.round(averageProfitMargin * 100) / 100,
        totalTeamMembers: allTeamMembers.size,
    };
}
function sortProjectData(data, sortBy, sortOrder) {
    return data.sort(function (a, b) {
        var aValue = a[sortBy];
        var bValue = b[sortBy];
        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }
        if (sortOrder === 'desc') {
            return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
        else {
            return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
    });
}
function applyPagination(data, offset, limit) {
    var startIndex = offset;
    var endIndex = startIndex + limit;
    var paginatedData = data.slice(startIndex, endIndex);
    var hasMore = endIndex < data.length;
    return {
        data: paginatedData,
        hasMore: hasMore,
        nextCursor: hasMore ? (endIndex).toString() : undefined,
    };
}
function generateCacheKey(reportType, filters, userId) {
    var filterString = JSON.stringify(__assign(__assign({}, filters), { userId: userId }));
    return (0, crypto_1.createHash)('md5').update("".concat(reportType, "-").concat(filterString)).digest('hex');
}
function getCachedReport(cacheKey) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheTable, command, result, cachedData, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    cacheTable = process.env.REPORT_CACHE_TABLE_NAME;
                    if (!cacheTable) {
                        return [2 /*return*/, null];
                    }
                    command = new lib_dynamodb_1.GetCommand({
                        TableName: cacheTable,
                        Key: { cacheKey: cacheKey },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    if (result.Item && result.Item.expiresAt > Date.now()) {
                        cachedData = result.Item.reportData;
                        cachedData.cacheInfo = {
                            cached: true,
                            cacheKey: cacheKey,
                            expiresAt: new Date(result.Item.expiresAt).toISOString(),
                        };
                        return [2 /*return*/, cachedData];
                    }
                    return [2 /*return*/, null];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error getting cached project report:', error_3);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function cacheReport(cacheKey, reportData, ttlSeconds) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheTable, expiresAt, command, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    cacheTable = process.env.REPORT_CACHE_TABLE_NAME;
                    if (!cacheTable) {
                        return [2 /*return*/];
                    }
                    expiresAt = Date.now() + (ttlSeconds * 1000);
                    command = new lib_dynamodb_1.PutCommand({
                        TableName: cacheTable,
                        Item: {
                            cacheKey: cacheKey,
                            reportData: reportData,
                            reportType: reportData.reportType,
                            generatedAt: reportData.generatedAt,
                            expiresAt: expiresAt,
                            dataSize: JSON.stringify(reportData).length,
                        },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _a.sent();
                    console.error('Error caching project report:', error_4);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
