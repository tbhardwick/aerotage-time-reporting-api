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
    var userId, updateData, authContext, authenticatedUserId, userRole, allowedUpdates, userRepository, existingUser, updatedUser, response, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                console.log('Update user request:', JSON.stringify(event, null, 2));
                userId = (_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return [2 /*return*/, createErrorResponse(400, 'INVALID_REQUEST', 'User ID is required')];
                }
                // Parse request body
                if (!event.body) {
                    return [2 /*return*/, createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required')];
                }
                updateData = JSON.parse(event.body);
                authContext = event.requestContext.authorizer;
                authenticatedUserId = authContext === null || authContext === void 0 ? void 0 : authContext.userId;
                userRole = (authContext === null || authContext === void 0 ? void 0 : authContext.role) || 'employee';
                // Authorization check: users can only update their own basic data unless they're admin
                if (userId !== authenticatedUserId && userRole !== 'admin') {
                    return [2 /*return*/, createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You can only update your own user data')];
                }
                allowedUpdates = {};
                if (userRole === 'admin') {
                    // Admins can update everything
                    if (updateData.name !== undefined)
                        allowedUpdates.name = updateData.name;
                    if (updateData.role !== undefined)
                        allowedUpdates.role = updateData.role;
                    if (updateData.department !== undefined)
                        allowedUpdates.department = updateData.department;
                    if (updateData.jobTitle !== undefined)
                        allowedUpdates.jobTitle = updateData.jobTitle;
                    if (updateData.hourlyRate !== undefined)
                        allowedUpdates.hourlyRate = updateData.hourlyRate;
                    if (updateData.isActive !== undefined)
                        allowedUpdates.isActive = updateData.isActive;
                    if (updateData.permissions !== undefined)
                        allowedUpdates.permissions = updateData.permissions;
                    if (updateData.preferences !== undefined)
                        allowedUpdates.preferences = updateData.preferences;
                    if (updateData.contactInfo !== undefined)
                        allowedUpdates.contactInfo = updateData.contactInfo;
                }
                else if (userId === authenticatedUserId) {
                    // Users can update their own basic information
                    if (updateData.name !== undefined)
                        allowedUpdates.name = updateData.name;
                    if (updateData.preferences !== undefined)
                        allowedUpdates.preferences = updateData.preferences;
                    if (updateData.contactInfo !== undefined)
                        allowedUpdates.contactInfo = updateData.contactInfo;
                    // Users cannot update their own role, permissions, or hourly rate
                    if (updateData.role !== undefined || updateData.permissions !== undefined || updateData.hourlyRate !== undefined) {
                        return [2 /*return*/, createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You cannot update role, permissions, or hourly rate')];
                    }
                }
                // Validate that there are updates to make
                if (Object.keys(allowedUpdates).length === 0) {
                    return [2 /*return*/, createErrorResponse(400, 'INVALID_REQUEST', 'No valid updates provided')];
                }
                userRepository = new user_repository_1.UserRepository();
                return [4 /*yield*/, userRepository.getUserById(userId)];
            case 1:
                existingUser = _b.sent();
                if (!existingUser) {
                    return [2 /*return*/, createErrorResponse(404, 'USER_NOT_FOUND', 'User not found')];
                }
                return [4 /*yield*/, userRepository.updateUser(userId, allowedUpdates)];
            case 2:
                updatedUser = _b.sent();
                response = {
                    success: true,
                    data: {
                        user: updatedUser,
                    },
                    message: 'User updated successfully',
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _b.sent();
                console.error('Error updating user:', error_1);
                return [2 /*return*/, createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Failed to update user')];
            case 4: return [2 /*return*/];
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
