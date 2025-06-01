import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { 
  Invoice,
  Payment,
  RecordPaymentRequest
} from '../shared/types';
import { InvoiceRepository } from '../shared/invoice-repository';

// PowerTools v2.x imports
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools v2.x middleware
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const invoiceRepository = new InvoiceRepository();

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Invoice status update request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}/status', 'PUT', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'update-invoice-status', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Extract invoice ID from path parameters
    const invoiceId = event.pathParameters?.id;
    if (!invoiceId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}/status', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('Invoice ID is required'), 'update-invoice-status-validation', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Invoice ID is required');
    }

    // Parse request body
    if (!event.body) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}/status', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('Request body is required'), 'update-invoice-status-validation', currentUserId);
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let requestBody: any;
    try {
      requestBody = JSON.parse(event.body);
      const operation = requestBody.operation as 'updateStatus' | 'recordPayment';
      
      logger.info('Invoice status request parsed', { 
        currentUserId,
        invoiceId,
        operation,
        newStatus: requestBody.status,
        userRole
      });
    } catch {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}/status', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('Invalid JSON in request body'), 'update-invoice-status-parse', currentUserId);
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    const operation = requestBody.operation as 'updateStatus' | 'recordPayment';

    // Get existing invoice with tracing
    const existingInvoice = await businessTracer.traceDatabaseOperation(
      'get-invoice',
      'invoices',
      async () => {
        return await invoiceRepository.getInvoiceById(invoiceId);
      }
    );

    if (!existingInvoice) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}/status', 'PUT', 404, responseTime);
      businessLogger.logBusinessOperation('update-status', 'invoice', currentUserId, false, { 
        invoiceId,
        operation,
        reason: 'invoice_not_found' 
      });
      return createErrorResponse(404, 'INVOICE_NOT_FOUND', 'Invoice not found');
    }

    // Apply access control with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-status-update-permissions',
      'invoice',
      async () => {
        return applyAccessControl(existingInvoice, currentUserId, userRole, operation, requestBody.status);
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}/status', 'PUT', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'update-invoice-status', false, { 
        invoiceId,
        operation,
        currentStatus: existingInvoice.status,
        newStatus: requestBody.status,
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', accessControl.reason || 'You do not have permission to update this invoice');
    }

    let updatedInvoice: Invoice;
    let payment: Payment | null = null;

    if (operation === 'updateStatus') {
      // Update invoice status with tracing
      updatedInvoice = await businessTracer.traceDatabaseOperation(
        'update-invoice-status',
        'invoices',
        async () => {
          return await invoiceRepository.updateInvoice(invoiceId, { status: requestBody.status });
        }
      );
    } else {
      // Record payment with tracing
      const paymentRequest: RecordPaymentRequest = await businessTracer.traceBusinessOperation(
        'prepare-payment-request',
        'invoice',
        async () => {
          return {
            amount: requestBody.amount,
            paymentDate: requestBody.paymentDate,
            paymentMethod: requestBody.paymentMethod,
            reference: requestBody.reference,
            notes: requestBody.notes,
            externalPaymentId: requestBody.externalPaymentId,
            processorFee: requestBody.processorFee
          };
        }
      );

      payment = await businessTracer.traceDatabaseOperation(
        'record-payment',
        'invoices',
        async () => {
          return await invoiceRepository.recordPayment(invoiceId, paymentRequest, currentUserId);
        }
      );

      updatedInvoice = await businessTracer.traceDatabaseOperation(
        'get-updated-invoice',
        'invoices',
        async () => {
          return await invoiceRepository.getInvoiceById(invoiceId) as Invoice;
        }
      );
    }

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/invoices/{id}/status', 'PUT', 200, responseTime);
    businessLogger.logBusinessOperation('update-status', 'invoice', currentUserId, true, { 
      invoiceId,
      invoiceNumber: existingInvoice.invoiceNumber,
      operation,
      previousStatus: existingInvoice.status,
      newStatus: updatedInvoice.status,
      paymentAmount: payment?.amount,
      paymentMethod: payment?.paymentMethod,
      userRole
    });

    logger.info('Invoice status update completed', { 
      currentUserId,
      invoiceId,
      invoiceNumber: existingInvoice.invoiceNumber,
      operation,
      previousStatus: existingInvoice.status,
      newStatus: updatedInvoice.status,
      paymentRecorded: !!payment,
      responseTime 
    });

    const response = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          invoice: updatedInvoice,
          payment,
        },
      }),
    };

    return response;

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/invoices/{id}/status', 'PUT', 500, responseTime);
    businessLogger.logError(error as Error, 'update-invoice-status', getCurrentUserId(event) || 'unknown');

    logger.error('Error updating invoice status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      invoiceId: event.pathParameters?.id,
      responseTime
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to update invoice status');
  }
};

function applyAccessControl(
  invoice: Invoice,
  currentUserId: string,
  userRole: string,
  operation: 'updateStatus' | 'recordPayment',
  newStatus?: string
): { canAccess: boolean; reason?: string } {
  // Check basic access permissions
  if (userRole === 'employee') {
    // Employees have limited status update permissions - only for invoices they created
    if (invoice.createdBy !== currentUserId) {
      return {
        canAccess: false,
        reason: 'You can only update status for invoices you created',
      };
    }

    // Employees cannot record payments
    if (operation === 'recordPayment') {
      return {
        canAccess: false,
        reason: 'You do not have permission to record payments',
      };
    }

    // Employees can only update to specific statuses
    const allowedEmployeeStatuses = ['draft', 'sent'];
    if (newStatus && !allowedEmployeeStatuses.includes(newStatus)) {
      return {
        canAccess: false,
        reason: `You can only set status to: ${allowedEmployeeStatuses.join(', ')}`,
      };
    }
  } else if (userRole === 'manager') {
    // TODO: Implement team/project association check when user teams are implemented
    // For now, allow managers to update any invoice status and record payments
  }
  // Admins can update any invoice status and record payments (no additional restrictions)

  // Validate status transition if this is a status update
  if (operation === 'updateStatus' && newStatus) {
    const validation = validateStatusTransition(invoice.status, newStatus);
    if (!validation.allowed) {
      return {
        canAccess: false,
        reason: validation.reason,
      };
    }
  }

  return { canAccess: true };
}

/**
 * Validates status transitions based on business rules
 */
function validateStatusTransition(currentStatus: string, newStatus: string): { allowed: boolean; reason?: string } {
  // Define allowed transitions
  const allowedTransitions: Record<string, string[]> = {
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

  const allowed = allowedTransitions[currentStatus]?.includes(newStatus) || false;
  
  if (!allowed) {
    return {
      allowed: false,
      reason: `Cannot transition from ${currentStatus} to ${newStatus}`,
    };
  }

  return { allowed: true };
}

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics));
