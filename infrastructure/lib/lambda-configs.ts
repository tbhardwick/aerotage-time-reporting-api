/**
 * Lambda Function Configuration
 * Optimized memory and timeout settings based on function workload characteristics
 */

export interface LambdaConfig {
  memory: number;
  timeout: number;
  description?: string;
  reservedConcurrency?: number;
  provisionedConcurrency?: number; // For production critical functions
}

/**
 * Function-specific configurations based on workload analysis
 */
export const lambdaConfigs: Record<string, LambdaConfig> = {
  // Health and monitoring functions - lightweight
  'health-check': {
    memory: 128,
    timeout: 10,
    description: 'Lightweight health check endpoint',
  },

  // Authentication functions - critical path, need fast response
  'custom-authorizer': {
    memory: 256,
    timeout: 15,
    description: 'Custom Lambda authorizer - critical path',
    provisionedConcurrency: 5, // For production
  },

  // User management functions - standard CRUD operations
  'users-create': {
    memory: 256,
    timeout: 30,
    description: 'User creation with validation',
  },
  'users-list': {
    memory: 256,
    timeout: 20,
    description: 'User listing with pagination',
  },
  'users-get': {
    memory: 256,
    timeout: 15,
    description: 'Single user retrieval',
  },
  'users-update': {
    memory: 256,
    timeout: 30,
    description: 'User update with validation',
  },

  // Time entry functions - frequent operations
  'time-entries-create': {
    memory: 256,
    timeout: 30,
    description: 'Time entry creation',
  },
  'time-entries-list': {
    memory: 512,
    timeout: 45,
    description: 'Time entry listing with filtering - may process large datasets',
  },
  'time-entries-update': {
    memory: 256,
    timeout: 30,
    description: 'Time entry updates',
  },
  'time-entries-delete': {
    memory: 256,
    timeout: 20,
    description: 'Time entry deletion',
  },
  'time-entries-bulk-create': {
    memory: 512,
    timeout: 120,
    description: 'Bulk time entry operations - memory intensive',
  },
  'time-entries-bulk-update': {
    memory: 512,
    timeout: 120,
    description: 'Bulk time entry updates - memory intensive',
  },

  // Project management functions
  'projects-create': {
    memory: 256,
    timeout: 30,
    description: 'Project creation',
  },
  'projects-list': {
    memory: 256,
    timeout: 30,
    description: 'Project listing',
  },
  'projects-update': {
    memory: 256,
    timeout: 30,
    description: 'Project updates',
  },
  'projects-delete': {
    memory: 256,
    timeout: 20,
    description: 'Project deletion',
  },

  // Client management functions
  'clients-create': {
    memory: 256,
    timeout: 30,
    description: 'Client creation',
  },
  'clients-list': {
    memory: 256,
    timeout: 30,
    description: 'Client listing',
  },
  'clients-update': {
    memory: 256,
    timeout: 30,
    description: 'Client updates',
  },
  'clients-delete': {
    memory: 256,
    timeout: 20,
    description: 'Client deletion',
  },

  // Analytics functions - CPU and memory intensive
  'analytics-track-event': {
    memory: 256,
    timeout: 30,
    description: 'Event tracking',
  },
  'analytics-dashboard': {
    memory: 512,
    timeout: 60,
    description: 'Dashboard data aggregation - CPU intensive',
  },
  'analytics-performance-monitor': {
    memory: 512,
    timeout: 60,
    description: 'Performance monitoring - data processing intensive',
  },
  'analytics-real-time': {
    memory: 512,
    timeout: 45,
    description: 'Real-time analytics processing',
  },

  // Report generation functions - memory and CPU intensive
  'reports-generate': {
    memory: 1024,
    timeout: 300,
    description: 'Report generation - very memory intensive',
  },
  'reports-export': {
    memory: 1024,
    timeout: 300,
    description: 'Report export - memory intensive file processing',
  },
  'reports-list': {
    memory: 256,
    timeout: 30,
    description: 'Report listing',
  },
  'reports-scheduled': {
    memory: 1024,
    timeout: 300,
    description: 'Scheduled report generation - memory intensive',
  },

  // Invoice functions - document processing
  'invoices-generate': {
    memory: 512,
    timeout: 120,
    description: 'Invoice generation - document processing',
  },
  'invoices-export': {
    memory: 512,
    timeout: 120,
    description: 'Invoice export - file processing',
  },
  'invoices-list': {
    memory: 256,
    timeout: 30,
    description: 'Invoice listing',
  },
  'invoices-update': {
    memory: 256,
    timeout: 30,
    description: 'Invoice updates',
  },

  // User invitation functions
  'user-invitations-create': {
    memory: 256,
    timeout: 45,
    description: 'User invitation creation with email sending',
  },
  'user-invitations-list': {
    memory: 256,
    timeout: 30,
    description: 'User invitation listing',
  },
  'user-invitations-validate': {
    memory: 256,
    timeout: 20,
    description: 'Invitation token validation',
  },
  'user-invitations-accept': {
    memory: 256,
    timeout: 45,
    description: 'Invitation acceptance with user creation',
  },
  'user-invitations-resend': {
    memory: 256,
    timeout: 45,
    description: 'Resend invitation email',
  },
  'user-invitations-cancel': {
    memory: 256,
    timeout: 20,
    description: 'Cancel invitation',
  },

  // Email change workflow functions
  'email-change-submit': {
    memory: 256,
    timeout: 45,
    description: 'Submit email change request with validation',
  },
  'email-change-verify': {
    memory: 256,
    timeout: 30,
    description: 'Email verification',
  },
  'email-change-list': {
    memory: 256,
    timeout: 30,
    description: 'List email change requests',
  },
  'email-change-cancel': {
    memory: 256,
    timeout: 20,
    description: 'Cancel email change request',
  },
  'email-change-resend': {
    memory: 256,
    timeout: 45,
    description: 'Resend verification email',
  },
  'email-change-admin-approve': {
    memory: 256,
    timeout: 45,
    description: 'Admin approve email change',
  },
  'email-change-admin-reject': {
    memory: 256,
    timeout: 30,
    description: 'Admin reject email change',
  },

  // User profile and preferences functions
  'users-work-schedule-get': {
    memory: 256,
    timeout: 20,
    description: 'Get user work schedule',
  },
  'users-work-schedule-update': {
    memory: 256,
    timeout: 30,
    description: 'Update user work schedule',
  },

  // Page rendering functions (for email links)
  'accept-invitation-page': {
    memory: 256,
    timeout: 20,
    description: 'Render invitation acceptance page',
  },
  'verify-email-page': {
    memory: 256,
    timeout: 20,
    description: 'Render email verification page',
  },

  // Default configuration for any unlisted functions
  'default': {
    memory: 256,
    timeout: 30,
    description: 'Default configuration',
  },
};

