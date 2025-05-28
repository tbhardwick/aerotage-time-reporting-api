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
exports.ApiStack = void 0;
var cdk = require("aws-cdk-lib");
var apigateway = require("aws-cdk-lib/aws-apigateway");
var lambda = require("aws-cdk-lib/aws-lambda");
var lambdaNodejs = require("aws-cdk-lib/aws-lambda-nodejs");
var iam = require("aws-cdk-lib/aws-iam");
var events = require("aws-cdk-lib/aws-events");
var targets = require("aws-cdk-lib/aws-events-targets");
var ApiStack = /** @class */ (function (_super) {
    __extends(ApiStack, _super);
    function ApiStack(scope, id, props) {
        var _this = _super.call(this, scope, id, props) || this;
        var stage = props.stage, userPool = props.userPool, userPoolClient = props.userPoolClient, tables = props.tables, storageBucket = props.storageBucket, sesStack = props.sesStack;
        // Create REST API
        _this.api = new apigateway.RestApi(_this, 'AerotageTimeApi', {
            restApiName: "aerotage-time-api-".concat(stage),
            description: 'Aerotage Time Reporting API',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS, // Configure for production
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                ],
            },
            deployOptions: {
                stageName: stage,
                throttlingRateLimit: 1000,
                throttlingBurstLimit: 2000,
                metricsEnabled: true,
                dataTraceEnabled: stage !== 'prod',
                loggingLevel: stage === 'prod'
                    ? apigateway.MethodLoggingLevel.ERROR
                    : apigateway.MethodLoggingLevel.INFO,
            },
        });
        // Create Custom Lambda Authorizer Function
        var customAuthorizerFunction = new lambdaNodejs.NodejsFunction(_this, 'CustomAuthorizerFunction', {
            functionName: "aerotage-custom-authorizer-".concat(stage),
            entry: "lambda/shared/custom-authorizer.ts",
            handler: 'handler',
            runtime: lambda.Runtime.NODEJS_20_X,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                STAGE: stage,
                USER_POOL_ID: userPool.userPoolId,
                USER_SESSIONS_TABLE: tables.userSessionsTable.tableName,
                FORCE_BOOTSTRAP: 'false', // Session migration now handles legacy sessions gracefully
            },
            bundling: {
                minify: false,
                sourceMap: false,
                target: 'es2020',
                externalModules: ['aws-sdk'],
                forceDockerBundling: false,
            },
            description: 'Custom Lambda authorizer with session validation',
        });
        // Grant the authorizer function permissions to read from DynamoDB
        tables.userSessionsTable.grantReadData(customAuthorizerFunction);
        // Custom Lambda Authorizer
        var customAuthorizer = new apigateway.TokenAuthorizer(_this, 'CustomAuthorizer', {
            handler: customAuthorizerFunction,
            authorizerName: 'SessionValidatingAuthorizer',
            resultsCacheTtl: cdk.Duration.seconds(0), // Disable cache to fix bootstrap issues
        });
        // Lambda execution role with necessary permissions
        var lambdaRole = new iam.Role(_this, 'LambdaExecutionRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                // Import SES policy from SES stack
                iam.ManagedPolicy.fromManagedPolicyArn(_this, 'SesPolicy', cdk.Fn.importValue("LambdaSesPolicyArn-".concat(stage))),
            ],
            inlinePolicies: {
                DynamoDBAccess: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'dynamodb:GetItem',
                                'dynamodb:PutItem',
                                'dynamodb:UpdateItem',
                                'dynamodb:DeleteItem',
                                'dynamodb:Query',
                                'dynamodb:Scan',
                                'dynamodb:BatchGetItem',
                                'dynamodb:BatchWriteItem',
                            ],
                            resources: [
                                tables.usersTable.tableArn,
                                tables.teamsTable.tableArn, // DEPRECATED - kept for backward compatibility
                                tables.projectsTable.tableArn,
                                tables.clientsTable.tableArn,
                                tables.timeEntriesTable.tableArn,
                                tables.invoicesTable.tableArn,
                                tables.invoiceTemplatesTable.tableArn, // ✅ NEW - Phase 7
                                tables.paymentsTable.tableArn, // ✅ NEW - Phase 7
                                tables.userSessionsTable.tableArn,
                                tables.userActivityTable.tableArn,
                                tables.userInvitationsTable.tableArn,
                                tables.userPreferencesTable.tableArn,
                                tables.userSecuritySettingsTable.tableArn,
                                tables.userNotificationSettingsTable.tableArn,
                                tables.passwordHistoryTable.tableArn,
                                // Phase 6: Analytics & Reporting Tables
                                tables.reportConfigsTable.tableArn,
                                tables.reportCacheTable.tableArn,
                                tables.analyticsEventsTable.tableArn,
                                tables.scheduledReportsTable.tableArn,
                                // Daily/Weekly Time Tracking Tables
                                tables.userWorkSchedulesTable.tableArn,
                                "".concat(tables.usersTable.tableArn, "/index/*"),
                                "".concat(tables.teamsTable.tableArn, "/index/*"), // DEPRECATED - kept for backward compatibility
                                "".concat(tables.projectsTable.tableArn, "/index/*"),
                                "".concat(tables.clientsTable.tableArn, "/index/*"),
                                "".concat(tables.timeEntriesTable.tableArn, "/index/*"),
                                "".concat(tables.invoicesTable.tableArn, "/index/*"),
                                "".concat(tables.invoiceTemplatesTable.tableArn, "/index/*"), // ✅ NEW - Phase 7
                                "".concat(tables.paymentsTable.tableArn, "/index/*"), // ✅ NEW - Phase 7
                                "".concat(tables.userSessionsTable.tableArn, "/index/*"),
                                "".concat(tables.userActivityTable.tableArn, "/index/*"),
                                "".concat(tables.userInvitationsTable.tableArn, "/index/*"),
                                "".concat(tables.userPreferencesTable.tableArn, "/index/*"),
                                "".concat(tables.userSecuritySettingsTable.tableArn, "/index/*"),
                                "".concat(tables.userNotificationSettingsTable.tableArn, "/index/*"),
                                "".concat(tables.passwordHistoryTable.tableArn, "/index/*"),
                                // Phase 6: Analytics & Reporting Table Indexes
                                "".concat(tables.reportConfigsTable.tableArn, "/index/*"),
                                "".concat(tables.reportCacheTable.tableArn, "/index/*"),
                                "".concat(tables.analyticsEventsTable.tableArn, "/index/*"),
                                "".concat(tables.scheduledReportsTable.tableArn, "/index/*"),
                                // Daily/Weekly Time Tracking Table Indexes
                                "".concat(tables.userWorkSchedulesTable.tableArn, "/index/*"),
                            ],
                        }),
                    ],
                }),
                S3Access: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                's3:GetObject',
                                's3:PutObject',
                                's3:DeleteObject',
                            ],
                            resources: ["".concat(storageBucket.bucketArn, "/*")],
                        }),
                    ],
                }),
                CognitoAccess: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'cognito-idp:AdminCreateUser',
                                'cognito-idp:AdminSetUserPassword',
                                'cognito-idp:AdminUpdateUserAttributes',
                                'cognito-idp:AdminDeleteUser',
                                'cognito-idp:AdminGetUser',
                                'cognito-idp:ListUsers',
                                'cognito-idp:AdminAddUserToGroup',
                                'cognito-idp:AdminRemoveUserFromGroup',
                            ],
                            resources: [userPool.userPoolArn],
                        }),
                    ],
                }),
                EventBridgeAccess: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'events:PutRule',
                                'events:PutTargets',
                                'events:DeleteRule',
                                'events:RemoveTargets',
                                'events:DescribeRule',
                                'events:ListTargetsByRule',
                            ],
                            resources: [
                                "arn:aws:events:".concat(_this.region, ":").concat(_this.account, ":rule/aerotage-report-*"),
                            ],
                        }),
                    ],
                }),
                LambdaInvokeAccess: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'lambda:InvokeFunction',
                            ],
                            resources: [
                                "arn:aws:lambda:".concat(_this.region, ":").concat(_this.account, ":function:aerotage-*"),
                            ],
                        }),
                    ],
                }),
            },
        });
        // Environment variables for Lambda functions
        var lambdaEnvironment = {
            STAGE: stage,
            AWS_ACCOUNT_ID: _this.account,
            COGNITO_USER_POOL_ID: userPool.userPoolId,
            USER_POOL_ID: userPool.userPoolId,
            USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
            USERS_TABLE: tables.usersTable.tableName,
            TEAMS_TABLE: tables.teamsTable.tableName, // DEPRECATED - kept for backward compatibility
            PROJECTS_TABLE: tables.projectsTable.tableName,
            CLIENTS_TABLE: tables.clientsTable.tableName,
            TIME_ENTRIES_TABLE: tables.timeEntriesTable.tableName,
            INVOICES_TABLE: tables.invoicesTable.tableName,
            INVOICE_TEMPLATES_TABLE: tables.invoiceTemplatesTable.tableName, // ✅ NEW - Phase 7
            PAYMENTS_TABLE: tables.paymentsTable.tableName, // ✅ NEW - Phase 7
            USER_SESSIONS_TABLE: tables.userSessionsTable.tableName,
            USER_ACTIVITY_TABLE: tables.userActivityTable.tableName,
            USER_INVITATIONS_TABLE: tables.userInvitationsTable.tableName,
            USER_PREFERENCES_TABLE: tables.userPreferencesTable.tableName,
            USER_SECURITY_SETTINGS_TABLE: tables.userSecuritySettingsTable.tableName,
            USER_NOTIFICATION_SETTINGS_TABLE: tables.userNotificationSettingsTable.tableName,
            PASSWORD_HISTORY_TABLE: tables.passwordHistoryTable.tableName,
            // Phase 6: Analytics & Reporting Tables
            REPORT_CONFIGS_TABLE_NAME: tables.reportConfigsTable.tableName,
            REPORT_CACHE_TABLE_NAME: tables.reportCacheTable.tableName,
            ANALYTICS_EVENTS_TABLE_NAME: tables.analyticsEventsTable.tableName,
            SCHEDULED_REPORTS_TABLE_NAME: tables.scheduledReportsTable.tableName,
            // Daily/Weekly Time Tracking Tables
            USER_WORK_SCHEDULES_TABLE: tables.userWorkSchedulesTable.tableName,
            STORAGE_BUCKET: storageBucket.bucketName,
            // SES Configuration
            SES_FROM_EMAIL: sesStack.fromEmail,
            SES_REPLY_TO_EMAIL: sesStack.replyToEmail,
            INVITATION_TEMPLATE_NAME: cdk.Fn.importValue("SesInvitationTemplate-".concat(stage)),
            REMINDER_TEMPLATE_NAME: cdk.Fn.importValue("SesReminderTemplate-".concat(stage)),
            WELCOME_TEMPLATE_NAME: cdk.Fn.importValue("SesWelcomeTemplate-".concat(stage)),
            FRONTEND_BASE_URL: stage === 'prod' ? 'https://time.aerotage.com' : "https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/".concat(stage),
        };
        // Store Lambda functions for monitoring
        _this.lambdaFunctions = {};
        // Add API Gateway ID to environment variables after API is created
        lambdaEnvironment.API_GATEWAY_ID = _this.api.restApiId;
        // Helper function to create Lambda functions
        var createLambdaFunction = function (name, handler, description) {
            var func = new lambdaNodejs.NodejsFunction(_this, name, {
                functionName: "aerotage-".concat(name.toLowerCase(), "-").concat(stage),
                entry: "lambda/".concat(handler, ".ts"),
                handler: 'handler',
                runtime: lambda.Runtime.NODEJS_20_X,
                timeout: cdk.Duration.seconds(30),
                memorySize: 256,
                environment: lambdaEnvironment,
                role: lambdaRole,
                bundling: {
                    minify: false,
                    sourceMap: false,
                    target: 'es2020',
                    externalModules: ['aws-sdk'],
                    forceDockerBundling: false,
                },
                description: description,
            });
            _this.lambdaFunctions[name] = func;
            return func;
        };
        // User Management APIs
        var usersResource = _this.api.root.addResource('users');
        var createUserFunction = createLambdaFunction('CreateUser', 'users/create', 'Create new user');
        var getUsersFunction = createLambdaFunction('GetUsers', 'users/list', 'List all users');
        var getUserFunction = createLambdaFunction('GetUser', 'users/get', 'Get user by ID');
        var updateUserFunction = createLambdaFunction('UpdateUser', 'users/update', 'Update user');
        // Note: User deletion and invitation are handled through separate endpoints
        // - User invitations: /user-invitations/* endpoints
        // - User deletion: Soft delete through user update endpoint
        usersResource.addMethod('GET', new apigateway.LambdaIntegration(getUsersFunction), {
            authorizer: customAuthorizer,
        });
        usersResource.addMethod('POST', new apigateway.LambdaIntegration(createUserFunction), {
            authorizer: customAuthorizer,
        });
        var userResource = usersResource.addResource('{id}');
        userResource.addMethod('GET', new apigateway.LambdaIntegration(getUserFunction), {
            authorizer: customAuthorizer,
        });
        userResource.addMethod('PUT', new apigateway.LambdaIntegration(updateUserFunction), {
            authorizer: customAuthorizer,
        });
        // Note: User deletion is handled through soft delete via PUT /users/{id}
        // User invitations are handled through /user-invitations endpoints
        // ✅ NEW - Work Schedule APIs
        var getWorkScheduleFunction = createLambdaFunction('GetWorkSchedule', 'users/work-schedule-get', 'Get user work schedule');
        var updateWorkScheduleFunction = createLambdaFunction('UpdateWorkSchedule', 'users/work-schedule-update', 'Update user work schedule');
        var workScheduleResource = usersResource.addResource('work-schedule');
        workScheduleResource.addMethod('GET', new apigateway.LambdaIntegration(getWorkScheduleFunction), {
            authorizer: customAuthorizer,
        });
        workScheduleResource.addMethod('PUT', new apigateway.LambdaIntegration(updateWorkScheduleFunction), {
            authorizer: customAuthorizer,
        });
        // Work schedule for specific user
        var userWorkScheduleResource = userResource.addResource('work-schedule');
        userWorkScheduleResource.addMethod('GET', new apigateway.LambdaIntegration(getWorkScheduleFunction), {
            authorizer: customAuthorizer,
        });
        userWorkScheduleResource.addMethod('PUT', new apigateway.LambdaIntegration(updateWorkScheduleFunction), {
            authorizer: customAuthorizer,
        });
        // User Invitations APIs
        var userInvitationsResource = _this.api.root.addResource('user-invitations');
        var createInvitationFunction = createLambdaFunction('CreateInvitation', 'user-invitations/create', 'Create user invitation');
        var listInvitationsFunction = createLambdaFunction('ListInvitations', 'user-invitations/list', 'List user invitations');
        var validateInvitationFunction = createLambdaFunction('ValidateInvitation', 'user-invitations/validate', 'Validate invitation token');
        var acceptInvitationFunction = createLambdaFunction('AcceptInvitation', 'user-invitations/accept', 'Accept invitation');
        userInvitationsResource.addMethod('POST', new apigateway.LambdaIntegration(createInvitationFunction), {
            authorizer: customAuthorizer,
        });
        userInvitationsResource.addMethod('GET', new apigateway.LambdaIntegration(listInvitationsFunction), {
            authorizer: customAuthorizer,
        });
        var invitationResource = userInvitationsResource.addResource('{id}');
        var resendInvitationFunction = createLambdaFunction('ResendInvitation', 'user-invitations/resend', 'Resend invitation');
        var cancelInvitationFunction = createLambdaFunction('CancelInvitation', 'user-invitations/cancel', 'Cancel invitation');
        var resendResource = invitationResource.addResource('resend');
        resendResource.addMethod('POST', new apigateway.LambdaIntegration(resendInvitationFunction), {
            authorizer: customAuthorizer,
        });
        invitationResource.addMethod('DELETE', new apigateway.LambdaIntegration(cancelInvitationFunction), {
            authorizer: customAuthorizer,
        });
        var validateResource = userInvitationsResource.addResource('validate');
        var validateTokenResource = validateResource.addResource('{token}');
        validateTokenResource.addMethod('GET', new apigateway.LambdaIntegration(validateInvitationFunction));
        var acceptResource = userInvitationsResource.addResource('accept');
        acceptResource.addMethod('POST', new apigateway.LambdaIntegration(acceptInvitationFunction));
        // Accept invitation page (for direct email links)
        var acceptInvitationPageFunction = createLambdaFunction('AcceptInvitationPage', 'user-invitations/accept-page', 'Accept invitation page');
        var acceptInvitationPageResource = _this.api.root.addResource('accept-invitation');
        acceptInvitationPageResource.addMethod('GET', new apigateway.LambdaIntegration(acceptInvitationPageFunction));
        // Project APIs
        var projectsResource = _this.api.root.addResource('projects');
        var getProjectsFunction = createLambdaFunction('GetProjects', 'projects/list', 'List projects');
        var createProjectFunction = createLambdaFunction('CreateProject', 'projects/create', 'Create project');
        var updateProjectFunction = createLambdaFunction('UpdateProject', 'projects/update', 'Update project');
        var deleteProjectFunction = createLambdaFunction('DeleteProject', 'projects/delete', 'Delete project');
        projectsResource.addMethod('GET', new apigateway.LambdaIntegration(getProjectsFunction), {
            authorizer: customAuthorizer,
        });
        projectsResource.addMethod('POST', new apigateway.LambdaIntegration(createProjectFunction), {
            authorizer: customAuthorizer,
        });
        var projectResource = projectsResource.addResource('{id}');
        projectResource.addMethod('PUT', new apigateway.LambdaIntegration(updateProjectFunction), {
            authorizer: customAuthorizer,
        });
        projectResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteProjectFunction), {
            authorizer: customAuthorizer,
        });
        // Client APIs
        var clientsResource = _this.api.root.addResource('clients');
        var getClientsFunction = createLambdaFunction('GetClients', 'clients/list', 'List clients');
        var createClientFunction = createLambdaFunction('CreateClient', 'clients/create', 'Create client');
        var updateClientFunction = createLambdaFunction('UpdateClient', 'clients/update', 'Update client');
        var deleteClientFunction = createLambdaFunction('DeleteClient', 'clients/delete', 'Delete client');
        clientsResource.addMethod('GET', new apigateway.LambdaIntegration(getClientsFunction), {
            authorizer: customAuthorizer,
        });
        clientsResource.addMethod('POST', new apigateway.LambdaIntegration(createClientFunction), {
            authorizer: customAuthorizer,
        });
        var clientResource = clientsResource.addResource('{id}');
        clientResource.addMethod('PUT', new apigateway.LambdaIntegration(updateClientFunction), {
            authorizer: customAuthorizer,
        });
        clientResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteClientFunction), {
            authorizer: customAuthorizer,
        });
        // Time Entry APIs
        var timeEntriesResource = _this.api.root.addResource('time-entries');
        var getTimeEntriesFunction = createLambdaFunction('GetTimeEntries', 'time-entries/list', 'List time entries');
        var createTimeEntryFunction = createLambdaFunction('CreateTimeEntry', 'time-entries/create', 'Create time entry');
        var updateTimeEntryFunction = createLambdaFunction('UpdateTimeEntry', 'time-entries/update', 'Update time entry');
        var deleteTimeEntryFunction = createLambdaFunction('DeleteTimeEntry', 'time-entries/delete', 'Delete time entry');
        var submitTimeEntriesFunction = createLambdaFunction('SubmitTimeEntries', 'time-entries/submit', 'Submit time entries');
        var approveTimeEntriesFunction = createLambdaFunction('ApproveTimeEntries', 'time-entries/approve', 'Approve time entries');
        var rejectTimeEntriesFunction = createLambdaFunction('RejectTimeEntries', 'time-entries/reject', 'Reject time entries');
        timeEntriesResource.addMethod('GET', new apigateway.LambdaIntegration(getTimeEntriesFunction), {
            authorizer: customAuthorizer,
        });
        timeEntriesResource.addMethod('POST', new apigateway.LambdaIntegration(createTimeEntryFunction), {
            authorizer: customAuthorizer,
        });
        var timeEntryResource = timeEntriesResource.addResource('{id}');
        timeEntryResource.addMethod('PUT', new apigateway.LambdaIntegration(updateTimeEntryFunction), {
            authorizer: customAuthorizer,
        });
        timeEntryResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTimeEntryFunction), {
            authorizer: customAuthorizer,
        });
        var submitResource = timeEntriesResource.addResource('submit');
        submitResource.addMethod('POST', new apigateway.LambdaIntegration(submitTimeEntriesFunction), {
            authorizer: customAuthorizer,
        });
        var approveResource = timeEntriesResource.addResource('approve');
        approveResource.addMethod('POST', new apigateway.LambdaIntegration(approveTimeEntriesFunction), {
            authorizer: customAuthorizer,
        });
        var rejectResource = timeEntriesResource.addResource('reject');
        rejectResource.addMethod('POST', new apigateway.LambdaIntegration(rejectTimeEntriesFunction), {
            authorizer: customAuthorizer,
        });
        // ✅ NEW - Daily/Weekly Time Tracking APIs
        var dailySummaryFunction = createLambdaFunction('DailySummary', 'time-entries/daily-summary', 'Get daily time summary');
        var weeklyOverviewFunction = createLambdaFunction('WeeklyOverview', 'time-entries/weekly-overview', 'Get weekly time overview');
        var quickAddFunction = createLambdaFunction('QuickAddTimeEntry', 'time-entries/quick-add', 'Quick add time entry');
        var dailySummaryResource = timeEntriesResource.addResource('daily-summary');
        dailySummaryResource.addMethod('GET', new apigateway.LambdaIntegration(dailySummaryFunction), {
            authorizer: customAuthorizer,
        });
        var weeklyOverviewResource = timeEntriesResource.addResource('weekly-overview');
        weeklyOverviewResource.addMethod('GET', new apigateway.LambdaIntegration(weeklyOverviewFunction), {
            authorizer: customAuthorizer,
        });
        var quickAddResource = timeEntriesResource.addResource('quick-add');
        quickAddResource.addMethod('POST', new apigateway.LambdaIntegration(quickAddFunction), {
            authorizer: customAuthorizer,
        });
        // Reporting APIs - Using working implementations
        var reportsResource = _this.api.root.addResource('reports');
        // Phase 6: Analytics & Dashboard APIs
        var analyticsMainResource = _this.api.root.addResource('analytics');
        // Dashboard endpoints
        var dashboardResource = analyticsMainResource.addResource('dashboard');
        var generateDashboardFunction = createLambdaFunction('GenerateDashboard', 'analytics/generate-dashboard-data', 'Generate dashboard data');
        var enhancedDashboardFunction = createLambdaFunction('EnhancedDashboard', 'analytics/enhanced-dashboard', 'Enhanced dashboard with widgets');
        dashboardResource.addMethod('GET', new apigateway.LambdaIntegration(generateDashboardFunction), {
            authorizer: customAuthorizer,
        });
        dashboardResource.addMethod('POST', new apigateway.LambdaIntegration(generateDashboardFunction), {
            authorizer: customAuthorizer,
        });
        var enhancedDashboardResource = dashboardResource.addResource('enhanced');
        enhancedDashboardResource.addMethod('GET', new apigateway.LambdaIntegration(enhancedDashboardFunction), {
            authorizer: customAuthorizer,
        });
        enhancedDashboardResource.addMethod('POST', new apigateway.LambdaIntegration(enhancedDashboardFunction), {
            authorizer: customAuthorizer,
        });
        // Real-time analytics endpoints
        var realTimeResource = analyticsMainResource.addResource('real-time');
        var realTimeAnalyticsFunction = createLambdaFunction('RealTimeAnalytics', 'analytics/real-time-analytics', 'Real-time analytics data');
        realTimeResource.addMethod('GET', new apigateway.LambdaIntegration(realTimeAnalyticsFunction), {
            authorizer: customAuthorizer,
        });
        realTimeResource.addMethod('POST', new apigateway.LambdaIntegration(realTimeAnalyticsFunction), {
            authorizer: customAuthorizer,
        });
        // Performance monitoring endpoints
        var performanceResource = analyticsMainResource.addResource('performance');
        var performanceMonitorFunction = createLambdaFunction('PerformanceMonitor', 'analytics/performance-monitor', 'Performance monitoring');
        performanceResource.addMethod('GET', new apigateway.LambdaIntegration(performanceMonitorFunction), {
            authorizer: customAuthorizer,
        });
        performanceResource.addMethod('POST', new apigateway.LambdaIntegration(performanceMonitorFunction), {
            authorizer: customAuthorizer,
        });
        // Analytics event tracking endpoints
        var eventsResource = analyticsMainResource.addResource('events');
        var trackEventFunction = createLambdaFunction('TrackEvent', 'analytics/track-event', 'Track analytics events');
        eventsResource.addMethod('POST', new apigateway.LambdaIntegration(trackEventFunction), {
            authorizer: customAuthorizer,
        });
        // Advanced filtering endpoints
        var filterResource = analyticsMainResource.addResource('filter');
        var advancedFilterFunction = createLambdaFunction('AdvancedFilter', 'reports/advanced-filter', 'Advanced data filtering');
        filterResource.addMethod('POST', new apigateway.LambdaIntegration(advancedFilterFunction), {
            authorizer: customAuthorizer,
        });
        // Report generation endpoints (working implementations)
        var generateTimeReportFunction = createLambdaFunction('GenerateTimeReport', 'reports/generate-time-report', 'Generate time reports');
        var generateProjectReportFunction = createLambdaFunction('GenerateProjectReport', 'reports/generate-project-report', 'Generate project reports');
        var generateClientReportFunction = createLambdaFunction('GenerateClientReport', 'reports/generate-client-report', 'Generate client reports');
        var exportReportFunction = createLambdaFunction('ExportReport', 'reports/export-report', 'Export reports');
        // Time reports endpoints
        var timeReportsResource = reportsResource.addResource('time');
        timeReportsResource.addMethod('GET', new apigateway.LambdaIntegration(generateTimeReportFunction), {
            authorizer: customAuthorizer,
        });
        timeReportsResource.addMethod('POST', new apigateway.LambdaIntegration(generateTimeReportFunction), {
            authorizer: customAuthorizer,
        });
        // Project reports endpoints
        var projectReportsResource = reportsResource.addResource('projects');
        projectReportsResource.addMethod('GET', new apigateway.LambdaIntegration(generateProjectReportFunction), {
            authorizer: customAuthorizer,
        });
        projectReportsResource.addMethod('POST', new apigateway.LambdaIntegration(generateProjectReportFunction), {
            authorizer: customAuthorizer,
        });
        // Client reports endpoints
        var clientReportsResource = reportsResource.addResource('clients');
        clientReportsResource.addMethod('GET', new apigateway.LambdaIntegration(generateClientReportFunction), {
            authorizer: customAuthorizer,
        });
        clientReportsResource.addMethod('POST', new apigateway.LambdaIntegration(generateClientReportFunction), {
            authorizer: customAuthorizer,
        });
        // Export reports endpoint
        var exportResource = reportsResource.addResource('export');
        exportResource.addMethod('POST', new apigateway.LambdaIntegration(exportReportFunction), {
            authorizer: customAuthorizer,
        });
        // Report scheduling endpoints
        var scheduleResource = reportsResource.addResource('schedule');
        var scheduleReportFunction = createLambdaFunction('ScheduleReport', 'reports/schedule-report', 'Schedule automated reports');
        // Grant EventBridge permission to invoke the schedule report function
        scheduleReportFunction.addPermission('AllowEventBridgeInvoke', {
            principal: new iam.ServicePrincipal('events.amazonaws.com'),
            action: 'lambda:InvokeFunction',
            sourceArn: "arn:aws:events:".concat(_this.region, ":").concat(_this.account, ":rule/aerotage-report-*"),
        });
        scheduleResource.addMethod('GET', new apigateway.LambdaIntegration(scheduleReportFunction), {
            authorizer: customAuthorizer,
        });
        scheduleResource.addMethod('POST', new apigateway.LambdaIntegration(scheduleReportFunction), {
            authorizer: customAuthorizer,
        });
        var scheduleIdResource = scheduleResource.addResource('{id}');
        scheduleIdResource.addMethod('GET', new apigateway.LambdaIntegration(scheduleReportFunction), {
            authorizer: customAuthorizer,
        });
        scheduleIdResource.addMethod('PUT', new apigateway.LambdaIntegration(scheduleReportFunction), {
            authorizer: customAuthorizer,
        });
        scheduleIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(scheduleReportFunction), {
            authorizer: customAuthorizer,
        });
        // Report configuration management
        var configResource = reportsResource.addResource('configs');
        var manageReportConfigFunction = createLambdaFunction('ManageReportConfig', 'reports/manage-report-config', 'Manage report configurations');
        configResource.addMethod('GET', new apigateway.LambdaIntegration(manageReportConfigFunction), {
            authorizer: customAuthorizer,
        });
        configResource.addMethod('POST', new apigateway.LambdaIntegration(manageReportConfigFunction), {
            authorizer: customAuthorizer,
        });
        var configIdResource = configResource.addResource('{id}');
        configIdResource.addMethod('GET', new apigateway.LambdaIntegration(manageReportConfigFunction), {
            authorizer: customAuthorizer,
        });
        configIdResource.addMethod('PUT', new apigateway.LambdaIntegration(manageReportConfigFunction), {
            authorizer: customAuthorizer,
        });
        configIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(manageReportConfigFunction), {
            authorizer: customAuthorizer,
        });
        // Invoice APIs
        var invoicesResource = _this.api.root.addResource('invoices');
        var getInvoicesFunction = createLambdaFunction('GetInvoices', 'invoices/list', 'List invoices');
        var generateInvoiceFunction = createLambdaFunction('GenerateInvoice', 'invoices/generate', 'Generate invoice');
        var updateInvoiceFunction = createLambdaFunction('UpdateInvoice', 'invoices/update', 'Update invoice');
        var sendInvoiceFunction = createLambdaFunction('SendInvoice', 'invoices/send', 'Send invoice');
        var updateInvoiceStatusFunction = createLambdaFunction('UpdateInvoiceStatus', 'invoices/status', 'Update invoice status');
        invoicesResource.addMethod('GET', new apigateway.LambdaIntegration(getInvoicesFunction), {
            authorizer: customAuthorizer,
        });
        invoicesResource.addMethod('POST', new apigateway.LambdaIntegration(generateInvoiceFunction), {
            authorizer: customAuthorizer,
        });
        var invoiceResource = invoicesResource.addResource('{id}');
        invoiceResource.addMethod('PUT', new apigateway.LambdaIntegration(updateInvoiceFunction), {
            authorizer: customAuthorizer,
        });
        var sendInvoiceResource = invoiceResource.addResource('send');
        sendInvoiceResource.addMethod('POST', new apigateway.LambdaIntegration(sendInvoiceFunction), {
            authorizer: customAuthorizer,
        });
        var invoiceStatusResource = invoiceResource.addResource('status');
        invoiceStatusResource.addMethod('PUT', new apigateway.LambdaIntegration(updateInvoiceStatusFunction), {
            authorizer: customAuthorizer,
        });
        // User Profile & Settings APIs
        // Profile endpoints: /users/{id}/profile
        var profileResource = userResource.addResource('profile');
        var getUserProfileFunction = createLambdaFunction('GetUserProfile', 'users/profile/get', 'Get user profile');
        var updateUserProfileFunction = createLambdaFunction('UpdateUserProfile', 'users/profile/update', 'Update user profile');
        profileResource.addMethod('GET', new apigateway.LambdaIntegration(getUserProfileFunction), {
            authorizer: customAuthorizer,
        });
        profileResource.addMethod('PUT', new apigateway.LambdaIntegration(updateUserProfileFunction), {
            authorizer: customAuthorizer,
        });
        // Preferences endpoints: /users/{id}/preferences
        var preferencesResource = userResource.addResource('preferences');
        var getUserPreferencesFunction = createLambdaFunction('GetUserPreferences', 'users/preferences/get', 'Get user preferences');
        var updateUserPreferencesFunction = createLambdaFunction('UpdateUserPreferences', 'users/preferences/update', 'Update user preferences');
        preferencesResource.addMethod('GET', new apigateway.LambdaIntegration(getUserPreferencesFunction), {
            authorizer: customAuthorizer,
        });
        preferencesResource.addMethod('PUT', new apigateway.LambdaIntegration(updateUserPreferencesFunction), {
            authorizer: customAuthorizer,
        });
        // Security endpoints: /users/{id}/password, /users/{id}/security-settings, /users/{id}/sessions
        var passwordResource = userResource.addResource('password');
        var changePasswordFunction = createLambdaFunction('ChangePassword', 'users/security/change-password', 'Change user password');
        passwordResource.addMethod('PUT', new apigateway.LambdaIntegration(changePasswordFunction), {
            authorizer: customAuthorizer,
        });
        var securitySettingsResource = userResource.addResource('security-settings');
        var getSecuritySettingsFunction = createLambdaFunction('GetSecuritySettings', 'users/security/get-settings', 'Get user security settings');
        var updateSecuritySettingsFunction = createLambdaFunction('UpdateSecuritySettings', 'users/security/update-settings', 'Update user security settings');
        securitySettingsResource.addMethod('GET', new apigateway.LambdaIntegration(getSecuritySettingsFunction), {
            authorizer: customAuthorizer,
        });
        securitySettingsResource.addMethod('PUT', new apigateway.LambdaIntegration(updateSecuritySettingsFunction), {
            authorizer: customAuthorizer,
        });
        var sessionsResource = userResource.addResource('sessions');
        var listSessionsFunction = createLambdaFunction('ListSessions', 'users/security/list-sessions', 'List user sessions');
        var createSessionFunction = createLambdaFunction('CreateSession', 'users/security/create-session', 'Create user session');
        var terminateSessionFunction = createLambdaFunction('TerminateSession', 'users/security/terminate-session', 'Terminate user session');
        sessionsResource.addMethod('GET', new apigateway.LambdaIntegration(listSessionsFunction), {
            authorizer: customAuthorizer,
        });
        // Session creation endpoint uses custom authorizer with bootstrap support
        // The custom authorizer will detect this endpoint and apply JWT-only validation for users without sessions
        sessionsResource.addMethod('POST', new apigateway.LambdaIntegration(createSessionFunction), {
            authorizer: customAuthorizer,
        });
        var sessionResource = sessionsResource.addResource('{sessionId}');
        sessionResource.addMethod('DELETE', new apigateway.LambdaIntegration(terminateSessionFunction), {
            authorizer: customAuthorizer,
        });
        // Logout endpoint for explicit logout cleanup
        var logoutResource = _this.api.root.addResource('logout');
        var logoutFunction = createLambdaFunction('Logout', 'users/security/logout', 'User logout with session cleanup');
        logoutResource.addMethod('POST', new apigateway.LambdaIntegration(logoutFunction), {
            authorizer: customAuthorizer,
        });
        // Session cleanup background job
        var sessionCleanupFunction = createLambdaFunction('SessionCleanup', 'users/security/cleanup-sessions', 'Background session cleanup job');
        // Schedule the cleanup function to run every 6 hours
        var cleanupRule = new events.Rule(_this, 'SessionCleanupRule', {
            ruleName: "aerotage-session-cleanup-".concat(stage),
            description: 'Trigger session cleanup every 6 hours',
            schedule: events.Schedule.rate(cdk.Duration.hours(6)),
        });
        cleanupRule.addTarget(new targets.LambdaFunction(sessionCleanupFunction));
        // Configure Gateway Responses for CORS support on error responses
        // This fixes the issue where 403 responses from the Lambda authorizer don't include CORS headers
        // Without this, browsers show CORS errors instead of the actual 403 authorization error
        var corsHeaders = {
            'Access-Control-Allow-Origin': "'*'",
            'Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            'Access-Control-Allow-Methods': "'DELETE,GET,HEAD,OPTIONS,PUT,POST,PATCH'",
        };
        // Add CORS headers to 4XX error responses (including 403 from authorizer)
        _this.api.addGatewayResponse('Default4XX', {
            type: apigateway.ResponseType.DEFAULT_4XX,
            responseHeaders: corsHeaders,
        });
        // Add CORS headers to 5XX error responses
        _this.api.addGatewayResponse('Default5XX', {
            type: apigateway.ResponseType.DEFAULT_5XX,
            responseHeaders: corsHeaders,
        });
        // Add CORS headers to specific responses that are commonly problematic
        _this.api.addGatewayResponse('Unauthorized', {
            type: apigateway.ResponseType.UNAUTHORIZED,
            responseHeaders: corsHeaders,
        });
        _this.api.addGatewayResponse('AccessDenied', {
            type: apigateway.ResponseType.ACCESS_DENIED,
            responseHeaders: corsHeaders,
        });
        _this.api.addGatewayResponse('AuthorizerFailure', {
            type: apigateway.ResponseType.AUTHORIZER_FAILURE,
            responseHeaders: corsHeaders,
        });
        _this.api.addGatewayResponse('AuthorizerConfigurationError', {
            type: apigateway.ResponseType.AUTHORIZER_CONFIGURATION_ERROR,
            responseHeaders: corsHeaders,
        });
        // CloudFormation Outputs
        new cdk.CfnOutput(_this, 'ApiGatewayUrl', {
            value: _this.api.url,
            description: 'API Gateway URL',
            exportName: "ApiGatewayUrl-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'ApiGatewayId', {
            value: _this.api.restApiId,
            description: 'API Gateway ID',
            exportName: "ApiGatewayId-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'ApiGatewayArn', {
            value: _this.api.arnForExecuteApi(),
            description: 'API Gateway ARN',
            exportName: "ApiGatewayArn-".concat(stage),
        });
        return _this;
    }
    return ApiStack;
}(cdk.Stack));
exports.ApiStack = ApiStack;
