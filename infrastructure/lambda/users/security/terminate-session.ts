import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { 
  SuccessResponse, 
  ErrorResponse, 
  ProfileSettingsErrorCodes 
} from '../../shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Terminate session request:', JSON.stringify(event, null, 2));

    // Extract user ID and session ID from path parameters
    const userId = event.pathParameters?.id;
    const sessionId = event.pathParameters?.sessionId;
    
    if (!userId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.PROFILE_NOT_FOUND, 'User ID is required');
    }
    
    if (!sessionId) {
      return createErrorResponse(400, ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 'Session ID is required');
    }

    // Get authenticated user from context
    const cognitoUser = event.requestContext.authorizer?.claims;
    const authenticatedUserId = cognitoUser?.sub;

    // Authorization check: users can only terminate their own sessions
    if (userId !== authenticatedUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only terminate your own sessions'
      );
    }

    // Get current session token from Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const currentToken = authHeader?.replace('Bearer ', '');

    // Get the session to verify it exists and belongs to the user
    const getCommand = new GetCommand({
      TableName: process.env.USER_SESSIONS_TABLE!,
      Key: { sessionId },
    });

    const getResult = await docClient.send(getCommand);

    if (!getResult.Item) {
      return createErrorResponse(404, ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 'Session not found');
    }

    const session = getResult.Item;

    // Verify the session belongs to the authenticated user
    if (session.userId !== authenticatedUserId) {
      return createErrorResponse(
        403, 
        ProfileSettingsErrorCodes.UNAUTHORIZED_PROFILE_ACCESS, 
        'You can only terminate your own sessions'
      );
    }

    // Prevent users from terminating their current session
    if (session.sessionToken === currentToken) {
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.CANNOT_TERMINATE_CURRENT_SESSION, 
        'You cannot terminate your current session'
      );
    }

    // Check if session is already inactive
    if (!session.isActive) {
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 
        'Session is already inactive'
      );
    }

    // Check if session has expired
    if (new Date(session.expiresAt) <= new Date()) {
      return createErrorResponse(
        400, 
        ProfileSettingsErrorCodes.SESSION_NOT_FOUND, 
        'Session has already expired'
      );
    }

    // Mark the session as inactive
    const updateCommand = new UpdateCommand({
      TableName: process.env.USER_SESSIONS_TABLE!,
      Key: { sessionId },
      UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isActive': false,
        ':updatedAt': new Date().toISOString(),
      },
    });

    await docClient.send(updateCommand);

    const response: SuccessResponse<{ message: string }> = {
      success: true,
      data: {
        message: 'Session terminated successfully'
      },
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
    console.error('Terminate session error:', error);
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