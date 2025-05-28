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
var auth_service_1 = require("./auth-service");
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var token, _a, httpMethod, resourcePath, isBootstrap, forceBootstrap, jwtResult_1, userId_1, policy_1, jwtResult, userId_2, policy_2, authResult, userId, userClaims, policy, _b, denyPolicy;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 6, , 7]);
                token = auth_service_1.AuthService.extractBearerToken(event.authorizationToken);
                if (!token) {
                    throw new Error('Unauthorized - No valid Bearer token');
                }
                _a = parseMethodArn(event.methodArn), httpMethod = _a.httpMethod, resourcePath = _a.resourcePath;
                isBootstrap = isSessionBootstrapRequest(httpMethod, resourcePath);
                if (!isBootstrap) return [3 /*break*/, 4];
                forceBootstrap = process.env.FORCE_BOOTSTRAP;
                if (!(forceBootstrap === 'true')) return [3 /*break*/, 2];
                return [4 /*yield*/, auth_service_1.AuthService.validateJwtOnly(token)];
            case 1:
                jwtResult_1 = _c.sent();
                if (!jwtResult_1.isValid) {
                    throw new Error('Unauthorized - JWT validation failed');
                }
                userId_1 = jwtResult_1.userId;
                policy_1 = generatePolicy(userId_1, 'Allow', getResourceForPolicy(event.methodArn), jwtResult_1.userClaims, {
                    bootstrap: 'true',
                    reason: 'force_bootstrap'
                });
                return [2 /*return*/, policy_1];
            case 2: return [4 /*yield*/, auth_service_1.AuthService.validateJwtOnly(token)];
            case 3:
                jwtResult = _c.sent();
                if (!jwtResult.isValid) {
                    throw new Error('Unauthorized - JWT validation failed');
                }
                userId_2 = jwtResult.userId;
                policy_2 = generatePolicy(userId_2, 'Allow', getResourceForPolicy(event.methodArn), jwtResult.userClaims, {
                    bootstrap: 'true',
                    reason: 'session_creation_allowed'
                });
                return [2 /*return*/, policy_2];
            case 4: return [4 /*yield*/, auth_service_1.AuthService.validateAuthentication(token)];
            case 5:
                authResult = _c.sent();
                if (!authResult.isValid) {
                    throw new Error('Unauthorized - Authentication validation failed');
                }
                userId = authResult.userId;
                userClaims = authResult.userClaims;
                policy = generatePolicy(userId, 'Allow', getResourceForPolicy(event.methodArn), userClaims);
                return [2 /*return*/, policy];
            case 6:
                _b = _c.sent();
                denyPolicy = generatePolicy('unauthorized', 'Deny', event.methodArn);
                return [2 /*return*/, denyPolicy];
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
/**
 * Parse method ARN to extract HTTP method and resource path
 */
function parseMethodArn(methodArn) {
    try {
        // Method ARN format: arn:aws:execute-api:region:account:api-id/stage/METHOD/resource-path
        var parts = methodArn.split('/');
        if (parts.length < 4) {
            return { httpMethod: 'UNKNOWN', resourcePath: 'UNKNOWN' };
        }
        var httpMethod = parts[2] || 'UNKNOWN'; // e.g., "POST", "GET" 
        var resourcePath = "/".concat(parts.slice(3).join('/')); // e.g., "/users/123/sessions"
        return { httpMethod: httpMethod, resourcePath: resourcePath };
    }
    catch (_a) {
        return { httpMethod: 'UNKNOWN', resourcePath: 'UNKNOWN' };
    }
}
/**
 * Check if this is a session bootstrap request
 */
function isSessionBootstrapRequest(httpMethod, resourcePath) {
    // Allow POST requests to session creation endpoints
    if (httpMethod !== 'POST') {
        return false;
    }
    // Check for session creation patterns:
    // - /users/{userId}/sessions
    // - /users/*/sessions (wildcard matching)
    var sessionCreationPatterns = [
        /^\/users\/[^\/]+\/sessions\/?$/, // /users/{userId}/sessions
        /^\/users\/\*\/sessions\/?$/ // /users/*/sessions (API Gateway pattern)
    ];
    for (var i = 0; i < sessionCreationPatterns.length; i++) {
        var pattern = sessionCreationPatterns[i];
        var matches = pattern.test(resourcePath);
        if (matches) {
            return true;
        }
    }
    // Additional debugging: show what the path would need to look like
    return false;
}
/**
 * Generate IAM policy for API Gateway
 */
function generatePolicy(principalId, effect, resource, context, additionalContext) {
    var policyDocument = {
        Version: '2012-10-17',
        Statement: []
    };
    var statement = {
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource
    };
    policyDocument.Statement.push(statement);
    var authResponse = {
        principalId: principalId,
        policyDocument: policyDocument
    };
    // Add user context if available (for Allow policies)
    if (effect === 'Allow' && context) {
        console.log('JWT context received:', JSON.stringify(context, null, 2));
        // Determine role from custom attribute or Cognito groups
        var userRole = context['custom:role'] || 'employee';
        // Fallback to Cognito groups if custom:role is not available
        if (!context['custom:role'] && context['cognito:groups']) {
            var groups = Array.isArray(context['cognito:groups'])
                ? context['cognito:groups']
                : [context['cognito:groups']];
            console.log('Found Cognito groups:', groups);
            if (groups.includes('admin')) {
                userRole = 'admin';
            }
            else if (groups.includes('manager')) {
                userRole = 'manager';
            }
            else if (groups.includes('employee')) {
                userRole = 'employee';
            }
        }
        console.log('Determined user role:', userRole);
        authResponse.context = __assign({ userId: String(context.sub || ''), email: String(context.email || ''), role: String(userRole), teamId: String(context['custom:teamId'] || ''), department: String(context['custom:department'] || ''), 
            // Convert boolean and number values to strings (API Gateway requirement)
            authTime: String(context.auth_time || ''), iat: String(context.iat || ''), exp: String(context.exp || '') }, (additionalContext ? Object.fromEntries(Object.entries(additionalContext).map(function (_a) {
            var key = _a[0], value = _a[1];
            return [key, String(value)];
        })) : {}));
        console.log('Generated auth context:', JSON.stringify(authResponse.context, null, 2));
    }
    return authResponse;
}
/**
 * Helper function to extract API Gateway base path for policy generation
 */
function getResourceForPolicy(methodArn) {
    // Convert specific method ARN to allow all methods on this API
    // From: arn:aws:execute-api:region:account:api-id/stage/method/resource
    // To: arn:aws:execute-api:region:account:api-id/stage/*/*
    var arnParts = methodArn.split('/');
    if (arnParts.length >= 3) {
        return "".concat(arnParts[0], "/").concat(arnParts[1], "/*/*");
    }
    return methodArn;
}
