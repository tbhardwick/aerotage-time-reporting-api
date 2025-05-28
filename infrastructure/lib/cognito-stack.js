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
exports.CognitoStack = void 0;
var cdk = require("aws-cdk-lib");
var cognito = require("aws-cdk-lib/aws-cognito");
var iam = require("aws-cdk-lib/aws-iam");
var cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
var cloudwatchActions = require("aws-cdk-lib/aws-cloudwatch-actions");
var sns = require("aws-cdk-lib/aws-sns");
var CognitoStack = /** @class */ (function (_super) {
    __extends(CognitoStack, _super);
    function CognitoStack(scope, id, props) {
        var _this = _super.call(this, scope, id, props) || this;
        var stage = props.stage, alertTopic = props.alertTopic;
        // Create SNS topic for password reset alerts if not provided
        var passwordResetAlertTopic = alertTopic || new sns.Topic(_this, 'PasswordResetAlertTopic', {
            topicName: "aerotage-password-reset-alerts-".concat(stage),
            displayName: 'Aerotage Password Reset Alerts',
        });
        // Create User Pool with enhanced password reset support
        _this.userPool = new cognito.UserPool(_this, 'UserPool', {
            userPoolName: "aerotage-time-".concat(stage),
            selfSignUpEnabled: false, // Admin-only user creation
            signInAliases: {
                email: true,
            },
            signInCaseSensitive: false,
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
                givenName: {
                    required: true,
                    mutable: true,
                },
                familyName: {
                    required: true,
                    mutable: true,
                },
                phoneNumber: {
                    required: false,
                    mutable: true,
                },
            },
            customAttributes: {
                role: new cognito.StringAttribute({
                    minLen: 3,
                    maxLen: 20,
                    mutable: true,
                }),
                hourlyRate: new cognito.NumberAttribute({
                    min: 0,
                    max: 1000,
                    mutable: true,
                }),
                teamId: new cognito.StringAttribute({
                    minLen: 1,
                    maxLen: 50,
                    mutable: true,
                }),
                department: new cognito.StringAttribute({
                    minLen: 1,
                    maxLen: 50,
                    mutable: true,
                }),
            },
            // ✅ UPDATED: Password policy with optional symbols for better UX
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false, // Made optional per requirements
                tempPasswordValidity: cdk.Duration.days(7),
            },
            // ✅ REQUIRED: Account recovery for password reset
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            // ✅ SECURITY: Device tracking and MFA (Advanced Security requires paid plan)
            deviceTracking: {
                challengeRequiredOnNewDevice: true,
                deviceOnlyRememberedOnUserPrompt: false,
            },
            // ✅ REQUIRED: Email configuration for password reset
            email: cognito.UserPoolEmail.withCognito(), // Using default Cognito email service
            // Enhanced user invitation templates
            userInvitation: {
                emailSubject: 'Welcome to Aerotage Time Reporting',
                emailBody: "\n          <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">\n            <h2 style=\"color: #1f2937;\">Welcome to Aerotage Time Reporting</h2>\n            <p>Hello <strong>{username}</strong>,</p>\n            <p>You have been invited to join the Aerotage Time Reporting system.</p>\n            <div style=\"background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;\">\n              <h3 style=\"margin: 0; font-size: 18px;\">Your temporary password:</h3>\n              <div style=\"background: white; padding: 15px; border-radius: 4px; margin: 10px 0; font-family: monospace; font-size: 16px; font-weight: bold;\">{####}</div>\n              <p style=\"margin: 10px 0 0 0; color: #6b7280; font-size: 14px;\">Please change this password after your first login</p>\n            </div>\n            <p>Please log in to the application and set up your new password.</p>\n            <hr style=\"margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;\">\n            <p style=\"color: #6b7280; font-size: 14px;\">Aerotage Design Group, Inc.</p>\n          </div>\n        ",
                smsMessage: 'Hello {username}, your temporary password for Aerotage Time Reporting is {####}',
            },
            // Enhanced user verification templates
            userVerification: {
                emailSubject: 'Verify your email for Aerotage Time Reporting',
                emailBody: "\n          <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">\n            <h2 style=\"color: #1f2937;\">Verify Your Email Address</h2>\n            <p>Please verify your email address to complete your Aerotage Time account setup.</p>\n            <div style=\"text-align: center; margin: 30px 0;\">\n              {##Verify Email##}\n            </div>\n            <p>If you didn't create this account, please ignore this email.</p>\n            <hr style=\"margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;\">\n            <p style=\"color: #6b7280; font-size: 14px;\">Aerotage Design Group, Inc.</p>\n          </div>\n        ",
                emailStyle: cognito.VerificationEmailStyle.LINK,
            },
            mfa: cognito.Mfa.OPTIONAL,
            mfaSecondFactor: {
                sms: true,
                otp: true,
            },
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // ✅ REQUIRED: Enhanced User Pool Client with password reset support
        _this.userPoolClient = new cognito.UserPoolClient(_this, 'UserPoolClient', {
            userPool: _this.userPool,
            userPoolClientName: "aerotage-time-client-".concat(stage),
            generateSecret: false, // For web/mobile clients
            // ✅ REQUIRED: Authentication flows for password reset
            authFlows: {
                adminUserPassword: true,
                userPassword: true,
                userSrp: true,
                custom: true,
            },
            supportedIdentityProviders: [
                cognito.UserPoolClientIdentityProvider.COGNITO,
            ],
            readAttributes: new cognito.ClientAttributes()
                .withStandardAttributes({
                email: true,
                givenName: true,
                familyName: true,
                phoneNumber: true,
            })
                .withCustomAttributes('role', 'hourlyRate', 'teamId', 'department'),
            // ✅ REQUIRED: Write attributes for password reset
            writeAttributes: new cognito.ClientAttributes()
                .withStandardAttributes({
                email: true,
                givenName: true,
                familyName: true,
                phoneNumber: true,
            })
                .withCustomAttributes('role', 'hourlyRate', 'teamId', 'department'),
            // Token validity periods
            accessTokenValidity: cdk.Duration.hours(1),
            idTokenValidity: cdk.Duration.hours(1),
            refreshTokenValidity: cdk.Duration.days(30),
            // ✅ REQUIRED: Security settings
            preventUserExistenceErrors: true,
        });
        // ✅ NOTE: Custom password reset email templates
        // Cognito uses default email templates for password reset by default.
        // For custom email templates, you would need to implement a Lambda trigger
        // using the "Custom Message" trigger. This is an optional enhancement for future implementation.
        // 
        // Example Lambda trigger implementation:
        // lambdaTriggers: {
        //   customMessage: customMessageLambda,
        // }
        //
        // The Lambda function would detect the triggerSource === 'CustomMessage_ForgotPassword'
        // and return custom HTML email content.
        // ✅ SECURITY: Password reset monitoring with CloudWatch
        _this.passwordResetAlarm = new cloudwatch.Alarm(_this, 'PasswordResetAlarm', {
            alarmName: "aerotage-password-reset-high-volume-".concat(stage),
            alarmDescription: 'High volume of password reset requests detected',
            metric: new cloudwatch.Metric({
                namespace: 'AWS/Cognito',
                metricName: 'ForgotPasswordRequests',
                dimensionsMap: {
                    UserPool: _this.userPool.userPoolId,
                },
                statistic: 'Sum',
                period: cdk.Duration.hours(1),
            }),
            threshold: 50, // Alert if more than 50 reset requests per hour
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        });
        // Add alarm action to SNS topic
        _this.passwordResetAlarm.addAlarmAction(new cloudwatchActions.SnsAction(passwordResetAlertTopic));
        // Additional monitoring for password reset confirmations
        var passwordResetConfirmAlarm = new cloudwatch.Alarm(_this, 'PasswordResetConfirmAlarm', {
            alarmName: "aerotage-password-reset-confirm-errors-".concat(stage),
            alarmDescription: 'High number of failed password reset confirmations',
            metric: new cloudwatch.Metric({
                namespace: 'AWS/Cognito',
                metricName: 'ConfirmForgotPasswordErrors',
                dimensionsMap: {
                    UserPool: _this.userPool.userPoolId,
                },
                statistic: 'Sum',
                period: cdk.Duration.minutes(15),
            }),
            threshold: 10, // Alert if more than 10 failed confirmations in 15 minutes
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        passwordResetConfirmAlarm.addAlarmAction(new cloudwatchActions.SnsAction(passwordResetAlertTopic));
        // Create Identity Pool for AWS resource access
        _this.identityPool = new cognito.CfnIdentityPool(_this, 'IdentityPool', {
            identityPoolName: "aerotage_time_identity_pool_".concat(stage),
            allowUnauthenticatedIdentities: false,
            cognitoIdentityProviders: [
                {
                    clientId: _this.userPoolClient.userPoolClientId,
                    providerName: _this.userPool.userPoolProviderName,
                },
            ],
        });
        // Create IAM Role for authenticated users
        var authenticatedRole = new iam.Role(_this, 'CognitoDefaultAuthenticatedRole', {
            assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
                StringEquals: {
                    'cognito-identity.amazonaws.com:aud': _this.identityPool.ref,
                },
                'ForAnyValue:StringLike': {
                    'cognito-identity.amazonaws.com:amr': 'authenticated',
                },
            }, 'sts:AssumeRoleWithWebIdentity'),
            inlinePolicies: {
                CognitoIdentityPoolPolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'mobileanalytics:PutEvents',
                                'cognito-sync:*',
                                'cognito-identity:*',
                            ],
                            resources: ['*'],
                        }),
                        // Add API Gateway permissions if needed
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'execute-api:Invoke',
                            ],
                            resources: ['*'], // You can make this more specific based on your API Gateway ARN
                        }),
                    ],
                }),
            },
        });
        // Create IAM Role for unauthenticated users (even though we don't allow them, it's still required)
        var unauthenticatedRole = new iam.Role(_this, 'CognitoDefaultUnauthenticatedRole', {
            assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
                StringEquals: {
                    'cognito-identity.amazonaws.com:aud': _this.identityPool.ref,
                },
                'ForAnyValue:StringLike': {
                    'cognito-identity.amazonaws.com:amr': 'unauthenticated',
                },
            }, 'sts:AssumeRoleWithWebIdentity'),
            inlinePolicies: {
                CognitoIdentityPoolPolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.DENY,
                            actions: ['*'],
                            resources: ['*'],
                        }),
                    ],
                }),
            },
        });
        // Attach roles to Identity Pool
        new cognito.CfnIdentityPoolRoleAttachment(_this, 'IdentityPoolRoleAttachment', {
            identityPoolId: _this.identityPool.ref,
            roles: {
                authenticated: authenticatedRole.roleArn,
                unauthenticated: unauthenticatedRole.roleArn,
            },
        });
        // Create Admin Group
        new cognito.CfnUserPoolGroup(_this, 'AdminGroup', {
            userPoolId: _this.userPool.userPoolId,
            groupName: 'admin',
            description: 'Administrators with full system access',
            precedence: 1,
        });
        // Create Manager Group
        new cognito.CfnUserPoolGroup(_this, 'ManagerGroup', {
            userPoolId: _this.userPool.userPoolId,
            groupName: 'manager',
            description: 'Managers with team oversight and approval capabilities',
            precedence: 2,
        });
        // Create Employee Group
        new cognito.CfnUserPoolGroup(_this, 'EmployeeGroup', {
            userPoolId: _this.userPool.userPoolId,
            groupName: 'employee',
            description: 'Standard employees with time tracking access',
            precedence: 3,
        });
        // ✅ NEW: Password reset specific outputs
        new cdk.CfnOutput(_this, 'PasswordResetSupported', {
            value: 'true',
            description: 'Indicates password reset functionality is supported',
            exportName: "PasswordResetSupported-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'PasswordResetAlarmArn', {
            value: _this.passwordResetAlarm.alarmArn,
            description: 'Password Reset Monitoring Alarm ARN',
            exportName: "PasswordResetAlarmArn-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'PasswordResetAlertTopicArn', {
            value: passwordResetAlertTopic.topicArn,
            description: 'SNS Topic ARN for password reset alerts',
            exportName: "PasswordResetAlertTopicArn-".concat(stage),
        });
        // Outputs
        new cdk.CfnOutput(_this, 'UserPoolId', {
            value: _this.userPool.userPoolId,
            description: 'Cognito User Pool ID',
            exportName: "UserPoolId-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'UserPoolClientId', {
            value: _this.userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID',
            exportName: "UserPoolClientId-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'IdentityPoolId', {
            value: _this.identityPool.ref,
            description: 'Cognito Identity Pool ID',
            exportName: "IdentityPoolId-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'UserPoolArn', {
            value: _this.userPool.userPoolArn,
            description: 'Cognito User Pool ARN',
            exportName: "UserPoolArn-".concat(stage),
        });
        // ✅ NEW: Password policy information for frontend reference
        new cdk.CfnOutput(_this, 'PasswordPolicy', {
            value: JSON.stringify({
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false,
            }),
            description: 'Password policy requirements for frontend validation',
            exportName: "PasswordPolicy-".concat(stage),
        });
        return _this;
    }
    return CognitoStack;
}(cdk.Stack));
exports.CognitoStack = CognitoStack;
