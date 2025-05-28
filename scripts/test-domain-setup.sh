#!/bin/bash

# Aerotage Time Reporting API - Domain Setup Test Script
# This script validates prerequisites and tests domain setup before deployment

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

echo -e "${BLUE}🧪 Aerotage Time Reporting API - Domain Setup Test${NC}"
echo -e "${BLUE}===================================================${NC}"
echo ""
echo -e "Stage: ${GREEN}${STAGE}${NC}"
echo -e "Domain: ${GREEN}${DOMAIN_NAME}${NC}"
echo -e "Hosted Zone: ${GREEN}${HOSTED_ZONE_ID}${NC}"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    local errors=0
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI not found${NC}"
        errors=$((errors + 1))
    else
        echo -e "${GREEN}✅ AWS CLI found${NC}"
    fi
    
    # Check jq
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}❌ jq not found${NC}"
        errors=$((errors + 1))
    else
        echo -e "${GREEN}✅ jq found${NC}"
    fi
    
    # Check Node.js and npm
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found${NC}"
        errors=$((errors + 1))
    else
        echo -e "${GREEN}✅ Node.js found ($(node --version))${NC}"
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm not found${NC}"
        errors=$((errors + 1))
    else
        echo -e "${GREEN}✅ npm found ($(npm --version))${NC}"
    fi
    
    # Check CDK
    if ! command -v npx &> /dev/null; then
        echo -e "${RED}❌ npx not found${NC}"
        errors=$((errors + 1))
    else
        echo -e "${GREEN}✅ npx found${NC}"
    fi
    
    return $errors
}

# Function to check AWS credentials
check_aws_credentials() {
    echo -e "${YELLOW}🔐 Checking AWS credentials...${NC}"
    
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS credentials not configured${NC}"
        return 1
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local user_arn=$(aws sts get-caller-identity --query Arn --output text)
    
    echo -e "${GREEN}✅ AWS credentials configured${NC}"
    echo -e "   Account: ${GREEN}${account_id}${NC}"
    echo -e "   User: ${GREEN}${user_arn}${NC}"
    
    return 0
}

# Function to check hosted zone access
check_hosted_zone() {
    echo -e "${YELLOW}🌐 Checking hosted zone access...${NC}"
    
    if ! aws route53 get-hosted-zone --id "${HOSTED_ZONE_ID}" &> /dev/null; then
        echo -e "${RED}❌ Cannot access hosted zone ${HOSTED_ZONE_ID}${NC}"
        return 1
    fi
    
    local zone_name=$(aws route53 get-hosted-zone --id "${HOSTED_ZONE_ID}" --query HostedZone.Name --output text)
    echo -e "${GREEN}✅ Hosted zone accessible${NC}"
    echo -e "   Zone: ${GREEN}${zone_name}${NC}"
    
    return 0
}

# Function to check domain availability
check_domain_availability() {
    echo -e "${YELLOW}🔍 Checking domain availability...${NC}"
    
    local existing_records=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "${HOSTED_ZONE_ID}" \
        --query "ResourceRecordSets[?Name=='${DOMAIN_NAME}.']" \
        --output json)
    
    if [ "$(echo "${existing_records}" | jq length)" -gt 0 ]; then
        echo -e "${RED}❌ Domain ${DOMAIN_NAME} already exists!${NC}"
        echo -e "${YELLOW}📋 Existing records:${NC}"
        echo "${existing_records}" | jq '.[] | {Name: .Name, Type: .Type}'
        return 1
    fi
    
    echo -e "${GREEN}✅ Domain ${DOMAIN_NAME} is available${NC}"
    return 0
}

# Function to check CDK project
check_cdk_project() {
    echo -e "${YELLOW}📦 Checking CDK project...${NC}"
    
    if [ ! -d "infrastructure" ]; then
        echo -e "${RED}❌ Infrastructure directory not found${NC}"
        return 1
    fi
    
    if [ ! -f "infrastructure/package.json" ]; then
        echo -e "${RED}❌ Infrastructure package.json not found${NC}"
        return 1
    fi
    
    if [ ! -f "infrastructure/lib/domain-stack.ts" ]; then
        echo -e "${RED}❌ Domain stack not found${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ CDK project structure valid${NC}"
    
    # Check if dependencies are installed
    if [ ! -d "infrastructure/node_modules" ]; then
        echo -e "${YELLOW}⚠️  Infrastructure dependencies not installed${NC}"
        echo -e "${YELLOW}   Run: cd infrastructure && npm install${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Infrastructure dependencies installed${NC}"
    return 0
}

