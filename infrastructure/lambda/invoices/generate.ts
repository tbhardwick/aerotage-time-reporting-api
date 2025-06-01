import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { InvoiceRepository } from '../shared/invoice-repository';
import { 
  CreateInvoiceRequest,
  InvoiceErrorCodes
} from '../shared/types';

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

    logger.info('Generate invoice request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/generate', 'POST', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'generate-invoice', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Parse request body
    if (!event.body) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/generate', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Request body is required'), 'generate-invoice-validation', currentUserId);
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Request body is required');
    }

    let requestData: CreateInvoiceRequest;
    try {
      requestData = JSON.parse(event.body);
      logger.info('Request body parsed successfully', { 
        userId: currentUserId,
        clientId: requestData.clientId,
        hasProjectIds: !!requestData.projectIds?.length,
        hasTimeEntryIds: !!requestData.timeEntryIds?.length,
        hasAdditionalItems: !!requestData.additionalLineItems?.length
      });
    } catch {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/generate', 'POST', 400, responseTime);
      businessLogger.logError(new Error('Invalid JSON in request body'), 'generate-invoice-parse', currentUserId);
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate request data with tracing
    const validationErrors = await businessTracer.traceBusinessOperation(
      'validate-invoice-request',
      'invoice',
      async () => {
        const errors: string[] = [];
        
        // Basic validation - ensure required fields are present
        if (!requestData.clientId || typeof requestData.clientId !== 'string') {
          errors.push('Client ID is required and must be a string');
        }

        // Validate that at least one data source is provided
        if ((!requestData.projectIds || requestData.projectIds.length === 0) &&
            (!requestData.timeEntryIds || requestData.timeEntryIds.length === 0) &&
            (!requestData.additionalLineItems || requestData.additionalLineItems.length === 0)) {
          errors.push('At least one of projectIds, timeEntryIds, or additionalLineItems must be provided');
        }

        return errors;
      }
    );

    if (validationErrors.length > 0) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/generate', 'POST', 400, responseTime);
      businessLogger.logBusinessOperation('generate', 'invoice', currentUserId, false, { 
        validationErrors 
      });
      return createErrorResponse(400, 'VALIDATION_ERROR', `Validation failed: ${validationErrors.join(', ')}`);
    }

    // Authorization check with tracing
    const authorizationResult = await businessTracer.traceBusinessOperation(
      'check-authorization',
      'invoice',
      async () => {
        // Only managers and admins can generate invoices
        if (userRole === 'employee') {
          return { authorized: false, reason: 'insufficient_role' };
        }
        return { authorized: true };
      }
    );

    if (!authorizationResult.authorized) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices/generate', 'POST', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'generate-invoice', false, { 
        reason: authorizationResult.reason,
        userRole 
      });
      return createErrorResponse(403, 'FORBIDDEN', 'Only managers and admins can generate invoices');
    }

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const invoiceRepository = new InvoiceRepository();

    // Generate invoice with tracing
    const invoice = await businessTracer.traceDatabaseOperation(
      'create-invoice',
      'invoices',
      async () => {
        return await invoiceRepository.createInvoice(requestData, currentUserId);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/invoices/generate', 'POST', 201, responseTime);
    businessLogger.logBusinessOperation('generate', 'invoice', currentUserId, true, { 
      clientId: requestData.clientId,
      invoiceId: invoice.id,
      projectCount: requestData.projectIds?.length || 0,
      timeEntryCount: requestData.timeEntryIds?.length || 0,
      additionalItemCount: requestData.additionalLineItems?.length || 0,
      userRole
    });

    logger.info('Invoice generation completed', { 
      userId: currentUserId,
      invoiceId: invoice.id,
      clientId: requestData.clientId,
      responseTime 
    });

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(invoice, 201, 'Invoice generated successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/invoices/generate', 'POST', 500, responseTime);
    businessLogger.logError(error as Error, 'generate-invoice', getCurrentUserId(event) || 'unknown');

    logger.error('Error generating invoice', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message.includes('Client not found')) {
        return createErrorResponse(404, InvoiceErrorCodes.INVALID_INVOICE_DATA, 'Client not found');
      }
      if (error.message.includes('No billable time entries')) {
        return createErrorResponse(400, InvoiceErrorCodes.NO_BILLABLE_TIME_ENTRIES, 'No billable time entries found for the specified criteria');
      }
      if (error.message.includes('Time entries already invoiced')) {
        return createErrorResponse(400, InvoiceErrorCodes.TIME_ENTRIES_ALREADY_INVOICED, 'Some time entries have already been invoiced');
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
