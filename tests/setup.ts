// Jest setup file for backend tests

// Mock AWS SDK clients for testing
const mockDynamoDBClient = {
  send: jest.fn(),
};

const mockCognitoClient = {
  send: jest.fn(),
};

const mockS3Client = {
  send: jest.fn(),
};

// Mock AWS SDK modules
jest.doMock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => mockDynamoDBClient),
  GetItemCommand: jest.fn(),
  PutItemCommand: jest.fn(),
  UpdateItemCommand: jest.fn(),
  DeleteItemCommand: jest.fn(),
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn(),
}));

jest.doMock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(() => mockCognitoClient),
  AdminGetUserCommand: jest.fn(),
  AdminCreateUserCommand: jest.fn(),
  AdminUpdateUserAttributesCommand: jest.fn(),
  AdminDeleteUserCommand: jest.fn(),
}));

jest.doMock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => mockS3Client),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

// Global test utilities
declare global {
  // eslint-disable-next-line no-var
  var mockApiGatewayEvent: (options?: any) => any;
  // eslint-disable-next-line no-var
  var mockLambdaContext: any;
}

global.mockApiGatewayEvent = (options: any = {}) => ({
  httpMethod: options.httpMethod || 'GET',
  path: options.path || '/',
  headers: options.headers || {},
  queryStringParameters: options.queryStringParameters || null,
  pathParameters: options.pathParameters || null,
  body: options.body || null,
  requestContext: {
    authorizer: options.authorizer || null,
    requestId: 'test-request-id',
    ...options.requestContext,
  },
  ...options,
});

global.mockLambdaContext = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2023/01/01/[LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
};

// Console override for tests
const originalConsole = console;
global.console = {
  ...originalConsole,
  // Keep console.error and console.warn for debugging
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
}); 