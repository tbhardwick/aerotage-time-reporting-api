# OpenAPI Documentation System

## 🚀 **Overview**

The Aerotage Time Reporting API now features a comprehensive OpenAPI (Swagger) documentation system that provides:

- **Interactive API Documentation** with Swagger UI
- **Live API Testing** directly in the browser
- **Professional Documentation Hosting** via AWS CloudFront
- **Automated Deployment** integrated with CDK infrastructure
- **Version-controlled Specifications** in YAML format

## 📍 **Live Documentation URLs**

### **Development Environment**
- **Documentation URL**: https://d2xyhdliouir95.cloudfront.net
- **API Base URL**: https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev//

### **Production Environment** (When deployed)
- **Documentation URL**: Will be provided after production deployment
- **API Base URL**: https://api.aerotage.com/

## 🏗️ **Architecture**

### **Infrastructure Components**
1. **S3 Bucket**: `aerotage-api-docs-dev` - Hosts static documentation files
2. **CloudFront Distribution**: `E19YKBHW6A0RLE` - Global CDN for fast access
3. **Swagger UI**: Latest version (5.10.3) with custom styling
4. **OpenAPI Specification**: YAML source converted to JSON for deployment

### **File Structure**
```
docs/
├── openapi.yaml                 # ✅ OpenAPI 3.0 specification (source)
└── swagger-ui/
    ├── index.html               # ✅ Custom Swagger UI interface
    └── openapi.json             # ✅ Generated JSON spec (auto-created)

infrastructure/
├── lib/
│   └── documentation-stack.ts   # ✅ CDK stack for hosting
└── bin/
    └── aerotage-time-api.ts     # ✅ Updated to include docs stack

scripts/
└── build-openapi.js            # ✅ YAML to JSON conversion script
```

## 📋 **Current API Coverage**

### **✅ Documented Endpoints**
- **User Management** (6 endpoints)
- **User Profile** (2 endpoints)
- **User Preferences** (2 endpoints)
- **Security & Authentication** (4 endpoints)
- **Session Management** (3 endpoints)
- **User Invitations** (6 endpoints)

### **📋 Planned Documentation** (Future phases)
- **Team Management** (4 endpoints)
- **Project Management** (4 endpoints)
- **Client Management** (4 endpoints)
- **Time Tracking** (7 endpoints)
- **Reporting & Analytics** (5 endpoints)
- **Invoice Management** (5 endpoints)

## 🔧 **Development Workflow**

### **1. Updating API Documentation**

#### **Edit the OpenAPI Specification**
```bash
# Edit the YAML source file
vim docs/openapi.yaml
```

#### **Build and Test Locally**
```bash
# Convert YAML to JSON
node scripts/build-openapi.js dev https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev/

# Serve locally for testing (optional)
cd docs/swagger-ui
python3 -m http.server 8000
# Visit: http://localhost:8000
```

#### **Deploy Documentation**
```bash
cd infrastructure

# Development deployment
npm run deploy:dev

# Production deployment (when ready)
npm run deploy:prod
```

### **2. Adding New Endpoints**

When adding new API endpoints, update the OpenAPI specification:

1. **Add endpoint definition** in `docs/openapi.yaml`
2. **Define request/response schemas** in the `components` section
3. **Add appropriate tags** for organization
4. **Include authentication requirements**
5. **Provide examples** for request/response bodies

#### **Example Endpoint Addition**
```yaml
paths:
  /new-endpoint:
    post:
      tags:
        - New Feature
      summary: Create new resource
      description: Detailed description of the endpoint
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/NewResourceRequest'
      responses:
        '201':
          description: Resource created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NewResourceResponse'
```

### **3. Schema Management**

All data schemas are defined in the `components/schemas` section:

```yaml
components:
  schemas:
    NewResourceRequest:
      type: object
      required:
        - name
        - type
      properties:
        name:
          type: string
          description: Resource name
        type:
          type: string
          enum: [type1, type2, type3]
```

## 🚀 **Deployment Process**

### **Automated Deployment**
The documentation is automatically built and deployed with the infrastructure:

```bash
# This command will:
# 1. Build OpenAPI JSON from YAML
# 2. Deploy all infrastructure including documentation
npm run deploy:dev
```

### **Manual Documentation Update**
To update only the documentation without redeploying the entire infrastructure:

```bash
# Build the documentation
npm run build:docs:dev

# Deploy only the documentation stack
STAGE=dev cdk deploy AerotageDocumentation-dev
```

## 🎨 **Customization**

### **Swagger UI Customization**
The Swagger UI is customized with:

