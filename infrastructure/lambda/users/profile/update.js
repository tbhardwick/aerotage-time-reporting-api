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
exports.handler = void 0;
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var types_1 = require("../../shared/types");
var client = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, updateData, authContext, authenticatedUserId, userRole, validationError, getCommand, currentResult, currentUser, currentTimestamp, defaultProfile, profileData, putCommand, updatedUser, profile, response, error_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                console.log('Update user profile request:', JSON.stringify(event, null, 2));
                userId = (_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required')];
                }
                // Parse request body
                if (!event.body) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required')];
                }
                updateData = JSON.parse(event.body);
                authContext = event.requestContext.authorizer;
                authenticatedUserId = authContext === null || authContext === void 0 ? void 0 : authContext.userId;
                userRole = (authContext === null || authContext === void 0 ? void 0 : authContext.role) || 'employee';
                // Authorization check: users can only update their own profile unless they're admin
                if (userId !== authenticatedUserId && userRole !== 'admin') {
                    return [2 /*return*/, createErrorResponse(403, types_1.ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 'You can only update your own profile')];
                }
                validationError = validateUpdateRequest(updateData);
                if (validationError) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validationError)];
                }
                // Check if hourly rate change requires admin approval
                if (updateData.hourlyRate !== undefined && userRole !== 'admin' && userId === authenticatedUserId) {
                    return [2 /*return*/, createErrorResponse(403, types_1.ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 'Hourly rate changes require admin approval')];
                }
                getCommand = new lib_dynamodb_1.GetCommand({
                    TableName: process.env.USERS_TABLE,
                    Key: { id: userId },
                });
                return [4 /*yield*/, docClient.send(getCommand)];
            case 1:
                currentResult = _c.sent();
                currentUser = currentResult.Item;
                currentTimestamp = new Date().toISOString();
                defaultProfile = {
                    id: userId,
                    email: (authContext === null || authContext === void 0 ? void 0 : authContext.email) || '',
                    name: ((_b = authContext === null || authContext === void 0 ? void 0 : authContext.email) === null || _b === void 0 ? void 0 : _b.split('@')[0]) || '',
                    role: userRole,
                    isActive: true,
                    startDate: currentTimestamp.split('T')[0], // ISO date format
                    createdAt: currentTimestamp,
                    updatedAt: currentTimestamp,
                    // Optional fields default to undefined
                    jobTitle: undefined,
                    department: undefined,
                    hourlyRate: undefined,
                    contactInfo: undefined,
                    profilePicture: undefined,
                    lastLogin: undefined,
                    teamId: undefined,
                };
                profileData = __assign(__assign(__assign(__assign({}, defaultProfile), (currentUser || {})), updateData), { updatedAt: currentTimestamp, 
                    // Preserve creation timestamp if profile already exists
                    createdAt: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.createdAt) || currentTimestamp });
                // Ensure required fields are present
                if (!profileData.email) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Email is required but not found in token')];
                }
                if (!profileData.name) {
                    return [2 /*return*/, createErrorResponse(400, types_1.ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Name is required but not found in token or update data')];
                }
                putCommand = new lib_dynamodb_1.PutCommand({
                    TableName: process.env.USERS_TABLE,
                    Item: profileData,
                });
                return [4 /*yield*/, docClient.send(putCommand)];
            case 2:
                _c.sent();
                updatedUser = profileData;
                profile = {
                    id: updatedUser.id,
                    email: updatedUser.email,
                    name: updatedUser.name,
                    jobTitle: updatedUser.jobTitle,
                    department: updatedUser.department,
                    hourlyRate: updatedUser.hourlyRate,
                    role: updatedUser.role,
                    contactInfo: updatedUser.contactInfo,
                    profilePicture: updatedUser.profilePicture,
                    startDate: updatedUser.startDate,
                    lastLogin: updatedUser.lastLogin,
                    isActive: updatedUser.isActive,
                    teamId: updatedUser.teamId,
                    createdAt: updatedUser.createdAt,
                    updatedAt: updatedUser.updatedAt,
                };
                response = {
                    success: true,
                    data: profile,
                    message: 'Profile updated successfully',
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
                error_1 = _c.sent();
                console.error('Error updating user profile:', error_1);
                return [2 /*return*/, createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Internal server error')];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function validateUpdateRequest(data) {
    // Validate name
    if (data.name !== undefined && (!data.name || data.name.trim().length < 2)) {
        return 'Name must be at least 2 characters long';
    }
    // Validate hourly rate
    if (data.hourlyRate !== undefined && (data.hourlyRate < 0 || data.hourlyRate > 1000)) {
        return 'Hourly rate must be between 0 and 1000';
    }
    // Validate contact info
    if (data.contactInfo) {
        if (data.contactInfo.phone && !/^\+?[\d\s\-\(\)]+$/.test(data.contactInfo.phone)) {
            return 'Invalid phone number format';
        }
    }
    return null;
}
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
