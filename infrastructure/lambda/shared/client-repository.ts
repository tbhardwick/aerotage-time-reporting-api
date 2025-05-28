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
import { Client } from './types';

export interface ClientFilters {
  isActive?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ClientListResult {
  clients: Client[];
  total: number;
  hasMore: boolean;
}

export class ClientRepository {
  private dynamoClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.dynamoClient = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.CLIENTS_TABLE || 'aerotage-clients-dev';
  }

  /**
   * Create a new client
   */
  async createClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> {
    const now = new Date().toISOString();
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newClient: Client = {
      ...client,
      id: clientId,
      createdAt: now,
      updatedAt: now,
    };

    // Simple structure matching the existing table
    const dynamoItem = {
      id: clientId,
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      contactPerson: client.contactPerson,
      defaultHourlyRate: client.defaultHourlyRate,
      isActive: client.isActive ? 'true' : 'false', // String for GSI
      notes: client.notes,
      createdAt: now,
      updatedAt: now,
      createdBy: client.createdBy,
    };

    await this.dynamoClient.send(new PutCommand({
      TableName: this.tableName,
      Item: dynamoItem,
      ConditionExpression: 'attribute_not_exists(id)',
    }));

    return newClient;
  }

  /**
   * Get client by ID
   */
  async getClientById(clientId: string): Promise<Client | null> {
    const result = await this.dynamoClient.send(new GetCommand({
      TableName: this.tableName,
      Key: {
        id: clientId,
      },
    }));

    if (!result.Item) {
      return null;
    }

    return this.mapDynamoItemToClient(result.Item as Record<string, unknown>);
  }

  /**
   * Update client
   */
  async updateClient(
    clientId: string, 
    updates: Partial<Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>
  ): Promise<Client> {
    const now = new Date().toISOString();
    
    // Build update expression dynamically
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      updateExpressions.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = updates.name;
    }

    if (updates.email !== undefined) {
      updateExpressions.push('email = :email');
      expressionAttributeValues[':email'] = updates.email;
    }

    if (updates.phone !== undefined) {
      updateExpressions.push('phone = :phone');
      expressionAttributeValues[':phone'] = updates.phone;
    }

    if (updates.address !== undefined) {
      updateExpressions.push('address = :address');
      expressionAttributeValues[':address'] = updates.address;
    }

    if (updates.contactPerson !== undefined) {
      updateExpressions.push('contactPerson = :contactPerson');
      expressionAttributeValues[':contactPerson'] = updates.contactPerson;
    }

    if (updates.defaultHourlyRate !== undefined) {
      updateExpressions.push('defaultHourlyRate = :defaultHourlyRate');
      expressionAttributeValues[':defaultHourlyRate'] = updates.defaultHourlyRate;
    }

    if (updates.isActive !== undefined) {
      updateExpressions.push('isActive = :isActive');
      expressionAttributeValues[':isActive'] = updates.isActive ? 'true' : 'false';
    }

    if (updates.notes !== undefined) {
      updateExpressions.push('notes = :notes');
      expressionAttributeValues[':notes'] = updates.notes;
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
        id: clientId,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(id)',
      ReturnValues: 'ALL_NEW',
    }));

    return this.mapDynamoItemToClient(result.Attributes as Record<string, unknown>);
  }

  /**
   * Delete client (soft delete by setting isActive to false)
   */
  async deleteClient(clientId: string): Promise<void> {
    await this.updateClient(clientId, { isActive: false });
  }

  /**
   * Hard delete client (permanent removal)
   */
  async hardDeleteClient(clientId: string): Promise<void> {
    await this.dynamoClient.send(new DeleteCommand({
      TableName: this.tableName,
      Key: {
        id: clientId,
      },
      ConditionExpression: 'attribute_exists(id)',
    }));
  }

  /**
   * List clients with filtering and pagination
   */
  async listClients(filters: ClientFilters = {}): Promise<ClientListResult> {
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    let queryCommand;

    if (filters.isActive !== undefined) {
      // Query by status using GSI
      queryCommand = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'StatusIndex',
        KeyConditionExpression: 'isActive = :status',
        ExpressionAttributeValues: {
          ':status': filters.isActive ? 'true' : 'false',
        },
        Limit: limit + offset,
        ScanIndexForward: filters.sortOrder !== 'desc',
      });
    } else {
      // Scan all clients
      queryCommand = new ScanCommand({
        TableName: this.tableName,
        Limit: limit + offset,
      });
    }

    const result = await this.dynamoClient.send(queryCommand);
    const items = (result as { Items?: Record<string, unknown>[] }).Items || [];

    // Convert DynamoDB items to Client objects
    const clients = items.map(item => this.mapDynamoItemToClient(item));

    // Apply sorting if not using GSI
    if (filters.isActive === undefined && filters.sortBy) {
      clients.sort((a, b) => {
        const aValue = a[filters.sortBy as keyof Client];
        const bValue = b[filters.sortBy as keyof Client];
        
        // Handle undefined values
        if (aValue === undefined && bValue === undefined) return 0;
        if (aValue === undefined) return 1;
        if (bValue === undefined) return -1;
        
        if (filters.sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        }
        return aValue > bValue ? 1 : -1;
      });
    }

    // Apply pagination
    const paginatedClients = clients.slice(offset, offset + limit);
    const hasMore = clients.length > offset + limit;

    return {
      clients: paginatedClients,
      total: clients.length,
      hasMore,
    };
  }

  /**
   * Get active clients only
   */
  async getActiveClients(): Promise<Client[]> {
    const result = await this.listClients({ isActive: true });
    return result.clients;
  }

  /**
   * Search clients by name
   */
  async searchClientsByName(searchTerm: string): Promise<Client[]> {
    const result = await this.dynamoClient.send(new ScanCommand({
      TableName: this.tableName,
      FilterExpression: 'contains(#name, :searchTerm)',
      ExpressionAttributeNames: {
        '#name': 'name',
      },
      ExpressionAttributeValues: {
        ':searchTerm': searchTerm,
      },
    }));

    return (result.Items || []).map(item => this.mapDynamoItemToClient(item as Record<string, unknown>));
  }

  /**
   * Check if client name already exists
   */
  async checkClientNameExists(name: string, excludeClientId?: string): Promise<boolean> {
    const result = await this.dynamoClient.send(new ScanCommand({
      TableName: this.tableName,
      FilterExpression: '#name = :name',
      ExpressionAttributeNames: {
        '#name': 'name',
      },
      ExpressionAttributeValues: {
        ':name': name,
      },
    }));

    const existingClients = result.Items || [];
    
    if (excludeClientId) {
      return existingClients.some(item => (item as Record<string, unknown>).id !== excludeClientId);
    }
    
    return existingClients.length > 0;
  }

  /**
   * Map DynamoDB item to Client object
   */
  private mapDynamoItemToClient(item: Record<string, unknown>): Client {
    return {
      id: item.id as string,
      name: item.name as string,
      email: item.email as string,
      phone: item.phone as string,
      address: item.address as string,
      contactPerson: item.contactPerson as string,
      defaultHourlyRate: item.defaultHourlyRate as number,
      isActive: item.isActive === 'true', // Convert string back to boolean
      notes: item.notes as string,
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
      createdBy: item.createdBy as string,
    };
  }
} 