import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  Invoice,
  InvoiceFilters
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { InvoiceRepository } from '../shared/invoice-repository';
import { getCurrentUserId } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

  try {
    // Get current user from authorization context
    console.log('🔐 Extracting user from authorization context...');
    const currentUserId = getCurrentUserId(event);
    console.log('👤 Current user ID:', currentUserId);
    
    if (!currentUserId) {
      console.log('❌ No user ID found in authorization context');
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse query parameters
    console.log('📝 Parsing query parameters...');
    const queryParams = event.queryStringParameters || {};
    console.log('🔍 Query parameters:', queryParams);
    
    const filters: InvoiceFilters = {
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
    
    console.log('🎯 Parsed filters:', filters);

    // Validate filters (basic validation)
    console.log('✅ Validating filters...');
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
    
    const validation = { isValid: errors.length === 0, errors };
    console.log('📊 Validation result:', validation);
    
    if (!validation.isValid) {
      console.log('❌ Validation failed:', validation.errors);
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    console.log('🏗️ Creating InvoiceRepository instance...');
    const invoiceRepository = new InvoiceRepository();

    // Get invoices with pagination
    console.log('📋 Fetching invoices from repository...');
    const result = await invoiceRepository.listInvoices(filters);
    console.log('📊 Repository result:', {
      invoiceCount: result.invoices.length,
      total: result.total,
      hasMore: result.hasMore
    });

    // TODO: Implement role-based filtering
    // For now, return all invoices. In the future, we should:
    // - Admins: see all invoices
    // - Managers: see invoices for their managed projects/clients
    // - Employees: see only invoices they created or are assigned to

    const responseData = {
      items: result.invoices,
      pagination: {
        total: result.total,
        limit: filters.limit || 50,
        offset: filters.offset || 0,
        hasMore: result.hasMore,
      },
    };

    console.log('✅ Successfully prepared response:', {
      itemCount: responseData.items.length,
      pagination: responseData.pagination
    });

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(responseData, 200, 'Invoices retrieved successfully');

  } catch (error) {
    // Log error for debugging
    console.error('❌ Invoice List Handler - Error occurred:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
