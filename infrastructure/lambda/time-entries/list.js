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
var timeEntryRepo = new time_entry_repository_1.TimeEntryRepository();
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, queryParams, filters, validStatuses, dateRegex, dateRegex, limit, offset, validSortFields, result, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log('List time entries request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User not authenticated')];
                }
                queryParams = event.queryStringParameters || {};
                filters = {};
                // User filtering - employees can only see their own entries
                // Managers and admins can see entries for their team/all users
                if ((user === null || user === void 0 ? void 0 : user.role) === 'employee') {
                    filters.userId = userId;
                }
                else if (queryParams.userId) {
                    filters.userId = queryParams.userId;
                }
                else {
                    // Default to current user's entries if no specific user requested
                    filters.userId = userId;
                }
                // Project filtering
                if (queryParams.projectId) {
                    filters.projectId = queryParams.projectId;
                }
                // Task filtering
                if (queryParams.taskId) {
                    filters.taskId = queryParams.taskId;
                }
                // Status filtering
                if (queryParams.status) {
                    validStatuses = ['draft', 'submitted', 'approved', 'rejected'];
                    if (validStatuses.includes(queryParams.status)) {
                        filters.status = queryParams.status;
                    }
                }
                // Billable filtering
                if (queryParams.isBillable !== undefined) {
                    filters.isBillable = queryParams.isBillable === 'true';
                }
                // Date range filtering
                if (queryParams.dateFrom) {
                    dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (dateRegex.test(queryParams.dateFrom)) {
                        filters.dateFrom = queryParams.dateFrom;
                    }
                }
                if (queryParams.dateTo) {
                    dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (dateRegex.test(queryParams.dateTo)) {
                        filters.dateTo = queryParams.dateTo;
                    }
                }
                // Tags filtering
                if (queryParams.tags) {
                    filters.tags = queryParams.tags.split(',').map(function (tag) { return tag.trim(); });
                }
                // Pagination
                if (queryParams.limit) {
                    limit = parseInt(queryParams.limit, 10);
                    if (!isNaN(limit) && limit > 0 && limit <= 100) {
                        filters.limit = limit;
                    }
                }
                if (queryParams.offset) {
                    offset = parseInt(queryParams.offset, 10);
                    if (!isNaN(offset) && offset >= 0) {
                        filters.offset = offset;
                    }
                }
                // Sorting
                if (queryParams.sortBy) {
                    validSortFields = ['date', 'duration', 'createdAt', 'updatedAt'];
                    if (validSortFields.includes(queryParams.sortBy)) {
                        filters.sortBy = queryParams.sortBy;
                    }
                }
                if (queryParams.sortOrder) {
                    if (queryParams.sortOrder === 'asc' || queryParams.sortOrder === 'desc') {
                        filters.sortOrder = queryParams.sortOrder;
                    }
                }
                console.log('Applied filters:', JSON.stringify(filters, null, 2));
                return [4 /*yield*/, timeEntryRepo.listTimeEntries(filters)];
            case 1:
                result = _a.sent();
                console.log("Retrieved ".concat(result.items.length, " time entries"));
                response = {
                    success: true,
                    data: {
                        items: result.items,
                        pagination: result.pagination,
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
            case 2:
                error_1 = _a.sent();
                console.error('Error listing time entries:', error_1);
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred')];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
