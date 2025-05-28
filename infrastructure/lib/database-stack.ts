import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  stage: string;
}

export interface DatabaseTables {
  usersTable: dynamodb.Table;
  teamsTable: dynamodb.Table; // Keep for backward compatibility in dev
  projectsTable: dynamodb.Table;
  clientsTable: dynamodb.Table;
  timeEntriesTable: dynamodb.Table;
  invoicesTable: dynamodb.Table;
  invoiceTemplatesTable: dynamodb.Table; // ✅ NEW - Phase 7 Invoice Templates
  paymentsTable: dynamodb.Table; // ✅ NEW - Phase 7 Payment Tracking
  userSessionsTable: dynamodb.Table;
  userActivityTable: dynamodb.Table;
  userInvitationsTable: dynamodb.Table;
  userPreferencesTable: dynamodb.Table;
  userSecuritySettingsTable: dynamodb.Table;
  userNotificationSettingsTable: dynamodb.Table;
  passwordHistoryTable: dynamodb.Table;
  // ✅ NEW - Phase 6 Reporting & Analytics Tables
  reportConfigsTable: dynamodb.Table;
  reportCacheTable: dynamodb.Table;
  analyticsEventsTable: dynamodb.Table;
  scheduledReportsTable: dynamodb.Table;
  // ✅ NEW - Daily/Weekly Time Tracking Tables
  userWorkSchedulesTable: dynamodb.Table;
  // ✅ NEW - Phase 8 Email Change Tables
  emailChangeRequestsTable: dynamodb.Table;
  emailChangeAuditLogTable: dynamodb.Table;
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

