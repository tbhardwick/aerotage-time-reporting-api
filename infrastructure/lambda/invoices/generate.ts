import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { InvoiceRepository } from '../shared/invoice-repository';
import { 
  CreateInvoiceRequest,
  Invoice,
  InvoiceErrorCodes
} from '../shared/types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Request body is required');
    }

    let requestData: CreateInvoiceRequest;
    try {
      requestData = JSON.parse(event.body);
    } catch (parseError) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body');
    }

    // Basic validation - ensure required fields are present
    if (!requestData.clientId || typeof requestData.clientId !== 'string') {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Client ID is required and must be a string');
    }

    // Validate that at least one data source is provided
    if ((!requestData.projectIds || requestData.projectIds.length === 0) &&
        (!requestData.timeEntryIds || requestData.timeEntryIds.length === 0) &&
        (!requestData.additionalLineItems || requestData.additionalLineItems.length === 0)) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'At least one of projectIds, timeEntryIds, or additionalLineItems must be provided');
    }

    // Authorization check: Only managers and admins can generate invoices
    if (userRole === 'employee') {
      return createErrorResponse(403, 'FORBIDDEN', 'Only managers and admins can generate invoices');
    }

    // MANDATORY: Use repository pattern instead of direct DynamoDB
    const invoiceRepository = new InvoiceRepository();

    // Generate invoice
    const invoice = await invoiceRepository.createInvoice(requestData, currentUserId);

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(invoice, 201, 'Invoice generated successfully');

  } catch (error) {
    console.error('Error generating invoice:', error);
    
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
