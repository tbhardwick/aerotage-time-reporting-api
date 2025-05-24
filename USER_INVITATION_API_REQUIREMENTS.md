# User Email Invitations - Backend API Requirements

**Document Version:** 1.0  
**Date:** December 2024  
**Target:** Backend Team (aerotage-time-reporting-api repository)  
**Frontend Repository:** aerotage_time_reporting_app  

## Overview

This document outlines the backend API requirements for implementing user email invitations in the Aerotage Time Reporting Application. When an admin creates new users, the system should send email invitations instead of creating accounts directly, allowing users to complete their own registration process.

## Current Architecture Context

### Frontend Stack
- **Framework:** Electron + React 18 + TypeScript
- **Authentication:** AWS Cognito with AWS Amplify v6
- **API Client:** AWS Amplify REST API (`apiClient` class)
- **State Management:** React Context with useReducer

### Backend Stack (Separate Repository)
- **Infrastructure:** AWS CDK (TypeScript)
- **API:** AWS API Gateway
- **Compute:** AWS Lambda functions
- **Database:** DynamoDB
- **Authentication:** AWS Cognito User Pool
- **Email Service:** AWS SES (configured but not fully utilized)

### Existing User Management
The frontend already has:
- `UserInvitation` interface defined in `AppContext.tsx`
- User creation form (`UserForm.tsx`) with role-based permissions
- API client patterns in `api-client.ts`
- AWS configuration in `aws-config.ts`

## Required API Endpoints

### 1. Create User Invitation

**Endpoint:** `POST /user-invitations`

**Description:** Creates a new user invitation and sends an email invitation

**Request Body:**
```typescript
{
  email: string;
  role: 'admin' | 'manager' | 'employee';
  teamId?: string;
  department?: string;
  jobTitle?: string;
  hourlyRate?: number;
  permissions: {
    features: string[];
    projects: string[];
  };
  personalMessage?: string; // Optional message from admin
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    id: string;
    email: string;
    role: 'admin' | 'manager' | 'employee';
    teamId?: string;
    status: 'pending';
    invitationToken: string;
    expiresAt: string; // ISO timestamp
    invitedBy: string; // User ID
    createdAt: string;
    onboardingCompleted: false;
  };
  message: string;
}
```

**Business Logic:**
1. Validate that requesting user has `userManagement` permission
2. Check if email already exists in users or pending invitations
3. Generate secure invitation token (JWT or UUID)
4. Set expiration (7 days default, configurable)
5. Store invitation in DynamoDB
6. Send invitation email via AWS SES
7. Return invitation details

**Error Cases:**
- 400: Invalid email format
- 409: Email already exists
- 403: Insufficient permissions
- 500: Email sending failure

### 2. Get User Invitations

**Endpoint:** `GET /user-invitations`

**Description:** Retrieves all user invitations (admin only)

**Query Parameters:**
```typescript
{
  status?: 'pending' | 'accepted' | 'expired' | 'cancelled';
  limit?: number; // Default 50
  offset?: number; // Default 0
  sortBy?: 'createdAt' | 'expiresAt' | 'email';
  sortOrder?: 'asc' | 'desc'; // Default 'desc'
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    invitations: UserInvitation[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}
```

### 3. Resend Invitation

**Endpoint:** `POST /user-invitations/{invitationId}/resend`

**Description:** Resends invitation email and optionally extends expiration

**Request Body:**
```typescript
{
  extendExpiration?: boolean; // Default true, adds 7 more days
  personalMessage?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    id: string;
    expiresAt: string; // Updated if extended
    resentAt: string;
  };
  message: string;
}
```

### 4. Cancel Invitation

**Endpoint:** `DELETE /user-invitations/{invitationId}`

**Description:** Cancels a pending invitation

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

### 5. Validate Invitation Token

**Endpoint:** `GET /user-invitations/validate/{token}`

**Description:** Validates invitation token and returns invitation details

**Response:**
```typescript
{
  success: boolean;
  data: {
    invitation: {
      id: string;
      email: string;
      role: 'admin' | 'manager' | 'employee';
      teamId?: string;
      department?: string;
      jobTitle?: string;
      hourlyRate?: number;
      permissions: {
        features: string[];
        projects: string[];
      };
      expiresAt: string;
      isExpired: boolean;
    };
  };
}
```

**Error Cases:**
- 404: Invalid token
- 410: Expired invitation
- 409: Already accepted

### 6. Accept Invitation

**Endpoint:** `POST /user-invitations/accept`

