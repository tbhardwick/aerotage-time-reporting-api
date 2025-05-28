# Aerotage Time Reporting API

A comprehensive serverless backend API for time tracking, project management, and billing, built with AWS CDK and TypeScript.

## 🚀 Overview

The Aerotage Time Reporting API is a **production-ready serverless backend** that provides comprehensive time tracking, project management, client management, reporting, and **complete invoicing & billing capabilities**. Built using AWS CDK for infrastructure as code, it offers enterprise-grade security, scalability, and monitoring.

## ✨ Features

### 🔐 Authentication & Security
- AWS Cognito user authentication with JWT tokens
- Role-based access control (Admin, Manager, Employee)
- Multi-factor authentication support
- Password reset and security management
- Session management with device tracking
- **Standardized authentication patterns** across all endpoints ✅ **ENHANCED**

### 👥 User Management
- User profiles and preferences
- Team management and organization
- User invitation system with email notifications
- Role-based permissions and access control

### ⏱️ Time Tracking ✅ **Phase 4 Complete**
- Comprehensive time entry CRUD operations
- Timer functionality with start/stop/pause capabilities
- Project-based time tracking with association
- Approval workflows for manager review (submit/approve/reject)
- Billable vs non-billable time categorization
- Bulk operations for time management

### 📊 Project & Client Management ✅ **Phase 5 Complete**
- Complete client CRUD operations with business logic validation
- Project management with client relationship tracking
- Project budgets and rate management (hours and monetary)
- Project status tracking (active, paused, completed, cancelled)
- Soft delete functionality for clients
- Business logic validation (prevent client deletion with active projects)

### 📈 Reporting & Analytics ✅ **Phase 6 Complete**
- Time reports with flexible filtering and export capabilities
- Project productivity analytics and performance metrics
- User performance reports and dashboard analytics
- Real-time business intelligence and KPI tracking
- Export capabilities (CSV, Excel, PDF)
- Scheduled report generation and automated delivery

### 🧾 Invoicing & Billing ✅ **Phase 7 Complete**
- **Automated invoice generation** from approved time entries
- **Invoice template system** with customizable branding
- **Invoice status management** (draft → sent → viewed → paid → overdue)
- **Payment tracking** with multiple payment methods and processor fees
- **Recurring invoice configuration** with automated generation
- **Email integration** for invoice delivery with PDF attachments
- **Financial calculations** with tax, discount, and total automation
- **Business logic validation** for status transitions and payments

## 🏗️ Architecture

### Infrastructure
- **AWS CDK v2** - Infrastructure as Code with TypeScript
- **AWS Lambda** - Serverless compute (Node.js 20.x) with **52+ functions**
- **Amazon API Gateway** - REST API with Cognito authorization (**46+ endpoints**)
- **Amazon DynamoDB** - NoSQL database with GSIs (**14 tables**)
- **Amazon Cognito** - User authentication and management
- **Amazon S3** - File storage for documents, exports, and invoice PDFs
- **Amazon SES** - Email service for notifications and invoice delivery
- **Amazon CloudWatch** - Monitoring, logging, and alerting

### API Design
- RESTful API design principles
- **Standardized authentication and response patterns** ✅ **ENHANCED**
- Comprehensive error handling with consistent format
- Rate limiting and throttling
- CORS support for web applications
- **Interactive OpenAPI/Swagger documentation**

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- AWS CLI configured
- AWS CDK CLI (`npm install -g aws-cdk`)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/aerotage/aerotage-time-reporting-api.git
   cd aerotage-time-reporting-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd infrastructure && npm install && cd ..
   ```

3. **Bootstrap CDK** (first time only)
   ```bash
   cd infrastructure
   cdk bootstrap
   ```

4. **Deploy to development**
   ```bash
   npm run deploy:dev
   ```

### API Base URL
```
Development: https://time-api-dev.aerotage.com/
```

## 📚 Documentation

### 🌐 **Interactive API Documentation**
- **[Live Swagger UI](https://djfreip4iwrq0.cloudfront.net)** - Interactive API documentation with live testing
- **[OpenAPI Specification](./docs/openapi.yaml)** - Complete OpenAPI 3.0 specification

### 📖 **Comprehensive Guides**
Detailed documentation is available in the [`/docs`](./docs) directory:

- **[API Reference](./docs/API_REFERENCE.md)** - Complete API endpoint documentation (46+ endpoints)
- **[Frontend Integration Guide](./docs/FRONTEND_INTEGRATION_GUIDE.md)** - Complete integration guide for all phases
- **[Project Status](./docs/PROJECT_STATUS.md)** - Current implementation status and progress
- **[Project Organization](./PROJECT_ORGANIZATION.md)** - File structure and organization guide ✅ **NEW**
- **[Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)** - Infrastructure deployment instructions
- **[Security Guide](./docs/SECURITY_GUIDE.md)** - Security features and implementation
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🔧 Development

### Project Structure ✅ **REORGANIZED**
```
├── 📁 infrastructure/          # AWS CDK Infrastructure Code
│   ├── bin/                    # CDK app entry points
│   ├── lib/                    # CDK stack definitions
│   ├── lambda/                 # Lambda function implementations (52+ functions)
│   └── test/                   # Infrastructure unit tests
├── 📁 scripts/                 # Operational & Testing Scripts
│   ├── test-*.js              # API endpoint testing scripts
│   ├── setup-*.sh             # Environment setup scripts
│   └── build-*.js             # Build and deployment utilities
├── 📁 docs/                    # Project Documentation
│   ├── API_REFERENCE.md       # Complete API documentation
│   ├── openapi.yaml           # OpenAPI specification
│   └── swagger-ui/            # Interactive API documentation
├── 📁 tools/                   # Development Utilities
│   └── auth/                  # Authentication utilities and test payloads
├── 📁 tests/                   # Jest Unit Tests
│   └── setup.ts              # Test setup configuration
└── 📁 src/                     # Source Code (TypeScript)
    ├── handlers/              # Lambda handlers
    ├── middleware/            # Middleware functions
    ├── models/                # Data models
    └── types/                 # TypeScript type definitions
