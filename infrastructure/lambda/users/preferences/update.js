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
var types_1 = require("../../shared/types");
var client = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
// Default preferences for merging
var DEFAULT_PREFERENCES = {
    theme: 'light',
    notifications: true,
    timezone: 'America/New_York',
    timeTracking: {
        defaultTimeEntryDuration: 60,
        autoStartTimer: false,
        showTimerInMenuBar: true,
        defaultBillableStatus: true,
        reminderInterval: 0,
        workingHours: {
            start: '09:00',
            end: '17:00',
        },
        timeGoals: {
            daily: 8.0,
            weekly: 40.0,
            notifications: true,
        },
    },
    formatting: {
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
    },
    updatedAt: new Date().toISOString(),
};
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, updateData, authContext, authenticatedUserId, userRole, validationError, getCommand, currentResult, currentPreferences, updatedPreferences, putCommand, response, error_1;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11;
    return __generator(this, function (_12) {
        switch (_12.label) {
            case 0:
                _12.trys.push([0, 3, , 4]);
                console.log('Update user preferences request:', JSON.stringify(event, null, 2));
                userId = (_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required')];
                }
                // Parse request body
                if (!event.body) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required')];
                }
                updateData = JSON.parse(event.body);
                authContext = event.requestContext.authorizer;
                authenticatedUserId = authContext === null || authContext === void 0 ? void 0 : authContext.userId;
                userRole = (authContext === null || authContext === void 0 ? void 0 : authContext.role) || 'employee';
                // Authorization check: users can only update their own preferences unless they're admin
                if (userId !== authenticatedUserId && userRole !== 'admin') {
                    return [2 /*return*/, createErrorResponse(403, types_1.ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 'You can only update your own preferences')];
                }
                validationError = validateUpdateRequest(updateData);
                if (validationError) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validationError)];
                }
                getCommand = new lib_dynamodb_1.GetCommand({
                    TableName: process.env.USER_PREFERENCES_TABLE,
                    Key: { userId: userId },
                });
                return [4 /*yield*/, docClient.send(getCommand)];
            case 1:
                currentResult = _12.sent();
                currentPreferences = void 0;
                if (currentResult.Item) {
                    currentPreferences = {
                        theme: currentResult.Item.theme,
                        notifications: currentResult.Item.notifications,
                        timezone: currentResult.Item.timezone,
                        timeTracking: typeof currentResult.Item.timeTracking === 'string'
                            ? JSON.parse(currentResult.Item.timeTracking)
                            : currentResult.Item.timeTracking,
                        formatting: typeof currentResult.Item.formatting === 'string'
                            ? JSON.parse(currentResult.Item.formatting)
                            : currentResult.Item.formatting,
                        updatedAt: currentResult.Item.updatedAt,
                    };
                }
                else {
                    currentPreferences = __assign({}, DEFAULT_PREFERENCES);
                }
                updatedPreferences = {
                    theme: (_b = updateData.theme) !== null && _b !== void 0 ? _b : currentPreferences.theme,
                    notifications: (_c = updateData.notifications) !== null && _c !== void 0 ? _c : currentPreferences.notifications,
                    timezone: (_d = updateData.timezone) !== null && _d !== void 0 ? _d : currentPreferences.timezone,
                    timeTracking: {
                        defaultTimeEntryDuration: (_f = (_e = updateData.timeTracking) === null || _e === void 0 ? void 0 : _e.defaultTimeEntryDuration) !== null && _f !== void 0 ? _f : currentPreferences.timeTracking.defaultTimeEntryDuration,
                        autoStartTimer: (_h = (_g = updateData.timeTracking) === null || _g === void 0 ? void 0 : _g.autoStartTimer) !== null && _h !== void 0 ? _h : currentPreferences.timeTracking.autoStartTimer,
                        showTimerInMenuBar: (_k = (_j = updateData.timeTracking) === null || _j === void 0 ? void 0 : _j.showTimerInMenuBar) !== null && _k !== void 0 ? _k : currentPreferences.timeTracking.showTimerInMenuBar,
                        defaultBillableStatus: (_m = (_l = updateData.timeTracking) === null || _l === void 0 ? void 0 : _l.defaultBillableStatus) !== null && _m !== void 0 ? _m : currentPreferences.timeTracking.defaultBillableStatus,
                        reminderInterval: (_p = (_o = updateData.timeTracking) === null || _o === void 0 ? void 0 : _o.reminderInterval) !== null && _p !== void 0 ? _p : currentPreferences.timeTracking.reminderInterval,
                        workingHours: {
                            start: (_s = (_r = (_q = updateData.timeTracking) === null || _q === void 0 ? void 0 : _q.workingHours) === null || _r === void 0 ? void 0 : _r.start) !== null && _s !== void 0 ? _s : currentPreferences.timeTracking.workingHours.start,
                            end: (_v = (_u = (_t = updateData.timeTracking) === null || _t === void 0 ? void 0 : _t.workingHours) === null || _u === void 0 ? void 0 : _u.end) !== null && _v !== void 0 ? _v : currentPreferences.timeTracking.workingHours.end,
                        },
                        timeGoals: {
                            daily: (_y = (_x = (_w = updateData.timeTracking) === null || _w === void 0 ? void 0 : _w.timeGoals) === null || _x === void 0 ? void 0 : _x.daily) !== null && _y !== void 0 ? _y : currentPreferences.timeTracking.timeGoals.daily,
                            weekly: (_1 = (_0 = (_z = updateData.timeTracking) === null || _z === void 0 ? void 0 : _z.timeGoals) === null || _0 === void 0 ? void 0 : _0.weekly) !== null && _1 !== void 0 ? _1 : currentPreferences.timeTracking.timeGoals.weekly,
                            notifications: (_4 = (_3 = (_2 = updateData.timeTracking) === null || _2 === void 0 ? void 0 : _2.timeGoals) === null || _3 === void 0 ? void 0 : _3.notifications) !== null && _4 !== void 0 ? _4 : currentPreferences.timeTracking.timeGoals.notifications,
                        },
                    },
                    formatting: {
                        currency: (_6 = (_5 = updateData.formatting) === null || _5 === void 0 ? void 0 : _5.currency) !== null && _6 !== void 0 ? _6 : currentPreferences.formatting.currency,
                        dateFormat: (_8 = (_7 = updateData.formatting) === null || _7 === void 0 ? void 0 : _7.dateFormat) !== null && _8 !== void 0 ? _8 : currentPreferences.formatting.dateFormat,
                        timeFormat: (_10 = (_9 = updateData.formatting) === null || _9 === void 0 ? void 0 : _9.timeFormat) !== null && _10 !== void 0 ? _10 : currentPreferences.formatting.timeFormat,
                    },
                    updatedAt: new Date().toISOString(),
                };
                putCommand = new lib_dynamodb_1.PutCommand({
                    TableName: process.env.USER_PREFERENCES_TABLE,
                    Item: {
                        userId: userId,
                        theme: updatedPreferences.theme,
                        notifications: updatedPreferences.notifications,
                        timezone: updatedPreferences.timezone,
                        timeTracking: JSON.stringify(updatedPreferences.timeTracking),
                        formatting: JSON.stringify(updatedPreferences.formatting),
                        createdAt: ((_11 = currentResult.Item) === null || _11 === void 0 ? void 0 : _11.createdAt) || new Date().toISOString(),
                        updatedAt: updatedPreferences.updatedAt,
                    },
                });
                return [4 /*yield*/, docClient.send(putCommand)];
            case 2:
                _12.sent();
                response = {
                    success: true,
                    data: updatedPreferences,
                    message: 'Preferences updated successfully',
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
                error_1 = _12.sent();
                console.error('Error updating user preferences:', error_1);
                return [2 /*return*/, createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Internal server error')];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function validateUpdateRequest(data) {
    // Validate theme
    if (data.theme && !['light', 'dark'].includes(data.theme)) {
        return 'Theme must be either "light" or "dark"';
    }
    // Validate timezone (basic check)
    if (data.timezone && !/^[A-Za-z_]+\/[A-Za-z_]+$/.test(data.timezone)) {
        return 'Invalid timezone format';
    }
    // Validate time tracking settings
    if (data.timeTracking) {
        if (data.timeTracking.defaultTimeEntryDuration !== undefined &&
            (data.timeTracking.defaultTimeEntryDuration < 1 || data.timeTracking.defaultTimeEntryDuration > 480)) {
            return 'Default time entry duration must be between 1 and 480 minutes';
        }
        if (data.timeTracking.reminderInterval !== undefined &&
            (data.timeTracking.reminderInterval < 0 || data.timeTracking.reminderInterval > 240)) {
            return 'Reminder interval must be between 0 and 240 minutes';
        }
        if (data.timeTracking.workingHours) {
            if (data.timeTracking.workingHours.start &&
                !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.timeTracking.workingHours.start)) {
                return 'Working hours start time must be in HH:MM format';
            }
            if (data.timeTracking.workingHours.end &&
                !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.timeTracking.workingHours.end)) {
                return 'Working hours end time must be in HH:MM format';
            }
        }
        if (data.timeTracking.timeGoals) {
            if (data.timeTracking.timeGoals.daily !== undefined &&
                (data.timeTracking.timeGoals.daily < 0 || data.timeTracking.timeGoals.daily > 24)) {
                return 'Daily time goal must be between 0 and 24 hours';
            }
            if (data.timeTracking.timeGoals.weekly !== undefined &&
                (data.timeTracking.timeGoals.weekly < 0 || data.timeTracking.timeGoals.weekly > 168)) {
                return 'Weekly time goal must be between 0 and 168 hours';
            }
        }
    }
    // Validate formatting settings
    if (data.formatting) {
        if (data.formatting.currency && !/^[A-Z]{3}$/.test(data.formatting.currency)) {
            return 'Currency must be a 3-letter ISO code (e.g., USD)';
        }
        if (data.formatting.timeFormat && !['12h', '24h'].includes(data.formatting.timeFormat)) {
            return 'Time format must be either "12h" or "24h"';
        }
    }
    return null;
}
function createErrorResponse(statusCode, errorCode, message) {
    var errorResponse = {
        success: false,
        error: {
            code: errorCode,
            message: message,
        },
        timestamp: new Date().toISOString(),
    };
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(errorResponse),
    };
}