/**
 * Environment-specific configuration overrides
 */
export const environmentOverrides: Record<string, Partial<Record<keyof typeof lambdaConfigs, Partial<LambdaConfig>>>> = {
  prod: {
    // Production optimizations
    'custom-authorizer': {
      provisionedConcurrency: 10, // Higher concurrency for production
    },
    'health-check': {
      provisionedConcurrency: 2, // Keep health check warm
    },
    // Reduce timeouts in production for faster failure detection
    'users-create': { timeout: 25 },
    'time-entries-create': { timeout: 25 },
    'projects-create': { timeout: 25 },
  },
  staging: {
    // Staging environment - similar to prod but lower concurrency
    'custom-authorizer': {
      provisionedConcurrency: 2,
    },
  },
  dev: {
    // Development environment - no provisioned concurrency, longer timeouts for debugging
    'reports-generate': { timeout: 600 }, // Longer timeout for debugging
    'invoices-generate': { timeout: 300 },
  },
};

/**
 * Get configuration for a specific function
 */
export function getLambdaConfig(handlerPath: string, environment: string = 'dev'): LambdaConfig {
  // Extract function identifier from handler path
  // e.g., 'users/create' -> 'users-create'
  const functionId = handlerPath.replace(/\//g, '-');
  
  // Get base configuration
  const baseConfig = lambdaConfigs[functionId] || lambdaConfigs.default;
  
  // Apply environment-specific overrides
  const envOverrides = environmentOverrides[environment]?.[functionId as keyof typeof lambdaConfigs] || {};
  
  return {
    ...baseConfig,
    ...envOverrides,
  };
}

/**
 * Get all function configurations for a specific environment
 */
export function getAllLambdaConfigs(environment: string = 'dev'): Record<string, LambdaConfig> {
  const configs: Record<string, LambdaConfig> = {};
  
  Object.keys(lambdaConfigs).forEach(functionId => {
    if (functionId !== 'default') {
      configs[functionId] = getLambdaConfig(functionId.replace(/-/g, '/'), environment);
    }
  });
  
  return configs;
}

/**
 * Validate configuration values
 */
export function validateLambdaConfig(config: LambdaConfig): boolean {
  // Memory must be between 128 MB and 10,240 MB
  if (config.memory < 128 || config.memory > 10240) {
    return false;
  }
  
  // Timeout must be between 1 second and 900 seconds (15 minutes)
  if (config.timeout < 1 || config.timeout > 900) {
    return false;
  }
  
  // Reserved concurrency must be non-negative
  if (config.reservedConcurrency !== undefined && config.reservedConcurrency < 0) {
    return false;
  }
  
  // Provisioned concurrency must be non-negative
  if (config.provisionedConcurrency !== undefined && config.provisionedConcurrency < 0) {
    return false;
  }
  
  return true;
} 