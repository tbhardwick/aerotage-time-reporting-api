# Aerotage Time Reporting API

A comprehensive serverless backend API for time tracking and project management, built with AWS CDK and TypeScript.

## 🚀 Overview

The Aerotage Time Reporting API is a production-ready serverless backend that provides comprehensive time tracking, project management, and billing capabilities. Built using AWS CDK for infrastructure as code, it offers enterprise-grade security, scalability, and monitoring.

## ✨ Features

### 🔐 Authentication & Security
- AWS Cognito user authentication with JWT tokens
- Role-based access control (Admin, Manager, Employee)
- Multi-factor authentication support
- Password reset and security management
- Session management with device tracking

### 👥 User Management
- User profiles and preferences
- Team management and organization
- User invitation system with email notifications
- Role-based permissions and access control

### ⏱️ Time Tracking
- Comprehensive time entry management
- Project-based time tracking
- Approval workflows for time entries
- Billable vs non-billable time categorization

### 📊 Project & Client Management
- Client and project organization
- Project budgets and rate management
- Team assignment to projects
- Project status tracking

### 📈 Reporting & Analytics
- Time reports with flexible filtering
- Project productivity analytics
- User performance reports
- Export capabilities (CSV, Excel, PDF)

### 🧾 Invoicing
- Automated invoice generation
- Email delivery of invoices
- Invoice status tracking
- Integration with time entries

## 🏗️ Architecture

### Infrastructure
- **AWS CDK v2** - Infrastructure as Code with TypeScript
- **AWS Lambda** - Serverless compute (Node.js 20.x)
- **Amazon API Gateway** - REST API with Cognito authorization
- **Amazon DynamoDB** - NoSQL database with GSIs
- **Amazon Cognito** - User authentication and management
- **Amazon S3** - File storage for documents and exports
- **Amazon SES** - Email service for notifications
- **Amazon CloudWatch** - Monitoring, logging, and alerting

### API Design
- RESTful API design principles
- Comprehensive error handling
- Rate limiting and throttling
- CORS support for web applications
- Consistent JSON response format

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
Development: https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev//
```

## 📚 Documentation

### 🌐 **Interactive API Documentation**
- **[Live Swagger UI](https://d2xyhdliouir95.cloudfront.net)** - Interactive API documentation with live testing
- **[OpenAPI Specification](./docs/openapi.yaml)** - Complete OpenAPI 3.0 specification

### 📖 **Comprehensive Guides**
Detailed documentation is available in the [`/docs`](./docs) directory:

- **[API Reference](./docs/API_REFERENCE.md)** - Complete API endpoint documentation
- **[OpenAPI Documentation](./docs/OPENAPI_DOCUMENTATION.md)** - OpenAPI system setup and usage
- **[Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)** - Infrastructure deployment instructions
- **[Frontend Integration](./docs/FRONTEND_INTEGRATION_GUIDE.md)** - Integration guide for frontend applications
- **[Project Status](./docs/PROJECT_STATUS.md)** - Current implementation status and progress
- **[Security Guide](./docs/SECURITY_GUIDE.md)** - Security features and implementation
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🔧 Development

### Project Structure
```
├── infrastructure/          # AWS CDK infrastructure code
│   ├── bin/                # CDK app entry point
│   ├── lib/                # Stack definitions
│   ├── lambda/             # Lambda function code
│   └── test/               # Infrastructure tests
├── docs/                   # Comprehensive documentation
├── scripts/                # Utility scripts
└── package.json           # Project dependencies
```

### Available Scripts
```bash
npm run build              # Build TypeScript
npm run test               # Run tests
npm run lint               # Run ESLint
npm run build:docs         # Build OpenAPI documentation
npm run deploy:dev         # Deploy to development
npm run deploy:staging     # Deploy to staging
npm run deploy:prod        # Deploy to production
npm run destroy:dev        # Destroy development stack
```

## 🌍 Environments

- **Development** - Active development and testing
- **Staging** - Pre-production testing and QA  
- **Production** - Live customer environment

## 📊 Current Status

- ✅ **Infrastructure**: Complete AWS serverless backend
- ✅ **Authentication**: Cognito with role-based access
- ✅ **API Endpoints**: 15+ endpoints implemented
- ✅ **Database**: 8 DynamoDB tables with GSIs
- ✅ **Monitoring**: CloudWatch dashboards and alarms
- ✅ **Documentation**: Interactive OpenAPI/Swagger UI + comprehensive guides
- ✅ **API Documentation**: Live interactive documentation with testing capabilities

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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏢 About Aerotage

Aerotage Design Group, Inc. is a professional design and development company. This time reporting API serves as the backend for our internal time tracking and project management system.

## 📞 Support

For questions, issues, or contributions:

- **Documentation**: Check the [`/docs`](./docs) directory
- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Email**: Contact the development team for urgent matters

---

**Built with ❤️ using AWS CDK and TypeScript** 