```

### Available Scripts
```bash
npm run build              # Build TypeScript
npm run test               # Run Jest tests
npm run test:api           # Run API integration tests
npm run test:invoices      # Run invoice system tests
npm run test:time-entries  # Run time tracking tests
npm run lint               # Run ESLint
npm run lint:fix           # Fix linting issues
npm run build:docs         # Build OpenAPI documentation
npm run deploy:dev         # Deploy to development
npm run deploy:staging     # Deploy to staging
npm run deploy:prod        # Deploy to production
npm run destroy:dev        # Destroy development stack
```

## 🌍 Environments

- **Development** - Active development and testing ✅ **OPERATIONAL**
- **Staging** - Pre-production testing and QA 📋 **READY**
- **Production** - Live customer environment 📋 **READY**

## 📊 Current Status

### ✅ **Complete Business Solution (Phases 1-7)**
- ✅ **Infrastructure**: Complete AWS serverless backend with 6 CDK stacks
- ✅ **Authentication**: Cognito with standardized role-based access patterns
- ✅ **API Endpoints**: **46+ endpoints** implemented and tested across all business functions
- ✅ **Database**: **14 DynamoDB tables** with optimized GSIs for all business data
- ✅ **User Management**: Complete user lifecycle with invitations and security
- ✅ **Time Tracking**: Full time entry management with approval workflows
- ✅ **Project Management**: Complete project and client management system
- ✅ **Reporting & Analytics**: Business intelligence with real-time dashboards
- ✅ **Invoicing & Billing**: Complete financial management with payment tracking
- ✅ **Monitoring**: CloudWatch dashboards and alerting
- ✅ **Documentation**: Interactive OpenAPI/Swagger UI + comprehensive guides
- ✅ **Code Quality**: Standardized authentication patterns and response formatting

### 🎯 **Recent Achievements**
- ✅ **Authentication Consistency**: Standardized patterns across all 46+ endpoints
- ✅ **Project Organization**: Improved file structure and maintainability
- ✅ **Phase 7 Complete**: Full invoicing and billing system operational
- ✅ **Testing Verified**: All core business functions tested and validated

### 📋 **Next Phase**
- **Phase 8**: Advanced Features & Integrations (payment gateways, multi-currency)
- **Production Deployment**: Staging and production environment setup
- **Performance Optimization**: Load testing and scaling preparation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript strict mode
- Use ESLint configuration provided
- Write tests for new functionality
- Update documentation for API changes
- Follow AWS CDK best practices
- **Use standardized authentication and response patterns** ✅ **REQUIRED**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏢 About Aerotage

Aerotage Design Group, Inc. is a professional design and development company. This time reporting API serves as the backend for our comprehensive business management system with time tracking, project management, client management, reporting, and invoicing capabilities.

## 📞 Support

For questions, issues, or contributions:

- **Documentation**: Check the [`/docs`](./docs) directory for comprehensive guides
- **API Testing**: Use scripts in [`/scripts`](./scripts) directory
- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Email**: Contact the development team for urgent matters

---

**🎉 Complete Business Management Solution**  
**Built with ❤️ using AWS CDK and TypeScript**  
**46+ API Endpoints | 14 Database Tables | 52+ Lambda Functions**  
**Phases 1-7 Complete | Production Ready** 