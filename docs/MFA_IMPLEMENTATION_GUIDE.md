# Multi-Factor Authentication (MFA) Implementation Guide

## 🔐 **Aerotage Time Reporting API - MFA Enhancement**

This guide provides a comprehensive implementation plan for adding Multi-Factor Authentication (MFA) to the Aerotage Time Reporting API, including both backend and frontend changes.

---

## 📋 **Overview**

### **Current State**
- AWS Cognito User Pool with basic authentication
- JWT-based session management
- Role-based access control (Admin, Manager, Employee)
- Optional MFA available but not enforced

### **Target State**
- **Mandatory MFA for Admin accounts**
- **Optional MFA for Manager/Employee accounts**
- **TOTP (Time-based One-Time Password) support**
- **SMS backup option**
- **Recovery codes for account recovery**
- **Seamless frontend integration**

---

## 🏗️ **Implementation Architecture**

### **Backend Changes Required**
1. **Cognito User Pool Configuration**
2. **Lambda Function Updates**
3. **API Endpoint Enhancements**
4. **Database Schema Updates**
5. **Security Policy Updates**

### **Frontend Changes Required**
1. **MFA Setup Flow**
2. **Login Flow Enhancement**
3. **Account Settings Integration**
4. **Recovery Code Management**
5. **Admin MFA Enforcement**

---

## 🔧 **Phase 1: Backend Implementation**

### **1.1 Cognito User Pool Configuration**

#### **Update Cognito Stack**
```typescript
// infrastructure/lib/cognito-stack.ts
export class CognitoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    // ... existing code ...

    // Enhanced MFA Configuration
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      // ... existing configuration ...
      
      // MFA Configuration
      mfa: cognito.Mfa.OPTIONAL, // Start with optional, enforce via policy
      mfaSecondFactor: {
        sms: true,
        otp: true, // TOTP support
      },
      
      // Advanced Security Features
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: true,
      },
      
      // Account Recovery
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      
      // Custom attributes for MFA tracking
      customAttributes: {
        'mfa_enabled': new cognito.BooleanAttribute({ mutable: true }),
        'mfa_method': new cognito.StringAttribute({ mutable: true }),
        'recovery_codes_generated': new cognito.BooleanAttribute({ mutable: true }),
        'admin_mfa_enforced': new cognito.BooleanAttribute({ mutable: true }),
      },
    });
  }
}
```

### **1.2 Database Schema Updates**

#### **MFA Settings Table**
```typescript
// infrastructure/lib/database-stack.ts
const userMfaSettingsTable = new dynamodb.Table(this, 'UserMfaSettingsTable', {
  tableName: `aerotage-user-mfa-settings-${stage}`,
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  pointInTimeRecovery: stage === 'prod',
  removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
});

// Recovery Codes Table
const mfaRecoveryCodesTable = new dynamodb.Table(this, 'MfaRecoveryCodesTable', {
  tableName: `aerotage-mfa-recovery-codes-${stage}`,
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'codeHash', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  timeToLiveAttribute: 'expiresAt',
  pointInTimeRecovery: stage === 'prod',
  removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
});
```

### **1.3 New API Endpoints**

#### **MFA Management Endpoints**
```typescript
// New endpoints to add to API Stack
const mfaResource = api.root.addResource('mfa');

// MFA Setup and Management
const setupResource = mfaResource.addResource('setup');
const verifyResource = mfaResource.addResource('verify');
const disableResource = mfaResource.addResource('disable');
const recoveryResource = mfaResource.addResource('recovery');

// Admin MFA Enforcement
const adminResource = api.root.addResource('admin');
const enforceMfaResource = adminResource.addResource('enforce-mfa');
```

### **1.4 Lambda Function Implementation**

