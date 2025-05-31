import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { 
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

    const userRole = getAuthenticatedUser(event)?.role || 'employee';

    // Get invoice ID from path parameters
    const invoiceId = event.pathParameters?.id;
    if (!invoiceId) {
      return createErrorResponse(400, 'MISSING_PARAMETER', 'Invoice ID is required');
    }

    // Parse request body
    
    // Validation will be handled by the repository method
    
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

    // Role-based access control
    if (userRole === 'employee') {
      // Employees can only send invoices they created
      if (existingInvoice.createdBy !== currentUserId) {
        return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'You can only send invoices you created');
      }
    } else if (userRole === 'manager') {
      // Managers can send invoices for their managed projects/clients
      // TODO: Implement team/project association check when user teams are implemented
      // For now, allow managers to send any invoice
    }
    // Admins can send any invoice (no additional restrictions)

    // TODO: Implement actual email sending logic
    // This would involve:
    // 1. Generate PDF if not already generated
    // 2. Get client email address
    // 3. Send email via SES with invoice attached
    // 4. Update invoice status and sent timestamp

    // For now, just update the invoice status to 'sent'
    const updatedInvoice = await invoiceRepository.updateInvoice(invoiceId, {
      status: 'sent',
    });

    // TODO: Record the actual sending in a separate operation
    // This would update sentAt, sentBy, and increment remindersSent if this is a reminder

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(updatedInvoice, 200, 'Invoice sent successfully');

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
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};
