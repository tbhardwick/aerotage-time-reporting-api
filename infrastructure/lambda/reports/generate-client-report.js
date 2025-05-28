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
                console.log('Generate client report request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                userRole = (user === null || user === void 0 ? void 0 : user.role) || 'employee';
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                // Check permissions - only managers and admins can view client reports
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
                                    message: 'Client reports require manager or admin privileges',
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
                    clientIds: queryParams.clientId ? [queryParams.clientId] : undefined,
                    includeProjects: queryParams.includeProjects === 'true',
                    includeBilling: queryParams.includeBilling === 'true',
                    groupBy: queryParams.groupBy || 'client',
                    sortBy: queryParams.sortBy || 'totalRevenue',
                    sortOrder: queryParams.sortOrder || 'desc',
                    limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
                    offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
                };
                cacheKey = generateCacheKey('client-report', filters, userId);
                return [4 /*yield*/, getCachedReport(cacheKey)];
            case 1:
                cachedReport = _a.sent();
                if (cachedReport) {
                    console.log('Returning cached client report');
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
                return [4 /*yield*/, generateClientReport(filters, userId, userRole)];
            case 2:
                reportData = _a.sent();
                // Cache the report (30 minutes TTL for client reports)
                return [4 /*yield*/, cacheReport(cacheKey, reportData, 1800)];
            case 3:
                // Cache the report (30 minutes TTL for client reports)
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
                console.error('Error generating client report:', error_1);
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_ERROR', 'Failed to generate client report')];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function generateClientReport(filters, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var reportId, generatedAt, _a, clients, projects, timeEntries, invoices, reportData, summary, sortedData, paginatedData;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    reportId = "client-report-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
                    generatedAt = new Date().toISOString();
                    return [4 /*yield*/, Promise.all([
                            getClientsData(filters),
                            getProjectsData(filters),
                            getTimeEntriesForClients(filters),
                            getInvoicesData(filters),
                        ])];
                case 1:
                    _a = _b.sent(), clients = _a[0], projects = _a[1], timeEntries = _a[2], invoices = _a[3];
                    return [4 /*yield*/, transformClientData(clients, projects, timeEntries, invoices, filters)];
                case 2:
                    reportData = _b.sent();
                    summary = calculateClientSummary(reportData);
                    sortedData = sortClientData(reportData, filters.sortBy || 'totalRevenue', filters.sortOrder || 'desc');
                    paginatedData = applyPagination(sortedData, filters.offset || 0, filters.limit || 50);
                    return [2 /*return*/, {
                            reportId: reportId,
                            reportType: 'client',
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
                                cacheKey: generateCacheKey('client-report', filters, userId),
                                expiresAt: new Date(Date.now() + 1800 * 1000).toISOString(),
                            },
                        }];
            }
        });
    });
}
function getClientsData(filters) {
    return __awaiter(this, void 0, void 0, function () {
        var clientsTable, queryParams, command, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    clientsTable = process.env.CLIENTS_TABLE;
                    if (!clientsTable) {
                        throw new Error('CLIENTS_TABLE environment variable not set');
                    }
                    queryParams = {
                        TableName: clientsTable,
                    };
                    // Add filters
                    if (filters.clientIds && filters.clientIds.length > 0) {
                        queryParams.FilterExpression = '#id IN (:clientIds)';
                        queryParams.ExpressionAttributeNames = { '#id': 'id' };
                        queryParams.ExpressionAttributeValues = { ':clientIds': filters.clientIds };
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
function getProjectsData(filters) {
    return __awaiter(this, void 0, void 0, function () {
        var projectsTable, queryParams, command, result;
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
                    // Add client filter if specified
                    if (filters.clientIds && filters.clientIds.length > 0) {
                        queryParams.FilterExpression = '#clientId IN (:clientIds)';
                        queryParams.ExpressionAttributeNames = { '#clientId': 'clientId' };
                        queryParams.ExpressionAttributeValues = { ':clientIds': filters.clientIds };
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
function getTimeEntriesForClients(filters) {
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
                    command = new lib_dynamodb_1.ScanCommand(queryParams);
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.Items || []];
            }
        });
    });
}
function getInvoicesData(filters) {
    return __awaiter(this, void 0, void 0, function () {
        var invoicesTable, queryParams, command, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    invoicesTable = process.env.INVOICES_TABLE_NAME;
                    if (!invoicesTable) {
                        console.warn('INVOICES_TABLE_NAME not set, returning empty invoice data');
                        return [2 /*return*/, []];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    queryParams = {
                        TableName: invoicesTable,
                    };
                    // Add client filter if specified
                    if (filters.clientIds && filters.clientIds.length > 0) {
                        queryParams.FilterExpression = '#clientId IN (:clientIds)';
                        queryParams.ExpressionAttributeNames = { '#clientId': 'clientId' };
                        queryParams.ExpressionAttributeValues = { ':clientIds': filters.clientIds };
                    }
                    command = new lib_dynamodb_1.ScanCommand(queryParams);
                    return [4 /*yield*/, docClient.send(command)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.Items || []];
                case 3:
                    error_2 = _a.sent();
                    console.error('Error fetching invoices:', error_2);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function transformClientData(clients, projects, timeEntries, invoices, filters) {
    return __awaiter(this, void 0, void 0, function () {
        var projectsByClient, timeByProject, invoicesByClient;
        return __generator(this, function (_a) {
            projectsByClient = new Map();
            projects.forEach(function (project) {
                if (project.clientId) {
                    if (!projectsByClient.has(project.clientId)) {
                        projectsByClient.set(project.clientId, []);
                    }
                    projectsByClient.get(project.clientId).push(project);
                }
            });
            timeByProject = new Map();
            timeEntries.forEach(function (entry) {
                if (entry.projectId) {
                    if (!timeByProject.has(entry.projectId)) {
                        timeByProject.set(entry.projectId, []);
                    }
                    timeByProject.get(entry.projectId).push(entry);
                }
            });
            invoicesByClient = new Map();
            invoices.forEach(function (invoice) {
                if (invoice.clientId) {
                    if (!invoicesByClient.has(invoice.clientId)) {
                        invoicesByClient.set(invoice.clientId, []);
                    }
                    invoicesByClient.get(invoice.clientId).push(invoice);
                }
            });
            return [2 /*return*/, clients.map(function (client) {
                    var clientProjects = projectsByClient.get(client.id) || [];
                    var clientInvoices = invoicesByClient.get(client.id) || [];
                    // Calculate time and revenue across all client projects
                    var totalHours = 0;
                    var billableHours = 0;
                    var nonBillableHours = 0;
                    var totalRevenue = 0;
                    var lastActivityDate = '';
                    var projectSummaries = [];
                    clientProjects.forEach(function (project) {
                        var projectTimeEntries = timeByProject.get(project.id) || [];
                        var projectHours = projectTimeEntries.reduce(function (sum, entry) {
                            return sum + (entry.duration ? (entry.duration || 0) / 60 : 0);
                        }, 0);
                        var projectBillableHours = projectTimeEntries
                            .filter(function (entry) { return entry.isBillable; })
                            .reduce(function (sum, entry) { return sum + (entry.duration ? (entry.duration || 0) / 60 : 0); }, 0);
                        var projectRevenue = projectTimeEntries
                            .filter(function (entry) { return entry.isBillable; })
                            .reduce(function (sum, entry) {
                            var hours = entry.duration ? (entry.duration || 0) / 60 : 0;
                            var rate = entry.hourlyRate || project.hourlyRate || 0;
                            return sum + (hours * rate);
                        }, 0);
                        // Get most recent activity for this project
                        var projectLastActivity = getProjectLastActivity(projectTimeEntries);
                        if (projectLastActivity > lastActivityDate) {
                            lastActivityDate = projectLastActivity;
                        }
                        totalHours += projectHours;
                        billableHours += projectBillableHours;
                        nonBillableHours += (projectHours - projectBillableHours);
                        totalRevenue += projectRevenue;
                        if (filters.includeProjects) {
                            projectSummaries.push({
                                projectId: project.id,
                                projectName: project.name,
                                status: project.status || 'unknown',
                                hours: Math.round(projectHours * 100) / 100,
                                revenue: Math.round(projectRevenue * 100) / 100,
                                lastActivity: projectLastActivity || 'No activity',
                            });
                        }
                    });
                    // Calculate invoice data
                    var invoiceData = calculateInvoiceData(clientInvoices);
                    // Calculate metrics
                    var averageHourlyRate = billableHours > 0 ? totalRevenue / billableHours : 0;
                    var utilizationRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
                    var profitability = calculateClientProfitability(totalRevenue, totalHours, averageHourlyRate);
                    // Count project statuses
                    var activeProjects = clientProjects.filter(function (p) { return p.status === 'active'; }).length;
                    var completedProjects = clientProjects.filter(function (p) { return p.status === 'completed'; }).length;
                    // Determine payment status
                    var paymentStatus = determinePaymentStatus(invoiceData);
                    return {
                        clientId: client.id,
                        clientName: client.name || 'Unknown Client',
                        contactEmail: client.email || '',
                        totalHours: Math.round(totalHours * 100) / 100,
                        billableHours: Math.round(billableHours * 100) / 100,
                        nonBillableHours: Math.round(nonBillableHours * 100) / 100,
                        totalRevenue: Math.round(totalRevenue * 100) / 100,
                        projectCount: clientProjects.length,
                        activeProjects: activeProjects,
                        completedProjects: completedProjects,
                        averageHourlyRate: Math.round(averageHourlyRate * 100) / 100,
                        lastActivity: formatLastActivity(lastActivityDate),
                        profitability: Math.round(profitability * 100) / 100,
                        utilizationRate: Math.round(utilizationRate * 100) / 100,
                        projects: projectSummaries,
                        invoiceData: invoiceData,
                        paymentStatus: paymentStatus,
                        outstandingAmount: invoiceData.totalOutstanding,
                    };
                })];
        });
    });
}
function getProjectLastActivity(timeEntries) {
    if (timeEntries.length === 0)
        return '';
    var sortedEntries = timeEntries.sort(function (a, b) { return b.date.localeCompare(a.date); });
    return sortedEntries[0].date;
}
function calculateInvoiceData(invoices) {
    var totalInvoiced = invoices.reduce(function (sum, inv) { return sum + (inv.amount || 0); }, 0);
    var totalPaid = invoices
        .filter(function (inv) { return inv.status === 'paid'; })
        .reduce(function (sum, inv) { return sum + (inv.amount || 0); }, 0);
    var totalOutstanding = invoices
        .filter(function (inv) { return inv.status !== 'paid'; })
        .reduce(function (sum, inv) { return sum + (inv.amount || 0); }, 0);
    // Get last invoice date
    var sortedInvoices = invoices.sort(function (a, b) { var _a; return ((_a = b.issueDate) === null || _a === void 0 ? void 0 : _a.localeCompare(a.issueDate)) || 0; });
    var lastInvoiceDate = sortedInvoices.length > 0 ? sortedInvoices[0].issueDate : '';
    // Calculate next invoice due (simplified - 30 days from last invoice)
    var nextInvoiceDue = lastInvoiceDate ?
        new Date(new Date(lastInvoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : '';
    return {
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        lastInvoiceDate: lastInvoiceDate,
        nextInvoiceDue: nextInvoiceDue,
        invoiceCount: invoices.length,
    };
}
function calculateClientProfitability(revenue, hours, hourlyRate) {
    // Simplified profitability calculation
    // In production, this would include actual costs, overhead, etc.
    var estimatedCost = hours * (hourlyRate * 0.7); // Assume 70% of rate is cost
    return revenue > 0 ? ((revenue - estimatedCost) / revenue) * 100 : 0;
}
function determinePaymentStatus(invoiceData) {
    if (invoiceData.totalOutstanding === 0)
        return 'current';
    if (invoiceData.totalOutstanding > invoiceData.totalPaid)
        return 'overdue';
    return 'pending';
}
function formatLastActivity(dateString) {
    if (!dateString)
        return 'No recent activity';
    var daysSince = Math.floor((Date.now() - new Date(dateString).getTime()) / (24 * 60 * 60 * 1000));
    if (daysSince === 0)
        return 'Today';
    if (daysSince === 1)
        return 'Yesterday';
    if (daysSince < 7)
        return "".concat(daysSince, " days ago");
    if (daysSince < 30)
        return "".concat(Math.floor(daysSince / 7), " weeks ago");
    return "".concat(Math.floor(daysSince / 30), " months ago");
}
function calculateClientSummary(data) {
    var totalClients = data.length;
    var activeClients = data.filter(function (c) { return c.lastActivity !== 'No recent activity'; }).length;
    var totalRevenue = data.reduce(function (sum, c) { return sum + c.totalRevenue; }, 0);
    var totalHours = data.reduce(function (sum, c) { return sum + c.totalHours; }, 0);
    var totalOutstanding = data.reduce(function (sum, c) { return sum + c.outstandingAmount; }, 0);
    var averageRevenuePerClient = totalClients > 0 ? totalRevenue / totalClients : 0;
    var averageHoursPerClient = totalClients > 0 ? totalHours / totalClients : 0;
    var averageProfitability = data.length > 0 ?
        data.reduce(function (sum, c) { return sum + c.profitability; }, 0) / data.length : 0;
    // Find top clients
    var sortedByRevenue = __spreadArray([], data, true).sort(function (a, b) { return b.totalRevenue - a.totalRevenue; });
    var sortedByHours = __spreadArray([], data, true).sort(function (a, b) { return b.totalHours - a.totalHours; });
    return {
        totalClients: totalClients,
        activeClients: activeClients,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalHours: Math.round(totalHours * 100) / 100,
        averageRevenuePerClient: Math.round(averageRevenuePerClient * 100) / 100,
        averageHoursPerClient: Math.round(averageHoursPerClient * 100) / 100,
        topClientByRevenue: sortedByRevenue.length > 0 ? sortedByRevenue[0].clientName : 'N/A',
        topClientByHours: sortedByHours.length > 0 ? sortedByHours[0].clientName : 'N/A',
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        averageProfitability: Math.round(averageProfitability * 100) / 100,
    };
}
function sortClientData(data, sortBy, sortOrder) {
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
                    console.error('Error getting cached client report:', error_3);
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
                    console.error('Error caching client report:', error_4);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