#### **MFA Setup Lambda Function**
```typescript
// infrastructure/lambda/mfa/setup-mfa.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, AssociateSoftwareTokenCommand, VerifySoftwareTokenCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';

// PowerTools v2.x imports
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools v2.x middleware
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    addRequestContext(event.requestContext?.requestId || 'unknown');
    
    logger.info('MFA setup request received', {
      httpMethod: event.httpMethod,
      path: event.path,
    });

    // Authentication
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      metrics.addMetric('MfaSetupUnauthorized', MetricUnit.Count, 1);
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Get access token from Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const accessToken = authHeader?.replace('Bearer ', '') || '';

    if (!accessToken) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'Access token required for MFA setup');
    }

    // Associate software token with user account
    const associateCommand = new AssociateSoftwareTokenCommand({
      AccessToken: accessToken,
    });

    const associateResult = await businessTracer.traceBusinessOperation(
      'associate-software-token',
      'mfa',
      async () => {
        return await cognitoClient.send(associateCommand);
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/mfa/setup', 'POST', 200, responseTime);
    metrics.addMetric('MfaSetupInitiated', MetricUnit.Count, 1);
    businessLogger.logBusinessOperation('setup', 'mfa', currentUserId, true, { 
      userRole,
      secretCodeGenerated: !!associateResult.SecretCode
    });

    logger.info('MFA setup initiated successfully', {
      userId: currentUserId,
      userRole,
      responseTime
    });

    return createSuccessResponse({
      secretCode: associateResult.SecretCode,
      qrCodeUrl: `otpauth://totp/Aerotage:${user?.email}?secret=${associateResult.SecretCode}&issuer=Aerotage`,
      backupCodes: [], // Will be generated after verification
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('MFA setup error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    businessMetrics.trackApiPerformance('/mfa/setup', 'POST', 500, responseTime);
    metrics.addMetric('MfaSetupError', MetricUnit.Count, 1);
    
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to setup MFA');
  }
};

export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics));
```

#### **MFA Verification Lambda Function**
```typescript
// infrastructure/lambda/mfa/verify-mfa.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, VerifySoftwareTokenCommand, SetUserMFAPreferenceCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { MfaRepository } from '../shared/mfa-repository';

// PowerTools v2.x imports
import { logger, businessLogger, addRequestContext } from '../shared/powertools-logger';
import { tracer, businessTracer } from '../shared/powertools-tracer';
import { metrics, businessMetrics } from '../shared/powertools-metrics';
import { MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools v2.x middleware
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import middy from '@middy/core';

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const mfaRepo = new MfaRepository();

interface VerifyMfaRequest {
  totpCode: string;
  deviceName?: string;
}

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    addRequestContext(event.requestContext?.requestId || 'unknown');
    
    logger.info('MFA verification request received', {
      httpMethod: event.httpMethod,
      path: event.path,
    });

    // Authentication
    const currentUserId = getCurrentUserId(event);
    if (!currentUserId) {
      metrics.addMetric('MfaVerifyUnauthorized', MetricUnit.Count, 1);
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required');
    }

    const requestBody: VerifyMfaRequest = JSON.parse(event.body);

    if (!requestBody.totpCode || requestBody.totpCode.length !== 6) {
      return createErrorResponse(400, 'INVALID_TOTP_CODE', 'Valid 6-digit TOTP code is required');
    }

    // Get access token
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const accessToken = authHeader?.replace('Bearer ', '') || '';

    // Verify software token
    const verifyCommand = new VerifySoftwareTokenCommand({
      AccessToken: accessToken,
      UserCode: requestBody.totpCode,
      FriendlyDeviceName: requestBody.deviceName || 'TOTP Device',
    });

    const verifyResult = await businessTracer.traceBusinessOperation(
      'verify-software-token',
      'mfa',
      async () => {
        return await cognitoClient.send(verifyCommand);
      }
    );

    if (verifyResult.Status !== 'SUCCESS') {
      const responseTime = Date.now() - startTime;
      businessMetrics.trackApiPerformance('/mfa/verify', 'POST', 400, responseTime);
      metrics.addMetric('MfaVerifyFailed', MetricUnit.Count, 1);
      businessLogger.logSecurity('mfa_verification_failed', currentUserId, 'medium', { 
        userRole,
        totpCodeLength: requestBody.totpCode.length
      });
      
      return createErrorResponse(400, 'INVALID_TOTP_CODE', 'Invalid TOTP code');
    }

    // Enable TOTP MFA for the user
    const setMfaCommand = new SetUserMFAPreferenceCommand({
      AccessToken: accessToken,
      SoftwareTokenMfaSettings: {
        Enabled: true,
        PreferredMfa: true,
      },
    });

    await businessTracer.traceBusinessOperation(
      'enable-totp-mfa',
      'mfa',
      async () => {
        return await cognitoClient.send(setMfaCommand);
      }
    );

    // Generate recovery codes
    const recoveryCodes = await businessTracer.traceBusinessOperation(
      'generate-recovery-codes',
      'mfa',
      async () => {
        return await mfaRepo.generateRecoveryCodes(currentUserId);
      }
    );

    // Save MFA settings
    await businessTracer.traceDatabaseOperation(
      'save-mfa-settings',
      'mfa-settings',
      async () => {
        return await mfaRepo.saveMfaSettings(currentUserId, {
          mfaEnabled: true,
          mfaMethod: 'totp',
          deviceName: requestBody.deviceName || 'TOTP Device',
          enabledAt: new Date().toISOString(),
          recoveryCodesGenerated: true,
        });
      }
    );

    const responseTime = Date.now() - startTime;

    // Track success metrics
    businessMetrics.trackApiPerformance('/mfa/verify', 'POST', 200, responseTime);
    metrics.addMetric('MfaVerifySuccess', MetricUnit.Count, 1);
    businessLogger.logBusinessOperation('verify', 'mfa', currentUserId, true, { 
      userRole,
      mfaMethod: 'totp',
      deviceName: requestBody.deviceName || 'TOTP Device',
      recoveryCodesGenerated: true
    });

    logger.info('MFA verification successful', {
      userId: currentUserId,
      userRole,
      mfaMethod: 'totp',
      responseTime
    });

    return createSuccessResponse({
      mfaEnabled: true,
      method: 'totp',
      recoveryCodes: recoveryCodes,
      message: 'MFA has been successfully enabled for your account',
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('MFA verification error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    businessMetrics.trackApiPerformance('/mfa/verify', 'POST', 500, responseTime);
    metrics.addMetric('MfaVerifyError', MetricUnit.Count, 1);
    
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to verify MFA');
  }
};

export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics));
```

---

## 📱 **Phase 2: Frontend Implementation**

### **2.1 MFA Setup Flow**

#### **Setup Component Structure**
```typescript
// Frontend component structure
src/
├── components/
│   ├── auth/
│   │   ├── MfaSetup.tsx
│   │   ├── MfaVerification.tsx
│   │   ├── RecoveryCodeDisplay.tsx
│   │   └── MfaLoginChallenge.tsx
│   ├── settings/
│   │   ├── SecuritySettings.tsx
│   │   └── MfaManagement.tsx
│   └── admin/
│       └── MfaEnforcement.tsx
```

#### **MFA Setup Component**
```typescript
// src/components/auth/MfaSetup.tsx
import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../hooks/useAuth';
import { mfaService } from '../../services/mfaService';

