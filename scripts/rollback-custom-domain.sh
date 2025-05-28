#!/bin/bash

# Aerotage Time Reporting API - Custom Domain Rollback Script
# This script safely removes the custom domain deployment

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

echo -e "${BLUE}🔄 Aerotage Time Reporting API - Custom Domain Rollback${NC}"
echo -e "${BLUE}========================================================${NC}"
echo ""
echo -e "Stage: ${GREEN}${STAGE}${NC}"
echo -e "Domain: ${GREEN}${DOMAIN_NAME}${NC}"
echo -e "Hosted Zone: ${GREEN}${HOSTED_ZONE_ID}${NC}"
echo ""

# Function to create pre-rollback backup
create_pre_rollback_backup() {
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="${BACKUP_DIR}/pre-rollback-backup-${timestamp}.json"
    
    echo -e "${YELLOW}📋 Creating pre-rollback DNS backup...${NC}"
    mkdir -p "${BACKUP_DIR}"
    aws route53 list-resource-record-sets \
        --hosted-zone-id "${HOSTED_ZONE_ID}" \
        --output json > "${backup_file}"
    
    echo -e "${GREEN}✅ Pre-rollback backup created: ${backup_file}${NC}"
    echo "${backup_file}"
}

# Function to check if domain exists
check_domain_exists() {
    echo -e "${YELLOW}🔍 Checking if domain ${DOMAIN_NAME} exists...${NC}"
    
    local existing_records=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "${HOSTED_ZONE_ID}" \
        --query "ResourceRecordSets[?Name=='${DOMAIN_NAME}.']" \
        --output json)
    
    if [ "$(echo "${existing_records}" | jq length)" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  Domain ${DOMAIN_NAME} does not exist. Nothing to rollback.${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Domain ${DOMAIN_NAME} exists${NC}"
    echo -e "${BLUE}📋 Current DNS records:${NC}"
    echo "${existing_records}" | jq '.[] | {Name: .Name, Type: .Type}'
    return 0
}

# Function to destroy CDK stack
destroy_domain_stack() {
    echo -e "${YELLOW}🗑️  Destroying custom domain stack...${NC}"
    
    cd infrastructure
    
    # Check if stack exists
    if npx cdk list | grep -q "AerotageDomain-${STAGE}"; then
        echo -e "${YELLOW}🏗️  Destroying AerotageDomain-${STAGE} stack...${NC}"
        npx cdk destroy "AerotageDomain-${STAGE}" --force
        echo -e "${GREEN}✅ Domain stack destroyed successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Stack AerotageDomain-${STAGE} not found${NC}"
    fi
    
    cd ..
}

# Function to validate rollback
validate_rollback() {
    echo -e "${YELLOW}🔍 Validating rollback...${NC}"
    
    # Check if DNS record was removed
    local remaining_records=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "${HOSTED_ZONE_ID}" \
        --query "ResourceRecordSets[?Name=='${DOMAIN_NAME}.']" \
        --output json)
    
    if [ "$(echo "${remaining_records}" | jq length)" -gt 0 ]; then
        echo -e "${RED}❌ WARNING: Some DNS records still exist!${NC}"
        echo -e "${YELLOW}📋 Remaining records:${NC}"
        echo "${remaining_records}" | jq '.[] | {Name: .Name, Type: .Type}'
        echo -e "${YELLOW}⚠️  You may need to manually remove these records${NC}"
    else
        echo -e "${GREEN}✅ All DNS records removed successfully${NC}"
    fi
    
    # Clean up output files
    if [ -f "domain-outputs-${STAGE}.json" ]; then
        echo -e "${YELLOW}🧹 Cleaning up output files...${NC}"
        rm -f "domain-outputs-${STAGE}.json"
        echo -e "${GREEN}✅ Output files cleaned up${NC}"
    fi
}

# Function to show manual cleanup instructions
show_manual_cleanup() {
    echo ""
    echo -e "${BLUE}🛠️  Manual Cleanup Instructions${NC}"
    echo -e "${BLUE}==================================${NC}"
    echo ""
    echo -e "If automatic rollback didn't complete successfully:"
    echo ""
    echo -e "1. ${YELLOW}Check for remaining AWS resources:${NC}"
    echo -e "   - Certificate Manager certificates"
    echo -e "   - API Gateway custom domains"
    echo -e "   - Route 53 records"
    echo ""
    echo -e "2. ${YELLOW}Remove CDK stack references:${NC}"
    echo -e "   - Comment out DomainStack in bin/aerotage-time-api.ts"
    echo -e "   - Remove domain stack dependency lines"
    echo ""
    echo -e "3. ${YELLOW}Manual DNS cleanup (if needed):${NC}"
    echo -e "   aws route53 change-resource-record-sets \\"
    echo -e "     --hosted-zone-id ${HOSTED_ZONE_ID} \\"
    echo -e "     --change-batch file://delete-record.json"
    echo ""
}

# Function to confirm rollback
confirm_rollback() {
    echo -e "${RED}⚠️  WARNING: This will permanently remove the custom domain!${NC}"
    echo -e "${YELLOW}   Domain to be removed: ${DOMAIN_NAME}${NC}"
    echo -e "${YELLOW}   Stack to be destroyed: AerotageDomain-${STAGE}${NC}"
    echo ""
    read -p "Are you sure you want to proceed? (yes/no): " confirmation
    
    if [ "$confirmation" != "yes" ]; then
        echo -e "${YELLOW}❌ Rollback cancelled by user${NC}"
        exit 0
    fi
    
    echo -e "${GREEN}✅ Rollback confirmed${NC}"
}

# Main execution
main() {
    echo -e "${YELLOW}🚀 Starting custom domain rollback...${NC}"
    echo ""
    
    # Step 1: Confirm rollback
    confirm_rollback
    echo ""
    
    # Step 2: Create pre-rollback backup
    BACKUP_FILE=$(create_pre_rollback_backup)
    echo ""
    
    # Step 3: Check if domain exists
    if ! check_domain_exists; then
        echo -e "${GREEN}🎉 Nothing to rollback. Domain already removed.${NC}"
        exit 0
    fi
    echo ""
    
    # Step 4: Destroy CDK stack
    destroy_domain_stack
    echo ""
    
    # Step 5: Validate rollback
    validate_rollback
    echo ""
    
    # Step 6: Show manual cleanup instructions
    show_manual_cleanup
    
    echo -e "${GREEN}🎉 Custom domain rollback completed!${NC}"
    echo ""
    echo -e "${BLUE}📋 Summary:${NC}"
    echo -e "   Domain removed: ${GREEN}${DOMAIN_NAME}${NC}"
    echo -e "   Backup created: ${GREEN}${BACKUP_FILE}${NC}"
    echo -e "   Stage: ${GREEN}${STAGE}${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Note: DNS changes may take a few minutes to propagate.${NC}"
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