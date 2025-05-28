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
var validation_1 = require("../shared/validation");
var client_repository_1 = require("../shared/client-repository");
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var currentUserId, requestBody, validation, clientRepository, nameExists, newClient, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                currentUserId = (0, auth_helper_1.getCurrentUserId)(event);
                if (!currentUserId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                requestBody = void 0;
                try {
                    requestBody = JSON.parse(event.body || '{}');
                }
                catch (_b) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_JSON', 'Invalid JSON in request body')];
                }
                // Add current user as creator
                requestBody.createdBy = currentUserId;
                validation = validation_1.ValidationService.validateCreateClientRequest(requestBody);
                if (!validation.isValid) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'VALIDATION_ERROR', validation.errors.join(', '))];
                }
                clientRepository = new client_repository_1.ClientRepository();
                return [4 /*yield*/, clientRepository.checkClientNameExists(requestBody.name)];
            case 1:
                nameExists = _a.sent();
                if (nameExists) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(409, 'CLIENT_NAME_EXISTS', 'A client with this name already exists')];
                }
                return [4 /*yield*/, clientRepository.createClient(requestBody)];
            case 2:
                newClient = _a.sent();
                return [2 /*return*/, (0, response_helper_1.createSuccessResponse)(newClient, 201, 'Client created successfully')];
            case 3:
                error_1 = _a.sent();
                // Handle specific DynamoDB errors
                if (error_1 instanceof Error) {
                    if (error_1.message.includes('ConditionalCheckFailedException')) {
                        return [2 /*return*/, (0, response_helper_1.createErrorResponse)(409, 'CLIENT_ALREADY_EXISTS', 'A client with this ID already exists')];
                    }
                }
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred')];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
