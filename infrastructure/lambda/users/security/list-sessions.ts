import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { 
  UserSession, 
  SuccessResponse, 
  ErrorResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('List user sessions request:', JSON.stringify(event, null, 2));

    // Extract user ID from path parameters
    const userId = event.pathParameters?.id;
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }

    // Get authenticated user from context
    const cognitoUser = event.requestContext.authorizer?.claims;
    const authenticatedUserId = cognitoUser?.sub;

    // Authorization check: users can only view their own sessions
    if (userId !== authenticatedUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only view your own sessions'
      );
    }

    // Get current session token from Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const currentToken = authHeader?.replace('Bearer ', '');

    // Query active sessions for the user using GSI
    const command = new QueryCommand({
      TableName: process.env.USER_SESSIONS_TABLE!,
      IndexName: 'UserIndex', // GSI for userId lookup
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: 'isActive = :isActive AND expiresAt > :now',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':isActive': true,
        ':now': new Date().toISOString(),
      },
      ScanIndexForward: false, // Get most recent first
    });

    const result = await docClient.send(command);

    // Transform DynamoDB items to UserSession format
    const sessions: UserSession[] = (result.Items || []).map(item => {
      // Parse location data if it exists
      let location: { city: string; country: string } | undefined;
      if (item.locationData) {
        try {
          location = typeof item.locationData === 'string' 
            ? JSON.parse(item.locationData) 
            : item.locationData;
        } catch (error) {
          console.error('Error parsing location data:', error);
        }
      }

      return {
        id: item.sessionId,
        ipAddress: item.ipAddress || 'Unknown',
        userAgent: item.userAgent || 'Unknown',
        loginTime: item.loginTime,
        lastActivity: item.lastActivity,
        isCurrent: item.sessionToken === currentToken,
        location,
      };
    });

    // Sort sessions with current session first
    sessions.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });

    const response: SuccessResponse<UserSession[]> = {
      success: true,
      data: sessions,
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
    console.error('List sessions error:', error);
    return createErrorResponse(500, ProfileSettingsErrorCodes.INVALID_PROFILE_DATA, 'Internal server error');
  }
};

function createErrorResponse(
  statusCode: number,
  errorCode: ProfileSettingsErrorCodes,
  message: string
): APIGatewayProxyResult {
  const response: ErrorResponse = {
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
    body: JSON.stringify(response),
  };
} 