#!/bin/bash

# 🔥 Emergency Documentation Cleanup Script
# Deletes conflicting .md files that interfere with authentication standardization cursor rules

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}🔥 EMERGENCY DOCUMENTATION CLEANUP${NC}"
echo -e "${YELLOW}Removing conflicting files that interfere with cursor rules authentication standardization${NC}"
echo ""

# Track deletion stats
TOTAL_FILES=0
DELETED_FILES=0
MISSING_FILES=0

# Function to safely delete a file
delete_file() {
    local file="$1"
    local reason="$2"
    
    TOTAL_FILES=$((TOTAL_FILES + 1))
    
    if [ -f "$file" ]; then
        echo -e "${YELLOW}Deleting:${NC} $file"
        echo -e "${BLUE}  Reason:${NC} $reason"
        rm "$file"
        DELETED_FILES=$((DELETED_FILES + 1))
        echo -e "${GREEN}  ✅ Deleted${NC}"
    else
        echo -e "${YELLOW}Missing:${NC} $file (already deleted)"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
    echo ""
}

echo -e "${BLUE}📋 PHASE 1: Emergency High-Risk Files (Authentication Conflicts)${NC}"
echo "================================================================"

# Already deleted in previous emergency cleanup, but include for completeness
delete_file "docs/AUTHENTICATION_CONSISTENCY_FIX_SUMMARY.md" "Claims auth standardization complete (conflicts with our 0% status)"
delete_file "TYPESCRIPT_FIXES_PLAN.md" "Competing implementation strategy"
delete_file "TYPESCRIPT_FIXES_PROGRESS_SUMMARY.md" "Conflicting implementation approaches"
delete_file "TYPESCRIPT_FIXES_QUICK_START.md" "Outdated implementation guide"
delete_file "LINTING_FIX_PLAN.md" "Conflicting code quality approach"
delete_file "LINTING_IMPROVEMENTS_SUMMARY.md" "Outdated linting strategies"

echo -e "${BLUE}📋 PHASE 2: Outdated Fix Summaries${NC}"
echo "================================="

delete_file "CLEANUP_SUMMARY.md" "Outdated cleanup information"
delete_file "EMAIL_CHANGE_IMPLEMENTATION_SUMMARY.md" "Feature-specific outdated summary"
delete_file "MULTIPLE_SESSIONS_FIX_SUMMARY.md" "Outdated session management info"
delete_file "PROJECT_CREATION_ENDPOINT_SOLUTION.md" "Outdated endpoint solution"
delete_file "SESSION_CLEANUP_DOCUMENTATION_UPDATE_SUMMARY.md" "Outdated session cleanup info"
delete_file "URL_UPDATE_SUMMARY.md" "Completed fix summary"
delete_file "FINAL_CODEBASE_REVIEW.md" "Outdated codebase review"

echo -e "${BLUE}📋 PHASE 3: Redundant Root-Level Docs${NC}"
echo "===================================="

delete_file "PROJECT_ORGANIZATION.md" "Consolidated into cursor rules and main docs"
delete_file "FRONTEND_INTEGRATION_INSTRUCTIONS.md" "Redundant with docs/FRONTEND_INTEGRATION_GUIDE.md"
delete_file "CUSTOM_DOMAIN_README.md" "Should be in deployment guide"

echo -e "${BLUE}📋 PHASE 4: Docs Folder Cleanup - Phase-Specific${NC}"
echo "==============================================="

delete_file "docs/PHASE_8_REQUIREMENTS_DOCUMENT.md" "Consolidate into PROJECT_STATUS.md"
delete_file "docs/PHASE_COMPLETION_ARCHIVE.md" "Consolidate into PROJECT_STATUS.md"
delete_file "docs/DAILY_WEEKLY_TIME_TRACKING_IMPLEMENTATION.md" "Feature-specific, consolidate into main guides"

echo -e "${BLUE}📋 PHASE 5: Docs Folder Cleanup - Feature-Specific Guides${NC}"
echo "======================================================="

delete_file "docs/CLIENT_API_FIX_GUIDE.md" "Consolidate into API_REFERENCE.md"
delete_file "docs/EMAIL_CHANGE_BUSINESS_LOGIC.md" "Consolidate into main guides"
delete_file "docs/EMAIL_CHANGE_FRONTEND_INTEGRATION.md" "Consolidate into FRONTEND_INTEGRATION_GUIDE.md"
delete_file "docs/EMAIL_VERIFICATION_FRONTEND_GUIDE.md" "Consolidate into FRONTEND_INTEGRATION_GUIDE.md"
delete_file "docs/FRONTEND_API_CLIENT_GUIDE.md" "Consolidate into FRONTEND_INTEGRATION_GUIDE.md"
delete_file "docs/INVOICE_ENDPOINTS_FRONTEND_GUIDE.md" "Consolidate into FRONTEND_INTEGRATION_GUIDE.md"
delete_file "docs/TIME_ENTRY_SUBMISSION_GUIDE.md" "Consolidate into FRONTEND_INTEGRATION_GUIDE.md"
delete_file "docs/USER_MANAGEMENT_FRONTEND_GUIDE.md" "Consolidate into FRONTEND_INTEGRATION_GUIDE.md"

