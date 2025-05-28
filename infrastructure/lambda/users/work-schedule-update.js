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
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var types_1 = require("../shared/types");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var USER_WORK_SCHEDULES_TABLE = process.env.USER_WORK_SCHEDULES_TABLE;
// Valid timezones (simplified list)
var VALID_TIMEZONES = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
];
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, targetUserId, updateRequest, validationError, existingSchedule, updatedSchedule, response, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                console.log('Update work schedule request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User not authenticated')];
                }
                targetUserId = ((_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.userId) || userId;
                // Check permissions - employees can only update their own schedule
                if ((user === null || user === void 0 ? void 0 : user.role) === 'employee' && targetUserId !== userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(403, 'FORBIDDEN', 'Employees can only update their own work schedule')];
                }
                // Parse request body
                if (!event.body) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.INVALID_WORK_SCHEDULE, 'Request body is required')];
                }
                updateRequest = void 0;
                try {
                    updateRequest = JSON.parse(event.body);
                }
                catch (error) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.INVALID_WORK_SCHEDULE, 'Invalid JSON in request body')];
                }
                validationError = validateUpdateRequest(updateRequest);
                if (validationError) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.INVALID_WORK_SCHEDULE, validationError)];
                }
                return [4 /*yield*/, getUserWorkSchedule(targetUserId)];
            case 1:
                existingSchedule = _b.sent();
                if (!existingSchedule) {
                    existingSchedule = createDefaultWorkSchedule(targetUserId);
                }
                updatedSchedule = applyUpdates(existingSchedule, updateRequest);
                // Save updated schedule
                return [4 /*yield*/, saveWorkSchedule(updatedSchedule)];
            case 2:
                // Save updated schedule
                _b.sent();
                response = {
                    success: true,
                    data: updatedSchedule,
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
                error_1 = _b.sent();
                console.error('Error updating work schedule:', error_1);
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
function createDefaultWorkSchedule(userId) {
    var defaultWorkDay = {
        start: '09:00',
        end: '17:00',
        targetHours: 8,
    };
    var defaultWeekend = {
        start: null,
        end: null,
        targetHours: 0,
    };
    var now = new Date().toISOString();
    return {
        userId: userId,
        schedule: {
            monday: defaultWorkDay,
            tuesday: defaultWorkDay,
            wednesday: defaultWorkDay,
            thursday: defaultWorkDay,
            friday: defaultWorkDay,
            saturday: defaultWeekend,
            sunday: defaultWeekend,
        },
        timezone: 'America/New_York',
        weeklyTargetHours: 40,
        createdAt: now,
        updatedAt: now,
    };
}
function validateUpdateRequest(request) {
    // Validate timezone if provided
    if (request.timezone && !VALID_TIMEZONES.includes(request.timezone)) {
        return "Invalid timezone. Must be one of: ".concat(VALID_TIMEZONES.join(', '));
    }
    // Validate schedule if provided
    if (request.schedule) {
        for (var _i = 0, _a = Object.entries(request.schedule); _i < _a.length; _i++) {
            var _b = _a[_i], day = _b[0], daySchedule = _b[1];
            var validationError = validateDaySchedule(day, daySchedule);
            if (validationError) {
                return validationError;
            }
        }
    }
    return null;
}
function validateDaySchedule(day, daySchedule) {
    var validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(day)) {
        return "Invalid day: ".concat(day);
    }
    // Validate target hours
    if (daySchedule.targetHours < 0 || daySchedule.targetHours > 24) {
        return "Invalid target hours for ".concat(day, ": must be between 0 and 24");
    }
    // If it's a working day (targetHours > 0), validate start and end times
    if (daySchedule.targetHours > 0) {
        if (!daySchedule.start || !daySchedule.end) {
            return "Working day ".concat(day, " must have both start and end times");
        }
        // Validate time format (HH:MM)
        var timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(daySchedule.start) || !timeRegex.test(daySchedule.end)) {
            return "Invalid time format for ".concat(day, ": must be HH:MM");
        }
        // Validate that start time is before end time
        var startTime = new Date("2000-01-01T".concat(daySchedule.start, ":00"));
        var endTime = new Date("2000-01-01T".concat(daySchedule.end, ":00"));
        if (startTime >= endTime) {
            return "Start time must be before end time for ".concat(day);
        }
        // Validate that target hours don't exceed the time window
        var actualHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        if (daySchedule.targetHours > actualHours) {
            return "Target hours (".concat(daySchedule.targetHours, ") exceed available time window (").concat(actualHours, ") for ").concat(day);
        }
    }
    else {
        // Non-working day should have null start/end times
        if (daySchedule.start !== null || daySchedule.end !== null) {
            return "Non-working day ".concat(day, " should have null start and end times");
        }
    }
    return null;
}
function applyUpdates(existingSchedule, updateRequest) {
    var updatedSchedule = __assign(__assign({}, existingSchedule), { updatedAt: new Date().toISOString() });
    // Update timezone if provided
    if (updateRequest.timezone) {
        updatedSchedule.timezone = updateRequest.timezone;
    }
    // Update schedule if provided
    if (updateRequest.schedule) {
        updatedSchedule.schedule = __assign(__assign({}, existingSchedule.schedule), updateRequest.schedule);
        // Recalculate weekly target hours
        updatedSchedule.weeklyTargetHours = Object.values(updatedSchedule.schedule)
            .reduce(function (total, day) { return total + day.targetHours; }, 0);
    }
    return updatedSchedule;
}
function saveWorkSchedule(schedule) {
    return __awaiter(this, void 0, void 0, function () {
        var item;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    item = {
                        PK: "USER#".concat(schedule.userId),
                        SK: 'WORK_SCHEDULE',
                        userId: schedule.userId,
                        schedule: JSON.stringify(schedule.schedule),
                        timezone: schedule.timezone,
                        weeklyTargetHours: schedule.weeklyTargetHours,
                        createdAt: schedule.createdAt,
                        updatedAt: schedule.updatedAt,
                    };
                    return [4 /*yield*/, docClient.send(new lib_dynamodb_1.PutCommand({
                            TableName: USER_WORK_SCHEDULES_TABLE,
                            Item: item,
                        }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
