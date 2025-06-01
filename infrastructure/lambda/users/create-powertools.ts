import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { UserRepository } from '../shared/user-repository';
import { 
  CreateUserRequest, 
  UserErrorCodes
} from '../shared/types';
import { ValidationService } from '../shared/validation';
import { InvitationRepository } from '../shared/invitation-repository';

// ✅ NEW: Import PowerTools utilities
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';

// ✅ NEW: Import Middy and PowerTools v2.x middleware
import middy from '@middy/core';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';

const userRepo = new UserRepository();

/**
 * Create User Lambda Handler with PowerTools Integration
 * Demonstrates enhanced observability with structured logging, tracing, and metrics
 */
const createUserHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // ✅ NEW: Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.path);

    // ✅ NEW: Log structured request information
    logger.info('Processing create user request', {
      httpMethod: event.httpMethod,
      path: event.path,
      userAgent: event.headers['User-Agent'],
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      // ✅ NEW: Track authentication failure
      businessMetrics.trackAuthEvent(false, 'token');
      businessLogger.logAuth('unknown', 'create_user_attempt', false, { reason: 'no_token' });
      
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // ✅ NEW: Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId, userRole, user?.department);
    logger.appendKeys({ userId: currentUserId, userRole });

    // ✅ NEW: Track successful authentication
    businessMetrics.trackAuthEvent(true, 'token');
    businessLogger.logAuth(currentUserId, 'create_user_attempt', true, { userRole });

    // Check if user has permission to create users (admin only)
    if (userRole !== 'admin') {
      // ✅ NEW: Track authorization failure
      businessMetrics.trackSecurityEvent('unauthorized_user_creation', 'medium', currentUserId);
      businessLogger.logSecurity('Unauthorized user creation attempt', currentUserId, 'medium', { userRole });
      
      return createErrorResponse(403, UserErrorCodes.INSUFFICIENT_PERMISSIONS, 'Only admins can create users');
    }

    // Parse and validate request body
    if (!event.body) {
      logger.warn('Missing request body');
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    let createUserRequest: CreateUserRequest;
    try {
      createUserRequest = JSON.parse(event.body);
      logger.debug('Parsed request body', { email: createUserRequest.email, role: createUserRequest.role });
    } catch (error) {
      logger.error('Failed to parse request body', { error: error instanceof Error ? error.message : 'Unknown error' });
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }
    
    // ✅ NEW: Trace validation operation
    const validationResult = await businessTracer.traceBusinessOperation(
      'validate_user_request',
      'user',
      async () => {
        return ValidationService.validateCreateUserRequest(createUserRequest as unknown as Record<string, unknown>);
      }
    );

    if (!validationResult.isValid) {
      logger.warn('User validation failed', { errors: validationResult.errors });
      return createErrorResponse(400, UserErrorCodes.INVALID_USER_DATA, 'Validation failed');
    }

    // ✅ NEW: Trace database operations
    const existingUser = await businessTracer.traceDatabaseOperation(
      'getUserByEmail',
      'users',
      async () => {
        return userRepo.getUserByEmail(createUserRequest.email);
      }
    );

    if (existingUser) {
      logger.warn('User already exists', { email: createUserRequest.email });
      businessMetrics.trackUserOperation('create', false);
      return createErrorResponse(409, UserErrorCodes.USER_ALREADY_EXISTS, 'User with this email already exists');
    }

    // Check if there's a pending invitation for this email
    const invitationRepo = new InvitationRepository();
    const hasPendingInvitation = await businessTracer.traceDatabaseOperation(
      'checkEmailExists',
      'invitations',
      async () => {
        return invitationRepo.checkEmailExists(createUserRequest.email);
      }
    );

    if (hasPendingInvitation) {
      logger.warn('Email has pending invitation', { email: createUserRequest.email });
      businessMetrics.trackUserOperation('create', false);
      return createErrorResponse(409, UserErrorCodes.USER_ALREADY_EXISTS, 'Email address has a pending invitation. Please accept the invitation or cancel it before creating a user directly.');
    }

    // ✅ NEW: Trace user creation operation
    const newUser = await businessTracer.traceBusinessOperation(
      'create_user',
      'user',
      async () => {
        return userRepo.createUser({
          email: createUserRequest.email,
          name: createUserRequest.name,
          role: createUserRequest.role || 'employee',
          department: createUserRequest.department,
          jobTitle: createUserRequest.jobTitle,
          hourlyRate: createUserRequest.hourlyRate,
          permissions: createUserRequest.permissions || { features: [], projects: [] },
          preferences: {
            theme: 'light',
            notifications: true,
            timezone: 'UTC'
          },
          contactInfo: createUserRequest.contactInfo,
          invitedBy: currentUserId
        });
      }
    );

    // ✅ NEW: Track successful user creation
    const responseTime = Date.now() - startTime;
    businessMetrics.trackUserOperation('create', true);
    businessMetrics.trackApiPerformance('/users', 'POST', 201, responseTime);
    businessLogger.logBusinessOperation('create', 'user', currentUserId, true, {
      newUserId: newUser.id,
      newUserEmail: newUser.email,
      newUserRole: newUser.role,
    });

    logger.info('User created successfully', {
      newUserId: newUser.id,
      newUserEmail: newUser.email,
      responseTime,
    });

    // ✅ FIXED: Use standardized response helper
    return createSuccessResponse(newUser, 201, 'User created successfully');

  } catch (error) {
    // ✅ NEW: Enhanced error logging and metrics
    const responseTime = Date.now() - startTime;
    businessMetrics.trackUserOperation('create', false);
    businessMetrics.trackApiPerformance('/users', 'POST', 500, responseTime);
    
    businessLogger.logError(
      error instanceof Error ? error : new Error('Unknown error'),
      'create_user_handler',
      getCurrentUserId(event),
      { responseTime }
    );
    
    logger.error('Create user error', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : { message: 'Unknown error' },
      responseTime,
    });
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

// ✅ NEW: Export handler with PowerTools v2.x middleware pattern
export const handler = middy(createUserHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { clearState: true }))
  .use(logMetrics(metrics)); 