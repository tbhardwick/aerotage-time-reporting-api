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
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var currentUserId, requestData, validation, invoiceRepository, invoice, response, error_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                console.log('🧾 Invoice Generate Handler - Request received:', {
                    httpMethod: event.httpMethod,
                    path: event.path,
                    body: event.body ? 'Present' : 'None',
                    headers: {
                        authorization: event.headers.authorization ? 'Bearer [REDACTED]' : 'None',
                        'content-type': event.headers['content-type']
                    }
                });
                _c.label = 1;
            case 1:
                _c.trys.push([1, 3, , 4]);
                // Get current user from authorization context
                console.log('🔐 Extracting user from authorization context...');
                currentUserId = (0, auth_helper_1.getCurrentUserId)(event);
                console.log('👤 Current user ID:', currentUserId);
                if (!currentUserId) {
                    console.log('❌ No user ID found in authorization context');
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                // Parse request body
                console.log('📝 Parsing request body...');
                if (!event.body) {
                    console.log('❌ No request body provided');
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'VALIDATION_ERROR', 'Request body is required')];
                }
                requestData = void 0;
                try {
                    requestData = JSON.parse(event.body);
                    console.log('📊 Parsed request data:', {
                        clientId: requestData.clientId,
                        projectIds: ((_a = requestData.projectIds) === null || _a === void 0 ? void 0 : _a.length) || 0,
                        timeEntryIds: ((_b = requestData.timeEntryIds) === null || _b === void 0 ? void 0 : _b.length) || 0,
                        isRecurring: requestData.isRecurring
                    });
                }
                catch (parseError) {
                    console.log('❌ Failed to parse request body:', parseError);
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'VALIDATION_ERROR', 'Invalid JSON in request body')];
                }
                // Validate request
                console.log('✅ Validating create invoice request...');
                validation = validation_1.ValidationService.validateCreateInvoiceRequest(requestData);
                console.log('📊 Validation result:', validation);
                if (!validation.isValid) {
                    console.log('❌ Validation failed:', validation.errors);
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'VALIDATION_ERROR', validation.errors.join(', '))];
                }
                console.log('🏗️ Creating InvoiceRepository instance...');
                invoiceRepository = new invoice_repository_1.InvoiceRepository();
                // Generate invoice
                console.log('🧾 Generating invoice...');
                return [4 /*yield*/, invoiceRepository.createInvoice(requestData, currentUserId)];
            case 2:
                invoice = _c.sent();
                console.log('✅ Invoice generated successfully:', {
                    invoiceId: invoice.id,
                    invoiceNumber: invoice.invoiceNumber,
                    totalAmount: invoice.totalAmount,
                    status: invoice.status
                });
                response = {
                    success: true,
                    data: invoice,
                };
                console.log('✅ Successfully prepared response');
                return [2 /*return*/, {
                        statusCode: 201,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _c.sent();
                console.error('❌ Invoice Generate Handler - Error occurred:', {
                    error: error_1 instanceof Error ? error_1.message : String(error_1),
                    stack: error_1 instanceof Error ? error_1.stack : undefined,
                    name: error_1 instanceof Error ? error_1.name : 'Unknown'
                });
                // Handle specific business logic errors
                if (error_1 instanceof Error) {
                    if (error_1.message.includes('Client not found')) {
                        return [2 /*return*/, (0, response_helper_1.createErrorResponse)(404, types_1.InvoiceErrorCodes.INVALID_INVOICE_DATA, 'Client not found')];
                    }
                    if (error_1.message.includes('No billable time entries')) {
                        return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.InvoiceErrorCodes.NO_BILLABLE_TIME_ENTRIES, 'No billable time entries found for the specified criteria')];
                    }
                    if (error_1.message.includes('Time entries already invoiced')) {
                        return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, types_1.InvoiceErrorCodes.TIME_ENTRIES_ALREADY_INVOICED, 'Some time entries have already been invoiced')];
                    }
                }
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred')];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
