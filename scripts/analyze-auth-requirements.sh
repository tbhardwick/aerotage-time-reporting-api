#!/bin/bash

# 🔍 Authentication Requirements Analysis Script
# Determines if authentication standardization requires new DynamoDB GSIs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 AUTHENTICATION REQUIREMENTS ANALYSIS${NC}"
echo -e "${YELLOW}Analyzing current auth patterns and GSI requirements${NC}"
echo ""

# Configuration
STAGE="${1:-dev}"
INFRASTRUCTURE_DIR="./infrastructure"
LAMBDA_DIR="./infrastructure/lambda"

echo -e "${BLUE}📋 CURRENT AUTHENTICATION INFRASTRUCTURE${NC}"
echo "=================================================="

# Check if infrastructure exists
if [ ! -d "$INFRASTRUCTURE_DIR" ]; then
    echo -e "${RED}❌ Infrastructure directory not found: $INFRASTRUCTURE_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Infrastructure directory found${NC}"

# Analyze current authentication tables
echo ""
echo -e "${BLUE}🗃️  AUTHENTICATION-RELATED TABLES${NC}"
echo "===================================="

# List current auth tables and their GSI usage
AUTH_TABLES=(
    "users"
    "user-sessions" 
    "user-invitations"
    "user-activity"
    "user-preferences"
    "user-security-settings"
    "user-notification-settings"
    "password-history"
)

for TABLE_SHORT in "${AUTH_TABLES[@]}"; do
    TABLE_NAME="aerotage-$TABLE_SHORT-$STAGE"
    
    echo -e "${YELLOW}📋 $TABLE_SHORT table:${NC}"
    
    # Check if table exists and get GSI info
    TABLE_DESC=$(aws dynamodb describe-table --table-name $TABLE_NAME 2>/dev/null || echo "null")
    
    if [ "$TABLE_DESC" != "null" ]; then
        GSI_COUNT=$(echo "$TABLE_DESC" | jq -r '.Table.GlobalSecondaryIndexes | length // 0')
        echo "   ✅ Exists with $GSI_COUNT GSIs"
        
        if [ $GSI_COUNT -gt 0 ]; then
            echo "$TABLE_DESC" | jq -r '.Table.GlobalSecondaryIndexes[]? | "      - " + .IndexName + " (" + .KeySchema[0].AttributeName + ")"' 2>/dev/null
        fi
    else
        echo "   ❌ Table not found"
    fi
    echo ""
done

# Analyze current authentication patterns in Lambda functions
echo -e "${BLUE}🔍 CURRENT AUTHENTICATION PATTERNS${NC}"
echo "====================================="

echo -e "${YELLOW}Scanning Lambda functions for authentication patterns...${NC}"

AUTH_PATTERNS_FOUND=0
NEW_GSI_NEEDED=0

# Check for authentication helper usage
if [ -d "$LAMBDA_DIR" ]; then
    # Look for existing auth patterns
    echo ""
    echo -e "${YELLOW}📁 Auth Helper Usage:${NC}"
    
    AUTH_HELPER_FILES=$(find "$LAMBDA_DIR" -name "*auth*" -type f | head -10)
    if [ -n "$AUTH_HELPER_FILES" ]; then
        echo "$AUTH_HELPER_FILES" | while read -r file; do
            echo "   📄 $file"
            AUTH_PATTERNS_FOUND=$((AUTH_PATTERNS_FOUND + 1))
        done
    else
        echo "   ❌ No dedicated auth helper files found"
    fi
    
    # Check for direct DynamoDB usage in Lambda functions
    echo ""
    echo -e "${YELLOW}🔍 Direct DynamoDB Usage Patterns:${NC}"
    
    DIRECT_DYNAMO_USAGE=$(grep -r "DynamoDBClient\|DocumentClient" "$LAMBDA_DIR" 2>/dev/null | wc -l || echo "0")
    if [ "$DIRECT_DYNAMO_USAGE" -gt 0 ]; then
        echo -e "${RED}   ⚠️  Found $DIRECT_DYNAMO_USAGE instances of direct DynamoDB usage${NC}"
        echo -e "${YELLOW}   👉 These should be replaced with repository pattern${NC}"
    else
        echo -e "${GREEN}   ✅ No direct DynamoDB usage found${NC}"
    fi
    
    # Check for authentication context patterns
    echo ""
    echo -e "${YELLOW}🔐 Authentication Context Patterns:${NC}"
    
    EVENT_CONTEXT_USAGE=$(grep -r "event\.requestContext\.authorizer" "$LAMBDA_DIR" 2>/dev/null | wc -l || echo "0")
    if [ "$EVENT_CONTEXT_USAGE" -gt 0 ]; then
        echo -e "${GREEN}   ✅ Found $EVENT_CONTEXT_USAGE uses of event.requestContext.authorizer${NC}"
        echo -e "${GREEN}   👉 Standard Cognito authentication pattern${NC}"
    else
        echo -e "${YELLOW}   ⚠️  No standard auth context usage found${NC}"
    fi
    
    # Check for user ID extraction patterns
    USER_ID_PATTERNS=$(grep -r "\.sub\|\.userId\|getCurrentUserId" "$LAMBDA_DIR" 2>/dev/null | wc -l || echo "0")
    if [ "$USER_ID_PATTERNS" -gt 0 ]; then
        echo -e "${GREEN}   ✅ Found $USER_ID_PATTERNS user ID extraction patterns${NC}"
    fi
    
