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
curl -X GET "https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/health"

# Check CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/aerotage"
```

## 🌍 **Environment Management**

### **Development Environment**
- **Purpose**: Active development and testing
- **Stack Suffix**: `-dev`
- **Profile**: `aerotage-dev`
- **API URL**: `https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/`

```bash
# Deploy to development
cd infrastructure
npm run deploy:dev

# Destroy development (if needed)
npm run destroy:dev
```

### **Staging Environment**
- **Purpose**: Pre-production testing and QA
- **Stack Suffix**: `-staging`
- **Profile**: `aerotage-staging`

```bash
# Deploy to staging
cd infrastructure
STAGE=staging npm run deploy

# Or manually
cdk deploy --all --profile aerotage-staging --context stage=staging
```

### **Production Environment**
- **Purpose**: Live customer usage
- **Stack Suffix**: `-prod`
- **Profile**: `aerotage-prod`

```bash
# Deploy to production (requires extra caution)
cd infrastructure
STAGE=prod npm run deploy

# Or manually with confirmation
cdk deploy --all --profile aerotage-prod --context stage=prod --require-approval broadening
```

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
  apiBaseUrl: 'https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/',
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
curl -X GET "https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/health"

# Test authentication endpoint
curl -X GET "https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev/users" \
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
```bash
# View deployment history
aws cloudformation describe-stack-events --stack-name AerotageAPI-dev

# Rollback to previous version (if supported)
cdk deploy AerotageAPI-dev --rollback

# Or redeploy from a specific git commit
git checkout <previous-commit-hash>
cd infrastructure
npm run deploy:dev
```

## 🚨 **Troubleshooting**

### **Common Deployment Issues**

#### **1. CDK Bootstrap Issues**
```bash
# Error: "Need to perform AWS CDK bootstrap"
# Solution: Bootstrap the environment
cdk bootstrap --profile aerotage-dev
```

#### **2. Permission Errors**
```bash
# Error: "User is not authorized to perform..."
# Solution: Check IAM permissions
aws iam get-user
aws iam list-attached-user-policies --user-name YOUR_USERNAME
```

#### **3. Resource Conflicts**
```bash
# Error: "Resource already exists"
# Solution: Check existing resources
aws cloudformation describe-stacks
aws s3 ls
aws dynamodb list-tables
```

#### **4. Lambda Deployment Failures**
```bash
# Error: "Code size exceeds maximum"
# Solution: Check bundle size and dependencies
cd infrastructure
npm run build
ls -la dist/
```

### **Debugging Commands**
```bash
# View CDK synthesized templates
cd infrastructure
cdk synth

# Check CDK context
cat cdk.context.json

# View CloudFormation events
aws cloudformation describe-stack-events --stack-name AerotageAPI-dev

# Check Lambda function configuration
aws lambda get-function --function-name aerotage-users-list-dev
```

## 📈 **Performance Optimization**

### **Lambda Optimization**
- **Memory Allocation**: Right-size based on usage patterns
- **Timeout Settings**: Set appropriate timeouts for each function
- **Cold Start Reduction**: Use provisioned concurrency for critical functions

### **DynamoDB Optimization**
- **Capacity Planning**: Monitor and adjust read/write capacity
- **Index Usage**: Optimize GSI usage for query patterns
- **Item Size**: Keep items under 400KB limit

### **API Gateway Optimization**
- **Caching**: Enable caching for frequently accessed endpoints
- **Throttling**: Configure appropriate throttling limits
- **Compression**: Enable response compression

## 🔐 **Security Considerations**

### **IAM Roles**
- All Lambda functions use least privilege IAM roles
- Separate roles for different function types
- Regular review and audit of permissions

### **Network Security**
- API Gateway with Cognito authorization
- VPC endpoints for DynamoDB access (if required)
- Encryption in transit and at rest

### **Data Protection**
- All DynamoDB tables encrypted at rest
- S3 buckets with encryption enabled
- Secure handling of JWT tokens

## 📚 **Additional Resources**

### **AWS Documentation**
- [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/)
- [API Gateway Developer Guide](https://docs.aws.amazon.com/apigateway/)
- [Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- [DynamoDB Developer Guide](https://docs.aws.amazon.com/dynamodb/)

### **Monitoring and Alerting**
- CloudWatch dashboards for key metrics
- Alarms for error rates and latency
- Cost monitoring and budgets
- Log aggregation and analysis

### **Backup and Disaster Recovery**
- DynamoDB point-in-time recovery enabled
- S3 versioning and lifecycle policies
- Cross-region backup strategy (for production)
- Infrastructure as code for rapid recovery

---

## 🎯 **Deployment Checklist**

### **Pre-Deployment**
- [ ] AWS CLI configured and tested
- [ ] CDK CLI installed and updated
- [ ] Dependencies installed (`npm install`)
- [ ] Code built successfully (`npm run build`)
- [ ] Tests passing (`npm run test`)
- [ ] Linting clean (`npm run lint`)

### **Deployment**
- [ ] CDK bootstrapped for target environment
- [ ] Infrastructure deployed (`npm run deploy:dev`)
- [ ] API Gateway endpoint accessible
- [ ] Lambda functions deployed and working
- [ ] DynamoDB tables created with proper indexes
- [ ] Cognito User Pool configured

### **Post-Deployment**
- [ ] SES domain/email verified
- [ ] Admin user created and tested
- [ ] Frontend configuration updated
- [ ] Health checks passing
- [ ] Monitoring and alarms configured
- [ ] Documentation updated

### **Production Readiness**
- [ ] Staging environment tested
- [ ] Performance testing completed
- [ ] Security review conducted
- [ ] Backup strategy implemented
- [ ] Monitoring dashboards created
- [ ] Incident response plan documented

---

This deployment guide provides comprehensive instructions for deploying and managing the Aerotage Time Reporting API infrastructure. Follow the steps carefully and refer to the troubleshooting section if you encounter any issues. 