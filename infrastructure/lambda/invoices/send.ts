import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  Invoice,
  SendInvoiceRequest,
  SuccessResponse,
  ErrorResponse,
  InvoiceErrorCodes
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { InvoiceRepository } from '../shared/invoice-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Send invoice request:', JSON.stringify(event, null, 2));

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
    const validation = ValidationService.validateSendInvoiceRequest(requestBody);
    if (!validation.isValid) {
      return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
    }

    const invoiceRepository = new InvoiceRepository();

    // Check if invoice exists
    const existingInvoice = await invoiceRepository.getInvoiceById(invoiceId);
    if (!existingInvoice) {
      return createErrorResponse(404, InvoiceErrorCodes.INVOICE_NOT_FOUND, 'Invoice not found');
    }

    // Check if invoice can be sent
    if (existingInvoice.status === 'cancelled') {
      return createErrorResponse(400, InvoiceErrorCodes.INVOICE_CANNOT_BE_MODIFIED, 'Cancelled invoices cannot be sent');
    }

    // TODO: Implement role-based access control
    // For now, allow any authenticated user to send invoices
    // In the future, we should check:
    // - Admins: can send any invoice
    // - Managers: can send invoices for their managed projects/clients
    // - Employees: can only send invoices they created

    // TODO: Implement actual email sending logic
    // This would involve:
    // 1. Generate PDF if not already generated
    // 2. Get client email address
    // 3. Send email via SES with invoice attached
    // 4. Update invoice status and sent timestamp

    // For now, just update the invoice status to 'sent'
    const sendData = requestBody as SendInvoiceRequest;
    const now = new Date().toISOString();
    
    const updatedInvoice = await invoiceRepository.updateInvoice(invoiceId, {
      status: 'sent',
    });

    // TODO: Record the actual sending in a separate operation
    // This would update sentAt, sentBy, and increment remindersSent if this is a reminder

    const response: SuccessResponse<Invoice> = {
      success: true,
      data: updatedInvoice,
      message: 'Invoice sent successfully',
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
    console.error('Error sending invoice:', error);
    
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
