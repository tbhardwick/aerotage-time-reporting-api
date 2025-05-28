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
var invoice_repository_1 = require("../shared/invoice-repository");
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var currentUserId, queryParams, filters, validation, invoiceRepository, result, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                // Log request for debugging in development
                console.log('📋 Invoice List Handler - Request received:', {
                    httpMethod: event.httpMethod,
                    path: event.path,
                    queryStringParameters: event.queryStringParameters,
                    headers: {
                        authorization: event.headers.authorization ? 'Bearer [REDACTED]' : 'None',
                        'content-type': event.headers['content-type']
                    }
                });
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                // Get current user from authorization context
                console.log('🔐 Extracting user from authorization context...');
                currentUserId = (0, auth_helper_1.getCurrentUserId)(event);
                console.log('👤 Current user ID:', currentUserId);
                if (!currentUserId) {
                    console.log('❌ No user ID found in authorization context');
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                // Parse query parameters
                console.log('📝 Parsing query parameters...');
                queryParams = event.queryStringParameters || {};
                console.log('🔍 Query parameters:', queryParams);
                filters = {
                    clientId: queryParams.clientId,
                    projectId: queryParams.projectId,
                    status: queryParams.status,
                    isRecurring: queryParams.isRecurring ? queryParams.isRecurring === 'true' : undefined,
                    dateFrom: queryParams.dateFrom,
                    dateTo: queryParams.dateTo,
                    dueDateFrom: queryParams.dueDateFrom,
                    dueDateTo: queryParams.dueDateTo,
                    amountMin: queryParams.amountMin ? parseFloat(queryParams.amountMin) : undefined,
                    amountMax: queryParams.amountMax ? parseFloat(queryParams.amountMax) : undefined,
                    currency: queryParams.currency,
                    limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
                    offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
                    sortBy: queryParams.sortBy,
                    sortOrder: queryParams.sortOrder,
                };
                console.log('🎯 Parsed filters:', filters);
                // Validate filters
                console.log('✅ Validating filters...');
                validation = validation_1.ValidationService.validateInvoiceFilters(filters);
                console.log('📊 Validation result:', validation);
                if (!validation.isValid) {
                    console.log('❌ Validation failed:', validation.errors);
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'VALIDATION_ERROR', validation.errors.join(', '))];
                }
                console.log('🏗️ Creating InvoiceRepository instance...');
                invoiceRepository = new invoice_repository_1.InvoiceRepository();
                // Get invoices with pagination
                console.log('📋 Fetching invoices from repository...');
                return [4 /*yield*/, invoiceRepository.listInvoices(filters)];
            case 2:
                result = _a.sent();
                console.log('📊 Repository result:', {
                    invoiceCount: result.invoices.length,
                    total: result.total,
                    hasMore: result.hasMore
                });
                response = {
                    success: true,
                    data: {
                        items: result.invoices,
                        pagination: {
                            total: result.total,
                            limit: filters.limit || 50,
                            offset: filters.offset || 0,
                            hasMore: result.hasMore,
                        },
                    },
                };
                console.log('✅ Successfully prepared response:', {
                    itemCount: response.data.items.length,
                    pagination: response.data.pagination
                });
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _a.sent();
                // Log error for debugging
                console.error('❌ Invoice List Handler - Error occurred:', {
                    error: error_1 instanceof Error ? error_1.message : String(error_1),
                    stack: error_1 instanceof Error ? error_1.stack : undefined,
                    name: error_1 instanceof Error ? error_1.name : 'Unknown'
                });
                return [2 /*return*/, (0, response_helper_1.createErrorResponse)(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred')];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
