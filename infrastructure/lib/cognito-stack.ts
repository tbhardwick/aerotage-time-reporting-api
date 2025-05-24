import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface CognitoStackProps extends cdk.StackProps {
  stage: string;
  alertTopic?: sns.Topic; // Optional: for password reset monitoring
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly passwordResetAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    const { stage, alertTopic } = props;

    // Create SNS topic for password reset alerts if not provided
    const passwordResetAlertTopic = alertTopic || new sns.Topic(this, 'PasswordResetAlertTopic', {
      topicName: `aerotage-password-reset-alerts-${stage}`,
      displayName: 'Aerotage Password Reset Alerts',
    });

    // Create User Pool with enhanced password reset support
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `aerotage-time-${stage}`,
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
      // ✅ SECURITY: Enhanced security configuration
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: false,
      },
      // ✅ REQUIRED: Email configuration for password reset
      email: cognito.UserPoolEmail.withCognito(), // Using default Cognito email service
      // Enhanced user invitation templates
      userInvitation: {
        emailSubject: 'Welcome to Aerotage Time Reporting',
        emailBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1f2937;">Welcome to Aerotage Time Reporting</h2>
            <p>Hello <strong>{username}</strong>,</p>
            <p>You have been invited to join the Aerotage Time Reporting system.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h3 style="margin: 0; font-size: 18px;">Your temporary password:</h3>
              <div style="background: white; padding: 15px; border-radius: 4px; margin: 10px 0; font-family: monospace; font-size: 16px; font-weight: bold;">{####}</div>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">Please change this password after your first login</p>
            </div>
            <p>Please log in to the application and set up your new password.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">Aerotage Design Group, Inc.</p>
          </div>
        `,
        smsMessage: 'Hello {username}, your temporary password for Aerotage Time Reporting is {####}',
      },
      // Enhanced user verification templates
      userVerification: {
        emailSubject: 'Verify your email for Aerotage Time Reporting',
        emailBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1f2937;">Verify Your Email Address</h2>
            <p>Please verify your email address to complete your Aerotage Time account setup.</p>
            <div style="text-align: center; margin: 30px 0;">
              {##Verify Email##}
            </div>
            <p>If you didn't create this account, please ignore this email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">Aerotage Design Group, Inc.</p>
          </div>
        `,
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
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `aerotage-time-client-${stage}`,
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
          emailVerified: true,
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
    this.passwordResetAlarm = new cloudwatch.Alarm(this, 'PasswordResetAlarm', {
      alarmName: `aerotage-password-reset-high-volume-${stage}`,
      alarmDescription: 'High volume of password reset requests detected',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Cognito',
        metricName: 'ForgotPasswordRequests',
        dimensionsMap: {
          UserPool: this.userPool.userPoolId,
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
    this.passwordResetAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(passwordResetAlertTopic)
    );

    // Additional monitoring for password reset confirmations
    const passwordResetConfirmAlarm = new cloudwatch.Alarm(this, 'PasswordResetConfirmAlarm', {
      alarmName: `aerotage-password-reset-confirm-errors-${stage}`,
      alarmDescription: 'High number of failed password reset confirmations',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Cognito',
        metricName: 'ConfirmForgotPasswordErrors',
        dimensionsMap: {
          UserPool: this.userPool.userPoolId,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(15),
      }),
      threshold: 10, // Alert if more than 10 failed confirmations in 15 minutes
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    passwordResetConfirmAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(passwordResetAlertTopic)
    );

    // Create Identity Pool for AWS resource access
    this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `aerotage_time_identity_pool_${stage}`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
      ],
    });

    // Create IAM Role for authenticated users
    const authenticatedRole = new iam.Role(this, 'CognitoDefaultAuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
        StringEquals: {
          'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
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
    const unauthenticatedRole = new iam.Role(this, 'CognitoDefaultUnauthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
        StringEquals: {
          'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
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
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
        unauthenticated: unauthenticatedRole.roleArn,
      },
    });

    // Create Admin Group
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'admin',
      description: 'Administrators with full system access',
      precedence: 1,
    });

    // Create Manager Group
    new cognito.CfnUserPoolGroup(this, 'ManagerGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'manager',
      description: 'Managers with team oversight and approval capabilities',
      precedence: 2,
    });

    // Create Employee Group
    new cognito.CfnUserPoolGroup(this, 'EmployeeGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'employee',
      description: 'Standard employees with time tracking access',
      precedence: 3,
    });

    // ✅ NEW: Password reset specific outputs
    new cdk.CfnOutput(this, 'PasswordResetSupported', {
      value: 'true',
      description: 'Indicates password reset functionality is supported',
      exportName: `PasswordResetSupported-${stage}`,
    });

    new cdk.CfnOutput(this, 'PasswordResetAlarmArn', {
      value: this.passwordResetAlarm.alarmArn,
      description: 'Password Reset Monitoring Alarm ARN',
      exportName: `PasswordResetAlarmArn-${stage}`,
    });

    new cdk.CfnOutput(this, 'PasswordResetAlertTopicArn', {
      value: passwordResetAlertTopic.topicArn,
      description: 'SNS Topic ARN for password reset alerts',
      exportName: `PasswordResetAlertTopicArn-${stage}`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `UserPoolId-${stage}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `UserPoolClientId-${stage}`,
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description: 'Cognito Identity Pool ID',
      exportName: `IdentityPoolId-${stage}`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `UserPoolArn-${stage}`,
    });

    // ✅ NEW: Password policy information for frontend reference
    new cdk.CfnOutput(this, 'PasswordPolicy', {
      value: JSON.stringify({
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      }),
      description: 'Password policy requirements for frontend validation',
      exportName: `PasswordPolicy-${stage}`,
    });
  }
} 