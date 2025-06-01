# Google OAuth Login Implementation Guide

## 🔐 **Aerotage Time Reporting API - Google OAuth Integration**

This guide provides a comprehensive implementation plan for adding Google OAuth 2.0 login to the Aerotage Time Reporting API, leveraging AWS Cognito's federated identity capabilities.

---

## 📋 **Overview**

### **Current State**
- AWS Cognito User Pool with email/password authentication
- Admin-only user creation (no self-signup)
- Role-based access control (Admin, Manager, Employee)
- MFA support (optional/mandatory based on role)

### **Target State**
- **Google OAuth 2.0 integration** via Cognito Identity Providers
- **Seamless "Sign in with Google" experience**
- **Automatic user provisioning** with role assignment
- **Existing user linking** for users with matching emails
- **Maintained security and audit capabilities**
- **Backward compatibility** with existing email/password login

---

## 🏗️ **Implementation Architecture**

### **Backend Changes Required**
1. **Google Cloud Console Setup** - OAuth 2.0 credentials
2. **Cognito User Pool Configuration** - Google Identity Provider
3. **Lambda Triggers** - User provisioning and attribute mapping
4. **API Endpoint Updates** - OAuth callback handling
5. **Database Schema Updates** - External identity tracking

### **Frontend Changes Required**
1. **Google Sign-In Button** - Official Google SDK integration
2. **OAuth Flow Handling** - Redirect and callback management
3. **User Onboarding** - Role assignment and profile completion
4. **Account Linking** - Merge existing accounts with Google login
5. **Settings Integration** - Manage connected accounts

---

## 🔧 **Phase 1: Google Cloud Console Setup**

### **1.1 Create Google OAuth 2.0 Credentials**

#### **Step 1: Google Cloud Console Configuration**
```bash
# 1. Go to Google Cloud Console (https://console.cloud.google.com/)
# 2. Create a new project or select existing project
# 3. Enable Google+ API (required for OAuth)
# 4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
```

#### **Step 2: OAuth Client Configuration**
```javascript
// OAuth 2.0 Client Configuration
{
  "application_type": "web",
  "authorized_javascript_origins": [
    "https://your-frontend-domain.com",
    "http://localhost:3000" // For development
  ],
  "authorized_redirect_uris": [
    "https://aerotage-time-dev.auth.us-east-1.amazoncognito.com/oauth2/idpresponse",
    "https://aerotage-time-staging.auth.us-east-1.amazoncognito.com/oauth2/idpresponse",
    "https://aerotage-time-prod.auth.us-east-1.amazoncognito.com/oauth2/idpresponse"
  ]
}
```

#### **Step 3: Required Scopes**
```javascript
// Google OAuth Scopes
const requiredScopes = [
  'openid',           // Required for OpenID Connect
  'email',            // User's email address
  'profile',          // Basic profile information
];
```

---

## 🔧 **Phase 2: AWS Cognito Configuration**

### **2.1 Update Cognito Stack**

#### **Enhanced Cognito User Pool Configuration**
```typescript
// infrastructure/lib/cognito-stack.ts
export class CognitoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    // ... existing code ...

    // ✅ UPDATED: User Pool with Google Identity Provider support
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      // ... existing configuration ...
      
      // ✅ NEW: Lambda triggers for Google OAuth user provisioning
      lambdaTriggers: {
        preSignUp: this.createPreSignUpTrigger(),
        postConfirmation: this.createPostConfirmationTrigger(),
        preAuthentication: this.createPreAuthenticationTrigger(),
      },
      
      // ✅ UPDATED: Support for federated identities
      signInAliases: {
        email: true,
        username: false, // Disable username to avoid conflicts
      },
      
      // ✅ NEW: Auto-verify email for federated users
      autoVerify: {
        email: true,
      },
    });

    // ✅ NEW: Google Identity Provider
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool: this.userPool,
      clientId: process.env.GOOGLE_CLIENT_ID || '', // From Google Cloud Console
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '', // From Google Cloud Console
      
      // ✅ CRITICAL: Attribute mapping from Google to Cognito
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
        profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        // Custom attributes will be handled in Lambda triggers
      },
      
      // ✅ REQUIRED: OAuth scopes
      scopes: ['openid', 'email', 'profile'],
    });

    // ✅ UPDATED: User Pool Client with Google provider support
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `aerotage-time-client-${stage}`,
      generateSecret: false,
      
      // ✅ UPDATED: Support Google identity provider
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      
      // ✅ NEW: OAuth configuration
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false, // More secure to use authorization code
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'https://your-frontend-domain.com/auth/callback',
          'http://localhost:3000/auth/callback', // Development
        ],
        logoutUrls: [
          'https://your-frontend-domain.com/auth/logout',
          'http://localhost:3000/auth/logout', // Development
        ],
      },
      
      // ... existing configuration ...
    });

    // ✅ IMPORTANT: Ensure Google provider is created before client
    this.userPoolClient.node.addDependency(googleProvider);
  }

  // ✅ NEW: Lambda trigger for handling Google OAuth user creation
  private createPreSignUpTrigger(): lambda.Function {
    return new lambdaNodejs.NodejsFunction(this, 'PreSignUpTrigger', {
      functionName: `aerotage-pre-signup-${this.stage}`,
      entry: 'lambda/auth/pre-signup-trigger.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.stage,
        USERS_TABLE: this.usersTableName,
        // PowerTools configuration
        POWERTOOLS_SERVICE_NAME: 'aerotage-auth',
        POWERTOOLS_LOG_LEVEL: 'INFO',
      },
    });
  }
}
```

