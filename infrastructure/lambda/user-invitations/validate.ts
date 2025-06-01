import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  InvitationErrorCodes
} from '../shared/types';
import { InvitationRepository } from '../shared/invitation-repository';
import { TokenService } from '../shared/token-service';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';

// PowerTools v2.x imports
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools v2.x middleware
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Validate invitation token request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // Get token from path parameters
    const token = event.pathParameters?.token;
    if (!token) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/validate', 'GET', 400, responseTime);
      businessLogger.logError(new Error('Token is required'), 'invitation-validate', 'unknown');
      return createErrorResponse(400, InvitationErrorCodes.INVALID_TOKEN, 'Token is required');
    }

    logger.info('Validating invitation token', { tokenLength: token.length });

    // Validate token format
    const isValidFormat = await businessTracer.traceBusinessOperation(
      'validate-token-format',
      'invitation',
      async () => {
        return TokenService.validateTokenFormat(token);
      }
    );

    if (!isValidFormat) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/validate', 'GET', 400, responseTime);
      businessLogger.logError(new Error('Invalid token format'), 'invitation-validate', 'unknown', { tokenLength: token.length });
      return createErrorResponse(400, InvitationErrorCodes.INVALID_TOKEN, 'Invalid token format');
    }

    const repository = new InvitationRepository();

    // Get invitation by token hash
    const invitation = await businessTracer.traceDatabaseOperation(
      'get',
      'invitations',
      async () => {
        const tokenHash = TokenService.hashToken(token);
        return await repository.getInvitationByTokenHash(tokenHash);
      }
    );

    if (!invitation) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/validate', 'GET', 404, responseTime);
      businessLogger.logBusinessOperation('validate', 'invitation', 'unknown', false, { reason: 'invitation_not_found' });
      return createErrorResponse(404, InvitationErrorCodes.INVALID_TOKEN, 'Invalid token');
    }

    logger.info('Invitation found', { 
      invitationId: invitation.id,
      status: invitation.status,
      email: invitation.email 
    });

    // Check if invitation has already been accepted
    if (invitation.status === 'accepted') {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/validate', 'GET', 409, responseTime);
      businessLogger.logBusinessOperation('validate', 'invitation', invitation.email, false, { 
        reason: 'already_accepted',
        invitationId: invitation.id 
      });
      return createErrorResponse(409, InvitationErrorCodes.INVITATION_ALREADY_ACCEPTED, 'Invitation has already been accepted');
    }

    // Check if invitation has been cancelled
    if (invitation.status === 'cancelled') {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/validate', 'GET', 410, responseTime);
      businessLogger.logBusinessOperation('validate', 'invitation', invitation.email, false, { 
        reason: 'cancelled',
        invitationId: invitation.id 
      });
      return createErrorResponse(410, InvitationErrorCodes.INVITATION_NOT_FOUND, 'Invitation has been cancelled');
    }

    // Check if invitation is expired
    const isExpired = await businessTracer.traceBusinessOperation(
      'check-expiration',
      'invitation',
      async () => {
        return TokenService.isExpired(invitation.expiresAt);
      }
    );

    if (isExpired) {
      // Update invitation status to expired
      await businessTracer.traceDatabaseOperation(
        'update',
        'invitations',
        async () => {
          return await repository.updateInvitation(invitation.id, {
            status: 'expired',
          });
        }
      );

      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/user-invitations/validate', 'GET', 410, responseTime);
      businessLogger.logBusinessOperation('validate', 'invitation', invitation.email, false, { 
        reason: 'expired',
        invitationId: invitation.id 
      });
      return createErrorResponse(410, InvitationErrorCodes.INVITATION_EXPIRED, 'Invitation has expired');
    }

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/user-invitations/validate', 'GET', 200, responseTime);
    businessLogger.logBusinessOperation('validate', 'invitation', invitation.email, true, { 
      invitationId: invitation.id,
      expiresAt: invitation.expiresAt
    });

    logger.info('Invitation validation successful', { 
      invitationId: invitation.id,
      email: invitation.email,
      responseTime 
    });

    // Prepare validation response
    return createSuccessResponse({
      valid: true,
      invitation,
      expiresAt: invitation.expiresAt
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/user-invitations/validate', 'GET', 500, responseTime);
    businessLogger.logError(error as Error, 'invitation-validate', 'unknown');

    logger.error('Error validating invitation token', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics));