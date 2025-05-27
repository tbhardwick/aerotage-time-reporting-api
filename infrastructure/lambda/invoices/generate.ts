import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  Invoice,
  CreateInvoiceRequest,
  SuccessResponse,
  ErrorResponse,
  InvoiceErrorCodes
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { InvoiceRepository } from '../shared/invoice-repository';
import { getCurrentUserId } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Generate invoice request:', JSON.stringify(event, null, 2));

  try {
    // Get current user from authorization context
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse request body
    const requestBody = JSON.parse(event.body || '{}');
    
    // Validate request
    const validation = ValidationService.validateCreateInvoiceRequest(requestBody);
    if (!validation.isValid) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    const invoiceRepository = new InvoiceRepository();

    // Create the invoice
    const invoice = await invoiceRepository.createInvoice(requestBody as CreateInvoiceRequest, currentUserId);

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
