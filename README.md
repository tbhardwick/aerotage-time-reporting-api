# Aerotage Time Reporting API

## 🚀 **Backend Infrastructure & API**

This repository contains the AWS serverless backend infrastructure and API for the Aerotage Time Reporting Application. This is the backend counterpart to the frontend Electron desktop application.

## 🏗️ **Two-Repository Architecture**

### **This Repository (`aerotage-time-reporting-api`)**
**Purpose**: Backend AWS serverless infrastructure and API
**Contains**:
- ✅ AWS CDK infrastructure code (TypeScript)
- ✅ AWS Lambda function implementations
- ✅ DynamoDB table definitions and schema
- ✅ API Gateway REST API configurations
- ✅ AWS Cognito authentication infrastructure
- ✅ CloudWatch monitoring and logging setup
- ✅ S3 storage bucket configurations
- ✅ IAM roles and security policies
- ✅ Deployment scripts and infrastructure documentation

### **Frontend Repository (`aerotage_time_reporting_app`)**
**Purpose**: Electron desktop application
**Contains**: 
- 📱 Electron main process, renderer, and preload scripts
- 📱 React/TypeScript frontend code
- 📱 UI components, pages, and styling
- 📱 State management (React Context)
- 📱 Frontend configuration and build tools

## 🛠️ **Technology Stack**

### **Infrastructure & Deployment**
- **Infrastructure as Code**: AWS CDK v2 with TypeScript
- **Compute**: AWS Lambda functions (Node.js 20.x)
- **API**: Amazon API Gateway (REST API)
- **Database**: Amazon DynamoDB (single-table design)
- **Authentication**: Amazon Cognito (User Pools + Identity Pools)
- **Storage**: Amazon S3 (file uploads, exports, invoices)
- **Monitoring**: Amazon CloudWatch (logs, metrics, alarms)
- **Security**: AWS IAM (least privilege access)

### **Development Tools**
- **Language**: TypeScript (strict mode)
- **Package Manager**: npm
- **Linting**: ESLint v9 with flat config (backend-optimized rules)
- **Code Quality**: Automated linting with TypeScript integration
- **Testing**: Jest for unit tests, AWS CDK testing constructs
- **Deployment**: AWS CDK CLI with multiple environments

## 🧹 **Code Quality & Linting**

### **ESLint Configuration**

This repository uses **ESLint v9 with flat config** specifically optimized for AWS serverless backend development. The configuration enforces:

- ✅ **Backend-focused rules** for CDK infrastructure and Lambda functions
- ✅ **TypeScript integration** with strict type checking
- ✅ **AWS best practices** for security and performance
- ✅ **Build artifact exclusion** (automatically ignores compiled files)
- ✅ **Frontend file protection** (prevents frontend code in backend repo)

### **Linting Scripts**

```bash
# Basic linting
npm run lint              # Run ESLint on all TypeScript files

# Auto-fix issues
npm run lint:fix          # Automatically fix linting issues where possible

# Strict checking
npm run lint:check        # Fail build if ANY warnings exist (CI/CD)

# Developer-friendly summary
npm run lint:summary      # Run linting with helpful context messages
```

### **File-Specific Rules**

The ESLint configuration provides different rule sets for different file types:

#### **Lambda Functions** (`infrastructure/lambda/**/*.ts`, `src/handlers/**/*.ts`)
- ✅ **Strict return types**: Required for all handler functions
- ⚠️ **Console statements**: Allowed (warnings) for CloudWatch logging
- ✅ **Async/await rules**: Enforced for Promise handling
- ✅ **Performance rules**: Optimized for serverless execution

#### **CDK Infrastructure** (`infrastructure/lib/**/*.ts`, `infrastructure/bin/**/*.ts`)
- ✅ **Unused parameters**: Allowed with underscore prefix (`_param`)
- ✅ **Console statements**: Allowed for deployment output
- ✅ **CDK patterns**: Optimized for infrastructure-as-code

#### **Test Files** (`**/*.test.ts`, `**/*.spec.ts`, `tests/**/*.ts`)
- ✅ **Relaxed rules**: Allow `any` types and console statements
- ✅ **Jest globals**: Pre-configured (describe, it, expect, etc.)
- ✅ **Test-specific patterns**: Optimized for testing scenarios

### **Ignored Files & Directories**

