import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  Invoice,
  Payment,
  RecordPaymentRequest,
  SuccessResponse,
  ErrorResponse,
  InvoiceErrorCodes
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { InvoiceRepository } from '../shared/invoice-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Update invoice status request:', JSON.stringify(event, null, 2));

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
    
    // Determine the operation type
    const operation = requestBody.operation || 'updateStatus';
    
    const invoiceRepository = new InvoiceRepository();

    // Check if invoice exists
    const existingInvoice = await invoiceRepository.getInvoiceById(invoiceId);
    if (!existingInvoice) {
      return createErrorResponse(404, InvoiceErrorCodes.INVOICE_NOT_FOUND, 'Invoice not found');
    }

    // TODO: Implement role-based access control
    // For now, allow any authenticated user to update invoice status
    // In the future, we should check:
    // - Admins: can update any invoice status
    // - Managers: can update status for their managed projects/clients
    // - Employees: limited status update permissions

    let updatedInvoice: Invoice;
    let payment: Payment | null = null;

    if (operation === 'recordPayment') {
      // Validate payment request
      const validation = ValidationService.validateRecordPaymentRequest(requestBody);
      if (!validation.isValid) {
        return createErrorResponse(400, 'VALIDATION_ERROR', validation.errors.join(', '));
      }

      // Record the payment
      payment = await invoiceRepository.recordPayment(invoiceId, requestBody as RecordPaymentRequest, currentUserId);
      
      // Get the updated invoice (payment recording may have updated the status)
      updatedInvoice = await invoiceRepository.getInvoiceById(invoiceId) as Invoice;
    } else {
      // Simple status update
      if (!requestBody.status) {
        return createErrorResponse(400, 'VALIDATION_ERROR', 'Status is required');
      }

      const allowedStatuses = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'refunded'];
      if (!allowedStatuses.includes(requestBody.status)) {
        return createErrorResponse(400, 'VALIDATION_ERROR', `Status must be one of: ${allowedStatuses.join(', ')}`);
      }

             // Check business rules for status transitions
       const canTransition = validateStatusTransition(existingInvoice.status, requestBody.status);
       if (!canTransition.allowed) {
         return createErrorResponse(400, 'INVALID_STATUS_TRANSITION', canTransition.reason || 'Invalid status transition');
       }

      // Update the invoice status
      updatedInvoice = await invoiceRepository.updateInvoice(invoiceId, {
        status: requestBody.status,
      });
    }

    const responseData: any = {
      invoice: updatedInvoice,
    };

    if (payment) {
      responseData.payment = payment;
    }

    const response: SuccessResponse<any> = {
      success: true,
      data: responseData,
      message: operation === 'recordPayment' ? 'Payment recorded successfully' : 'Invoice status updated successfully',
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
    console.error('Error updating invoice status:', error);
    
    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message.includes('Invoice not found')) {
        return createErrorResponse(404, InvoiceErrorCodes.INVOICE_NOT_FOUND, 'Invoice not found');
      }
      if (error.message.includes('Payment amount exceeds invoice total')) {
        return createErrorResponse(400, InvoiceErrorCodes.PAYMENT_EXCEEDS_INVOICE, 'Payment amount exceeds invoice total');
      }
      if (error.message.includes('Payment already recorded')) {
        return createErrorResponse(400, InvoiceErrorCodes.PAYMENT_ALREADY_RECORDED, 'Payment has already been recorded');
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
 * Validates status transitions based on business rules
 */
function validateStatusTransition(currentStatus: string, newStatus: string): { allowed: boolean; reason?: string } {
  // Define allowed transitions
  const allowedTransitions: Record<string, string[]> = {
    'draft': ['sent', 'cancelled'],
    'sent': ['viewed', 'paid', 'overdue', 'cancelled'],
    'viewed': ['paid', 'overdue', 'cancelled'],
    'paid': ['refunded'], // Paid invoices can only be refunded
    'overdue': ['paid', 'cancelled'],
    'cancelled': [], // Cancelled invoices cannot be changed
    'refunded': [], // Refunded invoices cannot be changed
  };

  if (currentStatus === newStatus) {
    return { allowed: true }; // Same status is always allowed
  }

  const allowed = allowedTransitions[currentStatus]?.includes(newStatus) || false;
  
  if (!allowed) {
    return {
      allowed: false,
      reason: `Cannot transition from ${currentStatus} to ${newStatus}`,
    };
  }

  return { allowed: true };
}

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