### **2.2 Lambda Triggers Implementation**

#### **Pre-Signup Trigger for Google OAuth Users**
```typescript
// infrastructure/lambda/auth/pre-signup-trigger.ts
import { PreSignUpTriggerEvent, PreSignUpTriggerResult } from 'aws-lambda';
import { UserRepository } from '../shared/user-repository';

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

const userRepo = new UserRepository();

const lambdaHandler = async (event: PreSignUpTriggerEvent): Promise<PreSignUpTriggerResult> => {
  const startTime = Date.now();
  
  try {
    addRequestContext(event.request.userAttributes.sub || 'unknown');
    
    logger.info('Pre-signup trigger received', {
      triggerSource: event.triggerSource,
      userPoolId: event.userPoolId,
      userName: event.userName,
      userAttributes: event.request.userAttributes,
    });

    // Check if this is a Google OAuth signup
    const isGoogleOAuth = event.triggerSource === 'PreSignUp_ExternalProvider';
    const email = event.request.userAttributes.email;

    if (isGoogleOAuth && email) {
      // Check if user already exists in our system
      const existingUser = await businessTracer.traceDatabaseOperation(
        'check-existing-user',
        'users-table',
        async () => {
          return await userRepo.getUserByEmail(email);
        }
      );

      if (existingUser) {
        // User exists - we'll link the accounts in post-confirmation
        logger.info('Existing user found for Google OAuth signup', {
          email,
          existingUserId: existingUser.userId,
          existingRole: existingUser.role,
        });

        // Auto-confirm the user since they're signing up via Google
        event.response.autoConfirmUser = true;
        event.response.autoVerifyEmail = true;

        // Set custom attributes based on existing user
        event.response.userAttributes = {
          ...event.request.userAttributes,
          'custom:role': existingUser.role,
          'custom:hourlyRate': existingUser.hourlyRate?.toString() || '0',
          'custom:teamId': existingUser.teamId || '',
          'custom:department': existingUser.department || '',
        };

        businessLogger.logBusinessOperation('link-google-account', 'auth', existingUser.userId, true, {
          email,
          provider: 'google',
          existingRole: existingUser.role,
        });

      } else {
        // New user - check if Google OAuth signup is allowed
        const allowGoogleSignup = process.env.ALLOW_GOOGLE_SIGNUP === 'true';
        
        if (!allowGoogleSignup) {
          // Block signup - admin must create user first
          logger.warn('Google OAuth signup blocked - admin approval required', {
            email,
            provider: 'google',
          });

          businessLogger.logSecurity('unauthorized_google_signup', email, 'medium', {
            email,
            provider: 'google',
            reason: 'admin_approval_required',
          });

          throw new Error('Account must be created by an administrator before Google login is allowed');
        }

        // Allow signup with default employee role
        event.response.autoConfirmUser = true;
        event.response.autoVerifyEmail = true;

        // Set default attributes for new Google users
        event.response.userAttributes = {
          ...event.request.userAttributes,
          'custom:role': 'employee', // Default role
          'custom:hourlyRate': '0',
          'custom:teamId': '',
          'custom:department': '',
        };

        logger.info('New Google OAuth user approved', {
          email,
          defaultRole: 'employee',
        });

        businessLogger.logBusinessOperation('create-google-user', 'auth', email, true, {
          email,
          provider: 'google',
          defaultRole: 'employee',
        });
      }

      metrics.addMetric('GoogleOAuthSignup', MetricUnit.Count, 1);
    }

    const responseTime = Date.now() - startTime;
    businessMetrics.trackApiPerformance('/auth/pre-signup', 'TRIGGER', 200, responseTime);

    logger.info('Pre-signup trigger completed successfully', {
      triggerSource: event.triggerSource,
      email,
      responseTime,
    });

    return event;

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Pre-signup trigger error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      triggerSource: event.triggerSource,
      responseTime,
    });

    businessMetrics.trackApiPerformance('/auth/pre-signup', 'TRIGGER', 500, responseTime);
    metrics.addMetric('GoogleOAuthSignupError', MetricUnit.Count, 1);

    // Re-throw to block the signup
    throw error;
  }
};

export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics));
```

