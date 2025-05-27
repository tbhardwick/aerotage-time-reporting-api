# Aerotage Time Reporting API - Project Organization

## 📁 **Directory Structure**

This document outlines the organized file structure of the Aerotage Time Reporting API project after reorganization for better maintainability and clarity.

```
aerotage-time-reporting-api/
├── 📁 infrastructure/           # AWS CDK Infrastructure Code
│   ├── bin/                     # CDK app entry points
│   ├── lib/                     # CDK stack definitions
│   ├── lambda/                  # Lambda function implementations
│   └── test/                    # Infrastructure unit tests
├── 📁 scripts/                  # Operational & Testing Scripts
│   ├── test-*.js               # API endpoint testing scripts
│   ├── setup-*.sh              # Environment setup scripts
│   ├── build-*.js              # Build and deployment utilities
│   └── README-*.md             # Script-specific documentation
├── 📁 docs/                     # Project Documentation
│   ├── API_REFERENCE.md        # Complete API documentation
│   ├── FRONTEND_INTEGRATION_GUIDE.md # Integration guide
│   ├── openapi.yaml            # OpenAPI specification
│   ├── swagger-ui/             # Interactive API documentation
│   └── testing/                # Testing documentation
├── 📁 tools/                    # Development Utilities
│   └── auth/                   # Authentication utilities
│       ├── get-cognito-token.js # Cognito token generator
│       ├── get-token.js        # Generic token utility
│       └── test-*-payload.json # Auth test payloads
├── 📁 tests/                    # Jest Unit Tests
│   ├── setup.ts               # Test setup configuration
│   └── *.test.ts              # Unit test files
├── 📁 src/                      # Source Code (if applicable)
│   ├── handlers/               # Lambda handlers
│   ├── middleware/             # Middleware functions
│   ├── models/                 # Data models
│   ├── types/                  # TypeScript type definitions
│   └── utils/                  # Utility functions
├── 📁 dist/                     # Compiled output
├── 📁 node_modules/             # Dependencies
├── 📄 package.json              # Project configuration
├── 📄 package-lock.json         # Dependency lock file
├── 📄 tsconfig.json             # TypeScript configuration
├── 📄 jest.config.js            # Jest testing configuration
├── 📄 eslint.config.js          # ESLint configuration
├── 📄 .gitignore                # Git ignore rules
└── 📄 README.md                 # Main project documentation
```

## 📋 **Directory Purposes**

### **🏗️ `/infrastructure`**
**Purpose**: AWS CDK infrastructure as code
- **Primary Use**: Define and deploy AWS resources
- **Contents**: CDK stacks, Lambda functions, database schemas
- **Audience**: DevOps engineers, backend developers

### **⚙️ `/scripts`**
**Purpose**: Operational and testing scripts
- **Primary Use**: API testing, environment setup, deployment utilities
- **Contents**: 
  - `test-*.js` - API endpoint testing scripts
  - `setup-*.sh` - Environment configuration scripts
  - `build-*.js` - Build and deployment utilities
  - `README-*.md` - Script-specific documentation
- **Audience**: Developers, QA engineers, DevOps
- **Usage**: Run via npm scripts or directly

### **📚 `/docs`**
**Purpose**: Project documentation and API specifications
- **Primary Use**: Developer reference, API documentation, integration guides
- **Contents**:
  - API reference documentation
  - OpenAPI specifications
  - Integration guides
  - Testing documentation
- **Audience**: Frontend developers, API consumers, stakeholders

### **🔧 `/tools`**
**Purpose**: Development utilities and helper scripts
- **Primary Use**: Development workflow support
- **Contents**:
  - Authentication utilities
  - Token generators
  - Test data generators
  - Development helpers
- **Audience**: Developers during development

### **🧪 `/tests`**
**Purpose**: Formal unit and integration tests (Jest)
- **Primary Use**: Automated testing in CI/CD pipelines
- **Contents**:
  - Jest unit tests
  - Test setup and configuration
  - Mock data and fixtures
- **Audience**: Developers, CI/CD systems

### **💻 `/src`**
**Purpose**: Source code (if using TypeScript compilation)
- **Primary Use**: Shared source code, utilities, types
- **Contents**:
  - TypeScript source files
  - Shared utilities
  - Type definitions
- **Audience**: Developers

## 🎯 **File Organization Principles**

### **1. Separation of Concerns**
- **Infrastructure**: AWS resources and deployment
- **Scripts**: Operational tasks and testing
- **Documentation**: Reference materials and guides
- **Tools**: Development utilities
- **Tests**: Formal testing framework

### **2. Clear Naming Conventions**
- **Test Scripts**: `test-[feature].js` (e.g., `test-invoices.js`)
- **Setup Scripts**: `setup-[component].sh` (e.g., `setup-admin-user.sh`)
- **Build Scripts**: `build-[target].js` (e.g., `build-openapi.js`)
- **Documentation**: `[TOPIC]_[TYPE].md` (e.g., `API_REFERENCE.md`)

### **3. Logical Grouping**
- Related files are grouped in appropriate directories
- Similar functionality is co-located
- Dependencies are clearly defined

### **4. Accessibility**
- Important files remain in root (package.json, README.md, tsconfig.json)
- Configuration files are easily discoverable
- Documentation is prominently placed

## 📖 **Usage Guidelines**

### **For Developers**
1. **API Testing**: Use scripts in `/scripts` directory
2. **Documentation**: Refer to `/docs` for API reference
3. **Development Tools**: Use utilities in `/tools` for development tasks
4. **Unit Testing**: Add tests to `/tests` directory

### **For DevOps**
1. **Infrastructure**: Work with `/infrastructure` directory
2. **Deployment**: Use scripts in `/scripts` for deployment tasks
3. **Environment Setup**: Use setup scripts for environment configuration

### **For Frontend Developers**
1. **API Reference**: Use `/docs/API_REFERENCE.md`
2. **Integration Guide**: Follow `/docs/FRONTEND_INTEGRATION_GUIDE.md`
3. **Testing**: Use scripts in `/scripts` to test API endpoints

## 🔄 **Maintenance**

### **Adding New Files**
- **Test Scripts**: Add to `/scripts` with `test-` prefix
- **Documentation**: Add to `/docs` with appropriate naming
- **Utilities**: Add to `/tools` in relevant subdirectory
- **Unit Tests**: Add to `/tests` with `.test.ts` suffix

### **Updating Organization**
- Update this document when adding new directories
- Maintain consistent naming conventions
- Keep related files grouped together
- Update npm scripts in package.json as needed

## 📊 **Benefits of This Organization**

### **✅ Improved Maintainability**
- Clear separation of different file types
- Easy to locate specific functionality
- Reduced clutter in root directory

### **✅ Better Developer Experience**
- Intuitive directory structure
- Clear naming conventions
- Easy navigation and discovery

### **✅ Enhanced Collaboration**
- Clear ownership of different areas
- Easier onboarding for new developers
- Consistent organization patterns

### **✅ Scalability**
- Room for growth in each category
- Clear patterns for adding new files
- Maintainable as project grows

---

**Last Updated**: May 27, 2025  
**Organization Version**: 2.0  
**Status**: ✅ **Implemented and Active** 