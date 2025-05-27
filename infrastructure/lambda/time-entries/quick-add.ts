import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse } from '../shared/response-helper';
import { 
  QuickTimeEntryRequest,
  TimeEntry,
  TimeTrackingErrorCodes,
  SuccessResponse
} from '../shared/types';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TIME_ENTRIES_TABLE = process.env.TIME_ENTRIES_TABLE!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Quick time entry request:', JSON.stringify(event, null, 2));

    // Extract user information
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_TIME_ENTRY_DATA, 'Request body is required');
    }

    let request: QuickTimeEntryRequest;
    try {
      request = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_TIME_ENTRY_DATA, 'Invalid JSON in request body');
    }

    // Validate the request
    const validationError = await validateQuickTimeEntry(request, userId);
    if (validationError) {
      return createErrorResponse(400, TimeTrackingErrorCodes.INVALID_TIME_ENTRY_DATA, validationError);
    }

    // Calculate duration
    const startTime = new Date(`${request.date}T${request.startTime}:00`);
    const endTime = new Date(`${request.date}T${request.endTime}:00`);
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

    // Create time entry
    const timeEntry = await createQuickTimeEntry(request, userId, durationMinutes);

    const response: SuccessResponse<TimeEntry> = {
      success: true,
      data: timeEntry,
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
    console.error('Error creating quick time entry:', error);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
  }
};

async function validateQuickTimeEntry(request: QuickTimeEntryRequest, userId: string): Promise<string | null> {
  // Validate required fields
  if (!request.date || !request.startTime || !request.endTime || !request.projectId || !request.description) {
    return 'Missing required fields: date, startTime, endTime, projectId, description';
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(request.date)) {
    return 'Date must be in YYYY-MM-DD format';
  }

  // Validate time format
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(request.startTime) || !timeRegex.test(request.endTime)) {
    return 'Times must be in HH:MM format';
  }

  // Validate time range
  const startTime = new Date(`${request.date}T${request.startTime}:00`);
  const endTime = new Date(`${request.date}T${request.endTime}:00`);
  
  if (startTime >= endTime) {
    return 'Start time must be before end time';
  }

  const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  if (durationMinutes > 24 * 60) { // Max 24 hours
    return 'Duration cannot exceed 24 hours';
  }

  if (durationMinutes < 1) { // Min 1 minute
    return 'Duration must be at least 1 minute';
  }

  // Check for future dates
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (endTime > today) {
    return 'Cannot create time entries for future dates';
  }

  // Check for overlapping time entries
  const hasOverlap = await checkForTimeOverlap(userId, request.date, request.startTime, request.endTime);
  if (hasOverlap) {
    return 'Time entry overlaps with existing entry';
  }

  return null;
}

async function checkForTimeOverlap(
  userId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  try {
    // Get all time entries for the date
    const result = await docClient.send(new QueryCommand({
      TableName: TIME_ENTRIES_TABLE,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'GSI1PK = :userPK AND begins_with(GSI1SK, :datePrefix)',
      ExpressionAttributeValues: {
        ':userPK': `USER#${userId}`,
        ':datePrefix': `DATE#${date}`,
      },
    }));

    const existingEntries = result.Items || [];
    
    // Check for overlaps
    const newStart = new Date(`${date}T${startTime}:00`);
    const newEnd = new Date(`${date}T${endTime}:00`);

    for (const entry of existingEntries) {
      if (entry.startTime && entry.endTime) {
        const existingStart = new Date(entry.startTime);
        const existingEnd = new Date(entry.endTime);

        // Check if times overlap
        if (newStart < existingEnd && newEnd > existingStart) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking for time overlap:', error);
    return false; // Allow creation if we can't check
  }
}

async function createQuickTimeEntry(
  request: QuickTimeEntryRequest,
  userId: string,
  durationMinutes: number
): Promise<TimeEntry> {
  const now = new Date().toISOString();
  const timeEntryId = uuidv4();
  
  const startDateTime = `${request.date}T${request.startTime}:00.000Z`;
  const endDateTime = `${request.date}T${request.endTime}:00.000Z`;

  const timeEntry: TimeEntry = {
    id: timeEntryId,
    userId,
    projectId: request.projectId,
    taskId: undefined,
    description: request.description,
    date: request.date,
    startTime: startDateTime,
    endTime: endDateTime,
    duration: durationMinutes,
    isBillable: request.isBillable ?? true,
    hourlyRate: undefined,
    status: 'draft',
    tags: [],
    notes: request.fillGap ? 'Created via quick entry to fill time gap' : undefined,
    attachments: [],
    submittedAt: undefined,
    approvedAt: undefined,
    rejectedAt: undefined,
    approvedBy: undefined,
    rejectionReason: undefined,
    isTimerEntry: false,
    timerStartedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };

  // Save to DynamoDB
  const dynamoItem = {
    PK: `TIME_ENTRY#${timeEntryId}`,
    SK: `TIME_ENTRY#${timeEntryId}`,
    GSI1PK: `USER#${userId}`,
    GSI1SK: `DATE#${request.date}#TIME_ENTRY#${timeEntryId}`,
    GSI2PK: `PROJECT#${request.projectId}`,
    GSI2SK: `DATE#${request.date}#TIME_ENTRY#${timeEntryId}`,
    GSI3PK: `STATUS#draft`,
    GSI3SK: `DATE#${request.date}#TIME_ENTRY#${timeEntryId}`,
    id: timeEntryId,
    userId,
    projectId: request.projectId,
    taskId: undefined,
    description: request.description,
    date: request.date,
    startTime: startDateTime,
    endTime: endDateTime,
    duration: durationMinutes,
    isBillable: request.isBillable ?? true,
    hourlyRate: undefined,
    status: 'draft',
    tags: JSON.stringify([]),
    notes: timeEntry.notes,
    attachments: JSON.stringify([]),
    submittedAt: undefined,
    approvedAt: undefined,
    rejectedAt: undefined,
    approvedBy: undefined,
    rejectionReason: undefined,
    isTimerEntry: false,
    timerStartedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TIME_ENTRIES_TABLE,
    Item: dynamoItem,
  }));

  return timeEntry;
} 