**Description:** Accepts invitation and creates user account

**Request Body:**
```typescript
{
  token: string;
  userData: {
    name: string;
    password: string; // Must meet password policy
    contactInfo?: {
      phone?: string;
      address?: string;
      emergencyContact?: string;
    };
    preferences: {
      theme: 'light' | 'dark';
      notifications: boolean;
      timezone: string;
    };
  };
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    user: User; // Complete user object
    invitation: UserInvitation; // Updated with acceptance details
  };
  message: string;
}
```

**Business Logic:**
1. Validate invitation token and expiration
2. Create Cognito user with provided email and password
3. Create user record in DynamoDB with invitation details
4. Mark invitation as accepted
5. Send welcome email
6. Return complete user object

## Data Models

### UserInvitation DynamoDB Table

**Table Name:** `UserInvitations`

**Schema:**
```typescript
{
  PK: string; // "INVITATION#{id}"
  SK: string; // "INVITATION#{id}"
  GSI1PK: string; // "EMAIL#{email}"
  GSI1SK: string; // "INVITATION#{createdAt}"
  id: string;
  email: string;
  invitedBy: string; // User ID who sent invitation
  role: 'admin' | 'manager' | 'employee';
  teamId?: string;
  department?: string;
  jobTitle?: string;
  hourlyRate?: number;
  permissions: {
    features: string[];
    projects: string[];
  };
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  invitationToken: string; // Hashed token
  tokenHash: string; // For secure lookup
  expiresAt: string; // ISO timestamp
  acceptedAt?: string;
  onboardingCompleted: boolean;
  personalMessage?: string;
  createdAt: string;
  updatedAt: string;
  // Email tracking
  emailSentAt: string;
  resentCount: number; // Track resend attempts
  lastResentAt?: string;
}
```

**Indexes:**
- **GSI1:** `GSI1PK` (email) + `GSI1SK` (createdAt) - Query by email
- **LSI1:** `PK` + `status` - Query by status
- **GSI2:** `tokenHash` - Secure token lookup

**TTL:** Use `expiresAt` for automatic cleanup of expired invitations

### Integration with Existing Users Table

The invitation acceptance process should populate the existing Users table with:
```typescript
{
  // Standard user fields from invitation
  id: string; // Generated
  email: string; // From invitation
  name: string; // From acceptance form
  role: string; // From invitation
  teamId?: string; // From invitation
  department?: string; // From invitation
  jobTitle?: string; // From invitation
  hourlyRate?: number; // From invitation
  
  // New fields for invitation tracking
  invitationId: string; // Reference to invitation
  onboardedAt: string; // When user completed onboarding
  invitedBy: string; // Who invited them
  
  // Standard fields
  isActive: true;
  startDate: string; // Acceptance date
  permissions: object; // From invitation
  preferences: object; // From acceptance form
  contactInfo: object; // From acceptance form
  createdAt: string;
  updatedAt: string;
  createdBy: string; // invitedBy value
}
```

## Email Service Integration

### AWS SES Configuration

The backend should configure SES for sending invitation emails:

**Templates Required:**
1. **Invitation Email** (`user-invitation`)
2. **Reminder Email** (`invitation-reminder`)  
3. **Welcome Email** (`user-welcome`)

### Invitation Email Template

**Subject:** "You've been invited to join Aerotage Time Reporting"

**Template Variables:**
```typescript
{
  inviterName: string;
  inviterEmail: string;
  recipientEmail: string;
  role: string;
  department?: string;
  jobTitle?: string;
  invitationUrl: string; // Frontend URL with token
  expirationDate: string; // Formatted date
  personalMessage?: string;
  companyName: string; // "Aerotage Design Group, Inc."
  supportEmail: string;
}
```

**Email Content Structure:**
```html
<h1>Welcome to Aerotage Time Reporting</h1>
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
```

### Frontend Invitation URL Format

The invitation email should link to a frontend route:
```
https://your-app-domain.com/accept-invitation?token={{invitationToken}}
```

## Security Considerations

### Token Security
1. **Token Generation:** Use cryptographically secure random tokens (32+ bytes)
2. **Token Storage:** Store hashed version in database using bcrypt or similar
3. **Token Validation:** Compare hashed versions, never store plain tokens
4. **Single Use:** Invalidate token after acceptance or expiration

### Rate Limiting
1. **Invitation Creation:** Max 10 invitations per admin per hour
2. **Resend Requests:** Max 3 resends per invitation
3. **Validation Attempts:** Max 5 token validation attempts per IP per hour

