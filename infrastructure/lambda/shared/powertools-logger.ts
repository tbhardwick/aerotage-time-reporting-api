import { Logger } from '@aws-lambda-powertools/logger';

/**
 * Centralized PowerTools Logger Configuration
 * Provides structured JSON logging with correlation IDs and environment-specific settings
 */
export const logger = new Logger({
  serviceName: 'aerotage-time-api',
  logLevel: process.env.LOG_LEVEL || (process.env.STAGE === 'prod' ? 'WARN' : 'INFO'),
  environment: process.env.STAGE || 'dev',
  sampleRateValue: process.env.STAGE === 'prod' ? 0.1 : 1.0, // Sample 10% in prod, 100% in dev
  persistentLogAttributes: {
    version: process.env.API_VERSION || '1.0.0',
    region: process.env.AWS_REGION || 'us-east-1',
  },
});

/**
 * Business-specific logger methods for common operations
 */
export const businessLogger = {
  /**
   * Log user authentication events
   */
  logAuth: (userId: string, action: string, success: boolean, metadata?: Record<string, unknown>) => {
    logger.info('Authentication event', {
      userId,
      action,
      success,
      category: 'authentication',
      ...metadata,
    });
  },

  /**
   * Log business operations (CRUD operations)
   */
  logBusinessOperation: (
    operation: string,
    resource: string,
    userId: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ) => {
    logger.info('Business operation', {
      operation,
      resource,
      userId,
      success,
      category: 'business',
      ...metadata,
    });
  },

  /**
   * Log performance metrics
   */
  logPerformance: (operation: string, duration: number, metadata?: Record<string, unknown>) => {
    logger.info('Performance metric', {
      operation,
      duration,
      category: 'performance',
      ...metadata,
    });
  },

  /**
   * Log security events
   */
  logSecurity: (event: string, userId?: string, severity: 'low' | 'medium' | 'high' = 'medium', metadata?: Record<string, unknown>) => {
    logger.warn('Security event', {
      event,
      userId,
      severity,
      category: 'security',
      ...metadata,
    });
  },

  /**
   * Log errors with context
   */
  logError: (error: Error, context: string, userId?: string, metadata?: Record<string, unknown>) => {
    logger.error('Application error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      userId,
      category: 'error',
      ...metadata,
    });
  },
};

/**
 * Helper function to add request context to logger
 */
export const addRequestContext = (requestId: string, userId?: string, userRole?: string) => {
  logger.addContext({
    requestId,
    userId,
    userRole,
  });
};

/**
 * Helper function to create child logger with additional context
 */
export const createChildLogger = (additionalContext: Record<string, unknown>) => {
  return logger.createChild(additionalContext);
}; 