#### **Post-Confirmation Trigger for Account Linking**
```typescript
// infrastructure/lambda/auth/post-confirmation-trigger.ts
import { PostConfirmationTriggerEvent, PostConfirmationTriggerResult } from 'aws-lambda';
import { UserRepository } from '../shared/user-repository';

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

const userRepo = new UserRepository();

const lambdaHandler = async (event: PostConfirmationTriggerEvent): Promise<PostConfirmationTriggerResult> => {
  const startTime = Date.now();
  
  try {
    addRequestContext(event.request.userAttributes.sub || 'unknown');
    
    logger.info('Post-confirmation trigger received', {
      triggerSource: event.triggerSource,
      userPoolId: event.userPoolId,
      userName: event.userName,
      userAttributes: event.request.userAttributes,
    });

    const cognitoUserId = event.request.userAttributes.sub;
    const email = event.request.userAttributes.email;
    const isGoogleOAuth = event.triggerSource === 'PostConfirmation_ConfirmSignUp' && 
                         event.userName.startsWith('Google_');

    if (isGoogleOAuth && email && cognitoUserId) {
      // Check if we need to link to existing user or create new user record
      const existingUser = await businessTracer.traceDatabaseOperation(
        'check-existing-user',
        'users-table',
        async () => {
          return await userRepo.getUserByEmail(email);
        }
      );

      if (existingUser) {
        // Link Google account to existing user
        await businessTracer.traceDatabaseOperation(
          'link-google-account',
          'users-table',
          async () => {
            return await userRepo.linkExternalProvider(existingUser.userId, {
              provider: 'google',
              providerId: cognitoUserId,
              email: email,
              linkedAt: new Date().toISOString(),
            });
          }
        );

        logger.info('Google account linked to existing user', {
          userId: existingUser.userId,
          email,
          cognitoUserId,
        });

        businessLogger.logBusinessOperation('link-google-account', 'auth', existingUser.userId, true, {
          email,
          provider: 'google',
          cognitoUserId,
        });

      } else {
        // Create new user record for Google OAuth user
        const newUser = {
          userId: cognitoUserId,
          email: email,
          firstName: event.request.userAttributes.given_name || '',
          lastName: event.request.userAttributes.family_name || '',
          role: event.request.userAttributes['custom:role'] || 'employee',
          hourlyRate: parseFloat(event.request.userAttributes['custom:hourlyRate'] || '0'),
          teamId: event.request.userAttributes['custom:teamId'] || null,
          department: event.request.userAttributes['custom:department'] || null,
          profilePicture: event.request.userAttributes.picture || null,
          authProvider: 'google',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true,
        };

        await businessTracer.traceDatabaseOperation(
          'create-google-user',
          'users-table',
          async () => {
            return await userRepo.createUser(newUser);
          }
        );

        logger.info('New user created for Google OAuth', {
          userId: cognitoUserId,
          email,
          role: newUser.role,
        });

        businessLogger.logBusinessOperation('create-google-user', 'auth', cognitoUserId, true, {
          email,
          provider: 'google',
          role: newUser.role,
        });
      }

      metrics.addMetric('GoogleOAuthConfirmation', MetricUnit.Count, 1);
    }

    const responseTime = Date.now() - startTime;
    businessMetrics.trackApiPerformance('/auth/post-confirmation', 'TRIGGER', 200, responseTime);

    logger.info('Post-confirmation trigger completed successfully', {
      triggerSource: event.triggerSource,
      email,
      responseTime,
    });

    return event;

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Post-confirmation trigger error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      triggerSource: event.triggerSource,
      responseTime,
    });

    businessMetrics.trackApiPerformance('/auth/post-confirmation', 'TRIGGER', 500, responseTime);
    metrics.addMetric('GoogleOAuthConfirmationError', MetricUnit.Count, 1);

    // Don't throw - we don't want to block the user's login
    logger.warn('Continuing despite post-confirmation error');
    return event;
  }
};

export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(logMetrics(metrics));
```

---

## 📱 **Phase 3: Frontend Implementation**