# Function to validate CDK stack configuration
validate_cdk_stack() {
    echo -e "${YELLOW}🏗️  Validating CDK stack configuration...${NC}"
    
    cd infrastructure
    
    # Check if stack is properly configured
    if ! npx cdk list | grep -q "AerotageDomain-${STAGE}"; then
        echo -e "${RED}❌ Domain stack not found in CDK app${NC}"
        echo -e "${YELLOW}   Available stacks:${NC}"
        npx cdk list
        cd ..
        return 1
    fi
    
    echo -e "${GREEN}✅ Domain stack found in CDK app${NC}"
    
    # Validate stack syntax
    if ! npx cdk synth "AerotageDomain-${STAGE}" > /dev/null 2>&1; then
        echo -e "${RED}❌ CDK stack synthesis failed${NC}"
        echo -e "${YELLOW}   Run: cd infrastructure && npx cdk synth AerotageDomain-${STAGE}${NC}"
        cd ..
        return 1
    fi
    
    echo -e "${GREEN}✅ CDK stack synthesis successful${NC}"
    
    cd ..
    return 0
}

# Function to show deployment readiness
show_deployment_readiness() {
    echo ""
    echo -e "${BLUE}🚀 Deployment Readiness${NC}"
    echo -e "${BLUE}========================${NC}"
    echo ""
    echo -e "Your system is ready for custom domain deployment!"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "1. Deploy the domain: ${GREEN}npm run deploy:domain:${STAGE}${NC}"
    echo -e "2. Or use the script: ${GREEN}./scripts/deploy-custom-domain.sh ${STAGE}${NC}"
    echo ""
    echo -e "${YELLOW}Expected results:${NC}"
    echo -e "- Domain: ${GREEN}https://${DOMAIN_NAME}${NC}"
    echo -e "- Certificate: ${GREEN}Automatically provisioned${NC}"
    echo -e "- DNS: ${GREEN}Automatically configured${NC}"
    echo ""
    echo -e "${YELLOW}Timeline:${NC}"
    echo -e "- Deployment: ${GREEN}5-10 minutes${NC}"
    echo -e "- Certificate validation: ${GREEN}5-30 minutes${NC}"
    echo -e "- DNS propagation: ${GREEN}5-60 minutes${NC}"
}

# Function to show troubleshooting info
show_troubleshooting() {
    echo ""
    echo -e "${BLUE}🔧 Troubleshooting${NC}"
    echo -e "${BLUE}==================${NC}"
    echo ""
    echo -e "If you encounter issues:"
    echo ""
    echo -e "1. ${YELLOW}Check AWS permissions:${NC}"
    echo -e "   - Route 53: ListResourceRecordSets, ChangeResourceRecordSets"
    echo -e "   - ACM: RequestCertificate, DescribeCertificate"
    echo -e "   - API Gateway: CreateDomainName, GetDomainName"
    echo -e "   - CloudFormation: CreateStack, UpdateStack, DescribeStacks"
    echo ""
    echo -e "2. ${YELLOW}Install missing dependencies:${NC}"
    echo -e "   - AWS CLI: https://aws.amazon.com/cli/"
    echo -e "   - jq: brew install jq (macOS) or apt-get install jq (Ubuntu)"
    echo -e "   - Node.js: https://nodejs.org/"
    echo ""
    echo -e "3. ${YELLOW}Configure AWS credentials:${NC}"
    echo -e "   aws configure"
    echo ""
    echo -e "4. ${YELLOW}Install CDK dependencies:${NC}"
    echo -e "   cd infrastructure && npm install"
    echo ""
}

# Main execution
main() {
    echo -e "${YELLOW}🚀 Starting domain setup validation...${NC}"
    echo ""
    
    local total_errors=0
    
    # Check prerequisites
    if ! check_prerequisites; then
        total_errors=$((total_errors + $?))
    fi
    echo ""
    
    # Check AWS credentials
    if ! check_aws_credentials; then
        total_errors=$((total_errors + 1))
    fi
    echo ""
    
    # Check hosted zone
    if ! check_hosted_zone; then
        total_errors=$((total_errors + 1))
    fi
    echo ""
    
    # Check domain availability
    if ! check_domain_availability; then
        total_errors=$((total_errors + 1))
    fi
    echo ""
    
    # Check CDK project
    if ! check_cdk_project; then
        total_errors=$((total_errors + 1))
    fi
    echo ""
    
    # Validate CDK stack
    if ! validate_cdk_stack; then
        total_errors=$((total_errors + 1))
    fi
    echo ""
    
    # Show results
    if [ $total_errors -eq 0 ]; then
        echo -e "${GREEN}🎉 All validation checks passed!${NC}"
        show_deployment_readiness
    else
        echo -e "${RED}❌ Validation failed with ${total_errors} error(s)${NC}"
        show_troubleshooting
        exit 1
    fi
}

# Run main function
main 