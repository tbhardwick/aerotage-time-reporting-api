import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  CreateInvoiceRequest,
  Invoice,
  SuccessResponse,
  InvoiceErrorCodes
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { InvoiceRepository } from '../shared/invoice-repository';
import { getCurrentUserId } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('🧾 Invoice Generate Handler - Request received:', {
    httpMethod: event.httpMethod,
    path: event.path,
    body: event.body ? 'Present' : 'None',
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

    // Parse request body
    console.log('📝 Parsing request body...');
    if (!event.body) {
      console.log('❌ No request body provided');
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Request body is required');
    }

    let requestData: CreateInvoiceRequest;
    try {
      requestData = JSON.parse(event.body);
      console.log('📊 Parsed request data:', {
        clientId: requestData.clientId,
        projectIds: requestData.projectIds?.length || 0,
        timeEntryIds: requestData.timeEntryIds?.length || 0,
        isRecurring: requestData.isRecurring
      });
    } catch (parseError) {
      console.log('❌ Failed to parse request body:', parseError);
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body');
    }

    // Validate request
    console.log('✅ Validating create invoice request...');
    const validation = ValidationService.validateCreateInvoiceRequest(requestData);
    console.log('📊 Validation result:', validation);
    
    if (!validation.isValid) {
      console.log('❌ Validation failed:', validation.errors);
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    console.log('🏗️ Creating InvoiceRepository instance...');
    const invoiceRepository = new InvoiceRepository();

    // Generate invoice
    console.log('🧾 Generating invoice...');
    const invoice = await invoiceRepository.createInvoice(requestData, currentUserId);
    console.log('✅ Invoice generated successfully:', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount,
      status: invoice.status
    });

    const response: SuccessResponse<Invoice> = {
      success: true,
      data: invoice,
    };

    console.log('✅ Successfully prepared response');

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('❌ Invoice Generate Handler - Error occurred:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
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