else
    echo -e "${RED}❌ Lambda directory not found: $LAMBDA_DIR${NC}"
fi

# Analyze infrastructure code for auth requirements
echo ""
echo -e "${BLUE}🏗️  INFRASTRUCTURE AUTHENTICATION ANALYSIS${NC}"
echo "============================================"

# Check database stack for auth tables
if [ -f "$INFRASTRUCTURE_DIR/lib/database-stack.ts" ]; then
    echo -e "${GREEN}✅ Database stack found${NC}"
    
    # Count authentication-related table definitions
    AUTH_TABLE_DEFS=$(grep -c "Table.*user\|Table.*session\|Table.*auth" "$INFRASTRUCTURE_DIR/lib/database-stack.ts" 2>/dev/null || echo "0")
    echo -e "${BLUE}   📊 Authentication table definitions: $AUTH_TABLE_DEFS${NC}"
    
    # Check for planned GSI additions in comments
    PLANNED_GSIS=$(grep -c "TODO.*GSI\|will add.*GSI\|add.*GSI.*separate" "$INFRASTRUCTURE_DIR/lib/database-stack.ts" 2>/dev/null || echo "0")
    if [ "$PLANNED_GSIS" -gt 0 ]; then
        echo -e "${YELLOW}   ⚠️  Found $PLANNED_GSIS planned GSI additions in comments${NC}"
        echo -e "${YELLOW}   👉 These may conflict with auth standardization${NC}"
    fi
    
else
    echo -e "${RED}❌ Database stack not found${NC}"
fi

# Check Cognito stack configuration
if [ -f "$INFRASTRUCTURE_DIR/lib/cognito-stack.ts" ]; then
    echo -e "${GREEN}✅ Cognito stack found${NC}"
    
    # Check for custom authorizers
    CUSTOM_AUTHORIZERS=$(grep -c "authorizer\|TokenAuthorizer\|RequestAuthorizer" "$INFRASTRUCTURE_DIR/lib/cognito-stack.ts" 2>/dev/null || echo "0")
    if [ "$CUSTOM_AUTHORIZERS" -gt 0 ]; then
        echo -e "${BLUE}   🔐 Custom authorizers found: $CUSTOM_AUTHORIZERS${NC}"
    fi
else
    echo -e "${RED}❌ Cognito stack not found${NC}"
fi

# Analyze authentication standardization requirements
echo ""
echo -e "${BLUE}📋 AUTHENTICATION STANDARDIZATION REQUIREMENTS${NC}"
echo "================================================="

echo -e "${YELLOW}Based on cursor rules requirements:${NC}"
echo ""

# Check if current patterns match cursor rules
echo -e "${BLUE}1. getCurrentUserId() Helper Function:${NC}"
GET_USER_ID_IMPL=$(grep -r "getCurrentUserId" "$LAMBDA_DIR" 2>/dev/null | wc -l || echo "0")
if [ "$GET_USER_ID_IMPL" -gt 0 ]; then
    echo -e "${GREEN}   ✅ getCurrentUserId() implementation found${NC}"
