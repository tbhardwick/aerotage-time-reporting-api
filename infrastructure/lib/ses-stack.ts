import * as cdk from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface SesStackProps extends cdk.StackProps {
  stage: string;
}

export class SesStack extends cdk.Stack {
  public readonly fromEmail: string;
  public readonly replyToEmail: string;
  public readonly invitationTemplate: ses.CfnTemplate;
  public readonly reminderTemplate: ses.CfnTemplate;
  public readonly welcomeTemplate: ses.CfnTemplate;

  constructor(scope: Construct, id: string, props: SesStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // Configuration based on environment
    this.fromEmail = stage === 'prod' ? 'noreply@aerotage.com' : `noreply-${stage}@aerotage.com`;
    this.replyToEmail = stage === 'prod' ? 'support@aerotage.com' : `support-${stage}@aerotage.com`;

    // User Invitation Email Template
    this.invitationTemplate = new ses.CfnTemplate(this, 'UserInvitationTemplate', {
      template: {
        templateName: `aerotage-user-invitation-${stage}`,
        subjectPart: "You've been invited to join Aerotage Time Reporting",
        htmlPart: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .invitation-details { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .personal-message { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .cta { text-align: center; margin: 30px 0; }
        .button { background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; }
        .help { background: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 30px; text-align: center; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Aerotage Time Reporting</h1>
        </div>
        <div class="content">
            <p>Hi there!</p>
            <p>{{inviterName}} ({{inviterEmail}}) has invited you to join the Aerotage Time Reporting system.</p>
            
            <div class="invitation-details">
                <h3>Your Role Details:</h3>
                <ul>
                    <li><strong>Role:</strong> {{role}}</li>
                    {{#if department}}<li><strong>Department:</strong> {{department}}</li>{{/if}}
                    {{#if jobTitle}}<li><strong>Job Title:</strong> {{jobTitle}}</li>{{/if}}
                </ul>
            </div>

            {{#if personalMessage}}
            <div class="personal-message">
                <h3>Message from {{inviterName}}:</h3>
                <p>{{personalMessage}}</p>
            </div>
            {{/if}}

            <div class="cta">
                <a href="{{invitationUrl}}" class="button">Accept Invitation</a>
            </div>

            <p><strong>Important:</strong> This invitation expires on {{expirationDate}}.</p>

            <div class="help">
                <p>Need help? Contact us at {{supportEmail}}</p>
            </div>
        </div>
        <div class="footer">
            <p>© 2024 Aerotage Design Group, Inc. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
        textPart: `
Welcome to Aerotage Time Reporting

Hi there!

{{inviterName}} ({{inviterEmail}}) has invited you to join the Aerotage Time Reporting system.

Your Role Details:
- Role: {{role}}
{{#if department}}- Department: {{department}}{{/if}}
{{#if jobTitle}}- Job Title: {{jobTitle}}{{/if}}

{{#if personalMessage}}
Message from {{inviterName}}:
{{personalMessage}}
{{/if}}

To accept your invitation, please visit: {{invitationUrl}}

Important: This invitation expires on {{expirationDate}}.

Need help? Contact us at {{supportEmail}}

© 2024 Aerotage Design Group, Inc. All rights reserved.
        `,
      },
    });

    // Invitation Reminder Email Template
    this.reminderTemplate = new ses.CfnTemplate(this, 'InvitationReminderTemplate', {
      template: {
        templateName: `aerotage-invitation-reminder-${stage}`,
        subjectPart: "Reminder: Your Aerotage Time Reporting invitation expires soon",
        htmlPart: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .urgent { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .cta { text-align: center; margin: 30px 0; }
        .button { background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; }
        .help { background: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 30px; text-align: center; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Invitation Reminder</h1>
        </div>
        <div class="content">
            <p>Hi there!</p>
            <p>This is a friendly reminder that your invitation to join Aerotage Time Reporting is still pending.</p>
            
            <div class="urgent">
                <p><strong>⏰ Time Sensitive:</strong> Your invitation expires on {{expirationDate}}.</p>
            </div>

            {{#if personalMessage}}
            <div class="personal-message">
                <h3>Updated message from {{inviterName}}:</h3>
                <p>{{personalMessage}}</p>
            </div>
            {{/if}}

            <div class="cta">
                <a href="{{invitationUrl}}" class="button">Accept Invitation Now</a>
            </div>

            <div class="help">
                <p>Need help? Contact us at {{supportEmail}}</p>
            </div>
        </div>
        <div class="footer">
            <p>© 2024 Aerotage Design Group, Inc. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
        textPart: `
Invitation Reminder

Hi there!

This is a friendly reminder that your invitation to join Aerotage Time Reporting is still pending.

⏰ Time Sensitive: Your invitation expires on {{expirationDate}}.

{{#if personalMessage}}
Updated message from {{inviterName}}:
{{personalMessage}}
{{/if}}

To accept your invitation, please visit: {{invitationUrl}}

Need help? Contact us at {{supportEmail}}

© 2024 Aerotage Design Group, Inc. All rights reserved.
        `,
      },
    });

    // Welcome Email Template
    this.welcomeTemplate = new ses.CfnTemplate(this, 'UserWelcomeTemplate', {
      template: {
        templateName: `aerotage-user-welcome-${stage}`,
        subjectPart: "Welcome to Aerotage Time Reporting!",
        htmlPart: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #059669; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .welcome-box { background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; }
        .next-steps { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .cta { text-align: center; margin: 30px 0; }
        .button { background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; }
        .help { background: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 30px; text-align: center; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Aerotage Time Reporting!</h1>
        </div>
        <div class="content">
            <p>Hi {{userName}}!</p>
            
            <div class="welcome-box">
                <p><strong>🎉 Your account has been successfully created!</strong></p>
                <p>You can now start tracking your time and managing your projects with Aerotage Time Reporting.</p>
            </div>

            <div class="next-steps">
                <h3>Next Steps:</h3>
                <ul>
                    <li>Complete your profile information</li>
                    <li>Familiarize yourself with the dashboard</li>
                    <li>Start logging your time entries</li>
                    <li>Explore project and client management features</li>
                </ul>
            </div>

            <div class="cta">
                <a href="{{dashboardUrl}}" class="button">Go to Dashboard</a>
            </div>

            <div class="help">
                <p>Need help getting started? Contact us at {{supportEmail}}</p>
                <p>We're here to help you make the most of Aerotage Time Reporting!</p>
            </div>
        </div>
        <div class="footer">
            <p>© 2024 Aerotage Design Group, Inc. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
        textPart: `
Welcome to Aerotage Time Reporting!

Hi {{userName}}!

🎉 Your account has been successfully created!

You can now start tracking your time and managing your projects with Aerotage Time Reporting.

Next Steps:
- Complete your profile information
- Familiarize yourself with the dashboard
- Start logging your time entries
- Explore project and client management features

Go to your dashboard: {{dashboardUrl}}

Need help getting started? Contact us at {{supportEmail}}
We're here to help you make the most of Aerotage Time Reporting!

© 2024 Aerotage Design Group, Inc. All rights reserved.
        `,
      },
    });

    // IAM Policy for Lambda functions to send emails
    const sesPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ses:SendEmail',
            'ses:SendTemplatedEmail',
            'ses:SendBulkTemplatedEmail',
          ],
          resources: ['*'], // SES doesn't support resource-level permissions for these actions
        }),
      ],
    });

    // Create managed policy for Lambda functions
    const lambdaSesPolicy = new iam.ManagedPolicy(this, 'LambdaSesPolicy', {
      managedPolicyName: `aerotage-lambda-ses-access-${stage}`,
      description: 'Policy for Lambda functions to send emails via SES',
      document: sesPolicy,
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'FromEmail', {
      value: this.fromEmail,
      description: 'SES from email address',
      exportName: `SesFromEmail-${stage}`,
    });

    new cdk.CfnOutput(this, 'ReplyToEmail', {
      value: this.replyToEmail,
      description: 'SES reply-to email address',
      exportName: `SesReplyToEmail-${stage}`,
    });

    new cdk.CfnOutput(this, 'InvitationTemplateName', {
      value: `aerotage-user-invitation-${stage}`,
      description: 'SES invitation template name',
      exportName: `SesInvitationTemplate-${stage}`,
    });

    new cdk.CfnOutput(this, 'ReminderTemplateName', {
      value: `aerotage-invitation-reminder-${stage}`,
      description: 'SES reminder template name',
      exportName: `SesReminderTemplate-${stage}`,
    });

    new cdk.CfnOutput(this, 'WelcomeTemplateName', {
      value: `aerotage-user-welcome-${stage}`,
      description: 'SES welcome template name',
      exportName: `SesWelcomeTemplate-${stage}`,
    });

    new cdk.CfnOutput(this, 'LambdaSesPolicyArn', {
      value: lambdaSesPolicy.managedPolicyArn,
      description: 'IAM policy ARN for Lambda SES access',
      exportName: `LambdaSesPolicyArn-${stage}`,
    });
  }
} 