import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { 
  InvoiceErrorCodes
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

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Send invoice request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}/send', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'send-invoice', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const userRole = getAuthenticatedUser(event)?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Get invoice ID from path parameters
    const invoiceId = event.pathParameters?.id;
    if (!invoiceId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}/send', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Invoice ID is required'), 'send-invoice-validation', currentUserId);
      return createErrorResponse(400, 'MISSING_PARAMETER', 'Invoice ID is required');
    }

    logger.info('Send invoice request parsed', { 
      currentUserId,
      invoiceId,
      userRole
    });

    // Validation will be handled by the repository method
    
    const invoiceRepository = new InvoiceRepository();

    // Check if invoice exists with tracing
    const existingInvoice = await businessTracer.traceDatabaseOperation(
      'get-invoice',
      'invoices',
      async () => {
        return await invoiceRepository.getInvoiceById(invoiceId);
      }
    );

    if (!existingInvoice) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}/send', 'POST', 404, responseTime);
      businessLogger.logBusinessOperation('send', 'invoice', currentUserId, false, { 
        invoiceId,
        reason: 'invoice_not_found' 
      });
      return createErrorResponse(404, InvoiceErrorCodes.INVOICE_NOT_FOUND, 'Invoice not found');
    }

    // Check if invoice can be sent with tracing
    const statusValidation = await businessTracer.traceBusinessOperation(
      'validate-invoice-status',
      'invoice',
      async () => {
        if (existingInvoice.status === 'cancelled') {
          return { canSend: false, reason: 'cancelled_invoice' };
        }
        return { canSend: true };
      }
    );

    if (!statusValidation.canSend) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}/send', 'POST', 400, responseTime);
      businessLogger.logBusinessOperation('send', 'invoice', currentUserId, false, { 
        invoiceId,
        invoiceStatus: existingInvoice.status,
        reason: statusValidation.reason
      });
      return createErrorResponse(400, InvoiceErrorCodes.INVOICE_CANNOT_BE_MODIFIED, 'Cancelled invoices cannot be sent');
    }

    // Role-based access control with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-send-permissions',
      'invoice',
      async () => {
        if (userRole === 'employee') {
          // Employees can only send invoices they created
          if (existingInvoice.createdBy !== currentUserId) {
            return { canAccess: false, reason: 'not_creator' };
          }
        } else if (userRole === 'manager') {
          // Managers can send invoices for their managed projects/clients
          // TODO: Implement team/project association check when user teams are implemented
          // For now, allow managers to send any invoice
        }
        // Admins can send any invoice (no additional restrictions)
        return { canAccess: true };
      }
    );

    if (!accessControl.canAccess) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}/send', 'POST', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'send-invoice', false, { 
        invoiceId,
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You can only send invoices you created');
    }

    // TODO: Implement actual email sending logic with tracing
    // This would involve:
    // 1. Generate PDF if not already generated
    // 2. Get client email address
    // 3. Send email via SES with invoice attached
    // 4. Update invoice status and sent timestamp

    // For now, just update the invoice status to 'sent' with tracing
    const updatedInvoice = await businessTracer.traceDatabaseOperation(
      'update-invoice-status',
      'invoices',
      async () => {
        return await invoiceRepository.updateInvoice(invoiceId, {
          status: 'sent',
        });
      }
    );

    // TODO: Record the actual sending in a separate operation
    // This would update sentAt, sentBy, and increment remindersSent if this is a reminder

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/invoices/{id}/send', 'POST', 200, responseTime);
    businessLogger.logBusinessOperation('send', 'invoice', currentUserId, true, { 
      invoiceId,
      invoiceNumber: existingInvoice.invoiceNumber,
      clientId: existingInvoice.clientId,
      amount: existingInvoice.totalAmount,
      previousStatus: existingInvoice.status,
      newStatus: 'sent'
    });

    logger.info('Invoice send completed', { 
      currentUserId,
      invoiceId,
      invoiceNumber: existingInvoice.invoiceNumber,
      clientId: existingInvoice.clientId,
      amount: existingInvoice.totalAmount,
      responseTime 
    });

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(updatedInvoice, 200, 'Invoice sent successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/invoices/{id}/send', 'POST', 500, responseTime);
    businessLogger.logError(error as Error, 'send-invoice', getCurrentUserId(event) || 'unknown');

    logger.error('Error sending invoice', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      invoiceId: event.pathParameters?.id,
      responseTime
    });
    
    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message.includes('Invoice not found')) {
        return createErrorResponse(404, InvoiceErrorCodes.INVOICE_NOT_FOUND, 'Invoice not found');
      }
      if (error.message.includes('Email send failed')) {
        return createErrorResponse(500, InvoiceErrorCodes.EMAIL_SEND_FAILED, 'Failed to send invoice email');
      }
      if (error.message.includes('PDF generation failed')) {
        return createErrorResponse(500, InvoiceErrorCodes.PDF_GENERATION_FAILED, 'Failed to generate invoice PDF');
      }
    }
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics));
