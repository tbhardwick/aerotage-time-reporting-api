# Backend Development Guide

## 🏗️ **Development Setup**

### **Prerequisites**
- Node.js 18+ installed
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed globally (`npm install -g aws-cdk`)
- Proper IAM permissions for AWS resource management

### **Environment Setup**

#### 1. **Clone and Install Dependencies**
```bash
git clone https://github.com/aerotage/aerotage-time-reporting-api.git
cd aerotage-time-reporting-api

# Install main dependencies
npm install

# Install infrastructure dependencies
cd infrastructure
npm install
```

#### 2. **Configure AWS Profiles**
```bash
# Development environment
aws configure --profile aerotage-dev

# Staging environment (optional)
aws configure --profile aerotage-staging

# Production environment (optional)
aws configure --profile aerotage-prod
```

#### 3. **Bootstrap CDK** (One-time setup)
```bash
cd infrastructure
cdk bootstrap --profile aerotage-dev
```

## 🚀 **Development Workflow**

### **Local Development**

#### **1. Build and Test**
```bash
# Build TypeScript
npm run build

# Run linting
npm run lint

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage
```

#### **2. Infrastructure Development**
```bash
cd infrastructure

# View infrastructure changes
npm run diff:dev

# Deploy changes to development
npm run deploy:dev

# View synthesized CloudFormation
npm run synth
```

### **Lambda Function Development**

#### **Directory Structure**
```
infrastructure/lambda/
├── time-entries/
│   ├── create.ts      # POST /time-entries
│   ├── list.ts        # GET /time-entries
│   ├── update.ts      # PUT /time-entries/{id}
│   └── delete.ts      # DELETE /time-entries/{id}
├── projects/
│   ├── create.ts      # POST /projects
│   ├── list.ts        # GET /projects
│   └── ...
└── users/
    ├── create.ts      # POST /users
    ├── list.ts        # GET /users
    └── ...
```

#### **Lambda Function Template**
```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Input validation
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    // Parse input
    const data = JSON.parse(event.body);

    // Business logic here
    // ...

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: result,
      }),
    };
  } catch (error) {
    console.error('Handler error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
```

### **Adding New API Endpoints**

#### **1. Create Lambda Function**
```bash
# Create directory and handler file
mkdir infrastructure/lambda/new-feature
touch infrastructure/lambda/new-feature/handler.ts
```

#### **2. Implement Handler Logic**
```typescript
// infrastructure/lambda/new-feature/handler.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Implementation here
};
```

#### **3. Update API Stack**
```typescript
// infrastructure/lib/api-stack.ts

// Add new Lambda function
const newFeatureHandler = createLambdaFunction(
  'NewFeatureHandler',
  'new-feature/handler',
  'Handles new feature operations'
);

// Add API Gateway route
const newFeatureResource = api.root.addResource('new-feature');
newFeatureResource.addMethod('GET', 
  new apigateway.LambdaIntegration(newFeatureHandler),
  {
    authorizer: cognitoAuthorizer,
    authorizationType: apigateway.AuthorizationType.COGNITO,
  }
);
```

#### **4. Deploy Changes**
```bash
cd infrastructure
npm run deploy:dev
```

## 🗄️ **Database Development**

### **DynamoDB Best Practices**

#### **1. Single Table Design**
- Use one main table with GSIs for different access patterns
- Partition key strategy: `{ENTITY_TYPE}#{ID}`
- Sort key patterns: `{METADATA}` or `{TIMESTAMP}`

#### **2. Data Access Patterns**
```typescript
// Get user by ID
PK: "USER#123"
SK: "PROFILE"

// List projects by client
GSI1PK: "CLIENT#456"
GSI1SK: "PROJECT#"

// Time entries by date range
GSI2PK: "USER#123"
GSI2SK: "2025-01-15T10:00:00Z"
```

#### **3. DynamoDB Operations**
```typescript
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

// Get item
const getUser = async (userId: string) => {
  const command = new GetItemCommand({
    TableName: process.env.MAIN_TABLE_NAME,
    Key: {
      PK: { S: `USER#${userId}` },
      SK: { S: 'PROFILE' },
    },
  });

  const result = await client.send(command);
  return result.Item;
};

