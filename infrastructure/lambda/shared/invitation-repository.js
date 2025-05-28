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
exports.InvitationRepository = void 0;
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var util_dynamodb_1 = require("@aws-sdk/util-dynamodb");
var token_service_1 = require("./token-service");
var InvitationRepository = /** @class */ (function () {
    function InvitationRepository() {
        this.dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
        this.tableName = process.env.USER_INVITATIONS_TABLE || 'aerotage-user-invitations-dev';
    }
    /**
     * Creates a new user invitation
     */
    InvitationRepository.prototype.createInvitation = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var id, now, token, tokenHash, expiresAt, invitation, dynamoItem, command, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = this.generateId();
                        now = new Date().toISOString();
                        token = token_service_1.TokenService.generateInvitationToken();
                        tokenHash = token_service_1.TokenService.hashToken(token);
                        expiresAt = token_service_1.TokenService.calculateExpirationDate(data.expirationDays || 7);
                        invitation = {
                            id: id,
                            email: data.email.toLowerCase(),
                            invitedBy: data.invitedBy,
                            role: data.role,
                            department: data.department,
                            jobTitle: data.jobTitle,
                            hourlyRate: data.hourlyRate,
                            permissions: data.permissions,
                            status: 'pending',
                            invitationToken: token,
                            tokenHash: tokenHash,
                            expiresAt: expiresAt,
                            onboardingCompleted: false,
                            personalMessage: data.personalMessage,
                            createdAt: now,
                            updatedAt: now,
                            emailSentAt: now,
                            resentCount: 0,
                        };
                        dynamoItem = {
                            id: invitation.id, // Primary key matching table schema
                            tokenHash: tokenHash,
                            email: invitation.email,
                            invitedBy: invitation.invitedBy,
                            role: invitation.role,
                            department: invitation.department,
                            jobTitle: invitation.jobTitle,
                            hourlyRate: invitation.hourlyRate,
                            permissions: JSON.stringify(invitation.permissions),
                            status: invitation.status,
                            invitationToken: invitation.invitationToken,
                            expiresAt: invitation.expiresAt,
                            onboardingCompleted: invitation.onboardingCompleted,
                            personalMessage: invitation.personalMessage,
                            createdAt: invitation.createdAt,
                            updatedAt: invitation.updatedAt,
                            emailSentAt: invitation.emailSentAt,
                            resentCount: invitation.resentCount,
                        };
                        command = new client_dynamodb_1.PutItemCommand({
                            TableName: this.tableName,
                            Item: (0, util_dynamodb_1.marshall)(dynamoItem, { removeUndefinedValues: true }),
                            ConditionExpression: 'attribute_not_exists(id)', // Use the actual partition key name
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.dynamoClient.send(command)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, invitation];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Error creating invitation:', error_1);
                        throw new Error('Failed to create invitation');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Gets an invitation by ID
     */
    InvitationRepository.prototype.getInvitationById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var command, result, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        command = new client_dynamodb_1.GetItemCommand({
                            TableName: this.tableName,
                            Key: (0, util_dynamodb_1.marshall)({
                                id: id,
                            }, { removeUndefinedValues: true }),
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.dynamoClient.send(command)];
                    case 2:
                        result = _a.sent();
                        if (!result.Item) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, this.mapDynamoItemToInvitation((0, util_dynamodb_1.unmarshall)(result.Item))];
                    case 3:
                        error_2 = _a.sent();
                        console.error('Error getting invitation by ID:', error_2);
                        throw new Error('Failed to get invitation');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Gets an invitation by token hash
     */
    InvitationRepository.prototype.getInvitationByTokenHash = function (tokenHash) {
        return __awaiter(this, void 0, void 0, function () {
            var command, result, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        command = new client_dynamodb_1.QueryCommand({
                            TableName: this.tableName,
                            IndexName: 'TokenHashIndexV2',
                            KeyConditionExpression: 'tokenHash = :tokenHash',
                            ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                                ':tokenHash': tokenHash,
                            }, { removeUndefinedValues: true }),
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.dynamoClient.send(command)];
                    case 2:
                        result = _a.sent();
                        if (!result.Items || result.Items.length === 0) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, this.mapDynamoItemToInvitation((0, util_dynamodb_1.unmarshall)(result.Items[0]))];
                    case 3:
                        error_3 = _a.sent();
                        console.error('Error getting invitation by token hash:', error_3);
                        throw new Error('Failed to get invitation');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Checks if an email already has a pending invitation
     */
    InvitationRepository.prototype.checkEmailExists = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var command, result, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        command = new client_dynamodb_1.ScanCommand({
                            TableName: this.tableName,
                            FilterExpression: '#email = :email AND #status = :status',
                            ExpressionAttributeNames: {
                                '#email': 'email',
                                '#status': 'status',
                            },
                            ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                                ':email': email.toLowerCase(),
                                ':status': 'pending',
                            }, { removeUndefinedValues: true }),
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.dynamoClient.send(command)];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, (result.Items && result.Items.length > 0) || false];
                    case 3:
                        error_4 = _a.sent();
                        console.error('Error checking email exists:', error_4);
                        throw new Error('Failed to check email existence');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Lists invitations with filters and pagination
     */
    InvitationRepository.prototype.listInvitations = function (filters) {
        return __awaiter(this, void 0, void 0, function () {
            var limit, offset, filterExpression, expressionAttributeNames, expressionAttributeValues, command, result, items, invitations, paginatedInvitations, hasMore, error_5;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        limit = filters.limit || 50;
                        offset = filters.offset || 0;
                        filterExpression = '';
                        expressionAttributeNames = {};
                        expressionAttributeValues = {};
                        if (filters.status) {
                            filterExpression = '#status = :status';
                            expressionAttributeNames['#status'] = 'status';
                            expressionAttributeValues[':status'] = filters.status;
                        }
                        command = new client_dynamodb_1.ScanCommand({
                            TableName: this.tableName,
                            FilterExpression: filterExpression || undefined,
                            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
                            ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 ? (0, util_dynamodb_1.marshall)(expressionAttributeValues, { removeUndefinedValues: true }) : undefined,
                            Limit: limit + offset + 1, // Get one extra to check if there are more
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.dynamoClient.send(command)];
                    case 2:
                        result = _a.sent();
                        items = result.Items || [];
                        invitations = items
                            .map(function (item) { return _this.mapDynamoItemToInvitation((0, util_dynamodb_1.unmarshall)(item)); });
                        // Sort by createdAt (newest first) since we don't have GSI sorting
                        invitations.sort(function (a, b) { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); });
                        paginatedInvitations = invitations.slice(offset, offset + limit);
                        hasMore = invitations.length > offset + limit;
                        return [2 /*return*/, {
                                invitations: paginatedInvitations,
                                total: invitations.length,
                                hasMore: hasMore,
                            }];
                    case 3:
                        error_5 = _a.sent();
                        console.error('Error listing invitations:', error_5);
                        throw new Error('Failed to list invitations');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Updates an invitation
     */
    InvitationRepository.prototype.updateInvitation = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var now, updateExpressions, expressionAttributeNames, expressionAttributeValues, command, result, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = new Date().toISOString();
                        updates.updatedAt = now;
                        updateExpressions = ['#updatedAt = :updatedAt'];
                        expressionAttributeNames = {
                            '#updatedAt': 'updatedAt',
                        };
                        expressionAttributeValues = {
                            ':updatedAt': now,
                        };
                        Object.entries(updates).forEach(function (_a) {
                            var key = _a[0], value = _a[1];
                            if (key !== 'updatedAt' && value !== undefined) {
                                updateExpressions.push("#".concat(key, " = :").concat(key));
                                expressionAttributeNames["#".concat(key)] = key;
                                expressionAttributeValues[":".concat(key)] = key === 'permissions' ? JSON.stringify(value) : value;
                            }
                        });
                        command = new client_dynamodb_1.UpdateItemCommand({
                            TableName: this.tableName,
                            Key: (0, util_dynamodb_1.marshall)({
                                id: id,
                            }, { removeUndefinedValues: true }),
                            UpdateExpression: "SET ".concat(updateExpressions.join(', ')),
                            ExpressionAttributeNames: expressionAttributeNames,
                            ExpressionAttributeValues: (0, util_dynamodb_1.marshall)(expressionAttributeValues, { removeUndefinedValues: true }),
                            ReturnValues: 'ALL_NEW',
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.dynamoClient.send(command)];
                    case 2:
                        result = _a.sent();
                        if (!result.Attributes) {
                            throw new Error('Invitation not found');
                        }
                        return [2 /*return*/, this.mapDynamoItemToInvitation((0, util_dynamodb_1.unmarshall)(result.Attributes))];
                    case 3:
                        error_6 = _a.sent();
                        console.error('Error updating invitation:', error_6);
                        throw new Error('Failed to update invitation');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Deletes an invitation
     */
    InvitationRepository.prototype.deleteInvitation = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var command, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        command = new client_dynamodb_1.DeleteItemCommand({
                            TableName: this.tableName,
                            Key: (0, util_dynamodb_1.marshall)({
                                id: id,
                            }, { removeUndefinedValues: true }),
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.dynamoClient.send(command)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_7 = _a.sent();
                        console.error('Error deleting invitation:', error_7);
                        throw new Error('Failed to delete invitation');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Marks invitation as accepted
     */
    InvitationRepository.prototype.acceptInvitation = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var now;
            return __generator(this, function (_a) {
                now = new Date().toISOString();
                return [2 /*return*/, this.updateInvitation(id, {
                        status: 'accepted',
                        acceptedAt: now,
                    })];
            });
        });
    };
    /**
     * Resends invitation and optionally extends expiration
     */
    InvitationRepository.prototype.resendInvitation = function (id_1) {
        return __awaiter(this, arguments, void 0, function (id, extendExpiration, personalMessage) {
            var invitation, now, updates;
            if (extendExpiration === void 0) { extendExpiration = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getInvitationById(id)];
                    case 1:
                        invitation = _a.sent();
                        if (!invitation) {
                            throw new Error('Invitation not found');
                        }
                        now = new Date().toISOString();
                        updates = {
                            resentCount: invitation.resentCount + 1,
                            lastResentAt: now,
                        };
                        if (extendExpiration) {
                            updates.expiresAt = token_service_1.TokenService.calculateExpirationDate(7);
                        }
                        if (personalMessage !== undefined) {
                            updates.personalMessage = personalMessage;
                        }
                        return [2 /*return*/, this.updateInvitation(id, updates)];
                }
            });
        });
    };
    /**
     * Maps DynamoDB item to UserInvitation object
     */
    InvitationRepository.prototype.mapDynamoItemToInvitation = function (item) {
        return {
            id: item.id,
            email: item.email,
            invitedBy: item.invitedBy,
            role: item.role,
            department: item.department,
            jobTitle: item.jobTitle,
            hourlyRate: item.hourlyRate,
            permissions: JSON.parse(item.permissions || '{"features":[],"projects":[]}'),
            status: item.status,
            invitationToken: item.invitationToken,
            tokenHash: item.tokenHash,
            expiresAt: item.expiresAt,
            acceptedAt: item.acceptedAt,
            onboardingCompleted: item.onboardingCompleted || false,
            personalMessage: item.personalMessage,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            emailSentAt: item.emailSentAt,
            resentCount: item.resentCount || 0,
            lastResentAt: item.lastResentAt,
        };
    };
    /**
     * Generates a unique invitation ID
     */
    InvitationRepository.prototype.generateId = function () {
        return "inv_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
    };
    return InvitationRepository;
}());
exports.InvitationRepository = InvitationRepository;
