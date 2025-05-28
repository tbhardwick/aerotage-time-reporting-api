#!/bin/bash

# Aerotage Time Reporting API - Custom Domain Deployment Script
# This script safely deploys a custom domain for the API while preserving existing DNS records

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGE=${1:-dev}
HOSTED_ZONE_ID="ZZAP8VVAZFA7H"
DOMAIN_NAME="time-api-${STAGE}.aerotage.com"
BACKUP_DIR="dns-backups"

echo -e "${BLUE}🌐 Aerotage Time Reporting API - Custom Domain Deployment${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo -e "Stage: ${GREEN}${STAGE}${NC}"
echo -e "Domain: ${GREEN}${DOMAIN_NAME}${NC}"
echo -e "Hosted Zone: ${GREEN}${HOSTED_ZONE_ID}${NC}"
echo ""

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Function to create DNS backup
create_dns_backup() {
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="${BACKUP_DIR}/dns-backup-${timestamp}.json"
    
    echo -e "${YELLOW}📋 Creating DNS backup...${NC}"
    aws route53 list-resource-record-sets \
        --hosted-zone-id "${HOSTED_ZONE_ID}" \
        --output json > "${backup_file}"
    
    echo -e "${GREEN}✅ DNS backup created: ${backup_file}${NC}"
    echo "${backup_file}"
}

# Function to validate domain doesn't exist
validate_domain_available() {
    echo -e "${YELLOW}🔍 Checking if domain ${DOMAIN_NAME} already exists...${NC}"
    
    local existing_records=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "${HOSTED_ZONE_ID}" \
        --query "ResourceRecordSets[?Name=='${DOMAIN_NAME}.']" \
        --output json)
    
    if [ "$(echo "${existing_records}" | jq length)" -gt 0 ]; then
        echo -e "${RED}❌ ERROR: Domain ${DOMAIN_NAME} already exists!${NC}"
        echo -e "${RED}   Existing records found. Aborting to prevent overwrite.${NC}"
        echo -e "${YELLOW}   Existing records:${NC}"
        echo "${existing_records}" | jq '.[].Type'
        exit 1
    fi
    
    echo -e "${GREEN}✅ Domain ${DOMAIN_NAME} is available${NC}"
}

# Function to deploy CDK stack
deploy_domain_stack() {
    echo -e "${YELLOW}🚀 Deploying custom domain stack...${NC}"
    
    cd infrastructure
    
    # Build the project
    echo -e "${YELLOW}📦 Building CDK project...${NC}"
    npm run build
    
    # Deploy only the domain stack
    echo -e "${YELLOW}🏗️  Deploying AerotageDomain-${STAGE} stack...${NC}"
    npx cdk deploy "AerotageDomain-${STAGE}" \
        --require-approval never \
        --outputs-file "../domain-outputs-${STAGE}.json"
    
    cd ..
    
    echo -e "${GREEN}✅ Domain stack deployed successfully${NC}"
}

# Function to validate deployment
validate_deployment() {
    echo -e "${YELLOW}🔍 Validating deployment...${NC}"
    
    # Check if DNS record was created
    local new_records=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "${HOSTED_ZONE_ID}" \
        --query "ResourceRecordSets[?Name=='${DOMAIN_NAME}.']" \
        --output json)
    
    if [ "$(echo "${new_records}" | jq length)" -eq 0 ]; then
        echo -e "${RED}❌ ERROR: DNS record was not created!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ DNS record created successfully${NC}"
    echo -e "${BLUE}📋 New DNS records:${NC}"
    echo "${new_records}" | jq '.[] | {Name: .Name, Type: .Type}'
    
    # Check if outputs file was created
    if [ -f "domain-outputs-${STAGE}.json" ]; then
        echo -e "${GREEN}✅ Domain outputs file created${NC}"
        echo -e "${BLUE}📋 Domain configuration:${NC}"
        cat "domain-outputs-${STAGE}.json" | jq '.'
    fi
}

# Function to test domain (basic connectivity)
test_domain() {
    echo -e "${YELLOW}🧪 Testing domain connectivity...${NC}"
    
    # Wait a bit for DNS propagation
    echo -e "${YELLOW}⏳ Waiting 30 seconds for DNS propagation...${NC}"
    sleep 30
    
    # Test DNS resolution
    if nslookup "${DOMAIN_NAME}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ DNS resolution successful${NC}"
    else
        echo -e "${YELLOW}⚠️  DNS resolution not yet available (may take up to 5 minutes)${NC}"
    fi
    
    # Test HTTPS connectivity (may fail initially due to certificate validation)
    echo -e "${YELLOW}🔐 Testing HTTPS connectivity...${NC}"
    if curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN_NAME}/health" | grep -q "200\|404\|403"; then
        echo -e "${GREEN}✅ HTTPS connectivity successful${NC}"
    else
        echo -e "${YELLOW}⚠️  HTTPS not yet available (certificate may still be validating)${NC}"
    fi
}

# Function to show rollback instructions
show_rollback_instructions() {
    echo ""
    echo -e "${BLUE}🔄 Rollback Instructions${NC}"
    echo -e "${BLUE}========================${NC}"
    echo ""
    echo -e "If you need to rollback this deployment:"
    echo ""
    echo -e "1. ${YELLOW}Destroy the domain stack:${NC}"
    echo -e "   cd infrastructure && npx cdk destroy AerotageDomain-${STAGE}"
    echo ""
    echo -e "2. ${YELLOW}Restore DNS from backup (if needed):${NC}"
    echo -e "   Use the backup file in ${BACKUP_DIR}/"
    echo ""
    echo -e "3. ${YELLOW}Remove the domain stack from CDK app:${NC}"
    echo -e "   Comment out the DomainStack in bin/aerotage-time-api.ts"
    echo ""
}

# Main execution
main() {
    echo -e "${YELLOW}🚀 Starting custom domain deployment...${NC}"
    echo ""
    
    # Step 1: Create backup
    BACKUP_FILE=$(create_dns_backup)
    echo ""
    
    # Step 2: Validate domain is available
    validate_domain_available
    echo ""
    
    # Step 3: Deploy domain stack
    deploy_domain_stack
    echo ""
    
    # Step 4: Validate deployment
    validate_deployment
    echo ""
    
    # Step 5: Test domain
    test_domain
    echo ""
    
    # Step 6: Show rollback instructions
    show_rollback_instructions
    
    echo -e "${GREEN}🎉 Custom domain deployment completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Summary:${NC}"
    echo -e "   Domain: ${GREEN}https://${DOMAIN_NAME}${NC}"
    echo -e "   Backup: ${GREEN}${BACKUP_FILE}${NC}"
    echo -e "   Stage: ${GREEN}${STAGE}${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Note: Certificate validation may take 5-10 minutes.${NC}"
    echo -e "${YELLOW}   The domain will be fully functional once validation completes.${NC}"
}

# Validate prerequisites
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ ERROR: AWS CLI not found. Please install AWS CLI.${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ ERROR: jq not found. Please install jq.${NC}"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ ERROR: npx not found. Please install Node.js and npm.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ ERROR: AWS credentials not configured.${NC}"
    exit 1
fi

# Run main function
main 