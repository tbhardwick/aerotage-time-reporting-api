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
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, authContext, authenticatedUserId, userRole, userRepository, user, filteredUser, response, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                console.log('Get user request:', JSON.stringify(event, null, 2));
                userId = (_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return [2 /*return*/, createErrorResponse(400, 'INVALID_REQUEST', 'User ID is required')];
                }
                authContext = event.requestContext.authorizer;
                authenticatedUserId = authContext === null || authContext === void 0 ? void 0 : authContext.userId;
                userRole = (authContext === null || authContext === void 0 ? void 0 : authContext.role) || 'employee';
                // Authorization check: users can only get their own data unless they're admin/manager
                if (userId !== authenticatedUserId && userRole !== 'admin' && userRole !== 'manager') {
                    return [2 /*return*/, createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You can only access your own user data')];
                }
                userRepository = new user_repository_1.UserRepository();
                return [4 /*yield*/, userRepository.getUserById(userId)];
            case 1:
                user = _b.sent();
                if (!user) {
                    return [2 /*return*/, createErrorResponse(404, 'USER_NOT_FOUND', 'User not found')];
                }
                filteredUser = user;
                if (userRole === 'employee' && userId === authenticatedUserId) {
                    // Employees can see their own full data
                    filteredUser = user;
                }
                else if (userRole === 'manager') {
                    // Managers can see basic information
                    filteredUser = {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        department: user.department,
                        jobTitle: user.jobTitle,
                        isActive: user.isActive,
                        startDate: user.startDate,
                        createdAt: user.createdAt,
                        preferences: user.preferences,
                    };
                }
                else if (userRole === 'admin') {
                    // Admins can see everything
                    filteredUser = user;
                }
                response = {
                    success: true,
                    data: {
                        user: filteredUser,
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
                error_1 = _b.sent();
                console.error('Error getting user:', error_1);
                return [2 /*return*/, createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Failed to get user')];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function createErrorResponse(statusCode, code, message) {
    var errorResponse = {
        success: false,
        error: {
            code: code,
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