The linter automatically ignores:
- 🚫 Build artifacts (`dist/`, `cdk.out/`, `*.js`, `*.d.ts`)
- 🚫 Dependencies (`node_modules/`)
- 🚫 CDK asset bundles (`**/asset.*/**`)
- 🚫 Frontend files (`src/components/`, `public/`, `*.html`, `*.css`)

### **Current Linting Status**

✅ **0 errors** - All critical issues resolved  
⚠️ **70 warnings** - Only console.log statements in Lambda functions (acceptable for logging)

The remaining warnings are intentional `console.log` statements in Lambda functions, which are:
- **Best practice** for CloudWatch logging in AWS Lambda
- **Required** for production monitoring and debugging
- **Configured as warnings** to maintain awareness without blocking builds

### **Development Workflow with Linting**

#### **VS Code Setup** 🔧
This repository includes optimized VS Code configuration:
- `.vscode/settings.json` - Workspace settings with ESLint integration
- `.vscode/extensions.json` - Recommended extensions for AWS development

When you open this repository in VS Code, you'll be prompted to install recommended extensions that provide:
- ✅ **Auto-linting** on save with ESLint
- ✅ **TypeScript IntelliSense** with AWS SDK support  
- ✅ **AWS Toolkit** for deployment and debugging
- ✅ **Jest integration** for running tests
- ✅ **Path auto-completion** for imports

#### **Pre-commit Workflow**
```bash
# 1. Write your code
# 2. Run linting before committing
npm run lint:fix          # Auto-fix what can be fixed
npm run lint              # Check remaining issues
npm run test              # Ensure tests pass
git commit -m "feat: add new feature"
```

#### **CI/CD Integration**
```bash
# In CI/CD pipeline, use strict checking
npm run lint:check        # Fails if ANY warnings exist
npm run test:coverage     # Ensure test coverage
npm run build             # Verify TypeScript compilation
```

#### **IDE Integration**

For optimal development experience, configure your IDE:

**VS Code** (`.vscode/settings.json`):
```json
{
  "eslint.enable": true,
  "eslint.format.enable": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.includePackageJsonAutoImports": "on"
}
```

**WebStorm/IntelliJ**:
- Enable ESLint in Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
- Set to use flat config format
- Enable "Run eslint --fix on save"

### **Code Quality Standards**

#### **TypeScript Requirements**
- ✅ **Explicit return types** for all functions
- ✅ **No `any` types** (except in tests)
- ✅ **Strict null checks** enabled
- ✅ **Promise handling** with proper async/await

#### **AWS Best Practices**
- ✅ **Least privilege** IAM permissions
- ✅ **Environment variables** for configuration
- ✅ **Error handling** with proper logging
- ✅ **Performance optimization** for Lambda cold starts

#### **Security Standards**
- 🚫 **No hardcoded secrets** in code
- 🚫 **No eval() functions** or dynamic code execution
- ✅ **Input validation** for all API endpoints
- ✅ **Secure dependencies** with regular updates

## 📁 **Repository Structure**

```
aerotage-time-reporting-api/
├── README.md                         # This file
├── package.json                      # Project dependencies and scripts
├── .gitignore                        # Git ignore patterns
├── infrastructure/                   # AWS CDK infrastructure code
│   ├── bin/
│   │   └── aerotage-time-api.ts     # CDK app entry point
│   ├── lib/                         # CDK stack definitions
│   │   ├── cognito-stack.ts         # Authentication infrastructure
│   │   ├── database-stack.ts        # DynamoDB tables and indexes
│   │   ├── api-stack.ts             # API Gateway and Lambda integrations
│   │   ├── storage-stack.ts         # S3 buckets and policies
│   │   └── monitoring-stack.ts      # CloudWatch logs, metrics, alarms
│   ├── lambda/                      # Lambda function implementations
│   │   ├── time-entries/            # Time entry CRUD operations
│   │   ├── projects/                # Project management
│   │   ├── clients/                 # Client management
│   │   ├── users/                   # User management
│   │   ├── teams/                   # Team and role management
│   │   ├── reports/                 # Reporting and analytics
│   │   └── invoices/                # Invoice generation and management
│   ├── test/                        # CDK and Lambda unit tests
│   ├── cdk.json                     # CDK configuration
│   └── package.json                 # CDK dependencies
├── src/                             # Additional Lambda function code
│   ├── handlers/                    # API endpoint handlers
│   ├── models/                      # Data models
│   ├── utils/                       # Shared utilities
│   ├── middleware/                  # Auth & validation middleware
│   └── types/                       # TypeScript types
├── tests/                           # Integration & unit tests
└── docs/                            # API documentation
```