### Input Validation
1. **Email Validation:** RFC 5322 compliant email validation
2. **Role Validation:** Ensure role is valid and requester can assign it
3. **Permission Validation:** Validate feature/project permissions exist
4. **Password Policy:** Enforce strong password requirements

### Access Control
1. **Admin Only:** Only users with `userManagement` permission can send invitations
2. **Team Restrictions:** Managers can only invite to their teams
3. **Role Restrictions:** Users cannot invite users with higher privileges than themselves

## Frontend Integration Points

### New API Client Methods

Add to `api-client.ts`:

```typescript
// User Invitations API
async createUserInvitation(invitation: CreateInvitationRequest): Promise<UserInvitation> {
  return this.request<UserInvitation>('POST', '/user-invitations', { body: invitation });
}

async getUserInvitations(filters?: InvitationFilters): Promise<UserInvitation[]> {
  const params = filters ? `?${new URLSearchParams(filters)}` : '';
  return this.request<UserInvitation[]>('GET', `/user-invitations${params}`);
}

async resendInvitation(invitationId: string, options?: ResendOptions): Promise<void> {
  return this.request<void>('POST', `/user-invitations/${invitationId}/resend`, { body: options });
}

async cancelInvitation(invitationId: string): Promise<void> {
  return this.request<void>('DELETE', `/user-invitations/${invitationId}`);
}

async validateInvitationToken(token: string): Promise<InvitationValidation> {
  return this.request<InvitationValidation>('GET', `/user-invitations/validate/${token}`);
}

async acceptInvitation(acceptanceData: AcceptInvitationRequest): Promise<AcceptInvitationResponse> {
  return this.request<AcceptInvitationResponse>('POST', '/user-invitations/accept', { body: acceptanceData });
}
```

### Context Actions

Add to `AppContext.tsx`:

```typescript
// User Invitation Actions
| { type: 'SET_USER_INVITATIONS'; payload: UserInvitation[] }
| { type: 'ADD_USER_INVITATION'; payload: UserInvitation }
| { type: 'UPDATE_USER_INVITATION'; payload: { id: string; updates: Partial<UserInvitation> } }
| { type: 'DELETE_USER_INVITATION'; payload: string }
```

### New Frontend Components Needed

1. **InvitationForm** - Replace direct user creation with invitation sending
2. **InvitationList** - Manage pending invitations
3. **AcceptInvitationPage** - User onboarding flow
4. **InvitationStatusBadge** - Show invitation status in UI

## User Experience Flow

### Admin Flow
1. **Create Invitation:**
   - Admin clicks "Invite User" instead of "Create User"
   - Fills invitation form (email, role, permissions, optional message)
   - System sends invitation email
   - Admin sees invitation in "Pending Invitations" list

2. **Manage Invitations:**
   - View all pending/expired invitations
   - Resend invitation emails
   - Cancel pending invitations
   - See acceptance status

### User Flow
1. **Receive Invitation:**
   - User receives email with invitation details
   - Clicks "Accept Invitation" link

2. **Accept Invitation:**
   - Redirected to frontend acceptance page
   - Enters full name, password, and preferences
   - Submits form to complete registration

3. **Account Creation:**
   - Cognito account created automatically
   - User logged in and redirected to dashboard
   - Welcome email sent

## Error Handling

### Backend Error Responses

```typescript
// Standard error response format
{
  success: false;
  error: {
    code: string; // ERROR_CODE_CONSTANT
    message: string; // User-friendly message
    details?: any; // Additional error context
  };
  timestamp: string;
}
```

### Error Codes

```typescript
enum InvitationErrorCodes {
  INVALID_EMAIL = 'INVALID_EMAIL',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  INVITATION_NOT_FOUND = 'INVITATION_NOT_FOUND',
  INVITATION_EXPIRED = 'INVITATION_EXPIRED',
  INVITATION_ALREADY_ACCEPTED = 'INVITATION_ALREADY_ACCEPTED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  PASSWORD_POLICY_VIOLATION = 'PASSWORD_POLICY_VIOLATION',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}
```

## Database Migration

### Required Changes

1. **Create UserInvitations Table:**
   - Deploy new DynamoDB table with GSIs
   - Configure TTL for automatic cleanup

2. **Update Users Table:**
   - Add optional `invitationId` field
   - Add `invitedBy` field
   - Add `onboardedAt` field

