import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  UpdateCommand, 
  DeleteCommand, 
  QueryCommand, 
  ScanCommand,
  BatchWriteCommand,
  BatchGetCommand,
  QueryCommandInput,
  ScanCommandInput
} from '@aws-sdk/lib-dynamodb';
import { 
  TimeEntry, 
  TimeEntryDynamoItem, 
  TimeEntryFilters, 
  TimerSession,
  TimerSessionDynamoItem,
  CreateTimeEntryRequest,
  UpdateTimeEntryRequest,
  TimeEntryErrorCodes,
  BulkTimeEntryResponse
} from './types';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export class TimeEntryRepository {
  private timeEntriesTable: string;

  constructor() {
    this.timeEntriesTable = process.env.TIME_ENTRIES_TABLE || '';
    if (!this.timeEntriesTable) {
      throw new Error('TIME_ENTRIES_TABLE environment variable is required');
    }
  }

  // ==========================================
  // Time Entry CRUD Operations
  // ==========================================

  async createTimeEntry(userId: string, request: CreateTimeEntryRequest): Promise<TimeEntry> {
    const now = new Date().toISOString();
    const timeEntryId = `te_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate duration if not provided
    let duration = request.duration || 0;
    if (!duration && request.startTime && request.endTime) {
      const start = new Date(request.startTime);
      const end = new Date(request.endTime);
      duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // minutes
    }

    const timeEntry: TimeEntry = {
      id: timeEntryId,
      userId,
      projectId: request.projectId,
      taskId: request.taskId,
      description: request.description,
      date: request.date,
      startTime: request.startTime,
      endTime: request.endTime,
      duration,
      isBillable: request.isBillable ?? true,
      hourlyRate: request.hourlyRate,
      status: 'draft',
      tags: request.tags || [],
      notes: request.notes,
      attachments: request.attachments || [],
      isTimerEntry: false,
      createdAt: now,
      updatedAt: now,
    };

    const dynamoItem: TimeEntryDynamoItem = {
      PK: `TIME_ENTRY#${timeEntryId}`,
      SK: `TIME_ENTRY#${timeEntryId}`,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `DATE#${request.date}#TIME_ENTRY#${timeEntryId}`,
      GSI2PK: `PROJECT#${request.projectId}`,
      GSI2SK: `DATE#${request.date}#TIME_ENTRY#${timeEntryId}`,
      GSI3PK: `STATUS#draft`,
      GSI3SK: `DATE#${request.date}#TIME_ENTRY#${timeEntryId}`,
      ...timeEntry,
      tags: JSON.stringify(timeEntry.tags),
      attachments: JSON.stringify(timeEntry.attachments),
    };

    await docClient.send(new PutCommand({
      TableName: this.timeEntriesTable,
      Item: dynamoItem,
      ConditionExpression: 'attribute_not_exists(PK)',
    }));

    return timeEntry;
  }

  async getTimeEntry(timeEntryId: string): Promise<TimeEntry | null> {
    const result = await docClient.send(new GetCommand({
      TableName: this.timeEntriesTable,
      Key: {
        PK: `TIME_ENTRY#${timeEntryId}`,
        SK: `TIME_ENTRY#${timeEntryId}`,
      },
    }));

    if (!result.Item) {
      return null;
    }

    return this.mapDynamoItemToTimeEntry(result.Item as TimeEntryDynamoItem);
  }

  async updateTimeEntry(timeEntryId: string, updates: UpdateTimeEntryRequest): Promise<TimeEntry> {
    const existing = await this.getTimeEntry(timeEntryId);
    if (!existing) {
      throw new Error(TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND);
    }

    // Prevent updates to submitted/approved entries
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      throw new Error(TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED);
    }

    const now = new Date().toISOString();
    
    // Calculate duration if time fields are updated
    let duration = updates.duration || existing.duration;
    const startTime = updates.startTime || existing.startTime;
    const endTime = updates.endTime || existing.endTime;
    
    if (startTime && endTime && !updates.duration) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    }

    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};

    // Build update expression dynamically
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'duration') { // Skip duration as we handle it separately
        const attrName = `#${key}`;
        const attrValue = `:${key}`;
        
        updateExpression.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        
        if (key === 'tags' || key === 'attachments') {
          expressionAttributeValues[attrValue] = JSON.stringify(value || []);
        } else {
          expressionAttributeValues[attrValue] = value;
        }
      }
    });

    // Always update duration and updatedAt
    updateExpression.push('#duration = :duration', '#updatedAt = :updatedAt');
    expressionAttributeNames['#duration'] = 'duration';
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':duration'] = duration;
    expressionAttributeValues[':updatedAt'] = now;

    // Update GSI keys if necessary
    if (updates.date || updates.projectId) {
      const newDate = updates.date || existing.date;
      const newProjectId = updates.projectId || existing.projectId;
      
      updateExpression.push(
        '#GSI1SK = :gsi1sk',
        '#GSI2PK = :gsi2pk',
        '#GSI2SK = :gsi2sk',
        '#GSI3SK = :gsi3sk'
      );
      
      expressionAttributeNames['#GSI1SK'] = 'GSI1SK';
      expressionAttributeNames['#GSI2PK'] = 'GSI2PK';
      expressionAttributeNames['#GSI2SK'] = 'GSI2SK';
      expressionAttributeNames['#GSI3SK'] = 'GSI3SK';
      
      expressionAttributeValues[':gsi1sk'] = `DATE#${newDate}#TIME_ENTRY#${timeEntryId}`;
      expressionAttributeValues[':gsi2pk'] = `PROJECT#${newProjectId}`;
      expressionAttributeValues[':gsi2sk'] = `DATE#${newDate}#TIME_ENTRY#${timeEntryId}`;
      expressionAttributeValues[':gsi3sk'] = `DATE#${newDate}#TIME_ENTRY#${timeEntryId}`;
    }

    await docClient.send(new UpdateCommand({
      TableName: this.timeEntriesTable,
      Key: {
        PK: `TIME_ENTRY#${timeEntryId}`,
        SK: `TIME_ENTRY#${timeEntryId}`,
      },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(PK)',
    }));

    return await this.getTimeEntry(timeEntryId) as TimeEntry;
  }

  async deleteTimeEntry(timeEntryId: string): Promise<void> {
    const existing = await this.getTimeEntry(timeEntryId);
    if (!existing) {
      throw new Error(TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND);
    }

    // Prevent deletion of submitted/approved entries
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      throw new Error(TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED);
    }

    await docClient.send(new DeleteCommand({
      TableName: this.timeEntriesTable,
      Key: {
        PK: `TIME_ENTRY#${timeEntryId}`,
        SK: `TIME_ENTRY#${timeEntryId}`,
      },
    }));
  }

  // ==========================================
  // Time Entry Queries
  // ==========================================

  async listTimeEntries(filters: TimeEntryFilters = {}): Promise<{
    items: TimeEntry[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    let queryParams: Record<string, unknown> = {
      TableName: this.timeEntriesTable,
      Limit: limit + 1, // Get one extra to check if there are more
    };

    // Choose the most efficient query based on filters
    if (filters.userId) {
      // Query by user
      queryParams.IndexName = 'UserIndex';
      queryParams.KeyConditionExpression = 'GSI1PK = :userId';
      queryParams.ExpressionAttributeValues = { ':userId': `USER#${filters.userId}` };
      
      if (filters.dateFrom || filters.dateTo) {
        queryParams.KeyConditionExpression += ' AND begins_with(GSI1SK, :datePrefix)';
        (queryParams.ExpressionAttributeValues as Record<string, unknown>)[':datePrefix'] = 'DATE#';
      }
    } else if (filters.projectId) {
      // Query by project
      queryParams.IndexName = 'ProjectIndex';
      queryParams.KeyConditionExpression = 'GSI2PK = :projectId';
      queryParams.ExpressionAttributeValues = { ':projectId': `PROJECT#${filters.projectId}` };
    } else if (filters.status) {
      // Query by status
      queryParams.IndexName = 'StatusIndex';
      queryParams.KeyConditionExpression = 'GSI3PK = :status';
      queryParams.ExpressionAttributeValues = { ':status': `STATUS#${filters.status}` };
    } else {
      // Full table scan (least efficient)
      delete queryParams.KeyConditionExpression;
    }

    // Add filter expressions
    const filterExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    
    if (filters.isBillable !== undefined) {
      filterExpressions.push('#isBillable = :isBillable');
      expressionAttributeNames['#isBillable'] = 'isBillable';
      queryParams.ExpressionAttributeValues = {
        ...(queryParams.ExpressionAttributeValues as Record<string, unknown>),
        ':isBillable': filters.isBillable,
      };
    }

    if (filters.dateFrom) {
      filterExpressions.push('#date >= :dateFrom');
      expressionAttributeNames['#date'] = 'date';
      queryParams.ExpressionAttributeValues = {
        ...(queryParams.ExpressionAttributeValues as Record<string, unknown>),
        ':dateFrom': filters.dateFrom,
      };
    }

    if (filters.dateTo) {
      filterExpressions.push('#date <= :dateTo');
      expressionAttributeNames['#date'] = 'date';
      queryParams.ExpressionAttributeValues = {
        ...(queryParams.ExpressionAttributeValues as Record<string, unknown>),
        ':dateTo': filters.dateTo,
      };
    }

    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ');
      queryParams.ExpressionAttributeNames = expressionAttributeNames;
    }

    // Handle pagination
    if (offset > 0) {
      // For simplicity, we'll use scan with offset for now
      // In production, you'd want to implement proper cursor-based pagination
      queryParams.ExclusiveStartKey = undefined; // Implement proper pagination logic
    }

    const result = queryParams.KeyConditionExpression 
      ? await docClient.send(new QueryCommand(queryParams as QueryCommandInput))
      : await docClient.send(new ScanCommand(queryParams as ScanCommandInput));

    const items = (result.Items || [])
      .slice(0, limit) // Remove the extra item used for hasMore check
      .map(item => this.mapDynamoItemToTimeEntry(item as TimeEntryDynamoItem));

    const hasMore = (result.Items?.length || 0) > limit;
    const total = result.Count || 0; // This is approximate for scans

    return {
      items,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
      },
    };
  }

  // ==========================================
  // Bulk Operations
  // ==========================================

  async submitTimeEntries(timeEntryIds: string[], submittedBy: string): Promise<BulkTimeEntryResponse> {
    const successful: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const timeEntryId of timeEntryIds) {
      try {
        const timeEntry = await this.getTimeEntry(timeEntryId);
        if (!timeEntry) {
          failed.push({ id: timeEntryId, error: TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND });
          continue;
        }

        if (timeEntry.status !== 'draft' && timeEntry.status !== 'rejected') {
          failed.push({ id: timeEntryId, error: TimeEntryErrorCodes.TIME_ENTRY_ALREADY_SUBMITTED });
          continue;
        }

        await this.updateTimeEntryStatus(timeEntryId, 'submitted', submittedBy);
        successful.push(timeEntryId);
      } catch (error) {
        failed.push({ id: timeEntryId, error: (error as Error).message });
      }
    }

    return { successful, failed };
  }

  async approveTimeEntries(timeEntryIds: string[], approvedBy: string, allowSelfApproval: boolean = false): Promise<BulkTimeEntryResponse> {
    const successful: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const timeEntryId of timeEntryIds) {
      try {
        const timeEntry = await this.getTimeEntry(timeEntryId);
        if (!timeEntry) {
          failed.push({ id: timeEntryId, error: TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND });
          continue;
        }

        if (timeEntry.status !== 'submitted') {
          failed.push({ id: timeEntryId, error: TimeEntryErrorCodes.TIME_ENTRY_NOT_SUBMITTED });
          continue;
        }

        // Check self-approval rules
        if (timeEntry.userId === approvedBy && !allowSelfApproval) {
          failed.push({ id: timeEntryId, error: TimeEntryErrorCodes.CANNOT_APPROVE_OWN_ENTRIES });
          continue;
        }

        await this.updateTimeEntryStatus(timeEntryId, 'approved', approvedBy);
        successful.push(timeEntryId);
      } catch (error) {
        failed.push({ id: timeEntryId, error: (error as Error).message });
      }
    }

    return { successful, failed };
  }

  async rejectTimeEntries(timeEntryIds: string[], rejectedBy: string, reason: string): Promise<BulkTimeEntryResponse> {
    const successful: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const timeEntryId of timeEntryIds) {
      try {
        const timeEntry = await this.getTimeEntry(timeEntryId);
        if (!timeEntry) {
          failed.push({ id: timeEntryId, error: TimeEntryErrorCodes.TIME_ENTRY_NOT_FOUND });
          continue;
        }

        if (timeEntry.status !== 'submitted') {
          failed.push({ id: timeEntryId, error: TimeEntryErrorCodes.TIME_ENTRY_NOT_SUBMITTED });
          continue;
        }

        await this.updateTimeEntryStatus(timeEntryId, 'rejected', rejectedBy, reason);
        successful.push(timeEntryId);
      } catch (error) {
        failed.push({ id: timeEntryId, error: (error as Error).message });
      }
    }

    return { successful, failed };
  }

  // ==========================================
  // Timer Operations
  // ==========================================

  async startTimer(userId: string, request: Record<string, unknown>): Promise<TimerSession> {
    // Check if user already has an active timer
    const existingTimer = await this.getActiveTimer(userId);
    if (existingTimer) {
      throw new Error(TimeEntryErrorCodes.TIMER_ALREADY_RUNNING);
    }

    const now = new Date().toISOString();
    const timerId = `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const timerSession: TimerSession = {
      id: timerId,
      userId,
      projectId: request.projectId as string,
      taskId: request.taskId as string,
      description: request.description as string,
      startTime: now,
      isActive: true,
      tags: (request.tags as string[]) || [],
      notes: request.notes as string,
      createdAt: now,
    };

    const dynamoItem: TimerSessionDynamoItem = {
      PK: `TIMER#${userId}`,
      SK: 'ACTIVE',
      ...timerSession,
      tags: JSON.stringify(timerSession.tags),
      expiresAt: (Math.floor(Date.now() / 1000) + (24 * 60 * 60)).toString(), // 24 hours TTL
    };

    await docClient.send(new PutCommand({
      TableName: this.timeEntriesTable,
      Item: dynamoItem,
    }));

    return timerSession;
  }

  async getActiveTimer(userId: string): Promise<TimerSession | null> {
    const result = await docClient.send(new GetCommand({
      TableName: this.timeEntriesTable,
      Key: {
        PK: `TIMER#${userId}`,
        SK: 'ACTIVE',
      },
    }));

    if (!result.Item) {
      return null;
    }

    const item = result.Item as TimerSessionDynamoItem;
    return {
      id: item.id,
      userId: item.userId,
      projectId: item.projectId,
      taskId: item.taskId,
      description: item.description,
      startTime: item.startTime,
      isActive: item.isActive,
      tags: JSON.parse(item.tags),
      notes: item.notes,
      createdAt: item.createdAt,
    };
  }

  async stopTimer(userId: string, timeEntryData?: Record<string, unknown>): Promise<TimeEntry> {
    const timer = await this.getActiveTimer(userId);
    if (!timer) {
      throw new Error(TimeEntryErrorCodes.NO_ACTIVE_TIMER);
    }

    const now = new Date().toISOString();
    const duration = Math.round((new Date(now).getTime() - new Date(timer.startTime).getTime()) / (1000 * 60));

    // Create time entry from timer
    const timeEntry = await this.createTimeEntry(userId, {
      projectId: timer.projectId,
      taskId: timer.taskId,
      description: (timeEntryData?.finalDescription as string) || timer.description,
      date: timer.startTime.split('T')[0], // Extract date from startTime
      startTime: timer.startTime,
      endTime: now,
      duration,
      isBillable: (timeEntryData?.isBillable as boolean) ?? true,
      hourlyRate: timeEntryData?.hourlyRate as number,
      tags: (timeEntryData?.finalTags as string[]) || timer.tags,
      notes: (timeEntryData?.finalNotes as string) || timer.notes,
    });

    // Mark time entry as timer-created
    await this.updateTimeEntry(timeEntry.id, {
      // Update to mark as timer entry
    });

    // Delete the timer session
    await docClient.send(new DeleteCommand({
      TableName: this.timeEntriesTable,
      Key: {
        PK: `TIMER#${userId}`,
        SK: 'ACTIVE',
      },
    }));

    return timeEntry;
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private async updateTimeEntryStatus(
    timeEntryId: string, 
    status: 'submitted' | 'approved' | 'rejected',
    actionBy: string,
    reason?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    
    const updateExpression: string[] = ['#status = :status', '#updatedAt = :updatedAt'];
    const expressionAttributeNames: Record<string, string> = {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
    };
    const expressionAttributeValues: Record<string, unknown> = {
      ':status': status,
      ':updatedAt': now,
    };

    // Update GSI3 for status queries
    updateExpression.push('#GSI3PK = :gsi3pk');
    expressionAttributeNames['#GSI3PK'] = 'GSI3PK';
    expressionAttributeValues[':gsi3pk'] = `STATUS#${status}`;

    if (status === 'submitted') {
      updateExpression.push('#submittedAt = :submittedAt');
      expressionAttributeNames['#submittedAt'] = 'submittedAt';
      expressionAttributeValues[':submittedAt'] = now;
      
      // Update GSI4 for approval workflow
      updateExpression.push('#GSI4PK = :gsi4pk', '#GSI4SK = :gsi4sk');
      expressionAttributeNames['#GSI4PK'] = 'GSI4PK';
      expressionAttributeNames['#GSI4SK'] = 'GSI4SK';
      expressionAttributeValues[':gsi4pk'] = `APPROVAL#${status}`;
      expressionAttributeValues[':gsi4sk'] = `SUBMITTED_AT#${now}#TIME_ENTRY#${timeEntryId}`;
    } else if (status === 'approved') {
      updateExpression.push('#approvedAt = :approvedAt', '#approvedBy = :approvedBy');
      expressionAttributeNames['#approvedAt'] = 'approvedAt';
      expressionAttributeNames['#approvedBy'] = 'approvedBy';
      expressionAttributeValues[':approvedAt'] = now;
      expressionAttributeValues[':approvedBy'] = actionBy;
    } else if (status === 'rejected') {
      updateExpression.push('#rejectedAt = :rejectedAt');
      expressionAttributeNames['#rejectedAt'] = 'rejectedAt';
      expressionAttributeValues[':rejectedAt'] = now;
      
      if (reason) {
        updateExpression.push('#rejectionReason = :rejectionReason');
        expressionAttributeNames['#rejectionReason'] = 'rejectionReason';
        expressionAttributeValues[':rejectionReason'] = reason;
      }
    }

    await docClient.send(new UpdateCommand({
      TableName: this.timeEntriesTable,
      Key: {
        PK: `TIME_ENTRY#${timeEntryId}`,
        SK: `TIME_ENTRY#${timeEntryId}`,
      },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }));
  }

  private mapDynamoItemToTimeEntry(item: TimeEntryDynamoItem): TimeEntry {
    return {
      id: item.id,
      userId: item.userId,
      projectId: item.projectId,
      taskId: item.taskId,
      description: item.description,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      duration: item.duration,
      isBillable: item.isBillable,
      hourlyRate: item.hourlyRate,
      status: item.status as 'draft' | 'submitted' | 'approved' | 'rejected',
      tags: JSON.parse(item.tags || '[]'),
      notes: item.notes,
      attachments: JSON.parse(item.attachments || '[]'),
      submittedAt: item.submittedAt,
      approvedAt: item.approvedAt,
      rejectedAt: item.rejectedAt,
      approvedBy: item.approvedBy,
      rejectionReason: item.rejectionReason,
      isTimerEntry: item.isTimerEntry,
      timerStartedAt: item.timerStartedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
} 