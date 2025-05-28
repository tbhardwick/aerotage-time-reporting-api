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
exports.UserRepository = void 0;
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var UserRepository = /** @class */ (function () {
    function UserRepository() {
        var dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
        this.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
        this.usersTableName = process.env.USERS_TABLE || 'aerotage-users-dev';
    }
    /**
     * Creates a new user
     */
    UserRepository.prototype.createUser = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var id, now, user, userItem, putUserCommand, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = this.generateId();
                        now = new Date().toISOString();
                        user = {
                            id: id,
                            email: data.email.toLowerCase(),
                            name: data.name,
                            role: data.role,
                            department: data.department,
                            jobTitle: data.jobTitle,
                            hourlyRate: data.hourlyRate,
                            permissions: data.permissions || { features: [], projects: [] },
                            invitationId: data.invitationId,
                            invitedBy: data.invitedBy,
                            isActive: true,
                            startDate: now,
                            preferences: data.preferences || { theme: 'light', notifications: true, timezone: 'UTC' },
                            contactInfo: data.contactInfo,
                            createdAt: now,
                            updatedAt: now,
                            createdBy: data.invitedBy || 'system',
                        };
                        userItem = {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            role: user.role,
                            department: user.department,
                            jobTitle: user.jobTitle,
                            hourlyRate: user.hourlyRate,
                            permissions: JSON.stringify(user.permissions),
                            invitationId: user.invitationId,
                            invitedBy: user.invitedBy,
                            isActive: user.isActive,
                            startDate: user.startDate,
                            preferences: JSON.stringify(user.preferences),
                            contactInfo: JSON.stringify(user.contactInfo),
                            createdAt: user.createdAt,
                            updatedAt: user.updatedAt,
                            createdBy: user.createdBy,
                        };
                        putUserCommand = new lib_dynamodb_1.PutCommand({
                            TableName: this.usersTableName,
                            Item: userItem,
                            ConditionExpression: 'attribute_not_exists(id)',
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.docClient.send(putUserCommand)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, user];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Error creating user:', error_1);
                        throw new Error('Failed to create user');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Gets a user by ID
     */
    UserRepository.prototype.getUserById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var command, result, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        command = new lib_dynamodb_1.GetCommand({
                            TableName: this.usersTableName,
                            Key: { id: id },
                        });
                        return [4 /*yield*/, this.docClient.send(command)];
                    case 1:
                        result = _a.sent();
                        if (!result.Item) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, this.mapDynamoItemToUser(result.Item)];
                    case 2:
                        error_2 = _a.sent();
                        console.error('Error getting user by ID:', error_2);
                        throw new Error('Failed to get user');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Gets a user by email
     */
    UserRepository.prototype.getUserByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var command, result, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        command = new lib_dynamodb_1.ScanCommand({
                            TableName: this.usersTableName,
                            FilterExpression: 'email = :email',
                            ExpressionAttributeValues: {
                                ':email': email.toLowerCase(),
                            },
                        });
                        return [4 /*yield*/, this.docClient.send(command)];
                    case 1:
                        result = _a.sent();
                        if (!result.Items || result.Items.length === 0) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, this.mapDynamoItemToUser(result.Items[0])];
                    case 2:
                        error_3 = _a.sent();
                        console.error('Error getting user by email:', error_3);
                        throw new Error('Failed to get user');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Gets all users
     */
    UserRepository.prototype.getAllUsers = function () {
        return __awaiter(this, void 0, void 0, function () {
            var command, result, error_4;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        command = new lib_dynamodb_1.ScanCommand({
                            TableName: this.usersTableName,
                        });
                        return [4 /*yield*/, this.docClient.send(command)];
                    case 1:
                        result = _a.sent();
                        if (!result.Items || result.Items.length === 0) {
                            return [2 /*return*/, []];
                        }
                        return [2 /*return*/, result.Items.map(function (item) { return _this.mapDynamoItemToUser(item); })];
                    case 2:
                        error_4 = _a.sent();
                        console.error('Error getting all users:', error_4);
                        throw new Error('Failed to get users');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Updates a user
     */
    UserRepository.prototype.updateUser = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var now, updateExpressions, expressionAttributeNames, expressionAttributeValues, command, result, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = new Date().toISOString();
                        updateExpressions = [];
                        expressionAttributeNames = {};
                        expressionAttributeValues = {};
                        Object.entries(updates).forEach(function (_a) {
                            var key = _a[0], value = _a[1];
                            if (key !== 'id' && key !== 'createdAt' && value !== undefined) {
                                var attrName = "#".concat(key);
                                var attrValue = ":".concat(key);
                                updateExpressions.push("".concat(attrName, " = ").concat(attrValue));
                                expressionAttributeNames[attrName] = key;
                                if (key === 'permissions') {
                                    expressionAttributeValues[attrValue] = JSON.stringify(value);
                                }
                                else if (key === 'preferences') {
                                    expressionAttributeValues[attrValue] = JSON.stringify(value);
                                }
                                else if (key === 'contactInfo') {
                                    expressionAttributeValues[attrValue] = JSON.stringify(value);
                                }
                                else {
                                    expressionAttributeValues[attrValue] = value;
                                }
                            }
                        });
                        // Always update the updatedAt timestamp
                        updateExpressions.push('#updatedAt = :updatedAt');
                        expressionAttributeNames['#updatedAt'] = 'updatedAt';
                        expressionAttributeValues[':updatedAt'] = now;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        command = new lib_dynamodb_1.UpdateCommand({
                            TableName: this.usersTableName,
                            Key: { id: id },
                            UpdateExpression: "SET ".concat(updateExpressions.join(', ')),
                            ExpressionAttributeNames: expressionAttributeNames,
                            ExpressionAttributeValues: expressionAttributeValues,
                            ReturnValues: 'ALL_NEW',
                        });
                        return [4 /*yield*/, this.docClient.send(command)];
                    case 2:
                        result = _a.sent();
                        if (!result.Attributes) {
                            throw new Error('User not found');
                        }
                        return [2 /*return*/, this.mapDynamoItemToUser(result.Attributes)];
                    case 3:
                        error_5 = _a.sent();
                        console.error('Error updating user:', error_5);
                        throw new Error('Failed to update user');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generates a unique ID for users
     */
    UserRepository.prototype.generateId = function () {
        return "user_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
    };
    /**
     * Maps DynamoDB item to User object
     */
    UserRepository.prototype.mapDynamoItemToUser = function (item) {
        // Helper function to safely parse JSON or return object if already parsed
        var safeJsonParse = function (value, defaultValue) {
            if (!value)
                return defaultValue;
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                }
                catch (error) {
                    console.warn('Failed to parse JSON:', value, error);
                    return defaultValue;
                }
            }
            return value; // Already an object
        };
        return {
            id: item.id,
            email: item.email,
            name: item.name,
            role: item.role,
            department: item.department,
            jobTitle: item.jobTitle,
            hourlyRate: item.hourlyRate,
            permissions: safeJsonParse(item.permissions, { features: [], projects: [] }),
            invitationId: item.invitationId,
            invitedBy: item.invitedBy,
            isActive: item.isActive,
            startDate: item.startDate,
            preferences: safeJsonParse(item.preferences, { theme: 'light', notifications: true, timezone: 'UTC' }),
            contactInfo: safeJsonParse(item.contactInfo, undefined),
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            createdBy: item.createdBy,
        };
    };
    return UserRepository;
}());
exports.UserRepository = UserRepository;
