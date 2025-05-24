#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from '../lib/cognito-stack';
import { DatabaseStack } from '../lib/database-stack';
import { SesStack } from '../lib/ses-stack';
import { ApiStack } from '../lib/api-stack';
import { StorageStack } from '../lib/storage-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();

// Get environment variables
const stage = process.env.STAGE || 'dev';
const region = process.env.AWS_REGION || 'us-east-1';
const account = process.env.CDK_DEFAULT_ACCOUNT;

const env = {
  account,
  region,
};

// Tags applied to all resources
const commonTags = {
  Project: 'AerotageTimeReporting',
  Environment: stage,
  ManagedBy: 'CDK',
  Application: 'aerotage-time-api',
  PasswordResetEnabled: 'true',
  UserInvitationsEnabled: 'true',
};

// Authentication Stack (Cognito)
const cognitoStack = new CognitoStack(app, `AerotageAuth-${stage}`, {
  stage,
  env,
  tags: commonTags,
});

// Database Stack (DynamoDB)
const databaseStack = new DatabaseStack(app, `AerotageDB-${stage}`, {
  stage,
  env,
  tags: commonTags,
});

// Email Service Stack (SES)
const sesStack = new SesStack(app, `AerotageSES-${stage}`, {
  stage,
  env,
  tags: commonTags,
});

// Storage Stack (S3)
const storageStack = new StorageStack(app, `AerotageStorage-${stage}`, {
  stage,
  env,
  tags: commonTags,
});

// API Stack (API Gateway + Lambda)
const apiStack = new ApiStack(app, `AerotageAPI-${stage}`, {
  stage,
  userPool: cognitoStack.userPool,
  userPoolClient: cognitoStack.userPoolClient,
  tables: databaseStack.tables,
  storageBucket: storageStack.storageBucket,
  sesStack: sesStack,
  env,
  tags: commonTags,
});

// Monitoring Stack (CloudWatch)
const monitoringStack = new MonitoringStack(app, `AerotageMonitoring-${stage}`, {
  stage,
  apiGateway: apiStack.api,
  lambdaFunctions: apiStack.lambdaFunctions,
  dynamoDbTables: databaseStack.tables,
  cognitoPasswordResetAlarm: cognitoStack.passwordResetAlarm,
  env,
  tags: commonTags,
});

// Add dependencies
apiStack.addDependency(cognitoStack);
apiStack.addDependency(databaseStack);
apiStack.addDependency(storageStack);
apiStack.addDependency(sesStack);
monitoringStack.addDependency(apiStack);
monitoringStack.addDependency(databaseStack);
monitoringStack.addDependency(cognitoStack); 