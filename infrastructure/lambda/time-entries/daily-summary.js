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
var PROJECTS_TABLE = process.env.PROJECTS_TABLE;
var CLIENTS_TABLE = process.env.CLIENTS_TABLE;
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, queryParams, dateRegex, startDate, endDate, daysDiff, today, request, workSchedule, summaries, periodSummary, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                console.log('Daily summary request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User not authenticated')];
                }
                queryParams = event.queryStringParameters || {};
                // Validate required parameters
                if (!queryParams.startDate || !queryParams.endDate) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.INVALID_DATE_RANGE, 'startDate and endDate are required')];
                }
                dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(queryParams.startDate) || !dateRegex.test(queryParams.endDate)) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.INVALID_DATE_RANGE, 'Dates must be in YYYY-MM-DD format')];
                }
                startDate = new Date(queryParams.startDate);
                endDate = new Date(queryParams.endDate);
                daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysDiff > 31) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.DATE_RANGE_TOO_LARGE, 'Date range cannot exceed 31 days')];
                }
                if (endDate < startDate) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.INVALID_DATE_RANGE, 'End date must be after start date')];
                }
                today = new Date();
                today.setHours(0, 0, 0, 0);
                if (endDate > today) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.FUTURE_DATE_NOT_ALLOWED, 'Cannot analyze future dates')];
                }
                request = {
                    startDate: queryParams.startDate,
                    endDate: queryParams.endDate,
                    userId: queryParams.userId || userId,
                    includeGaps: queryParams.includeGaps !== 'false',
                    targetHours: queryParams.targetHours ? parseFloat(queryParams.targetHours) : undefined,
                };
                // Check permissions - employees can only see their own data
                if ((user === null || user === void 0 ? void 0 : user.role) === 'employee' && request.userId !== userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(403, 'FORBIDDEN', 'Employees can only view their own time data')];
                }
                return [4 /*yield*/, getUserWorkSchedule(request.userId)];
            case 1:
                workSchedule = _a.sent();
                return [4 /*yield*/, generateDailySummaries(request, workSchedule)];
            case 2:
                summaries = _a.sent();
                periodSummary = calculatePeriodSummary(summaries, workSchedule);
                response = {
                    success: true,
                    data: {
                        summaries: summaries,
                        periodSummary: periodSummary,
                    },
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _a.sent();
                console.error('Error generating daily summary:', error_1);
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred')];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
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
function generateDailySummaries(request, workSchedule) {
    return __awaiter(this, void 0, void 0, function () {
        var summaries, startDate, endDate, date, dateStr, dayOfWeek, timeEntries, daySchedule, targetHours, summary;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    summaries = [];
                    startDate = new Date(request.startDate);
                    endDate = new Date(request.endDate);
                    date = new Date(startDate);
                    _a.label = 1;
                case 1:
                    if (!(date <= endDate)) return [3 /*break*/, 5];
                    dateStr = date.toISOString().split('T')[0];
                    dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                    return [4 /*yield*/, getTimeEntriesForDate(request.userId, dateStr)];
                case 2:
                    timeEntries = _a.sent();
                    daySchedule = workSchedule === null || workSchedule === void 0 ? void 0 : workSchedule.schedule[dayOfWeek];
                    targetHours = request.targetHours || (daySchedule === null || daySchedule === void 0 ? void 0 : daySchedule.targetHours) || 8;
                    return [4 /*yield*/, calculateDailySummary(dateStr, dayOfWeek, timeEntries, targetHours, daySchedule, request.includeGaps || false)];
                case 3:
                    summary = _a.sent();
                    summaries.push(summary);
                    _a.label = 4;
                case 4:
                    date.setDate(date.getDate() + 1);
                    return [3 /*break*/, 1];
                case 5: return [2 /*return*/, summaries];
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
function calculateDailySummary(date, dayOfWeek, timeEntries, targetHours, daySchedule, includeGaps) {
    return __awaiter(this, void 0, void 0, function () {
        var totalMinutes, billableMinutes, nonBillableMinutes, targetMinutes, completionPercentage, projectBreakdown, workingHours, timeGaps;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    totalMinutes = timeEntries.reduce(function (sum, entry) { return sum + entry.duration; }, 0);
                    billableMinutes = timeEntries.filter(function (entry) { return entry.isBillable; }).reduce(function (sum, entry) { return sum + entry.duration; }, 0);
                    nonBillableMinutes = totalMinutes - billableMinutes;
                    targetMinutes = targetHours * 60;
                    completionPercentage = targetMinutes > 0 ? (totalMinutes / targetMinutes) * 100 : 0;
                    return [4 /*yield*/, calculateProjectBreakdown(timeEntries)];
                case 1:
                    projectBreakdown = _a.sent();
                    workingHours = calculateWorkingHours(timeEntries);
                    timeGaps = includeGaps ? calculateTimeGaps(timeEntries, daySchedule) : [];
                    return [2 /*return*/, {
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
                            projectBreakdown: projectBreakdown,
                            timeGaps: timeGaps,
                            workingHours: workingHours,
                        }];
            }
        });
    });
}
function calculateProjectBreakdown(timeEntries) {
    return __awaiter(this, void 0, void 0, function () {
        var projectMap, _i, timeEntries_1, entry, existing, totalMinutes;
        return __generator(this, function (_a) {
            projectMap = new Map();
            // Group by project
            for (_i = 0, timeEntries_1 = timeEntries; _i < timeEntries_1.length; _i++) {
                entry = timeEntries_1[_i];
                existing = projectMap.get(entry.projectId);
                if (existing) {
                    existing.minutes += entry.duration;
                }
                else {
                    // Get project and client names (simplified for now)
                    projectMap.set(entry.projectId, {
                        minutes: entry.duration,
                        projectName: "Project ".concat(entry.projectId), // TODO: Fetch actual project name
                        clientName: 'Client Name', // TODO: Fetch actual client name
                    });
                }
            }
            totalMinutes = timeEntries.reduce(function (sum, entry) { return sum + entry.duration; }, 0);
            return [2 /*return*/, Array.from(projectMap.entries()).map(function (_a) {
                    var projectId = _a[0], data = _a[1];
                    return ({
                        projectId: projectId,
                        projectName: data.projectName,
                        clientName: data.clientName,
                        minutes: data.minutes,
                        hours: Math.round((data.minutes / 60) * 100) / 100,
                        percentage: totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 10000) / 100 : 0,
                    });
                })];
        });
    });
}
function calculateWorkingHours(timeEntries) {
    var _a;
    if (timeEntries.length === 0) {
        return { firstEntry: null, lastEntry: null, totalSpan: null };
    }
    // Sort entries by start time
    var sortedEntries = timeEntries
        .filter(function (entry) { return entry.startTime; })
        .sort(function (a, b) { return a.startTime.localeCompare(b.startTime); });
    if (sortedEntries.length === 0) {
        return { firstEntry: null, lastEntry: null, totalSpan: null };
    }
    var firstEntry = sortedEntries[0].startTime.substring(11, 16); // Extract HH:MM
    var lastEntry = ((_a = sortedEntries[sortedEntries.length - 1].endTime) === null || _a === void 0 ? void 0 : _a.substring(11, 16)) || firstEntry;
    // Calculate span
    var firstTime = new Date("2000-01-01T".concat(firstEntry, ":00"));
    var lastTime = new Date("2000-01-01T".concat(lastEntry, ":00"));
    var spanMinutes = (lastTime.getTime() - firstTime.getTime()) / (1000 * 60);
    var spanHours = Math.floor(spanMinutes / 60);
    var spanMins = spanMinutes % 60;
    var totalSpan = "".concat(spanHours, "h ").concat(spanMins, "m");
    return { firstEntry: firstEntry, lastEntry: lastEntry, totalSpan: totalSpan };
}
function calculateTimeGaps(timeEntries, daySchedule) {
    // Simplified gap calculation - would need more sophisticated logic
    // This is a basic implementation
    var gaps = [];
    if (!daySchedule || !daySchedule.start || !daySchedule.end) {
        return gaps;
    }
    // Sort entries by start time
    var sortedEntries = timeEntries
        .filter(function (entry) { return entry.startTime && entry.endTime; })
        .sort(function (a, b) { return a.startTime.localeCompare(b.startTime); });
    // Find gaps between entries
    for (var i = 0; i < sortedEntries.length - 1; i++) {
        var currentEnd = sortedEntries[i].endTime.substring(11, 16);
        var nextStart = sortedEntries[i + 1].startTime.substring(11, 16);
        var currentEndTime = new Date("2000-01-01T".concat(currentEnd, ":00"));
        var nextStartTime = new Date("2000-01-01T".concat(nextStart, ":00"));
        var gapMinutes = (nextStartTime.getTime() - currentEndTime.getTime()) / (1000 * 60);
        if (gapMinutes >= 15) { // Only report gaps of 15+ minutes
            gaps.push({
                startTime: currentEnd,
                endTime: nextStart,
                durationMinutes: gapMinutes,
                suggestedAction: gapMinutes <= 60 ? 'break' : 'untracked',
            });
        }
    }
    return gaps;
}
function calculatePeriodSummary(summaries, workSchedule) {
    var totalDays = summaries.length;
    var workDays = summaries.filter(function (s) { return s.targetHours > 0; }).length;
    var totalHours = summaries.reduce(function (sum, s) { return sum + s.totalHours; }, 0);
    var targetHours = summaries.reduce(function (sum, s) { return sum + s.targetHours; }, 0);
    return {
        totalDays: totalDays,
        workDays: workDays,
        totalHours: Math.round(totalHours * 100) / 100,
        averageHoursPerDay: workDays > 0 ? Math.round((totalHours / workDays) * 100) / 100 : 0,
        targetHours: Math.round(targetHours * 100) / 100,
        completionPercentage: targetHours > 0 ? Math.round((totalHours / targetHours) * 10000) / 100 : 0,
    };
}
