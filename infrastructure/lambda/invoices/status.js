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
var types_1 = require("../shared/types");
var validation_1 = require("../shared/validation");
var invoice_repository_1 = require("../shared/invoice-repository");
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var currentUserId, invoiceId, requestBody, operation, invoiceRepository, existingInvoice, updatedInvoice, payment, validation, allowedStatuses, canTransition, responseData, response, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log('Update invoice status request:', JSON.stringify(event, null, 2));
                _b.label = 1;
            case 1:
                _b.trys.push([1, 8, , 9]);
                currentUserId = getCurrentUserId(event);
                if (!currentUserId) {
                    return [2 /*return*/, createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                invoiceId = (_a = event.pathParameters) === null || _a === void 0 ? void 0 : _a.id;
                if (!invoiceId) {
                    return [2 /*return*/, createErrorResponse(400, 'MISSING_PARAMETER', 'Invoice ID is required')];
                }
                requestBody = JSON.parse(event.body || '{}');
                operation = requestBody.operation || 'updateStatus';
                invoiceRepository = new invoice_repository_1.InvoiceRepository();
                return [4 /*yield*/, invoiceRepository.getInvoiceById(invoiceId)];
            case 2:
                existingInvoice = _b.sent();
                if (!existingInvoice) {
                    return [2 /*return*/, createErrorResponse(404, types_1.InvoiceErrorCodes.INVOICE_NOT_FOUND, 'Invoice not found')];
                }
                updatedInvoice = void 0;
                payment = null;
                if (!(operation === 'recordPayment')) return [3 /*break*/, 5];
                validation = validation_1.ValidationService.validateRecordPaymentRequest(requestBody);
                if (!validation.isValid) {
                    return [2 /*return*/, createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '))];
                }
                return [4 /*yield*/, invoiceRepository.recordPayment(invoiceId, requestBody, currentUserId)];
            case 3:
                // Record the payment
                payment = _b.sent();
                return [4 /*yield*/, invoiceRepository.getInvoiceById(invoiceId)];
            case 4:
                // Get the updated invoice (payment recording may have updated the status)
                updatedInvoice = (_b.sent());
                return [3 /*break*/, 7];
            case 5:
                // Simple status update
                if (!requestBody.status) {
                    return [2 /*return*/, createErrorResponse(400, 'VALIDATION_ERROR', 'Status is required')];
                }
                allowedStatuses = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'refunded'];
                if (!allowedStatuses.includes(requestBody.status)) {
                    return [2 /*return*/, createErrorResponse(400, 'VALIDATION_ERROR', "Status must be one of: ".concat(allowedStatuses.join(', ')))];
                }
                canTransition = validateStatusTransition(existingInvoice.status, requestBody.status);
                if (!canTransition.allowed) {
                    return [2 /*return*/, createErrorResponse(400, 'INVALID_STATUS_TRANSITION', canTransition.reason || 'Invalid status transition')];
                }
                return [4 /*yield*/, invoiceRepository.updateInvoice(invoiceId, {
                        status: requestBody.status,
                    })];
            case 6:
                // Update the invoice status
                updatedInvoice = _b.sent();
                _b.label = 7;
            case 7:
                responseData = {
                    invoice: updatedInvoice,
                };
                if (payment) {
                    responseData.payment = payment;
                }
                response = {
                    success: true,
                    data: responseData,
                    message: operation === 'recordPayment' ? 'Payment recorded successfully' : 'Invoice status updated successfully',
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
                error_1 = _b.sent();
                console.error('Error updating invoice status:', error_1);
                // Handle specific business logic errors
                if (error_1 instanceof Error) {
                    if (error_1.message.includes('Invoice not found')) {
                        return [2 /*return*/, createErrorResponse(404, types_1.InvoiceErrorCodes.INVOICE_NOT_FOUND, 'Invoice not found')];
                    }
                    if (error_1.message.includes('Payment amount exceeds invoice total')) {
                        return [2 /*return*/, createErrorResponse(400, types_1.InvoiceErrorCodes.PAYMENT_EXCEEDS_INVOICE, 'Payment amount exceeds invoice total')];
                    }
                    if (error_1.message.includes('Payment already recorded')) {
                        return [2 /*return*/, createErrorResponse(400, types_1.InvoiceErrorCodes.PAYMENT_ALREADY_RECORDED, 'Payment has already been recorded')];
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
 * Validates status transitions based on business rules
 */
function validateStatusTransition(currentStatus, newStatus) {
    var _a;
    // Define allowed transitions
    var allowedTransitions = {
        'draft': ['sent', 'cancelled'],
        'sent': ['viewed', 'paid', 'overdue', 'cancelled'],
        'viewed': ['paid', 'overdue', 'cancelled'],
        'paid': ['refunded'], // Paid invoices can only be refunded
        'overdue': ['paid', 'cancelled'],
        'cancelled': [], // Cancelled invoices cannot be changed
        'refunded': [], // Refunded invoices cannot be changed
    };
    if (currentStatus === newStatus) {
        return { allowed: true }; // Same status is always allowed
    }
    var allowed = ((_a = allowedTransitions[currentStatus]) === null || _a === void 0 ? void 0 : _a.includes(newStatus)) || false;
    if (!allowed) {
        return {
            allowed: false,
            reason: "Cannot transition from ".concat(currentStatus, " to ").concat(newStatus),
        };
    }
    return { allowed: true };
}
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