### **3.1 Google Sign-In Integration**

#### **Install Google SDK**
```bash
# Install Google OAuth SDK
npm install @google-cloud/oauth2 google-auth-library
npm install @types/google-auth-library --save-dev

# Install AWS Amplify for Cognito integration
npm install aws-amplify @aws-amplify/auth
```

#### **Google Sign-In Component**
```typescript
// src/components/auth/GoogleSignIn.tsx
import React, { useState } from 'react';
import { Auth } from 'aws-amplify';
import { CognitoHostedUIIdentityProvider } from '@aws-amplify/auth';

interface GoogleSignInProps {
  onSuccess: (user: any) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export const GoogleSignIn: React.FC<GoogleSignInProps> = ({ 
  onSuccess, 
  onError, 
  disabled = false 
}) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      
      // Use Cognito Hosted UI for Google OAuth
      await Auth.federatedSignIn({
        provider: CognitoHostedUIIdentityProvider.Google
      });
      
      // The user will be redirected to Google OAuth flow
      // Success handling will happen in the callback component
      
    } catch (error) {
      setLoading(false);
      console.error('Google sign-in error:', error);
      onError('Failed to initiate Google sign-in. Please try again.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={disabled || loading}
      className="google-signin-button"
    >
      <div className="google-signin-content">
        <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span className="google-signin-text">
          {loading ? 'Signing in...' : 'Continue with Google'}
        </span>
      </div>
    </button>
  );
};
```

#### **OAuth Callback Handler**
```typescript
// src/components/auth/OAuthCallback.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Auth } from 'aws-amplify';
import { useAuth } from '../../hooks/useAuth';

export const OAuthCallback: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      // Check for OAuth error parameters
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (errorParam) {
        throw new Error(errorDescription || 'OAuth authentication failed');
      }

      // Get the current authenticated user
      const user = await Auth.currentAuthenticatedUser();
      
      if (user) {
        // Extract user information
        const userInfo = {
          userId: user.attributes.sub,
          email: user.attributes.email,
          firstName: user.attributes.given_name || '',
          lastName: user.attributes.family_name || '',
          role: user.attributes['custom:role'] || 'employee',
          profilePicture: user.attributes.picture || null,
          authProvider: user.attributes.identities ? 'google' : 'cognito',
        };

        setUser(userInfo);

        // Check if this is a first-time Google user who needs role assignment
        if (userInfo.authProvider === 'google' && userInfo.role === 'employee') {
          // Redirect to role assignment/onboarding flow
          navigate('/auth/complete-profile', { 
            state: { isNewGoogleUser: true, userInfo } 
          });
        } else {
          // Redirect to dashboard
          navigate('/dashboard');
        }
      } else {
        throw new Error('No authenticated user found');
      }

    } catch (error) {
      console.error('OAuth callback error:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
      
      // Redirect to login with error
      setTimeout(() => {
        navigate('/login', { 
          state: { error: 'Google sign-in failed. Please try again.' } 
        });
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="oauth-callback-container">
        <div className="oauth-callback-card">
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
          <h2>Completing Google Sign-In</h2>
          <p>Please wait while we set up your account...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="oauth-callback-container">
        <div className="oauth-callback-card error">
          <h2>Sign-In Failed</h2>
          <p>{error}</p>
          <p>Redirecting to login page...</p>
        </div>
      </div>
    );
  }

  return null;
};
```

### **3.2 Enhanced Login Component**

#### **Updated Login Form with Google Integration**
```typescript
// src/components/auth/LoginForm.tsx
import React, { useState } from 'react';
import { Auth } from 'aws-amplify';
import { GoogleSignIn } from './GoogleSignIn';
import { useAuth } from '../../hooks/useAuth';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuth();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');

      const user = await Auth.signIn(email, password);
      
      if (user.challengeName === 'SOFTWARE_TOKEN_MFA') {
        // Handle MFA challenge
        // Redirect to MFA verification component
        return;
      }

      // Successful login
      const userInfo = {
        userId: user.attributes.sub,
        email: user.attributes.email,
        firstName: user.attributes.given_name || '',
        lastName: user.attributes.family_name || '',
        role: user.attributes['custom:role'] || 'employee',
        authProvider: 'cognito',
      };

      setUser(userInfo);
      
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = (user: any) => {
    // Google OAuth success is handled in OAuthCallback component
    console.log('Google OAuth initiated successfully');
  };

  const handleGoogleError = (error: string) => {
    setError(error);
  };

  return (
    <div className="login-form-container">
      <div className="login-form-card">
        <h1>Sign In to Aerotage</h1>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Google Sign-In Button */}
        <div className="oauth-section">
          <GoogleSignIn
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            disabled={loading}
          />
        </div>

        <div className="divider">
          <span>or</span>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailLogin} className="email-login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="login-button primary"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <a href="/auth/forgot-password">Forgot your password?</a>
        </div>
      </div>
    </div>
  );
};
```

