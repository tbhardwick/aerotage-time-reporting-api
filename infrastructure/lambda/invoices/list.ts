import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  Invoice,
  PaginationResponse,
  ErrorResponse,
  InvoiceFilters
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { InvoiceRepository } from '../shared/invoice-repository';
import { getCurrentUserId } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('List invoices request:', JSON.stringify(event, null, 2));

  try {
    // Get current user from authorization context
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const filters: InvoiceFilters = {
      clientId: queryParams.clientId,
      projectId: queryParams.projectId,
      status: queryParams.status as any,
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
      sortBy: queryParams.sortBy as any,
      sortOrder: queryParams.sortOrder as any,
    };

    // Validate filters
    const validation = ValidationService.validateInvoiceFilters(filters);
    if (!validation.isValid) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    const invoiceRepository = new InvoiceRepository();

    // Get invoices with pagination
    const result = await invoiceRepository.listInvoices(filters);

    // TODO: Implement role-based filtering
    // For now, return all invoices. In the future, we should:
    // - Admins: see all invoices
    // - Managers: see invoices for their managed projects/clients
    // - Employees: see only invoices they created or are assigned to

    const response: PaginationResponse<Invoice> = {
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Error listing invoices:', error);
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
