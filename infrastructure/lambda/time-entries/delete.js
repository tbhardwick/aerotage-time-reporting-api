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
    var authContext, userId, userRole, timeEntryId, existingTimeEntry, error_1;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 3, , 4]);
                console.log('Delete time entry request:', JSON.stringify(event, null, 2));
                authContext = event.requestContext.authorizer;
                userId = (authContext === null || authContext === void 0 ? void 0 : authContext.userId) || ((_a = authContext === null || authContext === void 0 ? void 0 : authContext.claims) === null || _a === void 0 ? void 0 : _a.sub);
                userRole = (authContext === null || authContext === void 0 ? void 0 : authContext.role) || ((_b = authContext === null || authContext === void 0 ? void 0 : authContext.claims) === null || _b === void 0 ? void 0 : _b['custom:role']);
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
                timeEntryId = (_c = event.pathParameters) === null || _c === void 0 ? void 0 : _c.id;
                if (!timeEntryId) {
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
                                    message: 'Time entry ID is required',
                                },
                            }),
                        }];
                }
                return [4 /*yield*/, timeEntryRepo.getTimeEntry(timeEntryId)];
            case 1:
                existingTimeEntry = _d.sent();
                if (!existingTimeEntry) {
                    return [2 /*return*/, {
                            statusCode: 404,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: types_1.TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND,
                                    message: 'Time entry not found',
                                },
                            }),
                        }];
                }
                // Check authorization - users can only delete their own entries
                // Managers and admins can delete entries for their team members
                if (existingTimeEntry.userId !== userId && userRole === 'employee') {
                    return [2 /*return*/, {
                            statusCode: 403,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: types_1.TimeEntryErrorCodes.UNAUTHORIZED_TIME_ENTRY_ACCESS,
                                    message: 'You can only delete your own time entries',
                                },
                            }),
                        }];
                }
                // Validate that the time entry can be deleted (only draft and rejected entries)
                if (existingTimeEntry.status !== 'draft' && existingTimeEntry.status !== 'rejected') {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: types_1.TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED,
                                    message: 'Cannot delete time entry that has been submitted or approved',
                                },
                            }),
                        }];
                }
                // Delete the time entry
                return [4 /*yield*/, timeEntryRepo.deleteTimeEntry(timeEntryId)];
            case 2:
                // Delete the time entry
                _d.sent();
                console.log('Time entry deleted successfully:', timeEntryId);
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify({
                            success: true,
                            message: 'Time entry deleted successfully',
                        }),
                    }];
            case 3:
                error_1 = _d.sent();
                console.error('Error deleting time entry:', error_1);
                // Handle specific error types
                if (error_1 instanceof Error) {
                    if (error_1.message === types_1.TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND) {
                        return [2 /*return*/, {
                                statusCode: 404,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                },
                                body: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: types_1.TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND,
                                        message: 'Time entry not found',
                                    },
                                }),
                            }];
                    }
                    if (error_1.message === types_1.TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED) {
                        return [2 /*return*/, {
                                statusCode: 400,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                },
                                body: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: types_1.TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED,
                                        message: 'Cannot delete submitted or approved time entry',
                                    },
                                }),
                            }];
                    }
                }
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
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
