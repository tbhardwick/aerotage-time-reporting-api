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
var types_1 = require("../shared/types");
var timeEntryRepo = new time_entry_repository_1.TimeEntryRepository();
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var authContext, userId, userRole, requestData, validationErrors, ownershipErrors, _i, _a, timeEntryId, timeEntry, error_1, result, statusCode, message, response, error_2;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 8, , 9]);
                console.log('Submit time entries request:', JSON.stringify(event, null, 2));
                authContext = event.requestContext.authorizer;
                userId = (authContext === null || authContext === void 0 ? void 0 : authContext.userId) || ((_b = authContext === null || authContext === void 0 ? void 0 : authContext.claims) === null || _b === void 0 ? void 0 : _b.sub);
                userRole = (authContext === null || authContext === void 0 ? void 0 : authContext.role) || ((_c = authContext === null || authContext === void 0 ? void 0 : authContext.claims) === null || _c === void 0 ? void 0 : _c['custom:role']);
                if (!userId) {
                    console.error('No user ID found in authorization context');
                    return [2 /*return*/, {
                            statusCode: 401,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'UNAUTHORIZED',
                                    message: 'User not authenticated',
                                },
                            }),
                        }];
                }
                // Parse request body
                if (!event.body) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'INVALID_REQUEST',
                                    message: 'Request body is required',
                                },
                            }),
                        }];
                }
                requestData = void 0;
                try {
                    requestData = JSON.parse(event.body);
                }
                catch (error) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'INVALID_JSON',
                                    message: 'Invalid JSON in request body',
                                },
                            }),
                        }];
                }
                validationErrors = [];
                if (!requestData.timeEntryIds || !Array.isArray(requestData.timeEntryIds)) {
                    validationErrors.push('timeEntryIds must be an array');
                }
                else if (requestData.timeEntryIds.length === 0) {
                    validationErrors.push('at least one time entry ID is required');
                }
                else if (requestData.timeEntryIds.length > 50) {
                    validationErrors.push('maximum 50 time entries can be submitted at once');
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
                            }),
                        }];
                }
                ownershipErrors = [];
                _i = 0, _a = requestData.timeEntryIds;
                _d.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 6];
                timeEntryId = _a[_i];
                _d.label = 2;
            case 2:
                _d.trys.push([2, 4, , 5]);
                return [4 /*yield*/, timeEntryRepo.getTimeEntry(timeEntryId)];
            case 3:
                timeEntry = _d.sent();
                if (!timeEntry) {
                    ownershipErrors.push("Time entry ".concat(timeEntryId, " not found"));
                    return [3 /*break*/, 5];
                }
                // Users can only submit their own time entries
                // Managers and admins can submit entries for their team members
                if (timeEntry.userId !== userId && userRole === 'employee') {
                    ownershipErrors.push("You can only submit your own time entries (".concat(timeEntryId, ")"));
                    return [3 /*break*/, 5];
                }
                // Check if time entry is in a submittable state
                if (timeEntry.status !== 'draft' && timeEntry.status !== 'rejected') {
                    ownershipErrors.push("Time entry ".concat(timeEntryId, " is already submitted or approved"));
                    return [3 /*break*/, 5];
                }
                // Validate that the time entry has required data
                if (!timeEntry.description || timeEntry.description.trim().length === 0) {
                    ownershipErrors.push("Time entry ".concat(timeEntryId, " is missing description"));
                    return [3 /*break*/, 5];
                }
                if (timeEntry.duration <= 0) {
                    ownershipErrors.push("Time entry ".concat(timeEntryId, " has invalid duration"));
                    return [3 /*break*/, 5];
                }
                return [3 /*break*/, 5];
            case 4:
                error_1 = _d.sent();
                ownershipErrors.push("Error checking time entry ".concat(timeEntryId, ": ").concat(error_1.message));
                return [3 /*break*/, 5];
            case 5:
                _i++;
                return [3 /*break*/, 1];
            case 6:
                if (ownershipErrors.length > 0) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: types_1.TimeEntryErrorCodes.UNAUTHORIZED_TIME_ENTRY_ACCESS,
                                    message: 'Cannot submit time entries',
                                    details: ownershipErrors,
                                },
                            }),
                        }];
                }
                return [4 /*yield*/, timeEntryRepo.submitTimeEntries(requestData.timeEntryIds, userId)];
            case 7:
                result = _d.sent();
                console.log("Submitted ".concat(result.successful.length, " time entries, ").concat(result.failed.length, " failed"));
                statusCode = 200;
                message = 'All time entries submitted successfully';
                if (result.failed.length > 0) {
                    if (result.successful.length === 0) {
                        statusCode = 400;
                        message = 'Failed to submit any time entries';
                    }
                    else {
                        statusCode = 207; // Multi-status
                        message = 'Some time entries submitted successfully';
                    }
                }
                response = {
                    success: true,
                    data: result,
                    message: message,
                };
                return [2 /*return*/, {
                        statusCode: statusCode,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 8:
                error_2 = _d.sent();
                console.error('Error submitting time entries:', error_2);
                return [2 /*return*/, {
                        statusCode: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify({
                            success: false,
                            error: {
                                code: 'INTERNAL_SERVER_ERROR',
                                message: 'An unexpected error occurred',
                            },
                        }),
                    }];
            case 9: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
