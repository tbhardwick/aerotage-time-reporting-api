# Custom Domain Pipeline Integration Guide

## 🔄 **How Custom Domains Work in Deployment Pipeline**

This document explains how custom domains integrate with the deployment pipeline and handle automatic updates when API Gateway deployments change.

## 🎯 **The Problem Custom Domains Solve**

### **Before Custom Domain (Current State)**
```
Frontend → https://time-api-dev.aerotage.com/
           ↑
           This URL can change if API Gateway is recreated
```

**Issues:**
- ❌ Random AWS-generated URLs that can change
- ❌ Frontend needs manual updates if API Gateway URL changes
- ❌ Unprofessional URLs for API consumers
- ❌ No control over SSL certificates

### **After Custom Domain (New State)**
```
Frontend → https://time-api-dev.aerotage.com/
           ↓
Route 53 A Record (ALIAS) → API Gateway Custom Domain
                            ↓
                            API Gateway (any URL/IP)
```

**Benefits:**
- ✅ Professional, stable URLs that never change
- ✅ Automatic handling of API Gateway IP/URL changes
- ✅ Custom SSL certificates
- ✅ Frontend never needs URL updates

## 🏗️ **Architecture Deep Dive**

### **How Automatic Updates Work**

The custom domain creates a **three-layer abstraction** that automatically handles changes:

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 1: DNS                            │
│  Route 53 A Record (ALIAS)                                 │
│  ├── time-api-dev.aerotage.com                            │
│  └── Points to: API Gateway Custom Domain                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                Layer 2: API Gateway Custom Domain          │
│  AWS-Managed Custom Domain                                 │
│  ├── Handles SSL termination                              │
│  ├── Maps to current API Gateway deployment               │
│  └── Automatically updates when API Gateway changes       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                Layer 3: API Gateway                        │
│  Current API Gateway Deployment                           │
│  ├── https://time-api-dev.aerotage.com │
│  ├── Can change IPs/URLs during redeployment              │
│  └── Custom domain automatically follows changes          │
└─────────────────────────────────────────────────────────────┘
```

### **Key Components**

#### **1. Route 53 ALIAS Record**
```typescript
new route53.ARecord(this, 'ApiAliasRecord', {
  zone: hostedZone,
  recordName: apiSubdomain,
  target: route53.RecordTarget.fromAlias(
    new route53Targets.ApiGatewayDomain(customDomain)
  ),
  comment: `API Gateway custom domain for ${stage} environment`,
});
```

**What it does:**
- Creates DNS record: `time-api-dev.aerotage.com` → API Gateway Custom Domain
- **ALIAS record** (not CNAME) - automatically resolves to current IP
- **No manual updates needed** - AWS handles IP changes automatically

#### **2. API Gateway Custom Domain**
```typescript
const customDomain = new apigateway.DomainName(this, 'ApiCustomDomain', {
  domainName: this.domainName,
  certificate: certificate,
  endpointType: apigateway.EndpointType.REGIONAL,
  securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
});

// This is the magic - automatic mapping
customDomain.addBasePathMapping(restApi, {
  basePath,
});
```

**What it does:**
- Creates AWS-managed custom domain endpoint
- **Automatically maps** to current API Gateway deployment
- **Handles SSL termination** with ACM certificate
- **Updates automatically** when API Gateway changes

#### **3. Base Path Mapping**
```typescript
customDomain.addBasePathMapping(restApi, {
  basePath: '', // Root path
});
```

**What it does:**
- Maps custom domain root (`/`) to API Gateway stage
- **Automatically updates** when API Gateway is redeployed
- **No manual intervention** required

## 🚀 **Pipeline Integration**

### **Deployment Order**

The CDK automatically handles the correct deployment order:

```typescript
// In infrastructure/bin/aerotage-time-api.ts
const apiStack = new ApiStack(app, `AerotageAPI-${stage}`, {
  // ... API Gateway configuration
});

const domainStack = new DomainStack(app, `AerotageDomain-${stage}`, {
  stage,
  hostedZoneName: 'aerotage.com',
  restApi: apiStack.api, // Reference to API Gateway
  apiGatewayStage: stage,
  // ...
});

