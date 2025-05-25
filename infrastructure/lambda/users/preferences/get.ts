import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { 
  UserPreferences, 
  SuccessResponse, 
  ErrorResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Default preferences for new users
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  notifications: true,
  timezone: 'America/New_York',
  timeTracking: {
    defaultTimeEntryDuration: 60, // 1 hour
    autoStartTimer: false,
    showTimerInMenuBar: true,
    defaultBillableStatus: true,
    reminderInterval: 0, // disabled
    workingHours: {
      start: '09:00',
      end: '17:00',
    },
    timeGoals: {
      daily: 8.0,
      weekly: 40.0,
      notifications: true,
    },
  },
  formatting: {
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
  },
  updatedAt: new Date().toISOString(),
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Get user preferences request:', JSON.stringify(event, null, 2));

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Get authenticated user from context
    const cognitoUser = event.requestContext.authorizer?.claims;
    const authenticatedUserId = cognitoUser?.sub;
    const userRole = cognitoUser?.['custom:role'] || 'employee';

    // Authorization check: users can only access their own preferences unless they're admin
    if (userId !== authenticatedUserId && userRole !== 'admin') {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only access your own preferences'
      );
    }

    // Get user preferences from DynamoDB
    const command = new GetCommand({
      TableName: process.env.USER_PREFERENCES_TABLE!,
      Key: { userId },
    });

    const result = await docClient.send(command);

    let preferences: UserPreferences;

    if (!result.Item) {
      // Return default preferences if none exist
      preferences = DEFAULT_PREFERENCES;
    } else {
      // Transform DynamoDB item to UserPreferences
      const item = result.Item;
      preferences = {
        theme: item.theme,
        notifications: item.notifications,
        timezone: item.timezone,
        timeTracking: typeof item.timeTracking === 'string' 
          ? JSON.parse(item.timeTracking) 
          : item.timeTracking,
        formatting: typeof item.formatting === 'string' 
          ? JSON.parse(item.formatting) 
          : item.formatting,
        updatedAt: item.updatedAt,
      };
    }

    const response: SuccessResponse<UserPreferences> = {
      success: true,
      data: preferences,
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
    console.error('Error getting user preferences:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
};

function createErrorResponse(
  statusCode: number, 
  errorCode: ProfileSettingsErrorCodes | string, 
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