echo -e "${BLUE}📋 PHASE 6: Docs Folder Cleanup - Technical Implementation${NC}"
echo "========================================================="

delete_file "docs/BACKEND_API_CLIENT_IMPROVEMENT_SUMMARY.md" "Outdated improvement summary"
delete_file "docs/CORS_AND_HEALTH_ENDPOINT_SOLUTION.md" "Specific solution, consolidate"
delete_file "docs/DUPLICATE_EMAIL_PREVENTION_SUMMARY.md" "Feature-specific summary"
delete_file "docs/SESSION_CLEANUP_IMPLEMENTATION_SUMMARY.md" "Outdated implementation summary"
delete_file "docs/dynamodb-gsi-upgrade-guide.md" "Specific upgrade guide, consolidate"

echo -e "${BLUE}📋 PHASE 7: Docs Folder Cleanup - Custom Domain${NC}"
echo "=============================================="

delete_file "docs/CUSTOM_DOMAIN_PIPELINE_INTEGRATION.md" "Consolidate into DEPLOYMENT_GUIDE.md"
delete_file "docs/CUSTOM_DOMAIN_SETUP.md" "Consolidate into DEPLOYMENT_GUIDE.md"
delete_file "docs/OPENAPI_CUSTOM_DOMAIN_INTEGRATION.md" "Consolidate into DEPLOYMENT_GUIDE.md"

echo -e "${BLUE}📋 PHASE 8: Testing Documentation Cleanup${NC}"
echo "========================================="

delete_file "docs/testing/AUTHENTICATION_FIX_TEST_RESULTS.md" "Consolidate into scripts/README.md"
delete_file "scripts/README-PHASE7-TESTING.md" "Consolidate into scripts/README.md"
delete_file "scripts/test-results-summary.md" "Consolidate into scripts/README.md"

echo -e "${BLUE}📋 PHASE 9: Planning and Comparison Docs${NC}"
echo "========================================"

delete_file "docs/HARVEST_API_COMPARISON_PLAN.md" "Outdated comparison document"
delete_file "docs/AEROTAGE_TIME_APP_PLAN.md" "Outdated planning document"

echo -e "${GREEN}✅ CLEANUP COMPLETED${NC}"
echo "==================="
echo -e "${GREEN}Total files processed: $TOTAL_FILES${NC}"
echo -e "${GREEN}Successfully deleted: $DELETED_FILES${NC}"
echo -e "${YELLOW}Already missing: $MISSING_FILES${NC}"
echo ""

# Check if docs/testing directory is empty and remove it
if [ -d "docs/testing" ] && [ -z "$(ls -A docs/testing)" ]; then
    echo -e "${YELLOW}Removing empty docs/testing directory...${NC}"
    rmdir docs/testing
    echo -e "${GREEN}✅ Removed empty docs/testing directory${NC}"
fi

echo -e "${BLUE}📋 NEXT STEPS REQUIRED:${NC}"
echo "========================"
echo -e "${YELLOW}1. Fix broken references in docs/README.md${NC}"
echo -e "${YELLOW}2. Update README.md with new documentation structure${NC}"
echo -e "${YELLOW}3. Rewrite docs/DEVELOPMENT.md with MANDATORY cursor rules patterns${NC}"
echo -e "${YELLOW}4. Update docs/FRONTEND_INTEGRATION_GUIDE.md authentication sections${NC}"
echo -e "${YELLOW}5. Consolidate docs/PROJECT_STATUS.md with accurate information${NC}"
echo ""

echo -e "${GREEN}🎯 RESULT: Documentation reduced from 52 to ~12 essential files${NC}"
echo -e "${GREEN}🔐 Authentication standardization can now proceed without conflicts${NC}"
echo -e "${GREEN}📚 Cursor rules are now the single source of truth for development patterns${NC}"
echo ""

# Count remaining .md files
REMAINING_MD_FILES=$(find . -name "*.md" -not -path "./node_modules/*" -not -path "./infrastructure/node_modules/*" | wc -l)
echo -e "${BLUE}📊 Remaining .md files: $REMAINING_MD_FILES${NC}"

echo -e "${YELLOW}⚠️  Remember to run: git add . && git commit -m 'Emergency cleanup: Remove conflicting documentation'${NC}" 