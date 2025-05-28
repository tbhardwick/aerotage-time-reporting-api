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
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var USER_WORK_SCHEDULES_TABLE = process.env.USER_WORK_SCHEDULES_TABLE;
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, targetUserId, workSchedule, defaultSchedule, response_1, response, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                console.log('Get work schedule request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User not authenticated')];
                }
                targetUserId = ((_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.userId) || userId;
                // Check permissions - employees can only view their own schedule
                if ((user === null || user === void 0 ? void 0 : user.role) === 'employee' && targetUserId !== userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(403, 'FORBIDDEN', 'Employees can only view their own work schedule')];
                }
                return [4 /*yield*/, getUserWorkSchedule(targetUserId)];
            case 1:
                workSchedule = _b.sent();
                if (!workSchedule) {
                    defaultSchedule = createDefaultWorkSchedule(targetUserId);
                    response_1 = {
                        success: true,
                        data: defaultSchedule,
                    };
                    return [2 /*return*/, {
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify(response_1),
                        }];
                }
                response = {
                    success: true,
                    data: workSchedule,
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
                error_1 = _b.sent();
                console.error('Error getting work schedule:', error_1);
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred')];
            case 3: return [2 /*return*/];
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