// Dependency ensures correct order
domainStack.addDependency(apiStack);
```

**Deployment Flow:**
1. **API Stack deploys first** - Creates API Gateway with random URL
2. **Domain Stack deploys second** - Creates custom domain pointing to API Gateway
3. **Automatic mapping** - Custom domain automatically maps to current API Gateway

### **What Happens During Redeployment**

#### **Scenario 1: Lambda Function Updates**
```bash
# Developer updates Lambda function code
npm run deploy:dev
```

**Result:**
- ✅ Lambda functions update
- ✅ API Gateway stays the same
- ✅ Custom domain continues working
- ✅ **No changes needed**

#### **Scenario 2: API Gateway Configuration Changes**
```bash
# Developer adds new endpoints or changes API Gateway settings
npm run deploy:dev
```

**Result:**
- ✅ API Gateway updates (may get new internal URL)
- ✅ Custom domain **automatically remaps** to new API Gateway
- ✅ DNS continues pointing to custom domain
- ✅ **No frontend changes needed**

#### **Scenario 3: Complete Infrastructure Rebuild**
```bash
# Complete stack recreation
npm run destroy:dev
npm run deploy:dev
```

**Result:**
- ✅ New API Gateway created with different URL
- ✅ Custom domain **automatically maps** to new API Gateway
- ✅ DNS record remains unchanged
- ✅ **Frontend continues working without changes**

## 📋 **Pipeline Commands**

### **Standard Deployment (with Custom Domain)**
```bash
# Deploy everything including custom domain
npm run deploy:dev

# This deploys:
# 1. All infrastructure stacks (API, Database, etc.)
# 2. Custom domain stack
# 3. Automatic mapping between them
```

### **Domain-Only Operations**
```bash
# Test domain prerequisites
npm run test:domain:setup

# Deploy only custom domain (after API is deployed)
npm run deploy:domain:dev

# Rollback custom domain
npm run rollback:domain:dev
```

### **Verification Commands**
```bash
# Test the custom domain
curl -I https://time-api-dev.aerotage.com/health

# Compare with direct API Gateway URL
curl -I https://time-api-dev.aerotage.com/health

# Both should return the same response
```

## 🔄 **Automatic Update Mechanisms**

### **1. DNS Level (Route 53)**
- **ALIAS records** automatically resolve to current IP addresses
- **No TTL issues** - updates propagate immediately
- **AWS-managed** - no manual DNS updates required

### **2. API Gateway Level**
- **Base path mappings** automatically update when API Gateway changes
- **CloudFormation manages** the mapping relationship
- **Atomic updates** - no downtime during changes

### **3. Certificate Level**
- **ACM certificates** automatically renew
- **DNS validation** handles verification automatically
- **No manual certificate management** required

## 🧪 **Testing Automatic Updates**

### **Test 1: Verify Current Mapping**
```bash
# Check current API Gateway URL
aws apigateway get-rest-apis --query 'items[?name==`aerotage-time-api-dev`]'

# Check custom domain mapping
aws apigateway get-domain-name --domain-name time-api-dev.aerotage.com

# Verify they point to the same API
```

### **Test 2: Deploy Changes and Verify**
```bash
# Make a small change to API
# Deploy the change
npm run deploy:dev

# Verify custom domain still works
curl -I https://time-api-dev.aerotage.com/health

# Check if mapping updated automatically
aws apigateway get-base-path-mappings --domain-name time-api-dev.aerotage.com
```

### **Test 3: Complete Recreation Test**
```bash
# Destroy and recreate (in dev environment only!)
npm run destroy:dev
npm run deploy:dev

# Verify custom domain automatically maps to new API Gateway
curl -I https://time-api-dev.aerotage.com/health
```

## 📊 **Monitoring Pipeline Integration**

### **CloudWatch Metrics**
The custom domain provides additional monitoring capabilities:

```bash
# Monitor custom domain usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=DomainName,Value=time-api-dev.aerotage.com \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum

# Monitor certificate status
aws acm describe-certificate --certificate-arn $CERT_ARN
```

### **Health Checks**
```bash
# Add to deployment pipeline
#!/bin/bash
echo "Testing custom domain health..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://time-api-dev.aerotage.com/health)
if [ "$RESPONSE" = "200" ]; then
  echo "✅ Custom domain is healthy"
else
  echo "❌ Custom domain health check failed: $RESPONSE"
  exit 1
fi
```

## 🔐 **Security in Pipeline**

### **Certificate Management**
- **Automatic renewal** - ACM handles certificate lifecycle
- **DNS validation** - no manual verification required
- **CloudFormation managed** - certificates tied to infrastructure

### **DNS Security**
- **ALIAS records** prevent DNS hijacking
- **AWS-managed resolution** - no external DNS dependencies
- **Audit trail** - all changes logged in CloudFormation

## 🚨 **Troubleshooting Pipeline Issues**

### **Issue 1: Custom Domain Not Updating**
```bash
# Check base path mapping
aws apigateway get-base-path-mappings --domain-name time-api-dev.aerotage.com

