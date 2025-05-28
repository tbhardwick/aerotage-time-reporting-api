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
var types_1 = require("../shared/types");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var TIME_ENTRIES_TABLE = process.env.TIME_ENTRIES_TABLE;
var USER_WORK_SCHEDULES_TABLE = process.env.USER_WORK_SCHEDULES_TABLE;
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, queryParams, dateRegex, weekStart, today, request, weeklyOverview, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log('Weekly overview request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User not authenticated')];
                }
                queryParams = event.queryStringParameters || {};
                // Validate required parameters
                if (!queryParams.weekStartDate) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.INVALID_DATE_RANGE, 'weekStartDate is required')];
                }
                dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(queryParams.weekStartDate)) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.INVALID_DATE_RANGE, 'weekStartDate must be in YYYY-MM-DD format')];
                }
                weekStart = new Date(queryParams.weekStartDate);
                if (weekStart.getDay() !== 1) { // 1 = Monday
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.INVALID_DATE_RANGE, 'weekStartDate must be a Monday')];
                }
                today = new Date();
                today.setHours(0, 0, 0, 0);
                if (weekStart > today) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.FUTURE_DATE_NOT_ALLOWED, 'Cannot analyze future weeks')];
                }
                request = {
                    weekStartDate: queryParams.weekStartDate,
                    userId: queryParams.userId || userId,
                    includeComparison: queryParams.includeComparison === 'true',
                };
                // Check permissions - employees can only see their own data
                if ((user === null || user === void 0 ? void 0 : user.role) === 'employee' && request.userId !== userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(403, 'FORBIDDEN', 'Employees can only view their own time data')];
                }
                return [4 /*yield*/, generateWeeklyOverview(request)];
            case 1:
                weeklyOverview = _a.sent();
                response = {
                    success: true,
                    data: weeklyOverview,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 2:
                error_1 = _a.sent();
                console.error('Error generating weekly overview:', error_1);
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred')];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function generateWeeklyOverview(request) {
    return __awaiter(this, void 0, void 0, function () {
        var weekStart, weekEnd, weekInfo, workSchedule, dailySummaries, weeklyTotals, patterns, projectDistribution, comparison;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    weekStart = new Date(request.weekStartDate);
                    weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 4); // Friday (5 work days)
                    weekInfo = {
                        weekStartDate: request.weekStartDate,
                        weekEndDate: weekEnd.toISOString().split('T')[0],
                        weekNumber: getWeekNumber(weekStart),
                        year: weekStart.getFullYear(),
                    };
                    return [4 /*yield*/, getUserWorkSchedule(request.userId)];
                case 1:
                    workSchedule = _a.sent();
                    return [4 /*yield*/, getDailySummariesForWeek(request.userId, weekStart, weekEnd, workSchedule)];
                case 2:
                    dailySummaries = _a.sent();
                    weeklyTotals = calculateWeeklyTotals(dailySummaries);
                    patterns = calculateWeeklyPatterns(dailySummaries);
                    return [4 /*yield*/, calculateWeeklyProjectDistribution(request.userId, weekStart, weekEnd)];
                case 3:
                    projectDistribution = _a.sent();
                    if (!request.includeComparison) return [3 /*break*/, 5];
                    return [4 /*yield*/, getWeeklyComparison(request.userId, weekStart)];
                case 4:
                    comparison = _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/, {
                        weekInfo: weekInfo,
                        dailySummaries: dailySummaries,
                        weeklyTotals: weeklyTotals,
                        patterns: patterns,
                        projectDistribution: projectDistribution,
                        comparison: comparison,
                    }];
            }
        });
    });
}
function getUserWorkSchedule(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, docClient.send(new lib_dynamodb_1.GetCommand({
                            TableName: USER_WORK_SCHEDULES_TABLE,
                            Key: {
                                PK: "USER#".concat(userId),
                                SK: 'WORK_SCHEDULE',
                            },
                        }))];
                case 1:
                    result = _a.sent();
                    if (!result.Item) {
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, {
                            userId: result.Item.userId,
                            schedule: JSON.parse(result.Item.schedule),
                            timezone: result.Item.timezone,
                            weeklyTargetHours: result.Item.weeklyTargetHours,
                            createdAt: result.Item.createdAt,
                            updatedAt: result.Item.updatedAt,
                        }];
                case 2:
                    error_2 = _a.sent();
                    console.error('Error fetching work schedule:', error_2);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getDailySummariesForWeek(userId, weekStart, weekEnd, workSchedule) {
    return __awaiter(this, void 0, void 0, function () {
        var summaries, date, dateStr, dayOfWeek, timeEntries, daySchedule, targetHours, summary;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    summaries = [];
                    date = new Date(weekStart);
                    _a.label = 1;
                case 1:
                    if (!(date <= weekEnd)) return [3 /*break*/, 4];
                    dateStr = date.toISOString().split('T')[0];
                    dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                    return [4 /*yield*/, getTimeEntriesForDate(userId, dateStr)];
                case 2:
                    timeEntries = _a.sent();
                    daySchedule = workSchedule === null || workSchedule === void 0 ? void 0 : workSchedule.schedule[dayOfWeek];
                    targetHours = (daySchedule === null || daySchedule === void 0 ? void 0 : daySchedule.targetHours) || 8;
                    summary = calculateBasicDailySummary(dateStr, dayOfWeek, timeEntries, targetHours);
                    summaries.push(summary);
                    _a.label = 3;
                case 3:
                    date.setDate(date.getDate() + 1);
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, summaries];
            }
        });
    });
}
function getTimeEntriesForDate(userId, date) {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, docClient.send(new lib_dynamodb_1.QueryCommand({
                            TableName: TIME_ENTRIES_TABLE,
                            IndexName: 'UserIndex',
                            KeyConditionExpression: 'GSI1PK = :userPK AND begins_with(GSI1SK, :datePrefix)',
                            ExpressionAttributeValues: {
                                ':userPK': "USER#".concat(userId),
                                ':datePrefix': "DATE#".concat(date),
                            },
                        }))];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, (result.Items || []).map(function (item) { return ({
                            id: item.id,
                            userId: item.userId,
                            projectId: item.projectId,
                            taskId: item.taskId,
                            description: item.description,
                            date: item.date,
                            startTime: item.startTime,
                            endTime: item.endTime,
                            duration: item.duration,
                            isBillable: item.isBillable,
                            hourlyRate: item.hourlyRate,
                            status: item.status,
                            tags: JSON.parse(item.tags || '[]'),
                            notes: item.notes,
                            attachments: JSON.parse(item.attachments || '[]'),
                            submittedAt: item.submittedAt,
                            approvedAt: item.approvedAt,
                            rejectedAt: item.rejectedAt,
                            approvedBy: item.approvedBy,
                            rejectionReason: item.rejectionReason,
                            isTimerEntry: item.isTimerEntry,
                            timerStartedAt: item.timerStartedAt,
                            createdAt: item.createdAt,
                            updatedAt: item.updatedAt,
                        }); })];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error fetching time entries:', error_3);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function calculateBasicDailySummary(date, dayOfWeek, timeEntries, targetHours) {
    var totalMinutes = timeEntries.reduce(function (sum, entry) { return sum + entry.duration; }, 0);
    var billableMinutes = timeEntries.filter(function (entry) { return entry.isBillable; }).reduce(function (sum, entry) { return sum + entry.duration; }, 0);
    var nonBillableMinutes = totalMinutes - billableMinutes;
    var targetMinutes = targetHours * 60;
    var completionPercentage = targetMinutes > 0 ? (totalMinutes / targetMinutes) * 100 : 0;
    return {
        date: date,
        dayOfWeek: dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1),
        totalMinutes: totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
        billableMinutes: billableMinutes,
        billableHours: Math.round((billableMinutes / 60) * 100) / 100,
        nonBillableMinutes: nonBillableMinutes,
        nonBillableHours: Math.round((nonBillableMinutes / 60) * 100) / 100,
        targetMinutes: targetMinutes,
        targetHours: targetHours,
        completionPercentage: Math.round(completionPercentage * 100) / 100,
        entriesCount: timeEntries.length,
        projectBreakdown: [], // Simplified for weekly overview
        timeGaps: [], // Not included in weekly overview for performance
        workingHours: {
            firstEntry: null,
            lastEntry: null,
            totalSpan: null,
        },
    };
}
function calculateWeeklyTotals(dailySummaries) {
    var totalHours = dailySummaries.reduce(function (sum, day) { return sum + day.totalHours; }, 0);
    var billableHours = dailySummaries.reduce(function (sum, day) { return sum + day.billableHours; }, 0);
    var nonBillableHours = dailySummaries.reduce(function (sum, day) { return sum + day.nonBillableHours; }, 0);
    var targetHours = dailySummaries.reduce(function (sum, day) { return sum + day.targetHours; }, 0);
    var totalEntries = dailySummaries.reduce(function (sum, day) { return sum + day.entriesCount; }, 0);
    return {
        totalHours: Math.round(totalHours * 100) / 100,
        billableHours: Math.round(billableHours * 100) / 100,
        nonBillableHours: Math.round(nonBillableHours * 100) / 100,
        targetHours: Math.round(targetHours * 100) / 100,
        completionPercentage: targetHours > 0 ? Math.round((totalHours / targetHours) * 10000) / 100 : 0,
        totalEntries: totalEntries,
    };
}
function calculateWeeklyPatterns(dailySummaries) {
    // Find most and least productive days
    var workDays = dailySummaries.filter(function (day) { return day.totalHours > 0; });
    var mostProductiveDay = 'Monday';
    var leastProductiveDay = 'Monday';
    var maxHours = 0;
    var minHours = Infinity;
    workDays.forEach(function (day) {
        if (day.totalHours > maxHours) {
            maxHours = day.totalHours;
            mostProductiveDay = day.dayOfWeek;
        }
        if (day.totalHours < minHours) {
            minHours = day.totalHours;
            leastProductiveDay = day.dayOfWeek;
        }
    });
    // Calculate average start/end times (simplified)
    var averageStartTime = '08:30'; // TODO: Calculate from actual data
    var averageEndTime = '17:30'; // TODO: Calculate from actual data
    return {
        mostProductiveDay: mostProductiveDay,
        leastProductiveDay: leastProductiveDay,
        averageStartTime: averageStartTime,
        averageEndTime: averageEndTime,
        longestWorkDay: mostProductiveDay,
        shortestWorkDay: leastProductiveDay,
    };
}
function calculateWeeklyProjectDistribution(userId, weekStart, weekEnd) {
    return __awaiter(this, void 0, void 0, function () {
        var allEntries, date, dateStr, entries, projectMap, totalMinutes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    allEntries = [];
                    date = new Date(weekStart);
                    _a.label = 1;
                case 1:
                    if (!(date <= weekEnd)) return [3 /*break*/, 4];
                    dateStr = date.toISOString().split('T')[0];
                    return [4 /*yield*/, getTimeEntriesForDate(userId, dateStr)];
                case 2:
                    entries = _a.sent();
                    allEntries.push.apply(allEntries, entries);
                    _a.label = 3;
                case 3:
                    date.setDate(date.getDate() + 1);
                    return [3 /*break*/, 1];
                case 4:
                    projectMap = new Map();
                    allEntries.forEach(function (entry) {
                        var existing = projectMap.get(entry.projectId);
                        if (existing) {
                            existing.totalMinutes += entry.duration;
                            var dayMinutes = existing.dailyBreakdown.get(entry.date) || 0;
                            existing.dailyBreakdown.set(entry.date, dayMinutes + entry.duration);
                        }
                        else {
                            var dailyBreakdown = new Map();
                            dailyBreakdown.set(entry.date, entry.duration);
                            projectMap.set(entry.projectId, {
                                totalMinutes: entry.duration,
                                projectName: "Project ".concat(entry.projectId), // TODO: Fetch actual project name
                                clientName: 'Client Name', // TODO: Fetch actual client name
                                dailyBreakdown: dailyBreakdown,
                            });
                        }
                    });
                    totalMinutes = allEntries.reduce(function (sum, entry) { return sum + entry.duration; }, 0);
                    return [2 /*return*/, Array.from(projectMap.entries()).map(function (_a) {
                            var projectId = _a[0], data = _a[1];
                            return ({
                                projectId: projectId,
                                projectName: data.projectName,
                                clientName: data.clientName,
                                totalHours: Math.round((data.totalMinutes / 60) * 100) / 100,
                                percentage: totalMinutes > 0 ? Math.round((data.totalMinutes / totalMinutes) * 10000) / 100 : 0,
                                dailyBreakdown: Array.from(data.dailyBreakdown.entries()).map(function (_a) {
                                    var date = _a[0], minutes = _a[1];
                                    return ({
                                        date: date,
                                        hours: Math.round((minutes / 60) * 100) / 100,
                                    });
                                }),
                            });
                        })];
            }
        });
    });
}
function getWeeklyComparison(userId, currentWeekStart) {
    return __awaiter(this, void 0, void 0, function () {
        var previousWeekStart, previousWeekEnd, previousWeekEntries, date, dateStr, entries, previousWeekHours;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    previousWeekStart = new Date(currentWeekStart);
                    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
                    previousWeekEnd = new Date(previousWeekStart);
                    previousWeekEnd.setDate(previousWeekEnd.getDate() + 4);
                    previousWeekEntries = [];
                    date = new Date(previousWeekStart);
                    _a.label = 1;
                case 1:
                    if (!(date <= previousWeekEnd)) return [3 /*break*/, 4];
                    dateStr = date.toISOString().split('T')[0];
                    return [4 /*yield*/, getTimeEntriesForDate(userId, dateStr)];
                case 2:
                    entries = _a.sent();
                    previousWeekEntries.push.apply(previousWeekEntries, entries);
                    _a.label = 3;
                case 3:
                    date.setDate(date.getDate() + 1);
                    return [3 /*break*/, 1];
                case 4:
                    previousWeekHours = previousWeekEntries.reduce(function (sum, entry) { return sum + entry.duration; }, 0) / 60;
                    // This would be compared with current week in the calling function
                    return [2 /*return*/, {
                            previousWeek: {
                                totalHours: Math.round(previousWeekHours * 100) / 100,
                                change: '+0.0', // Will be calculated by caller
                                changePercentage: '+0.0%', // Will be calculated by caller
                            },
                        }];
            }
        });
    });
}
function getWeekNumber(date) {
    var firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    var pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
