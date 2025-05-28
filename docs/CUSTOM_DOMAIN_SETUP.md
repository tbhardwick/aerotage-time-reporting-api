# Custom Domain Setup for Aerotage Time Reporting API

## 🌐 Overview

This document describes the setup and management of custom domains for the Aerotage Time Reporting API. The custom domain implementation provides professional URLs for the API while maintaining complete safety for existing DNS records.

## 🎯 Domain Strategy

### **Recommended Domain Names**

| Environment | Domain Name | Purpose |
|-------------|-------------|---------|
| Development | `time-api-dev.aerotage.com` | Development API endpoint |
| Staging | `time-api-staging.aerotage.com` | Staging API endpoint |
| Production | `time-api.aerotage.com` | Production API endpoint |

### **Why These Names Are Safe**
- ✅ **Specific to time reporting**: Clear purpose identification
- ✅ **Environment-specific**: `-dev`, `-staging` suffixes prevent conflicts
- ✅ **Non-conflicting**: Won't interfere with `app.aerotage.com` or other subdomains
- ✅ **Professional**: Clean, memorable URLs for API consumers

## 🏗️ Architecture

### **AWS Resources Created**
1. **Route 53 A Record**: Points custom domain to API Gateway
2. **ACM Certificate**: SSL/TLS certificate for HTTPS
3. **API Gateway Custom Domain**: Maps custom domain to API Gateway
4. **CloudFormation Stack**: `AerotageDomain-{stage}` manages all resources

### **DNS Safety Measures**
- ✅ **Pre-deployment validation**: Checks if domain already exists
- ✅ **Automatic backups**: Creates DNS backups before any changes
- ✅ **Non-destructive**: Only adds new records, never modifies existing ones
- ✅ **Rollback capability**: Complete rollback with DNS restoration

## 🚀 Deployment

### **Prerequisites**
- AWS CLI configured with appropriate permissions
- Node.js and npm installed
- `jq` command-line JSON processor
- Access to `aerotage.com` hosted zone

### **Quick Deployment**
```bash
# Deploy custom domain for dev environment
./scripts/deploy-custom-domain.sh dev

# Deploy for staging (when ready)
./scripts/deploy-custom-domain.sh staging

# Deploy for production (when ready)
./scripts/deploy-custom-domain.sh prod
```

### **Step-by-Step Deployment**

#### **1. Create DNS Backup**
```bash
# Automatic backup is created by the script
# Manual backup (optional):
aws route53 list-resource-record-sets \
  --hosted-zone-id ZZAP8VVAZFA7H \
  --output json > dns-backup-$(date +%Y%m%d-%H%M%S).json
```

#### **2. Validate Domain Availability**
```bash
# Check if domain already exists
aws route53 list-resource-record-sets \
  --hosted-zone-id ZZAP8VVAZFA7H \
  --query "ResourceRecordSets[?Name=='time-api-dev.aerotage.com.']"
```

#### **3. Deploy Domain Stack**
```bash
cd infrastructure
npx cdk deploy AerotageDomain-dev --require-approval never
```

#### **4. Verify Deployment**
```bash
# Check DNS record creation
aws route53 list-resource-record-sets \
  --hosted-zone-id ZZAP8VVAZFA7H \
  --query "ResourceRecordSets[?Name=='time-api-dev.aerotage.com.']"

# Test domain resolution (may take 5-10 minutes)
nslookup time-api-dev.aerotage.com

# Test HTTPS connectivity (after certificate validation)
curl -I https://time-api-dev.aerotage.com/health
```

## 🔄 Rollback

### **Quick Rollback**
```bash
# Rollback dev environment
./scripts/rollback-custom-domain.sh dev
```

### **Manual Rollback Steps**

#### **1. Destroy CDK Stack**
```bash
cd infrastructure
npx cdk destroy AerotageDomain-dev --force
```

#### **2. Verify DNS Cleanup**
```bash
# Check that DNS records were removed
aws route53 list-resource-record-sets \
  --hosted-zone-id ZZAP8VVAZFA7H \
  --query "ResourceRecordSets[?Name=='time-api-dev.aerotage.com.']"
```

#### **3. Remove from CDK App (if needed)**
```typescript
// Comment out in infrastructure/bin/aerotage-time-api.ts
// const domainStack = new DomainStack(app, `AerotageDomain-${stage}`, {
//   ...
// });
```

## 📋 Configuration

### **Domain Stack Configuration**
```typescript
// infrastructure/lib/domain-stack.ts
export interface DomainStackProps extends cdk.StackProps {
  stage: string;                    // 'dev', 'staging', 'prod'
  hostedZoneName: string;          // 'aerotage.com'
  restApi: apigateway.IRestApi;    // API Gateway reference
  apiGatewayStage: string;         // API Gateway stage name
}
```

### **Environment Variables**
```bash
# Set in deployment environment
STAGE=dev                         # Environment stage
AWS_REGION=us-east-1             # AWS region
CDK_DEFAULT_ACCOUNT=659943476000 # AWS account ID
```

### **CDK Context**
```json
// infrastructure/cdk.context.json
{
  "hosted-zone:account=659943476000:domainName=aerotage.com:region=us-east-1": {
    "Id": "/hostedzone/ZZAP8VVAZFA7H",
    "Name": "aerotage.com."
  }
}
```

## 🔐 Security Considerations

### **DNS Security**
- ✅ **Backup Strategy**: Automatic DNS backups before changes
- ✅ **Validation**: Pre-deployment domain availability checks
- ✅ **Least Privilege**: CDK uses minimal required permissions
- ✅ **Audit Trail**: CloudFormation tracks all resource changes