// Put item
const createUser = async (userData: any) => {
  const command = new PutItemCommand({
    TableName: process.env.MAIN_TABLE_NAME,
    Item: {
      PK: { S: `USER#${userData.id}` },
      SK: { S: 'PROFILE' },
      email: { S: userData.email },
      name: { S: userData.name },
      createdAt: { S: new Date().toISOString() },
    },
  });

  await client.send(command);
};
```

## 🔐 **Authentication Development**

### **Cognito Integration**

#### **1. JWT Token Validation**
```typescript
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`,
});

const getKey = (header: any, callback: any) => {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
};

export const validateToken = (token: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}`,
      algorithms: ['RS256'],
    }, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
};
```

#### **2. Role-Based Access Control**
```typescript
export const hasPermission = (user: any, permission: string): boolean => {
  const userGroups = user['cognito:groups'] || [];
  
  const permissions = {
    admin: ['*'],
    manager: ['users:read', 'projects:*', 'teams:*'],
    employee: ['time-entries:*', 'projects:read'],
  };

  return userGroups.some((group: string) => {
    const groupPermissions = permissions[group as keyof typeof permissions] || [];
    return groupPermissions.includes('*') || groupPermissions.includes(permission);
  });
};
```

## 📊 **Monitoring & Logging**

### **CloudWatch Logging**
```typescript
// Structured logging
const log = (level: string, message: string, metadata?: any) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId: process.env.AWS_REQUEST_ID,
    ...metadata,
  }));
};

// Usage
log('INFO', 'Processing time entry', { userId: '123', entryId: '456' });
log('ERROR', 'Database operation failed', { error: error.message });
```

### **Custom Metrics**
```typescript
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatch({ region: process.env.AWS_REGION });

const publishMetric = async (metricName: string, value: number, unit = 'Count') => {
  await cloudwatch.putMetricData({
    Namespace: 'AerotageTimeAPI',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
    }],
  });
};
```

## 🧪 **Testing**

### **Unit Testing**
```typescript
// tests/handlers/time-entries.test.ts
import { handler } from '../../infrastructure/lambda/time-entries/create';

describe('Time Entries Handler', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  test('should create time entry successfully', async () => {
    const event = mockApiGatewayEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        projectId: 'project-123',
        description: 'Test work',
        hours: 2.5,
      }),
    });

    const result = await handler(event, mockLambdaContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      success: true,
      data: expect.any(Object),
    });
  });

  test('should handle validation errors', async () => {
    const event = mockApiGatewayEvent({
      httpMethod: 'POST',
      body: JSON.stringify({}), // Invalid body
    });

    const result = await handler(event, mockLambdaContext);

    expect(result.statusCode).toBe(400);
  });
});
```

### **Integration Testing**
```typescript
// tests/integration/api.test.ts
import AWS from 'aws-sdk';

describe('API Integration Tests', () => {
  let apigateway: AWS.APIGateway;
  let dynamodb: AWS.DynamoDB;

  beforeAll(() => {
    apigateway = new AWS.APIGateway({ region: 'us-east-1' });
    dynamodb = new AWS.DynamoDB({ region: 'us-east-1' });
  });

  test('should handle full time entry workflow', async () => {
    // Test complete CRUD operations
    // 1. Create time entry
    // 2. Read time entry
    // 3. Update time entry
    // 4. Delete time entry
  });
});
```

## 🚀 **Deployment**

### **Environment Management**

#### **Development Environment**
```bash
# Deploy all stacks
npm run deploy:dev

# Deploy specific stack
cd infrastructure
cdk deploy AerotageAPI-dev --profile aerotage-dev
```

#### **Staging Environment**
```bash
# Deploy to staging
npm run deploy:staging

# Run integration tests against staging
npm run test:integration:staging
```

#### **Production Deployment**
```bash
# Deploy to production (requires additional approval)
npm run deploy:prod

# Monitor deployment
aws cloudwatch get-dashboard --dashboard-name AerotageTimeAPI-prod
```

### **Rollback Strategy**
```bash
# View deployment history
aws cloudformation describe-stack-events --stack-name AerotageAPI-prod

# Rollback to previous version
cdk deploy AerotageAPI-prod --rollback
```

## 📚 **Additional Resources**

### **AWS Documentation**
- [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [DynamoDB Developer Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/)
- [API Gateway Developer Guide](https://docs.aws.amazon.com/apigateway/latest/developerguide/)

### **Development Tools**
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) - For local testing
- [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) - For local database testing
- [LocalStack](https://localstack.cloud/) - For local AWS service emulation

### **Troubleshooting**

#### **Common Issues**
1. **CDK Bootstrap Issues**: Ensure CDK is bootstrapped in target region
2. **Permission Errors**: Verify IAM roles have necessary permissions
3. **Lambda Timeouts**: Check function memory and timeout configurations
4. **DynamoDB Throttling**: Monitor read/write capacity usage

#### **Debugging Commands**
```bash
# View CloudWatch logs
aws logs tail /aws/lambda/function-name --follow

# Check API Gateway logs
aws logs describe-log-groups --log-group-name-prefix API-Gateway

# Monitor DynamoDB metrics
aws cloudwatch get-metric-statistics --namespace AWS/DynamoDB
```

---

This development guide provides everything needed to work effectively with the Aerotage Time Reporting API backend infrastructure. 