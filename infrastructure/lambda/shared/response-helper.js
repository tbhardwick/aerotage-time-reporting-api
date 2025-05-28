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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSuccessResponse = createSuccessResponse;
exports.createUnwrappedSuccessResponse = createUnwrappedSuccessResponse;
exports.createErrorResponse = createErrorResponse;
exports.extractApiData = extractApiData;
/**
 * Creates standardized success response with wrapped data structure
 * Used for API Gateway responses that include success/data/message structure
 */
function createSuccessResponse(data, statusCode, message) {
    if (statusCode === void 0) { statusCode = 200; }
    var response = __assign({ success: true, data: data }, (message && { message: message }));
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(response),
    };
}
/**
 * Creates success response with unwrapped data (data object directly)
 * Use this when you want to return the data object directly without wrapping
 * Note: This breaks the standardized API response format, use carefully
 */
function createUnwrappedSuccessResponse(data, statusCode) {
    if (statusCode === void 0) { statusCode = 200; }
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(data),
    };
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
/**
 * Utility function to extract data from API response
 * This is the pattern that should be used in frontend API clients
 */
function extractApiData(response) {
    // If response has success and data properties, extract data
    if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
        return response.data;
    }
    // Otherwise return the response as-is (for backward compatibility)
    return response;
}
