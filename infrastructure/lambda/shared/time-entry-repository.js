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
exports.TimeEntryRepository = void 0;
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var types_1 = require("./types");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var TimeEntryRepository = /** @class */ (function () {
    function TimeEntryRepository() {
        this.timeEntriesTable = process.env.TIME_ENTRIES_TABLE || '';
        if (!this.timeEntriesTable) {
            throw new Error('TIME_ENTRIES_TABLE environment variable is required');
        }
    }
    // ==========================================
    // Time Entry CRUD Operations
    // ==========================================
    TimeEntryRepository.prototype.createTimeEntry = function (userId, request) {
        return __awaiter(this, void 0, void 0, function () {
            var now, timeEntryId, duration, start, end, timeEntry, dynamoItem;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        now = new Date().toISOString();
                        timeEntryId = "te_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
                        duration = request.duration || 0;
                        if (!duration && request.startTime && request.endTime) {
                            start = new Date(request.startTime);
                            end = new Date(request.endTime);
                            duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // minutes
                        }
                        timeEntry = {
                            id: timeEntryId,
                            userId: userId,
                            projectId: request.projectId,
                            taskId: request.taskId,
                            description: request.description,
                            date: request.date,
                            startTime: request.startTime,
                            endTime: request.endTime,
                            duration: duration,
                            isBillable: (_a = request.isBillable) !== null && _a !== void 0 ? _a : true,
                            hourlyRate: request.hourlyRate,
                            status: 'draft',
                            tags: request.tags || [],
                            notes: request.notes,
                            attachments: request.attachments || [],
                            isTimerEntry: false,
                            createdAt: now,
                            updatedAt: now,
                        };
                        dynamoItem = __assign(__assign({ PK: "TIME_ENTRY#".concat(timeEntryId), SK: "TIME_ENTRY#".concat(timeEntryId), GSI1PK: "USER#".concat(userId), GSI1SK: "DATE#".concat(request.date, "#TIME_ENTRY#").concat(timeEntryId), GSI2PK: "PROJECT#".concat(request.projectId), GSI2SK: "DATE#".concat(request.date, "#TIME_ENTRY#").concat(timeEntryId), GSI3PK: "STATUS#draft", GSI3SK: "DATE#".concat(request.date, "#TIME_ENTRY#").concat(timeEntryId) }, timeEntry), { tags: JSON.stringify(timeEntry.tags), attachments: JSON.stringify(timeEntry.attachments) });
                        return [4 /*yield*/, docClient.send(new lib_dynamodb_1.PutCommand({
                                TableName: this.timeEntriesTable,
                                Item: dynamoItem,
                                ConditionExpression: 'attribute_not_exists(PK)',
                            }))];
                    case 1:
                        _b.sent();
                        return [2 /*return*/, timeEntry];
                }
            });
        });
    };
    TimeEntryRepository.prototype.getTimeEntry = function (timeEntryId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, docClient.send(new lib_dynamodb_1.GetCommand({
                            TableName: this.timeEntriesTable,
                            Key: {
                                PK: "TIME_ENTRY#".concat(timeEntryId),
                                SK: "TIME_ENTRY#".concat(timeEntryId),
                            },
                        }))];
                    case 1:
                        result = _a.sent();
                        if (!result.Item) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, this.mapDynamoItemToTimeEntry(result.Item)];
                }
            });
        });
    };
    TimeEntryRepository.prototype.updateTimeEntry = function (timeEntryId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var existing, now, duration, startTime, endTime, start, end, updateExpression, expressionAttributeNames, expressionAttributeValues, newDate, newProjectId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getTimeEntry(timeEntryId)];
                    case 1:
                        existing = _a.sent();
                        if (!existing) {
                            throw new Error(types_1.TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND);
                        }
                        // Prevent updates to submitted/approved entries
                        if (existing.status !== 'draft' && existing.status !== 'rejected') {
                            throw new Error(types_1.TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED);
                        }
                        now = new Date().toISOString();
                        duration = updates.duration || existing.duration;
                        startTime = updates.startTime || existing.startTime;
                        endTime = updates.endTime || existing.endTime;
                        if (startTime && endTime && !updates.duration) {
                            start = new Date(startTime);
                            end = new Date(endTime);
                            duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
                        }
                        updateExpression = [];
                        expressionAttributeNames = {};
                        expressionAttributeValues = {};
                        // Build update expression dynamically
                        Object.entries(updates).forEach(function (_a) {
                            var key = _a[0], value = _a[1];
                            if (value !== undefined && key !== 'duration') { // Skip duration as we handle it separately
                                var attrName = "#".concat(key);
                                var attrValue = ":".concat(key);
                                updateExpression.push("".concat(attrName, " = ").concat(attrValue));
                                expressionAttributeNames[attrName] = key;
                                if (key === 'tags' || key === 'attachments') {
                                    expressionAttributeValues[attrValue] = JSON.stringify(value || []);
                                }
                                else {
                                    expressionAttributeValues[attrValue] = value;
                                }
                            }
                        });
                        // Always update duration and updatedAt
                        updateExpression.push('#duration = :duration', '#updatedAt = :updatedAt');
                        expressionAttributeNames['#duration'] = 'duration';
                        expressionAttributeNames['#updatedAt'] = 'updatedAt';
                        expressionAttributeValues[':duration'] = duration;
                        expressionAttributeValues[':updatedAt'] = now;
                        // Update GSI keys if necessary
                        if (updates.date || updates.projectId) {
                            newDate = updates.date || existing.date;
                            newProjectId = updates.projectId || existing.projectId;
                            updateExpression.push('#GSI1SK = :gsi1sk', '#GSI2PK = :gsi2pk', '#GSI2SK = :gsi2sk', '#GSI3SK = :gsi3sk');
                            expressionAttributeNames['#GSI1SK'] = 'GSI1SK';
                            expressionAttributeNames['#GSI2PK'] = 'GSI2PK';
                            expressionAttributeNames['#GSI2SK'] = 'GSI2SK';
                            expressionAttributeNames['#GSI3SK'] = 'GSI3SK';
                            expressionAttributeValues[':gsi1sk'] = "DATE#".concat(newDate, "#TIME_ENTRY#").concat(timeEntryId);
                            expressionAttributeValues[':gsi2pk'] = "PROJECT#".concat(newProjectId);
                            expressionAttributeValues[':gsi2sk'] = "DATE#".concat(newDate, "#TIME_ENTRY#").concat(timeEntryId);
                            expressionAttributeValues[':gsi3sk'] = "DATE#".concat(newDate, "#TIME_ENTRY#").concat(timeEntryId);
                        }
                        return [4 /*yield*/, docClient.send(new lib_dynamodb_1.UpdateCommand({
                                TableName: this.timeEntriesTable,
                                Key: {
                                    PK: "TIME_ENTRY#".concat(timeEntryId),
                                    SK: "TIME_ENTRY#".concat(timeEntryId),
                                },
                                UpdateExpression: "SET ".concat(updateExpression.join(', ')),
                                ExpressionAttributeNames: expressionAttributeNames,
                                ExpressionAttributeValues: expressionAttributeValues,
                                ConditionExpression: 'attribute_exists(PK)',
                            }))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.getTimeEntry(timeEntryId)];
                    case 3: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    TimeEntryRepository.prototype.deleteTimeEntry = function (timeEntryId) {
        return __awaiter(this, void 0, void 0, function () {
            var existing;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getTimeEntry(timeEntryId)];
                    case 1:
                        existing = _a.sent();
                        if (!existing) {
                            throw new Error(types_1.TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND);
                        }
                        // Prevent deletion of submitted/approved entries
                        if (existing.status !== 'draft' && existing.status !== 'rejected') {
                            throw new Error(types_1.TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED);
                        }
                        return [4 /*yield*/, docClient.send(new lib_dynamodb_1.DeleteCommand({
                                TableName: this.timeEntriesTable,
                                Key: {
                                    PK: "TIME_ENTRY#".concat(timeEntryId),
                                    SK: "TIME_ENTRY#".concat(timeEntryId),
                                },
                            }))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // ==========================================
    // Time Entry Queries
    // ==========================================
    TimeEntryRepository.prototype.listTimeEntries = function () {
        return __awaiter(this, arguments, void 0, function (filters) {
            var limit, offset, queryParams, filterExpressions, expressionAttributeNames, result, _a, items, hasMore, total;
            var _this = this;
            var _b;
            if (filters === void 0) { filters = {}; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        limit = Math.min(filters.limit || 50, 100);
                        offset = filters.offset || 0;
                        queryParams = {
                            TableName: this.timeEntriesTable,
                            Limit: limit + 1, // Get one extra to check if there are more
                        };
                        // Choose the most efficient query based on filters
                        if (filters.userId) {
                            // Query by user
                            queryParams.IndexName = 'UserIndex';
                            queryParams.KeyConditionExpression = 'GSI1PK = :userId';
                            queryParams.ExpressionAttributeValues = { ':userId': "USER#".concat(filters.userId) };
                            if (filters.dateFrom || filters.dateTo) {
                                queryParams.KeyConditionExpression += ' AND begins_with(GSI1SK, :datePrefix)';
                                queryParams.ExpressionAttributeValues[':datePrefix'] = 'DATE#';
                            }
                        }
                        else if (filters.projectId) {
                            // Query by project
                            queryParams.IndexName = 'ProjectIndex';
                            queryParams.KeyConditionExpression = 'GSI2PK = :projectId';
                            queryParams.ExpressionAttributeValues = { ':projectId': "PROJECT#".concat(filters.projectId) };
                        }
                        else if (filters.status) {
                            // Query by status
                            queryParams.IndexName = 'StatusIndex';
                            queryParams.KeyConditionExpression = 'GSI3PK = :status';
                            queryParams.ExpressionAttributeValues = { ':status': "STATUS#".concat(filters.status) };
                        }
                        else {
                            // Full table scan (least efficient)
                            delete queryParams.KeyConditionExpression;
                        }
                        filterExpressions = [];
                        expressionAttributeNames = {};
                        if (filters.isBillable !== undefined) {
                            filterExpressions.push('#isBillable = :isBillable');
                            expressionAttributeNames['#isBillable'] = 'isBillable';
                            queryParams.ExpressionAttributeValues = __assign(__assign({}, queryParams.ExpressionAttributeValues), { ':isBillable': filters.isBillable });
                        }
                        if (filters.dateFrom) {
                            filterExpressions.push('#date >= :dateFrom');
                            expressionAttributeNames['#date'] = 'date';
                            queryParams.ExpressionAttributeValues = __assign(__assign({}, queryParams.ExpressionAttributeValues), { ':dateFrom': filters.dateFrom });
                        }
                        if (filters.dateTo) {
                            filterExpressions.push('#date <= :dateTo');
                            expressionAttributeNames['#date'] = 'date';
                            queryParams.ExpressionAttributeValues = __assign(__assign({}, queryParams.ExpressionAttributeValues), { ':dateTo': filters.dateTo });
                        }
                        if (filterExpressions.length > 0) {
                            queryParams.FilterExpression = filterExpressions.join(' AND ');
                            queryParams.ExpressionAttributeNames = expressionAttributeNames;
                        }
                        // Handle pagination
                        if (offset > 0) {
                            // For simplicity, we'll use scan with offset for now
                            // In production, you'd want to implement proper cursor-based pagination
                            queryParams.ExclusiveStartKey = undefined; // Implement proper pagination logic
                        }
                        if (!queryParams.KeyConditionExpression) return [3 /*break*/, 2];
                        return [4 /*yield*/, docClient.send(new lib_dynamodb_1.QueryCommand(queryParams))];
                    case 1:
                        _a = _c.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, docClient.send(new lib_dynamodb_1.ScanCommand(queryParams))];
                    case 3:
                        _a = _c.sent();
                        _c.label = 4;
                    case 4:
                        result = _a;
                        items = (result.Items || [])
                            .slice(0, limit) // Remove the extra item used for hasMore check
                            .map(function (item) { return _this.mapDynamoItemToTimeEntry(item); });
                        hasMore = (((_b = result.Items) === null || _b === void 0 ? void 0 : _b.length) || 0) > limit;
                        total = result.Count || 0;
                        return [2 /*return*/, {
                                items: items,
                                pagination: {
                                    total: total,
                                    limit: limit,
                                    offset: offset,
                                    hasMore: hasMore,
                                },
                            }];
                }
            });
        });
    };
    // ==========================================
    // Bulk Operations
    // ==========================================
    TimeEntryRepository.prototype.submitTimeEntries = function (timeEntryIds, submittedBy) {
        return __awaiter(this, void 0, void 0, function () {
            var successful, failed, _i, timeEntryIds_1, timeEntryId, timeEntry, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        successful = [];
                        failed = [];
                        _i = 0, timeEntryIds_1 = timeEntryIds;
                        _a.label = 1;
                    case 1:
                        if (!(_i < timeEntryIds_1.length)) return [3 /*break*/, 7];
                        timeEntryId = timeEntryIds_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        return [4 /*yield*/, this.getTimeEntry(timeEntryId)];
                    case 3:
                        timeEntry = _a.sent();
                        if (!timeEntry) {
                            failed.push({ id: timeEntryId, error: types_1.TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND });
                            return [3 /*break*/, 6];
                        }
                        if (timeEntry.status !== 'draft' && timeEntry.status !== 'rejected') {
                            failed.push({ id: timeEntryId, error: types_1.TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED });
                            return [3 /*break*/, 6];
                        }
                        return [4 /*yield*/, this.updateTimeEntryStatus(timeEntryId, 'submitted', submittedBy)];
                    case 4:
                        _a.sent();
                        successful.push(timeEntryId);
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        failed.push({ id: timeEntryId, error: error_1.message });
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/, { successful: successful, failed: failed }];
                }
            });
        });
    };
    TimeEntryRepository.prototype.approveTimeEntries = function (timeEntryIds_2, approvedBy_1) {
        return __awaiter(this, arguments, void 0, function (timeEntryIds, approvedBy, allowSelfApproval) {
            var successful, failed, _i, timeEntryIds_3, timeEntryId, timeEntry, error_2;
            if (allowSelfApproval === void 0) { allowSelfApproval = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        successful = [];
                        failed = [];
                        _i = 0, timeEntryIds_3 = timeEntryIds;
                        _a.label = 1;
                    case 1:
                        if (!(_i < timeEntryIds_3.length)) return [3 /*break*/, 7];
                        timeEntryId = timeEntryIds_3[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        return [4 /*yield*/, this.getTimeEntry(timeEntryId)];
                    case 3:
                        timeEntry = _a.sent();
                        if (!timeEntry) {
                            failed.push({ id: timeEntryId, error: types_1.TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND });
                            return [3 /*break*/, 6];
                        }
                        if (timeEntry.status !== 'submitted') {
                            failed.push({ id: timeEntryId, error: types_1.TimeEntryErrorCodes.TIME_ENTRY_NOT_SUBMITTED });
                            return [3 /*break*/, 6];
                        }
                        // Check self-approval rules
                        if (timeEntry.userId === approvedBy && !allowSelfApproval) {
                            failed.push({ id: timeEntryId, error: types_1.TimeEntryErrorCodes.CANNOT_APPROVE_OWN_ENTRIES });
                            return [3 /*break*/, 6];
                        }
                        return [4 /*yield*/, this.updateTimeEntryStatus(timeEntryId, 'approved', approvedBy)];
                    case 4:
                        _a.sent();
                        successful.push(timeEntryId);
                        return [3 /*break*/, 6];
                    case 5:
                        error_2 = _a.sent();
                        failed.push({ id: timeEntryId, error: error_2.message });
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/, { successful: successful, failed: failed }];
                }
            });
        });
    };
    TimeEntryRepository.prototype.rejectTimeEntries = function (timeEntryIds, rejectedBy, reason) {
        return __awaiter(this, void 0, void 0, function () {
            var successful, failed, _i, timeEntryIds_2, timeEntryId, timeEntry, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        successful = [];
                        failed = [];
                        _i = 0, timeEntryIds_2 = timeEntryIds;
                        _a.label = 1;
                    case 1:
                        if (!(_i < timeEntryIds_2.length)) return [3 /*break*/, 7];
                        timeEntryId = timeEntryIds_2[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        return [4 /*yield*/, this.getTimeEntry(timeEntryId)];
                    case 3:
                        timeEntry = _a.sent();
                        if (!timeEntry) {
                            failed.push({ id: timeEntryId, error: types_1.TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND });
                            return [3 /*break*/, 6];
                        }
                        if (timeEntry.status !== 'submitted') {
                            failed.push({ id: timeEntryId, error: types_1.TimeEntryErrorCodes.TIME_ENTRY_NOT_SUBMITTED });
                            return [3 /*break*/, 6];
                        }
                        return [4 /*yield*/, this.updateTimeEntryStatus(timeEntryId, 'rejected', rejectedBy, reason)];
                    case 4:
                        _a.sent();
                        successful.push(timeEntryId);
                        return [3 /*break*/, 6];
                    case 5:
                        error_3 = _a.sent();
                        failed.push({ id: timeEntryId, error: error_3.message });
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/, { successful: successful, failed: failed }];
                }
            });
        });
    };
    // ==========================================
    // Timer Operations
    // ==========================================
    TimeEntryRepository.prototype.startTimer = function (userId, request) {
        return __awaiter(this, void 0, void 0, function () {
            var existingTimer, now, timerId, timerSession, dynamoItem;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getActiveTimer(userId)];
                    case 1:
                        existingTimer = _a.sent();
                        if (existingTimer) {
                            throw new Error(types_1.TimeEntryErrorCodes.TIMER_ALREADY_RUNNING);
                        }
                        now = new Date().toISOString();
                        timerId = "timer_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
                        timerSession = {
                            id: timerId,
                            userId: userId,
                            projectId: request.projectId,
                            taskId: request.taskId,
                            description: request.description,
                            startTime: now,
                            isActive: true,
                            tags: request.tags || [],
                            notes: request.notes,
                            createdAt: now,
                        };
                        dynamoItem = __assign(__assign({ PK: "TIMER#".concat(userId), SK: 'ACTIVE' }, timerSession), { tags: JSON.stringify(timerSession.tags), expiresAt: (Math.floor(Date.now() / 1000) + (24 * 60 * 60)).toString() });
                        return [4 /*yield*/, docClient.send(new lib_dynamodb_1.PutCommand({
                                TableName: this.timeEntriesTable,
                                Item: dynamoItem,
                            }))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, timerSession];
                }
            });
        });
    };
    TimeEntryRepository.prototype.getActiveTimer = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result, item;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, docClient.send(new lib_dynamodb_1.GetCommand({
                            TableName: this.timeEntriesTable,
                            Key: {
                                PK: "TIMER#".concat(userId),
                                SK: 'ACTIVE',
                            },
                        }))];
                    case 1:
                        result = _a.sent();
                        if (!result.Item) {
                            return [2 /*return*/, null];
                        }
                        item = result.Item;
                        return [2 /*return*/, {
                                id: item.id,
                                userId: item.userId,
                                projectId: item.projectId,
                                taskId: item.taskId,
                                description: item.description,
                                startTime: item.startTime,
                                isActive: item.isActive,
                                tags: JSON.parse(item.tags),
                                notes: item.notes,
                                createdAt: item.createdAt,
                            }];
                }
            });
        });
    };
    TimeEntryRepository.prototype.stopTimer = function (userId, timeEntryData) {
        return __awaiter(this, void 0, void 0, function () {
            var timer, now, duration, timeEntry;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getActiveTimer(userId)];
                    case 1:
                        timer = _b.sent();
                        if (!timer) {
                            throw new Error(types_1.TimeEntryErrorCodes.NO_ACTIVE_TIMER);
                        }
                        now = new Date().toISOString();
                        duration = Math.round((new Date(now).getTime() - new Date(timer.startTime).getTime()) / (1000 * 60));
                        return [4 /*yield*/, this.createTimeEntry(userId, {
                                projectId: timer.projectId,
                                taskId: timer.taskId,
                                description: (timeEntryData === null || timeEntryData === void 0 ? void 0 : timeEntryData.finalDescription) || timer.description,
                                date: timer.startTime.split('T')[0], // Extract date from startTime
                                startTime: timer.startTime,
                                endTime: now,
                                duration: duration,
                                isBillable: (_a = timeEntryData === null || timeEntryData === void 0 ? void 0 : timeEntryData.isBillable) !== null && _a !== void 0 ? _a : true,
                                hourlyRate: timeEntryData === null || timeEntryData === void 0 ? void 0 : timeEntryData.hourlyRate,
                                tags: (timeEntryData === null || timeEntryData === void 0 ? void 0 : timeEntryData.finalTags) || timer.tags,
                                notes: (timeEntryData === null || timeEntryData === void 0 ? void 0 : timeEntryData.finalNotes) || timer.notes,
                            })];
                    case 2:
                        timeEntry = _b.sent();
                        // Mark time entry as timer-created
                        return [4 /*yield*/, this.updateTimeEntry(timeEntry.id, {
                            // Update to mark as timer entry
                            })];
                    case 3:
                        // Mark time entry as timer-created
                        _b.sent();
                        // Delete the timer session
                        return [4 /*yield*/, docClient.send(new lib_dynamodb_1.DeleteCommand({
                                TableName: this.timeEntriesTable,
                                Key: {
                                    PK: "TIMER#".concat(userId),
                                    SK: 'ACTIVE',
                                },
                            }))];
                    case 4:
                        // Delete the timer session
                        _b.sent();
                        return [2 /*return*/, timeEntry];
                }
            });
        });
    };
    // ==========================================
    // Helper Methods
    // ==========================================
    TimeEntryRepository.prototype.updateTimeEntryStatus = function (timeEntryId, status, actionBy, reason) {
        return __awaiter(this, void 0, void 0, function () {
            var now, updateExpression, expressionAttributeNames, expressionAttributeValues;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = new Date().toISOString();
                        updateExpression = ['#status = :status', '#updatedAt = :updatedAt'];
                        expressionAttributeNames = {
                            '#status': 'status',
                            '#updatedAt': 'updatedAt',
                        };
                        expressionAttributeValues = {
                            ':status': status,
                            ':updatedAt': now,
                        };
                        // Update GSI3 for status queries
                        updateExpression.push('#GSI3PK = :gsi3pk');
                        expressionAttributeNames['#GSI3PK'] = 'GSI3PK';
                        expressionAttributeValues[':gsi3pk'] = "STATUS#".concat(status);
                        if (status === 'submitted') {
                            updateExpression.push('#submittedAt = :submittedAt');
                            expressionAttributeNames['#submittedAt'] = 'submittedAt';
                            expressionAttributeValues[':submittedAt'] = now;
                            // Update GSI4 for approval workflow
                            updateExpression.push('#GSI4PK = :gsi4pk', '#GSI4SK = :gsi4sk');
                            expressionAttributeNames['#GSI4PK'] = 'GSI4PK';
                            expressionAttributeNames['#GSI4SK'] = 'GSI4SK';
                            expressionAttributeValues[':gsi4pk'] = "APPROVAL#".concat(status);
                            expressionAttributeValues[':gsi4sk'] = "SUBMITTED_AT#".concat(now, "#TIME_ENTRY#").concat(timeEntryId);
                        }
                        else if (status === 'approved') {
                            updateExpression.push('#approvedAt = :approvedAt', '#approvedBy = :approvedBy');
                            expressionAttributeNames['#approvedAt'] = 'approvedAt';
                            expressionAttributeNames['#approvedBy'] = 'approvedBy';
                            expressionAttributeValues[':approvedAt'] = now;
                            expressionAttributeValues[':approvedBy'] = actionBy;
                        }
                        else if (status === 'rejected') {
                            updateExpression.push('#rejectedAt = :rejectedAt');
                            expressionAttributeNames['#rejectedAt'] = 'rejectedAt';
                            expressionAttributeValues[':rejectedAt'] = now;
                            if (reason) {
                                updateExpression.push('#rejectionReason = :rejectionReason');
                                expressionAttributeNames['#rejectionReason'] = 'rejectionReason';
                                expressionAttributeValues[':rejectionReason'] = reason;
                            }
                        }
                        return [4 /*yield*/, docClient.send(new lib_dynamodb_1.UpdateCommand({
                                TableName: this.timeEntriesTable,
                                Key: {
                                    PK: "TIME_ENTRY#".concat(timeEntryId),
                                    SK: "TIME_ENTRY#".concat(timeEntryId),
                                },
                                UpdateExpression: "SET ".concat(updateExpression.join(', ')),
                                ExpressionAttributeNames: expressionAttributeNames,
                                ExpressionAttributeValues: expressionAttributeValues,
                            }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TimeEntryRepository.prototype.mapDynamoItemToTimeEntry = function (item) {
        return {
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
        };
    };
    return TimeEntryRepository;
}());
exports.TimeEntryRepository = TimeEntryRepository;