## 🚀 **Quick Start**

### **Prerequisites**

1. **AWS CLI** installed and configured
2. **Node.js 18+** installed
3. **AWS CDK** installed globally
4. **AWS Account** with appropriate permissions

### **Setup Instructions**

#### 1. **Install Dependencies**
```bash
# Install main dependencies
npm install

# Install infrastructure dependencies
cd infrastructure
npm install

# Verify linting setup
cd ..
npm run lint:summary
```

#### 2. **Configure Development Environment**
```bash
# Configure AWS CLI
aws configure

# Or use profiles for multiple environments
aws configure --profile aerotage-dev
aws configure --profile aerotage-staging
aws configure --profile aerotage-prod

# Verify code quality setup
npm run lint              # Should show 0 errors, 70 warnings (acceptable)
npm run test              # Run tests to ensure everything works
```

#### 3. **Bootstrap CDK** (One-time setup)
```bash
cd infrastructure
cdk bootstrap --profile aerotage-dev
```

#### 4. **Deploy Infrastructure**
```bash
# Deploy to development environment
npm run deploy:dev

# Deploy to staging environment
npm run deploy:staging

# Deploy to production environment
npm run deploy:prod
```

### **Environment Management**

The project supports multiple environments:
- **Development** (`dev`) - For active development and testing
- **Staging** (`staging`) - For pre-production testing and QA
- **Production** (`prod`) - For live customer usage

## 📡 **API Endpoints**

### **Authentication**
- `POST /auth/login` - User authentication
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Token refresh

### **User Management**
- `GET /users` - List all users (admin/manager only)
- `POST /users` - Create new user (admin only)
- `PUT /users/{id}` - Update user profile
- `DELETE /users/{id}` - Deactivate user (admin only)
- `POST /users/invite` - Send user invitation (admin only)

### **Team Management**
- `GET /teams` - List all teams
- `POST /teams` - Create new team (admin/manager only)
- `PUT /teams/{id}` - Update team details
- `DELETE /teams/{id}` - Delete team (admin only)
- `POST /teams/{id}/members` - Add team member

### **Project Management**
- `GET /projects` - List projects
- `POST /projects` - Create new project
- `PUT /projects/{id}` - Update project
- `DELETE /projects/{id}` - Delete project

### **Time Tracking**
- `GET /time-entries` - List time entries
- `POST /time-entries` - Create time entry
- `PUT /time-entries/{id}` - Update time entry
- `DELETE /time-entries/{id}` - Delete time entry

### **Reporting**
- `GET /reports/time` - Time reports
- `GET /reports/projects` - Project reports
- `GET /reports/users` - User reports

### **Invoicing**
- `GET /invoices` - List invoices
- `POST /invoices` - Create invoice
- `PUT /invoices/{id}` - Update invoice
- `POST /invoices/{id}/send` - Send invoice

## 🛡️ **Security**

### **Authentication & Authorization**
- **JWT Tokens**: AWS Cognito JWT tokens for API authentication
- **Role-Based Access**: RBAC using Cognito groups (admin, manager, employee)
- **Least Privilege**: Minimum required permissions for all IAM roles

### **Data Protection**
- **Encryption**: All data encrypted in transit and at rest
- **Input Validation**: All inputs validated and sanitized
- **Secret Management**: AWS Secrets Manager for sensitive data

## 📊 **Monitoring & Observability**

### **CloudWatch Integration**
- **Structured Logging**: JSON format for all log messages
- **Custom Metrics**: Business KPIs and performance metrics
- **Alarms**: Error rates, latency, and cost monitoring
- **Dashboards**: Real-time monitoring and alerting

### **Performance Monitoring**
- **API Response Times**: Monitor and alert on slow responses
- **Lambda Duration**: Track function execution times
- **DynamoDB Metrics**: Monitor read/write capacity utilization
- **Error Rates**: Track and alert on error rate increases

## 🚀 **Deployment**

### **Available Scripts**

