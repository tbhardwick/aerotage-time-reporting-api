"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseStack = void 0;
var cdk = require("aws-cdk-lib");
var dynamodb = require("aws-cdk-lib/aws-dynamodb");
var DatabaseStack = /** @class */ (function (_super) {
    __extends(DatabaseStack, _super);
    function DatabaseStack(scope, id, props) {
        var _this = _super.call(this, scope, id, props) || this;
        var stage = props.stage;
        // Users Table
        var usersTable = new dynamodb.Table(_this, 'UsersTable', {
            tableName: "aerotage-users-".concat(stage),
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
        var teamsTable = new dynamodb.Table(_this, 'TeamsTable', {
            tableName: "aerotage-teams-".concat(stage),
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
        var projectsTable = new dynamodb.Table(_this, 'ProjectsTable', {
            tableName: "aerotage-projects-".concat(stage),
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
        var clientsTable = new dynamodb.Table(_this, 'ClientsTable', {
            tableName: "aerotage-clients-".concat(stage),
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
        var timeEntriesTable = new dynamodb.Table(_this, 'TimeEntriesTable', {
            tableName: "aerotage-time-entries-".concat(stage),
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
        var invoicesTable = new dynamodb.Table(_this, 'InvoicesTable', {
            tableName: "aerotage-invoices-".concat(stage),
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
        var invoiceTemplatesTable = new dynamodb.Table(_this, 'InvoiceTemplatesTable', {
            tableName: "aerotage-invoice-templates-".concat(stage),
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
        var paymentsTable = new dynamodb.Table(_this, 'PaymentsTable', {
            tableName: "aerotage-payments-".concat(stage),
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
        var userSessionsTable = new dynamodb.Table(_this, 'UserSessionsTable', {
            tableName: "aerotage-user-sessions-".concat(stage),
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
        var userActivityTable = new dynamodb.Table(_this, 'UserActivityTable', {
            tableName: "aerotage-user-activity-".concat(stage),
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
        var userInvitationsTable = new dynamodb.Table(_this, 'UserInvitationsTable', {
            tableName: "aerotage-user-invitations-".concat(stage),
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
        var userPreferencesTable = new dynamodb.Table(_this, 'UserPreferencesTable', {
            tableName: "aerotage-user-preferences-".concat(stage),
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: stage === 'prod',
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // User Security Settings Table
        var userSecuritySettingsTable = new dynamodb.Table(_this, 'UserSecuritySettingsTable', {
            tableName: "aerotage-user-security-settings-".concat(stage),
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: stage === 'prod',
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // User Notification Settings Table
        var userNotificationSettingsTable = new dynamodb.Table(_this, 'UserNotificationSettingsTable', {
            tableName: "aerotage-user-notification-settings-".concat(stage),
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: stage === 'prod',
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Password History Table
        var passwordHistoryTable = new dynamodb.Table(_this, 'PasswordHistoryTable', {
            tableName: "aerotage-password-history-".concat(stage),
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            timeToLiveAttribute: 'expiresAt', // Auto-delete old password history
            pointInTimeRecovery: stage === 'prod',
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // ✅ NEW - Phase 6: Report Configurations Table
        var reportConfigsTable = new dynamodb.Table(_this, 'ReportConfigsTable', {
            tableName: "aerotage-report-configs-".concat(stage),
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
        var reportCacheTable = new dynamodb.Table(_this, 'ReportCacheTable', {
            tableName: "aerotage-report-cache-".concat(stage),
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
        var analyticsEventsTable = new dynamodb.Table(_this, 'AnalyticsEventsTable', {
            tableName: "aerotage-analytics-events-".concat(stage),
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
        var scheduledReportsTable = new dynamodb.Table(_this, 'ScheduledReportsTable', {
            tableName: "aerotage-scheduled-reports-".concat(stage),
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
        var userWorkSchedulesTable = new dynamodb.Table(_this, 'UserWorkSchedulesTable', {
            tableName: "aerotage-user-work-schedules-".concat(stage),
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // "USER#{userId}"
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // "WORK_SCHEDULE"
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: stage === 'prod',
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Store all tables for easy access
        _this.tables = {
            usersTable: usersTable,
            teamsTable: teamsTable, // DEPRECATED - kept for backward compatibility
            projectsTable: projectsTable,
            clientsTable: clientsTable,
            timeEntriesTable: timeEntriesTable,
            invoicesTable: invoicesTable,
            invoiceTemplatesTable: invoiceTemplatesTable, // ✅ NEW - Phase 7 Invoice Templates
            paymentsTable: paymentsTable, // ✅ NEW - Phase 7 Payment Tracking
            userSessionsTable: userSessionsTable,
            userActivityTable: userActivityTable,
            userInvitationsTable: userInvitationsTable,
            userPreferencesTable: userPreferencesTable,
            userSecuritySettingsTable: userSecuritySettingsTable,
            userNotificationSettingsTable: userNotificationSettingsTable,
            passwordHistoryTable: passwordHistoryTable,
            // ✅ NEW - Phase 6 Reporting & Analytics Tables
            reportConfigsTable: reportConfigsTable,
            reportCacheTable: reportCacheTable,
            analyticsEventsTable: analyticsEventsTable,
            scheduledReportsTable: scheduledReportsTable,
            // ✅ NEW - Daily/Weekly Time Tracking Tables
            userWorkSchedulesTable: userWorkSchedulesTable,
        };
        // CloudFormation Outputs
        new cdk.CfnOutput(_this, 'UsersTableName', {
            value: usersTable.tableName,
            description: 'Users DynamoDB Table Name',
            exportName: "UsersTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'TeamsTableName', {
            value: teamsTable.tableName,
            description: 'Teams DynamoDB Table Name (DEPRECATED)',
            exportName: "TeamsTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'ProjectsTableName', {
            value: projectsTable.tableName,
            description: 'Projects DynamoDB Table Name',
            exportName: "ProjectsTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'ClientsTableName', {
            value: clientsTable.tableName,
            description: 'Clients DynamoDB Table Name',
            exportName: "ClientsTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'TimeEntriesTableName', {
            value: timeEntriesTable.tableName,
            description: 'Time Entries DynamoDB Table Name',
            exportName: "TimeEntriesTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'InvoicesTableName', {
            value: invoicesTable.tableName,
            description: 'Invoices DynamoDB Table Name',
            exportName: "InvoicesTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'InvoiceTemplatesTableName', {
            value: invoiceTemplatesTable.tableName,
            description: 'Invoice Templates DynamoDB Table Name',
            exportName: "InvoiceTemplatesTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'PaymentsTableName', {
            value: paymentsTable.tableName,
            description: 'Payments DynamoDB Table Name',
            exportName: "PaymentsTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'UserSessionsTableName', {
            value: userSessionsTable.tableName,
            description: 'User Sessions DynamoDB Table Name',
            exportName: "UserSessionsTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'UserActivityTableName', {
            value: userActivityTable.tableName,
            description: 'User Activity DynamoDB Table Name',
            exportName: "UserActivityTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'UserInvitationsTableName', {
            value: userInvitationsTable.tableName,
            description: 'User Invitations DynamoDB Table Name',
            exportName: "UserInvitationsTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'UserPreferencesTableName', {
            value: userPreferencesTable.tableName,
            description: 'User Preferences DynamoDB Table Name',
            exportName: "UserPreferencesTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'UserSecuritySettingsTableName', {
            value: userSecuritySettingsTable.tableName,
            description: 'User Security Settings DynamoDB Table Name',
            exportName: "UserSecuritySettingsTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'UserNotificationSettingsTableName', {
            value: userNotificationSettingsTable.tableName,
            description: 'User Notification Settings DynamoDB Table Name',
            exportName: "UserNotificationSettingsTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'PasswordHistoryTableName', {
            value: passwordHistoryTable.tableName,
            description: 'Password History DynamoDB Table Name',
            exportName: "PasswordHistoryTableName-".concat(stage),
        });
        // ✅ NEW - Phase 6 CloudFormation Outputs
        new cdk.CfnOutput(_this, 'ReportConfigsTableName', {
            value: reportConfigsTable.tableName,
            description: 'Report Configurations DynamoDB Table Name',
            exportName: "ReportConfigsTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'ReportCacheTableName', {
            value: reportCacheTable.tableName,
            description: 'Report Cache DynamoDB Table Name',
            exportName: "ReportCacheTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'AnalyticsEventsTableName', {
            value: analyticsEventsTable.tableName,
            description: 'Analytics Events DynamoDB Table Name',
            exportName: "AnalyticsEventsTableName-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'ScheduledReportsTableName', {
            value: scheduledReportsTable.tableName,
            description: 'Scheduled Reports DynamoDB Table Name',
            exportName: "ScheduledReportsTableName-".concat(stage),
        });
        // ✅ NEW - Daily/Weekly Time Tracking CloudFormation Outputs
        new cdk.CfnOutput(_this, 'UserWorkSchedulesTableName', {
            value: userWorkSchedulesTable.tableName,
            description: 'User Work Schedules DynamoDB Table Name',
            exportName: "UserWorkSchedulesTableName-".concat(stage),
        });
        return _this;
    }
    return DatabaseStack;
}(cdk.Stack));
exports.DatabaseStack = DatabaseStack;
