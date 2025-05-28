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
exports.ProjectRepository = void 0;
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var ProjectRepository = /** @class */ (function () {
    function ProjectRepository() {
        var client = new client_dynamodb_1.DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
        this.dynamoClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
        this.tableName = process.env.PROJECTS_TABLE || 'aerotage-projects-dev';
    }
    /**
     * Create a new project
     */
    ProjectRepository.prototype.createProject = function (project) {
        return __awaiter(this, void 0, void 0, function () {
            var now, projectId, newProject, dynamoItem;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = new Date().toISOString();
                        projectId = "project_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
                        newProject = __assign(__assign({}, project), { id: projectId, createdAt: now, updatedAt: now });
                        dynamoItem = {
                            id: projectId,
                            name: project.name,
                            clientId: project.clientId,
                            clientName: project.clientName,
                            description: project.description,
                            status: project.status,
                            defaultHourlyRate: project.defaultHourlyRate,
                            defaultBillable: project.defaultBillable,
                            budget: project.budget ? JSON.stringify(project.budget) : undefined,
                            deadline: project.deadline,
                            teamMembers: JSON.stringify(project.teamMembers),
                            tags: JSON.stringify(project.tags),
                            createdAt: now,
                            updatedAt: now,
                            createdBy: project.createdBy,
                        };
                        return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.PutCommand({
                                TableName: this.tableName,
                                Item: dynamoItem,
                                ConditionExpression: 'attribute_not_exists(id)',
                            }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, newProject];
                }
            });
        });
    };
    /**
     * Get project by ID
     */
    ProjectRepository.prototype.getProjectById = function (projectId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.GetCommand({
                            TableName: this.tableName,
                            Key: {
                                id: projectId,
                            },
                        }))];
                    case 1:
                        result = _a.sent();
                        if (!result.Item) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, this.mapDynamoItemToProject(result.Item)];
                }
            });
        });
    };
    /**
     * Update project
     */
    ProjectRepository.prototype.updateProject = function (projectId, updates) {
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
                        if (updates.clientId !== undefined) {
                            updateExpressions.push('clientId = :clientId');
                            expressionAttributeValues[':clientId'] = updates.clientId;
                        }
                        if (updates.clientName !== undefined) {
                            updateExpressions.push('clientName = :clientName');
                            expressionAttributeValues[':clientName'] = updates.clientName;
                        }
                        if (updates.description !== undefined) {
                            updateExpressions.push('description = :description');
                            expressionAttributeValues[':description'] = updates.description;
                        }
                        if (updates.status !== undefined) {
                            updateExpressions.push('#status = :status');
                            expressionAttributeNames['#status'] = 'status';
                            expressionAttributeValues[':status'] = updates.status;
                        }
                        if (updates.defaultHourlyRate !== undefined) {
                            updateExpressions.push('defaultHourlyRate = :defaultHourlyRate');
                            expressionAttributeValues[':defaultHourlyRate'] = updates.defaultHourlyRate;
                        }
                        if (updates.defaultBillable !== undefined) {
                            updateExpressions.push('defaultBillable = :defaultBillable');
                            expressionAttributeValues[':defaultBillable'] = updates.defaultBillable;
                        }
                        if (updates.budget !== undefined) {
                            updateExpressions.push('budget = :budget');
                            expressionAttributeValues[':budget'] = updates.budget ? JSON.stringify(updates.budget) : null;
                        }
                        if (updates.deadline !== undefined) {
                            updateExpressions.push('deadline = :deadline');
                            expressionAttributeValues[':deadline'] = updates.deadline;
                        }
                        if (updates.teamMembers !== undefined) {
                            updateExpressions.push('teamMembers = :teamMembers');
                            expressionAttributeValues[':teamMembers'] = JSON.stringify(updates.teamMembers);
                        }
                        if (updates.tags !== undefined) {
                            updateExpressions.push('tags = :tags');
                            expressionAttributeValues[':tags'] = JSON.stringify(updates.tags);
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
                                    id: projectId,
                                },
                                UpdateExpression: "SET ".concat(updateExpressions.join(', ')),
                                ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
                                ExpressionAttributeValues: expressionAttributeValues,
                                ConditionExpression: 'attribute_exists(id)',
                                ReturnValues: 'ALL_NEW',
                            }))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, this.mapDynamoItemToProject(result.Attributes)];
                }
            });
        });
    };
    /**
     * Delete project
     */
    ProjectRepository.prototype.deleteProject = function (projectId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.DeleteCommand({
                            TableName: this.tableName,
                            Key: {
                                id: projectId,
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
     * List projects with filtering and pagination
     */
    ProjectRepository.prototype.listProjects = function () {
        return __awaiter(this, arguments, void 0, function (filters) {
            var limit, offset, queryCommand, result, items, projects, paginatedProjects, hasMore;
            var _this = this;
            if (filters === void 0) { filters = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        limit = Math.min(filters.limit || 50, 100);
                        offset = filters.offset || 0;
                        if (filters.clientId) {
                            // Query by client using GSI
                            queryCommand = new lib_dynamodb_1.QueryCommand({
                                TableName: this.tableName,
                                IndexName: 'ClientIndex',
                                KeyConditionExpression: 'clientId = :clientId',
                                ExpressionAttributeValues: {
                                    ':clientId': filters.clientId,
                                },
                                Limit: limit + offset,
                                ScanIndexForward: filters.sortOrder !== 'desc',
                            });
                        }
                        else if (filters.status) {
                            // Query by status using GSI
                            queryCommand = new lib_dynamodb_1.QueryCommand({
                                TableName: this.tableName,
                                IndexName: 'StatusIndex',
                                KeyConditionExpression: '#status = :status',
                                ExpressionAttributeNames: {
                                    '#status': 'status',
                                },
                                ExpressionAttributeValues: {
                                    ':status': filters.status,
                                },
                                Limit: limit + offset,
                                ScanIndexForward: filters.sortOrder !== 'desc',
                            });
                        }
                        else {
                            // Scan all projects
                            queryCommand = new lib_dynamodb_1.ScanCommand({
                                TableName: this.tableName,
                                Limit: limit + offset,
                            });
                        }
                        return [4 /*yield*/, this.dynamoClient.send(queryCommand)];
                    case 1:
                        result = _a.sent();
                        items = result.Items || [];
                        projects = items.map(function (item) { return _this.mapDynamoItemToProject(item); });
                        // Apply team member filter if specified
                        if (filters.teamMember) {
                            projects = projects.filter(function (project) {
                                return project.teamMembers.includes(filters.teamMember);
                            });
                        }
                        paginatedProjects = projects.slice(offset, offset + limit);
                        hasMore = projects.length > offset + limit;
                        return [2 /*return*/, {
                                projects: paginatedProjects,
                                total: projects.length,
                                hasMore: hasMore,
                            }];
                }
            });
        });
    };
    /**
     * Get projects by client ID
     */
    ProjectRepository.prototype.getProjectsByClientId = function (clientId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.QueryCommand({
                            TableName: this.tableName,
                            IndexName: 'ClientIndex',
                            KeyConditionExpression: 'clientId = :clientId',
                            ExpressionAttributeValues: {
                                ':clientId': clientId,
                            },
                        }))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, (result.Items || []).map(function (item) { return _this.mapDynamoItemToProject(item); })];
                }
            });
        });
    };
    /**
     * Check if user has access to project
     */
    ProjectRepository.prototype.checkProjectAccess = function (projectId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var project;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getProjectById(projectId)];
                    case 1:
                        project = _a.sent();
                        if (!project) {
                            return [2 /*return*/, false];
                        }
                        // Check if user is a team member
                        return [2 /*return*/, project.teamMembers.includes(userId)];
                }
            });
        });
    };
    /**
     * Map DynamoDB item to Project object
     */
    ProjectRepository.prototype.mapDynamoItemToProject = function (item) {
        return {
            id: item.id,
            name: item.name,
            clientId: item.clientId,
            clientName: item.clientName,
            description: item.description,
            status: item.status,
            defaultHourlyRate: item.defaultHourlyRate,
            defaultBillable: item.defaultBillable,
            budget: item.budget ? JSON.parse(item.budget) : undefined,
            deadline: item.deadline,
            teamMembers: JSON.parse(item.teamMembers || '[]'),
            tags: JSON.parse(item.tags || '[]'),
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            createdBy: item.createdBy,
        };
    };
    return ProjectRepository;
}());
exports.ProjectRepository = ProjectRepository;
