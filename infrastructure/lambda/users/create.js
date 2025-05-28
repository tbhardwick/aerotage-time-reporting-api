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
var user_repository_1 = require("../shared/user-repository");
var types_1 = require("../shared/types");
var validation_1 = require("../shared/validation");
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var userRepo = new user_repository_1.UserRepository();
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var authContext, currentUserId, userRole, createUserRequest, validation, existingUser, newUser, response, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                console.log('📝 Create User Handler - Request received:', {
                    httpMethod: event.httpMethod,
                    path: event.path,
                    body: event.body ? 'Present' : 'None',
                    headers: {
                        authorization: event.headers.authorization ? 'Bearer [REDACTED]' : 'None',
                        'content-type': event.headers['content-type']
                    }
                });
                authContext = event.requestContext.authorizer;
                currentUserId = (0, auth_helper_1.getCurrentUserId)(event);
                userRole = (authContext === null || authContext === void 0 ? void 0 : authContext.role) || ((_a = authContext === null || authContext === void 0 ? void 0 : authContext.claims) === null || _a === void 0 ? void 0 : _a['custom:role']);
                if (!currentUserId) {
                    console.log('❌ No user ID found in authorization context');
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User not authenticated')];
                }
                // Check if user has permission to create users (admin only)
                if (userRole !== 'admin') {
                    console.log("\u274C Insufficient permissions. User role: ".concat(userRole));
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(403, types_1.UserErrorCodes.INSUFFICIENT_PERMISSIONS, 'Only admins can create users')];
                }
                // Parse and validate request body
                if (!event.body) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_REQUEST', 'Request body is required')];
                }
                createUserRequest = void 0;
                try {
                    createUserRequest = JSON.parse(event.body);
                }
                catch (error) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_JSON', 'Invalid JSON in request body')];
                }
                console.log('📋 Validating create user request...');
                validation = validation_1.ValidationService.validateCreateUserRequest(createUserRequest);
                if (!validation.isValid) {
                    console.log('❌ Validation failed:', validation.errors);
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.UserErrorCodes.INVALID_USER_DATA, 'Validation failed')];
                }
                // Check if user already exists
                console.log('🔍 Checking if user already exists...');
                return [4 /*yield*/, userRepo.getUserByEmail(createUserRequest.email)];
            case 1:
                existingUser = _b.sent();
                if (existingUser) {
                    console.log('❌ User already exists with email:', createUserRequest.email);
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(409, types_1.UserErrorCodes.USER_ALREADY_EXISTS, 'User with this email already exists')];
                }
                // Create the user
                console.log('👤 Creating new user...');
                return [4 /*yield*/, userRepo.createUser({
                        email: createUserRequest.email,
                        name: createUserRequest.name,
                        role: createUserRequest.role || 'employee',
                        department: createUserRequest.department,
                        jobTitle: createUserRequest.jobTitle,
                        hourlyRate: createUserRequest.hourlyRate,
                        permissions: createUserRequest.permissions || { features: [], projects: [] },
                        preferences: {
                            theme: 'light',
                            notifications: true,
                            timezone: 'UTC'
                        },
                        contactInfo: createUserRequest.contactInfo,
                        invitedBy: currentUserId
                    })];
            case 2:
                newUser = _b.sent();
                console.log('✅ User created successfully:', newUser.id);
                response = {
                    success: true,
                    data: newUser,
                    message: 'User created successfully'
                };
                return [2 /*return*/, {
                        statusCode: 201,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _b.sent();
                console.error('❌ Error creating user:', error_1);
                // Handle specific errors
                if (error_1.message === types_1.UserErrorCodes.USER_ALREADY_EXISTS) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(409, types_1.UserErrorCodes.USER_ALREADY_EXISTS, 'User with this email already exists')];
                }
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred while creating the user')];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
