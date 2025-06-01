import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../../shared/response-helper';
import { UserRepository } from '../../shared/user-repository';
import { 
  UpdateUserProfileRequest, 
  UserProfile, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

// PowerTools v2.x imports
import { logger, businessLogger, addRequestContext } from '../../shared/powertools-logger';
import { tracer, businessTracer } from '../../shared/powertools-tracer';
import { metrics, businessMetrics } from '../../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools v2.x middleware
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const userRepo = new UserRepository();

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    // Add request context to logger and tracer
    const requestId = event.requestContext.requestId;
    addRequestContext(requestId);
    businessTracer.addRequestContext(requestId, event.httpMethod, event.resource);

    logger.info('Update user profile request started', {
      requestId,
      httpMethod: event.httpMethod,
      resource: event.resource,
    });

    // MANDATORY: Use standardized authentication helpers
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/profile', 'PUT', 401, responseTime);
      businessLogger.logAuth(currentUserId || 'unknown', 'update-user-profile', false, { reason: 'no_user_id' });
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = (user?.role as 'employee' | 'admin' | 'manager') || 'employee';

    // Add user context to tracer and logger
    businessTracer.addUserContext(currentUserId);
    addRequestContext(requestId, currentUserId);

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/profile', 'PUT', 400, responseTime);
      businessLogger.logError(new Error('User ID is required'), 'update-user-profile-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Authorization check: users can only update their own profile unless they're admin with tracing
    const accessControl = await businessTracer.traceBusinessOperation(
      'validate-profile-update-access',
      'user',
      async () => {
        if (userId !== currentUserId && userRole !== 'admin') {
          return { canUpdate: false, reason: 'not_own_profile_or_admin' };
        }
        return { canUpdate: true };
      }
    );

    if (!accessControl.canUpdate) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/profile', 'PUT', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'update-user-profile', false, { 
        requestedUserId: userId,
        reason: 'access_denied',
        userRole,
        accessReason: accessControl.reason
      });
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only update your own profile'
      );
    }

    // Parse and validate request body with tracing
    const updateData = await businessTracer.traceBusinessOperation(
      'parse-profile-update-request',
      'user',
      async () => {
        if (!event.body) {
          throw new Error('Request body is required');
        }
        return JSON.parse(event.body) as UpdateUserProfileRequest;
      }
    );

    const validationError = await businessTracer.traceBusinessOperation(
      'validate-profile-update-data',
      'user',
      async () => {
        return validateUpdateRequest(updateData);
      }
    );

    if (validationError) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/profile', 'PUT', 400, responseTime);
      businessLogger.logError(new Error(`Validation failed: ${validationError}`), 'update-user-profile-validation', currentUserId);
      return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, validationError);
    }

    // Check if hourly rate change requires admin approval with tracing
    const hourlyRateCheck = await businessTracer.traceBusinessOperation(
      'validate-hourly-rate-change',
      'user',
      async () => {
        if (updateData.hourlyRate !== undefined && userRole !== 'admin' && userId === currentUserId) {
          return { canUpdate: false, reason: 'hourly_rate_requires_admin' };
        }
        return { canUpdate: true };
      }
    );

    if (!hourlyRateCheck.canUpdate) {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/users/{id}/profile', 'PUT', 403, responseTime);
      businessLogger.logAuth(currentUserId, 'update-user-profile', false, { 
        requestedUserId: userId,
        reason: 'hourly_rate_change_denied',
        userRole,
        attemptedHourlyRate: updateData.hourlyRate
      });
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'Hourly rate changes require admin approval'
      );
    }

    logger.info('Profile update request parsed', { 
      currentUserId,
      requestedUserId: userId,
      userRole,
      isSelfUpdate: userId === currentUserId,
      hasHourlyRateUpdate: updateData.hourlyRate !== undefined,
      updateFields: Object.keys(updateData)
    });

    // Get current user data with tracing
    const currentUser = await businessTracer.traceDatabaseOperation(
      'get-current-user-profile',
      'users',
      async () => {
        return await userRepo.getUserById(userId);
      }
    );

    // Prepare profile data with tracing
    const profileData = await businessTracer.traceBusinessOperation(
      'prepare-profile-data',
      'user',
      async () => {
        const currentTimestamp = new Date().toISOString();
        const defaultProfile = {
          id: userId,
          email: user?.email || '',
          name: user?.email?.split('@')[0] || '',
          role: userRole,
          isActive: true,
          startDate: currentTimestamp.split('T')[0],
          createdAt: currentTimestamp,
          updatedAt: currentTimestamp,
          jobTitle: undefined,
          department: undefined,
          hourlyRate: undefined,
          contactInfo: undefined,
          profilePicture: undefined,
          lastLogin: undefined,
          teamId: undefined,
        };

        // Merge current profile (if exists) with default values and updates
        const mergedProfile = {
          ...defaultProfile,
          ...(currentUser || {}),
          ...updateData,
          updatedAt: currentTimestamp,
          createdAt: currentUser?.createdAt || currentTimestamp,
        };

        // Validate required fields
        if (!mergedProfile.email) {
          throw new Error('Email is required but not found in token');
        }
        if (!mergedProfile.name) {
          throw new Error('Name is required but not found in token or update data');
        }

        return mergedProfile;
      }
    );

    // Update user profile with tracing
    await businessTracer.traceDatabaseOperation(
      'update-user-profile',
      'users',
      async () => {
        return await userRepo.updateUser(userId, profileData);
      }
    );

    // Transform saved data to UserProfile response format with tracing
    const profile = await businessTracer.traceBusinessOperation(
      'transform-profile-response',
      'user',
      async () => {
        const transformedProfile: UserProfile = {
          id: profileData.id,
          email: profileData.email,
          name: profileData.name,
          jobTitle: profileData.jobTitle,
          department: profileData.department,
          hourlyRate: profileData.hourlyRate,
          role: profileData.role as 'employee' | 'admin' | 'manager',
          contactInfo: profileData.contactInfo ? {
            phone: profileData.contactInfo.phone,
            address: profileData.contactInfo.address,
            emergencyContact: profileData.contactInfo.emergencyContact,
          } : undefined,
          profilePicture: profileData.profilePicture,
          startDate: profileData.startDate || new Date().toISOString().split('T')[0]!,
          lastLogin: profileData.lastLogin,
          isActive: profileData.isActive,
          createdAt: profileData.createdAt,
          updatedAt: profileData.updatedAt,
        };

        return transformedProfile;
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/users/{id}/profile', 'PUT', 200, responseTime);
    businessLogger.logBusinessOperation('update', 'user-profile', currentUserId, true, { 
      requestedUserId: userId,
      userRole,
      isSelfUpdate: userId === currentUserId,
      updatedFields: Object.keys(updateData),
      hasHourlyRateUpdate: updateData.hourlyRate !== undefined,
      profileExists: !!currentUser
    });

    logger.info('User profile updated successfully', { 
      currentUserId,
      requestedUserId: userId,
      userRole,
      isSelfUpdate: userId === currentUserId,
      updatedFields: Object.keys(updateData),
      responseTime 
    });

    return createSuccessResponse(profile, 200, 'Profile updated successfully');

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    businessMetrics.trackApiPerformance('/users/{id}/profile', 'PUT', 500, responseTime);
    businessLogger.logError(error as Error, 'update-user-profile', getCurrentUserId(event) || 'unknown');

    logger.error('Error updating user profile', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestedUserId: event.pathParameters?.id,
      responseTime
    });

    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message.includes('Request body is required')) {
        return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Request body is required');
      }
      if (error.message.includes('Email is required')) {
        return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Email is required but not found in token');
      }
      if (error.message.includes('Name is required')) {
        return createErrorResponse(400, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Name is required but not found in token or update data');
      }
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
  }
};

function validateUpdateRequest(data: UpdateUserProfileRequest): string | null {
  // Validate name
  if (data.name !== undefined && (!data.name || data.name.trim().length < 2)) {
    return 'Name must be at least 2 characters long';
  }

  // Validate hourly rate
  if (data.hourlyRate !== undefined && (data.hourlyRate < 0 || data.hourlyRate > 1000)) {
    return 'Hourly rate must be between 0 and 1000';
  }

  // Validate contact info
  if (data.contactInfo) {
    if (data.contactInfo.phone && !/^\+?[\d\s\-\(\)]+$/.test(data.contactInfo.phone)) {
      return 'Invalid phone number format';
    }
  }

  return null;
}

// Export handler with PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics)); 