- **Custom header** with API information
- **Professional styling** with gradient backgrounds
- **Environment detection** (dev/prod)
- **Authentication guidance** for users
- **Responsive design** for mobile devices

### **Branding**
- **Colors**: Purple gradient theme matching Aerotage branding
- **Typography**: Clean, modern fonts
- **Layout**: Information cards with key API details
- **Icons**: Emoji-based icons for visual appeal

## 🔐 **Authentication in Documentation**

### **JWT Token Testing**
To test endpoints in the documentation:

1. **Obtain JWT token** from AWS Cognito (via frontend app)
2. **Click "Authorize" button** in Swagger UI
3. **Enter token** in format: `Bearer {your-jwt-token}`
4. **Test endpoints** using the "Try it out" feature

### **Authentication Note**
The documentation includes clear instructions for users on how to obtain and use authentication tokens.

## 📊 **Features**

### **Interactive Testing**
- **Try it out** functionality for all endpoints
- **Request/response examples** with real data
- **Parameter validation** and type checking
- **Error response documentation** with status codes

### **Professional Presentation**
- **Clean, modern UI** with custom styling
- **Organized by tags** (User Management, Security, etc.)
- **Searchable endpoints** with filter functionality
- **Mobile-responsive** design

### **Developer Experience**
- **Copy-paste ready** code examples
- **Complete schema documentation** with validation rules
- **Environment-specific URLs** (dev/prod)
- **Version information** and changelog support

## 🔄 **Continuous Integration**

### **Automated Updates**
- **Documentation builds** automatically on deployment
- **Environment-specific configurations** (dev/staging/prod)
- **CloudFront cache invalidation** for immediate updates
- **Version control** integration with Git

### **Quality Assurance**
- **YAML validation** during build process
- **Schema consistency** checking
- **Link validation** for external references
- **Accessibility compliance** in UI

## 📈 **Benefits Over Markdown Documentation**

### **For Developers**
1. **Interactive Testing** - Test APIs directly in browser
2. **Auto-completion** - IDE-like experience for API exploration
3. **Type Safety** - Clear parameter and response types
4. **Examples** - Real request/response examples
5. **Standards Compliance** - Industry-standard OpenAPI format

### **For Frontend Team**
1. **Code Generation** - Can generate client SDKs automatically
2. **Contract Testing** - Validate frontend against API spec
3. **Mock Servers** - Generate mock servers from specification
4. **Integration** - Easy integration with testing tools

### **For Project Management**
1. **Professional Appearance** - Client-ready documentation
2. **Version Control** - Track API changes over time
3. **Collaboration** - Easy sharing and review process
4. **Maintenance** - Single source of truth for API documentation

## 🛠️ **Troubleshooting**

### **Common Issues**

#### **Documentation Not Updating**
```bash
# Clear CloudFront cache
aws cloudfront create-invalidation --distribution-id E19YKBHW6A0RLE --paths "/*"

# Rebuild and redeploy
npm run build:docs:dev
STAGE=dev cdk deploy AerotageDocumentation-dev
```

#### **YAML Syntax Errors**
```bash
# Validate YAML syntax
node scripts/build-openapi.js dev

# Check for common issues:
# - Indentation (use spaces, not tabs)
# - Missing required fields
# - Invalid schema references
```

#### **Authentication Issues**
- Ensure JWT token is valid and not expired
- Check token format: `Bearer {token}` (note the space)
- Verify token has appropriate permissions for endpoint

### **Development Tips**

1. **Use YAML comments** to document complex schemas
2. **Reference existing schemas** to maintain consistency
3. **Test locally** before deploying to AWS
4. **Keep examples realistic** and up-to-date
5. **Use descriptive tags** for endpoint organization

## 🔮 **Future Enhancements**

### **Planned Features**
1. **API Versioning** - Support for multiple API versions
2. **Custom Domain** - docs.aerotage.com for production
3. **Analytics** - Track documentation usage and popular endpoints
4. **Feedback System** - Allow users to provide feedback on documentation
5. **Multi-language Support** - Documentation in multiple languages

### **Integration Opportunities**
1. **Postman Collection** - Auto-generate Postman collections
2. **SDK Generation** - Generate client libraries automatically
3. **Testing Integration** - Integrate with automated testing pipelines
4. **Monitoring** - Track API usage patterns from documentation

## 📞 **Support**

For questions or issues with the API documentation:

- **Technical Issues**: Check troubleshooting section above
- **Content Updates**: Edit `docs/openapi.yaml` and submit PR
- **Infrastructure Issues**: Contact DevOps team
- **Feature Requests**: Create GitHub issue with enhancement label

---

**Last Updated**: December 2024  
**Documentation Version**: 1.0.0  
**API Version**: 1.0.0-dev 