```bash
# Code Quality & Linting
npm run lint              # Run ESLint on all TypeScript files
npm run lint:fix          # Automatically fix linting issues where possible
npm run lint:check        # Fail build if ANY warnings exist (CI/CD)
npm run lint:summary      # Run linting with helpful context messages

# Infrastructure deployment
npm run deploy:dev         # Deploy to development
npm run deploy:staging     # Deploy to staging
npm run deploy:prod        # Deploy to production

# Infrastructure management
npm run diff:dev          # Show changes for development
npm run destroy:dev       # Destroy development stack
npm run synth             # Generate CloudFormation templates

# Development & Testing
npm run build             # Build TypeScript
npm run test              # Run tests
npm run test:coverage     # Run tests with coverage report
```

### **Deployment Process**

1. **Development Environment**
   ```bash
   cd infrastructure
   npm run deploy:dev
   ```

2. **Staging Environment**
   ```bash
   cd infrastructure
   npm run deploy:staging
   ```

3. **Production Environment**
   ```bash
   cd infrastructure
   npm run deploy:prod
   ```

## 🔗 **Frontend Integration**

After successful backend deployment, the frontend needs to be updated with:

- **User Pool ID**: For Cognito authentication
- **API Gateway URL**: For API calls
- **S3 Bucket Names**: For file uploads

Update the frontend's `src/renderer/config/aws-config.ts` with these values.

## 🧪 **Testing**

### **Unit Testing**
```bash
# Run all tests
npm test

# Run infrastructure tests
cd infrastructure && npm test

# Run with coverage
npm run test:coverage
```

### **Integration Testing**
- API endpoint testing with proper authentication
- Database operations with DynamoDB Local
- Error handling and edge cases

## 📚 **Documentation**

- **API Reference**: See `infrastructure/API_REFERENCE.md`
- **Deployment Guide**: See `infrastructure/DEPLOYMENT_GUIDE.md`
- **Linting Guide**: See `docs/LINTING_GUIDE.md` - Comprehensive code quality documentation
- **Architecture**: See project documentation in frontend repository

## 🛠️ **Development**

### **Adding New Endpoints**

1. **Create Lambda Function**
   ```bash
   # Add function to infrastructure/lambda/
   mkdir infrastructure/lambda/new-feature
   touch infrastructure/lambda/new-feature/handler.ts
   ```

2. **Update API Stack**
   ```typescript
   // Add to infrastructure/lib/api-stack.ts
   const newFeatureHandler = createLambdaFunction(
     'NewFeatureHandler',
     'new-feature/handler',
     'Handles new feature operations'
   );
   ```

3. **Add API Route**
   ```typescript
   // Add API Gateway integration
   const newFeatureResource = api.root.addResource('new-feature');
   newFeatureResource.addMethod('GET', new apigateway.LambdaIntegration(newFeatureHandler));
   ```

4. **Code Quality & Testing**
   ```bash
   # Run linting to catch issues early
   npm run lint:fix          # Auto-fix formatting issues
   npm run lint              # Check for remaining issues
   
   # Run tests
   npm run test              # Unit tests
   npm run build             # Verify TypeScript compilation
   
   # Deploy and test
   npm run deploy:dev        # Deploy to development environment
   ```

### **Database Schema Changes**

1. **Update Database Stack**
   ```typescript
   // Modify infrastructure/lib/database-stack.ts
   // Add new tables or indexes as needed
   ```

2. **Update Data Models**
   ```typescript
   // Update src/models/ with new data structures
   ```

## 📞 **Support & Troubleshooting**

### **Common Issues**

1. **Deployment Failures**: Check CloudFormation console for detailed errors
2. **Permission Errors**: Verify IAM roles and policies
3. **Lambda Timeouts**: Increase timeout settings in stack configuration

### **Useful Commands**

```bash
# Check AWS authentication
aws sts get-caller-identity

# View deployed stacks
cdk list

# Check CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/aerotage

# Monitor API Gateway
aws apigateway get-rest-apis
```

### **Environment Variables**

The infrastructure automatically configures:
- DynamoDB table names
- S3 bucket names
- Cognito User Pool IDs
- API Gateway URLs

## 🎯 **Next Steps**

1. **Deploy Infrastructure**: Run deployment for your target environment
2. **Test APIs**: Verify all endpoints work correctly
3. **Update Frontend**: Configure frontend with backend URLs
4. **Monitor**: Set up CloudWatch dashboards and alerts

---

**🏗️ Backend Infrastructure Ready**: This repository provides a complete AWS serverless backend for the Aerotage Time Reporting Application with enterprise-grade security, monitoring, and scalability. 