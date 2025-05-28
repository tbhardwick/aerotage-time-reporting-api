import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  UpdateCommand, 
  QueryCommand, 
  ScanCommand,
  TransactWriteCommand 
} from '@aws-sdk/lib-dynamodb';
import { 
  Invoice, 
  InvoiceDynamoItem,
  InvoiceTemplate,
  Payment,
  PaymentDynamoItem,
  InvoiceFilters,
  InvoiceLineItem,
  RecurringInvoiceConfig,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  RecordPaymentRequest
} from './types';

export interface InvoiceListResult {
  invoices: Invoice[];
  total: number;
  hasMore: boolean;
}

export interface TemplateListResult {
  templates: InvoiceTemplate[];
  total: number;
  hasMore: boolean;
}

export interface PaymentListResult {
  payments: Payment[];
  total: number;
  hasMore: boolean;
}

export class InvoiceRepository {
  private dynamoClient: DynamoDBDocumentClient;
  private invoicesTableName: string;
  private templatesTableName: string;
  private paymentsTableName: string;

  constructor() {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.dynamoClient = DynamoDBDocumentClient.from(client);
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
  async createInvoice(invoiceData: CreateInvoiceRequest, createdBy: string): Promise<Invoice> {
    const now = new Date().toISOString();
    const invoiceId = `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();
    
    // Calculate dates
    const issueDate = invoiceData.issueDate || new Date().toISOString().split('T')[0];
    const dueDate = invoiceData.dueDate || this.calculateDueDate(issueDate, invoiceData.paymentTerms || 'Net 30');
    
    // Create line items from time entries if provided
    const lineItems = await this.createLineItemsFromTimeEntries(
      invoiceData.timeEntryIds || [],
      invoiceData.additionalLineItems || []
    );
    
    // Calculate totals
    const { subtotal, taxAmount, discountAmount, totalAmount } = this.calculateInvoiceTotals(
      lineItems,
      invoiceData.taxRate || 0,
      invoiceData.discountRate || 0
    );

    const newInvoice: Invoice = {
      id: invoiceId,
      invoiceNumber,
      clientId: invoiceData.clientId,
      clientName: '', // Will be populated from client lookup
      projectIds: invoiceData.projectIds || [],
      timeEntryIds: invoiceData.timeEntryIds || [],
      status: 'draft',
      
      issueDate,
      dueDate,
      
      subtotal,
      taxRate: invoiceData.taxRate,
      taxAmount,
      discountRate: invoiceData.discountRate,
      discountAmount,
      totalAmount,
      currency: invoiceData.currency || 'USD',
      
      lineItems,
      templateId: invoiceData.templateId,
      
      paymentTerms: invoiceData.paymentTerms || 'Net 30',
      
      isRecurring: invoiceData.isRecurring || false,
      recurringConfig: invoiceData.recurringConfig ? {
        ...invoiceData.recurringConfig,
        invoicesGenerated: 0,
        nextInvoiceDate: this.calculateNextInvoiceDate(invoiceData.recurringConfig)
      } : undefined,
      
      remindersSent: 0,
      notes: invoiceData.notes,
      clientNotes: invoiceData.clientNotes,
      
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    // Get client name
    const clientName = await this.getClientName(invoiceData.clientId);
    newInvoice.clientName = clientName;

    const dynamoItem: InvoiceDynamoItem = {
      PK: `INVOICE#${invoiceId}`,
      SK: `INVOICE#${invoiceId}`,
      GSI1PK: `CLIENT#${invoiceData.clientId}`,
      GSI1SK: `INVOICE#${issueDate}#${invoiceNumber}`,
      GSI2PK: `STATUS#draft`,
      GSI2SK: `INVOICE#${dueDate}#${invoiceId}`,
      GSI3PK: `INVOICE_NUMBER#${invoiceNumber}`,
      GSI3SK: `INVOICE#${invoiceId}`,
      
      id: invoiceId,
      invoiceNumber,
      clientId: invoiceData.clientId,
      clientName,
      projectIds: JSON.stringify(newInvoice.projectIds),
      timeEntryIds: JSON.stringify(newInvoice.timeEntryIds),
      status: 'draft',
      
      issueDate,
      dueDate,
      
      subtotal,
      taxRate: invoiceData.taxRate,
      taxAmount,
      discountRate: invoiceData.discountRate,
      discountAmount,
      totalAmount,
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
      createdBy,
    };

    await this.dynamoClient.send(new PutCommand({
      TableName: this.invoicesTableName,
      Item: dynamoItem,
      ConditionExpression: 'attribute_not_exists(id)',
    }));

    return newInvoice;
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string): Promise<Invoice | null> {
    const result = await this.dynamoClient.send(new GetCommand({
      TableName: this.invoicesTableName,
      Key: {
        id: invoiceId,
      },
    }));

    if (!result.Item) {
      return null;
    }

    return this.mapDynamoItemToInvoice(result.Item as InvoiceDynamoItem);
  }

