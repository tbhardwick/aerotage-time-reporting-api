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
exports.SesStack = void 0;
var cdk = require("aws-cdk-lib");
var ses = require("aws-cdk-lib/aws-ses");
var iam = require("aws-cdk-lib/aws-iam");
var SesStack = /** @class */ (function (_super) {
    __extends(SesStack, _super);
    function SesStack(scope, id, props) {
        var _this = _super.call(this, scope, id, props) || this;
        var stage = props.stage;
        // Configuration based on environment
        _this.fromEmail = stage === 'prod' ? 'noreply@aerotage.com' : "noreply-".concat(stage, "@aerotage.com");
        _this.replyToEmail = stage === 'prod' ? 'support@aerotage.com' : "support-".concat(stage, "@aerotage.com");
        // User Invitation Email Template
        _this.invitationTemplate = new ses.CfnTemplate(_this, 'UserInvitationTemplate', {
            template: {
                templateName: "aerotage-user-invitation-".concat(stage),
                subjectPart: "You've been invited to join Aerotage Time Reporting",
                htmlPart: "\n<!DOCTYPE html>\n<html>\n<head>\n    <meta charset=\"utf-8\">\n    <style>\n        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }\n        .container { max-width: 600px; margin: 0 auto; padding: 20px; }\n        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }\n        .content { padding: 30px 20px; }\n        .invitation-details { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }\n        .personal-message { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }\n        .cta { text-align: center; margin: 30px 0; }\n        .button { background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; }\n        .help { background: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 30px; text-align: center; }\n        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }\n    </style>\n</head>\n<body>\n    <div class=\"container\">\n        <div class=\"header\">\n            <h1>Welcome to Aerotage Time Reporting</h1>\n        </div>\n        <div class=\"content\">\n            <p>Hi there!</p>\n            <p>{{inviterName}} ({{inviterEmail}}) has invited you to join the Aerotage Time Reporting system.</p>\n            \n            <div class=\"invitation-details\">\n                <h3>Your Role Details:</h3>\n                <ul>\n                    <li><strong>Role:</strong> {{role}}</li>\n                    {{#if department}}<li><strong>Department:</strong> {{department}}</li>{{/if}}\n                    {{#if jobTitle}}<li><strong>Job Title:</strong> {{jobTitle}}</li>{{/if}}\n                </ul>\n            </div>\n\n            {{#if personalMessage}}\n            <div class=\"personal-message\">\n                <h3>Message from {{inviterName}}:</h3>\n                <p>{{personalMessage}}</p>\n            </div>\n            {{/if}}\n\n            <div class=\"cta\">\n                <a href=\"{{invitationUrl}}\" class=\"button\">Accept Invitation</a>\n            </div>\n\n            <p><strong>Important:</strong> This invitation expires on {{expirationDate}}.</p>\n\n            <div class=\"help\">\n                <p>Need help? Contact us at {{supportEmail}}</p>\n            </div>\n        </div>\n        <div class=\"footer\">\n            <p>\u00A9 2024 Aerotage Design Group, Inc. All rights reserved.</p>\n        </div>\n    </div>\n</body>\n</html>",
                textPart: "\nWelcome to Aerotage Time Reporting\n\nHi there!\n\n{{inviterName}} ({{inviterEmail}}) has invited you to join the Aerotage Time Reporting system.\n\nYour Role Details:\n- Role: {{role}}\n{{#if department}}- Department: {{department}}{{/if}}\n{{#if jobTitle}}- Job Title: {{jobTitle}}{{/if}}\n\n{{#if personalMessage}}\nMessage from {{inviterName}}:\n{{personalMessage}}\n{{/if}}\n\nTo accept your invitation, please visit: {{invitationUrl}}\n\nImportant: This invitation expires on {{expirationDate}}.\n\nNeed help? Contact us at {{supportEmail}}\n\n\u00A9 2024 Aerotage Design Group, Inc. All rights reserved.\n        ",
            },
        });
        // Invitation Reminder Email Template
        _this.reminderTemplate = new ses.CfnTemplate(_this, 'InvitationReminderTemplate', {
            template: {
                templateName: "aerotage-invitation-reminder-".concat(stage),
                subjectPart: "Reminder: Your Aerotage Time Reporting invitation expires soon",
                htmlPart: "\n<!DOCTYPE html>\n<html>\n<head>\n    <meta charset=\"utf-8\">\n    <style>\n        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }\n        .container { max-width: 600px; margin: 0 auto; padding: 20px; }\n        .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }\n        .content { padding: 30px 20px; }\n        .urgent { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }\n        .cta { text-align: center; margin: 30px 0; }\n        .button { background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; }\n        .help { background: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 30px; text-align: center; }\n        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }\n    </style>\n</head>\n<body>\n    <div class=\"container\">\n        <div class=\"header\">\n            <h1>Invitation Reminder</h1>\n        </div>\n        <div class=\"content\">\n            <p>Hi there!</p>\n            <p>This is a friendly reminder that your invitation to join Aerotage Time Reporting is still pending.</p>\n            \n            <div class=\"urgent\">\n                <p><strong>\u23F0 Time Sensitive:</strong> Your invitation expires on {{expirationDate}}.</p>\n            </div>\n\n            {{#if personalMessage}}\n            <div class=\"personal-message\">\n                <h3>Updated message from {{inviterName}}:</h3>\n                <p>{{personalMessage}}</p>\n            </div>\n            {{/if}}\n\n            <div class=\"cta\">\n                <a href=\"{{invitationUrl}}\" class=\"button\">Accept Invitation Now</a>\n            </div>\n\n            <div class=\"help\">\n                <p>Need help? Contact us at {{supportEmail}}</p>\n            </div>\n        </div>\n        <div class=\"footer\">\n            <p>\u00A9 2024 Aerotage Design Group, Inc. All rights reserved.</p>\n        </div>\n    </div>\n</body>\n</html>",
                textPart: "\nInvitation Reminder\n\nHi there!\n\nThis is a friendly reminder that your invitation to join Aerotage Time Reporting is still pending.\n\n\u23F0 Time Sensitive: Your invitation expires on {{expirationDate}}.\n\n{{#if personalMessage}}\nUpdated message from {{inviterName}}:\n{{personalMessage}}\n{{/if}}\n\nTo accept your invitation, please visit: {{invitationUrl}}\n\nNeed help? Contact us at {{supportEmail}}\n\n\u00A9 2024 Aerotage Design Group, Inc. All rights reserved.\n        ",
            },
        });
        // Welcome Email Template
        _this.welcomeTemplate = new ses.CfnTemplate(_this, 'UserWelcomeTemplate', {
            template: {
                templateName: "aerotage-user-welcome-".concat(stage),
                subjectPart: "Welcome to Aerotage Time Reporting!",
                htmlPart: "\n<!DOCTYPE html>\n<html>\n<head>\n    <meta charset=\"utf-8\">\n    <style>\n        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }\n        .container { max-width: 600px; margin: 0 auto; padding: 20px; }\n        .header { background: #059669; color: white; padding: 20px; text-align: center; }\n        .content { padding: 30px 20px; }\n        .welcome-box { background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; }\n        .next-steps { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }\n        .cta { text-align: center; margin: 30px 0; }\n        .button { background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; }\n        .help { background: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 30px; text-align: center; }\n        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }\n    </style>\n</head>\n<body>\n    <div class=\"container\">\n        <div class=\"header\">\n            <h1>Welcome to Aerotage Time Reporting!</h1>\n        </div>\n        <div class=\"content\">\n            <p>Hi {{userName}}!</p>\n            \n            <div class=\"welcome-box\">\n                <p><strong>\uD83C\uDF89 Your account has been successfully created!</strong></p>\n                <p>You can now start tracking your time and managing your projects with Aerotage Time Reporting.</p>\n            </div>\n\n            <div class=\"next-steps\">\n                <h3>Next Steps:</h3>\n                <ul>\n                    <li>Complete your profile information</li>\n                    <li>Familiarize yourself with the dashboard</li>\n                    <li>Start logging your time entries</li>\n                    <li>Explore project and client management features</li>\n                </ul>\n            </div>\n\n            <div class=\"cta\">\n                <a href=\"{{dashboardUrl}}\" class=\"button\">Go to Dashboard</a>\n            </div>\n\n            <div class=\"help\">\n                <p>Need help getting started? Contact us at {{supportEmail}}</p>\n                <p>We're here to help you make the most of Aerotage Time Reporting!</p>\n            </div>\n        </div>\n        <div class=\"footer\">\n            <p>\u00A9 2024 Aerotage Design Group, Inc. All rights reserved.</p>\n        </div>\n    </div>\n</body>\n</html>",
                textPart: "\nWelcome to Aerotage Time Reporting!\n\nHi {{userName}}!\n\n\uD83C\uDF89 Your account has been successfully created!\n\nYou can now start tracking your time and managing your projects with Aerotage Time Reporting.\n\nNext Steps:\n- Complete your profile information\n- Familiarize yourself with the dashboard\n- Start logging your time entries\n- Explore project and client management features\n\nGo to your dashboard: {{dashboardUrl}}\n\nNeed help getting started? Contact us at {{supportEmail}}\nWe're here to help you make the most of Aerotage Time Reporting!\n\n\u00A9 2024 Aerotage Design Group, Inc. All rights reserved.\n        ",
            },
        });
        // IAM Policy for Lambda functions to send emails
        var sesPolicy = new iam.PolicyDocument({
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
        var lambdaSesPolicy = new iam.ManagedPolicy(_this, 'LambdaSesPolicy', {
            managedPolicyName: "aerotage-lambda-ses-access-".concat(stage),
            description: 'Policy for Lambda functions to send emails via SES',
            document: sesPolicy,
        });
        // CloudFormation Outputs
        new cdk.CfnOutput(_this, 'FromEmail', {
            value: _this.fromEmail,
            description: 'SES from email address',
            exportName: "SesFromEmail-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'ReplyToEmail', {
            value: _this.replyToEmail,
            description: 'SES reply-to email address',
            exportName: "SesReplyToEmail-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'InvitationTemplateName', {
            value: "aerotage-user-invitation-".concat(stage),
            description: 'SES invitation template name',
            exportName: "SesInvitationTemplate-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'ReminderTemplateName', {
            value: "aerotage-invitation-reminder-".concat(stage),
            description: 'SES reminder template name',
            exportName: "SesReminderTemplate-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'WelcomeTemplateName', {
            value: "aerotage-user-welcome-".concat(stage),
            description: 'SES welcome template name',
            exportName: "SesWelcomeTemplate-".concat(stage),
        });
        new cdk.CfnOutput(_this, 'LambdaSesPolicyArn', {
            value: lambdaSesPolicy.managedPolicyArn,
            description: 'IAM policy ARN for Lambda SES access',
            exportName: "LambdaSesPolicyArn-".concat(stage),
        });
        return _this;
    }
    return SesStack;
}(cdk.Stack));
exports.SesStack = SesStack;
