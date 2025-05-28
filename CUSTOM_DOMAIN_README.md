# 🌐 Custom Domain Implementation for Aerotage Time Reporting API

## 📋 Summary

This branch implements a **safe and professional custom domain solution** for the Aerotage Time Reporting API, providing clean URLs while protecting existing DNS infrastructure.

## 🎯 Domain Strategy

| Environment | Current URL | New Custom Domain |
|-------------|-------------|-------------------|
| Development | `https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev/` | `https://time-api-dev.aerotage.com/` |
| Staging | *Not deployed* | `https://time-api-staging.aerotage.com/` |
| Production | *Not deployed* | `https://time-api.aerotage.com/` |

## ✅ Safety Features

- ✅ **DNS Backup**: Automatic backup before any changes
- ✅ **Domain Validation**: Checks if domain already exists
- ✅ **Non-destructive**: Only adds new records, never modifies existing
- ✅ **Complete Rollback**: Full rollback capability with DNS restoration
- ✅ **Isolated Stack**: Domain resources in separate CloudFormation stack

## 🚀 Quick Start

### **1. Test Prerequisites**
```bash
npm run test:domain:setup
```

### **2. Deploy Custom Domain (Dev)**
```bash
npm run deploy:domain:dev
```

### **3. Rollback (if needed)**
```bash
npm run rollback:domain:dev
```

## 📁 Files Added/Modified

### **New Files**
- `scripts/deploy-custom-domain.sh` - Safe deployment script
- `scripts/rollback-custom-domain.sh` - Complete rollback script  
- `scripts/test-domain-setup.sh` - Prerequisites validation
- `docs/CUSTOM_DOMAIN_SETUP.md` - Comprehensive documentation
- `CUSTOM_DOMAIN_README.md` - This summary

### **Modified Files**
- `infrastructure/bin/aerotage-time-api.ts` - Added DomainStack
- `infrastructure/lib/domain-stack.ts` - Updated domain naming
- `package.json` - Added domain management scripts

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Custom Domain Stack                      │
├─────────────────────────────────────────────────────────────┤
│  Route 53 A Record                                         │
│  ├── time-api-dev.aerotage.com                            │
│  └── Points to API Gateway Custom Domain                   │
│                                                             │
│  ACM Certificate                                           │
│  ├── SSL/TLS for time-api-dev.aerotage.com               │
│  └── DNS validation (automatic)                           │
│                                                             │
│  API Gateway Custom Domain                                 │
│  ├── Maps custom domain to existing API                   │
│  └── Base path mapping to API Gateway stage               │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Security & Safety

### **DNS Protection**
- Pre-deployment domain existence check
- Automatic DNS backup creation
- Non-destructive record addition only
- Complete rollback with backup restoration

### **AWS Resources**
- Separate CloudFormation stack for isolation
- Least privilege IAM permissions
- Resource tagging for identification
- Audit trail via CloudFormation

## ⏱️ Deployment Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| **Deployment** | 5-10 minutes | CloudFormation stack creation |
| **Certificate** | 5-30 minutes | ACM certificate DNS validation |
| **DNS Propagation** | 5-60 minutes | Global DNS propagation |
| **Full Availability** | 10-60 minutes | Complete custom domain functionality |

## 🧪 Testing

### **Prerequisites Test**
```bash
./scripts/test-domain-setup.sh dev
```

### **Post-Deployment Validation**
```bash
# DNS resolution
nslookup time-api-dev.aerotage.com

# HTTPS connectivity
curl -I https://time-api-dev.aerotage.com/health

# API functionality (with JWT token)
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://time-api-dev.aerotage.com/users
```

## 🔄 Management Commands

```bash
# Test prerequisites
npm run test:domain:setup

# Deploy custom domain
npm run deploy:domain:dev
npm run deploy:domain:staging
npm run deploy:domain:prod

# Rollback custom domain
npm run rollback:domain:dev
npm run rollback:domain:staging
npm run rollback:domain:prod
```

## 📚 Documentation

- **Complete Guide**: `docs/CUSTOM_DOMAIN_SETUP.md`
- **Deployment Scripts**: `scripts/deploy-custom-domain.sh`
- **Rollback Scripts**: `scripts/rollback-custom-domain.sh`
- **Test Scripts**: `scripts/test-domain-setup.sh`

## ⚠️ Important Notes

1. **DNS Safety**: All operations include safety checks and backups
2. **Existing Records**: Will not overwrite `app.aerotage.com` or other subdomains
3. **Certificate Validation**: May take 5-30 minutes for initial SSL certificate
4. **DNS Propagation**: Global propagation can take up to 48 hours
5. **Testing First**: Always test in dev environment before staging/production

## 🎯 Next Steps

1. **Test Prerequisites**: Run `npm run test:domain:setup`
2. **Deploy Dev Domain**: Run `npm run deploy:domain:dev`
3. **Validate Functionality**: Test API endpoints with new domain
4. **Update Frontend**: Configure frontend to use new domain
5. **Deploy Staging**: When ready, deploy staging environment
6. **Deploy Production**: Final production deployment

---

## 🔗 Related Resources

- **AWS Route 53**: [Documentation](https://docs.aws.amazon.com/route53/)
- **AWS Certificate Manager**: [Documentation](https://docs.aws.amazon.com/acm/)
- **API Gateway Custom Domains**: [Documentation](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-custom-domains.html)

**Remember**: This implementation is designed to be completely safe and non-destructive to your existing DNS infrastructure. All changes are reversible and backed up. 