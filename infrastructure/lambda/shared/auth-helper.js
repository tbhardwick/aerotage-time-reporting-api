"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthenticatedUser = getAuthenticatedUser;
exports.getCurrentUserId = getCurrentUserId;
exports.isAdmin = isAdmin;
exports.isManagerOrAdmin = isManagerOrAdmin;
/**
 * Extract authenticated user information from custom authorizer context
 */
function getAuthenticatedUser(event) {
    try {
        // With custom authorizer, user info is in event.requestContext.authorizer
        var authorizerContext = event.requestContext.authorizer;
        if (!authorizerContext) {
            console.log('No authorizer context found');
            return null;
        }
        // Extract user information from custom authorizer context
        var userId = authorizerContext.userId;
        var email = authorizerContext.email;
        var role = authorizerContext.role || 'employee';
        var teamId = authorizerContext.teamId || undefined;
        var department = authorizerContext.department || undefined;
        if (!userId) {
            console.log('No userId found in authorizer context');
            return null;
        }
        return {
            userId: userId,
            email: email || '',
            role: role,
            teamId: teamId,
            department: department
        };
    }
    catch (error) {
        console.error('Error extracting authenticated user:', error);
        return null;
    }
}
/**
 * Get user ID from the event context (backwards compatibility)
 */
function getCurrentUserId(event) {
    var user = getAuthenticatedUser(event);
    return (user === null || user === void 0 ? void 0 : user.userId) || null;
}
/**
 * Check if the authenticated user has admin role
 */
function isAdmin(event) {
    var user = getAuthenticatedUser(event);
    return (user === null || user === void 0 ? void 0 : user.role) === 'admin';
}
/**
 * Check if the authenticated user has manager role or higher
 */
function isManagerOrAdmin(event) {
    var user = getAuthenticatedUser(event);
    return (user === null || user === void 0 ? void 0 : user.role) === 'admin' || (user === null || user === void 0 ? void 0 : user.role) === 'manager';
}
