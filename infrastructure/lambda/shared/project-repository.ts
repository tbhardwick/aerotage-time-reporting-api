import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  UpdateCommand, 
  DeleteCommand, 
  QueryCommand, 
  ScanCommand 
} from '@aws-sdk/lib-dynamodb';
import { 
  Project, 
  ProjectDynamoItem, 
  TimeEntryErrorCodes 
} from './types';

export interface ProjectFilters {
  clientId?: string;
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
  teamMember?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'deadline';
  sortOrder?: 'asc' | 'desc';
}

export interface ProjectListResult {
  projects: Project[];
  total: number;
  hasMore: boolean;
}

export class ProjectRepository {
  private dynamoClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.dynamoClient = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.PROJECTS_TABLE_NAME || 'aerotage-projects-dev';
  }

  /**
   * Create a new project
   */
  async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = new Date().toISOString();
    const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newProject: Project = {
      ...project,
      id: projectId,
      createdAt: now,
      updatedAt: now,
    };

    const dynamoItem: ProjectDynamoItem = {
      PK: `PROJECT#${projectId}`,
      SK: `PROJECT#${projectId}`,
      GSI1PK: `CLIENT#${project.clientId}`,
      GSI1SK: `PROJECT#${project.name}`,
      GSI2PK: `STATUS#${project.status}`,
      GSI2SK: `PROJECT#${now}`,
      id: projectId,
      name: project.name,
      clientId: project.clientId,
      clientName: project.clientName,
      description: project.description,
      status: project.status,
      defaultHourlyRate: project.defaultHourlyRate,
      defaultBillable: project.defaultBillable,
      budget: project.budget ? JSON.stringify(project.budget) : undefined,
      deadline: project.deadline,
      teamMembers: JSON.stringify(project.teamMembers),
      tags: JSON.stringify(project.tags),
      createdAt: now,
      updatedAt: now,
      createdBy: project.createdBy,
    };

    await this.dynamoClient.send(new PutCommand({
      TableName: this.tableName,
      Item: dynamoItem,
      ConditionExpression: 'attribute_not_exists(PK)',
    }));

    return newProject;
  }

  /**
   * Get project by ID
   */
  async getProjectById(projectId: string): Promise<Project | null> {
    const result = await this.dynamoClient.send(new GetCommand({
      TableName: this.tableName,
      Key: {
        PK: `PROJECT#${projectId}`,
        SK: `PROJECT#${projectId}`,
      },
    }));

    if (!result.Item) {
      return null;
    }

    return this.mapDynamoItemToProject(result.Item as ProjectDynamoItem);
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string, 
    updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>
  ): Promise<Project> {
    const now = new Date().toISOString();
    
    // Build update expression dynamically
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    if (updates.name !== undefined) {
      updateExpressions.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = updates.name;
      
      // Update GSI1SK as well
      updateExpressions.push('GSI1SK = :gsi1sk');
      expressionAttributeValues[':gsi1sk'] = `PROJECT#${updates.name}`;
    }

    if (updates.clientId !== undefined) {
      updateExpressions.push('clientId = :clientId');
      expressionAttributeValues[':clientId'] = updates.clientId;
      
      // Update GSI1PK as well
      updateExpressions.push('GSI1PK = :gsi1pk');
      expressionAttributeValues[':gsi1pk'] = `CLIENT#${updates.clientId}`;
    }

    if (updates.clientName !== undefined) {
      updateExpressions.push('clientName = :clientName');
      expressionAttributeValues[':clientName'] = updates.clientName;
    }

    if (updates.description !== undefined) {
      updateExpressions.push('description = :description');
      expressionAttributeValues[':description'] = updates.description;
    }

    if (updates.status !== undefined) {
      updateExpressions.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = updates.status;
      
      // Update GSI2PK as well
      updateExpressions.push('GSI2PK = :gsi2pk');
      expressionAttributeValues[':gsi2pk'] = `STATUS#${updates.status}`;
    }

    if (updates.defaultHourlyRate !== undefined) {
      updateExpressions.push('defaultHourlyRate = :defaultHourlyRate');
      expressionAttributeValues[':defaultHourlyRate'] = updates.defaultHourlyRate;
    }

    if (updates.defaultBillable !== undefined) {
      updateExpressions.push('defaultBillable = :defaultBillable');
      expressionAttributeValues[':defaultBillable'] = updates.defaultBillable;
    }

    if (updates.budget !== undefined) {
      updateExpressions.push('budget = :budget');
      expressionAttributeValues[':budget'] = updates.budget ? JSON.stringify(updates.budget) : null;
    }

    if (updates.deadline !== undefined) {
      updateExpressions.push('deadline = :deadline');
      expressionAttributeValues[':deadline'] = updates.deadline;
    }

    if (updates.teamMembers !== undefined) {
      updateExpressions.push('teamMembers = :teamMembers');
      expressionAttributeValues[':teamMembers'] = JSON.stringify(updates.teamMembers);
    }

    if (updates.tags !== undefined) {
      updateExpressions.push('tags = :tags');
      expressionAttributeValues[':tags'] = JSON.stringify(updates.tags);
    }

    // Always update the updatedAt timestamp
    updateExpressions.push('updatedAt = :updatedAt');
    expressionAttributeValues[':updatedAt'] = now;

    if (updateExpressions.length === 1) { // Only updatedAt
      throw new Error('No valid updates provided');
    }

    const result = await this.dynamoClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: {
        PK: `PROJECT#${projectId}`,
        SK: `PROJECT#${projectId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    }));

    return this.mapDynamoItemToProject(result.Attributes as ProjectDynamoItem);
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.dynamoClient.send(new DeleteCommand({
      TableName: this.tableName,
      Key: {
        PK: `PROJECT#${projectId}`,
        SK: `PROJECT#${projectId}`,
      },
      ConditionExpression: 'attribute_exists(PK)',
    }));
  }

  /**
   * List projects with filtering and pagination
   */
  async listProjects(filters: ProjectFilters = {}): Promise<ProjectListResult> {
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    let queryCommand;

    if (filters.clientId) {
      // Query by client using GSI1
      queryCommand = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'ClientIndex',
        KeyConditionExpression: 'GSI1PK = :clientId',
        ExpressionAttributeValues: {
          ':clientId': `CLIENT#${filters.clientId}`,
        },
        Limit: limit + offset,
        ScanIndexForward: filters.sortOrder !== 'desc',
      });
    } else if (filters.status) {
      // Query by status using GSI2
      queryCommand = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'StatusIndex',
        KeyConditionExpression: 'GSI2PK = :status',
        ExpressionAttributeValues: {
          ':status': `STATUS#${filters.status}`,
        },
        Limit: limit + offset,
        ScanIndexForward: filters.sortOrder !== 'desc',
      });
    } else {
      // Scan all projects
      queryCommand = new ScanCommand({
        TableName: this.tableName,
        Limit: limit + offset,
      });
    }

    const result = await this.dynamoClient.send(queryCommand);
    const items = result.Items || [];

    // Convert DynamoDB items to Project objects
    let projects = items.map(item => this.mapDynamoItemToProject(item as ProjectDynamoItem));

    // Apply team member filter if specified
    if (filters.teamMember) {
      projects = projects.filter(project => 
        project.teamMembers.includes(filters.teamMember!)
      );
    }

    // Apply pagination
    const paginatedProjects = projects.slice(offset, offset + limit);
    const hasMore = projects.length > offset + limit;

    return {
      projects: paginatedProjects,
      total: projects.length,
      hasMore,
    };
  }

  /**
   * Get projects by client ID
   */
  async getProjectsByClientId(clientId: string): Promise<Project[]> {
    const result = await this.dynamoClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'ClientIndex',
      KeyConditionExpression: 'GSI1PK = :clientId',
      ExpressionAttributeValues: {
        ':clientId': `CLIENT#${clientId}`,
      },
    }));

    return (result.Items || []).map(item => this.mapDynamoItemToProject(item as ProjectDynamoItem));
  }

  /**
   * Check if user has access to project
   */
  async checkProjectAccess(projectId: string, userId: string): Promise<boolean> {
    const project = await this.getProjectById(projectId);
    if (!project) {
      return false;
    }

    // Check if user is a team member
    return project.teamMembers.includes(userId);
  }

  /**
   * Map DynamoDB item to Project object
   */
  private mapDynamoItemToProject(item: ProjectDynamoItem): Project {
    return {
      id: item.id,
      name: item.name,
      clientId: item.clientId,
      clientName: item.clientName,
      description: item.description,
      status: item.status as 'active' | 'paused' | 'completed' | 'cancelled',
      defaultHourlyRate: item.defaultHourlyRate,
      defaultBillable: item.defaultBillable,
      budget: item.budget ? JSON.parse(item.budget) : undefined,
      deadline: item.deadline,
      teamMembers: JSON.parse(item.teamMembers),
      tags: JSON.parse(item.tags),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdBy: item.createdBy,
    };
  }
} 