---

## 🔒 **Phase 4: Security and Configuration**

### **4.1 Environment Variables**

#### **Required Environment Variables**
```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OAuth Settings
ALLOW_GOOGLE_SIGNUP=false  # Set to true to allow new user signup via Google
DEFAULT_GOOGLE_USER_ROLE=employee

# Cognito Configuration
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_DOMAIN=aerotage-time-dev.auth.us-east-1.amazoncognito.com
```

### **4.2 Security Considerations**

#### **OAuth Security Best Practices**
```typescript
// Security configuration for OAuth
const oauthSecurityConfig = {
  // Use authorization code flow (more secure than implicit)
  responseType: 'code',
  
  // Include state parameter for CSRF protection
  includeState: true,
  
  // Use PKCE for additional security
  usePKCE: true,
  
  // Validate redirect URIs strictly
  strictRedirectValidation: true,
  
  // Short token validity periods
  accessTokenValidity: '1h',
  refreshTokenValidity: '30d',
  
  // Require HTTPS in production
  requireHTTPS: process.env.NODE_ENV === 'production',
};
```

### **4.3 Database Schema Updates**

#### **External Identity Providers Table**
```typescript
// infrastructure/lib/database-stack.ts
const externalProvidersTable = new dynamodb.Table(this, 'ExternalProvidersTable', {
  tableName: `aerotage-external-providers-${stage}`,
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'provider', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  pointInTimeRecovery: stage === 'prod',
  removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
});

// Global Secondary Index for provider lookups
externalProvidersTable.addGlobalSecondaryIndex({
  indexName: 'ProviderIdIndex',
  partitionKey: { name: 'providerId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'provider', type: dynamodb.AttributeType.STRING },
});
```

---

## 🚀 **Implementation Timeline**

### **Week 1: Google Cloud & Cognito Setup**
- [ ] Create Google Cloud OAuth 2.0 credentials
- [ ] Update Cognito User Pool with Google Identity Provider
- [ ] Configure OAuth callback URLs and scopes
- [ ] Test basic OAuth flow

### **Week 2: Lambda Triggers & Backend Logic**
- [ ] Implement pre-signup trigger for user validation
- [ ] Implement post-confirmation trigger for account linking
- [ ] Create external providers database table
- [ ] Add user repository methods for OAuth users

### **Week 3: Frontend Integration**
- [ ] Implement Google Sign-In component
- [ ] Create OAuth callback handler
- [ ] Update login form with Google option
- [ ] Add account linking UI for existing users

### **Week 4: Testing & Security**
- [ ] Comprehensive OAuth flow testing
- [ ] Security validation and penetration testing
- [ ] User acceptance testing
- [ ] Production deployment

---

## 📋 **Implementation Effort Estimate**

### **Development Time: 3-4 weeks**
- **Backend Development**: 1.5 weeks
- **Frontend Development**: 1.5 weeks  
- **Testing & Security**: 1 week

### **Key Dependencies**
1. **Google Cloud Console access** for OAuth setup
2. **Frontend domain configuration** for redirect URLs
3. **Admin policy decisions** on Google signup permissions
4. **User communication** for existing account linking

### **Complexity Level: Medium-High**
- **OAuth flow implementation**: Complex
- **Account linking logic**: Medium
- **Security considerations**: High
- **User experience design**: Medium

---

## 🎯 **Benefits of Google OAuth Integration**

### **User Experience**
- **Faster login process** - No password to remember
- **Reduced friction** - One-click authentication
- **Familiar interface** - Users trust Google sign-in
- **Mobile-friendly** - Works seamlessly on all devices

### **Security Benefits**
- **Reduced password risks** - No password storage/management
- **Google's security infrastructure** - Enterprise-grade protection
- **Automatic security updates** - Google handles security patches
- **MFA inheritance** - Users with Google 2FA get additional protection

### **Administrative Benefits**
- **Reduced support tickets** - Fewer password reset requests
- **Simplified user onboarding** - Faster account setup
- **Better user adoption** - Lower barrier to entry
- **Audit trail** - Complete OAuth activity logging

---

**This implementation would provide a modern, secure, and user-friendly authentication experience while maintaining all existing security and audit capabilities of your Aerotage Time Reporting API.** 