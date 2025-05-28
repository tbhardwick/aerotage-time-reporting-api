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
var client_repository_1 = require("../shared/client-repository");
var project_repository_1 = require("../shared/project-repository");
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var currentUserId, clientId, clientRepository, projectRepository, existingClient, clientProjects, hardDelete, response, error_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                console.log('Delete client request:', JSON.stringify(event, null, 2));
                _c.label = 1;
            case 1:
                _c.trys.push([1, 8, , 9]);
                currentUserId = getCurrentUserId(event);
                if (!currentUserId) {
                    return [2 /*return*/, createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                clientId = (_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.id;
                if (!clientId) {
                    return [2 /*return*/, createErrorResponse(400, 'MISSING_CLIENT_ID', 'Client ID is required')];
                }
                clientRepository = new client_repository_1.ClientRepository();
                projectRepository = new project_repository_1.ProjectRepository();
                return [4 /*yield*/, clientRepository.getClientById(clientId)];
            case 2:
                existingClient = _c.sent();
                if (!existingClient) {
                    return [2 /*return*/, createErrorResponse(404, 'CLIENT_NOT_FOUND', 'Client not found')];
                }
                return [4 /*yield*/, projectRepository.getProjectsByClientId(clientId)];
            case 3:
                clientProjects = _c.sent();
                if (clientProjects.length > 0) {
                    return [2 /*return*/, createErrorResponse(400, 'CLIENT_HAS_PROJECTS', "Cannot delete client. There are ".concat(clientProjects.length, " project(s) associated with this client. Please reassign or delete the projects first."))];
                }
                hardDelete = ((_b = event.queryStringParameters) === null || _b === void 0 ? void 0 : _b.hard) === 'true';
                if (!hardDelete) return [3 /*break*/, 5];
                // Hard delete (permanent removal)
                return [4 /*yield*/, clientRepository.hardDeleteClient(clientId)];
            case 4:
                // Hard delete (permanent removal)
                _c.sent();
                return [3 /*break*/, 7];
            case 5: 
            // Soft delete (set isActive to false)
            return [4 /*yield*/, clientRepository.deleteClient(clientId)];
            case 6:
                // Soft delete (set isActive to false)
                _c.sent();
                _c.label = 7;
            case 7:
                response = {
                    success: true,
                    data: null,
                    message: hardDelete ? 'Client permanently deleted' : 'Client deactivated successfully',
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 8:
                error_1 = _c.sent();
                console.error('Error deleting client:', error_1);
                // Handle specific DynamoDB errors
                if (error_1 instanceof Error) {
                    if (error_1.message.includes('ConditionalCheckFailedException')) {
                        return [2 /*return*/, createErrorResponse(404, 'CLIENT_NOT_FOUND', 'Client not found')];
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
                                message: 'An internal server error occurred',
                            },
                            timestamp: new Date().toISOString(),
                        }),
                    }];
            case 9: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
/**
 * Extracts current user ID from authorization context
 */
function getCurrentUserId(event) {
    var _a;
    var authContext = event.requestContext.authorizer;
    // Primary: get from custom authorizer context
    if (authContext === null || authContext === void 0 ? void 0 : authContext.userId) {
        return authContext.userId;
    }
    // Fallback: try to get from Cognito claims
    if ((_a = authContext === null || authContext === void 0 ? void 0 : authContext.claims) === null || _a === void 0 ? void 0 : _a.sub) {
        return authContext.claims.sub;
    }
    return null;
}
/**
 * Creates standardized error response
 */
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
