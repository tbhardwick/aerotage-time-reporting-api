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
    var userId, user, userRole, httpMethod, pathParameters, reportId, _a, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 13, , 14]);
                console.log('Report config management request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                userRole = (user === null || user === void 0 ? void 0 : user.role) || 'employee';
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                httpMethod = event.httpMethod;
                pathParameters = event.pathParameters || {};
                reportId = pathParameters.reportId;
                _a = httpMethod;
                switch (_a) {
                    case 'GET': return [3 /*break*/, 1];
                    case 'POST': return [3 /*break*/, 5];
                    case 'PUT': return [3 /*break*/, 7];
                    case 'DELETE': return [3 /*break*/, 9];
                }
                return [3 /*break*/, 11];
            case 1:
                if (!reportId) return [3 /*break*/, 3];
                return [4 /*yield*/, getReportConfig(reportId, userId, userRole)];
            case 2: return [2 /*return*/, _b.sent()];
            case 3: return [4 /*yield*/, listReportConfigs(event, userId, userRole)];
            case 4: return [2 /*return*/, _b.sent()];
            case 5: return [4 /*yield*/, createReportConfig(event, userId, userRole)];
            case 6: return [2 /*return*/, _b.sent()];
            case 7:
                if (!reportId) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'MISSING_REPORT_ID',
                                    message: 'Report ID is required for updates',
                                },
                            }),
                        }];
                }
                return [4 /*yield*/, updateReportConfig(reportId, event, userId, userRole)];
            case 8: return [2 /*return*/, _b.sent()];
            case 9:
                if (!reportId) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'MISSING_REPORT_ID',
                                    message: 'Report ID is required for deletion',
                                },
                            }),
                        }];
                }
                return [4 /*yield*/, deleteReportConfig(reportId, userId, userRole)];
            case 10: return [2 /*return*/, _b.sent()];
            case 11: return [2 /*return*/, {
                    statusCode: 405,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({
                        success: false,
                        error: {
                            code: 'METHOD_NOT_ALLOWED',
                            message: "HTTP method ".concat(httpMethod, " not allowed"),
                        },
                    }),
                }];
            case 12: return [3 /*break*/, 14];
            case 13:
                error_1 = _b.sent();
                console.error('Error in report config management:', error_1);
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_ERROR', 'Failed to manage report configuration')];
            case 14: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function createReportConfig(event, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var requestBody, validReportTypes, reportConfig, error_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    requestBody = void 0;
                    try {
                        requestBody = JSON.parse(event.body || '{}');
                    }
                    catch (error) {
                        return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_JSON', 'Invalid JSON in request body')];
                    }
                    // Validate required fields
                    if (!requestBody.reportType || !requestBody.name || !requestBody.filters) {
                        return [2 /*return*/, {
                                statusCode: 400,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                },
                                body: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'MISSING_REQUIRED_FIELDS',
                                        message: 'reportType, name, and filters are required',
                                    },
                                }),
                            }];
                    }
                    validReportTypes = ['time', 'project', 'client', 'dashboard'];
                    if (!validReportTypes.includes(requestBody.reportType)) {
                        return [2 /*return*/, {
                                statusCode: 400,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                },
                                body: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'INVALID_REPORT_TYPE',
                                        message: "Report type must be one of: ".concat(validReportTypes.join(', ')),
                                    },
                                }),
                            }];
                    }
                    // Check permissions for shared reports
                    if (requestBody.isShared && userRole === 'employee') {
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
                                        message: 'Only managers and admins can create shared reports',
                                    },
                                }),
                            }];
                    }
                    reportConfig = {
                        reportId: (0, crypto_1.randomUUID)(),
                        userId: userId,
                        reportType: requestBody.reportType,
                        name: requestBody.name,
                        description: requestBody.description,
                        filters: requestBody.filters,
                        schedule: requestBody.schedule,
                        isTemplate: requestBody.isTemplate || false,
                        isShared: requestBody.isShared || false,
                        sharedWith: requestBody.sharedWith || [],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        generationCount: 0,
                        tags: requestBody.tags || [],
                        metadata: requestBody.metadata || {},
                    };
                    // Calculate next run time if scheduled
                    if ((_a = reportConfig.schedule) === null || _a === void 0 ? void 0 : _a.enabled) {
                        reportConfig.schedule.nextRun = calculateNextRun(reportConfig.schedule);
                    }
                    // Save to database
                    return [4 /*yield*/, saveReportConfig(reportConfig)];
                case 1:
                    // Save to database
                    _b.sent();
                    return [2 /*return*/, {
                            statusCode: 201,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: true,
                                data: reportConfig,
                            }),
                        }];
                case 2:
                    error_2 = _b.sent();
                    console.error('Error creating report config:', error_2);
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getReportConfig(reportId, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var reportConfig, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetchReportConfig(reportId)];
                case 1:
                    reportConfig = _a.sent();
                    if (!reportConfig) {
                        return [2 /*return*/, {
                                statusCode: 404,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                },
                                body: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'REPORT_NOT_FOUND',
                                        message: 'Report configuration not found',
                                    },
                                }),
                            }];
                    }
                    // Check access permissions
                    if (!canAccessReport(reportConfig, userId, userRole)) {
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
                                        message: 'You do not have permission to access this report',
                                    },
                                }),
                            }];
                    }
                    return [2 /*return*/, {
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: true,
                                data: reportConfig,
                            }),
                        }];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error getting report config:', error_3);
                    throw error_3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function listReportConfigs(event, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var queryParams, reportType, isTemplate, isShared, limit, offset, userReports, sharedReports, allReports, uniqueReports, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    queryParams = event.queryStringParameters || {};
                    reportType = queryParams.reportType;
                    isTemplate = queryParams.isTemplate === 'true';
                    isShared = queryParams.isShared === 'true';
                    limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
                    offset = queryParams.offset ? parseInt(queryParams.offset) : 0;
                    return [4 /*yield*/, fetchUserReportConfigs(userId, reportType, isTemplate, limit, offset)];
                case 1:
                    userReports = _a.sent();
                    sharedReports = [];
                    if (!(isShared || userRole !== 'employee')) return [3 /*break*/, 3];
                    return [4 /*yield*/, fetchSharedReportConfigs(userId, reportType, isTemplate)];
                case 2:
                    sharedReports = _a.sent();
                    _a.label = 3;
                case 3:
                    allReports = __spreadArray(__spreadArray([], userReports, true), sharedReports, true);
                    uniqueReports = allReports.filter(function (report, index, self) {
                        return index === self.findIndex(function (r) { return r.reportId === report.reportId; });
                    });
                    // Sort by updatedAt descending
                    uniqueReports.sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
                    return [2 /*return*/, {
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: true,
                                data: {
                                    reports: uniqueReports,
                                    pagination: {
                                        hasMore: uniqueReports.length >= limit,
                                        totalCount: uniqueReports.length,
                                    },
                                },
                            }),
                        }];
                case 4:
                    error_4 = _a.sent();
                    console.error('Error listing report configs:', error_4);
                    throw error_4;
                case 5: return [2 /*return*/];
            }
        });
    });
}
function updateReportConfig(reportId, event, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var existingConfig, updateData, updatedConfig, error_5;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fetchReportConfig(reportId)];
                case 1:
                    existingConfig = _b.sent();
                    if (!existingConfig) {
                        return [2 /*return*/, {
                                statusCode: 404,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                },
                                body: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'REPORT_NOT_FOUND',
                                        message: 'Report configuration not found',
                                    },
                                }),
                            }];
                    }
                    // Check permissions
                    if (!canModifyReport(existingConfig, userId, userRole)) {
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
                                        message: 'You do not have permission to modify this report',
                                    },
                                }),
                            }];
                    }
                    updateData = void 0;
                    try {
                        updateData = JSON.parse(event.body || '{}');
                    }
                    catch (error) {
                        return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_JSON', 'Invalid JSON in request body')];
                    }
                    updatedConfig = __assign(__assign(__assign({}, existingConfig), updateData), { updatedAt: new Date().toISOString() });
                    // Recalculate next run time if schedule was updated
                    if (updateData.schedule && ((_a = updatedConfig.schedule) === null || _a === void 0 ? void 0 : _a.enabled)) {
                        updatedConfig.schedule.nextRun = calculateNextRun(updatedConfig.schedule);
                    }
                    // Save updated configuration
                    return [4 /*yield*/, saveReportConfig(updatedConfig)];
                case 2:
                    // Save updated configuration
                    _b.sent();
                    return [2 /*return*/, {
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: true,
                                data: updatedConfig,
                            }),
                        }];
                case 3:
                    error_5 = _b.sent();
                    console.error('Error updating report config:', error_5);
                    throw error_5;
                case 4: return [2 /*return*/];
            }
        });
    });
}
function deleteReportConfig(reportId, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var existingConfig, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fetchReportConfig(reportId)];
                case 1:
                    existingConfig = _a.sent();
                    if (!existingConfig) {
                        return [2 /*return*/, {
                                statusCode: 404,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                },
                                body: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'REPORT_NOT_FOUND',
                                        message: 'Report configuration not found',
                                    },
                                }),
                            }];
                    }
                    // Check permissions
                    if (!canModifyReport(existingConfig, userId, userRole)) {
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
                                        message: 'You do not have permission to delete this report',
                                    },
                                }),
                            }];
                    }
                    // Delete the configuration
                    return [4 /*yield*/, deleteReportConfigFromDB(reportId)];
                case 2:
                    // Delete the configuration
                    _a.sent();
                    return [2 /*return*/, {
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: true,
                                data: {
                                    message: 'Report configuration deleted successfully',
                                    reportId: reportId,
                                },
                            }),
                        }];
                case 3:
                    error_6 = _a.sent();
                    console.error('Error deleting report config:', error_6);
                    throw error_6;
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Database operations
function saveReportConfig(reportConfig) {
    return __awaiter(this, void 0, void 0, function () {
        var reportConfigsTable, command;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    reportConfigsTable = process.env.REPORT_CONFIGS_TABLE_NAME;
                    if (!reportConfigsTable) {
                        throw new Error('REPORT_CONFIGS_TABLE_NAME environment variable not set');
                    }
                    command = new lib_dynamodb_1.PutCommand({
                        TableName: reportConfigsTable,
                        Item: reportConfig,
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function fetchReportConfig(reportId) {
    return __awaiter(this, void 0, void 0, function () {
        var reportConfigsTable, command, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    reportConfigsTable = process.env.REPORT_CONFIGS_TABLE_NAME;
                    if (!reportConfigsTable) {
                        throw new Error('REPORT_CONFIGS_TABLE_NAME environment variable not set');
                    }
                    command = new lib_dynamodb_1.GetCommand({
                        TableName: reportConfigsTable,
                        Key: { reportId: reportId },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.Item || null];
            }
        });
    });
}
function fetchUserReportConfigs(userId, reportType, isTemplate, limit, offset) {
    return __awaiter(this, void 0, void 0, function () {
        var reportConfigsTable, filterExpression, expressionAttributeNames, expressionAttributeValues, queryParams, command, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    reportConfigsTable = process.env.REPORT_CONFIGS_TABLE_NAME;
                    if (!reportConfigsTable) {
                        throw new Error('REPORT_CONFIGS_TABLE_NAME environment variable not set');
                    }
                    filterExpression = '';
                    expressionAttributeNames = {};
                    expressionAttributeValues = {};
                    if (reportType) {
                        filterExpression += '#reportType = :reportType';
                        expressionAttributeNames['#reportType'] = 'reportType';
                        expressionAttributeValues[':reportType'] = reportType;
                    }
                    if (isTemplate !== undefined) {
                        if (filterExpression)
                            filterExpression += ' AND ';
                        filterExpression += '#isTemplate = :isTemplate';
                        expressionAttributeNames['#isTemplate'] = 'isTemplate';
                        expressionAttributeValues[':isTemplate'] = isTemplate;
                    }
                    queryParams = {
                        TableName: reportConfigsTable,
                        IndexName: 'UserIndex',
                        KeyConditionExpression: '#userId = :userId',
                        ExpressionAttributeNames: __assign({ '#userId': 'userId' }, expressionAttributeNames),
                        ExpressionAttributeValues: __assign({ ':userId': userId }, expressionAttributeValues),
                        ScanIndexForward: false, // Sort by createdAt descending
                    };
                    if (filterExpression) {
                        queryParams.FilterExpression = filterExpression;
                    }
                    if (limit) {
                        queryParams.Limit = limit;
                    }
                    command = new lib_dynamodb_1.QueryCommand(queryParams);
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.Items || []];
            }
        });
    });
}
function fetchSharedReportConfigs(userId, reportType, isTemplate) {
    return __awaiter(this, void 0, void 0, function () {
        var reportConfigsTable, filterExpression, expressionAttributeNames, expressionAttributeValues, queryParams, command, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    reportConfigsTable = process.env.REPORT_CONFIGS_TABLE_NAME;
                    if (!reportConfigsTable) {
                        throw new Error('REPORT_CONFIGS_TABLE_NAME environment variable not set');
                    }
                    filterExpression = '#isShared = :isShared';
                    expressionAttributeNames = { '#isShared': 'isShared' };
                    expressionAttributeValues = { ':isShared': true };
                    if (reportType) {
                        filterExpression += ' AND #reportType = :reportType';
                        expressionAttributeNames['#reportType'] = 'reportType';
                        expressionAttributeValues[':reportType'] = reportType;
                    }
                    if (isTemplate !== undefined) {
                        filterExpression += ' AND #isTemplate = :isTemplate';
                        expressionAttributeNames['#isTemplate'] = 'isTemplate';
                        expressionAttributeValues[':isTemplate'] = isTemplate;
                    }
                    queryParams = {
                        TableName: reportConfigsTable,
                        IndexName: 'ReportTypeIndex',
                        KeyConditionExpression: '#reportType = :reportType',
                        FilterExpression: filterExpression,
                        ExpressionAttributeNames: expressionAttributeNames,
                        ExpressionAttributeValues: expressionAttributeValues,
                    };
                    command = new lib_dynamodb_1.QueryCommand(queryParams);
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.Items || []];
            }
        });
    });
}
function deleteReportConfigFromDB(reportId) {
    return __awaiter(this, void 0, void 0, function () {
        var reportConfigsTable, command;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    reportConfigsTable = process.env.REPORT_CONFIGS_TABLE_NAME;
                    if (!reportConfigsTable) {
                        throw new Error('REPORT_CONFIGS_TABLE_NAME environment variable not set');
                    }
                    command = new lib_dynamodb_1.DeleteCommand({
                        TableName: reportConfigsTable,
                        Key: { reportId: reportId },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Utility functions
function canAccessReport(reportConfig, userId, userRole) {
    var _a;
    // Owner can always access
    if (reportConfig.userId === userId)
        return true;
    // Shared reports
    if (reportConfig.isShared) {
        // Admins can access all shared reports
        if (userRole === 'admin')
            return true;
        // Check if user is in shared list
        if ((_a = reportConfig.sharedWith) === null || _a === void 0 ? void 0 : _a.includes(userId))
            return true;
    }
    return false;
}
function canModifyReport(reportConfig, userId, userRole) {
    // Owner can always modify
    if (reportConfig.userId === userId)
        return true;
    // Admins can modify any report
    if (userRole === 'admin')
        return true;
    return false;
}
function calculateNextRun(schedule) {
    var now = new Date();
    var nextRun = new Date(now);
    // Parse time
    var _a = schedule.time.split(':').map(Number), hours = _a[0], minutes = _a[1];
    nextRun.setHours(hours, minutes, 0, 0);
    // If time has passed today, move to next occurrence
    if (nextRun <= now) {
        switch (schedule.frequency) {
            case 'daily':
                nextRun.setDate(nextRun.getDate() + 1);
                break;
            case 'weekly':
                var daysUntilNext = (7 + (schedule.dayOfWeek || 0) - nextRun.getDay()) % 7;
                nextRun.setDate(nextRun.getDate() + (daysUntilNext || 7));
                break;
            case 'monthly':
                nextRun.setMonth(nextRun.getMonth() + 1);
                nextRun.setDate(schedule.dayOfMonth || 1);
                break;
            case 'quarterly':
                nextRun.setMonth(nextRun.getMonth() + 3);
                nextRun.setDate(1);
                break;
        }
    }
    return nextRun.toISOString();
}
