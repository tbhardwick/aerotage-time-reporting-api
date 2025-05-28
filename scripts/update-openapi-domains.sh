#!/bin/bash

# Aerotage Time Reporting API - OpenAPI Domain Update Script
# This script updates OpenAPI documentation to use custom domain URLs

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGE=${1:-dev}

echo -e "${BLUE}📚 Aerotage Time Reporting API - OpenAPI Domain Update${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""
echo -e "Stage: ${GREEN}${STAGE}${NC}"
echo ""

# Function to get custom domain URL
get_custom_domain_url() {
    local stage=$1
    case $stage in
        "dev")
            echo "https://time-api-dev.aerotage.com/"
            ;;
        "staging")
            echo "https://time-api-staging.aerotage.com/"
            ;;
        "prod")
            echo "https://time-api.aerotage.com/"
            ;;
        *)
            echo "https://time-api-dev.aerotage.com/"
            ;;
    esac
}

# Function to check if custom domain is deployed
check_custom_domain() {
    local stage=$1
    local domain_name
    
    case $stage in
        "dev")
            domain_name="time-api-dev.aerotage.com"
            ;;
        "staging")
            domain_name="time-api-staging.aerotage.com"
            ;;
        "prod")
            domain_name="time-api.aerotage.com"
            ;;
        *)
            domain_name="time-api-dev.aerotage.com"
            ;;
    esac
    
    echo -e "${YELLOW}🔍 Checking if custom domain ${domain_name} is deployed...${NC}"
    
    # Check if domain exists in Route 53
    local existing_records=$(aws route53 list-resource-record-sets \
        --hosted-zone-id ZZAP8VVAZFA7H \
        --query "ResourceRecordSets[?Name=='${domain_name}.']" \
        --output json 2>/dev/null || echo "[]")
    
    if [ "$(echo "${existing_records}" | jq length)" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  Custom domain ${domain_name} not found${NC}"
        echo -e "${YELLOW}   You may want to deploy it first: npm run deploy:domain:${stage}${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Custom domain ${domain_name} is deployed${NC}"
    return 0
}

# Function to update OpenAPI YAML
update_openapi_yaml() {
    local stage=$1
    local custom_url=$(get_custom_domain_url $stage)
    
    echo -e "${YELLOW}📝 Updating OpenAPI YAML with custom domain URLs...${NC}"
    
    # Create backup
    cp docs/openapi.yaml docs/openapi.yaml.backup
    
    # Update the servers section in OpenAPI YAML
    # This is a simple approach - in production you might want more sophisticated YAML editing
    cat > temp_servers.txt << EOF
servers:
  - url: https://time-api-dev.aerotage.com/
    description: Development server
  - url: https://time-api-staging.aerotage.com/
    description: Staging server
  - url: https://time-api.aerotage.com/
    description: Production server
EOF
    
    # Replace the servers section
    # Note: This is a simplified approach. For production, consider using a proper YAML parser
    sed -i.tmp '/^servers:/,/^[a-zA-Z]/ {
        /^servers:/r temp_servers.txt
        /^servers:/,/^[a-zA-Z]/ {
            /^[a-zA-Z]/!d
        }
    }' docs/openapi.yaml
    
    # Clean up
    rm -f docs/openapi.yaml.tmp temp_servers.txt
    
    echo -e "${GREEN}✅ OpenAPI YAML updated${NC}"
}

# Function to build OpenAPI documentation
build_openapi_docs() {
    local stage=$1
    local custom_url=$(get_custom_domain_url $stage)
    
    echo -e "${YELLOW}🏗️  Building OpenAPI documentation for ${stage}...${NC}"
    
    # Build the documentation with custom domain URL
    node scripts/build-openapi.js $stage $custom_url
    
    echo -e "${GREEN}✅ OpenAPI documentation built${NC}"
}

