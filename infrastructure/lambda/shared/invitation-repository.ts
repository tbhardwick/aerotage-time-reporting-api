import { 
  DynamoDBClient, 
  PutItemCommand, 
  GetItemCommand, 
  UpdateItemCommand, 
  DeleteItemCommand, 
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { 
  UserInvitation, 
  UserInvitationDynamoItem, 
  InvitationFilters, 
  InvitationErrorCodes 
} from './types';
import { TokenService } from './token-service';

export interface CreateInvitationData {
  email: string;
  invitedBy: string;
  role: 'admin' | 'manager' | 'employee';
  teamId?: string;
  department?: string;
  jobTitle?: string;
  hourlyRate?: number;
  permissions: {
    features: string[];
    projects: string[];
  };
  personalMessage?: string;
  expirationDays?: number;
}

export class InvitationRepository {
  private dynamoClient: DynamoDBClient;
  private tableName: string;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.tableName = process.env.USER_INVITATIONS_TABLE || 'aerotage-user-invitations-dev';
  }

  /**
   * Creates a new user invitation
   */
  async createInvitation(data: CreateInvitationData): Promise<UserInvitation> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const token = TokenService.generateInvitationToken();
    const tokenHash = TokenService.hashToken(token);
    const expiresAt = TokenService.calculateExpirationDate(data.expirationDays || 7);

    const invitation: UserInvitation = {
      id,
      email: data.email.toLowerCase(),
      invitedBy: data.invitedBy,
      role: data.role,
      teamId: data.teamId,
      department: data.department,
      jobTitle: data.jobTitle,
      hourlyRate: data.hourlyRate,
      permissions: data.permissions,
      status: 'pending',
      invitationToken: token,
      tokenHash,
      expiresAt,
      onboardingCompleted: false,
      personalMessage: data.personalMessage,
      createdAt: now,
      updatedAt: now,
      emailSentAt: now,
      resentCount: 0,
    };

    const dynamoItem: UserInvitationDynamoItem = {
      PK: `INVITATION#${id}`,
      SK: `INVITATION#${id}`,
      GSI1PK: `EMAIL#${invitation.email}`,
      GSI1SK: `INVITATION#${now}`,
      GSI2PK: `STATUS#${invitation.status}`,
      GSI2SK: `INVITATION#${now}`,
      tokenHash,
      id: invitation.id,
      email: invitation.email,
      invitedBy: invitation.invitedBy,
      role: invitation.role,
      teamId: invitation.teamId,
      department: invitation.department,
      jobTitle: invitation.jobTitle,
      hourlyRate: invitation.hourlyRate,
      permissions: JSON.stringify(invitation.permissions),
      status: invitation.status,
      invitationToken: invitation.invitationToken,
      expiresAt: invitation.expiresAt,
      onboardingCompleted: invitation.onboardingCompleted,
      personalMessage: invitation.personalMessage,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
      emailSentAt: invitation.emailSentAt,
      resentCount: invitation.resentCount,
    };

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(dynamoItem),
      ConditionExpression: 'attribute_not_exists(PK)',
    });

    try {
      await this.dynamoClient.send(command);
      return invitation;
    } catch (error) {
      console.error('Error creating invitation:', error);
      throw new Error('Failed to create invitation');
    }
  }

  /**
   * Gets an invitation by ID
   */
  async getInvitationById(id: string): Promise<UserInvitation | null> {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({
        PK: `INVITATION#${id}`,
        SK: `INVITATION#${id}`,
      }),
    });

    try {
      const result = await this.dynamoClient.send(command);
      if (!result.Item) {
        return null;
      }

      return this.mapDynamoItemToInvitation(unmarshall(result.Item) as UserInvitationDynamoItem);
    } catch (error) {
      console.error('Error getting invitation by ID:', error);
      throw new Error('Failed to get invitation');
    }
  }

  /**
   * Gets an invitation by token hash
   */
  async getInvitationByTokenHash(tokenHash: string): Promise<UserInvitation | null> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'TokenHashIndexV2',
      KeyConditionExpression: 'tokenHash = :tokenHash',
      ExpressionAttributeValues: marshall({
        ':tokenHash': tokenHash,
      }),
    });

    try {
      const result = await this.dynamoClient.send(command);
      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return this.mapDynamoItemToInvitation(unmarshall(result.Items[0]) as UserInvitationDynamoItem);
    } catch (error) {
      console.error('Error getting invitation by token hash:', error);
      throw new Error('Failed to get invitation');
    }
  }

  /**
   * Checks if an email already has a pending invitation
   */
  async checkEmailExists(email: string): Promise<boolean> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'EmailIndexV2',
      KeyConditionExpression: 'GSI1PK = :email',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: marshall({
        ':email': `EMAIL#${email.toLowerCase()}`,
        ':status': 'pending',
      }),
    });

    try {
      const result = await this.dynamoClient.send(command);
      return (result.Items && result.Items.length > 0) || false;
    } catch (error) {
      console.error('Error checking email exists:', error);
      throw new Error('Failed to check email existence');
    }
  }

  /**
   * Lists invitations with filters and pagination
   */
  async listInvitations(filters: InvitationFilters): Promise<{
    invitations: UserInvitation[];
    total: number;
    hasMore: boolean;
  }> {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    let command: QueryCommand | ScanCommand;

    if (filters.status) {
      // Use GSI2 (StatusIndexV2) when filtering by status
      command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'StatusIndexV2',
        KeyConditionExpression: 'GSI2PK = :status',
        ExpressionAttributeValues: marshall({
          ':status': `STATUS#${filters.status}`,
        }),
        ScanIndexForward: filters.sortOrder !== 'desc',
        Limit: limit + offset + 1, // Get one extra to check if there are more
      });
    } else {
      // Scan all invitations
      command = new ScanCommand({
        TableName: this.tableName,
        Limit: limit + offset + 1,
      });
    }

    try {
      const result = await this.dynamoClient.send(command);
      const items = result.Items || [];
      
      const invitations = items
        .slice(offset, offset + limit)
        .map(item => this.mapDynamoItemToInvitation(unmarshall(item) as UserInvitationDynamoItem));

      const hasMore = items.length > offset + limit;
      const total = items.length; // This is an approximation for scans

      return {
        invitations,
        total,
        hasMore,
      };
    } catch (error) {
      console.error('Error listing invitations:', error);
      throw new Error('Failed to list invitations');
    }
  }

  /**
   * Updates an invitation
   */
  async updateInvitation(id: string, updates: Partial<UserInvitation>): Promise<UserInvitation> {
    const now = new Date().toISOString();
    updates.updatedAt = now;

    // Build update expression
    const updateExpressions: string[] = ['#updatedAt = :updatedAt'];
    const expressionAttributeNames: { [key: string]: string } = {
      '#updatedAt': 'updatedAt',
    };
    const expressionAttributeValues: { [key: string]: any } = {
      ':updatedAt': now,
    };

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'updatedAt' && value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = key === 'permissions' ? JSON.stringify(value) : value;
      }
    });

    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({
        PK: `INVITATION#${id}`,
        SK: `INVITATION#${id}`,
      }),
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues),
      ReturnValues: 'ALL_NEW',
    });

    try {
      const result = await this.dynamoClient.send(command);
      if (!result.Attributes) {
        throw new Error('Invitation not found');
      }

      return this.mapDynamoItemToInvitation(unmarshall(result.Attributes) as UserInvitationDynamoItem);
    } catch (error) {
      console.error('Error updating invitation:', error);
      throw new Error('Failed to update invitation');
    }
  }

  /**
   * Deletes an invitation
   */
  async deleteInvitation(id: string): Promise<void> {
    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({
        PK: `INVITATION#${id}`,
        SK: `INVITATION#${id}`,
      }),
    });

    try {
      await this.dynamoClient.send(command);
    } catch (error) {
      console.error('Error deleting invitation:', error);
      throw new Error('Failed to delete invitation');
    }
  }

  /**
   * Marks invitation as accepted
   */
  async acceptInvitation(id: string): Promise<UserInvitation> {
    const now = new Date().toISOString();
    
    return this.updateInvitation(id, {
      status: 'accepted',
      acceptedAt: now,
    });
  }

  /**
   * Resends invitation and optionally extends expiration
   */
  async resendInvitation(id: string, extendExpiration: boolean = true, personalMessage?: string): Promise<UserInvitation> {
    const invitation = await this.getInvitationById(id);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    const now = new Date().toISOString();
    const updates: Partial<UserInvitation> = {
      resentCount: invitation.resentCount + 1,
      lastResentAt: now,
    };

    if (extendExpiration) {
      updates.expiresAt = TokenService.calculateExpirationDate(7);
    }

    if (personalMessage !== undefined) {
      updates.personalMessage = personalMessage;
    }

    return this.updateInvitation(id, updates);
  }

  /**
   * Maps DynamoDB item to UserInvitation object
   */
  private mapDynamoItemToInvitation(item: UserInvitationDynamoItem): UserInvitation {
    return {
      id: item.id,
      email: item.email,
      invitedBy: item.invitedBy,
      role: item.role as 'admin' | 'manager' | 'employee',
      teamId: item.teamId,
      department: item.department,
      jobTitle: item.jobTitle,
      hourlyRate: item.hourlyRate,
      permissions: JSON.parse(item.permissions),
      status: item.status as 'pending' | 'accepted' | 'expired' | 'cancelled',
      invitationToken: item.invitationToken,
      tokenHash: item.tokenHash,
      expiresAt: item.expiresAt,
      acceptedAt: item.acceptedAt,
      onboardingCompleted: item.onboardingCompleted,
      personalMessage: item.personalMessage,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      emailSentAt: item.emailSentAt,
      resentCount: item.resentCount,
      lastResentAt: item.lastResentAt,
    };
  }

  /**
   * Generates a unique invitation ID
   */
  private generateId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
} 