import { APIGatewayProxyResult } from 'aws-lambda';
import { SuccessResponse, ErrorResponse } from './types';

/**
 * Creates standardized success response with wrapped data structure
 * Used for API Gateway responses that include success/data/message structure
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200,
  message?: string
): APIGatewayProxyResult {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message })
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(response),
  };
}

/**
 * Creates success response with unwrapped data (data object directly)
 * Use this when you want to return the data object directly without wrapping
 * Note: This breaks the standardized API response format, use carefully
 */
export function createUnwrappedSuccessResponse<T>(
  data: T,
  statusCode: number = 200
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(data),
  };
}

/**
 * Creates standardized error response
 */
export function createErrorResponse(
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

/**
 * Utility function to extract data from API response
 * This is the pattern that should be used in frontend API clients
 */
export function extractApiData<T>(response: Record<string, unknown>): T {
  // If response has success and data properties, extract data
  if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
    return response.data as T;
  }
  // Otherwise return the response as-is (for backward compatibility)
  return response as T;
}

export function createCorsHeaders(response: Record<string, unknown>): Record<string, unknown> {
  return {
    ...response,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...((response.headers as Record<string, unknown>) || {}),
    },
  };
} 