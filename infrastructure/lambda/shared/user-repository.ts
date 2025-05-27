import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { User } from './types';

export interface CreateUserData {
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'employee';
  department?: string;
  jobTitle?: string;
  hourlyRate?: number;
  permissions?: {
    features: string[];
    projects: string[];
  };
  preferences?: {
    theme: 'light' | 'dark';
    notifications: boolean;
    timezone: string;
  };
  contactInfo?: {
    phone?: string;
    address?: string;
    emergencyContact?: string;
  };
  invitationId?: string;
  invitedBy?: string;
}

export class UserRepository {
  private docClient: DynamoDBDocumentClient;
  private usersTableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
    this.usersTableName = process.env.USERS_TABLE || 'aerotage-users-dev';
  }

  /**
   * Creates a new user
   */
  async createUser(data: CreateUserData): Promise<User> {
    const id = this.generateId();
    const now = new Date().toISOString();

    // Create main user record
    const user: User = {
      id,
      email: data.email.toLowerCase(),
      name: data.name,
      role: data.role,
      department: data.department,
      jobTitle: data.jobTitle,
      hourlyRate: data.hourlyRate,
      permissions: data.permissions || { features: [], projects: [] },
      invitationId: data.invitationId,
      invitedBy: data.invitedBy,
      isActive: true,
      startDate: now,
      preferences: data.preferences || { theme: 'light', notifications: true, timezone: 'UTC' },
      contactInfo: data.contactInfo,
      createdAt: now,
      updatedAt: now,
      createdBy: data.invitedBy || 'system',
    };

    // Save to main users table
    const userItem = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      jobTitle: user.jobTitle,
      hourlyRate: user.hourlyRate,
      permissions: JSON.stringify(user.permissions),
      invitationId: user.invitationId,
      invitedBy: user.invitedBy,
      isActive: user.isActive,
      startDate: user.startDate,
      preferences: JSON.stringify(user.preferences),
      contactInfo: JSON.stringify(user.contactInfo),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      createdBy: user.createdBy,
    };

    const putUserCommand = new PutCommand({
      TableName: this.usersTableName,
      Item: userItem,
      ConditionExpression: 'attribute_not_exists(id)',
    });

    try {
      await this.docClient.send(putUserCommand);
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  /**
   * Gets a user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    try {
      const command = new GetCommand({
        TableName: this.usersTableName,
        Key: { id },
      });

      const result = await this.docClient.send(command);
      
      if (!result.Item) {
        return null;
      }

      return this.mapDynamoItemToUser(result.Item);
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw new Error('Failed to get user');
    }
  }

  /**
   * Gets a user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const command = new ScanCommand({
        TableName: this.usersTableName,
        FilterExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email.toLowerCase(),
        },
      });

      const result = await this.docClient.send(command);
      
      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return this.mapDynamoItemToUser(result.Items[0]);
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw new Error('Failed to get user');
    }
  }

  /**
   * Gets all users
   */
  async getAllUsers(): Promise<User[]> {
    try {
      const command = new ScanCommand({
        TableName: this.usersTableName,
      });

      const result = await this.docClient.send(command);
      
      if (!result.Items || result.Items.length === 0) {
        return [];
      }

      return result.Items.map(item => this.mapDynamoItemToUser(item));
    } catch (error) {
      console.error('Error getting all users:', error);
      throw new Error('Failed to get users');
    }
  }

  /**
   * Updates a user
   */
  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const now = new Date().toISOString();
    
    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && value !== undefined) {
        const attrName = `#${key}`;
        const attrValue = `:${key}`;
        
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        
        if (key === 'permissions') {
          expressionAttributeValues[attrValue] = JSON.stringify(value);
        } else if (key === 'preferences') {
          expressionAttributeValues[attrValue] = JSON.stringify(value);
        } else if (key === 'contactInfo') {
          expressionAttributeValues[attrValue] = JSON.stringify(value);
        } else {
          expressionAttributeValues[attrValue] = value;
        }
      }
    });

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;

    try {
      const command = new UpdateCommand({
        TableName: this.usersTableName,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });

      const result = await this.docClient.send(command);
      
      if (!result.Attributes) {
        throw new Error('User not found');
      }

      return this.mapDynamoItemToUser(result.Attributes);
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  /**
   * Generates a unique ID for users
   */
  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Maps DynamoDB item to User object
   */
  private mapDynamoItemToUser(item: Record<string, any>): User {
    return {
      id: item.id,
      email: item.email,
      name: item.name,
      role: item.role,
      department: item.department,
      jobTitle: item.jobTitle,
      hourlyRate: item.hourlyRate,
      permissions: item.permissions ? JSON.parse(item.permissions) : { features: [], projects: [] },
      invitationId: item.invitationId,
      invitedBy: item.invitedBy,
      isActive: item.isActive,
      startDate: item.startDate,
      preferences: item.preferences ? JSON.parse(item.preferences) : { theme: 'light', notifications: true, timezone: 'UTC' },
      contactInfo: item.contactInfo ? JSON.parse(item.contactInfo) : undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdBy: item.createdBy,
    };
  }
} 