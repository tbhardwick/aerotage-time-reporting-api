# OpenAPI Custom Domain Integration Guide

## 🌐 **Overview**

This document explains how the OpenAPI documentation automatically integrates with custom domains and updates when domains are deployed.

## 🎯 **The Problem Solved**

### **Before Custom Domain Integration**
- OpenAPI documentation showed raw AWS API Gateway URLs
- Documentation needed manual updates when API Gateway URLs changed
- Different environments had inconsistent documentation URLs
- Frontend developers had to use different URLs for testing vs documentation

### **After Custom Domain Integration**
- OpenAPI documentation automatically uses custom domain URLs
- Documentation updates automatically when custom domains are deployed
- Consistent professional URLs across all environments
- Frontend developers can use the same URLs for both API calls and documentation

## 🏗️ **How It Works**

### **Automatic URL Updates**

The OpenAPI documentation system automatically updates URLs through a multi-step process:

```
1. Custom Domain Deployed
   ↓
2. OpenAPI Build Script Triggered
   ↓
3. Documentation Updated with Custom Domain URLs
   ↓
4. JSON Specification Generated
   ↓
5. Documentation Stack Deployed (if applicable)
```

### **Integration Points**

#### **1. Build Scripts**
```bash
# Package.json commands automatically use custom domain URLs
npm run build:docs:dev      # Uses https://time-api-dev.aerotage.com/
npm run build:docs:staging  # Uses https://time-api-staging.aerotage.com/
npm run build:docs:prod     # Uses https://time-api.aerotage.com/
```

#### **2. OpenAPI YAML Source**
```yaml
# docs/openapi.yaml - Updated to use custom domains
servers:
  - url: https://time-api-dev.aerotage.com/
    description: Development server
  - url: https://time-api-staging.aerotage.com/
    description: Staging server
  - url: https://time-api.aerotage.com/
    description: Production server
```

#### **3. Dynamic Build Process**
```javascript
// scripts/build-openapi.js - Dynamically updates server URLs
const stage = process.argv[2] || 'dev';
const apiGatewayUrl = process.argv[3] || 'https://time-api-dev.aerotage.com/';

openApiSpec.servers = [
  {
    url: apiGatewayUrl,
    description: stage === 'prod' ? 'Production server' : 'Development server'
  }
];
```

## 🚀 **Deployment Integration**

### **Automatic Updates During Deployment**

When you deploy a custom domain, the OpenAPI documentation automatically updates:

```bash
# Deploy custom domain
npm run deploy:domain:dev

# This automatically:
# 1. Deploys the custom domain infrastructure
# 2. Updates OpenAPI documentation with new URLs
# 3. Rebuilds the JSON specification
# 4. Deploys updated documentation
```

### **Manual Updates**

You can also manually update the OpenAPI documentation:

```bash
# Update OpenAPI docs for specific environment
npm run update:docs:domains:dev
npm run update:docs:domains:staging
npm run update:docs:domains:prod

# Or use the script directly
./scripts/update-openapi-domains.sh dev
```

## 📋 **Environment-Specific URLs**

### **Development Environment**
- **API URL**: `https://time-api-dev.aerotage.com/`
- **Documentation**: Uses dev custom domain
- **Build Command**: `npm run build:docs:dev`

### **Staging Environment**
- **API URL**: `https://time-api-staging.aerotage.com/`
- **Documentation**: Uses staging custom domain
- **Build Command**: `npm run build:docs:staging`

### **Production Environment**
- **API URL**: `https://time-api.aerotage.com/`
- **Documentation**: Uses production custom domain
- **Build Command**: `npm run build:docs:prod`

## 🔄 **Update Process**

### **Automatic Update Flow**

1. **Custom Domain Deployment**
   ```bash
   npm run deploy:domain:dev
   ```

2. **OpenAPI Update Triggered**
   - Script detects custom domain deployment
   - Updates OpenAPI YAML with custom domain URLs
   - Rebuilds JSON specification

3. **Documentation Deployment**
   - Updates Swagger UI with new URLs
   - Deploys documentation stack (if applicable)
   - Verifies documentation accessibility

### **Manual Update Process**

```bash
# Step 1: Update OpenAPI documentation
npm run update:docs:domains:dev

# Step 2: Verify updates
curl -I https://time-api-dev.aerotage.com/health

# Step 3: Check documentation
open docs/swagger-ui/index.html
```

## 🧪 **Testing Integration**

### **Verify OpenAPI URLs**

```bash
# Check generated OpenAPI JSON
grep -A 5 "servers" docs/swagger-ui/openapi.json

# Should show custom domain URLs:
# "servers": [
#   {
#     "url": "https://time-api-dev.aerotage.com/",
#     "description": "Development server"
#   }
# ]
```

### **Test API Connectivity**

```bash
# Test API endpoint
curl -I https://time-api-dev.aerotage.com/health

# Test with authentication
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://time-api-dev.aerotage.com/users
```

### **Verify Documentation**

```bash
# Check if documentation contains custom domain
grep "time-api" docs/swagger-ui/openapi.json

# Open Swagger UI
open docs/swagger-ui/index.html
```

