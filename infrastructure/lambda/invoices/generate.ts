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

    const response: SuccessResponse<Invoice> = {
      success: true,
      data: invoice,
      message: 'Invoice generated successfully',
    };

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

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
