import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { 
  Invoice,
  Payment,
  RecordPaymentRequest
} from '../shared/types';
import { InvoiceRepository } from '../shared/invoice-repository';

const invoiceRepository = new InvoiceRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Extract invoice ID from path parameters
    const invoiceId = event.pathParameters?.id;
    if (!invoiceId) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Invoice ID is required');
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    const requestBody = JSON.parse(event.body);
    const operation = requestBody.operation as 'updateStatus' | 'recordPayment';

    // Get existing invoice
    const existingInvoice = await invoiceRepository.getInvoiceById(invoiceId);
    if (!existingInvoice) {
      return createErrorResponse(404, 'INVOICE_NOT_FOUND', 'Invoice not found');
    }

    // Apply access control
    const accessControl = applyAccessControl(existingInvoice, currentUserId, userRole, operation, requestBody.status);
    if (!accessControl.canAccess) {
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', accessControl.reason || 'You do not have permission to update this invoice');
    }

    let updatedInvoice: Invoice;
    let payment: Payment | null = null;

    if (operation === 'updateStatus') {
      updatedInvoice = await invoiceRepository.updateInvoice(invoiceId, { status: requestBody.status });
    } else {
      // Record payment
      const paymentRequest: RecordPaymentRequest = {
        amount: requestBody.amount,
        paymentDate: requestBody.paymentDate,
        paymentMethod: requestBody.paymentMethod,
        reference: requestBody.reference,
        notes: requestBody.notes,
        externalPaymentId: requestBody.externalPaymentId,
        processorFee: requestBody.processorFee
      };
      payment = await invoiceRepository.recordPayment(invoiceId, paymentRequest, currentUserId);
      updatedInvoice = await invoiceRepository.getInvoiceById(invoiceId) as Invoice;
    }

    const response = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          invoice: updatedInvoice,
          payment,
        },
      }),
    };

    return response;

  } catch (error) {
    console.error('Error updating invoice status:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to update invoice status');
  }
};

function applyAccessControl(
  invoice: Invoice,
  currentUserId: string,
  userRole: string,
  operation: 'updateStatus' | 'recordPayment',
  newStatus?: string
): { canAccess: boolean; reason?: string } {
  // Check basic access permissions
  if (userRole === 'employee') {
    // Employees have limited status update permissions - only for invoices they created
    if (invoice.createdBy !== currentUserId) {
      return {
        canAccess: false,
        reason: 'You can only update status for invoices you created',
      };
    }

    // Employees cannot record payments
    if (operation === 'recordPayment') {
      return {
        canAccess: false,
        reason: 'You do not have permission to record payments',
      };
    }

    // Employees can only update to specific statuses
    const allowedEmployeeStatuses = ['draft', 'sent'];
    if (newStatus && !allowedEmployeeStatuses.includes(newStatus)) {
      return {
        canAccess: false,
        reason: `You can only set status to: ${allowedEmployeeStatuses.join(', ')}`,
      };
    }
  } else if (userRole === 'manager') {
    // TODO: Implement team/project association check when user teams are implemented
    // For now, allow managers to update any invoice status and record payments
  }
  // Admins can update any invoice status and record payments (no additional restrictions)

  // Validate status transition if this is a status update
  if (operation === 'updateStatus' && newStatus) {
    const validation = validateStatusTransition(invoice.status, newStatus);
    if (!validation.allowed) {
      return {
        canAccess: false,
        reason: validation.reason,
      };
    }
  }

  return { canAccess: true };
}

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
