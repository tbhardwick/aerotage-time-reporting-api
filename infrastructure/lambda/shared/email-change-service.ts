import { SESClient, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { EmailChangeRequest } from './types';

export class EmailChangeService {
  private sesClient: SESClient;
  private fromEmail: string;
  private frontendBaseUrl: string;
  private apiBaseUrl: string;

  constructor() {
    this.sesClient = new SESClient({});
    this.fromEmail = process.env.SES_FROM_EMAIL || 'noreply@aerotage.com';
    this.frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://time.aerotage.com';
    this.apiBaseUrl = process.env.API_BASE_URL || 'https://time-api-dev.aerotage.com';
  }

  // Send verification email for current or new email address
  async sendVerificationEmail(
    request: EmailChangeRequest,
    emailType: 'current' | 'new',
    userName: string
  ): Promise<void> {
    const emailAddress = emailType === 'current' ? request.currentEmail : request.newEmail;
    const token = emailType === 'current' 
      ? request.currentEmailVerificationToken 
      : request.newEmailVerificationToken;

    if (!token) {
      throw new Error('Verification token not found');
    }

    // Frontend verification URL - MUST be a public page (no authentication required)
    // The frontend page should call the API endpoint: POST /email-change/verify
    // with body: { token: "...", emailType: "current|new" }
    const verificationUrl = `${this.frontendBaseUrl}/verify-email?token=${token}&type=${emailType}`;
    
    // Direct API verification URL (alternative if frontend can't handle public pages)
    const directApiUrl = `${this.apiBaseUrl}/email-change/verify`;
    
    const requiresApproval = this.requiresAdminApproval(request);

    const templateData = {
      userName,
      currentEmail: request.currentEmail,
      newEmail: request.newEmail,
      reason: this.formatReason(request.reason),
      customReason: request.customReason || '',
      emailAddress,
      verificationUrl,
      directApiUrl, // Include direct API URL for reference
      requiresApproval: requiresApproval.toString(),
      expiresIn: '24 hours',
      // Additional data for frontend implementation
      verificationToken: token,
      emailType: emailType
    };

    await this.sesClient.send(new SendTemplatedEmailCommand({
      Source: this.fromEmail,
      Destination: {
        ToAddresses: [emailAddress],
      },
      Template: 'EmailChangeVerification',
      TemplateData: JSON.stringify(templateData),
    }));
  }

  // Send admin approval notification
  async sendAdminApprovalNotification(
    request: EmailChangeRequest,
    userName: string,
    adminEmails: string[]
  ): Promise<void> {
    const approvalUrl = `${this.frontendBaseUrl}/admin/email-change-requests/${request.id}`;

    const templateData = {
      userName,
      userId: request.userId,
      currentEmail: request.currentEmail,
      newEmail: request.newEmail,
      reason: this.formatReason(request.reason),
      customReason: request.customReason || '',
      requestedAt: new Date(request.requestedAt).toLocaleString(),
      requestId: request.id,
      approvalUrl
    };

    // Send to all admin emails
    for (const adminEmail of adminEmails) {
      await this.sesClient.send(new SendTemplatedEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [adminEmail],
        },
        Template: 'EmailChangeApprovalRequired',
        TemplateData: JSON.stringify({
          ...templateData,
          adminName: 'Administrator' // Could be personalized if we have admin names
        }),
      }));
    }
  }

  // Send email change completion notification
  async sendCompletionNotification(
    request: EmailChangeRequest,
    userName: string
  ): Promise<void> {
    const loginUrl = `${this.frontendBaseUrl}/login`;

    const templateData = {
      userName,
      oldEmail: request.currentEmail,
      newEmail: request.newEmail,
      completedAt: new Date(request.completedAt!).toLocaleString(),
      requestId: request.id,
      loginUrl
    };

    // Send to the new email address
    await this.sesClient.send(new SendTemplatedEmailCommand({
      Source: this.fromEmail,
      Destination: {
        ToAddresses: [request.newEmail],
      },
      Template: 'EmailChangeCompleted',
      TemplateData: JSON.stringify(templateData),
    }));
  }

  // Send rejection notification
  async sendRejectionNotification(
    request: EmailChangeRequest,
    userName: string
  ): Promise<void> {
    const templateData = {
      userName,
      currentEmail: request.currentEmail,
      newEmail: request.newEmail,
      reason: this.formatReason(request.reason),
      rejectionReason: request.rejectionReason || 'No reason provided',
      rejectedAt: new Date(request.rejectedAt!).toLocaleString(),
      requestId: request.id
    };

    // Send to the current email address
    await this.sesClient.send(new SendTemplatedEmailCommand({
      Source: this.fromEmail,
      Destination: {
        ToAddresses: [request.currentEmail],
      },
      Template: 'EmailChangeRejected',
      TemplateData: JSON.stringify(templateData),
    }));
  }

  // Send approval notification to user
  async sendApprovalNotification(
    request: EmailChangeRequest,
    userName: string
  ): Promise<void> {
    const templateData = {
      userName,
      currentEmail: request.currentEmail,
      newEmail: request.newEmail,
      reason: this.formatReason(request.reason),
      approvedAt: new Date(request.approvedAt!).toLocaleString(),
      requestId: request.id,
      estimatedCompletionTime: request.estimatedCompletionTime 
        ? new Date(request.estimatedCompletionTime).toLocaleString()
        : 'within 24 hours'
    };

    // Send to the current email address
    await this.sesClient.send(new SendTemplatedEmailCommand({
      Source: this.fromEmail,
      Destination: {
        ToAddresses: [request.currentEmail],
      },
      Template: 'EmailChangeApproved',
      TemplateData: JSON.stringify(templateData),
    }));
  }

  // Helper method to determine if admin approval is required
  private requiresAdminApproval(request: EmailChangeRequest): boolean {
    const autoApprovalReasons = ['personal_preference', 'name_change'];
    const isDomainChange = this.isDomainChange(request.currentEmail, request.newEmail);
    
    return !autoApprovalReasons.includes(request.reason) || isDomainChange;
  }

  // Helper method to check if email change involves domain change
  private isDomainChange(currentEmail: string, newEmail: string): boolean {
    const currentDomain = currentEmail.split('@')[1];
    const newDomain = newEmail.split('@')[1];
    return currentDomain !== newDomain;
  }

  // Helper method to format reason for display
  private formatReason(reason: string): string {
    const reasonMap: Record<string, string> = {
      'name_change': 'Name Change',
      'company_change': 'Company Change',
      'personal_preference': 'Personal Preference',
      'security_concern': 'Security Concern',
      'other': 'Other'
    };

    return reasonMap[reason] || reason;
  }
} 