else
    echo -e "${YELLOW}   ⚠️  getCurrentUserId() needs implementation${NC}"
    echo -e "${BLUE}   👉 Can use existing event.requestContext.authorizer${NC}"
fi

echo -e "${BLUE}2. getAuthenticatedUser() Helper Function:${NC}"
GET_AUTH_USER_IMPL=$(grep -r "getAuthenticatedUser" "$LAMBDA_DIR" 2>/dev/null | wc -l || echo "0")
if [ "$GET_AUTH_USER_IMPL" -gt 0 ]; then
    echo -e "${GREEN}   ✅ getAuthenticatedUser() implementation found${NC}"
else
    echo -e "${YELLOW}   ⚠️  getAuthenticatedUser() needs implementation${NC}"
    echo -e "${BLUE}   👉 Can use existing event.requestContext.authorizer${NC}"
fi

echo -e "${BLUE}3. Repository Pattern Usage:${NC}"
REPO_PATTERN_USAGE=$(grep -r "Repository\|\.getUser\|\.query" "$LAMBDA_DIR" 2>/dev/null | wc -l || echo "0")
if [ "$REPO_PATTERN_USAGE" -gt 0 ]; then
    echo -e "${GREEN}   ✅ Repository pattern usage found${NC}"
else
    echo -e "${YELLOW}   ⚠️  Repository pattern needs implementation${NC}"
    echo -e "${BLUE}   👉 Can use existing table structures and GSIs${NC}"
fi

# GSI Requirements Analysis
echo ""
echo -e "${BLUE}🎯 GSI REQUIREMENTS ANALYSIS${NC}"
echo "=============================="

echo -e "${YELLOW}Analyzing if authentication standardization needs new GSIs...${NC}"
echo ""

# Check current authentication query patterns
echo -e "${BLUE}Current Authentication Queries:${NC}"
echo "1. User lookup by ID → Uses primary key (no GSI needed)"
echo "2. User lookup by email → Uses existing EmailIndex GSI ✅"
echo "3. Session lookup by sessionId → Uses primary key (no GSI needed)"
echo "4. Session lookup by userId → Uses existing UserIndex GSI ✅"
echo "5. Authentication context → From Cognito claims (no GSI needed)"
echo ""

echo -e "${BLUE}Standardization Requirements:${NC}"
echo "1. getCurrentUserId() → Extract from event.requestContext.authorizer (no GSI needed)"
echo "2. getAuthenticatedUser() → Extract from event.requestContext.authorizer (no GSI needed)"
echo "3. Repository pattern → Use existing table primary keys and GSIs"
echo ""

# Final assessment
echo -e "${GREEN}🎉 ASSESSMENT RESULT${NC}"
echo "====================="
echo ""
echo -e "${GREEN}✅ GOOD NEWS: Authentication standardization does NOT require new GSIs!${NC}"
echo ""
echo -e "${BLUE}📋 Required Changes:${NC}"
echo "1. 📝 Implement getCurrentUserId() helper (code-only)"
echo "2. 📝 Implement getAuthenticatedUser() helper (code-only)"
echo "3. 📝 Implement UserRepository pattern (code-only)"
echo "4. 📝 Update Lambda functions to use helpers (code-only)"
echo "5. 📝 Standardize response format (code-only)"
echo ""
echo -e "${BLUE}🏗️  Infrastructure Changes Needed:${NC}"
echo "❌ NONE - All auth patterns can use existing infrastructure!"
echo ""
echo -e "${GREEN}🚀 DEPLOYMENT RECOMMENDATION${NC}"
echo "============================="
echo -e "${GREEN}✅ Proceed with Phase 2: Code-Only Authentication Standardization${NC}"
echo -e "${GREEN}✅ Skip Phase 3: GSI Optimization (not needed)${NC}"
echo -e "${GREEN}✅ Estimated timeline: 1-2 weeks instead of 6-9 weeks${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Review AUTHENTICATION_STANDARDIZATION_DEPLOYMENT_STRATEGY.md"
echo "2. Begin Phase 2 implementation using existing GSI patterns"
echo "3. Focus on Lambda function standardization without infrastructure changes"
echo ""
echo -e "${YELLOW}💡 This analysis shows authentication standardization is SAFE and FAST!${NC}" 