#!/bin/bash

# Aerotage Time Reporting API - Update Test Scripts to Use Custom Domains
# This script updates all test scripts to use custom domain URLs instead of API Gateway URLs

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Aerotage Time Reporting API - Update Test Scripts${NC}"
echo -e "${BLUE}====================================================${NC}"
echo ""

# Configuration
OLD_URL="https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev"
NEW_URL="https://time-api-dev.aerotage.com"

# Function to update a file
update_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${YELLOW}📝 Updating: ${file}${NC}"
        echo -e "   ${description}"
        
        # Create backup
        cp "$file" "$file.backup"
        
        # Replace the URL
        sed -i.tmp "s|${OLD_URL}|${NEW_URL}|g" "$file"
        
        # Clean up temp file
        rm -f "$file.tmp"
        
        # Check if changes were made
        if ! diff -q "$file" "$file.backup" > /dev/null 2>&1; then
            echo -e "   ${GREEN}✅ Updated successfully${NC}"
        else
            echo -e "   ${YELLOW}⚠️  No changes needed${NC}"
            rm -f "$file.backup"
        fi
    else
        echo -e "${YELLOW}⚠️  File not found: ${file}${NC}"
    fi
    echo ""
}

# Function to show file changes
show_changes() {
    local file=$1
    if [ -f "$file.backup" ]; then
        echo -e "${BLUE}📋 Changes in ${file}:${NC}"
        diff "$file.backup" "$file" || true
        echo ""
    fi
}

echo -e "${YELLOW}🔍 Updating test scripts to use custom domain...${NC}"
echo -e "   Old URL: ${RED}${OLD_URL}${NC}"
echo -e "   New URL: ${GREEN}${NEW_URL}${NC}"
echo ""

# Update JavaScript test files
echo -e "${BLUE}📄 Updating JavaScript Test Files${NC}"
echo -e "${BLUE}===================================${NC}"

update_file "test-session-creation.js" "Session creation test script"
update_file "test-phase6-endpoints.js" "Phase 6 endpoints test script"
update_file "test-phase6-core.js" "Phase 6 core functionality test script"
update_file "test-user-management-working.js" "Working user management test script"
update_file "test-invoice-endpoints.js" "Invoice endpoints test script"
update_file "test-session-cleanup.js" "Session cleanup test script"
update_file "test-with-session.js" "Session-based test script"
update_file "test-self-approval.js" "Self-approval test script"
update_file "test-create-user-endpoint.js" "Create user endpoint test script"
update_file "test-multiple-sessions.js" "Multiple sessions test script"
update_file "test-user-management-endpoints.js" "User management endpoints test script"

# Update scripts directory
echo -e "${BLUE}📁 Updating Scripts Directory${NC}"
echo -e "${BLUE}=============================${NC}"

update_file "scripts/test-invoices-quick.js" "Quick invoice test script"
update_file "scripts/test-phase6-endpoints.js" "Scripts directory Phase 6 endpoints"
update_file "scripts/test-invoices.js" "Invoice test script"
update_file "scripts/test-bootstrap-direct.js" "Bootstrap direct test script"
update_file "scripts/test-time-entries.js" "Time entries test script"
update_file "scripts/test-daily-weekly-endpoints.js" "Daily/weekly endpoints test script"
update_file "scripts/test-phase6-core.js" "Scripts directory Phase 6 core"
update_file "scripts/test-live-bootstrap.js" "Live bootstrap test script"
update_file "scripts/test-phase5-endpoints.js" "Phase 5 endpoints test script"

# Update tools directory
echo -e "${BLUE}🛠️  Updating Tools Directory${NC}"
echo -e "${BLUE}============================${NC}"

update_file "tools/auth/test-session-creation.js" "Tools session creation test"
update_file "tools/auth/comprehensive-session-test.js" "Comprehensive session test"

# Update shell scripts
echo -e "${BLUE}🐚 Updating Shell Scripts${NC}"
echo -e "${BLUE}=========================${NC}"

update_file "scripts/test-simple-curl.sh" "Simple curl test script"
update_file "scripts/verify-deployment.sh" "Deployment verification script"
update_file "scripts/test-endpoints-curl.sh" "Endpoints curl test script"
update_file "test-simple-curl.sh" "Root directory simple curl test"

# Show summary of changes
echo -e "${BLUE}📊 Summary of Changes${NC}"
echo -e "${BLUE}===================${NC}"

backup_count=$(find . -name "*.backup" -type f | wc -l | tr -d ' ')
if [ "$backup_count" -gt 0 ]; then
    echo -e "${GREEN}✅ Updated ${backup_count} files${NC}"
    echo ""
    echo -e "${YELLOW}📋 Files with changes:${NC}"
    find . -name "*.backup" -type f | sed 's/\.backup$//' | while read file; do
        echo -e "   📝 ${file}"
    done
    echo ""
    
    # Ask if user wants to see detailed changes
    echo -e "${YELLOW}🔍 Would you like to see detailed changes? (y/n)${NC}"
    read -r show_details
    if [[ $show_details =~ ^[Yy]$ ]]; then
        echo ""
        find . -name "*.backup" -type f | sed 's/\.backup$//' | while read file; do
            show_changes "$file"
        done
    fi
    
    # Ask if user wants to clean up backup files
    echo -e "${YELLOW}🧹 Clean up backup files? (y/n)${NC}"
    read -r cleanup
    if [[ $cleanup =~ ^[Yy]$ ]]; then
        find . -name "*.backup" -type f -delete
        echo -e "${GREEN}✅ Backup files cleaned up${NC}"
    else
        echo -e "${YELLOW}📁 Backup files preserved for review${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No files needed updating${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Test script update completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo -e "1. ${YELLOW}Test the updated scripts:${NC}"
echo -e "   node test-user-management-working.js"
echo -e "   ./scripts/test-phase5-endpoints.js"
echo -e ""
echo -e "2. ${YELLOW}Verify custom domain is working:${NC}"
echo -e "   curl -I ${NEW_URL}/users"
echo -e ""
echo -e "3. ${YELLOW}Commit the changes:${NC}"
echo -e "   git add ."
echo -e "   git commit -m \"update: migrate all test scripts to custom domain URLs\""
echo "" 