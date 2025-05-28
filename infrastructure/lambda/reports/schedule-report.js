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
var client_ses_1 = require("@aws-sdk/client-ses");
var client_eventbridge_1 = require("@aws-sdk/client-eventbridge");
var crypto_1 = require("crypto");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var sesClient = new client_ses_1.SESClient({});
var eventBridgeClient = new client_eventbridge_1.EventBridgeClient({});
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, userRole, httpMethod, pathParameters, scheduleId, _a, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 13, , 14]);
                console.log('Schedule report request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                userRole = (user === null || user === void 0 ? void 0 : user.role) || 'employee';
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                httpMethod = event.httpMethod;
                pathParameters = event.pathParameters || {};
                scheduleId = pathParameters.scheduleId;
                _a = httpMethod;
                switch (_a) {
                    case 'GET': return [3 /*break*/, 1];
                    case 'POST': return [3 /*break*/, 5];
                    case 'PUT': return [3 /*break*/, 7];
                    case 'DELETE': return [3 /*break*/, 9];
                }
                return [3 /*break*/, 11];
            case 1:
                if (!scheduleId) return [3 /*break*/, 3];
                return [4 /*yield*/, getScheduledReport(scheduleId, userId, userRole)];
            case 2: return [2 /*return*/, _b.sent()];
            case 3: return [4 /*yield*/, listScheduledReports(event, userId, userRole)];
            case 4: return [2 /*return*/, _b.sent()];
            case 5: return [4 /*yield*/, createScheduledReport(event, userId, userRole)];
            case 6: return [2 /*return*/, _b.sent()];
            case 7:
                if (!scheduleId) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'MISSING_SCHEDULE_ID',
                                    message: 'Schedule ID is required for updates',
                                },
                            }),
                        }];
                }
                return [4 /*yield*/, updateScheduledReport(scheduleId, event, userId, userRole)];
            case 8: return [2 /*return*/, _b.sent()];
            case 9:
                if (!scheduleId) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'MISSING_SCHEDULE_ID',
                                    message: 'Schedule ID is required for deletion',
                                },
                            }),
                        }];
                }
                return [4 /*yield*/, deleteScheduledReport(scheduleId, userId, userRole)];
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
                console.error('Error in report scheduling:', error_1);
                return [2 /*return*/, {
                        statusCode: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify({
                            success: false,
                            error: {
                                code: 'SCHEDULE_FAILED',
                                message: 'Failed to manage report schedule',
                            },
                        }),
                    }];
            case 14: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function createScheduledReport(event, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var scheduleRequest, validFrequencies, validFormats, hasAccess, enabled, scheduledReport, ruleName, response, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    scheduleRequest = void 0;
                    try {
                        scheduleRequest = JSON.parse(event.body || '{}');
                    }
                    catch (error) {
                        return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_JSON', 'Invalid JSON in request body')];
                    }
                    // Validate required fields
                    if (!scheduleRequest.reportConfigId || !scheduleRequest.schedule || !scheduleRequest.delivery) {
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
                                        message: 'reportConfigId, schedule, and delivery are required',
                                    },
                                }),
                            }];
                    }
                    validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'custom'];
                    if (!validFrequencies.includes(scheduleRequest.schedule.frequency)) {
                        return [2 /*return*/, {
                                statusCode: 400,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                },
                                body: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'INVALID_FREQUENCY',
                                        message: "Frequency must be one of: ".concat(validFrequencies.join(', ')),
                                    },
                                }),
                            }];
                    }
                    validFormats = ['pdf', 'csv', 'excel'];
                    if (!validFormats.includes(scheduleRequest.delivery.format)) {
                        return [2 /*return*/, {
                                statusCode: 400,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                },
                                body: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'INVALID_FORMAT',
                                        message: "Format must be one of: ".concat(validFormats.join(', ')),
                                    },
                                }),
                            }];
                    }
                    return [4 /*yield*/, validateReportConfigAccess(scheduleRequest.reportConfigId, userId, userRole)];
                case 1:
                    hasAccess = _a.sent();
                    if (!hasAccess) {
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
                                        message: 'You do not have access to this report configuration',
                                    },
                                }),
                            }];
                    }
                    enabled = scheduleRequest.enabled !== false;
                    scheduledReport = {
                        scheduleId: (0, crypto_1.randomUUID)(),
                        userId: userId,
                        reportConfigId: scheduleRequest.reportConfigId,
                        schedule: scheduleRequest.schedule,
                        delivery: scheduleRequest.delivery,
                        enabled: enabled,
                        enabledStr: enabled ? 'true' : 'false', // For GSI compatibility
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        nextRun: calculateNextRun(scheduleRequest.schedule),
                        runCount: 0,
                        failureCount: 0,
                    };
                    if (!scheduledReport.enabled) return [3 /*break*/, 3];
                    return [4 /*yield*/, createEventBridgeRule(scheduledReport)];
                case 2:
                    ruleName = _a.sent();
                    scheduledReport.eventBridgeRuleName = ruleName;
                    _a.label = 3;
                case 3: 
                // Save to database
                return [4 /*yield*/, saveScheduledReport(scheduledReport)];
                case 4:
                    // Save to database
                    _a.sent();
                    response = {
                        scheduleId: scheduledReport.scheduleId,
                        status: 'created',
                        nextRun: scheduledReport.nextRun,
                        message: 'Report schedule created successfully',
                    };
                    return [2 /*return*/, {
                            statusCode: 201,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: true,
                                data: response,
                            }),
                        }];
                case 5:
                    error_2 = _a.sent();
                    console.error('Error creating scheduled report:', error_2);
                    throw error_2;
                case 6: return [2 /*return*/];
            }
        });
    });
}
function getScheduledReport(scheduleId, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var scheduledReport, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetchScheduledReport(scheduleId)];
                case 1:
                    scheduledReport = _a.sent();
                    if (!scheduledReport) {
                        return [2 /*return*/, {
                                statusCode: 404,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                },
                                body: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'SCHEDULE_NOT_FOUND',
                                        message: 'Scheduled report not found',
                                    },
                                }),
                            }];
                    }
                    // Check access permissions
                    if (!canAccessSchedule(scheduledReport, userId, userRole)) {
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
                                        message: 'You do not have permission to access this schedule',
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
                                data: scheduledReport,
                            }),
                        }];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error getting scheduled report:', error_3);
                    throw error_3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function listScheduledReports(event, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var queryParams, enabled, limit, scheduledReports, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    queryParams = event.queryStringParameters || {};
                    enabled = queryParams.enabled === 'true' ? true : queryParams.enabled === 'false' ? false : undefined;
                    limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
                    return [4 /*yield*/, fetchUserScheduledReports(userId, enabled, limit)];
                case 1:
                    scheduledReports = _a.sent();
                    return [2 /*return*/, {
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: true,
                                data: {
                                    schedules: scheduledReports,
                                    totalCount: scheduledReports.length,
                                },
                            }),
                        }];
                case 2:
                    error_4 = _a.sent();
                    console.error('Error listing scheduled reports:', error_4);
                    throw error_4;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function updateScheduledReport(scheduleId, event, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var existingSchedule, updateData, enabled, updatedSchedule, ruleName, response, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 7, , 8]);
                    return [4 /*yield*/, fetchScheduledReport(scheduleId)];
                case 1:
                    existingSchedule = _a.sent();
                    if (!existingSchedule) {
                        return [2 /*return*/, {
                                statusCode: 404,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                },
                                body: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'SCHEDULE_NOT_FOUND',
                                        message: 'Scheduled report not found',
                                    },
                                }),
                            }];
                    }
                    // Check permissions
                    if (!canModifySchedule(existingSchedule, userId, userRole)) {
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
                                        message: 'You do not have permission to modify this schedule',
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
                    enabled = updateData.enabled !== undefined ? updateData.enabled : existingSchedule.enabled;
                    updatedSchedule = __assign(__assign({}, existingSchedule), { schedule: updateData.schedule || existingSchedule.schedule, delivery: updateData.delivery || existingSchedule.delivery, enabled: enabled, enabledStr: enabled ? 'true' : 'false', updatedAt: new Date().toISOString() });
                    // Recalculate next run if schedule changed
                    if (updateData.schedule) {
                        updatedSchedule.nextRun = calculateNextRun(updatedSchedule.schedule);
                    }
                    if (!existingSchedule.eventBridgeRuleName) return [3 /*break*/, 3];
                    return [4 /*yield*/, deleteEventBridgeRule(existingSchedule.eventBridgeRuleName)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    if (!updatedSchedule.enabled) return [3 /*break*/, 5];
                    return [4 /*yield*/, createEventBridgeRule(updatedSchedule)];
                case 4:
                    ruleName = _a.sent();
                    updatedSchedule.eventBridgeRuleName = ruleName;
                    _a.label = 5;
                case 5: 
                // Save updated schedule
                return [4 /*yield*/, saveScheduledReport(updatedSchedule)];
                case 6:
                    // Save updated schedule
                    _a.sent();
                    response = {
                        scheduleId: updatedSchedule.scheduleId,
                        status: 'updated',
                        nextRun: updatedSchedule.nextRun,
                        message: 'Report schedule updated successfully',
                    };
                    return [2 /*return*/, {
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: true,
                                data: response,
                            }),
                        }];
                case 7:
                    error_5 = _a.sent();
                    console.error('Error updating scheduled report:', error_5);
                    throw error_5;
                case 8: return [2 /*return*/];
            }
        });
    });
}
function deleteScheduledReport(scheduleId, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        var existingSchedule, response, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, fetchScheduledReport(scheduleId)];
                case 1:
                    existingSchedule = _a.sent();
                    if (!existingSchedule) {
                        return [2 /*return*/, {
                                statusCode: 404,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                },
                                body: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'SCHEDULE_NOT_FOUND',
                                        message: 'Scheduled report not found',
                                    },
                                }),
                            }];
                    }
                    // Check permissions
                    if (!canModifySchedule(existingSchedule, userId, userRole)) {
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
                                        message: 'You do not have permission to delete this schedule',
                                    },
                                }),
                            }];
                    }
                    if (!existingSchedule.eventBridgeRuleName) return [3 /*break*/, 3];
                    return [4 /*yield*/, deleteEventBridgeRule(existingSchedule.eventBridgeRuleName)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: 
                // Delete from database
                return [4 /*yield*/, deleteScheduledReportFromDB(scheduleId)];
                case 4:
                    // Delete from database
                    _a.sent();
                    response = {
                        scheduleId: scheduleId,
                        status: 'deleted',
                        nextRun: '',
                        message: 'Report schedule deleted successfully',
                    };
                    return [2 /*return*/, {
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: true,
                                data: response,
                            }),
                        }];
                case 5:
                    error_6 = _a.sent();
                    console.error('Error deleting scheduled report:', error_6);
                    throw error_6;
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Database operations
function saveScheduledReport(scheduledReport) {
    return __awaiter(this, void 0, void 0, function () {
        var schedulesTable, command;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    schedulesTable = process.env.SCHEDULED_REPORTS_TABLE_NAME;
                    if (!schedulesTable) {
                        throw new Error('SCHEDULED_REPORTS_TABLE_NAME environment variable not set');
                    }
                    command = new lib_dynamodb_1.PutCommand({
                        TableName: schedulesTable,
                        Item: scheduledReport,
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function fetchScheduledReport(scheduleId) {
    return __awaiter(this, void 0, void 0, function () {
        var schedulesTable, command, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    schedulesTable = process.env.SCHEDULED_REPORTS_TABLE_NAME;
                    if (!schedulesTable) {
                        throw new Error('SCHEDULED_REPORTS_TABLE_NAME environment variable not set');
                    }
                    command = new lib_dynamodb_1.GetCommand({
                        TableName: schedulesTable,
                        Key: { scheduleId: scheduleId },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.Item || null];
            }
        });
    });
}
function fetchUserScheduledReports(userId, enabled, limit) {
    return __awaiter(this, void 0, void 0, function () {
        var schedulesTable, filterExpression, expressionAttributeNames, expressionAttributeValues, queryParams, command, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    schedulesTable = process.env.SCHEDULED_REPORTS_TABLE_NAME;
                    if (!schedulesTable) {
                        throw new Error('SCHEDULED_REPORTS_TABLE_NAME environment variable not set');
                    }
                    filterExpression = '';
                    expressionAttributeNames = {};
                    expressionAttributeValues = {};
                    if (enabled !== undefined) {
                        filterExpression = '#enabled = :enabled';
                        expressionAttributeNames['#enabled'] = 'enabled';
                        expressionAttributeValues[':enabled'] = enabled;
                    }
                    queryParams = {
                        TableName: schedulesTable,
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
function deleteScheduledReportFromDB(scheduleId) {
    return __awaiter(this, void 0, void 0, function () {
        var schedulesTable, command;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    schedulesTable = process.env.SCHEDULED_REPORTS_TABLE_NAME;
                    if (!schedulesTable) {
                        throw new Error('SCHEDULED_REPORTS_TABLE_NAME environment variable not set');
                    }
                    command = new lib_dynamodb_1.DeleteCommand({
                        TableName: schedulesTable,
                        Key: { scheduleId: scheduleId },
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// EventBridge operations
function createEventBridgeRule(scheduledReport) {
    return __awaiter(this, void 0, void 0, function () {
        var ruleName, scheduleExpression, putRuleCommand, putTargetsCommand, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ruleName = "aerotage-report-".concat(scheduledReport.scheduleId);
                    scheduleExpression = generateScheduleExpression(scheduledReport.schedule);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    putRuleCommand = new client_eventbridge_1.PutRuleCommand({
                        Name: ruleName,
                        Description: "Scheduled report for ".concat(scheduledReport.reportConfigId),
                        ScheduleExpression: scheduleExpression,
                        State: 'ENABLED',
                    });
                    return [4 /*yield*/, eventBridgeClient.send(putRuleCommand)];
                case 2:
                    _a.sent();
                    putTargetsCommand = new client_eventbridge_1.PutTargetsCommand({
                        Rule: ruleName,
                        Targets: [
                            {
                                Id: '1',
                                Arn: "arn:aws:lambda:".concat(process.env.AWS_REGION, ":").concat(process.env.AWS_ACCOUNT_ID, ":function:aerotage-schedulereport-").concat(process.env.STAGE),
                                Input: JSON.stringify({
                                    scheduleId: scheduledReport.scheduleId,
                                    reportConfigId: scheduledReport.reportConfigId,
                                    action: 'execute',
                                }),
                            },
                        ],
                    });
                    return [4 /*yield*/, eventBridgeClient.send(putTargetsCommand)];
                case 3:
                    _a.sent();
                    console.log("Created EventBridge rule: ".concat(ruleName, " with schedule: ").concat(scheduleExpression));
                    return [2 /*return*/, ruleName];
                case 4:
                    error_7 = _a.sent();
                    console.error('Error creating EventBridge rule:', error_7);
                    throw new Error("Failed to create EventBridge rule: ".concat(error_7));
                case 5: return [2 /*return*/];
            }
        });
    });
}
function deleteEventBridgeRule(ruleName) {
    return __awaiter(this, void 0, void 0, function () {
        var removeTargetsCommand, deleteRuleCommand, error_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    removeTargetsCommand = new client_eventbridge_1.RemoveTargetsCommand({
                        Rule: ruleName,
                        Ids: ['1'],
                    });
                    return [4 /*yield*/, eventBridgeClient.send(removeTargetsCommand)];
                case 1:
                    _a.sent();
                    deleteRuleCommand = new client_eventbridge_1.DeleteRuleCommand({
                        Name: ruleName,
                    });
                    return [4 /*yield*/, eventBridgeClient.send(deleteRuleCommand)];
                case 2:
                    _a.sent();
                    console.log("Deleted EventBridge rule: ".concat(ruleName));
                    return [3 /*break*/, 4];
                case 3:
                    error_8 = _a.sent();
                    console.error('Error deleting EventBridge rule:', error_8);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Utility functions
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
function generateScheduleExpression(schedule) {
    if (schedule.customCron) {
        return "cron(".concat(schedule.customCron, ")");
    }
    var _a = schedule.time.split(':').map(Number), hours = _a[0], minutes = _a[1];
    switch (schedule.frequency) {
        case 'daily':
            return "cron(".concat(minutes, " ").concat(hours, " * * ? *)");
        case 'weekly':
            var dayOfWeek = schedule.dayOfWeek || 0;
            return "cron(".concat(minutes, " ").concat(hours, " ? * ").concat(dayOfWeek === 0 ? 'SUN' : dayOfWeek, " *)");
        case 'monthly':
            var dayOfMonth = schedule.dayOfMonth || 1;
            return "cron(".concat(minutes, " ").concat(hours, " ").concat(dayOfMonth, " * ? *)");
        case 'quarterly':
            return "cron(".concat(minutes, " ").concat(hours, " 1 */3 ? *)");
        default:
            return "cron(".concat(minutes, " ").concat(hours, " * * ? *)");
    }
}
function validateReportConfigAccess(reportConfigId, userId, userRole) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // In production, check if user has access to the report config
            // For now, return true for all users
            return [2 /*return*/, true];
        });
    });
}
function canAccessSchedule(schedule, userId, userRole) {
    // Owner can always access
    if (schedule.userId === userId)
        return true;
    // Admins can access all schedules
    if (userRole === 'admin')
        return true;
    return false;
}
function canModifySchedule(schedule, userId, userRole) {
    // Owner can always modify
    if (schedule.userId === userId)
        return true;
    // Admins can modify any schedule
    if (userRole === 'admin')
        return true;
    return false;
}
