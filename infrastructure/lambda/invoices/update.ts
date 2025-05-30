import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { 
  Invoice,
  UpdateInvoiceRequest,
  SuccessResponse,
  InvoiceErrorCodes
} from '../shared/types';
import { InvoiceRepository } from '../shared/invoice-repository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Get invoice ID from path parameters
    const invoiceId = event.pathParameters?.id;
    if (!invoiceId) {
      return createErrorResponse(400, 'MISSING_PARAMETER', 'Invoice ID is required');
    }

    // Parse request body
    const requestBody = JSON.parse(event.body || '{}');
    
    // Validation will be handled by the repository method
    
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

    // Role-based access control
    if (userRole === 'employee') {
      // Employees can only update invoices they created and only if in draft status
      if (existingInvoice.createdBy !== currentUserId) {
        return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You can only update invoices you created');
      }
      if (existingInvoice.status !== 'draft') {
        return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You can only update draft invoices');
      }
    } else if (userRole === 'manager') {
      // Managers can update invoices for their managed projects/clients
      // TODO: Implement team/project association check when user teams are implemented
      // For now, allow managers to update any invoice
    }
    // Admins can update any invoice (no additional restrictions)

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
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
