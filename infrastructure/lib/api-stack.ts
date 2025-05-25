import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { DatabaseTables } from './database-stack';
import { SesStack } from './ses-stack';

export interface ApiStackProps extends cdk.StackProps {
  stage: string;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  tables: DatabaseTables;
  storageBucket: s3.Bucket;
  sesStack: SesStack;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly lambdaFunctions: { [key: string]: lambda.Function };

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { stage, userPool, userPoolClient, tables, storageBucket, sesStack } = props;

    // Create REST API
    this.api = new apigateway.RestApi(this, 'AerotageTimeApi', {
      restApiName: `aerotage-time-api-${stage}`,
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

    // Cognito Authorizer
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'CognitoAuthorizer',
    });

    // Lambda execution role with necessary permissions
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        // Import SES policy from SES stack
        iam.ManagedPolicy.fromManagedPolicyArn(this, 'SesPolicy', 
          cdk.Fn.importValue(`LambdaSesPolicyArn-${stage}`)
        ),
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
                tables.teamsTable.tableArn,
                tables.projectsTable.tableArn,
                tables.clientsTable.tableArn,
                tables.timeEntriesTable.tableArn,
                tables.invoicesTable.tableArn,
                tables.userSessionsTable.tableArn,
                tables.userActivityTable.tableArn,
                tables.userInvitationsTable.tableArn,
                `${tables.usersTable.tableArn}/index/*`,
                `${tables.teamsTable.tableArn}/index/*`,
                `${tables.projectsTable.tableArn}/index/*`,
                `${tables.clientsTable.tableArn}/index/*`,
                `${tables.timeEntriesTable.tableArn}/index/*`,
                `${tables.invoicesTable.tableArn}/index/*`,
                `${tables.userSessionsTable.tableArn}/index/*`,
                `${tables.userActivityTable.tableArn}/index/*`,
                `${tables.userInvitationsTable.tableArn}/index/*`,
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
              resources: [`${storageBucket.bucketArn}/*`],
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
      },
    });

    // Environment variables for Lambda functions
    const lambdaEnvironment: { [key: string]: string } = {
      STAGE: stage,
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      USERS_TABLE: tables.usersTable.tableName,
      TEAMS_TABLE: tables.teamsTable.tableName,
      PROJECTS_TABLE: tables.projectsTable.tableName,
      CLIENTS_TABLE: tables.clientsTable.tableName,
      TIME_ENTRIES_TABLE: tables.timeEntriesTable.tableName,
      INVOICES_TABLE: tables.invoicesTable.tableName,
      USER_SESSIONS_TABLE: tables.userSessionsTable.tableName,
      USER_ACTIVITY_TABLE: tables.userActivityTable.tableName,
      USER_INVITATIONS_TABLE: tables.userInvitationsTable.tableName,
      STORAGE_BUCKET: storageBucket.bucketName,
      // SES Configuration
      SES_FROM_EMAIL: sesStack.fromEmail,
      SES_REPLY_TO_EMAIL: sesStack.replyToEmail,
      INVITATION_TEMPLATE_NAME: cdk.Fn.importValue(`SesInvitationTemplate-${stage}`),
      REMINDER_TEMPLATE_NAME: cdk.Fn.importValue(`SesReminderTemplate-${stage}`),
      WELCOME_TEMPLATE_NAME: cdk.Fn.importValue(`SesWelcomeTemplate-${stage}`),
      FRONTEND_BASE_URL: stage === 'prod' ? 'https://time.aerotage.com' : `https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/${stage}`,
    };

    // Store Lambda functions for monitoring
    this.lambdaFunctions = {};

    // Add API Gateway ID to environment variables after API is created
    lambdaEnvironment.API_GATEWAY_ID = this.api.restApiId;

    // Helper function to create Lambda functions
    const createLambdaFunction = (name: string, handler: string, description: string): lambdaNodejs.NodejsFunction => {
      const func = new lambdaNodejs.NodejsFunction(this, name, {
        functionName: `aerotage-${name.toLowerCase()}-${stage}`,
        entry: `lambda/${handler}.ts`,
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
        description,
      });
      
      this.lambdaFunctions[name] = func;
      return func;
    };

    // User Management APIs
    const usersResource = this.api.root.addResource('users');
    const createUserFunction = createLambdaFunction('CreateUser', 'users/create', 'Create new user');
    const getUsersFunction = createLambdaFunction('GetUsers', 'users/list', 'List all users');
    const getUserFunction = createLambdaFunction('GetUser', 'users/get', 'Get user by ID');
    const updateUserFunction = createLambdaFunction('UpdateUser', 'users/update', 'Update user');
    const deleteUserFunction = createLambdaFunction('DeleteUser', 'users/delete', 'Delete user');
    const inviteUserFunction = createLambdaFunction('InviteUser', 'users/invite', 'Invite new user');

    usersResource.addMethod('GET', new apigateway.LambdaIntegration(getUsersFunction), {
      authorizer: cognitoAuthorizer,
    });
    usersResource.addMethod('POST', new apigateway.LambdaIntegration(createUserFunction), {
      authorizer: cognitoAuthorizer,
    });

    const userResource = usersResource.addResource('{id}');
    userResource.addMethod('GET', new apigateway.LambdaIntegration(getUserFunction), {
      authorizer: cognitoAuthorizer,
    });
    userResource.addMethod('PUT', new apigateway.LambdaIntegration(updateUserFunction), {
      authorizer: cognitoAuthorizer,
    });
    userResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteUserFunction), {
      authorizer: cognitoAuthorizer,
    });

    const inviteResource = usersResource.addResource('invite');
    inviteResource.addMethod('POST', new apigateway.LambdaIntegration(inviteUserFunction), {
      authorizer: cognitoAuthorizer,
    });

    // User Invitations APIs
    const userInvitationsResource = this.api.root.addResource('user-invitations');
    const createInvitationFunction = createLambdaFunction('CreateInvitation', 'user-invitations/create', 'Create user invitation');
    const listInvitationsFunction = createLambdaFunction('ListInvitations', 'user-invitations/list', 'List user invitations');
    const validateInvitationFunction = createLambdaFunction('ValidateInvitation', 'user-invitations/validate', 'Validate invitation token');
    const acceptInvitationFunction = createLambdaFunction('AcceptInvitation', 'user-invitations/accept', 'Accept invitation');

    userInvitationsResource.addMethod('POST', new apigateway.LambdaIntegration(createInvitationFunction), {
      authorizer: cognitoAuthorizer,
    });
    userInvitationsResource.addMethod('GET', new apigateway.LambdaIntegration(listInvitationsFunction), {
      authorizer: cognitoAuthorizer,
    });

    const invitationResource = userInvitationsResource.addResource('{id}');
    const resendInvitationFunction = createLambdaFunction('ResendInvitation', 'user-invitations/resend', 'Resend invitation');
    const cancelInvitationFunction = createLambdaFunction('CancelInvitation', 'user-invitations/cancel', 'Cancel invitation');

    const resendResource = invitationResource.addResource('resend');
    resendResource.addMethod('POST', new apigateway.LambdaIntegration(resendInvitationFunction), {
      authorizer: cognitoAuthorizer,
    });

    invitationResource.addMethod('DELETE', new apigateway.LambdaIntegration(cancelInvitationFunction), {
      authorizer: cognitoAuthorizer,
    });

    const validateResource = userInvitationsResource.addResource('validate');
    const validateTokenResource = validateResource.addResource('{token}');
    validateTokenResource.addMethod('GET', new apigateway.LambdaIntegration(validateInvitationFunction));

    const acceptResource = userInvitationsResource.addResource('accept');
    acceptResource.addMethod('POST', new apigateway.LambdaIntegration(acceptInvitationFunction));

    // Accept invitation page (for direct email links)
    const acceptInvitationPageFunction = createLambdaFunction('AcceptInvitationPage', 'user-invitations/accept-page', 'Accept invitation page');
    const acceptInvitationPageResource = this.api.root.addResource('accept-invitation');
    acceptInvitationPageResource.addMethod('GET', new apigateway.LambdaIntegration(acceptInvitationPageFunction));

    // Team Management APIs
    const teamsResource = this.api.root.addResource('teams');
    const getTeamsFunction = createLambdaFunction('GetTeams', 'teams/list', 'List all teams');
    const createTeamFunction = createLambdaFunction('CreateTeam', 'teams/create', 'Create new team');
    const updateTeamFunction = createLambdaFunction('UpdateTeam', 'teams/update', 'Update team');
    const deleteTeamFunction = createLambdaFunction('DeleteTeam', 'teams/delete', 'Delete team');

    teamsResource.addMethod('GET', new apigateway.LambdaIntegration(getTeamsFunction), {
      authorizer: cognitoAuthorizer,
    });
    teamsResource.addMethod('POST', new apigateway.LambdaIntegration(createTeamFunction), {
      authorizer: cognitoAuthorizer,
    });

    const teamResource = teamsResource.addResource('{id}');
    teamResource.addMethod('PUT', new apigateway.LambdaIntegration(updateTeamFunction), {
      authorizer: cognitoAuthorizer,
    });
    teamResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTeamFunction), {
      authorizer: cognitoAuthorizer,
    });

    // Project APIs
    const projectsResource = this.api.root.addResource('projects');
    const getProjectsFunction = createLambdaFunction('GetProjects', 'projects/list', 'List projects');
    const createProjectFunction = createLambdaFunction('CreateProject', 'projects/create', 'Create project');
    const updateProjectFunction = createLambdaFunction('UpdateProject', 'projects/update', 'Update project');
    const deleteProjectFunction = createLambdaFunction('DeleteProject', 'projects/delete', 'Delete project');

    projectsResource.addMethod('GET', new apigateway.LambdaIntegration(getProjectsFunction), {
      authorizer: cognitoAuthorizer,
    });
    projectsResource.addMethod('POST', new apigateway.LambdaIntegration(createProjectFunction), {
      authorizer: cognitoAuthorizer,
    });

    const projectResource = projectsResource.addResource('{id}');
    projectResource.addMethod('PUT', new apigateway.LambdaIntegration(updateProjectFunction), {
      authorizer: cognitoAuthorizer,
    });
    projectResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteProjectFunction), {
      authorizer: cognitoAuthorizer,
    });

    // Client APIs
    const clientsResource = this.api.root.addResource('clients');
    const getClientsFunction = createLambdaFunction('GetClients', 'clients/list', 'List clients');
    const createClientFunction = createLambdaFunction('CreateClient', 'clients/create', 'Create client');
    const updateClientFunction = createLambdaFunction('UpdateClient', 'clients/update', 'Update client');
    const deleteClientFunction = createLambdaFunction('DeleteClient', 'clients/delete', 'Delete client');

    clientsResource.addMethod('GET', new apigateway.LambdaIntegration(getClientsFunction), {
      authorizer: cognitoAuthorizer,
    });
    clientsResource.addMethod('POST', new apigateway.LambdaIntegration(createClientFunction), {
      authorizer: cognitoAuthorizer,
    });

    const clientResource = clientsResource.addResource('{id}');
    clientResource.addMethod('PUT', new apigateway.LambdaIntegration(updateClientFunction), {
      authorizer: cognitoAuthorizer,
    });
    clientResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteClientFunction), {
      authorizer: cognitoAuthorizer,
    });

    // Time Entry APIs
    const timeEntriesResource = this.api.root.addResource('time-entries');
    const getTimeEntriesFunction = createLambdaFunction('GetTimeEntries', 'time-entries/list', 'List time entries');
    const createTimeEntryFunction = createLambdaFunction('CreateTimeEntry', 'time-entries/create', 'Create time entry');
    const updateTimeEntryFunction = createLambdaFunction('UpdateTimeEntry', 'time-entries/update', 'Update time entry');
    const deleteTimeEntryFunction = createLambdaFunction('DeleteTimeEntry', 'time-entries/delete', 'Delete time entry');
    const submitTimeEntriesFunction = createLambdaFunction('SubmitTimeEntries', 'time-entries/submit', 'Submit time entries');
    const approveTimeEntriesFunction = createLambdaFunction('ApproveTimeEntries', 'time-entries/approve', 'Approve time entries');
    const rejectTimeEntriesFunction = createLambdaFunction('RejectTimeEntries', 'time-entries/reject', 'Reject time entries');

    timeEntriesResource.addMethod('GET', new apigateway.LambdaIntegration(getTimeEntriesFunction), {
      authorizer: cognitoAuthorizer,
    });
    timeEntriesResource.addMethod('POST', new apigateway.LambdaIntegration(createTimeEntryFunction), {
      authorizer: cognitoAuthorizer,
    });

    const timeEntryResource = timeEntriesResource.addResource('{id}');
    timeEntryResource.addMethod('PUT', new apigateway.LambdaIntegration(updateTimeEntryFunction), {
      authorizer: cognitoAuthorizer,
    });
    timeEntryResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTimeEntryFunction), {
      authorizer: cognitoAuthorizer,
    });

    const submitResource = timeEntriesResource.addResource('submit');
    submitResource.addMethod('POST', new apigateway.LambdaIntegration(submitTimeEntriesFunction), {
      authorizer: cognitoAuthorizer,
    });

    const approveResource = timeEntriesResource.addResource('approve');
    approveResource.addMethod('POST', new apigateway.LambdaIntegration(approveTimeEntriesFunction), {
      authorizer: cognitoAuthorizer,
    });

    const rejectResource = timeEntriesResource.addResource('reject');
    rejectResource.addMethod('POST', new apigateway.LambdaIntegration(rejectTimeEntriesFunction), {
      authorizer: cognitoAuthorizer,
    });

    // Reporting APIs
    const reportsResource = this.api.root.addResource('reports');
    const getTimeReportsFunction = createLambdaFunction('GetTimeReports', 'reports/time', 'Get time reports');
    const getProjectReportsFunction = createLambdaFunction('GetProjectReports', 'reports/projects', 'Get project reports');
    const getUserReportsFunction = createLambdaFunction('GetUserReports', 'reports/users', 'Get user reports');
    const exportReportsFunction = createLambdaFunction('ExportReports', 'reports/export', 'Export reports');
    const getAnalyticsFunction = createLambdaFunction('GetAnalytics', 'reports/analytics', 'Get analytics data');

    const timeReportsResource = reportsResource.addResource('time');
    timeReportsResource.addMethod('GET', new apigateway.LambdaIntegration(getTimeReportsFunction), {
      authorizer: cognitoAuthorizer,
    });

    const projectReportsResource = reportsResource.addResource('projects');
    projectReportsResource.addMethod('GET', new apigateway.LambdaIntegration(getProjectReportsFunction), {
      authorizer: cognitoAuthorizer,
    });

    const userReportsResource = reportsResource.addResource('users');
    userReportsResource.addMethod('GET', new apigateway.LambdaIntegration(getUserReportsFunction), {
      authorizer: cognitoAuthorizer,
    });

    const exportResource = reportsResource.addResource('export');
    exportResource.addMethod('POST', new apigateway.LambdaIntegration(exportReportsFunction), {
      authorizer: cognitoAuthorizer,
    });

    const analyticsResource = reportsResource.addResource('analytics');
    analyticsResource.addMethod('GET', new apigateway.LambdaIntegration(getAnalyticsFunction), {
      authorizer: cognitoAuthorizer,
    });

    // Invoice APIs
    const invoicesResource = this.api.root.addResource('invoices');
    const getInvoicesFunction = createLambdaFunction('GetInvoices', 'invoices/list', 'List invoices');
    const generateInvoiceFunction = createLambdaFunction('GenerateInvoice', 'invoices/generate', 'Generate invoice');
    const updateInvoiceFunction = createLambdaFunction('UpdateInvoice', 'invoices/update', 'Update invoice');
    const sendInvoiceFunction = createLambdaFunction('SendInvoice', 'invoices/send', 'Send invoice');
    const updateInvoiceStatusFunction = createLambdaFunction('UpdateInvoiceStatus', 'invoices/status', 'Update invoice status');

    invoicesResource.addMethod('GET', new apigateway.LambdaIntegration(getInvoicesFunction), {
      authorizer: cognitoAuthorizer,
    });
    invoicesResource.addMethod('POST', new apigateway.LambdaIntegration(generateInvoiceFunction), {
      authorizer: cognitoAuthorizer,
    });

    const invoiceResource = invoicesResource.addResource('{id}');
    invoiceResource.addMethod('PUT', new apigateway.LambdaIntegration(updateInvoiceFunction), {
      authorizer: cognitoAuthorizer,
    });

    const sendInvoiceResource = invoiceResource.addResource('send');
    sendInvoiceResource.addMethod('POST', new apigateway.LambdaIntegration(sendInvoiceFunction), {
      authorizer: cognitoAuthorizer,
    });

    const invoiceStatusResource = invoiceResource.addResource('status');
    invoiceStatusResource.addMethod('PUT', new apigateway.LambdaIntegration(updateInvoiceStatusFunction), {
      authorizer: cognitoAuthorizer,
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `ApiGatewayUrl-${stage}`,
    });

    new cdk.CfnOutput(this, 'ApiGatewayId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: `ApiGatewayId-${stage}`,
    });

    new cdk.CfnOutput(this, 'ApiGatewayArn', {
      value: this.api.arnForExecuteApi(),
      description: 'API Gateway ARN',
      exportName: `ApiGatewayArn-${stage}`,
    });
  }
} 