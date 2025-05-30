import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { UserRepository } from '../shared/user-repository';
import { 
  UserWorkSchedule,
  WorkDaySchedule,
  SuccessResponse
} from '../shared/types';

const userRepo = new UserRepository();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Get work schedule request:', JSON.stringify(event, null, 2));

    // Extract user information
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // Get target user ID from path parameters or use current user
    const targetUserId = event.pathParameters?.userId || userId;

    // Check permissions - employees can only view their own schedule
    if (user?.role === 'employee' && targetUserId !== userId) {
      return createErrorResponse(403, 'FORBIDDEN', 'Employees can only view their own work schedule');
    }

    // Get work schedule using repository
    const workSchedule = await userRepo.getUserWorkSchedule(targetUserId);

    if (!workSchedule) {
      // Return default work schedule if none exists
      const defaultSchedule = createDefaultWorkSchedule(targetUserId);
      
      const response: SuccessResponse<UserWorkSchedule> = {
        success: true,
        data: defaultSchedule,
      };

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(response),
      };
    }

    const response: SuccessResponse<UserWorkSchedule> = {
      success: true,
      data: workSchedule,
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
    console.error('Error getting work schedule:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
  }
};

function createDefaultWorkSchedule(userId: string): UserWorkSchedule {
  const defaultWorkDay: WorkDaySchedule = {
    start: '09:00',
    end: '17:00',
    targetHours: 8,
  };

  const defaultWeekend: WorkDaySchedule = {
    start: null,
    end: null,
    targetHours: 0,
  };

  const now = new Date().toISOString();

  return {
    userId,
    schedule: {
      monday: defaultWorkDay,
      tuesday: defaultWorkDay,
      wednesday: defaultWorkDay,
      thursday: defaultWorkDay,
      friday: defaultWorkDay,
      saturday: defaultWeekend,
      sunday: defaultWeekend,
    },
    timezone: 'America/New_York',
    weeklyTargetHours: 40,
    createdAt: now,
    updatedAt: now,
  };
} 