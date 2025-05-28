# Deployment Guide

## 🚀 **Aerotage Time Reporting API - Deployment Guide**

This guide covers the complete deployment process for the Aerotage Time Reporting API backend infrastructure.

## 📋 **Prerequisites**

### **Required Tools**
- **Node.js 18+** - Runtime environment
- **AWS CLI** - AWS command line interface
- **AWS CDK CLI** - Infrastructure as code deployment tool
- **Git** - Version control

### **AWS Account Setup**
- AWS Account with appropriate permissions
- IAM user with programmatic access
- Required IAM permissions for CDK deployment

### **Installation Commands**
```bash
# Install Node.js (if not already installed)
# Download from https://nodejs.org/

# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install AWS CDK CLI globally
npm install -g aws-cdk

# Verify installations
node --version
aws --version
cdk --version
```

## 🔧 **Environment Setup**

### **1. Clone Repository**
```bash
git clone https://github.com/aerotage/aerotage-time-reporting-api.git
cd aerotage-time-reporting-api
```

### **2. Install Dependencies**
```bash
# Install main project dependencies
npm install

# Install infrastructure dependencies
cd infrastructure
npm install
cd ..
```

### **3. Configure AWS Credentials**

#### **Option A: AWS CLI Configuration**
```bash
# Configure default profile
aws configure

# Or configure named profiles for different environments
aws configure --profile aerotage-dev
aws configure --profile aerotage-staging
aws configure --profile aerotage-prod
```

#### **Option B: Environment Variables**
```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-east-1
```

### **4. Verify AWS Access**
```bash
# Test AWS connectivity
aws sts get-caller-identity

# Should return your AWS account information
```

## 🏗️ **Infrastructure Overview**

### **Current Infrastructure Stacks**
The application consists of multiple CDK stacks:

1. **CognitoStack** - Authentication and user management
2. **DatabaseStack** - DynamoDB tables and indexes
3. **ApiStack** - API Gateway and Lambda functions
4. **StorageStack** - S3 buckets for file storage
5. **SESStack** - Email service for invitations and notifications
6. **MonitoringStack** - CloudWatch logs, metrics, and alarms

### **Deployed Resources**
- **API Gateway**: REST API with Cognito authorization
- **Lambda Functions**: 30+ functions for various endpoints
- **DynamoDB Tables**: 8 tables with GSIs for data storage
- **Cognito User Pool**: User authentication and management
- **S3 Buckets**: File storage and static assets
- **SES Templates**: Email templates for user communications
- **CloudWatch**: Monitoring, logging, and alerting

## 🚀 **Deployment Process**

### **Step 1: Bootstrap CDK** (One-time setup)
```bash
cd infrastructure

# Bootstrap for development environment
cdk bootstrap --profile aerotage-dev

# Bootstrap for staging (if using)
cdk bootstrap --profile aerotage-staging

# Bootstrap for production (if using)
cdk bootstrap --profile aerotage-prod
```

### **Step 2: Build and Test**
```bash
# Build TypeScript
npm run build

# Run linting
npm run lint

# Run tests
npm run test

# Check for any issues before deployment
```

### **Step 3: Deploy to Development**
```bash
cd infrastructure

# View what will be deployed
npm run diff:dev

# Deploy all stacks to development
npm run deploy:dev

# Or deploy individual stacks
cdk deploy AerotageAuth-dev --profile aerotage-dev
cdk deploy AerotageDatabase-dev --profile aerotage-dev
cdk deploy AerotageAPI-dev --profile aerotage-dev
```

### **Step 4: Verify Deployment**
```bash
# Check stack status
aws cloudformation describe-stacks --stack-name AerotageAPI-dev

# Test API endpoint
curl -X GET "https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev//health"

# Check CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/aerotage"
```

## 🌍 **Environment Management**

### **Development Environment**
- **Purpose**: Active development and testing
- **Stack Suffix**: `-dev`
- **Profile**: `aerotage-dev`
- **API URL**: `https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev/`
- **Custom Domain**: `https://time-api-dev.aerotage.com/` (optional)

```bash
# Deploy to development
cd infrastructure
npm run deploy:dev

# Deploy with custom domain (recommended)
npm run deploy:dev
npm run deploy:domain:dev

# Destroy development (if needed)
npm run destroy:dev
```

### **Staging Environment**
- **Purpose**: Pre-production testing and QA
- **Stack Suffix**: `-staging`
- **Profile**: `aerotage-staging`
- **Custom Domain**: `https://time-api-staging.aerotage.com/` (recommended)

