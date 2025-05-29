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
  // Email Change Templates
  public readonly emailChangeVerificationTemplate: ses.CfnTemplate;
  public readonly emailChangeApprovalRequiredTemplate: ses.CfnTemplate;
  public readonly emailChangeApprovedTemplate: ses.CfnTemplate;
  public readonly emailChangeRejectedTemplate: ses.CfnTemplate;
  public readonly emailChangeCompletedTemplate: ses.CfnTemplate;

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

    // ✅ NEW - Email Change Verification Template
    this.emailChangeVerificationTemplate = new ses.CfnTemplate(this, 'EmailChangeVerificationTemplate', {
      template: {
        templateName: 'EmailChangeVerification',
        subjectPart: "Verify your email address for email change request",
        htmlPart: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .verification-box { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed; }
        .cta { text-align: center; margin: 30px 0; }
        .button { background: #7c3aed; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; }
        .warning { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Email Address Verification</h1>
        </div>
        <div class="content">
            <p>Hi {{userName}}!</p>
            <p>You have requested to change your email address from <strong>{{currentEmail}}</strong> to <strong>{{newEmail}}</strong>.</p>
            
            <div class="verification-box">
                <h3>🔐 Verification Required</h3>
                <p>To proceed with your email change request, please verify this email address by clicking the button below:</p>
                <p><strong>Email to verify:</strong> {{emailAddress}}</p>
                <p><strong>Reason:</strong> {{reason}}</p>
                {{#if customReason}}<p><strong>Details:</strong> {{customReason}}</p>{{/if}}
            </div>

            <div class="cta">
                <a href="{{verificationUrl}}" class="button">Verify Email Address</a>
            </div>

            <div class="warning">
                <p><strong>⚠️ Important Security Information:</strong></p>
                <ul>
                    <li>This verification link expires in {{expiresIn}}</li>
                    <li>Both your current and new email addresses must be verified</li>
                    {{#if requiresApproval}}<li>Admin approval will be required after verification</li>{{/if}}
                    <li>If you didn't request this change, please contact support immediately</li>
                </ul>
            </div>

            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6b7280;">{{verificationUrl}}</p>
        </div>
        <div class="footer">
            <p>© 2024 Aerotage Design Group, Inc. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
        textPart: `
Email Address Verification

Hi {{userName}}!

You have requested to change your email address from {{currentEmail}} to {{newEmail}}.

🔐 Verification Required

To proceed with your email change request, please verify this email address:

Email to verify: {{emailAddress}}
Reason: {{reason}}
{{#if customReason}}Details: {{customReason}}{{/if}}

Verification link: {{verificationUrl}}

⚠️ Important Security Information:
- This verification link expires in {{expiresIn}}
- Both your current and new email addresses must be verified
{{#if requiresApproval}}- Admin approval will be required after verification{{/if}}
- If you didn't request this change, please contact support immediately

© 2024 Aerotage Design Group, Inc. All rights reserved.
        `,
      },
    });

    // ✅ NEW - Email Change Approval Required Template
    this.emailChangeApprovalRequiredTemplate = new ses.CfnTemplate(this, 'EmailChangeApprovalRequiredTemplate', {
      template: {
        templateName: 'EmailChangeApprovalRequired',
        subjectPart: "Email change request requires admin approval",
        htmlPart: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .request-details { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .cta { text-align: center; margin: 30px 0; }
        .button { background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Email Change Approval Required</h1>
        </div>
        <div class="content">
            <p>Hi {{adminName}}!</p>
            <p>A user has requested an email address change that requires admin approval.</p>
            
            <div class="request-details">
                <h3>📋 Request Details</h3>
                <ul>
                    <li><strong>User:</strong> {{userName}} ({{userId}})</li>
                    <li><strong>Current Email:</strong> {{currentEmail}}</li>
                    <li><strong>New Email:</strong> {{newEmail}}</li>
                    <li><strong>Reason:</strong> {{reason}}</li>
                    {{#if customReason}}<li><strong>Details:</strong> {{customReason}}</li>{{/if}}
                    <li><strong>Requested:</strong> {{requestedAt}}</li>
                    <li><strong>Request ID:</strong> {{requestId}}</li>
                </ul>
            </div>

            <p>Both email addresses have been verified by the user. Please review and approve or reject this request.</p>

            <div class="cta">
                <a href="{{approvalUrl}}" class="button">Review Request</a>
            </div>
        </div>
        <div class="footer">
            <p>© 2024 Aerotage Design Group, Inc. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
        textPart: `
Email Change Approval Required

Hi {{adminName}}!

A user has requested an email address change that requires admin approval.

📋 Request Details:
- User: {{userName}} ({{userId}})
- Current Email: {{currentEmail}}
- New Email: {{newEmail}}
- Reason: {{reason}}
{{#if customReason}}- Details: {{customReason}}{{/if}}
- Requested: {{requestedAt}}
- Request ID: {{requestId}}

Both email addresses have been verified by the user. Please review and approve or reject this request.

Review request: {{approvalUrl}}

© 2024 Aerotage Design Group, Inc. All rights reserved.
        `,
      },
    });

    // ✅ NEW - Email Change Approved Template
    this.emailChangeApprovedTemplate = new ses.CfnTemplate(this, 'EmailChangeApprovedTemplate', {
      template: {
        templateName: 'EmailChangeApproved',
        subjectPart: "Your email change request has been approved",
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
        .approval-box { background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; }
        .next-steps { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Email Change Approved</h1>
        </div>
        <div class="content">
            <p>Hi {{userName}}!</p>
            
            <div class="approval-box">
                <p><strong>✅ Great news! Your email change request has been approved.</strong></p>
                <ul>
                    <li><strong>Current Email:</strong> {{currentEmail}}</li>
                    <li><strong>New Email:</strong> {{newEmail}}</li>
                    <li><strong>Reason:</strong> {{reason}}</li>
                    <li><strong>Approved:</strong> {{approvedAt}}</li>
                    <li><strong>Request ID:</strong> {{requestId}}</li>
                </ul>
            </div>

            <div class="next-steps">
                <h3>What happens next?</h3>
                <p>Your email address will be updated automatically. This process typically completes {{estimatedCompletionTime}}.</p>
                <p>You will receive a confirmation email at your new address once the change is complete.</p>
            </div>

            <p>If you have any questions, please contact our support team.</p>
        </div>
        <div class="footer">
            <p>© 2024 Aerotage Design Group, Inc. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
        textPart: `
Email Change Approved

Hi {{userName}}!

✅ Great news! Your email change request has been approved.

Details:
- Current Email: {{currentEmail}}
- New Email: {{newEmail}}
- Reason: {{reason}}
- Approved: {{approvedAt}}
- Request ID: {{requestId}}

What happens next?
Your email address will be updated automatically. This process typically completes {{estimatedCompletionTime}}.

You will receive a confirmation email at your new address once the change is complete.

If you have any questions, please contact our support team.

© 2024 Aerotage Design Group, Inc. All rights reserved.
        `,
      },
    });

    // ✅ NEW - Email Change Rejected Template
    this.emailChangeRejectedTemplate = new ses.CfnTemplate(this, 'EmailChangeRejectedTemplate', {
      template: {
        templateName: 'EmailChangeRejected',
        subjectPart: "Your email change request has been rejected",
        htmlPart: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .rejection-box { background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
        .next-steps { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Email Change Request Rejected</h1>
        </div>
        <div class="content">
            <p>Hi {{userName}}!</p>
            
            <div class="rejection-box">
                <p><strong>❌ Your email change request has been rejected.</strong></p>
                <ul>
                    <li><strong>Current Email:</strong> {{currentEmail}}</li>
                    <li><strong>Requested Email:</strong> {{newEmail}}</li>
                    <li><strong>Reason for Change:</strong> {{reason}}</li>
                    <li><strong>Rejection Reason:</strong> {{rejectionReason}}</li>
                    <li><strong>Request ID:</strong> {{requestId}}</li>
                </ul>
            </div>

            <div class="next-steps">
                <h3>What can you do?</h3>
                <p>If you believe this rejection was made in error or if you have additional information to support your request, please contact your administrator or submit a new request with more details.</p>
            </div>

            <p>Your current email address remains unchanged and you can continue using your account normally.</p>
        </div>
        <div class="footer">
            <p>© 2024 Aerotage Design Group, Inc. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
        textPart: `
Email Change Request Rejected

Hi {{userName}}!

❌ Your email change request has been rejected.

Details:
- Current Email: {{currentEmail}}
- Requested Email: {{newEmail}}
- Reason for Change: {{reason}}
- Rejection Reason: {{rejectionReason}}
- Request ID: {{requestId}}

What can you do?
If you believe this rejection was made in error or if you have additional information to support your request, please contact your administrator or submit a new request with more details.

Your current email address remains unchanged and you can continue using your account normally.

© 2024 Aerotage Design Group, Inc. All rights reserved.
        `,
      },
    });

    // ✅ NEW - Email Change Completed Template
    this.emailChangeCompletedTemplate = new ses.CfnTemplate(this, 'EmailChangeCompletedTemplate', {
      template: {
        templateName: 'EmailChangeCompleted',
        subjectPart: "Your email address has been successfully changed",
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
        .success-box { background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; }
        .cta { text-align: center; margin: 30px 0; }
        .button { background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; }
        .important { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Email Change Complete</h1>
        </div>
        <div class="content">
            <p>Hi {{userName}}!</p>
            
            <div class="success-box">
                <p><strong>🎉 Your email address has been successfully changed!</strong></p>
                <ul>
                    <li><strong>Old Email:</strong> {{oldEmail}}</li>
                    <li><strong>New Email:</strong> {{newEmail}}</li>
                    <li><strong>Completed:</strong> {{completedAt}}</li>
                    <li><strong>Request ID:</strong> {{requestId}}</li>
                </ul>
            </div>

            <div class="important">
                <p><strong>⚠️ Important: Please update your login credentials</strong></p>
                <p>From now on, use your new email address ({{newEmail}}) to log into your account. Your password remains the same.</p>
            </div>

            <div class="cta">
                <a href="{{loginUrl}}" class="button">Login with New Email</a>
            </div>

            <p>If you experience any issues logging in with your new email address, please contact our support team.</p>
        </div>
        <div class="footer">
            <p>© 2024 Aerotage Design Group, Inc. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
        textPart: `
Email Change Complete

Hi {{userName}}!

🎉 Your email address has been successfully changed!

Details:
- Old Email: {{oldEmail}}
- New Email: {{newEmail}}
- Completed: {{completedAt}}
- Request ID: {{requestId}}

⚠️ Important: Please update your login credentials
From now on, use your new email address ({{newEmail}}) to log into your account. Your password remains the same.

Login with your new email: {{loginUrl}}

If you experience any issues logging in with your new email address, please contact our support team.

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

    // ✅ NEW - Email Change Template Outputs
    new cdk.CfnOutput(this, 'EmailChangeVerificationTemplateName', {
      value: 'EmailChangeVerification',
      description: 'SES email change verification template name',
      exportName: `SesEmailChangeVerificationTemplate-${stage}`,
    });

    new cdk.CfnOutput(this, 'EmailChangeApprovalRequiredTemplateName', {
      value: 'EmailChangeApprovalRequired',
      description: 'SES email change approval required template name',
      exportName: `SesEmailChangeApprovalRequiredTemplate-${stage}`,
    });

    new cdk.CfnOutput(this, 'EmailChangeApprovedTemplateName', {
      value: 'EmailChangeApproved',
      description: 'SES email change approved template name',
      exportName: `SesEmailChangeApprovedTemplate-${stage}`,
    });

    new cdk.CfnOutput(this, 'EmailChangeRejectedTemplateName', {
      value: 'EmailChangeRejected',
      description: 'SES email change rejected template name',
      exportName: `SesEmailChangeRejectedTemplate-${stage}`,
    });

    new cdk.CfnOutput(this, 'EmailChangeCompletedTemplateName', {
      value: 'EmailChangeCompleted',
      description: 'SES email change completed template name',
      exportName: `SesEmailChangeCompletedTemplate-${stage}`,
    });

    new cdk.CfnOutput(this, 'LambdaSesPolicyArn', {
      value: lambdaSesPolicy.managedPolicyArn,
      description: 'IAM policy ARN for Lambda SES access',
      exportName: `LambdaSesPolicyArn-${stage}`,
    });
  }
} 