  /**
   * Get invoice by invoice number
   */
  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    const result = await this.dynamoClient.send(new QueryCommand({
      TableName: this.invoicesTableName,
      IndexName: 'InvoiceNumberIndex',
      KeyConditionExpression: 'invoiceNumber = :invoiceNumber',
      ExpressionAttributeValues: {
        ':invoiceNumber': invoiceNumber,
      },
    }));

    if (!(result as any).Items || (result as any).Items.length === 0) {
      return null;
    }

    return this.mapDynamoItemToInvoice((result as any).Items[0] as InvoiceDynamoItem);
  }

  /**
   * Update invoice
   */
  async updateInvoice(
    invoiceId: string, 
    updates: UpdateInvoiceRequest
  ): Promise<Invoice> {
    const now = new Date().toISOString();
    
    // Build update expression dynamically
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    if (updates.status !== undefined) {
      updateExpressions.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = updates.status;
      
      // Update GSI2PK for status queries
      updateExpressions.push('GSI2PK = :gsi2pk');
      expressionAttributeValues[':gsi2pk'] = `STATUS#${updates.status}`;
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
      
      // Recalculate totals when line items change
      const { subtotal, taxAmount, discountAmount, totalAmount } = this.calculateInvoiceTotals(
        updates.lineItems,
        updates.taxRate || 0,
        updates.discountRate || 0
      );
      
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

    const result = await this.dynamoClient.send(new UpdateCommand({
      TableName: this.invoicesTableName,
      Key: {
        id: invoiceId,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(id)',
      ReturnValues: 'ALL_NEW',
    }));

    return this.mapDynamoItemToInvoice(result.Attributes as InvoiceDynamoItem);
  }

  /**
   * Delete invoice (soft delete by setting status to cancelled)
   */
  async deleteInvoice(invoiceId: string): Promise<void> {
    await this.updateInvoice(invoiceId, { status: 'cancelled' });
  }

  /**
   * List invoices with filtering and pagination
   */
  async listInvoices(filters: InvoiceFilters = {}): Promise<InvoiceListResult> {
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    let queryCommand;

    if (filters.clientId) {
      // Query by client using GSI1
      queryCommand = new QueryCommand({
        TableName: this.invoicesTableName,
        IndexName: 'ClientIndex',
        KeyConditionExpression: 'clientId = :clientId',
        ExpressionAttributeValues: {
          ':clientId': filters.clientId,
        },
        Limit: limit + offset,
        ScanIndexForward: filters.sortOrder !== 'desc',
      });
    } else if (filters.status) {
      // Query by status using GSI2
      queryCommand = new QueryCommand({
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
    } else {
      // Scan all invoices
      queryCommand = new ScanCommand({
        TableName: this.invoicesTableName,
        Limit: limit + offset,
      });
    }

    const result = await this.dynamoClient.send(queryCommand);
    const items = (result as any).Items || [];

    // Convert DynamoDB items to Invoice objects
    let invoices = items.map(item => this.mapDynamoItemToInvoice(item as InvoiceDynamoItem));

    // Apply additional filters
    invoices = this.applyInvoiceFilters(invoices, filters);

    // Apply pagination
    const paginatedInvoices = invoices.slice(offset, offset + limit);
    const hasMore = invoices.length > offset + limit;

    return {
      invoices: paginatedInvoices,
      total: invoices.length,
      hasMore,
    };
  }

  // ===========================
  // Payment Operations
  // ===========================

  /**
   * Record a payment for an invoice
   */
  async recordPayment(invoiceId: string, paymentData: RecordPaymentRequest, recordedBy: string): Promise<Payment> {
    const now = new Date().toISOString();
    const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get the invoice to validate payment amount
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Get existing payments to check total
    const existingPayments = await this.getPaymentsByInvoiceId(invoiceId);
    const totalPaid = existingPayments.reduce((sum, payment) => sum + payment.amount, 0);
    
    if (totalPaid + paymentData.amount > invoice.totalAmount) {
      throw new Error('Payment amount exceeds invoice total');
    }

    const payment: Payment = {
      id: paymentId,
      invoiceId,
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
      recordedBy,
    };

    const dynamoItem: PaymentDynamoItem = {
      PK: `PAYMENT#${paymentId}`,
      SK: `PAYMENT#${paymentId}`,
      GSI1PK: `INVOICE#${invoiceId}`,
      GSI1SK: `PAYMENT#${paymentData.paymentDate}#${paymentId}`,
      GSI2PK: `STATUS#completed`,
      GSI2SK: `PAYMENT#${paymentData.paymentDate}#${paymentId}`,
      
      id: paymentId,
      invoiceId,
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
      recordedBy,
    };

    // Use transaction to record payment and update invoice status
    const newTotalPaid = totalPaid + paymentData.amount;
    const isFullyPaid = newTotalPaid >= invoice.totalAmount;
    
    const transactItems: any[] = [
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

    await this.dynamoClient.send(new TransactWriteCommand({
      TransactItems: transactItems,
    }));

    return payment;
  }

  /**
   * Get payments for an invoice
   */
  async getPaymentsByInvoiceId(invoiceId: string): Promise<Payment[]> {
    const result = await this.dynamoClient.send(new QueryCommand({
      TableName: this.paymentsTableName,
      IndexName: 'InvoiceIndex',
      KeyConditionExpression: 'invoiceId = :invoiceId',
      ExpressionAttributeValues: {
        ':invoiceId': invoiceId,
      },
    }));

    return ((result as any).Items || []).map(item => this.mapDynamoItemToPayment(item as PaymentDynamoItem));
  }

  // ===========================
  // Helper Methods
  // ===========================

  /**
   * Generate unique invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get the count of invoices for this year-month
    const result = await this.dynamoClient.send(new ScanCommand({
      TableName: this.invoicesTableName,
      FilterExpression: 'begins_with(invoiceNumber, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': `INV-${year}-${month}`,
      },
      Select: 'COUNT',
    }));

    const count = (result.Count || 0) + 1;
    return `INV-${year}-${month}-${String(count).padStart(3, '0')}`;
  }

  /**
   * Calculate due date based on payment terms
   */
  private calculateDueDate(issueDate: string, paymentTerms: string): string {
    const issue = new Date(issueDate);
    let daysToAdd = 30; // Default to 30 days

    if (paymentTerms.includes('Net ')) {
      const days = parseInt(paymentTerms.replace('Net ', ''));
      if (!isNaN(days)) {
        daysToAdd = days;
      }
    } else if (paymentTerms === 'Due on receipt') {
      daysToAdd = 0;
    }

    const dueDate = new Date(issue);
    dueDate.setDate(dueDate.getDate() + daysToAdd);
    return dueDate.toISOString().split('T')[0];
  }

  /**
   * Calculate next invoice date for recurring invoices
   */
  private calculateNextInvoiceDate(config: Omit<RecurringInvoiceConfig, 'invoicesGenerated' | 'nextInvoiceDate'>): string {
    const start = new Date(config.startDate);
    
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
  }

  /**
   * Create line items from time entries
   */
  private async createLineItemsFromTimeEntries(
    timeEntryIds: string[],
    additionalItems: Omit<InvoiceLineItem, 'id'>[]
  ): Promise<InvoiceLineItem[]> {
    const lineItems: InvoiceLineItem[] = [];

    // Add time entry line items
    for (const timeEntryId of timeEntryIds) {
      // TODO: Fetch time entry details from time entries table
      // For now, create placeholder line items
      lineItems.push({
        id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'time',
        description: `Time entry ${timeEntryId}`,
        quantity: 1,
        rate: 100,
        amount: 100,
        timeEntryId,
        taxable: true,
      });
    }

    // Add additional line items
    for (const item of additionalItems) {
      lineItems.push({
        ...item,
        id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      });
    }

    return lineItems;
  }

  /**
   * Calculate invoice totals
   */
  private calculateInvoiceTotals(
    lineItems: InvoiceLineItem[],
    taxRate: number,
    discountRate: number
  ): { subtotal: number; taxAmount: number; discountAmount: number; totalAmount: number } {
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const discountAmount = subtotal * (discountRate / 100);
    const taxableAmount = lineItems
      .filter(item => item.taxable)
      .reduce((sum, item) => sum + item.amount, 0) - discountAmount;
    const taxAmount = taxableAmount * (taxRate / 100);
    const totalAmount = subtotal - discountAmount + taxAmount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }

  /**
   * Get client name by ID
   */
  private async getClientName(clientId: string): Promise<string> {
    // TODO: Implement client lookup
    // For now, return placeholder
    return `Client ${clientId}`;
  }

  /**
   * Apply additional filters to invoices
   */
  private applyInvoiceFilters(invoices: Invoice[], filters: InvoiceFilters): Invoice[] {
    let filtered = invoices;

    if (filters.projectId) {
      filtered = filtered.filter(invoice => 
        invoice.projectIds.includes(filters.projectId!)
      );
    }

    if (filters.isRecurring !== undefined) {
      filtered = filtered.filter(invoice => 
        invoice.isRecurring === filters.isRecurring
      );
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(invoice => 
        invoice.issueDate >= filters.dateFrom!
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(invoice => 
        invoice.issueDate <= filters.dateTo!
      );
    }

    if (filters.dueDateFrom) {
      filtered = filtered.filter(invoice => 
        invoice.dueDate >= filters.dueDateFrom!
      );
    }

    if (filters.dueDateTo) {
      filtered = filtered.filter(invoice => 
        invoice.dueDate <= filters.dueDateTo!
      );
    }

    if (filters.amountMin !== undefined) {
      filtered = filtered.filter(invoice => 
        invoice.totalAmount >= filters.amountMin!
      );
    }

    if (filters.amountMax !== undefined) {
      filtered = filtered.filter(invoice => 
        invoice.totalAmount <= filters.amountMax!
      );
    }

    if (filters.currency) {
      filtered = filtered.filter(invoice => 
        invoice.currency === filters.currency
      );
    }

    return filtered;
  }

  /**
   * Map DynamoDB item to Invoice object
   */
  private mapDynamoItemToInvoice(item: InvoiceDynamoItem): Invoice {
    return {
      id: item.id,
      invoiceNumber: item.invoiceNumber,
      clientId: item.clientId,
      clientName: item.clientName,
      projectIds: JSON.parse(item.projectIds || '[]'),
      timeEntryIds: JSON.parse(item.timeEntryIds || '[]'),
      status: item.status as any,
      
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
  }

  /**
   * Map DynamoDB item to Payment object
   */
  private mapDynamoItemToPayment(item: PaymentDynamoItem): Payment {
    return {
      id: item.id,
      invoiceId: item.invoiceId,
      amount: item.amount,
      currency: item.currency,
      paymentDate: item.paymentDate,
      paymentMethod: item.paymentMethod,
      reference: item.reference,
      notes: item.notes,
      status: item.status as any,
      externalPaymentId: item.externalPaymentId,
      processorFee: item.processorFee,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      recordedBy: item.recordedBy,
    };
  }
} 