    // Teams Table (DEPRECATED - kept for backward compatibility in dev)
    const teamsTable = new dynamodb.Table(this, 'TeamsTable', {
      tableName: `aerotage-teams-${stage}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for manager lookup (DEPRECATED)
    teamsTable.addGlobalSecondaryIndex({
      indexName: 'ManagerIndex',
      partitionKey: { name: 'managerId', type: dynamodb.AttributeType.STRING },
    });

    // Projects Table
    // ✅ Phase 6 Enhancement: Will include performance metrics (efficiencyRating, budgetVariance, performanceMetrics)
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
    // ✅ Phase 6 Enhancement: Will include analytics fields (productivityScore, complexityRating, reportingPeriod)
    const timeEntriesTable = new dynamodb.Table(this, 'TimeEntriesTable', {
      tableName: `aerotage-time-entries-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for user lookup
    timeEntriesTable.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for project lookup
    timeEntriesTable.addGlobalSecondaryIndex({
      indexName: 'ProjectIndex',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for status lookup
    timeEntriesTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for approval workflow
    timeEntriesTable.addGlobalSecondaryIndex({
      indexName: 'ApprovalIndex',
      partitionKey: { name: 'GSI4PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI4SK', type: dynamodb.AttributeType.STRING },
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

    // ✅ NEW - Phase 7: Invoice Templates Table
    const invoiceTemplatesTable = new dynamodb.Table(this, 'InvoiceTemplatesTable', {
      tableName: `aerotage-invoice-templates-${stage}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for template type lookup
    invoiceTemplatesTable.addGlobalSecondaryIndex({
      indexName: 'TemplateTypeIndex',
      partitionKey: { name: 'templateType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'name', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for active templates lookup
    invoiceTemplatesTable.addGlobalSecondaryIndex({
      indexName: 'ActiveIndex',
      partitionKey: { name: 'isActive', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // ✅ NEW - Phase 7: Payments Table
    const paymentsTable = new dynamodb.Table(this, 'PaymentsTable', {
      tableName: `aerotage-payments-${stage}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for invoice lookup
    paymentsTable.addGlobalSecondaryIndex({
      indexName: 'InvoiceIndex',
      partitionKey: { name: 'invoiceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'paymentDate', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for status lookup
    paymentsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'paymentDate', type: dynamodb.AttributeType.STRING },
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

    // User Preferences Table
    // ✅ Phase 6 Enhancement: Will include reporting preferences (reportingPreferences, dashboardConfig)
    const userPreferencesTable = new dynamodb.Table(this, 'UserPreferencesTable', {
      tableName: `aerotage-user-preferences-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // User Security Settings Table
    const userSecuritySettingsTable = new dynamodb.Table(this, 'UserSecuritySettingsTable', {
      tableName: `aerotage-user-security-settings-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // User Notification Settings Table
    const userNotificationSettingsTable = new dynamodb.Table(this, 'UserNotificationSettingsTable', {
      tableName: `aerotage-user-notification-settings-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Password History Table
    const passwordHistoryTable = new dynamodb.Table(this, 'PasswordHistoryTable', {
      tableName: `aerotage-password-history-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'expiresAt', // Auto-delete old password history
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ✅ NEW - Phase 6: Report Configurations Table
    const reportConfigsTable = new dynamodb.Table(this, 'ReportConfigsTable', {
      tableName: `aerotage-report-configs-${stage}`,
      partitionKey: { name: 'reportId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for user lookup
    reportConfigsTable.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for report type lookup
    reportConfigsTable.addGlobalSecondaryIndex({
      indexName: 'ReportTypeIndex',
      partitionKey: { name: 'reportType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // ✅ NEW - Phase 6: Report Cache Table
    const reportCacheTable = new dynamodb.Table(this, 'ReportCacheTable', {
      tableName: `aerotage-report-cache-${stage}`,
      partitionKey: { name: 'cacheKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'expiresAt', // Auto-delete expired cache entries
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for report type lookup
    reportCacheTable.addGlobalSecondaryIndex({
      indexName: 'ReportTypeIndex',
      partitionKey: { name: 'reportType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'generatedAt', type: dynamodb.AttributeType.STRING },
    });

    // ✅ NEW - Phase 6: Analytics Events Table
    const analyticsEventsTable = new dynamodb.Table(this, 'AnalyticsEventsTable', {
      tableName: `aerotage-analytics-events-${stage}`,
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'expiresAt', // Auto-delete old analytics events (90 days)
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for user-timestamp lookup (most common query pattern)
    analyticsEventsTable.addGlobalSecondaryIndex({
      indexName: 'UserTimestampIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for event type-timestamp lookup (for analytics aggregation)
    analyticsEventsTable.addGlobalSecondaryIndex({
      indexName: 'EventTypeTimestampIndex',
      partitionKey: { name: 'eventType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // ✅ NEW - Phase 6: Scheduled Reports Table
    const scheduledReportsTable = new dynamodb.Table(this, 'ScheduledReportsTable', {
      tableName: `aerotage-scheduled-reports-${stage}`,
      partitionKey: { name: 'scheduleId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for user lookup
    scheduledReportsTable.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // Note: GSI for next run lookup will be added in a separate deployment
    // due to DynamoDB's limitation of one GSI change per update

    // ✅ NEW - Daily/Weekly Time Tracking: User Work Schedules Table
    const userWorkSchedulesTable = new dynamodb.Table(this, 'UserWorkSchedulesTable', {
      tableName: `aerotage-user-work-schedules-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // "USER#{userId}"
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // "WORK_SCHEDULE"
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ✅ NEW - Phase 8 Email Change Tables
    const emailChangeRequestsTable = new dynamodb.Table(this, 'EmailChangeRequestsTable', {
      tableName: `aerotage-email-change-requests-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for user lookup
    emailChangeRequestsTable.addGlobalSecondaryIndex({
      indexName: 'UserIndexV2',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for status lookup
    emailChangeRequestsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndexV2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for verification token lookup
    emailChangeRequestsTable.addGlobalSecondaryIndex({
      indexName: 'VerificationTokenIndexV2',
      partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for new email verification token lookup
    emailChangeRequestsTable.addGlobalSecondaryIndex({
      indexName: 'NewEmailVerificationTokenIndexV2',
      partitionKey: { name: 'GSI4PK', type: dynamodb.AttributeType.STRING },
    });

    const emailChangeAuditLogTable = new dynamodb.Table(this, 'EmailChangeAuditLogTable', {
      tableName: `aerotage-email-change-audit-log-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for request lookup
    emailChangeAuditLogTable.addGlobalSecondaryIndex({
      indexName: 'RequestIndexV2',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for action lookup
    emailChangeAuditLogTable.addGlobalSecondaryIndex({
      indexName: 'ActionIndexV2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
    });

    // Store all tables for easy access
    this.tables = {
      usersTable,
      teamsTable, // DEPRECATED - kept for backward compatibility
      projectsTable,
      clientsTable,
      timeEntriesTable,
      invoicesTable,
      invoiceTemplatesTable, // ✅ NEW - Phase 7 Invoice Templates
      paymentsTable, // ✅ NEW - Phase 7 Payment Tracking
      userSessionsTable,
      userActivityTable,
      userInvitationsTable,
      userPreferencesTable,
      userSecuritySettingsTable,
      userNotificationSettingsTable,
      passwordHistoryTable,
      // ✅ NEW - Phase 6 Reporting & Analytics Tables
      reportConfigsTable,
      reportCacheTable,
      analyticsEventsTable,
      scheduledReportsTable,
      // ✅ NEW - Daily/Weekly Time Tracking Tables
      userWorkSchedulesTable,
      // ✅ NEW - Phase 8 Email Change Tables
      emailChangeRequestsTable,
      emailChangeAuditLogTable,
    };

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: usersTable.tableName,
      description: 'Users DynamoDB Table Name',
      exportName: `UsersTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'TeamsTableName', {
      value: teamsTable.tableName,
      description: 'Teams DynamoDB Table Name (DEPRECATED)',
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

    new cdk.CfnOutput(this, 'InvoiceTemplatesTableName', {
      value: invoiceTemplatesTable.tableName,
      description: 'Invoice Templates DynamoDB Table Name',
      exportName: `InvoiceTemplatesTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'PaymentsTableName', {
      value: paymentsTable.tableName,
      description: 'Payments DynamoDB Table Name',
      exportName: `PaymentsTableName-${stage}`,
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

    new cdk.CfnOutput(this, 'UserPreferencesTableName', {
      value: userPreferencesTable.tableName,
      description: 'User Preferences DynamoDB Table Name',
      exportName: `UserPreferencesTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'UserSecuritySettingsTableName', {
      value: userSecuritySettingsTable.tableName,
      description: 'User Security Settings DynamoDB Table Name',
      exportName: `UserSecuritySettingsTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'UserNotificationSettingsTableName', {
      value: userNotificationSettingsTable.tableName,
      description: 'User Notification Settings DynamoDB Table Name',
      exportName: `UserNotificationSettingsTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'PasswordHistoryTableName', {
      value: passwordHistoryTable.tableName,
      description: 'Password History DynamoDB Table Name',
      exportName: `PasswordHistoryTableName-${stage}`,
    });

    // ✅ NEW - Phase 6 CloudFormation Outputs
    new cdk.CfnOutput(this, 'ReportConfigsTableName', {
      value: reportConfigsTable.tableName,
      description: 'Report Configurations DynamoDB Table Name',
      exportName: `ReportConfigsTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'ReportCacheTableName', {
      value: reportCacheTable.tableName,
      description: 'Report Cache DynamoDB Table Name',
      exportName: `ReportCacheTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'AnalyticsEventsTableName', {
      value: analyticsEventsTable.tableName,
      description: 'Analytics Events DynamoDB Table Name',
      exportName: `AnalyticsEventsTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'ScheduledReportsTableName', {
      value: scheduledReportsTable.tableName,
      description: 'Scheduled Reports DynamoDB Table Name',
      exportName: `ScheduledReportsTableName-${stage}`,
    });

    // ✅ NEW - Daily/Weekly Time Tracking CloudFormation Outputs
    new cdk.CfnOutput(this, 'UserWorkSchedulesTableName', {
      value: userWorkSchedulesTable.tableName,
      description: 'User Work Schedules DynamoDB Table Name',
      exportName: `UserWorkSchedulesTableName-${stage}`,
    });

    // ✅ NEW - Phase 8 Email Change CloudFormation Outputs
    new cdk.CfnOutput(this, 'EmailChangeRequestsTableName', {
      value: emailChangeRequestsTable.tableName,
      description: 'Email Change Requests DynamoDB Table Name',
      exportName: `EmailChangeRequestsTableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'EmailChangeAuditLogTableName', {
      value: emailChangeAuditLogTable.tableName,
      description: 'Email Change Audit Log DynamoDB Table Name',
      exportName: `EmailChangeAuditLogTableName-${stage}`,
    });
  }
} 