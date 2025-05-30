import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export interface AnalyticsEvent {
  eventId: string;
  userId: string;
  eventType: string;
  timestamp: string;
  sessionId?: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country: string;
    region: string;
    city: string;
  };
  expiresAt: number; // TTL for auto-deletion (90 days)
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export class AnalyticsRepository {
  private docClient: DynamoDBDocumentClient;
  private analyticsTableName: string;
  private rateLimitTableName?: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
    this.analyticsTableName = process.env.ANALYTICS_EVENTS_TABLE_NAME || 'aerotage-analytics-events-dev';
    this.rateLimitTableName = process.env.RATE_LIMIT_TABLE_NAME;
  }

  /**
   * Track an analytics event
   */
  async trackEvent(analyticsEvent: AnalyticsEvent): Promise<void> {
    try {
      const command = new PutCommand({
        TableName: this.analyticsTableName,
        Item: analyticsEvent,
      });

      await this.docClient.send(command);
    } catch (error) {
      console.error('Error tracking analytics event:', error);
      throw new Error('Failed to track analytics event');
    }
  }

  /**
   * Get analytics events for a user
   */
  async getEventsForUser(userId: string, limit: number = 100): Promise<AnalyticsEvent[]> {
    try {
      const command = new QueryCommand({
        TableName: this.analyticsTableName,
        IndexName: 'UserIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
      });

      const result = await this.docClient.send(command);
      return (result.Items || []) as AnalyticsEvent[];
    } catch (error) {
      console.error('Error getting events for user:', error);
      return [];
    }
  }

  /**
   * Get analytics events by type
   */
  async getEventsByType(eventType: string, limit: number = 100): Promise<AnalyticsEvent[]> {
    try {
      const command = new QueryCommand({
        TableName: this.analyticsTableName,
        IndexName: 'EventTypeIndex',
        KeyConditionExpression: 'eventType = :eventType',
        ExpressionAttributeValues: {
          ':eventType': eventType,
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
      });

      const result = await this.docClient.send(command);
      return (result.Items || []) as AnalyticsEvent[];
    } catch (error) {
      console.error('Error getting events by type:', error);
      return [];
    }
  }

  /**
   * Get analytics events for a time range
   */
  async getEventsForTimeRange(startTime: string, endTime: string, limit: number = 1000): Promise<AnalyticsEvent[]> {
    try {
      const command = new ScanCommand({
        TableName: this.analyticsTableName,
        FilterExpression: '#timestamp BETWEEN :startTime AND :endTime',
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':startTime': startTime,
          ':endTime': endTime,
        },
        Limit: limit,
      });

      const result = await this.docClient.send(command);
      return (result.Items || []) as AnalyticsEvent[];
    } catch (error) {
      console.error('Error getting events for time range:', error);
      return [];
    }
  }

  /**
   * Check rate limit for a user
   */
  async checkRateLimit(userId: string): Promise<RateLimitResult> {
    try {
      if (!this.rateLimitTableName) {
        // If no rate limit table, allow all requests
        return { allowed: true, remaining: 999 };
      }

      const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
      const rateLimitKey = `${userId}-${currentHour}`;
      
      const command = new GetCommand({
        TableName: this.rateLimitTableName,
        Key: { id: rateLimitKey },
      });

      const result = await this.docClient.send(command);
      const currentCount = result.Item?.count || 0;
      const maxEvents = 1000; // 1000 events per hour per user

      return {
        allowed: currentCount < maxEvents,
        remaining: Math.max(0, maxEvents - currentCount),
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // On error, allow the request
      return { allowed: true, remaining: 999 };
    }
  }

  /**
   * Update rate limit counter
   */
  async updateRateLimit(userId: string): Promise<void> {
    try {
      if (!this.rateLimitTableName) {
        return; // No rate limiting configured
      }

      const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
      const rateLimitKey = `${userId}-${currentHour}`;
      const expiresAt = (currentHour + 1) * 60 * 60; // Expire at end of hour

      const command = new PutCommand({
        TableName: this.rateLimitTableName,
        Item: {
          id: rateLimitKey,
          userId,
          hour: currentHour,
          count: 1,
          expiresAt,
        },
        ConditionExpression: 'attribute_not_exists(id)',
      });

      try {
        await this.docClient.send(command);
      } catch (conditionalError: any) {
        if (conditionalError.name === 'ConditionalCheckFailedException') {
          // Item exists, increment count
          const updateCommand = new UpdateCommand({
            TableName: this.rateLimitTableName,
            Key: { id: rateLimitKey },
            UpdateExpression: 'ADD #count :increment',
            ExpressionAttributeNames: { '#count': 'count' },
            ExpressionAttributeValues: { ':increment': 1 },
          });
          
          await this.docClient.send(updateCommand);
        } else {
          throw conditionalError;
        }
      }
    } catch (error) {
      console.error('Error updating rate limit:', error);
      // Don't throw - rate limit update failure shouldn't break event tracking
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(timeRange: string): Promise<any[]> {
    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - this.parseTimeRange(timeRange)).toISOString();

      const command = new ScanCommand({
        TableName: this.analyticsTableName,
        FilterExpression: 'eventType = :eventType AND #timestamp BETWEEN :startTime AND :endTime',
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':eventType': 'performance_metric',
          ':startTime': startTime,
          ':endTime': endTime,
        },
      });

      const result = await this.docClient.send(command);
      return result.Items || [];
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return [];
    }
  }

  /**
   * Get user activity metrics
   */
  async getUserActivityMetrics(timeRange: string): Promise<any> {
    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - this.parseTimeRange(timeRange)).toISOString();

      const events = await this.getEventsForTimeRange(startTime, endTime);
      
      // Aggregate metrics
      const uniqueUsers = new Set(events.map(e => e.userId)).size;
      const totalEvents = events.length;
      const eventsByType = events.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        uniqueUsers,
        totalEvents,
        eventsByType,
        timeRange: { startTime, endTime },
      };
    } catch (error) {
      console.error('Error getting user activity metrics:', error);
      return null;
    }
  }

  /**
   * Parse time range string to milliseconds
   */
  private parseTimeRange(timeRange: string): number {
    const ranges: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    
    return ranges[timeRange] || ranges['24h'];
  }
} 