# Check API Gateway deployment
aws apigateway get-deployments --rest-api-id YOUR_API_ID

# Verify CloudFormation stack status
aws cloudformation describe-stacks --stack-name AerotageDomain-dev
```

**Solution:**
```bash
# Redeploy domain stack
npm run deploy:domain:dev
```

### **Issue 2: Certificate Validation Stuck**
```bash
# Check certificate status
aws acm describe-certificate --certificate-arn $CERT_ARN

# Check DNS validation records
aws route53 list-resource-record-sets \
  --hosted-zone-id ZZAP8VVAZFA7H \
  --query "ResourceRecordSets[?Type=='CNAME' && contains(Name, '_')]"
```

**Solution:**
- Wait 5-30 minutes for DNS propagation
- Certificate validation is automatic but can take time

### **Issue 3: DNS Not Resolving**
```bash
# Test DNS resolution
nslookup time-api-dev.aerotage.com

# Check Route 53 record
aws route53 list-resource-record-sets \
  --hosted-zone-id ZZAP8VVAZFA7H \
  --query "ResourceRecordSets[?Name=='time-api-dev.aerotage.com.']"
```

**Solution:**
- DNS propagation can take up to 48 hours globally
- Usually resolves within 5-10 minutes

## 📈 **Performance Impact**

### **Latency Considerations**
- **Custom domain adds ~1-2ms** latency for DNS resolution
- **ALIAS records** resolve faster than CNAME records
- **Regional endpoints** minimize latency

### **Caching Benefits**
- **DNS caching** improves subsequent request performance
- **CloudFront integration** possible for further optimization
- **Browser caching** of DNS resolution

## 🎯 **Best Practices**

### **1. Environment Naming**
```typescript
// Use consistent naming across environments
const apiSubdomain = stage === 'prod' ? 'time-api' : `time-api-${stage}`;
```

### **2. Dependency Management**
```typescript
// Always set proper dependencies
domainStack.addDependency(apiStack);
```

### **3. Monitoring Integration**
```typescript
// Include custom domain in monitoring
new cdk.CfnOutput(this, 'ApiUrl', {
  value: this.apiUrl,
  description: 'API base URL with custom domain',
  exportName: `ApiUrl-${stage}`,
});
```

### **4. Testing in Pipeline**
```bash
# Add to CI/CD pipeline
npm run test:domain:setup
npm run deploy:dev
curl -f https://time-api-dev.aerotage.com/health || exit 1
```

## 📚 **Integration Examples**

### **Frontend Configuration**
```typescript
// Frontend can now use stable URLs
const API_CONFIG = {
  dev: 'https://time-api-dev.aerotage.com',
  staging: 'https://time-api-staging.aerotage.com',
  prod: 'https://time-api.aerotage.com'
};

// No more random AWS URLs!
const apiUrl = API_CONFIG[process.env.NODE_ENV];
```

### **CI/CD Pipeline Integration**
```yaml
# GitHub Actions example
- name: Deploy Infrastructure
  run: npm run deploy:dev

- name: Test Custom Domain
  run: |
    curl -f https://time-api-dev.aerotage.com/health
    echo "Custom domain is working!"

- name: Update Frontend Config
  run: |
    # Frontend automatically uses stable custom domain
    # No configuration changes needed!
```

---

## 🎉 **Summary**

### **The Magic of Custom Domains**
1. **Frontend uses stable URL**: `https://time-api-dev.aerotage.com`
2. **AWS handles all IP changes automatically**
3. **No manual updates ever required**
4. **Professional URLs for all environments**
5. **Automatic SSL certificate management**

### **Pipeline Benefits**
- ✅ **Zero-downtime deployments** - custom domain automatically follows API Gateway changes
- ✅ **No frontend updates** - URLs never change
- ✅ **Automatic SSL management** - certificates renew automatically
- ✅ **Professional appearance** - clean, branded URLs
- ✅ **Environment consistency** - same pattern across dev/staging/prod

### **Developer Experience**
- ✅ **Deploy once, works forever** - no ongoing maintenance
- ✅ **Automatic updates** - infrastructure handles everything
- ✅ **Easy testing** - stable URLs for all environments
- ✅ **No surprises** - URLs never change unexpectedly

**The custom domain implementation eliminates the IP/URL change problem completely through AWS's managed infrastructure and automatic mapping capabilities.** 