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
                console.log('Generate time report request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                userRole = (user === null || user === void 0 ? void 0 : user.role) || 'employee';
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                queryParams = event.queryStringParameters || {};
                filters = {
                    dateRange: {
                        startDate: queryParams.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        endDate: queryParams.endDate || new Date().toISOString().split('T')[0],
                        preset: queryParams.preset,
                    },
                    users: queryParams.userId ? [queryParams.userId] : undefined,
                    projects: queryParams.projectId ? [queryParams.projectId] : undefined,
                    clients: queryParams.clientId ? [queryParams.clientId] : undefined,
                    billable: queryParams.billable ? queryParams.billable === 'true' : undefined,
                    groupBy: queryParams.groupBy || 'date',
                    sortBy: queryParams.sortBy || 'date',
                    sortOrder: queryParams.sortOrder || 'desc',
                    limit: queryParams.limit ? parseInt(queryParams.limit) : 100,
                    offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
                };
                // Apply role-based access control
                if (userRole === 'employee') {
                    // Employees can only see their own data
                    filters.users = [userId];
                }
                cacheKey = generateCacheKey('time-report', filters, userId);
                return [4 /*yield*/, getCachedReport(cacheKey)];
            case 1:
                cachedReport = _a.sent();
                if (cachedReport) {
                    console.log('Returning cached report');
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
                return [4 /*yield*/, generateTimeReport(filters, userId, userRole)];
            case 2:
                reportData = _a.sent();
                // Cache the report (1 hour TTL)
                return [4 /*yield*/, cacheReport(cacheKey, reportData, 3600)];
            case 3:
                // Cache the report (1 hour TTL)
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
                console.error('Error generating time report:', error_1);
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_ERROR', 'Failed to generate time report')];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function generateTimeReport(filters, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var reportId, generatedAt, timeEntries, _a, users, projects, clients, reportData, summary, groupedData, sortedData, paginatedData;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    reportId = "time-report-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
                    generatedAt = new Date().toISOString();
                    return [4 /*yield*/, queryTimeEntries(filters, userRole)];
                case 1:
                    timeEntries = _b.sent();
                    return [4 /*yield*/, Promise.all([
                            getUsersData(timeEntries),
                            getProjectsData(timeEntries),
                            getClientsData(timeEntries),
                        ])];
                case 2:
                    _a = _b.sent(), users = _a[0], projects = _a[1], clients = _a[2];
                    reportData = transformTimeEntries(timeEntries, users, projects, clients);
                    summary = calculateSummary(reportData);
                    groupedData = groupData(reportData, filters.groupBy || 'date');
                    sortedData = sortData(groupedData, filters.sortBy || 'date', filters.sortOrder || 'desc');
                    paginatedData = applyPagination(sortedData, filters.offset || 0, filters.limit || 100);
                    return [2 /*return*/, {
                            reportId: reportId,
                            reportType: 'time',
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
                                cacheKey: generateCacheKey('time-report', filters, userId),
                                expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
                            },
                        }];
            }
        });
    });
}
function queryTimeEntries(filters, userRole) {
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
                            ':pkPrefix': 'TIME_ENTRY#',
                            ':startDate': filters.dateRange.startDate,
                            ':endDate': filters.dateRange.endDate,
                        },
                    };
                    // Add additional filters
                    if (filters.users && filters.users.length > 0) {
                        queryParams.FilterExpression += ' AND #userId IN (:userIds)';
                        queryParams.ExpressionAttributeNames['#userId'] = 'userId';
                        queryParams.ExpressionAttributeValues[':userIds'] = filters.users;
                    }
                    if (filters.projects && filters.projects.length > 0) {
                        queryParams.FilterExpression += ' AND #projectId IN (:projectIds)';
                        queryParams.ExpressionAttributeNames['#projectId'] = 'projectId';
                        queryParams.ExpressionAttributeValues[':projectIds'] = filters.projects;
                    }
                    if (filters.billable !== undefined) {
                        queryParams.FilterExpression += ' AND #isBillable = :billable';
                        queryParams.ExpressionAttributeNames['#isBillable'] = 'isBillable';
                        queryParams.ExpressionAttributeValues[':billable'] = filters.billable;
                    }
                    if (filters.status && filters.status.length > 0) {
                        queryParams.FilterExpression += ' AND #status IN (:statuses)';
                        queryParams.ExpressionAttributeNames['#status'] = 'status';
                        queryParams.ExpressionAttributeValues[':statuses'] = filters.status;
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
function getUsersData(timeEntries) {
    return __awaiter(this, void 0, void 0, function () {
        var usersTable, userIds, users, _i, userIds_1, userId, command, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    usersTable = process.env.USERS_TABLE;
                    userIds = __spreadArray([], new Set(timeEntries.map(function (entry) { return entry.userId; })), true);
                    users = new Map();
                    if (!usersTable || userIds.length === 0) {
                        return [2 /*return*/, users];
                    }
                    _i = 0, userIds_1 = userIds;
                    _a.label = 1;
                case 1:
                    if (!(_i < userIds_1.length)) return [3 /*break*/, 6];
                    userId = userIds_1[_i];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    command = new lib_dynamodb_1.GetCommand({
                        TableName: usersTable,
                        Key: { id: userId },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 3:
                    result = _a.sent();
                    if (result.Item) {
                        users.set(userId, result.Item);
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    console.error("Error fetching user ".concat(userId, ":"), error_2);
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/, users];
            }
        });
    });
}
function getProjectsData(timeEntries) {
    return __awaiter(this, void 0, void 0, function () {
        var projectsTable, projectIds, projects, _i, projectIds_1, projectId, command, result, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    projectsTable = process.env.PROJECTS_TABLE;
                    projectIds = __spreadArray([], new Set(timeEntries.map(function (entry) { return entry.projectId; })), true);
                    projects = new Map();
                    if (!projectsTable || projectIds.length === 0) {
                        return [2 /*return*/, projects];
                    }
                    _i = 0, projectIds_1 = projectIds;
                    _a.label = 1;
                case 1:
                    if (!(_i < projectIds_1.length)) return [3 /*break*/, 6];
                    projectId = projectIds_1[_i];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    command = new lib_dynamodb_1.GetCommand({
                        TableName: projectsTable,
                        Key: { id: projectId },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 3:
                    result = _a.sent();
                    if (result.Item) {
                        projects.set(projectId, result.Item);
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_3 = _a.sent();
                    console.error("Error fetching project ".concat(projectId, ":"), error_3);
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/, projects];
            }
        });
    });
}
function getClientsData(timeEntries) {
    return __awaiter(this, void 0, void 0, function () {
        var clientsTable, projects, clientIds, clients, _i, clientIds_1, clientId, command, result, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    clientsTable = process.env.CLIENTS_TABLE;
                    return [4 /*yield*/, getProjectsData(timeEntries)];
                case 1:
                    projects = _a.sent();
                    clientIds = __spreadArray([], new Set(Array.from(projects.values()).map(function (project) { return project.clientId; })), true);
                    clients = new Map();
                    if (!clientsTable || clientIds.length === 0) {
                        return [2 /*return*/, clients];
                    }
                    _i = 0, clientIds_1 = clientIds;
                    _a.label = 2;
                case 2:
                    if (!(_i < clientIds_1.length)) return [3 /*break*/, 7];
                    clientId = clientIds_1[_i];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    command = new lib_dynamodb_1.GetCommand({
                        TableName: clientsTable,
                        Key: { id: clientId },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 4:
                    result = _a.sent();
                    if (result.Item) {
                        clients.set(clientId, result.Item);
                    }
                    return [3 /*break*/, 6];
                case 5:
                    error_4 = _a.sent();
                    console.error("Error fetching client ".concat(clientId, ":"), error_4);
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7: return [2 /*return*/, clients];
            }
        });
    });
}
function transformTimeEntries(timeEntries, users, projects, clients) {
    return timeEntries.map(function (entry) {
        var user = users.get(entry.userId);
        var project = projects.get(entry.projectId);
        var client = clients.get(project === null || project === void 0 ? void 0 : project.clientId);
        // Duration is in minutes, convert to hours
        var hours = (entry.duration || 0) / 60;
        var billableHours = entry.isBillable ? hours : 0;
        var nonBillableHours = entry.isBillable ? 0 : hours;
        var hourlyRate = entry.hourlyRate || (project === null || project === void 0 ? void 0 : project.hourlyRate) || (user === null || user === void 0 ? void 0 : user.hourlyRate) || 0;
        var totalCost = billableHours * hourlyRate;
        // Parse tags if they're stored as JSON string
        var tags = entry.tags || [];
        if (typeof tags === 'string') {
            try {
                tags = JSON.parse(tags);
            }
            catch (e) {
                tags = [];
            }
        }
        return {
            date: entry.date,
            userId: entry.userId,
            userName: (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.email) || 'Unknown User',
            projectId: entry.projectId,
            projectName: (project === null || project === void 0 ? void 0 : project.name) || 'Unknown Project',
            clientId: (project === null || project === void 0 ? void 0 : project.clientId) || '',
            clientName: (client === null || client === void 0 ? void 0 : client.name) || 'Unknown Client',
            hours: hours,
            billableHours: billableHours,
            nonBillableHours: nonBillableHours,
            hourlyRate: hourlyRate,
            totalCost: totalCost,
            description: entry.description || '',
            tags: tags,
        };
    });
}
function calculateSummary(data) {
    var totalHours = data.reduce(function (sum, item) { return sum + item.hours; }, 0);
    var billableHours = data.reduce(function (sum, item) { return sum + item.billableHours; }, 0);
    var nonBillableHours = data.reduce(function (sum, item) { return sum + item.nonBillableHours; }, 0);
    var totalCost = data.reduce(function (sum, item) { return sum + item.totalCost; }, 0);
    var uniqueProjects = new Set(data.map(function (item) { return item.projectId; })).size;
    var uniqueUsers = new Set(data.map(function (item) { return item.userId; })).size;
    var uniqueClients = new Set(data.map(function (item) { return item.clientId; })).size;
    var averageHourlyRate = totalCost > 0 && billableHours > 0 ? totalCost / billableHours : 0;
    var utilizationRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
    return {
        totalHours: totalHours,
        totalCost: totalCost,
        billableHours: billableHours,
        nonBillableHours: nonBillableHours,
        projectCount: uniqueProjects,
        userCount: uniqueUsers,
        clientCount: uniqueClients,
        averageHourlyRate: averageHourlyRate,
        utilizationRate: utilizationRate,
    };
}
function groupData(data, groupBy) {
    // For now, return data as-is. In production, implement proper grouping logic
    return data;
}
function sortData(data, sortBy, sortOrder) {
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
        var cacheTable, command, result, cachedData, error_5;
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
                    error_5 = _a.sent();
                    console.error('Error getting cached report:', error_5);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function cacheReport(cacheKey, reportData, ttlSeconds) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheTable, expiresAt, command, error_6;
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
                    error_6 = _a.sent();
                    console.error('Error caching report:', error_6);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
