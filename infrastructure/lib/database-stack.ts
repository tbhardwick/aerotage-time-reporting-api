import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  stage: string;
}

export interface DatabaseTables {
  usersTable: dynamodb.Table;
  teamsTable: dynamodb.Table;
  projectsTable: dynamodb.Table;
  clientsTable: dynamodb.Table;
  timeEntriesTable: dynamodb.Table;
  invoicesTable: dynamodb.Table;
  userSessionsTable: dynamodb.Table;
  userActivityTable: dynamodb.Table;
  userInvitationsTable: dynamodb.Table;
}

export class DatabaseStack extends cdk.Stack {
  public readonly tables: DatabaseTables;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // Users Table
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `aerotage-users-${stage}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for email lookup
    usersTable.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for team lookup
    usersTable.addGlobalSecondaryIndex({
      indexName: 'TeamIndex',
      partitionKey: { name: 'teamId', type: dynamodb.AttributeType.STRING },
    });

    // Teams Table
    const teamsTable = new dynamodb.Table(this, 'TeamsTable', {
      tableName: `aerotage-teams-${stage}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for manager lookup
    teamsTable.addGlobalSecondaryIndex({
      indexName: 'ManagerIndex',
      partitionKey: { name: 'managerId', type: dynamodb.AttributeType.STRING },
    });

    // Projects Table
    const projectsTable = new dynamodb.Table(this, 'ProjectsTable', {
      tableName: `aerotage-projects-${stage}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for client lookup
    projectsTable.addGlobalSecondaryIndex({
      indexName: 'ClientIndex',
      partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for status lookup
    projectsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
    });

    // Clients Table
    const clientsTable = new dynamodb.Table(this, 'ClientsTable', {
      tableName: `aerotage-clients-${stage}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for status lookup
    clientsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'isActive', type: dynamodb.AttributeType.STRING },
    });

    // Time Entries Table
    const timeEntriesTable = new dynamodb.Table(this, 'TimeEntriesTable', {
      tableName: `aerotage-time-entries-${stage}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for user lookup
    timeEntriesTable.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for project lookup
    timeEntriesTable.addGlobalSecondaryIndex({
      indexName: 'ProjectIndex',
      partitionKey: { name: 'projectId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for status lookup
    timeEntriesTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for approval workflow
    timeEntriesTable.addGlobalSecondaryIndex({
      indexName: 'ApprovalIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'submittedAt', type: dynamodb.AttributeType.STRING },
    });

    // Invoices Table
    const invoicesTable = new dynamodb.Table(this, 'InvoicesTable', {
      tableName: `aerotage-invoices-${stage}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for client lookup
    invoicesTable.addGlobalSecondaryIndex({
      indexName: 'ClientIndex',
      partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'issueDate', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for status lookup
    invoicesTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dueDate', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for invoice number lookup
    invoicesTable.addGlobalSecondaryIndex({
      indexName: 'InvoiceNumberIndex',
      partitionKey: { name: 'invoiceNumber', type: dynamodb.AttributeType.STRING },
    });

    // User Sessions Table
    const userSessionsTable = new dynamodb.Table(this, 'UserSessionsTable', {
      tableName: `aerotage-user-sessions-${stage}`,
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for user lookup
    userSessionsTable.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // User Activity Table
    const userActivityTable = new dynamodb.Table(this, 'UserActivityTable', {
      tableName: `aerotage-user-activity-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'expiresAt', // Auto-delete old activity records
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for activity type lookup
    userActivityTable.addGlobalSecondaryIndex({
      indexName: 'ActivityTypeIndex',
      partitionKey: { name: 'activityType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // User Invitations Table
    const userInvitationsTable = new dynamodb.Table(this, 'UserInvitationsTable', {
      tableName: `aerotage-user-invitations-${stage}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for secure token lookup (most critical for functionality)
    userInvitationsTable.addGlobalSecondaryIndex({
      indexName: 'TokenHashIndexV2',
      partitionKey: { name: 'tokenHash', type: dynamodb.AttributeType.STRING },
    });

    // TODO: Will add EmailIndexV2 and StatusIndexV2 in subsequent deployment
    // to work around CloudFormation's "one GSI per update" limitation

    // Store all tables for easy access
    this.tables = {
      usersTable,
      teamsTable,
      projectsTable,
      clientsTable,
      timeEntriesTable,
      invoicesTable,
      userSessionsTable,
      userActivityTable,
      userInvitationsTable,
    };

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: usersTable.tableName,
      description: 'Users DynamoDB Table Name',
      exportName: `UsersTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'TeamsTableName', {
      value: teamsTable.tableName,
      description: 'Teams DynamoDB Table Name',
      exportName: `TeamsTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'ProjectsTableName', {
      value: projectsTable.tableName,
      description: 'Projects DynamoDB Table Name',
      exportName: `ProjectsTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'ClientsTableName', {
      value: clientsTable.tableName,
      description: 'Clients DynamoDB Table Name',
      exportName: `ClientsTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'TimeEntriesTableName', {
      value: timeEntriesTable.tableName,
      description: 'Time Entries DynamoDB Table Name',
      exportName: `TimeEntriesTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'InvoicesTableName', {
      value: invoicesTable.tableName,
      description: 'Invoices DynamoDB Table Name',
      exportName: `InvoicesTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'UserSessionsTableName', {
      value: userSessionsTable.tableName,
      description: 'User Sessions DynamoDB Table Name',
      exportName: `UserSessionsTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'UserActivityTableName', {
      value: userActivityTable.tableName,
      description: 'User Activity DynamoDB Table Name',
      exportName: `UserActivityTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'UserInvitationsTableName', {
      value: userInvitationsTable.tableName,
      description: 'User Invitations DynamoDB Table Name',
      exportName: `UserInvitationsTableName-${stage}`,
    });
  }
} 