```bash
# Deploy to staging
cd infrastructure
STAGE=staging npm run deploy

# Deploy with custom domain
STAGE=staging npm run deploy
npm run deploy:domain:staging

# Or manually
cdk deploy --all --profile aerotage-staging --context stage=staging
```

### **Production Environment**
- **Purpose**: Live customer usage
- **Stack Suffix**: `-prod`
- **Profile**: `aerotage-prod`
- **Custom Domain**: `https://time-api.aerotage.com/` (required)

```bash
# Deploy to production (requires extra caution)
cd infrastructure
STAGE=prod npm run deploy

# Deploy with custom domain (required for production)
STAGE=prod npm run deploy
npm run deploy:domain:prod

# Or manually with confirmation
cdk deploy --all --profile aerotage-prod --context stage=prod --require-approval broadening
```

## 🌐 **Custom Domain Setup**

### **Why Use Custom Domains?**
- ✅ **Professional URLs**: `https://time-api-dev.aerotage.com` instead of random AWS URLs
- ✅ **Stable URLs**: Never change when API Gateway is redeployed
- ✅ **Automatic Updates**: AWS handles IP changes automatically
- ✅ **SSL Management**: Automatic certificate provisioning and renewal
- ✅ **Frontend Stability**: No configuration changes needed when infrastructure updates

### **Quick Custom Domain Deployment**
```bash
# Test prerequisites
npm run test:domain:setup

# Deploy custom domain for dev environment
npm run deploy:domain:dev

# Verify custom domain is working
curl -I https://time-api-dev.aerotage.com/health
```

### **Custom Domain Commands**
```bash
# Test domain setup prerequisites
npm run test:domain:setup

# Deploy custom domains
npm run deploy:domain:dev
npm run deploy:domain:staging
npm run deploy:domain:prod

# Rollback custom domains (if needed)
npm run rollback:domain:dev
npm run rollback:domain:staging
npm run rollback:domain:prod
```

### **Custom Domain Documentation**
- **Setup Guide**: `docs/CUSTOM_DOMAIN_SETUP.md` - Comprehensive setup instructions
- **Pipeline Integration**: `docs/CUSTOM_DOMAIN_PIPELINE_INTEGRATION.md` - How custom domains work in deployment pipeline
- **Quick Start**: `CUSTOM_DOMAIN_README.md` - Quick reference guide

**Note**: Custom domains automatically handle API Gateway IP/URL changes. Once deployed, your frontend can use stable URLs that never need to be updated, even when the underlying infrastructure changes.

## 📊 **Post-Deployment Configuration**

### **1. SES Email Verification**
```bash
# Verify sending domain (required for production)
aws ses verify-domain-identity --domain aerotage.com

# Verify individual email addresses (for development)
aws ses verify-email-identity --email-address noreply@aerotage.com
```

### **2. Create Admin User**
```bash
# Use the provided script
./scripts/setup-admin-user.sh

# Or manually create admin user
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username "admin@aerotage.com" \
  --user-attributes \
    Name=email,Value="admin@aerotage.com" \
    Name=given_name,Value="Admin" \
    Name=family_name,Value="User" \
    Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS

# Add to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_EsdlgX9Qg \
  --username "admin@aerotage.com" \
  --group-name admin
```

### **3. Configure Frontend**
Update the frontend application with the deployed backend URLs:

```typescript
// Frontend configuration
const config = {
  apiBaseUrl: 'https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev//',
  cognito: {
    userPoolId: 'us-east-1_EsdlgX9Qg',
    userPoolWebClientId: '148r35u6uultp1rmfdu22i8amb',
    identityPoolId: 'us-east-1:d79776bb-4b8e-4654-a10a-a45b1adaa787',
    region: 'us-east-1'
  }
};
```

## 🔍 **Monitoring and Verification**

### **Health Checks**
```bash
# API Gateway health check
curl -X GET "https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev//health"

# Test authentication endpoint
curl -X GET "https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev//users" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check DynamoDB tables
aws dynamodb list-tables --region us-east-1
```

### **CloudWatch Monitoring**
```bash
# View API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum

# Check Lambda function logs
aws logs tail /aws/lambda/aerotage-users-list-dev --follow

# View DynamoDB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

## 🔄 **Updates and Rollbacks**

### **Deploying Updates**
```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
npm install
cd infrastructure && npm install && cd ..

# 3. Build and test
npm run build
npm run test

# 4. Deploy changes
cd infrastructure
npm run deploy:dev
```

### **Rollback Strategy**
```