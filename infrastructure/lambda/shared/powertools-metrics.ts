import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

/**
 * Centralized PowerTools Metrics Configuration
 * Provides custom CloudWatch metrics for business KPIs and performance monitoring
 */
export const metrics = new Metrics({
  namespace: 'Aerotage/TimeAPI',
  serviceName: 'aerotage-time-api',
  defaultDimensions: {
    Environment: process.env.STAGE || 'dev',
    Service: 'aerotage-time-api',
    Version: process.env.API_VERSION || '1.0.0',
  },
});

/**
 * Business-specific metrics utilities
 */
export const businessMetrics = {
  /**
   * Track user authentication events
   */
  trackAuthEvent: (success: boolean, method: 'password' | 'token' | 'refresh' = 'password') => {
    metrics.addMetric('AuthenticationAttempt', MetricUnit.Count, 1);
    metrics.addMetric(`Authentication${success ? 'Success' : 'Failure'}`, MetricUnit.Count, 1);
    
    // Add dimensions for detailed analysis
    metrics.addDimensions({
      AuthMethod: method,
      AuthResult: success ? 'Success' : 'Failure',
    });
  },

  /**
   * Track user operations (CRUD)
   */
  trackUserOperation: (operation: 'create' | 'read' | 'update' | 'delete', success: boolean) => {
    metrics.addMetric('UserOperation', MetricUnit.Count, 1);
    metrics.addMetric(`User${operation.charAt(0).toUpperCase() + operation.slice(1)}`, MetricUnit.Count, 1);
    
    if (success) {
      metrics.addMetric(`User${operation.charAt(0).toUpperCase() + operation.slice(1)}Success`, MetricUnit.Count, 1);
    } else {
      metrics.addMetric(`User${operation.charAt(0).toUpperCase() + operation.slice(1)}Error`, MetricUnit.Count, 1);
    }

    metrics.addDimensions({
      Operation: operation,
      Result: success ? 'Success' : 'Error',
    });
  },

  /**
   * Track time entry operations
   */
  trackTimeEntryOperation: (operation: 'create' | 'update' | 'delete' | 'start' | 'stop' | 'submit' | 'approve' | 'reject', success: boolean, duration?: number) => {
    metrics.addMetric('TimeEntryOperation', MetricUnit.Count, 1);
    metrics.addMetric(`TimeEntry${operation.charAt(0).toUpperCase() + operation.slice(1)}`, MetricUnit.Count, 1);
    
    if (success) {
      metrics.addMetric(`TimeEntry${operation.charAt(0).toUpperCase() + operation.slice(1)}Success`, MetricUnit.Count, 1);
    } else {
      metrics.addMetric(`TimeEntry${operation.charAt(0).toUpperCase() + operation.slice(1)}Error`, MetricUnit.Count, 1);
    }

    // Track time entry duration for completed entries
    if (duration && operation === 'stop') {
      metrics.addMetric('TimeEntryDuration', MetricUnit.Seconds, duration);
    }

    metrics.addDimensions({
      Operation: operation,
      Result: success ? 'Success' : 'Error',
    });
  },

  /**
   * Track project operations
   */
  trackProjectOperation: (operation: 'create' | 'update' | 'delete' | 'assign', success: boolean) => {
    metrics.addMetric('ProjectOperation', MetricUnit.Count, 1);
    metrics.addMetric(`Project${operation.charAt(0).toUpperCase() + operation.slice(1)}`, MetricUnit.Count, 1);
    
    if (success) {
      metrics.addMetric(`Project${operation.charAt(0).toUpperCase() + operation.slice(1)}Success`, MetricUnit.Count, 1);
    } else {
      metrics.addMetric(`Project${operation.charAt(0).toUpperCase() + operation.slice(1)}Error`, MetricUnit.Count, 1);
    }

    metrics.addDimensions({
      Operation: operation,
      Result: success ? 'Success' : 'Error',
    });
  },

  /**
   * Track client operations
   */
  trackClientOperation: (operation: 'create' | 'update' | 'delete', success: boolean) => {
    metrics.addMetric('ClientOperation', MetricUnit.Count, 1);
    metrics.addMetric(`Client${operation.charAt(0).toUpperCase() + operation.slice(1)}`, MetricUnit.Count, 1);
    
    if (success) {
      metrics.addMetric(`Client${operation.charAt(0).toUpperCase() + operation.slice(1)}Success`, MetricUnit.Count, 1);
    } else {
      metrics.addMetric(`Client${operation.charAt(0).toUpperCase() + operation.slice(1)}Error`, MetricUnit.Count, 1);
    }

    metrics.addDimensions({
      Operation: operation,
      Result: success ? 'Success' : 'Error',
    });
  },

  /**
   * Track report generation
   */
  trackReportGeneration: (reportType: string, success: boolean, generationTime?: number, recordCount?: number) => {
    metrics.addMetric('ReportGeneration', MetricUnit.Count, 1);
    
    if (success) {
      metrics.addMetric('ReportGenerationSuccess', MetricUnit.Count, 1);
      
      if (generationTime) {
        metrics.addMetric('ReportGenerationTime', MetricUnit.Milliseconds, generationTime);
      }
      
      if (recordCount) {
        metrics.addMetric('ReportRecordCount', MetricUnit.Count, recordCount);
      }
    } else {
      metrics.addMetric('ReportGenerationError', MetricUnit.Count, 1);
    }

    metrics.addDimensions({
      ReportType: reportType,
      Result: success ? 'Success' : 'Error',
    });
  },

  /**
   * Track API performance metrics
   */
  trackApiPerformance: (endpoint: string, method: string, statusCode: number, responseTime: number) => {
    metrics.addMetric('ApiRequest', MetricUnit.Count, 1);
    metrics.addMetric('ApiResponseTime', MetricUnit.Milliseconds, responseTime);
    
    // Track by status code category
    if (statusCode >= 200 && statusCode < 300) {
      metrics.addMetric('ApiSuccess', MetricUnit.Count, 1);
    } else if (statusCode >= 400 && statusCode < 500) {
      metrics.addMetric('ApiClientError', MetricUnit.Count, 1);
    } else if (statusCode >= 500) {
      metrics.addMetric('ApiServerError', MetricUnit.Count, 1);
    }

    metrics.addDimensions({
      Endpoint: endpoint,
      Method: method,
      StatusCode: statusCode.toString(),
    });
  },

  /**
   * Track database performance metrics
   */
  trackDatabaseOperation: (operation: string, tableName: string, success: boolean, responseTime?: number, itemCount?: number) => {
    metrics.addMetric('DatabaseOperation', MetricUnit.Count, 1);
    metrics.addMetric(`Database${operation}`, MetricUnit.Count, 1);
    
    if (success) {
      metrics.addMetric(`Database${operation}Success`, MetricUnit.Count, 1);
      
      if (responseTime) {
        metrics.addMetric('DatabaseResponseTime', MetricUnit.Milliseconds, responseTime);
      }
      
      if (itemCount !== undefined) {
        metrics.addMetric('DatabaseItemCount', MetricUnit.Count, itemCount);
      }
    } else {
      metrics.addMetric(`Database${operation}Error`, MetricUnit.Count, 1);
    }

    metrics.addDimensions({
      Operation: operation,
      TableName: tableName,
      Result: success ? 'Success' : 'Error',
    });
  },

  /**
   * Track business KPIs
   */
  trackBusinessKPI: (kpiName: string, value: number, unit: typeof MetricUnit.Count = MetricUnit.Count) => {
    metrics.addMetric(kpiName, unit, value);
  },

  /**
   * Track security events
   */
  trackSecurityEvent: (eventType: string, severity: 'low' | 'medium' | 'high', userId?: string) => {
    metrics.addMetric('SecurityEvent', MetricUnit.Count, 1);
    metrics.addMetric(`SecurityEvent${severity.charAt(0).toUpperCase() + severity.slice(1)}`, MetricUnit.Count, 1);
    
    metrics.addDimensions({
      EventType: eventType,
      Severity: severity,
      ...(userId && { UserId: userId }),
    });
  },
};

