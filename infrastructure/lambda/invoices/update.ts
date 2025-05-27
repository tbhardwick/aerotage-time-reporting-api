import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  Invoice,
  UpdateInvoiceRequest,
  SuccessResponse,
  ErrorResponse,
  InvoiceErrorCodes
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { InvoiceRepository } from '../shared/invoice-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Update invoice request:', JSON.stringify(event, null, 2));

  try {
    // Get current user from authorization context
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Get invoice ID from path parameters
    const invoiceId = event.pathParameters?.id;
    if (!invoiceId) {
      return createErrorResponse(400, 'MISSING_PARAMETER', 'Invoice ID is required');
    }

    // Parse request body
    const requestBody = JSON.parse(event.body || '{}');
    
    // Validate request
    const validation = ValidationService.validateUpdateInvoiceRequest(requestBody);
    if (!validation.isValid) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    const invoiceRepository = new InvoiceRepository();

    // Check if invoice exists
    const existingInvoice = await invoiceRepository.getInvoiceById(invoiceId);
    if (!existingInvoice) {
      return createErrorResponse(404, InvoiceErrorCodes.INVOICE_NOT_FOUND, 'Invoice not found');
    }

    // Check if invoice can be modified
    if (existingInvoice.status === 'paid' || existingInvoice.status === 'cancelled') {
      return createErrorResponse(400, InvoiceErrorCodes.INVOICE_CANNOT_BE_MODIFIED, 'Paid or cancelled invoices cannot be modified');
    }

    // TODO: Implement role-based access control
    // For now, allow any authenticated user to update invoices
    // In the future, we should check:
    // - Admins: can update any invoice
    // - Managers: can update invoices for their managed projects/clients
    // - Employees: can only update invoices they created (if in draft status)

    // Update the invoice
    const updatedInvoice = await invoiceRepository.updateInvoice(invoiceId, requestBody as UpdateInvoiceRequest);

    const response: SuccessResponse<Invoice> = {
      success: true,
      data: updatedInvoice,
      message: 'Invoice updated successfully',
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
    console.error('Error updating invoice:', error);
    
    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message.includes('Invoice not found') || error.message.includes('attribute_exists')) {
        return createErrorResponse(404, InvoiceErrorCodes.INVOICE_NOT_FOUND, 'Invoice not found');
      }
      if (error.message.includes('No valid updates provided')) {
        return createErrorResponse(400, 'VALIDATION_ERROR', 'No valid updates provided');
      }
    }
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An internal server error occurred',
        },
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

/**
 * Extracts current user ID from authorization context
 */
function getCurrentUserId(event: APIGatewayProxyEvent): string | null {
  const authContext = event.requestContext.authorizer;
  
  // Primary: get from custom authorizer context
  if (authContext?.userId) {
    return authContext.userId;
  }

  // Fallback: try to get from Cognito claims
  if (authContext?.claims?.sub) {
    return authContext.claims.sub;
  }

  return null;
}

/**
 * Creates standardized error response
 */
function createErrorResponse(
  statusCode: number, 
  errorCode: string, 
  message: string
): APIGatewayProxyResult {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
    },
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(errorResponse),
  };
}