### **Certificate Security**
- ✅ **DNS Validation**: ACM certificates use DNS validation
- ✅ **Automatic Renewal**: ACM handles certificate renewal
- ✅ **TLS 1.2+**: Modern security policy enforcement
- ✅ **Regional Certificates**: Certificates created in API region

### **Access Control**
- ✅ **IAM Permissions**: Restricted to necessary Route 53 and ACM actions
- ✅ **Resource Tagging**: All resources tagged for identification
- ✅ **Stack Isolation**: Domain resources isolated in separate stack

## 🧪 Testing

### **DNS Testing**
```bash
# Test DNS resolution
nslookup time-api-dev.aerotage.com

# Test with dig for detailed info
dig time-api-dev.aerotage.com A

# Test from different DNS servers
nslookup time-api-dev.aerotage.com 8.8.8.8
```

### **HTTPS Testing**
```bash
# Test HTTPS connectivity
curl -I https://time-api-dev.aerotage.com/health

# Test certificate details
openssl s_client -connect time-api-dev.aerotage.com:443 -servername time-api-dev.aerotage.com

# Test API endpoints
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://time-api-dev.aerotage.com/users
```

### **Performance Testing**
```bash
# Test response times
curl -w "@curl-format.txt" -o /dev/null -s https://time-api-dev.aerotage.com/health

# Load testing (use appropriate tools)
ab -n 100 -c 10 https://time-api-dev.aerotage.com/health
```

## 🔧 Troubleshooting

### **Common Issues**

#### **Certificate Validation Timeout**
```bash
# Check certificate status
aws acm describe-certificate --certificate-arn $CERT_ARN

# Check DNS validation records
aws route53 list-resource-record-sets \
  --hosted-zone-id ZZAP8VVAZFA7H \
  --query "ResourceRecordSets[?Type=='CNAME' && contains(Name, '_')]"
```

**Solution**: Certificate validation can take 5-30 minutes. Wait for DNS propagation.

#### **Domain Not Resolving**
```bash
# Check if DNS record exists
aws route53 list-resource-record-sets \
  --hosted-zone-id ZZAP8VVAZFA7H \
  --query "ResourceRecordSets[?Name=='time-api-dev.aerotage.com.']"
```

**Solution**: DNS propagation can take up to 48 hours globally, but typically 5-10 minutes.

#### **403 Forbidden Errors**
```bash
# Check API Gateway custom domain mapping
aws apigateway get-domain-name --domain-name time-api-dev.aerotage.com

# Check base path mappings
aws apigateway get-base-path-mappings --domain-name time-api-dev.aerotage.com
```

**Solution**: Verify API Gateway custom domain configuration and base path mappings.

#### **Stack Deployment Failures**
```bash
# Check CloudFormation events
aws cloudformation describe-stack-events --stack-name AerotageDomain-dev

# Check CDK diff
cd infrastructure && npx cdk diff AerotageDomain-dev
```

**Solution**: Review CloudFormation events for specific error details.

### **Emergency Procedures**

#### **Immediate Rollback**
```bash
# If deployment causes issues, immediate rollback:
./scripts/rollback-custom-domain.sh dev

# Or manual emergency rollback:
cd infrastructure
npx cdk destroy AerotageDomain-dev --force
```

#### **DNS Record Corruption**
```bash
# Restore from backup (replace with actual backup file)
aws route53 change-resource-record-sets \
  --hosted-zone-id ZZAP8VVAZFA7H \
  --change-batch file://restore-records.json
```

## 📊 Monitoring

### **CloudWatch Metrics**
- API Gateway custom domain metrics
- Certificate Manager certificate status
- Route 53 query metrics

### **Alarms**
- Certificate expiration warnings
- DNS resolution failures
- API Gateway custom domain errors

### **Logging**
- CloudFormation stack events
- API Gateway access logs
- Route 53 query logs (if enabled)

## 🔄 Maintenance

### **Regular Tasks**
- ✅ **Monthly**: Review certificate status
- ✅ **Quarterly**: Validate DNS backup strategy
- ✅ **Annually**: Review domain naming strategy

### **Updates**
- Certificate renewal is automatic via ACM
- DNS records are managed via CDK
- Stack updates via CDK deployment

## 📚 References

### **AWS Documentation**
- [Route 53 Developer Guide](https://docs.aws.amazon.com/route53/)
- [Certificate Manager User Guide](https://docs.aws.amazon.com/acm/)
- [API Gateway Custom Domain Names](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-custom-domains.html)

### **CDK Documentation**
- [AWS CDK Route 53 Constructs](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-route53-readme.html)
- [AWS CDK Certificate Manager Constructs](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-certificatemanager-readme.html)

### **Project Files**
- `infrastructure/lib/domain-stack.ts` - Domain stack implementation
- `scripts/deploy-custom-domain.sh` - Deployment script
- `scripts/rollback-custom-domain.sh` - Rollback script
- `docs/DEPLOYMENT_GUIDE.md` - General deployment guide

---

## ⚠️ Important Notes

1. **DNS Safety**: All scripts include safety checks to prevent overwriting existing DNS records
2. **Backup Strategy**: Always create DNS backups before making changes
3. **Certificate Validation**: Allow 5-30 minutes for certificate validation to complete
4. **DNS Propagation**: Allow up to 48 hours for global DNS propagation
5. **Testing**: Always test in dev environment before deploying to staging/production

**Remember**: The custom domain setup is designed to be completely safe and non-destructive to existing DNS infrastructure. All changes are reversible and backed up. 