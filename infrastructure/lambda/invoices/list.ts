import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { InvoiceRepository } from '../shared/invoice-repository';
import { 
  InvoiceFilters
} from '../shared/types';

// ✅ NEW: Import PowerTools utilities with correct v2.x pattern
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// ✅ NEW: Import Middy middleware for PowerTools v2.x
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

// ✅ FIXED: Use correct PowerTools v2.x middleware pattern
const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // ✅ NEW: Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);
    
    logger.info('Invoice list request started', {
      requestId,
      httpMethod: event.httpMethod,
      path: event.path,
      queryStringParameters: event.queryStringParameters,
    });

    // ✅ NEW: Track API request metrics
    businessMetrics.trackApiPerformance(
      '/invoices',
      'GET',
      0, // Will be updated later
      0  // Will be updated later
    );

    // Get current user from authorization context
    const currentUserId = getCurrentUserId(event);
    
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices', 'GET', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'invoices-list', false, { reason: 'no_user_id' });
      logger.warn('No user ID found in authorization context');
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // ✅ NEW: Add user context to tracer and logger
    const user = getAuthenticatedUser(event);
    businessTracer.addUserContext(currentUserId, user?.role, user?.department);
    addRequestContext(requestId, currentUserId, user?.role);

    logger.info('User authenticated successfully', { userId: currentUserId, userRole: user?.role });

    // ✅ NEW: Trace query parameter parsing
    const filters = await businessTracer.traceBusinessOperation(
      'parse-query-parameters',
      'invoice-filters',
      async () => {
        // Parse query parameters
        const queryParams = event.queryStringParameters || {};
        
        const parsedFilters: InvoiceFilters = {
          clientId: queryParams.clientId,
          projectId: queryParams.projectId,
          status: queryParams.status as 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'refunded' | undefined,
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
          sortBy: queryParams.sortBy as 'invoiceNumber' | 'issueDate' | 'dueDate' | 'totalAmount' | 'status' | undefined,
          sortOrder: queryParams.sortOrder as 'asc' | 'desc' | undefined,
        };

        logger.info('Query parameters parsed', { 
          userId: currentUserId, 
          filters: parsedFilters 
        });

        return parsedFilters;
      }
    );

    // ✅ NEW: Trace validation logic
    const validation = await businessTracer.traceBusinessOperation(
      'validate-invoice-filters',
      'invoice-filters',
      async () => {
        // Validate filters (basic validation)
        const errors: string[] = [];
        
        if (filters.status && !['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'refunded'].includes(filters.status)) {
          errors.push('Invalid status value');
        }
        
        if (filters.limit && (filters.limit < 1 || filters.limit > 100)) {
          errors.push('Limit must be between 1 and 100');
        }
        
        if (filters.offset && filters.offset < 0) {
          errors.push('Offset must be non-negative');
        }
        
        if (filters.sortOrder && !['asc', 'desc'].includes(filters.sortOrder)) {
          errors.push('Sort order must be asc or desc');
        }
        
        return { isValid: errors.length === 0, errors };
      }
    );
    
    if (!validation.isValid) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/invoices', 'GET', 400, responseTime);
      businessMetrics.trackBusinessKPI('InvoiceListValidationError', 1, MetricUnit.Count);
      businessLogger.logBusinessOperation('list', 'invoice', currentUserId, false, { 
        validationErrors: validation.errors 
      });
      
      logger.warn('Validation failed', { errors: validation.errors });
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    logger.info('Validation passed, fetching invoices', { 
      userId: currentUserId, 
      filters 
    });

    // ✅ NEW: Trace database operation
    const result = await businessTracer.traceDatabaseOperation(
      'list',
      'invoices',
      async () => {
        const invoiceRepository = new InvoiceRepository();
        return await invoiceRepository.listInvoices(filters);
      }
    );

    // ✅ NEW: Trace response preparation
    const responseData = await businessTracer.traceBusinessOperation(
      'prepare-response',
      'invoice-list',
      async () => {
        // TODO: Implement role-based filtering
        // For now, return all invoices. In the future, we should:
        // - Admins: see all invoices
        // - Managers: see invoices for their managed projects/clients
        // - Employees: see only invoices they created or are assigned to

        return {
          items: result.invoices,
          pagination: {
            total: result.total,
            limit: filters.limit || 50,
            offset: filters.offset || 0,
            hasMore: result.hasMore,
          },
        };
      }
    );

    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Track successful metrics
    businessMetrics.trackApiPerformance('/invoices', 'GET', 200, responseTime);
    businessMetrics.trackBusinessKPI('InvoicesListed', result.invoices.length, MetricUnit.Count);
    businessLogger.logBusinessOperation('list', 'invoice', currentUserId, true, { 
      invoiceCount: result.invoices.length,
      total: result.total,
      filters 
    });

    logger.info('Invoices retrieved successfully', { 
      userId: currentUserId, 
      invoiceCount: result.invoices.length,
      total: result.total,
      responseTime 
    });

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(responseData, 200, 'Invoices retrieved successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // ✅ NEW: Enhanced error logging and metrics
    businessMetrics.trackApiPerformance('/invoices', 'GET', 500, responseTime);
    businessMetrics.trackBusinessKPI('InvoiceListError', 1, MetricUnit.Count);
    
    businessLogger.logError(
      error instanceof Error ? error : new Error('Unknown error'),
      'invoices-list',
      getCurrentUserId(event),
      { responseTime }
    );
    
    logger.error('Invoice list error', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : { message: 'Unknown error' },
      responseTime,
    });
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// ✅ NEW: Export handler with PowerTools v2.x middleware pattern
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }))
  .use(logMetrics(metrics));
