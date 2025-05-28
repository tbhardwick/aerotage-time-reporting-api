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
exports.ClientRepository = void 0;
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var ClientRepository = /** @class */ (function () {
    function ClientRepository() {
        var client = new client_dynamodb_1.DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
        this.dynamoClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
        this.tableName = process.env.CLIENTS_TABLE || 'aerotage-clients-dev';
    }
    /**
     * Create a new client
     */
    ClientRepository.prototype.createClient = function (client) {
        return __awaiter(this, void 0, void 0, function () {
            var now, clientId, newClient, dynamoItem;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = new Date().toISOString();
                        clientId = "client_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
                        newClient = __assign(__assign({}, client), { id: clientId, createdAt: now, updatedAt: now });
                        dynamoItem = {
                            id: clientId,
                            name: client.name,
                            email: client.email,
                            phone: client.phone,
                            address: client.address,
                            contactPerson: client.contactPerson,
                            defaultHourlyRate: client.defaultHourlyRate,
                            isActive: client.isActive ? 'true' : 'false', // String for GSI
                            notes: client.notes,
                            createdAt: now,
                            updatedAt: now,
                            createdBy: client.createdBy,
                        };
                        return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.PutCommand({
                                TableName: this.tableName,
                                Item: dynamoItem,
                                ConditionExpression: 'attribute_not_exists(id)',
                            }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, newClient];
                }
            });
        });
    };
    /**
     * Get client by ID
     */
    ClientRepository.prototype.getClientById = function (clientId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.GetCommand({
                            TableName: this.tableName,
                            Key: {
                                id: clientId,
                            },
                        }))];
                    case 1:
                        result = _a.sent();
                        if (!result.Item) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, this.mapDynamoItemToClient(result.Item)];
                }
            });
        });
    };
    /**
     * Update client
     */
    ClientRepository.prototype.updateClient = function (clientId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var now, updateExpressions, expressionAttributeNames, expressionAttributeValues, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = new Date().toISOString();
                        updateExpressions = [];
                        expressionAttributeNames = {};
                        expressionAttributeValues = {};
                        if (updates.name !== undefined) {
                            updateExpressions.push('#name = :name');
                            expressionAttributeNames['#name'] = 'name';
                            expressionAttributeValues[':name'] = updates.name;
                        }
                        if (updates.email !== undefined) {
                            updateExpressions.push('email = :email');
                            expressionAttributeValues[':email'] = updates.email;
                        }
                        if (updates.phone !== undefined) {
                            updateExpressions.push('phone = :phone');
                            expressionAttributeValues[':phone'] = updates.phone;
                        }
                        if (updates.address !== undefined) {
                            updateExpressions.push('address = :address');
                            expressionAttributeValues[':address'] = updates.address;
                        }
                        if (updates.contactPerson !== undefined) {
                            updateExpressions.push('contactPerson = :contactPerson');
                            expressionAttributeValues[':contactPerson'] = updates.contactPerson;
                        }
                        if (updates.defaultHourlyRate !== undefined) {
                            updateExpressions.push('defaultHourlyRate = :defaultHourlyRate');
                            expressionAttributeValues[':defaultHourlyRate'] = updates.defaultHourlyRate;
                        }
                        if (updates.isActive !== undefined) {
                            updateExpressions.push('isActive = :isActive');
                            expressionAttributeValues[':isActive'] = updates.isActive ? 'true' : 'false';
                        }
                        if (updates.notes !== undefined) {
                            updateExpressions.push('notes = :notes');
                            expressionAttributeValues[':notes'] = updates.notes;
                        }
                        // Always update the updatedAt timestamp
                        updateExpressions.push('updatedAt = :updatedAt');
                        expressionAttributeValues[':updatedAt'] = now;
                        if (updateExpressions.length === 1) { // Only updatedAt
                            throw new Error('No valid updates provided');
                        }
                        return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.UpdateCommand({
                                TableName: this.tableName,
                                Key: {
                                    id: clientId,
                                },
                                UpdateExpression: "SET ".concat(updateExpressions.join(', ')),
                                ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
                                ExpressionAttributeValues: expressionAttributeValues,
                                ConditionExpression: 'attribute_exists(id)',
                                ReturnValues: 'ALL_NEW',
                            }))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, this.mapDynamoItemToClient(result.Attributes)];
                }
            });
        });
    };
    /**
     * Delete client (soft delete by setting isActive to false)
     */
    ClientRepository.prototype.deleteClient = function (clientId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.updateClient(clientId, { isActive: false })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Hard delete client (permanent removal)
     */
    ClientRepository.prototype.hardDeleteClient = function (clientId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.DeleteCommand({
                            TableName: this.tableName,
                            Key: {
                                id: clientId,
                            },
                            ConditionExpression: 'attribute_exists(id)',
                        }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * List clients with filtering and pagination
     */
    ClientRepository.prototype.listClients = function () {
        return __awaiter(this, arguments, void 0, function (filters) {
            var limit, offset, queryCommand, result, items, clients, paginatedClients, hasMore;
            var _this = this;
            if (filters === void 0) { filters = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        limit = Math.min(filters.limit || 50, 100);
                        offset = filters.offset || 0;
                        if (filters.isActive !== undefined) {
                            // Query by status using GSI
                            queryCommand = new lib_dynamodb_1.QueryCommand({
                                TableName: this.tableName,
                                IndexName: 'StatusIndex',
                                KeyConditionExpression: 'isActive = :status',
                                ExpressionAttributeValues: {
                                    ':status': filters.isActive ? 'true' : 'false',
                                },
                                Limit: limit + offset,
                                ScanIndexForward: filters.sortOrder !== 'desc',
                            });
                        }
                        else {
                            // Scan all clients
                            queryCommand = new lib_dynamodb_1.ScanCommand({
                                TableName: this.tableName,
                                Limit: limit + offset,
                            });
                        }
                        return [4 /*yield*/, this.dynamoClient.send(queryCommand)];
                    case 1:
                        result = _a.sent();
                        items = result.Items || [];
                        clients = items.map(function (item) { return _this.mapDynamoItemToClient(item); });
                        // Apply sorting if not using GSI
                        if (filters.isActive === undefined && filters.sortBy) {
                            clients.sort(function (a, b) {
                                var aValue = a[filters.sortBy];
                                var bValue = b[filters.sortBy];
                                // Handle undefined values
                                if (aValue === undefined && bValue === undefined)
                                    return 0;
                                if (aValue === undefined)
                                    return 1;
                                if (bValue === undefined)
                                    return -1;
                                if (filters.sortOrder === 'desc') {
                                    return bValue > aValue ? 1 : -1;
                                }
                                return aValue > bValue ? 1 : -1;
                            });
                        }
                        paginatedClients = clients.slice(offset, offset + limit);
                        hasMore = clients.length > offset + limit;
                        return [2 /*return*/, {
                                clients: paginatedClients,
                                total: clients.length,
                                hasMore: hasMore,
                            }];
                }
            });
        });
    };
    /**
     * Get active clients only
     */
    ClientRepository.prototype.getActiveClients = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.listClients({ isActive: true })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.clients];
                }
            });
        });
    };
    /**
     * Search clients by name
     */
    ClientRepository.prototype.searchClientsByName = function (searchTerm) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.ScanCommand({
                            TableName: this.tableName,
                            FilterExpression: 'contains(#name, :searchTerm)',
                            ExpressionAttributeNames: {
                                '#name': 'name',
                            },
                            ExpressionAttributeValues: {
                                ':searchTerm': searchTerm,
                            },
                        }))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, (result.Items || []).map(function (item) { return _this.mapDynamoItemToClient(item); })];
                }
            });
        });
    };
    /**
     * Check if client name already exists
     */
    ClientRepository.prototype.checkClientNameExists = function (name, excludeClientId) {
        return __awaiter(this, void 0, void 0, function () {
            var result, existingClients;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.ScanCommand({
                            TableName: this.tableName,
                            FilterExpression: '#name = :name',
                            ExpressionAttributeNames: {
                                '#name': 'name',
                            },
                            ExpressionAttributeValues: {
                                ':name': name,
                            },
                        }))];
                    case 1:
                        result = _a.sent();
                        existingClients = result.Items || [];
                        if (excludeClientId) {
                            return [2 /*return*/, existingClients.some(function (item) { return item.id !== excludeClientId; })];
                        }
                        return [2 /*return*/, existingClients.length > 0];
                }
            });
        });
    };
    /**
     * Map DynamoDB item to Client object
     */
    ClientRepository.prototype.mapDynamoItemToClient = function (item) {
        return {
            id: item.id,
            name: item.name,
            email: item.email,
            phone: item.phone,
            address: item.address,
            contactPerson: item.contactPerson,
            defaultHourlyRate: item.defaultHourlyRate,
            isActive: item.isActive === 'true', // Convert string back to boolean
            notes: item.notes,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            createdBy: item.createdBy,
        };
    };
    return ClientRepository;
}());
exports.ClientRepository = ClientRepository;
