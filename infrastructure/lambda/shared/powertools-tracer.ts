import { Tracer } from '@aws-lambda-powertools/tracer';

/**
 * Centralized PowerTools Tracer Configuration
 * Provides distributed tracing with X-Ray integration
 */
export const tracer = new Tracer({
  serviceName: 'aerotage-time-api',
  captureHTTPsRequests: true,
  captureResponse: process.env.STAGE !== 'prod', // Capture responses in dev/staging only
  environment: process.env.STAGE || 'dev',
});

/**
 * Business-specific tracing utilities
 */
export const businessTracer = {
  /**
   * Create a subsegment for database operations
   */
  traceDatabaseOperation: async <T>(
    operation: string,
    tableName: string,
    callback: () => Promise<T>
  ): Promise<T> => {
    const subsegment = tracer.getSegment()?.addNewSubsegment(`DynamoDB.${operation}`);
    
    if (subsegment) {
      subsegment.addAnnotation('tableName', tableName);
      subsegment.addAnnotation('operation', operation);
      subsegment.addMetadata('database', { tableName, operation });
    }

    try {
      const result = await callback();
      
      if (subsegment) {
        subsegment.addAnnotation('success', true);
        subsegment.close();
      }
      
      return result;
    } catch (error) {
      if (subsegment) {
        subsegment.addAnnotation('success', false);
        subsegment.addMetadata('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'UnknownError',
        });
        subsegment.close(error);
      }
      throw error;
    }
  },

  /**
   * Create a subsegment for business logic operations
   */
  traceBusinessOperation: async <T>(
    operation: string,
    resource: string,
    callback: () => Promise<T>
  ): Promise<T> => {
    const subsegment = tracer.getSegment()?.addNewSubsegment(`Business.${operation}`);
    
    if (subsegment) {
      subsegment.addAnnotation('resource', resource);
      subsegment.addAnnotation('operation', operation);
      subsegment.addMetadata('business', { resource, operation });
    }

    try {
      const result = await callback();
      
      if (subsegment) {
        subsegment.addAnnotation('success', true);
        subsegment.close();
      }
      
      return result;
    } catch (error) {
      if (subsegment) {
        subsegment.addAnnotation('success', false);
        subsegment.addMetadata('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'UnknownError',
        });
        subsegment.close(error);
      }
      throw error;
    }
  },

  /**
   * Create a subsegment for external API calls
   */
  traceExternalCall: async <T>(
    serviceName: string,
    operation: string,
    callback: () => Promise<T>
  ): Promise<T> => {
    const subsegment = tracer.getSegment()?.addNewSubsegment(`External.${serviceName}`);
    
    if (subsegment) {
      subsegment.addAnnotation('service', serviceName);
      subsegment.addAnnotation('operation', operation);
      subsegment.addMetadata('external', { serviceName, operation });
    }

    try {
      const result = await callback();
      
      if (subsegment) {
        subsegment.addAnnotation('success', true);
        subsegment.close();
      }
      
      return result;
    } catch (error) {
      if (subsegment) {
        subsegment.addAnnotation('success', false);
        subsegment.addMetadata('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'UnknownError',
        });
        subsegment.close(error);
      }
      throw error;
    }
  },

  /**
   * Add user context to current trace
   */
  addUserContext: (userId: string, userRole?: string, userDepartment?: string) => {
    const segment = tracer.getSegment();
    if (segment) {
      segment.addAnnotation('userId', userId);
      if (userRole) segment.addAnnotation('userRole', userRole);
      if (userDepartment) segment.addAnnotation('userDepartment', userDepartment);
      
      segment.addMetadata('user', {
        userId,
        userRole,
        userDepartment,
      });
    }
  },

  /**
   * Add request context to current trace
   */
  addRequestContext: (requestId: string, httpMethod?: string, resourcePath?: string) => {
    const segment = tracer.getSegment();
    if (segment) {
      segment.addAnnotation('requestId', requestId);
      if (httpMethod) segment.addAnnotation('httpMethod', httpMethod);
      if (resourcePath) segment.addAnnotation('resourcePath', resourcePath);
      
      segment.addMetadata('request', {
        requestId,
        httpMethod,
        resourcePath,
      });
    }
  },
};

/**
 * Decorator for tracing Lambda handlers
 * Usage: export const handler = traceLambdaHandler(myHandler);
 */
export const traceLambdaHandler = <T extends (...args: any[]) => any>(handler: T): T => {
  return tracer.captureLambdaHandler(handler);
};

/**
 * Decorator for tracing async methods
 * Usage: @traceMethod('methodName') or traceMethod('methodName')(myMethod)
 */
export const traceMethod = (methodName: string) => {
  return tracer.captureMethod(methodName);
}; 