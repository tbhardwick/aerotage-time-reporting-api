import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { 
  EmailChangeRequest, 
  EmailChangeAuditLog,
  EmailChangeRequestDynamoItem,
  EmailChangeAuditLogDynamoItem,
  EmailChangeRequestFilters,
  EmailChangeErrorCodes 
} from './types';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export class EmailChangeRepository {
  private dynamoClient: DynamoDBDocumentClient;
  private requestsTableName: string;
  private auditLogTableName: string;

  constructor() {
    const client = new DynamoDBClient({});
    this.dynamoClient = DynamoDBDocumentClient.from(client);
    this.requestsTableName = process.env.EMAIL_CHANGE_REQUESTS_TABLE || '';
    this.auditLogTableName = process.env.EMAIL_CHANGE_AUDIT_LOG_TABLE || '';
  }

  // Generate secure verification token
  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create email change request
  async createEmailChangeRequest(
    userId: string,
    currentEmail: string,
    newEmail: string,
    reason: string,
    customReason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<EmailChangeRequest> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const currentEmailToken = this.generateVerificationToken();
    const newEmailToken = this.generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    const item: EmailChangeRequestDynamoItem = {
      id,
      userId,
      currentEmail,
      newEmail,
      status: 'pending_verification',
      reason,
      customReason,
      
      currentEmailVerified: false,
      newEmailVerified: false,
      currentEmailVerificationToken: currentEmailToken,
      newEmailVerificationToken: newEmailToken,
      verificationTokensExpiresAt: expiresAt,
      
      requestedAt: now,
      ipAddress,
      userAgent,
    };

    await this.dynamoClient.send(new PutCommand({
      TableName: this.requestsTableName,
      Item: item,
    }));

    // Log audit entry
    await this.createAuditLogEntry(id, 'created', userId, {
      currentEmail,
      newEmail,
      reason,
      customReason,
    }, ipAddress, userAgent);

    return this.mapDynamoItemToEmailChangeRequest(item);
  }

  // Get email change request by ID
  async getEmailChangeRequestById(requestId: string): Promise<EmailChangeRequest | null> {
    const result = await this.dynamoClient.send(new GetCommand({
      TableName: this.requestsTableName,
      Key: {
        id: requestId,
      },
    }));

    if (!result.Item) {
      return null;
    }

    return this.mapDynamoItemToEmailChangeRequest(result.Item as EmailChangeRequestDynamoItem);
  }

  // Get email change request by verification token
  async getRequestByVerificationToken(token: string, emailType: 'current' | 'new'): Promise<EmailChangeRequest | null> {
    return this.getEmailChangeRequestByToken(token, emailType);
  }

  // Get email change request by token
  async getEmailChangeRequestByToken(token: string, tokenType: 'current' | 'new'): Promise<EmailChangeRequest | null> {
    const indexName = tokenType === 'current' ? 'VerificationTokenIndexV2' : 'NewEmailVerificationTokenIndexV2';
    const fieldName = tokenType === 'current' ? 'currentEmailVerificationToken' : 'newEmailVerificationToken';

    const result = await this.dynamoClient.send(new QueryCommand({
      TableName: this.requestsTableName,
      IndexName: indexName,
      KeyConditionExpression: `${fieldName} = :token`,
      ExpressionAttributeValues: {
        ':token': token,
      },
      Limit: 1,
    }));

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return this.mapDynamoItemToEmailChangeRequest(result.Items[0] as EmailChangeRequestDynamoItem);
  }

  // Get user's email change requests
  async getUserEmailChangeRequests(
    userId: string,
    filters?: EmailChangeRequestFilters
  ): Promise<{ requests: EmailChangeRequest[]; total: number }> {
    const limit = filters?.limit || 10;
    const offset = filters?.offset || 0;

    let keyConditionExpression = 'userId = :userId';
    const expressionAttributeValues: Record<string, any> = {
      ':userId': userId,
    };

    // Add status filter if provided
    if (filters?.status) {
      keyConditionExpression = '#status = :status';
      expressionAttributeValues[':status'] = filters.status;
    }

    const result = await this.dynamoClient.send(new QueryCommand({
      TableName: this.requestsTableName,
      IndexName: filters?.status ? 'StatusIndex' : 'UserIndex',
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeNames: filters?.status ? { '#status': 'status' } : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ScanIndexForward: filters?.sortOrder !== 'asc',
      Limit: limit + offset, // Get more items to handle offset
    }));

    const items = result.Items || [];
    const paginatedItems = items.slice(offset, offset + limit);
    
    const requests = paginatedItems.map(item => 
      this.mapDynamoItemToEmailChangeRequest(item as EmailChangeRequestDynamoItem)
    );

    return {
      requests,
      total: items.length,
    };
  }

  // Check for active email change requests
  async hasActiveEmailChangeRequest(userId: string): Promise<boolean> {
    const activeStatuses = ['pending_verification', 'pending_approval', 'approved'];
    
    for (const status of activeStatuses) {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.requestsTableName,
        IndexName: 'StatusIndex',
        KeyConditionExpression: '#status = :status',
        FilterExpression: 'userId = :userId',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':userId': userId,
        },
        Limit: 1,
      }));

      if (result.Items && result.Items.length > 0) {
        return true;
      }
    }

    return false;
  }

  // Update email verification status
  async updateEmailVerificationStatus(
    requestId: string,
    emailType: 'current' | 'new',
    performedBy?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<EmailChangeRequest> {
    const now = new Date().toISOString();
    const verificationField = emailType === 'current' ? 'currentEmailVerified' : 'newEmailVerified';
    
    // Get current request to check both verification statuses
    const currentRequest = await this.getEmailChangeRequestById(requestId);
    if (!currentRequest) {
      throw new Error(EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND);
    }

    // Update verification status
    let updateExpression = `SET ${verificationField} = :verified, verifiedAt = :verifiedAt`;
    const expressionAttributeValues: Record<string, any> = {
      ':verified': true,
      ':verifiedAt': now,
    };

    // Check if both emails will be verified after this update
    const bothVerified = emailType === 'current' 
      ? currentRequest.newEmailVerified 
      : currentRequest.currentEmailVerified;

    // If both emails are verified, update status
    if (bothVerified) {
      // Determine if auto-approval applies
      const autoApprovalReasons = ['personal_preference', 'name_change'];
      const requiresApproval = !autoApprovalReasons.includes(currentRequest.reason) || 
                              this.isDomainChange(currentRequest.currentEmail, currentRequest.newEmail);

      const newStatus = requiresApproval ? 'pending_approval' : 'approved';
      
      updateExpression += ', #status = :status';
      expressionAttributeValues[':status'] = newStatus;
      
      // Add expression attribute names for reserved keyword
      const expressionAttributeNames = { '#status': 'status' };

      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.requestsTableName,
        Key: {
          id: requestId,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
      }));

      // Log verification audit entry
      await this.createAuditLogEntry(
        requestId, 
        emailType === 'current' ? 'current_email_verified' : 'new_email_verified',
        performedBy,
        { emailType },
        ipAddress,
        userAgent
      );

      // If auto-approved, log approval entry
      if (newStatus === 'approved') {
        await this.createAuditLogEntry(
          requestId,
          'approved',
          'system',
          { autoApproval: true, reason: 'Auto-approved based on reason and domain policy' },
          ipAddress,
          userAgent
        );
      }
    } else {
      await this.dynamoClient.send(new UpdateCommand({
        TableName: this.requestsTableName,
        Key: {
          id: requestId,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
      }));

      // Log verification audit entry
      await this.createAuditLogEntry(
        requestId,
        emailType === 'current' ? 'current_email_verified' : 'new_email_verified',
        performedBy,
        { emailType },
        ipAddress,
        userAgent
      );
    }

    // Return updated request
    const updatedRequest = await this.getEmailChangeRequestById(requestId);
    if (!updatedRequest) {
      throw new Error(EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND);
    }

    return updatedRequest;
  }

  // Approve email change request
  async approveEmailChangeRequest(
    requestId: string,
    approvedBy: string,
    approvalNotes?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<EmailChangeRequest> {
    const now = new Date().toISOString();

    await this.dynamoClient.send(new UpdateCommand({
      TableName: this.requestsTableName,
      Key: {
        id: requestId,
      },
      UpdateExpression: 'SET #status = :status, approvedBy = :approvedBy, approvedAt = :approvedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'approved',
        ':approvedBy': approvedBy,
        ':approvedAt': now,
      },
    }));

    // Log audit entry
    await this.createAuditLogEntry(requestId, 'approved', approvedBy, {
      approvalNotes,
    }, ipAddress, userAgent);

    const updatedRequest = await this.getEmailChangeRequestById(requestId);
    if (!updatedRequest) {
      throw new Error(EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND);
    }

    return updatedRequest;
  }

  // Reject email change request
  async rejectEmailChangeRequest(
    requestId: string,
    rejectedBy: string,
    rejectionReason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<EmailChangeRequest> {
    const now = new Date().toISOString();

    await this.dynamoClient.send(new UpdateCommand({
      TableName: this.requestsTableName,
      Key: {
        id: requestId,
      },
      UpdateExpression: 'SET #status = :status, rejectedBy = :rejectedBy, rejectedAt = :rejectedAt, rejectionReason = :rejectionReason',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'rejected',
        ':rejectedBy': rejectedBy,
        ':rejectedAt': now,
        ':rejectionReason': rejectionReason,
      },
    }));

    // Log audit entry
    await this.createAuditLogEntry(requestId, 'rejected', rejectedBy, {
      rejectionReason,
    }, ipAddress, userAgent);

    const updatedRequest = await this.getEmailChangeRequestById(requestId);
    if (!updatedRequest) {
      throw new Error(EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND);
    }

    return updatedRequest;
  }

  // Cancel email change request
  async cancelEmailChangeRequest(
    requestId: string,
    cancelledBy: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<EmailChangeRequest> {
    const now = new Date().toISOString();

    await this.dynamoClient.send(new UpdateCommand({
      TableName: this.requestsTableName,
      Key: {
        id: requestId,
      },
      UpdateExpression: 'SET #status = :status, cancelledBy = :cancelledBy, cancelledAt = :cancelledAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'cancelled',
        ':cancelledBy': cancelledBy,
        ':cancelledAt': now,
      },
    }));

    // Log audit entry
    await this.createAuditLogEntry(requestId, 'cancelled', cancelledBy, {}, ipAddress, userAgent);

    const updatedRequest = await this.getEmailChangeRequestById(requestId);
    if (!updatedRequest) {
      throw new Error(EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND);
    }

    return updatedRequest;
  }

  // Complete email change request
  async completeEmailChangeRequest(
    requestId: string,
    performedBy: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<EmailChangeRequest> {
    const now = new Date().toISOString();

    await this.dynamoClient.send(new UpdateCommand({
      TableName: this.requestsTableName,
      Key: {
        id: requestId,
      },
      UpdateExpression: 'SET #status = :status, completedAt = :completedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':completedAt': now,
      },
    }));

    // Log audit entry
    await this.createAuditLogEntry(requestId, 'completed', performedBy, {}, ipAddress, userAgent);

    const updatedRequest = await this.getEmailChangeRequestById(requestId);
    if (!updatedRequest) {
      throw new Error(EmailChangeErrorCodes.EMAIL_CHANGE_REQUEST_NOT_FOUND);
    }

    return updatedRequest;
  }

  // Generate new verification tokens
  async regenerateVerificationTokens(
    requestId: string,
    emailType: 'current' | 'new',
    performedBy?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ token: string; expiresAt: string }> {
    const newToken = this.generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const tokenField = emailType === 'current' ? 'currentEmailVerificationToken' : 'newEmailVerificationToken';

    await this.dynamoClient.send(new UpdateCommand({
      TableName: this.requestsTableName,
      Key: {
        id: requestId,
      },
      UpdateExpression: `SET ${tokenField} = :token, verificationTokensExpiresAt = :expiresAt`,
      ExpressionAttributeValues: {
        ':token': newToken,
        ':expiresAt': expiresAt,
      },
    }));

    // Log audit entry
    await this.createAuditLogEntry(requestId, 'verification_resent', performedBy, {
      emailType,
    }, ipAddress, userAgent);

    return { token: newToken, expiresAt };
  }

  // Create audit log entry
  async createAuditLogEntry(
    requestId: string,
    action: string,
    performedBy?: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const item: EmailChangeAuditLogDynamoItem = {
      id,
      requestId,
      action,
      performedBy,
      performedAt: now,
      details: details ? JSON.stringify(details) : undefined,
      ipAddress,
      userAgent,
    };

    await this.dynamoClient.send(new PutCommand({
      TableName: this.auditLogTableName,
      Item: item,
    }));
  }

  // Get audit log for request
  async getAuditLogForRequest(requestId: string): Promise<EmailChangeAuditLog[]> {
    const result = await this.dynamoClient.send(new QueryCommand({
      TableName: this.auditLogTableName,
      IndexName: 'RequestIndex',
      KeyConditionExpression: 'requestId = :requestId',
      ExpressionAttributeValues: {
        ':requestId': requestId,
      },
      ScanIndexForward: true, // Chronological order
    }));

    return (result.Items || []).map(item => this.mapDynamoItemToAuditLog(item as EmailChangeAuditLogDynamoItem));
  }

  // Helper method to check if email change involves domain change
  private isDomainChange(currentEmail: string, newEmail: string): boolean {
    const currentDomain = currentEmail.split('@')[1];
    const newDomain = newEmail.split('@')[1];
    return currentDomain !== newDomain;
  }

  // Map DynamoDB item to EmailChangeRequest
  private mapDynamoItemToEmailChangeRequest(item: EmailChangeRequestDynamoItem): EmailChangeRequest {
    return {
      id: item.id,
      userId: item.userId,
      currentEmail: item.currentEmail,
      newEmail: item.newEmail,
      status: item.status as any,
      reason: item.reason as any,
      customReason: item.customReason,
      
      currentEmailVerified: item.currentEmailVerified,
      newEmailVerified: item.newEmailVerified,
      currentEmailVerificationToken: item.currentEmailVerificationToken,
      newEmailVerificationToken: item.newEmailVerificationToken,
      verificationTokensExpiresAt: item.verificationTokensExpiresAt,
      
      approvedBy: item.approvedBy,
      approvedAt: item.approvedAt,
      rejectedBy: item.rejectedBy,
      rejectedAt: item.rejectedAt,
      rejectionReason: item.rejectionReason,
      
      completedAt: item.completedAt,
      estimatedCompletionTime: item.estimatedCompletionTime,
      
      requestedAt: item.requestedAt,
      verifiedAt: item.verifiedAt,
      cancelledAt: item.cancelledAt,
      cancelledBy: item.cancelledBy,
      
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
    };
  }

  // Map DynamoDB item to EmailChangeAuditLog
  private mapDynamoItemToAuditLog(item: EmailChangeAuditLogDynamoItem): EmailChangeAuditLog {
    return {
      id: item.id,
      requestId: item.requestId,
      action: item.action as any,
      performedBy: item.performedBy,
      performedAt: item.performedAt,
      details: item.details ? JSON.parse(item.details) : undefined,
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
    };
  }

  // List email change requests with pagination and filtering
  async listEmailChangeRequests(options: {
    userId?: string;
    status?: string;
    limit?: number;
    lastEvaluatedKey?: string;
    includeCompleted?: boolean;
  }): Promise<{ requests: EmailChangeRequest[]; lastEvaluatedKey?: string }> {
    const limit = options.limit || 20;
    
    const queryParams: any = {
      TableName: this.requestsTableName,
      Limit: limit,
      ScanIndexForward: false, // Most recent first
    };

    if (options.lastEvaluatedKey) {
      try {
        queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(options.lastEvaluatedKey, 'base64').toString());
      } catch (error) {
        console.error('Invalid lastEvaluatedKey:', error);
        // Continue without pagination
      }
    }

    let result;

    if (options.userId) {
      // Query by user
      queryParams.IndexName = 'UserIndex';
      queryParams.KeyConditionExpression = 'userId = :userId';
      queryParams.ExpressionAttributeValues = {
        ':userId': options.userId,
      };

      if (options.status) {
        queryParams.FilterExpression = '#status = :status';
        queryParams.ExpressionAttributeNames = { '#status': 'status' };
        queryParams.ExpressionAttributeValues[':status'] = options.status;
      }

      if (!options.includeCompleted) {
        const filterExpression = queryParams.FilterExpression 
          ? `${queryParams.FilterExpression} AND #status <> :completed`
          : '#status <> :completed';
        queryParams.FilterExpression = filterExpression;
        queryParams.ExpressionAttributeNames = { '#status': 'status' };
        queryParams.ExpressionAttributeValues[':completed'] = 'completed';
      }

      result = await this.dynamoClient.send(new QueryCommand(queryParams));
    } else if (options.status) {
      // Query by status
      queryParams.IndexName = 'StatusIndex';
      queryParams.KeyConditionExpression = '#status = :status';
      queryParams.ExpressionAttributeNames = { '#status': 'status' };
      queryParams.ExpressionAttributeValues = {
        ':status': options.status,
      };

      result = await this.dynamoClient.send(new QueryCommand(queryParams));
    } else {
      // Scan all requests (admin view)
      if (!options.includeCompleted) {
        queryParams.FilterExpression = '#status <> :completed';
        queryParams.ExpressionAttributeNames = { '#status': 'status' };
        queryParams.ExpressionAttributeValues = { ':completed': 'completed' };
      }

      // Use scan for all requests
      const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
      result = await this.dynamoClient.send(new ScanCommand(queryParams));
    }

    const requests = (result.Items || []).map(item => 
      this.mapDynamoItemToEmailChangeRequest(item as EmailChangeRequestDynamoItem)
    );

    let lastEvaluatedKey: string | undefined;
    if (result.LastEvaluatedKey) {
      lastEvaluatedKey = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    return {
      requests,
      lastEvaluatedKey,
    };
  }
} 