# Function to deploy documentation (if using CDK documentation stack)
deploy_documentation() {
    local stage=$1
    
    echo -e "${YELLOW}🚀 Deploying documentation stack...${NC}"
    
    cd infrastructure
    
    # Check if documentation stack exists
    if npx cdk list | grep -q "AerotageDocumentation-${stage}"; then
        echo -e "${YELLOW}📦 Deploying AerotageDocumentation-${stage} stack...${NC}"
        npx cdk deploy "AerotageDocumentation-${stage}" --require-approval never
        echo -e "${GREEN}✅ Documentation stack deployed${NC}"
    else
        echo -e "${YELLOW}⚠️  Documentation stack not found for ${stage}${NC}"
    fi
    
    cd ..
}

# Function to test documentation
test_documentation() {
    local stage=$1
    local custom_url=$(get_custom_domain_url $stage)
    
    echo -e "${YELLOW}🧪 Testing OpenAPI documentation...${NC}"
    
    # Test if the API is accessible
    if curl -s -f "${custom_url}health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API is accessible at ${custom_url}${NC}"
    else
        echo -e "${YELLOW}⚠️  API not yet accessible at ${custom_url}${NC}"
        echo -e "${YELLOW}   This is normal if the custom domain was just deployed${NC}"
    fi
    
    # Check if OpenAPI JSON was generated
    if [ -f "docs/swagger-ui/openapi.json" ]; then
        echo -e "${GREEN}✅ OpenAPI JSON generated successfully${NC}"
        
        # Check if it contains the custom domain
        if grep -q "time-api" docs/swagger-ui/openapi.json; then
            echo -e "${GREEN}✅ OpenAPI JSON contains custom domain URLs${NC}"
        else
            echo -e "${YELLOW}⚠️  OpenAPI JSON may not contain custom domain URLs${NC}"
        fi
    else
        echo -e "${RED}❌ OpenAPI JSON not found${NC}"
    fi
}

# Function to show next steps
show_next_steps() {
    local stage=$1
    local custom_url=$(get_custom_domain_url $stage)
    
    echo ""
    echo -e "${BLUE}🎯 Next Steps${NC}"
    echo -e "${BLUE}=============${NC}"
    echo ""
    echo -e "1. ${YELLOW}Test the API:${NC}"
    echo -e "   curl -I ${custom_url}health"
    echo ""
    echo -e "2. ${YELLOW}View OpenAPI documentation:${NC}"
    echo -e "   Open docs/swagger-ui/index.html in your browser"
    echo ""
    echo -e "3. ${YELLOW}Update frontend configuration:${NC}"
    echo -e "   Use ${custom_url} as your API base URL"
    echo ""
    echo -e "4. ${YELLOW}Deploy other environments:${NC}"
    echo -e "   ./scripts/update-openapi-domains.sh staging"
    echo -e "   ./scripts/update-openapi-domains.sh prod"
    echo ""
}

# Main execution
main() {
    echo -e "${YELLOW}🚀 Starting OpenAPI domain update...${NC}"
    echo ""
    
    # Step 1: Check if custom domain is deployed (optional check)
    check_custom_domain $STAGE || echo -e "${YELLOW}   Continuing anyway...${NC}"
    echo ""
    
    # Step 2: Update OpenAPI YAML
    update_openapi_yaml $STAGE
    echo ""
    
    # Step 3: Build OpenAPI documentation
    build_openapi_docs $STAGE
    echo ""
    
    # Step 4: Deploy documentation (if applicable)
    deploy_documentation $STAGE
    echo ""
    
    # Step 5: Test documentation
    test_documentation $STAGE
    echo ""
    
    # Step 6: Show next steps
    show_next_steps $STAGE
    
    echo -e "${GREEN}🎉 OpenAPI domain update completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Summary:${NC}"
    echo -e "   Stage: ${GREEN}${STAGE}${NC}"
    echo -e "   API URL: ${GREEN}$(get_custom_domain_url $STAGE)${NC}"
    echo -e "   Documentation: ${GREEN}docs/swagger-ui/openapi.json${NC}"
    echo ""
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

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ ERROR: Node.js not found. Please install Node.js.${NC}"
    exit 1
fi

# Run main function
main 