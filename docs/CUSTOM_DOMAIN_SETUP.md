# Custom Domain Setup Guide

This guide explains how to set up custom domains for the Aerotage Time Reporting API using Route 53 and AWS Certificate Manager for consistent URLs.

## Overview

Instead of using the auto-generated API Gateway URLs (which change when stacks are recreated), we'll set up custom domains:

- **Development**: `api-dev.aerotage.com`
- **Staging**: `api-staging.aerotage.com`
- **Production**: `api.aerotage.com`

## Prerequisites

1. **Domain Registration**: You need to own the `aerotage.com` domain
2. **Route 53 Hosted Zone**: A hosted zone for `aerotage.com` in Route 53
3. **AWS CLI**: Configured with appropriate permissions
4. **CDK**: AWS CDK v2 installed

## Step 1: Verify Route 53 Hosted Zone

First, check if you have a hosted zone for your domain:

```bash
aws route53 list-hosted-zones --query 'HostedZones[?contains(Name, `aerotage`)].{Name:Name,Id:Id}' --output table
```

If you don't have one, create it:

```bash
aws route53 create-hosted-zone --name aerotage.com --caller-reference $(date +%s)
```

## Step 2: Update Domain Configuration

Update the CDK app configuration to include your domain:

```typescript
// infrastructure/bin/aerotage-time-api.ts

// Add after the API stack creation
const domainStack = new DomainStack(app, `AerotageDomain-${stage}`, {
  stage,
  hostedZoneName: 'aerotage.com', // Replace with your domain
  restApi: apiStack.api,
  apiGatewayStage: 'dev',
  env,
  tags: commonTags,
});

// Add dependency
domainStack.addDependency(apiStack);
```

## Step 3: Deploy the Domain Stack

Deploy the domain stack to create the custom domain:

```bash
cd infrastructure
STAGE=dev cdk deploy AerotageDomain-dev --require-approval never
```

This will:
1. Create an SSL certificate for `api-dev.aerotage.com`
2. Validate the certificate using DNS validation
3. Create a custom domain in API Gateway
4. Map the custom domain to your API
5. Create a Route 53 A record pointing to the custom domain

## Step 4: Update Documentation URLs

Once the domain is deployed, update all documentation to use the custom domain:

```bash
# Update the URL update script
node scripts/update-api-urls.js --domain api-dev.aerotage.com
```

## Step 5: Verify the Setup

Test the custom domain:

```bash
# Test health endpoint
curl -X GET "https://api-dev.aerotage.com/health"

# Test authenticated endpoint
curl -X GET "https://api-dev.aerotage.com/users" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Configuration for Different Environments

### Development
- **Domain**: `api-dev.aerotage.com`
- **Certificate**: `aerotage-api-cert-dev`
- **Stack**: `AerotageDomain-dev`

### Staging
- **Domain**: `api-staging.aerotage.com`
- **Certificate**: `aerotage-api-cert-staging`
- **Stack**: `AerotageDomain-staging`

### Production
- **Domain**: `api.aerotage.com`
- **Certificate**: `aerotage-api-cert-prod`
- **Stack**: `AerotageDomain-prod`

## DNS Propagation

After deployment, DNS propagation may take 5-15 minutes. You can check the status:

```bash
# Check DNS resolution
nslookup api-dev.aerotage.com

# Check certificate
openssl s_client -connect api-dev.aerotage.com:443 -servername api-dev.aerotage.com
```

## Troubleshooting

### Certificate Validation Issues

If certificate validation fails:

1. Check that the hosted zone is correctly configured
2. Verify DNS records were created automatically
3. Wait for DNS propagation (up to 30 minutes)

```bash
# Check certificate status
aws acm list-certificates --query 'CertificateSummaryList[?contains(DomainName, `api-dev.aerotage.com`)]'
```

### Custom Domain Not Working

1. Verify the custom domain was created:
```bash
aws apigateway get-domain-names --query 'Items[?contains(DomainName, `api-dev.aerotage.com`)]'
```

2. Check the base path mapping:
```bash
aws apigateway get-base-path-mappings --domain-name api-dev.aerotage.com
```

3. Verify Route 53 record:
```bash
aws route53 list-resource-record-sets --hosted-zone-id YOUR_ZONE_ID --query 'ResourceRecordSets[?Name==`api-dev.aerotage.com.`]'
```

## Benefits of Custom Domains

1. **Consistent URLs**: Never change when infrastructure is recreated
2. **Professional Appearance**: Branded URLs instead of AWS-generated ones
3. **SSL Certificates**: Automatic SSL with AWS Certificate Manager
4. **Easy Migration**: Can point to different API Gateways without changing client code
5. **Documentation Stability**: Documentation URLs remain constant

## Cost Considerations

- **Route 53 Hosted Zone**: $0.50/month per hosted zone
- **Route 53 Queries**: $0.40 per million queries
- **ACM Certificates**: Free for AWS resources
- **API Gateway Custom Domain**: No additional cost

## Security Considerations

1. **SSL/TLS**: Automatic HTTPS with ACM certificates
2. **DNS Security**: Use Route 53 for authoritative DNS
3. **Certificate Rotation**: Automatic with ACM
4. **Access Control**: Same as existing API Gateway security

## Maintenance

The custom domain setup is largely maintenance-free:

- Certificates auto-renew
- DNS records are managed by CDK
- No manual intervention required

## Next Steps

After setting up custom domains:

1. Update all client applications to use the new URLs
2. Update CI/CD pipelines with new endpoints
3. Monitor DNS and certificate health
4. Consider setting up multiple environments (staging, prod)

## Example Client Configuration

```typescript
// Frontend configuration
const API_CONFIG = {
  development: 'https://api-dev.aerotage.com',
  staging: 'https://api-staging.aerotage.com',
  production: 'https://api.aerotage.com'
};

const apiBaseUrl = API_CONFIG[process.env.NODE_ENV] || API_CONFIG.development;
```

This ensures your API URLs are consistent and professional across all environments! 