# Aerotage Time Reporting API - Deployment Guide

## 🚀 Infrastructure Overview

The Aerotage Time Reporting API consists of 5 AWS CDK stacks that provide a complete serverless backend:

### 📋 Stack Summary

1. **AerotageAuth-dev** - Authentication & Authorization
   - AWS Cognito User Pool with enterprise security
   - User groups: Admin, Manager, Employee
   - MFA support and password policies
   - Custom attributes for role, hourly rate, team, department

2. **AerotageDB-dev** - Database Layer
   - 9 DynamoDB tables with Global Secondary Indexes
   - Tables: Users, Teams, Projects, Clients, TimeEntries, Invoices, UserSessions, UserActivity, UserInvitations
   - Pay-per-request billing with encryption
   - Point-in-time recovery for production

3. **AerotageStorage-dev** - File Storage
   - 3 S3 buckets: General storage, Invoices, Exports
   - Lifecycle policies for cost optimization
   - Secure access with proper IAM policies
   - CORS configuration for frontend integration

4. **AerotageAPI-dev** - API Layer
   - REST API with 33 Lambda function endpoints
   - Cognito authorization on all endpoints
   - Comprehensive CRUD operations for all entities
   - Approval workflow and reporting endpoints

5. **AerotageMonitoring-dev** - Monitoring & Alerting
   - CloudWatch dashboard with system metrics
   - Automated alarms for errors and performance
   - SNS notifications for production alerts
   - Centralized logging with retention policies

## 🛠️ Prerequisites

Before deploying, ensure you have:

1. **AWS CLI configured** with appropriate credentials
2. **AWS CDK CLI** installed globally (`npm install -g aws-cdk`)
3. **Node.js 18+** for Lambda runtime compatibility
4. **Proper IAM permissions** for creating AWS resources

## 📦 Deployment Steps

### 1. Bootstrap CDK (First Time Only)

```bash
cd infrastructure
npm run bootstrap
```

### 2. Deploy Development Environment

```bash
# Deploy all stacks to development
npm run deploy:dev

# Or deploy individual stacks
cdk deploy AerotageAuth-dev
cdk deploy AerotageDB-dev
cdk deploy AerotageStorage-dev
cdk deploy AerotageAPI-dev
cdk deploy AerotageMonitoring-dev
```

### 3. Deploy Staging Environment

```bash
npm run deploy:staging
```

### 4. Deploy Production Environment

```bash
npm run deploy:prod
```

## 🔧 Environment Configuration

### Environment Variables

The infrastructure automatically configures environment variables for Lambda functions:

- `STAGE` - Environment stage (dev/staging/prod)
- `USER_POOL_ID` - Cognito User Pool ID
- `USER_POOL_CLIENT_ID` - Cognito Client ID
- Table names for all DynamoDB tables
- `STORAGE_BUCKET` - Main S3 bucket name

### Custom Configuration

Edit `bin/aerotage-time-api.ts` to customize:

- AWS region (default: us-east-1)
- Resource naming conventions
- Common tags applied to all resources

## 📊 Post-Deployment Setup

### 1. Create Initial Admin User

```bash
# Use AWS CLI to create first admin user
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username admin@aerotage.com \
  --user-attributes Name=email,Value=admin@aerotage.com Name=given_name,Value=Admin Name=family_name,Value=User \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS

# Add to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <USER_POOL_ID> \
  --username admin@aerotage.com \
  --group-name admin
```

### 2. Frontend Configuration

Update your frontend application with the deployed resources:

```typescript
// src/aws-exports.ts
export const awsConfig = {
  region: 'us-east-1',
  userPoolId: '<USER_POOL_ID_FROM_OUTPUT>',
  userPoolClientId: '<USER_POOL_CLIENT_ID_FROM_OUTPUT>',
  apiGatewayUrl: '<API_GATEWAY_URL_FROM_OUTPUT>',
};
```

### 3. Monitoring Setup

1. **CloudWatch Dashboard**: Access via the dashboard URL in outputs
2. **SNS Alerts**: Subscribe to the alert topic for production notifications
3. **Log Monitoring**: Configure log retention and monitoring queries

## 🔐 Security Considerations

### Production Deployment Checklist

- [ ] **Configure CORS** - Update allowed origins for production domain
- [ ] **Update IAM Policies** - Review and minimize permissions
- [ ] **Enable WAF** - Add Web Application Firewall for API Gateway
- [ ] **Configure Backup** - Enable point-in-time recovery for production
- [ ] **Monitor Costs** - Set up billing alerts and resource monitoring
- [ ] **Rotate Secrets** - Implement secret rotation for sensitive data

### Security Features

- All data encrypted at rest and in transit
- Cognito handles authentication and authorization
- IAM roles with least privilege principle
- API Gateway throttling and rate limiting
- VPC endpoints for secure service communication

## 📈 Scaling Considerations

### Auto-Scaling

- **Lambda Functions**: Automatic scaling based on demand
- **DynamoDB**: Pay-per-request auto-scaling
- **API Gateway**: Built-in scaling and caching
- **S3**: Unlimited storage capacity

### Performance Optimization

- Lambda function memory optimization
- DynamoDB query optimization with GSIs
- CloudFront CDN for static assets
- Connection pooling for database operations

## 🚨 Troubleshooting

### Common Issues

1. **Lambda Timeout**: Increase timeout in stack configuration
2. **DynamoDB Throttling**: Check provisioned vs. on-demand settings
3. **API Gateway CORS**: Verify CORS configuration for frontend domain
4. **Cognito Authentication**: Check user pool and client configuration

### Useful Commands

```bash
# View stack outputs
cdk list
cdk diff AerotageAPI-dev

# Check deployment status
aws cloudformation describe-stacks --stack-name AerotageAPI-dev

# View logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/aerotage
```

## 💰 Cost Optimization

### Development Environment

- Use on-demand billing for DynamoDB
- Enable S3 lifecycle policies
- Configure Lambda reserved concurrency limits
- Use CloudWatch log retention policies

### Production Environment

- Consider DynamoDB reserved capacity
- Implement S3 intelligent tiering
- Use CloudWatch log insights for cost analysis
- Monitor and optimize Lambda memory allocation

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy AWS Infrastructure

on:
  push:
    branches: [main]
    paths: ['infrastructure/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd infrastructure
          npm install
      
      - name: Deploy to AWS
        run: |
          cd infrastructure
          npm run deploy:prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## 📞 Support

For deployment issues or questions:

1. Check CloudFormation console for stack events
2. Review CloudWatch logs for Lambda function errors
3. Verify IAM permissions and service quotas
4. Consult AWS CDK documentation for specific constructs

---

**🎯 Next Steps:**
1. Run `npm run deploy:dev` to deploy the development environment
2. Create the initial admin user
3. Configure your frontend application
4. Test the API endpoints
5. Set up monitoring and alerting

The infrastructure is production-ready and follows AWS best practices for security, scalability, and cost optimization. 