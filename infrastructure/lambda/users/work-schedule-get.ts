import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { 
  UserWorkSchedule,
  WorkDaySchedule,
  TimeTrackingErrorCodes,
  SuccessResponse
} from '../shared/types';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const USER_WORK_SCHEDULES_TABLE = process.env.USER_WORK_SCHEDULES_TABLE!;

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

    // Get work schedule from DynamoDB
    const workSchedule = await getUserWorkSchedule(targetUserId);

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

async function getUserWorkSchedule(userId: string): Promise<UserWorkSchedule | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: USER_WORK_SCHEDULES_TABLE,
      Key: {
        PK: `USER#${userId}`,
        SK: 'WORK_SCHEDULE',
      },
    }));

    if (!result.Item) {
      return null;
    }

    return {
      userId: result.Item.userId,
      schedule: JSON.parse(result.Item.schedule),
      timezone: result.Item.timezone,
      weeklyTargetHours: result.Item.weeklyTargetHours,
      createdAt: result.Item.createdAt,
      updatedAt: result.Item.updatedAt,
    };
  } catch (error) {
    console.error('Error fetching work schedule:', error);
    return null;
  }
}

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