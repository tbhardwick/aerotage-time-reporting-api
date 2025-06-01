import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { InvoiceRepository } from '../shared/invoice-repository';
import { UpdateInvoiceRequest, InvoiceErrorCodes } from '../shared/types';

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

    logger.info('Update invoice request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}', 'PUT', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'update-invoice', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Get invoice ID from path parameters
    const invoiceId = event.pathParameters?.id;
    if (!invoiceId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('Invoice ID is required'), 'update-invoice-validation', currentUserId);
      return createErrorResponse(400, 'MISSING_PARAMETER', 'Invoice ID is required');
    }

    // Parse request body with tracing
    const requestBody = await businessTracer.traceBusinessOperation(
      'parse-invoice-update-request',
      'invoice',
      async () => {
        return JSON.parse(event.body || '{}');
      }
    );

    logger.info('Update invoice request parsed', { 
      currentUserId,
      invoiceId,
      userRole,
      hasUpdateData: Object.keys(requestBody).length > 0
    });
    
    // Validation will be handled by the repository method
    
    const invoiceRepository = new InvoiceRepository();

    // Check if invoice exists with tracing
    const existingInvoice = await businessTracer.traceDatabaseOperation(
      'get-existing-invoice',
      'invoices',
      async () => {
        return await invoiceRepository.getInvoiceById(invoiceId);
      }
    );

    if (!existingInvoice) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}', 'PUT', 404, responseTime);
      businessLogger.logBusinessOperation('update', 'invoice', currentUserId, false, { 
        invoiceId,
        reason: 'invoice_not_found' 
      });
      return createErrorResponse(404, InvoiceErrorCodes.INVOICE_NOT_FOUND, 'Invoice not found');
    }

    // Check if invoice can be modified with tracing
    const modificationCheck = await businessTracer.traceBusinessOperation(
      'validate-invoice-modification',
      'invoice',
      async () => {
        if (existingInvoice.status === 'paid' || existingInvoice.status === 'cancelled') {
          return { canModify: false, reason: 'status_restriction', currentStatus: existingInvoice.status };
        }
        return { canModify: true };
      }
    );

    if (!modificationCheck.canModify) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}', 'PUT', 400, responseTime);
      businessLogger.logBusinessOperation('update', 'invoice', currentUserId, false, { 
        invoiceId,
        currentStatus: existingInvoice.status,
        reason: 'invoice_cannot_be_modified'
      });
      return createErrorResponse(400, InvoiceErrorCodes.INVOICE_CANNOT_BE_MODIFIED, 'Paid or cancelled invoices cannot be modified');
    }

    // Role-based access control with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-invoice-update-permissions',
      'invoice',
      async () => {
        if (userRole === 'employee') {
          // Employees can only update invoices they created and only if in draft status
          if (existingInvoice.createdBy !== currentUserId) {
            return { canUpdate: false, reason: 'not_creator' };
          }
          if (existingInvoice.status !== 'draft') {
            return { canUpdate: false, reason: 'not_draft_status', currentStatus: existingInvoice.status };
          }
        } else if (userRole === 'manager') {
          // Managers can update invoices for their managed projects/clients
          // TODO: Implement team/project association check when user teams are implemented
          // For now, allow managers to update any invoice
        }
        // Admins can update any invoice (no additional restrictions)
        return { canUpdate: true };
      }
    );

    if (!accessControl.canUpdate) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/{id}', 'PUT', 403, responseTime);
      
      if (accessControl.reason === 'not_creator') {
        businessLogger.logAuth(currentUserId, 'update-invoice', false, { 
          invoiceId,
          createdBy: existingInvoice.createdBy,
          reason: 'not_creator',
          userRole
        });
        return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You can only update invoices you created');
      } else {
        businessLogger.logAuth(currentUserId, 'update-invoice', false, { 
          invoiceId,
          currentStatus: existingInvoice.status,
          reason: 'not_draft_status',
          userRole
        });
        return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You can only update draft invoices');
      }
    }

    // Update the invoice with tracing
    const updatedInvoice = await businessTracer.traceDatabaseOperation(
      'update-invoice',
      'invoices',
      async () => {
        return await invoiceRepository.updateInvoice(invoiceId, requestBody as UpdateInvoiceRequest);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/invoices/{id}', 'PUT', 200, responseTime);
    businessLogger.logBusinessOperation('update', 'invoice', currentUserId, true, { 
      invoiceId,
      previousStatus: existingInvoice.status,
      newStatus: updatedInvoice.status,
      clientId: updatedInvoice.clientId,
      amount: updatedInvoice.totalAmount,
      userRole
    });

    logger.info('Invoice updated successfully', { 
      currentUserId,
      invoiceId,
      previousStatus: existingInvoice.status,
      newStatus: updatedInvoice.status,
      clientId: updatedInvoice.clientId,
      amount: updatedInvoice.totalAmount,
      responseTime 
    });

    return createSuccessResponse(updatedInvoice, 200, 'Invoice updated successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/invoices/{id}', 'PUT', 500, responseTime);
    businessLogger.logError(error as Error, 'update-invoice', getCurrentUserId(event) || 'unknown');

    logger.error('Error updating invoice', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      invoiceId: event.pathParameters?.id,
      responseTime
    });
    
    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message.includes('Invoice not found') || error.message.includes('attribute_exists')) {
        return createErrorResponse(404, InvoiceErrorCodes.INVOICE_NOT_FOUND, 'Invoice not found');
      }
      if (error.message.includes('No valid updates provided')) {
        return createErrorResponse(400, 'VALIDATION_ERROR', 'No valid updates provided');
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
