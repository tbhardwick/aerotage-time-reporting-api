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
var uuid_1 = require("uuid");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var TIME_ENTRIES_TABLE = process.env.TIME_ENTRIES_TABLE;
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, request, validationError, startTime, endTime, durationMinutes, timeEntry, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                console.log('Quick time entry request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User not authenticated')];
                }
                // Parse request body
                if (!event.body) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.INVALID_TIME_ENTRY_DATA, 'Request body is required')];
                }
                request = void 0;
                try {
                    request = JSON.parse(event.body);
                }
                catch (error) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.INVALID_TIME_ENTRY_DATA, 'Invalid JSON in request body')];
                }
                return [4 /*yield*/, validateQuickTimeEntry(request, userId)];
            case 1:
                validationError = _a.sent();
                if (validationError) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.TimeTrackingErrorCodes.INVALID_TIME_ENTRY_DATA, validationError)];
                }
                startTime = new Date("".concat(request.date, "T").concat(request.startTime, ":00"));
                endTime = new Date("".concat(request.date, "T").concat(request.endTime, ":00"));
                durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
                return [4 /*yield*/, createQuickTimeEntry(request, userId, durationMinutes)];
            case 2:
                timeEntry = _a.sent();
                response = {
                    success: true,
                    data: timeEntry,
                };
                return [2 /*return*/, {
                        statusCode: 201,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _a.sent();
                console.error('Error creating quick time entry:', error_1);
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred')];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function validateQuickTimeEntry(request, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var dateRegex, timeRegex, startTime, endTime, durationMinutes, today, hasOverlap;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Validate required fields
                    if (!request.date || !request.startTime || !request.endTime || !request.projectId || !request.description) {
                        return [2 /*return*/, 'Missing required fields: date, startTime, endTime, projectId, description'];
                    }
                    dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (!dateRegex.test(request.date)) {
                        return [2 /*return*/, 'Date must be in YYYY-MM-DD format'];
                    }
                    timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
                    if (!timeRegex.test(request.startTime) || !timeRegex.test(request.endTime)) {
                        return [2 /*return*/, 'Times must be in HH:MM format'];
                    }
                    startTime = new Date("".concat(request.date, "T").concat(request.startTime, ":00"));
                    endTime = new Date("".concat(request.date, "T").concat(request.endTime, ":00"));
                    if (startTime >= endTime) {
                        return [2 /*return*/, 'Start time must be before end time'];
                    }
                    durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
                    if (durationMinutes > 24 * 60) { // Max 24 hours
                        return [2 /*return*/, 'Duration cannot exceed 24 hours'];
                    }
                    if (durationMinutes < 1) { // Min 1 minute
                        return [2 /*return*/, 'Duration must be at least 1 minute'];
                    }
                    today = new Date();
                    today.setHours(23, 59, 59, 999);
                    if (endTime > today) {
                        return [2 /*return*/, 'Cannot create time entries for future dates'];
                    }
                    return [4 /*yield*/, checkForTimeOverlap(userId, request.date, request.startTime, request.endTime)];
                case 1:
                    hasOverlap = _a.sent();
                    if (hasOverlap) {
                        return [2 /*return*/, 'Time entry overlaps with existing entry'];
                    }
                    return [2 /*return*/, null];
            }
        });
    });
}
function checkForTimeOverlap(userId, date, startTime, endTime) {
    return __awaiter(this, void 0, void 0, function () {
        var result, existingEntries, newStart, newEnd, _i, existingEntries_1, entry, existingStart, existingEnd, error_2;
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
                    existingEntries = result.Items || [];
                    newStart = new Date("".concat(date, "T").concat(startTime, ":00"));
                    newEnd = new Date("".concat(date, "T").concat(endTime, ":00"));
                    for (_i = 0, existingEntries_1 = existingEntries; _i < existingEntries_1.length; _i++) {
                        entry = existingEntries_1[_i];
                        if (entry.startTime && entry.endTime) {
                            existingStart = new Date(entry.startTime);
                            existingEnd = new Date(entry.endTime);
                            // Check if times overlap
                            if (newStart < existingEnd && newEnd > existingStart) {
                                return [2 /*return*/, true];
                            }
                        }
                    }
                    return [2 /*return*/, false];
                case 2:
                    error_2 = _a.sent();
                    console.error('Error checking for time overlap:', error_2);
                    return [2 /*return*/, false]; // Allow creation if we can't check
                case 3: return [2 /*return*/];
            }
        });
    });
}
function createQuickTimeEntry(request, userId, durationMinutes) {
    return __awaiter(this, void 0, void 0, function () {
        var now, timeEntryId, startDateTime, endDateTime, timeEntry, dynamoItem;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    now = new Date().toISOString();
                    timeEntryId = (0, uuid_1.v4)();
                    startDateTime = "".concat(request.date, "T").concat(request.startTime, ":00.000Z");
                    endDateTime = "".concat(request.date, "T").concat(request.endTime, ":00.000Z");
                    timeEntry = {
                        id: timeEntryId,
                        userId: userId,
                        projectId: request.projectId,
                        taskId: undefined,
                        description: request.description,
                        date: request.date,
                        startTime: startDateTime,
                        endTime: endDateTime,
                        duration: durationMinutes,
                        isBillable: (_a = request.isBillable) !== null && _a !== void 0 ? _a : true,
                        hourlyRate: undefined,
                        status: 'draft',
                        tags: [],
                        notes: request.fillGap ? 'Created via quick entry to fill time gap' : undefined,
                        attachments: [],
                        submittedAt: undefined,
                        approvedAt: undefined,
                        rejectedAt: undefined,
                        approvedBy: undefined,
                        rejectionReason: undefined,
                        isTimerEntry: false,
                        timerStartedAt: undefined,
                        createdAt: now,
                        updatedAt: now,
                    };
                    dynamoItem = {
                        PK: "TIME_ENTRY#".concat(timeEntryId),
                        SK: "TIME_ENTRY#".concat(timeEntryId),
                        GSI1PK: "USER#".concat(userId),
                        GSI1SK: "DATE#".concat(request.date, "#TIME_ENTRY#").concat(timeEntryId),
                        GSI2PK: "PROJECT#".concat(request.projectId),
                        GSI2SK: "DATE#".concat(request.date, "#TIME_ENTRY#").concat(timeEntryId),
                        GSI3PK: "STATUS#draft",
                        GSI3SK: "DATE#".concat(request.date, "#TIME_ENTRY#").concat(timeEntryId),
                        id: timeEntryId,
                        userId: userId,
                        projectId: request.projectId,
                        taskId: undefined,
                        description: request.description,
                        date: request.date,
                        startTime: startDateTime,
                        endTime: endDateTime,
                        duration: durationMinutes,
                        isBillable: (_b = request.isBillable) !== null && _b !== void 0 ? _b : true,
                        hourlyRate: undefined,
                        status: 'draft',
                        tags: JSON.stringify([]),
                        notes: timeEntry.notes,
                        attachments: JSON.stringify([]),
                        submittedAt: undefined,
                        approvedAt: undefined,
                        rejectedAt: undefined,
                        approvedBy: undefined,
                        rejectionReason: undefined,
                        isTimerEntry: false,
                        timerStartedAt: undefined,
                        createdAt: now,
                        updatedAt: now,
                    };
                    return [4 /*yield*/, docClient.send(new lib_dynamodb_1.PutCommand({
                            TableName: TIME_ENTRIES_TABLE,
                            Item: dynamoItem,
                        }))];
                case 1:
                    _c.sent();
                    return [2 /*return*/, timeEntry];
            }
        });
    });
}