interface MfaSetupProps {
  onComplete: (recoveryCodes: string[]) => void;
  onCancel: () => void;
  isRequired?: boolean;
}

export const MfaSetup: React.FC<MfaSetupProps> = ({ onComplete, onCancel, isRequired = false }) => {
  const [step, setStep] = useState<'setup' | 'verify' | 'recovery'>('setup');
  const [secretCode, setSecretCode] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [totpCode, setTotpCode] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const { user } = useAuth();

  useEffect(() => {
    initiateMfaSetup();
  }, []);

  const initiateMfaSetup = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await mfaService.setupMfa();
      setSecretCode(response.secretCode);
      setQrCodeUrl(response.qrCodeUrl);
      setStep('verify');
    } catch (err) {
      setError('Failed to initiate MFA setup. Please try again.');
      console.error('MFA setup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const verifyMfaSetup = async () => {
    if (totpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await mfaService.verifyMfa({
        totpCode,
        deviceName: deviceName || 'My Device',
      });
      
      setRecoveryCodes(response.recoveryCodes);
      setStep('recovery');
    } catch (err) {
      setError('Invalid verification code. Please try again.');
      console.error('MFA verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const completeMfaSetup = () => {
    onComplete(recoveryCodes);
  };

  if (step === 'setup' || loading) {
    return (
      <div className="mfa-setup-container">
        <div className="mfa-setup-card">
          <h2>Setting up Multi-Factor Authentication</h2>
          {loading ? (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Generating your MFA secret...</p>
            </div>
          ) : (
            <div className="setup-instructions">
              <p>We're preparing your MFA setup. This will only take a moment.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="mfa-setup-container">
        <div className="mfa-setup-card">
          <h2>Set Up Authenticator App</h2>
          
          <div className="setup-steps">
            <div className="step">
              <h3>Step 1: Scan QR Code</h3>
              <p>Use your authenticator app (Google Authenticator, Authy, etc.) to scan this QR code:</p>
              
              <div className="qr-code-container">
                <QRCodeSVG value={qrCodeUrl} size={200} />
              </div>
              
              <details className="manual-entry">
                <summary>Can't scan? Enter manually</summary>
                <div className="secret-code">
                  <p>Secret Key: <code>{secretCode}</code></p>
                  <button 
                    type="button" 
                    onClick={() => navigator.clipboard.writeText(secretCode)}
                    className="copy-button"
                  >
                    Copy
                  </button>
                </div>
              </details>
            </div>

            <div className="step">
              <h3>Step 2: Enter Verification Code</h3>
              <p>Enter the 6-digit code from your authenticator app:</p>
              
              <div className="form-group">
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="totp-input"
                  maxLength={6}
                />
              </div>

              <div className="form-group">
                <label htmlFor="deviceName">Device Name (Optional)</label>
                <input
                  id="deviceName"
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="My Phone"
                  className="device-name-input"
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="button-group">
                <button
                  type="button"
                  onClick={verifyMfaSetup}
                  disabled={loading || totpCode.length !== 6}
                  className="verify-button primary"
                >
                  {loading ? 'Verifying...' : 'Verify & Enable MFA'}
                </button>
                
                {!isRequired && (
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={loading}
                    className="cancel-button secondary"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'recovery') {
    return (
      <div className="mfa-setup-container">
        <div className="mfa-setup-card">
          <h2>Save Your Recovery Codes</h2>
          
          <div className="recovery-codes-section">
            <div className="warning-message">
              <strong>Important:</strong> Save these recovery codes in a safe place. 
              You can use them to access your account if you lose your authenticator device.
            </div>

            <div className="recovery-codes-grid">
              {recoveryCodes.map((code, index) => (
                <div key={index} className="recovery-code">
                  {code}
                </div>
              ))}
            </div>

            <div className="recovery-actions">
              <button
                type="button"
                onClick={() => {
                  const codesText = recoveryCodes.join('\n');
                  navigator.clipboard.writeText(codesText);
                }}
                className="copy-codes-button secondary"
              >
                Copy All Codes
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const element = document.createElement('a');
                  const file = new Blob([recoveryCodes.join('\n')], { type: 'text/plain' });
                  element.href = URL.createObjectURL(file);
                  element.download = 'aerotage-recovery-codes.txt';
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
                }}
                className="download-codes-button secondary"
              >
                Download Codes
              </button>
            </div>

            <div className="completion-section">
              <div className="success-message">
                <strong>MFA Successfully Enabled!</strong> Your account is now protected with two-factor authentication.
              </div>

              <button
                type="button"
                onClick={completeMfaSetup}
                className="complete-button primary"
              >
                Complete Setup
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
```

### **2.2 User Experience Flow**

#### **For New Users (Admin Accounts)**
1. **Account Creation** → **Immediate MFA Setup Required**
2. **QR Code Display** → **TOTP App Configuration**
3. **Verification** → **Recovery Codes Generation**
4. **Account Activation** → **Full Access Granted**

#### **For Existing Users**
1. **Login Notification** → **MFA Setup Recommended/Required**
2. **Gradual Rollout** → **Grace Period for Setup**
3. **Admin Enforcement** → **Mandatory for Admin Roles**

---

## 🔒 **Phase 3: Security Implementation**

### **3.1 MFA Enforcement Policies**

#### **Role-Based MFA Requirements**
```typescript
interface MfaPolicy {
  admin: {
    required: true;
    gracePeriod: 0; // Immediate enforcement
    allowedMethods: ['totp', 'sms'];
    recoveryCodesRequired: true;
  };
  manager: {
    required: false; // Optional but recommended
    gracePeriod: 30; // 30 days to setup
    allowedMethods: ['totp', 'sms'];
    recoveryCodesRequired: true;
  };
  employee: {
    required: false; // Optional
    gracePeriod: 90; // 90 days to setup
    allowedMethods: ['totp', 'sms'];
    recoveryCodesRequired: false;
  };
}
```

### **3.2 Recovery Code System**

#### **Recovery Code Generation**
```typescript
// Generate 10 single-use recovery codes
const generateRecoveryCodes = (): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
};
```

### **3.3 MFA Repository Implementation**

#### **MFA Repository Class**
```typescript
// infrastructure/lambda/shared/mfa-repository.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { createHash, randomBytes } from 'crypto';

export interface MfaSettings {
  userId: string;
  mfaEnabled: boolean;
  mfaMethod: 'totp' | 'sms';
  deviceName?: string;
  enabledAt: string;
  recoveryCodesGenerated: boolean;
  lastUsed?: string;
}

export interface RecoveryCode {
  userId: string;
  codeHash: string;
  used: boolean;
  usedAt?: string;
  expiresAt: number;
}

export class MfaRepository {
  private docClient: DynamoDBDocumentClient;
  private mfaSettingsTableName: string;
  private recoveryCodesTableName: string;

  constructor() {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.mfaSettingsTableName = process.env.MFA_SETTINGS_TABLE_NAME || '';
    this.recoveryCodesTableName = process.env.MFA_RECOVERY_CODES_TABLE_NAME || '';
  }

  async saveMfaSettings(userId: string, settings: Omit<MfaSettings, 'userId'>): Promise<void> {
    const command = new PutCommand({
      TableName: this.mfaSettingsTableName,
      Item: {
        userId,
        ...settings,
        updatedAt: new Date().toISOString(),
      },
    });

    await this.docClient.send(command);
  }

  async getMfaSettings(userId: string): Promise<MfaSettings | null> {
    const command = new GetCommand({
      TableName: this.mfaSettingsTableName,
      Key: { userId },
    });

    const result = await this.docClient.send(command);
    return result.Item as MfaSettings || null;
  }

  async generateRecoveryCodes(userId: string): Promise<string[]> {
    const codes: string[] = [];
    const codeHashes: string[] = [];
    
    // Generate 10 recovery codes
    for (let i = 0; i < 10; i++) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      const codeHash = createHash('sha256').update(code).digest('hex');
      
      codes.push(code);
      codeHashes.push(codeHash);
    }

    // Save hashed codes to database
    const expiresAt = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year expiry
    
    for (const codeHash of codeHashes) {
      const command = new PutCommand({
        TableName: this.recoveryCodesTableName,
        Item: {
          userId,
          codeHash,
          used: false,
          expiresAt,
          createdAt: new Date().toISOString(),
        },
      });

      await this.docClient.send(command);
    }

    return codes;
  }

  async validateRecoveryCode(userId: string, code: string): Promise<boolean> {
    const codeHash = createHash('sha256').update(code).digest('hex');
    
    const command = new GetCommand({
      TableName: this.recoveryCodesTableName,
      Key: { userId, codeHash },
    });

    const result = await this.docClient.send(command);
    const recoveryCode = result.Item as RecoveryCode;

    if (!recoveryCode || recoveryCode.used || recoveryCode.expiresAt < Math.floor(Date.now() / 1000)) {
      return false;
    }

    // Mark code as used
    const updateCommand = new PutCommand({
      TableName: this.recoveryCodesTableName,
      Item: {
        ...recoveryCode,
        used: true,
        usedAt: new Date().toISOString(),
      },
    });

    await this.docClient.send(updateCommand);
    return true;
  }

  async getRemainingRecoveryCodes(userId: string): Promise<number> {
    const command = new QueryCommand({
      TableName: this.recoveryCodesTableName,
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: '#used = :used AND expiresAt > :now',
      ExpressionAttributeNames: {
        '#used': 'used',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':used': false,
        ':now': Math.floor(Date.now() / 1000),
      },
    });

    const result = await this.docClient.send(command);
    return result.Items?.length || 0;
  }

  async disableMfa(userId: string): Promise<void> {
    // Update MFA settings
    const command = new PutCommand({
      TableName: this.mfaSettingsTableName,
      Item: {
        userId,
        mfaEnabled: false,
        disabledAt: new Date().toISOString(),
      },
    });

    await this.docClient.send(command);

    // Delete all unused recovery codes
    const queryCommand = new QueryCommand({
      TableName: this.recoveryCodesTableName,
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: '#used = :used',
      ExpressionAttributeNames: {
        '#used': 'used',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':used': false,
      },
    });

    const result = await this.docClient.send(queryCommand);
    
    if (result.Items) {
      for (const item of result.Items) {
        const deleteCommand = new DeleteCommand({
          TableName: this.recoveryCodesTableName,
          Key: { userId, codeHash: item.codeHash },
        });
        
        await this.docClient.send(deleteCommand);
      }
    }
  }
}
```

---

## 🚀 **Implementation Timeline**

### **Week 1: Backend Foundation**
- [ ] Update Cognito User Pool configuration
- [ ] Create MFA database tables
- [ ] Implement MFA setup Lambda functions
- [ ] Add MFA verification endpoints

### **Week 2: Core MFA Logic**
- [ ] TOTP setup and verification
- [ ] SMS backup implementation
- [ ] Recovery code generation and validation
- [ ] Admin enforcement logic

### **Week 3: Frontend Integration**
- [ ] MFA setup components
- [ ] Login flow enhancement
- [ ] Settings page integration
- [ ] Admin enforcement UI

### **Week 4: Testing & Deployment**
- [ ] Comprehensive testing
- [ ] Security validation
- [ ] Gradual rollout plan
- [ ] Documentation updates

---

## 📋 **Next Steps**

1. **Review and Approve** this implementation plan
2. **Create detailed technical specifications** for each component
3. **Begin with Cognito configuration updates**
4. **Implement backend Lambda functions**
5. **Develop frontend components**
6. **Conduct security testing**
7. **Plan gradual rollout strategy**

---

**This guide provides the foundation for implementing enterprise-grade MFA in the Aerotage Time Reporting API while maintaining user experience and security best practices.** 