3. **Existing User Migration:**
   - Backfill existing users with `onboardedAt = createdAt`
   - Set `invitedBy = 'system'` for existing users

## Monitoring and Analytics

### CloudWatch Metrics

1. **Invitation Metrics:**
   - `InvitationsSent` - Count of invitations sent
   - `InvitationsAccepted` - Count of accepted invitations
   - `InvitationsExpired` - Count of expired invitations
   - `InvitationAcceptanceRate` - Percentage of accepted invitations

2. **Email Metrics:**
   - `EmailsSent` - SES sending metrics
   - `EmailBounces` - SES bounce tracking
   - `EmailComplaints` - SES complaint tracking

3. **Error Metrics:**
   - `InvitationErrors` - Error counts by type
   - `EmailSendFailures` - Failed email attempts

### Logging Requirements

1. **Audit Trail:**
   - Log all invitation creations, acceptances, cancellations
   - Include user IDs, timestamps, and IP addresses
   - Store in CloudWatch Logs for compliance

2. **Security Events:**
   - Failed token validation attempts
   - Rate limit violations
   - Suspicious invitation patterns

## Testing Requirements

### Unit Tests

1. **Lambda Functions:**
   - Test all invitation CRUD operations
   - Test email sending integration
   - Test token validation logic
   - Test expiration handling

2. **Validation Logic:**
   - Test email format validation
   - Test permission checks
   - Test rate limiting

### Integration Tests

1. **End-to-End Flow:**
   - Admin creates invitation → Email sent → User accepts → Account created
   - Test with different roles and permissions
   - Test expiration scenarios

2. **Email Integration:**
   - Verify SES integration works
   - Test email template rendering
   - Test bounce/complaint handling

### Load Testing

1. **Invitation Creation:**
   - Test bulk invitation scenarios
   - Verify rate limiting works
   - Test concurrent invitation requests

## Deployment Checklist

### Backend Deployment
- [ ] Deploy DynamoDB tables with proper indexes
- [ ] Deploy Lambda functions for all endpoints
- [ ] Configure API Gateway routes
- [ ] Set up SES email templates
- [ ] Configure CloudWatch monitoring
- [ ] Deploy with appropriate IAM permissions

### Frontend Integration
- [ ] Update API client with new methods
- [ ] Update AppContext with invitation actions
- [ ] Deploy new invitation management components
- [ ] Test end-to-end invitation flow
- [ ] Update user creation workflow

### Security Review
- [ ] Verify token security implementation
- [ ] Review rate limiting configuration
- [ ] Test access control restrictions
- [ ] Validate input sanitization

## Configuration

### Environment Variables

```bash
# Email Service
SES_REGION=us-east-1
SES_FROM_EMAIL=noreply@aerotage.com
SES_REPLY_TO_EMAIL=support@aerotage.com

# Invitation Settings
INVITATION_EXPIRY_DAYS=7
MAX_INVITATIONS_PER_HOUR=10
MAX_RESENDS_PER_INVITATION=3

# Frontend Integration
FRONTEND_BASE_URL=https://your-app-domain.com
INVITATION_ACCEPT_PATH=/accept-invitation

# Security
TOKEN_LENGTH_BYTES=32
HASH_ROUNDS=12
```

### AWS Permissions

Lambda execution role needs:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/UserInvitations",
        "arn:aws:dynamodb:*:*:table/UserInvitations/index/*",
        "arn:aws:dynamodb:*:*:table/Users",
        "arn:aws:dynamodb:*:*:table/Users/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendTemplatedEmail"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminUpdateUserAttributes"
      ],
      "Resource": "arn:aws:cognito-idp:*:*:userpool/*"
    }
  ]
}
```

---

## Summary

This comprehensive API specification provides the backend team with everything needed to implement user email invitations. The design prioritizes security, user experience, and integration with the existing AWS infrastructure while maintaining consistency with current application patterns.

**Key Benefits:**
- ✅ Secure invitation process with token-based validation
- ✅ Professional email communication with branded templates  
- ✅ Comprehensive admin management interface
- ✅ Seamless integration with existing authentication flow
- ✅ Full audit trail and monitoring capabilities
- ✅ Scalable architecture with rate limiting and error handling

**Next Steps:**
1. Backend team implements API endpoints in `aerotage-time-reporting-api` repository
2. Frontend team integrates invitation management UI
3. Test end-to-end invitation flow
4. Deploy to production with monitoring

For questions or clarifications, please coordinate between repositories and reference this document for implementation details. 