import { SESClient, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';

export interface EmailTemplateData {
  inviterName?: string;
  inviterEmail?: string;
  recipientEmail?: string;
  role?: string;
  department?: string;
  jobTitle?: string;
  invitationUrl?: string;
  expirationDate?: string;
  personalMessage?: string;
  companyName?: string;
  supportEmail?: string;
  userName?: string;
  dashboardUrl?: string;
}

export class EmailService {
  private sesClient: SESClient;
  private fromEmail: string;
  private replyToEmail: string;

  constructor() {
    this.sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.fromEmail = process.env.SES_FROM_EMAIL || 'noreply@aerotage.com';
    this.replyToEmail = process.env.SES_REPLY_TO_EMAIL || 'support@aerotage.com';
  }

  async sendInvitationEmail(
    recipientEmail: string,
    templateData: EmailTemplateData
  ): Promise<void> {
    const templateName = process.env.INVITATION_TEMPLATE_NAME || `aerotage-user-invitation-${process.env.STAGE}`;
    
    const enhancedData = {
      ...templateData,
      recipientEmail,
      companyName: 'Aerotage Design Group, Inc.',
      supportEmail: this.replyToEmail,
    };

    await this.sendTemplatedEmail(recipientEmail, templateName, enhancedData);
  }

  async sendReminderEmail(
    recipientEmail: string,
    templateData: EmailTemplateData
  ): Promise<void> {
    const templateName = process.env.REMINDER_TEMPLATE_NAME || `aerotage-invitation-reminder-${process.env.STAGE}`;
    
    const enhancedData = {
      ...templateData,
      recipientEmail,
      companyName: 'Aerotage Design Group, Inc.',
      supportEmail: this.replyToEmail,
    };

    await this.sendTemplatedEmail(recipientEmail, templateName, enhancedData);
  }

  async sendWelcomeEmail(
    recipientEmail: string,
    templateData: EmailTemplateData
  ): Promise<void> {
    const templateName = process.env.WELCOME_TEMPLATE_NAME || `aerotage-user-welcome-${process.env.STAGE}`;
    
    const enhancedData = {
      ...templateData,
      recipientEmail,
      companyName: 'Aerotage Design Group, Inc.',
      supportEmail: this.replyToEmail,
      dashboardUrl: templateData.dashboardUrl || process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com',
    };

    await this.sendTemplatedEmail(recipientEmail, templateName, enhancedData);
  }

  private async sendTemplatedEmail(
    recipientEmail: string,
    templateName: string,
    templateData: EmailTemplateData
  ): Promise<void> {
    const command = new SendTemplatedEmailCommand({
      Source: this.fromEmail,
      Destination: {
        ToAddresses: [recipientEmail],
      },
      Template: templateName,
      TemplateData: JSON.stringify(templateData),
      ReplyToAddresses: [this.replyToEmail],
    });

    try {
      const result = await this.sesClient.send(command);
      console.log('Email sent successfully:', {
        messageId: result.MessageId,
        recipient: recipientEmail,
        template: templateName,
      });
    } catch (error) {
      console.error('Failed to send email:', {
        error,
        recipient: recipientEmail,
        template: templateName,
      });
      throw new Error(`Failed to send email: ${error}`);
    }
  }
} 