/**
 * Performance monitoring utilities
 */
export const performanceMetrics = {
  /**
   * Track Lambda cold starts
   */
  trackColdStart: (functionName: string, initDuration: number) => {
    metrics.addMetric('LambdaColdStart', MetricUnit.Count, 1);
    metrics.addMetric('LambdaInitDuration', MetricUnit.Milliseconds, initDuration);
    
    metrics.addDimensions({
      FunctionName: functionName,
    });
  },

  /**
   * Track memory usage
   */
  trackMemoryUsage: (functionName: string, memoryUsed: number, memoryAllocated: number) => {
    const memoryUtilization = (memoryUsed / memoryAllocated) * 100;
    
    metrics.addMetric('LambdaMemoryUsed', MetricUnit.Megabytes, memoryUsed);
    metrics.addMetric('LambdaMemoryUtilization', MetricUnit.Percent, memoryUtilization);
    
    metrics.addDimensions({
      FunctionName: functionName,
    });
  },

  /**
   * Track custom performance metrics
   */
  trackCustomPerformance: (metricName: string, value: number, unit: typeof MetricUnit.Count, dimensions?: Record<string, string>) => {
    metrics.addMetric(metricName, unit, value);
    
    if (dimensions) {
      metrics.addDimensions(dimensions);
    }
  },
};

/**
 * Decorator for automatically tracking Lambda handler metrics
 * Note: Use logMetrics middleware directly with Middy instead
 */

/**
 * Helper to clear dimensions (useful for reusing metrics instance)
 */
export const clearDimensions = () => {
  metrics.clearDimensions();
};

// Re-export MetricUnit for convenience
export { MetricUnit }; 