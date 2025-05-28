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
exports.InvoiceRepository = void 0;
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var InvoiceRepository = /** @class */ (function () {
    function InvoiceRepository() {
        var client = new client_dynamodb_1.DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
        this.dynamoClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
        this.invoicesTableName = process.env.INVOICES_TABLE || 'aerotage-invoices-dev';
        this.templatesTableName = process.env.INVOICE_TEMPLATES_TABLE || 'aerotage-invoice-templates-dev';
        this.paymentsTableName = process.env.PAYMENTS_TABLE || 'aerotage-payments-dev';
    }
    // ===========================
    // Invoice CRUD Operations
    // ===========================
    /**
     * Create a new invoice
     */
    InvoiceRepository.prototype.createInvoice = function (invoiceData, createdBy) {
        return __awaiter(this, void 0, void 0, function () {
            var now, invoiceId, invoiceNumber, issueDate, dueDate, lineItems, _a, subtotal, taxAmount, discountAmount, totalAmount, newInvoice, clientName, dynamoItem;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        now = new Date().toISOString();
                        invoiceId = "invoice_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
                        return [4 /*yield*/, this.generateInvoiceNumber()];
                    case 1:
                        invoiceNumber = _b.sent();
                        issueDate = invoiceData.issueDate || new Date().toISOString().split('T')[0];
                        dueDate = invoiceData.dueDate || this.calculateDueDate(issueDate, invoiceData.paymentTerms || 'Net 30');
                        return [4 /*yield*/, this.createLineItemsFromTimeEntries(invoiceData.timeEntryIds || [], invoiceData.additionalLineItems || [])];
                    case 2:
                        lineItems = _b.sent();
                        _a = this.calculateInvoiceTotals(lineItems, invoiceData.taxRate || 0, invoiceData.discountRate || 0), subtotal = _a.subtotal, taxAmount = _a.taxAmount, discountAmount = _a.discountAmount, totalAmount = _a.totalAmount;
                        newInvoice = {
                            id: invoiceId,
                            invoiceNumber: invoiceNumber,
                            clientId: invoiceData.clientId,
                            clientName: '', // Will be populated from client lookup
                            projectIds: invoiceData.projectIds || [],
                            timeEntryIds: invoiceData.timeEntryIds || [],
                            status: 'draft',
                            issueDate: issueDate,
                            dueDate: dueDate,
                            subtotal: subtotal,
                            taxRate: invoiceData.taxRate,
                            taxAmount: taxAmount,
                            discountRate: invoiceData.discountRate,
                            discountAmount: discountAmount,
                            totalAmount: totalAmount,
                            currency: invoiceData.currency || 'USD',
                            lineItems: lineItems,
                            templateId: invoiceData.templateId,
                            paymentTerms: invoiceData.paymentTerms || 'Net 30',
                            isRecurring: invoiceData.isRecurring || false,
                            recurringConfig: invoiceData.recurringConfig ? __assign(__assign({}, invoiceData.recurringConfig), { invoicesGenerated: 0, nextInvoiceDate: this.calculateNextInvoiceDate(invoiceData.recurringConfig) }) : undefined,
                            remindersSent: 0,
                            notes: invoiceData.notes,
                            clientNotes: invoiceData.clientNotes,
                            createdAt: now,
                            updatedAt: now,
                            createdBy: createdBy,
                        };
                        return [4 /*yield*/, this.getClientName(invoiceData.clientId)];
                    case 3:
                        clientName = _b.sent();
                        newInvoice.clientName = clientName;
                        dynamoItem = {
                            PK: "INVOICE#".concat(invoiceId),
                            SK: "INVOICE#".concat(invoiceId),
                            GSI1PK: "CLIENT#".concat(invoiceData.clientId),
                            GSI1SK: "INVOICE#".concat(issueDate, "#").concat(invoiceNumber),
                            GSI2PK: "STATUS#draft",
                            GSI2SK: "INVOICE#".concat(dueDate, "#").concat(invoiceId),
                            GSI3PK: "INVOICE_NUMBER#".concat(invoiceNumber),
                            GSI3SK: "INVOICE#".concat(invoiceId),
                            id: invoiceId,
                            invoiceNumber: invoiceNumber,
                            clientId: invoiceData.clientId,
                            clientName: clientName,
                            projectIds: JSON.stringify(newInvoice.projectIds),
                            timeEntryIds: JSON.stringify(newInvoice.timeEntryIds),
                            status: 'draft',
                            issueDate: issueDate,
                            dueDate: dueDate,
                            subtotal: subtotal,
                            taxRate: invoiceData.taxRate,
                            taxAmount: taxAmount,
                            discountRate: invoiceData.discountRate,
                            discountAmount: discountAmount,
                            totalAmount: totalAmount,
                            currency: newInvoice.currency,
                            lineItems: JSON.stringify(lineItems),
                            templateId: invoiceData.templateId,
                            paymentTerms: newInvoice.paymentTerms,
                            isRecurring: newInvoice.isRecurring,
                            recurringConfig: newInvoice.recurringConfig ? JSON.stringify(newInvoice.recurringConfig) : undefined,
                            remindersSent: 0,
                            notes: invoiceData.notes,
                            clientNotes: invoiceData.clientNotes,
                            createdAt: now,
                            updatedAt: now,
                            createdBy: createdBy,
                        };
                        return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.PutCommand({
                                TableName: this.invoicesTableName,
                                Item: dynamoItem,
                                ConditionExpression: 'attribute_not_exists(id)',
                            }))];
                    case 4:
                        _b.sent();
                        return [2 /*return*/, newInvoice];
                }
            });
        });
    };
    /**
     * Get invoice by ID
     */
    InvoiceRepository.prototype.getInvoiceById = function (invoiceId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.GetCommand({
                            TableName: this.invoicesTableName,
                            Key: {
                                id: invoiceId,
                            },
                        }))];
                    case 1:
                        result = _a.sent();
                        if (!result.Item) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, this.mapDynamoItemToInvoice(result.Item)];
                }
            });
        });
    };
    /**
     * Get invoice by invoice number
     */
    InvoiceRepository.prototype.getInvoiceByNumber = function (invoiceNumber) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.QueryCommand({
                            TableName: this.invoicesTableName,
                            IndexName: 'InvoiceNumberIndex',
                            KeyConditionExpression: 'invoiceNumber = :invoiceNumber',
                            ExpressionAttributeValues: {
                                ':invoiceNumber': invoiceNumber,
                            },
                        }))];
                    case 1:
                        result = _a.sent();
                        if (!result.Items || result.Items.length === 0) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, this.mapDynamoItemToInvoice(result.Items[0])];
                }
            });
        });
    };
    /**
     * Update invoice
     */
    InvoiceRepository.prototype.updateInvoice = function (invoiceId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var now, updateExpressions, expressionAttributeNames, expressionAttributeValues, _a, subtotal, taxAmount, discountAmount, totalAmount, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        now = new Date().toISOString();
                        updateExpressions = [];
                        expressionAttributeNames = {};
                        expressionAttributeValues = {};
                        if (updates.status !== undefined) {
                            updateExpressions.push('#status = :status');
                            expressionAttributeNames['#status'] = 'status';
                            expressionAttributeValues[':status'] = updates.status;
                            // Update GSI2PK for status queries
                            updateExpressions.push('GSI2PK = :gsi2pk');
                            expressionAttributeValues[':gsi2pk'] = "STATUS#".concat(updates.status);
                        }
                        if (updates.dueDate !== undefined) {
                            updateExpressions.push('dueDate = :dueDate');
                            expressionAttributeValues[':dueDate'] = updates.dueDate;
                        }
                        if (updates.paymentTerms !== undefined) {
                            updateExpressions.push('paymentTerms = :paymentTerms');
                            expressionAttributeValues[':paymentTerms'] = updates.paymentTerms;
                        }
                        if (updates.taxRate !== undefined) {
                            updateExpressions.push('taxRate = :taxRate');
                            expressionAttributeValues[':taxRate'] = updates.taxRate;
                        }
                        if (updates.discountRate !== undefined) {
                            updateExpressions.push('discountRate = :discountRate');
                            expressionAttributeValues[':discountRate'] = updates.discountRate;
                        }
                        if (updates.lineItems !== undefined) {
                            updateExpressions.push('lineItems = :lineItems');
                            expressionAttributeValues[':lineItems'] = JSON.stringify(updates.lineItems);
                            _a = this.calculateInvoiceTotals(updates.lineItems, updates.taxRate || 0, updates.discountRate || 0), subtotal = _a.subtotal, taxAmount = _a.taxAmount, discountAmount = _a.discountAmount, totalAmount = _a.totalAmount;
                            updateExpressions.push('subtotal = :subtotal, taxAmount = :taxAmount, discountAmount = :discountAmount, totalAmount = :totalAmount');
                            expressionAttributeValues[':subtotal'] = subtotal;
                            expressionAttributeValues[':taxAmount'] = taxAmount;
                            expressionAttributeValues[':discountAmount'] = discountAmount;
                            expressionAttributeValues[':totalAmount'] = totalAmount;
                        }
                        if (updates.notes !== undefined) {
                            updateExpressions.push('notes = :notes');
                            expressionAttributeValues[':notes'] = updates.notes;
                        }
                        if (updates.clientNotes !== undefined) {
                            updateExpressions.push('clientNotes = :clientNotes');
                            expressionAttributeValues[':clientNotes'] = updates.clientNotes;
                        }
                        if (updates.customFields !== undefined) {
                            updateExpressions.push('customFields = :customFields');
                            expressionAttributeValues[':customFields'] = JSON.stringify(updates.customFields);
                        }
                        // Always update the updatedAt timestamp
                        updateExpressions.push('updatedAt = :updatedAt');
                        expressionAttributeValues[':updatedAt'] = now;
                        if (updateExpressions.length === 1) { // Only updatedAt
                            throw new Error('No valid updates provided');
                        }
                        return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.UpdateCommand({
                                TableName: this.invoicesTableName,
                                Key: {
                                    id: invoiceId,
                                },
                                UpdateExpression: "SET ".concat(updateExpressions.join(', ')),
                                ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
                                ExpressionAttributeValues: expressionAttributeValues,
                                ConditionExpression: 'attribute_exists(id)',
                                ReturnValues: 'ALL_NEW',
                            }))];
                    case 1:
                        result = _b.sent();
                        return [2 /*return*/, this.mapDynamoItemToInvoice(result.Attributes)];
                }
            });
        });
    };
    /**
     * Delete invoice (soft delete by setting status to cancelled)
     */
    InvoiceRepository.prototype.deleteInvoice = function (invoiceId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.updateInvoice(invoiceId, { status: 'cancelled' })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * List invoices with filtering and pagination
     */
    InvoiceRepository.prototype.listInvoices = function () {
        return __awaiter(this, arguments, void 0, function (filters) {
            var limit, offset, queryCommand, result, items, invoices, paginatedInvoices, hasMore;
            var _this = this;
            if (filters === void 0) { filters = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        limit = Math.min(filters.limit || 50, 100);
                        offset = filters.offset || 0;
                        if (filters.clientId) {
                            // Query by client using GSI1
                            queryCommand = new lib_dynamodb_1.QueryCommand({
                                TableName: this.invoicesTableName,
                                IndexName: 'ClientIndex',
                                KeyConditionExpression: 'clientId = :clientId',
                                ExpressionAttributeValues: {
                                    ':clientId': filters.clientId,
                                },
                                Limit: limit + offset,
                                ScanIndexForward: filters.sortOrder !== 'desc',
                            });
                        }
                        else if (filters.status) {
                            // Query by status using GSI2
                            queryCommand = new lib_dynamodb_1.QueryCommand({
                                TableName: this.invoicesTableName,
                                IndexName: 'StatusIndex',
                                KeyConditionExpression: '#status = :status',
                                ExpressionAttributeNames: {
                                    '#status': 'status',
                                },
                                ExpressionAttributeValues: {
                                    ':status': filters.status,
                                },
                                Limit: limit + offset,
                                ScanIndexForward: filters.sortOrder !== 'desc',
                            });
                        }
                        else {
                            // Scan all invoices
                            queryCommand = new lib_dynamodb_1.ScanCommand({
                                TableName: this.invoicesTableName,
                                Limit: limit + offset,
                            });
                        }
                        return [4 /*yield*/, this.dynamoClient.send(queryCommand)];
                    case 1:
                        result = _a.sent();
                        items = result.Items || [];
                        invoices = items.map(function (item) { return _this.mapDynamoItemToInvoice(item); });
                        // Apply additional filters
                        invoices = this.applyInvoiceFilters(invoices, filters);
                        paginatedInvoices = invoices.slice(offset, offset + limit);
                        hasMore = invoices.length > offset + limit;
                        return [2 /*return*/, {
                                invoices: paginatedInvoices,
                                total: invoices.length,
                                hasMore: hasMore,
                            }];
                }
            });
        });
    };
    // ===========================
    // Payment Operations
    // ===========================
    /**
     * Record a payment for an invoice
     */
    InvoiceRepository.prototype.recordPayment = function (invoiceId, paymentData, recordedBy) {
        return __awaiter(this, void 0, void 0, function () {
            var now, paymentId, invoice, existingPayments, totalPaid, payment, dynamoItem, newTotalPaid, isFullyPaid, transactItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = new Date().toISOString();
                        paymentId = "payment_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
                        return [4 /*yield*/, this.getInvoiceById(invoiceId)];
                    case 1:
                        invoice = _a.sent();
                        if (!invoice) {
                            throw new Error('Invoice not found');
                        }
                        return [4 /*yield*/, this.getPaymentsByInvoiceId(invoiceId)];
                    case 2:
                        existingPayments = _a.sent();
                        totalPaid = existingPayments.reduce(function (sum, payment) { return sum + payment.amount; }, 0);
                        if (totalPaid + paymentData.amount > invoice.totalAmount) {
                            throw new Error('Payment amount exceeds invoice total');
                        }
                        payment = {
                            id: paymentId,
                            invoiceId: invoiceId,
                            amount: paymentData.amount,
                            currency: invoice.currency,
                            paymentDate: paymentData.paymentDate,
                            paymentMethod: paymentData.paymentMethod,
                            reference: paymentData.reference,
                            notes: paymentData.notes,
                            status: 'completed',
                            externalPaymentId: paymentData.externalPaymentId,
                            processorFee: paymentData.processorFee,
                            createdAt: now,
                            updatedAt: now,
                            recordedBy: recordedBy,
                        };
                        dynamoItem = {
                            PK: "PAYMENT#".concat(paymentId),
                            SK: "PAYMENT#".concat(paymentId),
                            GSI1PK: "INVOICE#".concat(invoiceId),
                            GSI1SK: "PAYMENT#".concat(paymentData.paymentDate, "#").concat(paymentId),
                            GSI2PK: "STATUS#completed",
                            GSI2SK: "PAYMENT#".concat(paymentData.paymentDate, "#").concat(paymentId),
                            id: paymentId,
                            invoiceId: invoiceId,
                            amount: paymentData.amount,
                            currency: invoice.currency,
                            paymentDate: paymentData.paymentDate,
                            paymentMethod: paymentData.paymentMethod,
                            reference: paymentData.reference,
                            notes: paymentData.notes,
                            status: 'completed',
                            externalPaymentId: paymentData.externalPaymentId,
                            processorFee: paymentData.processorFee,
                            createdAt: now,
                            updatedAt: now,
                            recordedBy: recordedBy,
                        };
                        newTotalPaid = totalPaid + paymentData.amount;
                        isFullyPaid = newTotalPaid >= invoice.totalAmount;
                        transactItems = [
                            {
                                Put: {
                                    TableName: this.paymentsTableName,
                                    Item: dynamoItem,
                                    ConditionExpression: 'attribute_not_exists(id)',
                                },
                            },
                        ];
                        // Update invoice status if fully paid
                        if (isFullyPaid) {
                            transactItems.push({
                                Update: {
                                    TableName: this.invoicesTableName,
                                    Key: { id: invoiceId },
                                    UpdateExpression: 'SET #status = :status, paidDate = :paidDate, updatedAt = :updatedAt',
                                    ExpressionAttributeNames: {
                                        '#status': 'status',
                                    },
                                    ExpressionAttributeValues: {
                                        ':status': 'paid',
                                        ':paidDate': paymentData.paymentDate,
                                        ':updatedAt': now,
                                    },
                                },
                            });
                        }
                        return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.TransactWriteCommand({
                                TransactItems: transactItems,
                            }))];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, payment];
                }
            });
        });
    };
    /**
     * Get payments for an invoice
     */
    InvoiceRepository.prototype.getPaymentsByInvoiceId = function (invoiceId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.QueryCommand({
                            TableName: this.paymentsTableName,
                            IndexName: 'InvoiceIndex',
                            KeyConditionExpression: 'invoiceId = :invoiceId',
                            ExpressionAttributeValues: {
                                ':invoiceId': invoiceId,
                            },
                        }))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, (result.Items || []).map(function (item) { return _this.mapDynamoItemToPayment(item); })];
                }
            });
        });
    };
    // ===========================
    // Helper Methods
    // ===========================
    /**
     * Generate unique invoice number
     */
    InvoiceRepository.prototype.generateInvoiceNumber = function () {
        return __awaiter(this, void 0, void 0, function () {
            var year, month, result, count;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        year = new Date().getFullYear();
                        month = String(new Date().getMonth() + 1).padStart(2, '0');
                        return [4 /*yield*/, this.dynamoClient.send(new lib_dynamodb_1.ScanCommand({
                                TableName: this.invoicesTableName,
                                FilterExpression: 'begins_with(invoiceNumber, :prefix)',
                                ExpressionAttributeValues: {
                                    ':prefix': "INV-".concat(year, "-").concat(month),
                                },
                                Select: 'COUNT',
                            }))];
                    case 1:
                        result = _a.sent();
                        count = (result.Count || 0) + 1;
                        return [2 /*return*/, "INV-".concat(year, "-").concat(month, "-").concat(String(count).padStart(3, '0'))];
                }
            });
        });
    };
    /**
     * Calculate due date based on payment terms
     */
    InvoiceRepository.prototype.calculateDueDate = function (issueDate, paymentTerms) {
        var issue = new Date(issueDate);
        var daysToAdd = 30; // Default to 30 days
        if (paymentTerms.includes('Net ')) {
            var days = parseInt(paymentTerms.replace('Net ', ''));
            if (!isNaN(days)) {
                daysToAdd = days;
            }
        }
        else if (paymentTerms === 'Due on receipt') {
            daysToAdd = 0;
        }
        var dueDate = new Date(issue);
        dueDate.setDate(dueDate.getDate() + daysToAdd);
        return dueDate.toISOString().split('T')[0];
    };
    /**
     * Calculate next invoice date for recurring invoices
     */
    InvoiceRepository.prototype.calculateNextInvoiceDate = function (config) {
        var start = new Date(config.startDate);
        switch (config.frequency) {
            case 'weekly':
                start.setDate(start.getDate() + (7 * config.interval));
                break;
            case 'monthly':
                start.setMonth(start.getMonth() + config.interval);
                break;
            case 'quarterly':
                start.setMonth(start.getMonth() + (3 * config.interval));
                break;
            case 'yearly':
                start.setFullYear(start.getFullYear() + config.interval);
                break;
        }
        return start.toISOString().split('T')[0];
    };
    /**
     * Create line items from time entries
     */
    InvoiceRepository.prototype.createLineItemsFromTimeEntries = function (timeEntryIds, additionalItems) {
        return __awaiter(this, void 0, void 0, function () {
            var lineItems, _i, timeEntryIds_1, timeEntryId, _a, additionalItems_1, item;
            return __generator(this, function (_b) {
                lineItems = [];
                // Add time entry line items
                for (_i = 0, timeEntryIds_1 = timeEntryIds; _i < timeEntryIds_1.length; _i++) {
                    timeEntryId = timeEntryIds_1[_i];
                    // TODO: Fetch time entry details from time entries table
                    // For now, create placeholder line items
                    lineItems.push({
                        id: "line_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9)),
                        type: 'time',
                        description: "Time entry ".concat(timeEntryId),
                        quantity: 1,
                        rate: 100,
                        amount: 100,
                        timeEntryId: timeEntryId,
                        taxable: true,
                    });
                }
                // Add additional line items
                for (_a = 0, additionalItems_1 = additionalItems; _a < additionalItems_1.length; _a++) {
                    item = additionalItems_1[_a];
                    lineItems.push(__assign(__assign({}, item), { id: "line_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9)) }));
                }
                return [2 /*return*/, lineItems];
            });
        });
    };
    /**
     * Calculate invoice totals
     */
    InvoiceRepository.prototype.calculateInvoiceTotals = function (lineItems, taxRate, discountRate) {
        var subtotal = lineItems.reduce(function (sum, item) { return sum + item.amount; }, 0);
        var discountAmount = subtotal * (discountRate / 100);
        var taxableAmount = lineItems
            .filter(function (item) { return item.taxable; })
            .reduce(function (sum, item) { return sum + item.amount; }, 0) - discountAmount;
        var taxAmount = taxableAmount * (taxRate / 100);
        var totalAmount = subtotal - discountAmount + taxAmount;
        return {
            subtotal: Math.round(subtotal * 100) / 100,
            taxAmount: Math.round(taxAmount * 100) / 100,
            discountAmount: Math.round(discountAmount * 100) / 100,
            totalAmount: Math.round(totalAmount * 100) / 100,
        };
    };
    /**
     * Get client name by ID
     */
    InvoiceRepository.prototype.getClientName = function (clientId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // TODO: Implement client lookup
                // For now, return placeholder
                return [2 /*return*/, "Client ".concat(clientId)];
            });
        });
    };
    /**
     * Apply additional filters to invoices
     */
    InvoiceRepository.prototype.applyInvoiceFilters = function (invoices, filters) {
        var filtered = invoices;
        if (filters.projectId) {
            filtered = filtered.filter(function (invoice) {
                return invoice.projectIds.includes(filters.projectId);
            });
        }
        if (filters.isRecurring !== undefined) {
            filtered = filtered.filter(function (invoice) {
                return invoice.isRecurring === filters.isRecurring;
            });
        }
        if (filters.dateFrom) {
            filtered = filtered.filter(function (invoice) {
                return invoice.issueDate >= filters.dateFrom;
            });
        }
        if (filters.dateTo) {
            filtered = filtered.filter(function (invoice) {
                return invoice.issueDate <= filters.dateTo;
            });
        }
        if (filters.dueDateFrom) {
            filtered = filtered.filter(function (invoice) {
                return invoice.dueDate >= filters.dueDateFrom;
            });
        }
        if (filters.dueDateTo) {
            filtered = filtered.filter(function (invoice) {
                return invoice.dueDate <= filters.dueDateTo;
            });
        }
        if (filters.amountMin !== undefined) {
            filtered = filtered.filter(function (invoice) {
                return invoice.totalAmount >= filters.amountMin;
            });
        }
        if (filters.amountMax !== undefined) {
            filtered = filtered.filter(function (invoice) {
                return invoice.totalAmount <= filters.amountMax;
            });
        }
        if (filters.currency) {
            filtered = filtered.filter(function (invoice) {
                return invoice.currency === filters.currency;
            });
        }
        return filtered;
    };
    /**
     * Map DynamoDB item to Invoice object
     */
    InvoiceRepository.prototype.mapDynamoItemToInvoice = function (item) {
        return {
            id: item.id,
            invoiceNumber: item.invoiceNumber,
            clientId: item.clientId,
            clientName: item.clientName,
            projectIds: JSON.parse(item.projectIds || '[]'),
            timeEntryIds: JSON.parse(item.timeEntryIds || '[]'),
            status: item.status,
            issueDate: item.issueDate,
            dueDate: item.dueDate,
            paidDate: item.paidDate,
            subtotal: item.subtotal,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            discountRate: item.discountRate,
            discountAmount: item.discountAmount,
            totalAmount: item.totalAmount,
            currency: item.currency,
            lineItems: JSON.parse(item.lineItems || '[]'),
            templateId: item.templateId,
            customFields: item.customFields ? JSON.parse(item.customFields) : undefined,
            paymentTerms: item.paymentTerms,
            paymentMethod: item.paymentMethod,
            paymentReference: item.paymentReference,
            isRecurring: item.isRecurring,
            recurringConfig: item.recurringConfig ? JSON.parse(item.recurringConfig) : undefined,
            parentInvoiceId: item.parentInvoiceId,
            pdfUrl: item.pdfUrl,
            attachments: item.attachments ? JSON.parse(item.attachments) : undefined,
            sentAt: item.sentAt,
            viewedAt: item.viewedAt,
            remindersSent: item.remindersSent,
            lastReminderSent: item.lastReminderSent,
            notes: item.notes,
            clientNotes: item.clientNotes,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            createdBy: item.createdBy,
            sentBy: item.sentBy,
        };
    };
    /**
     * Map DynamoDB item to Payment object
     */
    InvoiceRepository.prototype.mapDynamoItemToPayment = function (item) {
        return {
            id: item.id,
            invoiceId: item.invoiceId,
            amount: item.amount,
            currency: item.currency,
            paymentDate: item.paymentDate,
            paymentMethod: item.paymentMethod,
            reference: item.reference,
            notes: item.notes,
            status: item.status,
            externalPaymentId: item.externalPaymentId,
            processorFee: item.processorFee,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            recordedBy: item.recordedBy,
        };
    };
    return InvoiceRepository;
}());
exports.InvoiceRepository = InvoiceRepository;