## 📊 **Monitoring and Validation**

### **Automated Validation**

The update script automatically validates:

- ✅ Custom domain is deployed
- ✅ OpenAPI YAML is updated
- ✅ JSON specification is generated
- ✅ Documentation contains custom domain URLs
- ✅ API is accessible via custom domain

### **Manual Validation**

```bash
# Validate OpenAPI specification
npm run validate:docs

# Check API accessibility
curl -f https://time-api-dev.aerotage.com/health

# Verify documentation deployment
aws cloudformation describe-stacks --stack-name AerotageDocumentation-dev
```

## 🔧 **Troubleshooting**

### **Common Issues**

#### **Issue 1: OpenAPI Still Shows Old URLs**
```bash
# Solution: Manually rebuild documentation
npm run build:docs:dev

# Or update with script
./scripts/update-openapi-domains.sh dev
```

#### **Issue 2: Custom Domain Not Accessible**
```bash
# Check domain deployment
aws route53 list-resource-record-sets \
  --hosted-zone-id ZZAP8VVAZFA7H \
  --query "ResourceRecordSets[?Name=='time-api-dev.aerotage.com.']"

# Check certificate status
aws acm list-certificates --query "CertificateSummaryList[?DomainName=='time-api-dev.aerotage.com']"
```

#### **Issue 3: Documentation Not Updated**
```bash
# Check if build script ran successfully
npm run build:docs:dev

# Verify JSON file was updated
ls -la docs/swagger-ui/openapi.json

# Check file contents
head -20 docs/swagger-ui/openapi.json
```

### **Recovery Steps**

```bash
# 1. Restore OpenAPI YAML from backup (if needed)
cp docs/openapi.yaml.backup docs/openapi.yaml

# 2. Rebuild documentation
npm run build:docs:dev

# 3. Redeploy documentation stack
cd infrastructure
npx cdk deploy AerotageDocumentation-dev
cd ..
```

## 📚 **Integration with Frontend**

### **Frontend Configuration**

With custom domains, frontend configuration becomes consistent:

```typescript
// Frontend API configuration
const API_CONFIG = {
  dev: 'https://time-api-dev.aerotage.com',
  staging: 'https://time-api-staging.aerotage.com',
  prod: 'https://time-api.aerotage.com'
};

// OpenAPI documentation URLs
const DOCS_CONFIG = {
  dev: 'https://time-api-dev.aerotage.com/docs',
  staging: 'https://time-api-staging.aerotage.com/docs',
  prod: 'https://time-api.aerotage.com/docs'
};
```

### **Development Workflow**

```bash
# 1. Deploy custom domain
npm run deploy:domain:dev

# 2. Documentation automatically updates
# (No manual steps required)

# 3. Frontend can immediately use new URLs
# API: https://time-api-dev.aerotage.com/
# Docs: Available in Swagger UI

# 4. Test integration
curl -I https://time-api-dev.aerotage.com/health
```

## 🎯 **Best Practices**

### **1. Always Update Documentation After Domain Changes**
```bash
# After deploying custom domain
npm run deploy:domain:dev
npm run update:docs:domains:dev
```

### **2. Validate URLs in Documentation**
```bash
# Check that documentation uses correct URLs
grep -A 10 "servers" docs/swagger-ui/openapi.json
```

### **3. Test Both API and Documentation**
```bash
# Test API
curl -I https://time-api-dev.aerotage.com/health

# Test documentation accessibility
open docs/swagger-ui/index.html
```

### **4. Keep Environments Consistent**
```bash
# Deploy all environments with custom domains
npm run deploy:domain:dev
npm run deploy:domain:staging
npm run deploy:domain:prod

# Update documentation for all environments
npm run update:docs:domains:dev
npm run update:docs:domains:staging
npm run update:docs:domains:prod
```

## 📈 **Benefits**

### **For Developers**
- ✅ **Consistent URLs** across API and documentation
- ✅ **Automatic updates** - no manual intervention required
- ✅ **Professional appearance** - branded URLs
- ✅ **Easy testing** - same URLs for development and documentation

### **For Frontend Teams**
- ✅ **Stable URLs** that never change
- ✅ **Environment consistency** - same pattern across dev/staging/prod
- ✅ **Easy integration** - documentation matches actual API URLs
- ✅ **No configuration drift** - URLs automatically stay in sync

### **For Operations**
- ✅ **Automated deployment** - documentation updates with infrastructure
- ✅ **Consistent monitoring** - same URLs for health checks and documentation
- ✅ **Professional presentation** - branded documentation URLs
- ✅ **Reduced maintenance** - automatic URL management

---

## 🎉 **Summary**

The OpenAPI custom domain integration provides:

1. **Automatic URL updates** when custom domains are deployed
2. **Consistent documentation** across all environments
3. **Professional appearance** with branded URLs
4. **Zero maintenance** - URLs stay in sync automatically
5. **Developer-friendly** - same URLs for API and documentation

**The integration eliminates the need for manual documentation updates and ensures that your API documentation always reflects the actual URLs your frontend will use.** 