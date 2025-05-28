#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
var cdk = require("aws-cdk-lib");
var cognito_stack_1 = require("../lib/cognito-stack");
var database_stack_1 = require("../lib/database-stack");
var ses_stack_1 = require("../lib/ses-stack");
var api_stack_1 = require("../lib/api-stack");
var storage_stack_1 = require("../lib/storage-stack");
var monitoring_stack_1 = require("../lib/monitoring-stack");
var documentation_stack_1 = require("../lib/documentation-stack");
var domain_stack_1 = require("../lib/domain-stack");
var app = new cdk.App();
// Get environment variables
var stage = process.env.STAGE || 'dev';
var region = process.env.AWS_REGION || 'us-east-1';
var account = process.env.CDK_DEFAULT_ACCOUNT;
var env = {
    account: account,
    region: region,
};
// Tags applied to all resources
var commonTags = {
    Project: 'AerotageTimeReporting',
    Environment: stage,
    ManagedBy: 'CDK',
    Application: 'aerotage-time-api',
    PasswordResetEnabled: 'true',
    UserInvitationsEnabled: 'true',
};
// Authentication Stack (Cognito)
var cognitoStack = new cognito_stack_1.CognitoStack(app, "AerotageAuth-".concat(stage), {
    stage: stage,
    env: env,
    tags: commonTags,
});
// Database Stack (DynamoDB)
var databaseStack = new database_stack_1.DatabaseStack(app, "AerotageDB-".concat(stage), {
    stage: stage,
    env: env,
    tags: commonTags,
});
// Email Service Stack (SES)
var sesStack = new ses_stack_1.SesStack(app, "AerotageSES-".concat(stage), {
    stage: stage,
    env: env,
    tags: commonTags,
});
// Storage Stack (S3)
var storageStack = new storage_stack_1.StorageStack(app, "AerotageStorage-".concat(stage), {
    stage: stage,
    env: env,
    tags: commonTags,
});
// API Stack (API Gateway + Lambda)
var apiStack = new api_stack_1.ApiStack(app, "AerotageAPI-".concat(stage), {
    stage: stage,
    userPool: cognitoStack.userPool,
    userPoolClient: cognitoStack.userPoolClient,
    tables: databaseStack.tables,
    storageBucket: storageStack.storageBucket,
    sesStack: sesStack,
    env: env,
    tags: commonTags,
});
// Custom Domain Stack (Route 53 + Certificate Manager + API Gateway Custom Domain)
var domainStack = new domain_stack_1.DomainStack(app, "AerotageDomain-".concat(stage), {
    stage: stage,
    hostedZoneName: 'aerotage.com',
    restApi: apiStack.api,
    apiGatewayStage: stage,
    env: env,
    tags: commonTags,
});
// Documentation Stack (S3 + CloudFront for Swagger UI)
var documentationStack = new documentation_stack_1.DocumentationStack(app, "AerotageDocumentation-".concat(stage), {
    stage: stage,
    apiGatewayUrl: apiStack.api.url,
    env: env,
    tags: commonTags,
});
// Monitoring Stack (CloudWatch)
var monitoringStack = new monitoring_stack_1.MonitoringStack(app, "AerotageMonitoring-".concat(stage), {
    stage: stage,
    apiGateway: apiStack.api,
    lambdaFunctions: apiStack.lambdaFunctions,
    dynamoDbTables: databaseStack.tables,
    cognitoPasswordResetAlarm: cognitoStack.passwordResetAlarm,
    env: env,
    tags: commonTags,
});
// Add dependencies
apiStack.addDependency(cognitoStack);
apiStack.addDependency(databaseStack);
apiStack.addDependency(storageStack);
apiStack.addDependency(sesStack);
domainStack.addDependency(apiStack);
documentationStack.addDependency(apiStack);
monitoringStack.addDependency(apiStack);
monitoringStack.addDependency(databaseStack);
monitoringStack.addDependency(cognitoStack);
