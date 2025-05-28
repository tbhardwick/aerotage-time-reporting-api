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
var time_entry_repository_1 = require("../shared/time-entry-repository");
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var types_1 = require("../shared/types");
var timeEntryRepo = new time_entry_repository_1.TimeEntryRepository();
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, requestData, validationErrors, dateRegex, entryDate, today, startTime, endTime, calculatedDuration, timeEntry, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log('Create time entry request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User not authenticated')];
                }
                // Parse request body
                if (!event.body) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_REQUEST', 'Request body is required')];
                }
                requestData = void 0;
                try {
                    requestData = JSON.parse(event.body);
                }
                catch (error) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_JSON', 'Invalid JSON in request body')];
                }
                validationErrors = [];
                if (!requestData.projectId) {
                    validationErrors.push('projectId is required');
                }
                if (!requestData.description || requestData.description.trim().length === 0) {
                    validationErrors.push('description is required');
                }
                if (!requestData.date) {
                    validationErrors.push('date is required');
                }
                else {
                    dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (!dateRegex.test(requestData.date)) {
                        validationErrors.push('date must be in YYYY-MM-DD format');
                    }
                    else {
                        entryDate = new Date(requestData.date);
                        today = new Date();
                        today.setHours(23, 59, 59, 999); // End of today
                        if (entryDate > today) {
                            validationErrors.push('date cannot be in the future');
                        }
                    }
                }
                // Validate time fields if provided
                if (requestData.startTime && requestData.endTime) {
                    startTime = new Date(requestData.startTime);
                    endTime = new Date(requestData.endTime);
                    if (startTime >= endTime) {
                        validationErrors.push('endTime must be after startTime');
                    }
                    calculatedDuration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
                    if (calculatedDuration <= 0) {
                        validationErrors.push('duration must be positive');
                    }
                    if (requestData.duration && Math.abs(requestData.duration - calculatedDuration) > 1) {
                        validationErrors.push('provided duration does not match calculated duration from start and end times');
                    }
                }
                else if (requestData.duration) {
                    if (requestData.duration <= 0) {
                        validationErrors.push('duration must be positive');
                    }
                    if (requestData.duration > (24 * 60)) { // 24 hours in minutes
                        validationErrors.push('duration cannot exceed 24 hours');
                    }
                }
                else {
                    validationErrors.push('either duration or both startTime and endTime must be provided');
                }
                // Validate hourly rate if provided
                if (requestData.hourlyRate !== undefined && requestData.hourlyRate < 0) {
                    validationErrors.push('hourlyRate must be non-negative');
                }
                // Validate tags if provided
                if (requestData.tags && requestData.tags.length > 10) {
                    validationErrors.push('maximum 10 tags allowed');
                }
                if (validationErrors.length > 0) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: types_1.TimeEntryErrorCodes.INVALID_TIME_ENTRY_DATA,
                                    message: 'Validation failed',
                                    details: validationErrors,
                                },
                                timestamp: new Date().toISOString(),
                            }),
                        }];
                }
                return [4 /*yield*/, timeEntryRepo.createTimeEntry(userId, requestData)];
            case 1:
                timeEntry = _a.sent();
                console.log('Time entry created successfully:', timeEntry.id);
                return [2 /*return*/, (0, response_helper_1.createSuccessResponse)(timeEntry, 201, 'Time entry created successfully')];
            case 2:
                error_1 = _a.sent();
                console.error('Error creating time entry:', error_1);
                // Handle specific error types
                if (error_1 instanceof Error) {
                    if (error_1.message === types_1.TimeEntryErrorCodes.PROJECT_NOT_FOUND) {
                        return [2 /*return*/, (0, response_helper_1.createErrorResponse)(404, types_1.TimeEntryErrorCodes.PROJECT_NOT_FOUND, 'Project not found')];
                    }
                    if (error_1.message === types_1.TimeEntryErrorCodes.PROJECT_ACCESS_DENIED) {
                        return [2 /*return*/, (0, response_helper_1.createErrorResponse)(403, types_1.TimeEntryErrorCodes.PROJECT_ACCESS_DENIED, 'Access denied to project')];
                    }
                }
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred')];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
