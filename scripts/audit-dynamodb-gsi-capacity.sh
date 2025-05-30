#!/bin/bash

# 🔍 DynamoDB GSI Capacity Audit Script
# Analyzes current GSI usage and capacity for authentication standardization planning

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 DYNAMODB GSI CAPACITY AUDIT${NC}"
echo -e "${YELLOW}Analyzing tables for authentication standardization constraints${NC}"
echo ""

# Configuration
STAGE="${1:-dev}"
REGION="${AWS_REGION:-us-east-1}"
MAX_GSI_PER_TABLE=5

# Get list of all Aerotage tables
echo -e "${BLUE}📋 Discovering Aerotage DynamoDB tables...${NC}"
TABLES=$(aws dynamodb list-tables --region $REGION --query 'TableNames[?contains(@, `aerotage`) && contains(@, `'$STAGE'`)]' --output text)

if [ -z "$TABLES" ]; then
    echo -e "${RED}❌ No Aerotage tables found for stage: $STAGE${NC}"
    echo -e "${YELLOW}💡 Try: $0 dev (or $0 prod)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found $(echo $TABLES | wc -w) tables for stage: $STAGE${NC}"
echo ""

# Track overall statistics
TOTAL_TABLES=0
CRITICAL_RISK_TABLES=0
MODERATE_RISK_TABLES=0
LOW_RISK_TABLES=0
TOTAL_GSIS=0

echo -e "${BLUE}📊 GSI CAPACITY ANALYSIS${NC}"
echo "========================================================"

# Header
printf "%-35s %-10s %-10s %-15s %-15s\n" "TABLE NAME" "GSIs" "CAPACITY" "RISK LEVEL" "AUTH IMPACT"
echo "------------------------------------------------------------------------"

# Analyze each table
for TABLE in $TABLES; do
    TOTAL_TABLES=$((TOTAL_TABLES + 1))
    
    # Get table description
    TABLE_DESC=$(aws dynamodb describe-table --table-name $TABLE --region $REGION 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to describe table: $TABLE${NC}"
        continue
    fi
    
    # Extract GSI information
    GSI_COUNT=$(echo "$TABLE_DESC" | jq -r '.Table.GlobalSecondaryIndexes | length // 0')
    TOTAL_GSIS=$((TOTAL_GSIS + GSI_COUNT))
    
    # Calculate remaining capacity
    REMAINING_CAPACITY=$((MAX_GSI_PER_TABLE - GSI_COUNT))
    
    # Determine risk level
    RISK_LEVEL=""
    RISK_COLOR=""
    if [ $GSI_COUNT -ge 4 ]; then
        RISK_LEVEL="🔴 CRITICAL"
        RISK_COLOR=$RED
        CRITICAL_RISK_TABLES=$((CRITICAL_RISK_TABLES + 1))
    elif [ $GSI_COUNT -ge 2 ]; then
        RISK_LEVEL="🟡 MODERATE"  
        RISK_COLOR=$YELLOW
        MODERATE_RISK_TABLES=$((MODERATE_RISK_TABLES + 1))
    else
        RISK_LEVEL="🟢 LOW"
        RISK_COLOR=$GREEN
        LOW_RISK_TABLES=$((LOW_RISK_TABLES + 1))
    fi
    
    # Determine authentication impact
    AUTH_IMPACT=""
    if [[ $TABLE == *"time-entries"* ]]; then
        AUTH_IMPACT="No auth capacity"
    elif [[ $TABLE == *"user-sessions"* ]]; then
        AUTH_IMPACT="Auth table"
    elif [[ $TABLE == *"users"* ]]; then
        AUTH_IMPACT="Core auth table"
    elif [[ $TABLE == *"invitations"* ]] || [[ $TABLE == *"activity"* ]]; then
        AUTH_IMPACT="Auth related"
    else
        AUTH_IMPACT="Low impact"
    fi
    
    # Format table name for display
    SHORT_TABLE_NAME=$(echo $TABLE | sed "s/aerotage-//g" | sed "s/-$STAGE//g")
    
    # Print table information
    printf "%-35s %-10s %-10s " "$SHORT_TABLE_NAME" "$GSI_COUNT/5" "$REMAINING_CAPACITY"
    echo -e "${RISK_COLOR}%-15s${NC} %-15s" "$RISK_LEVEL" "$AUTH_IMPACT"
    
    # Show GSI details for critical tables
    if [ $GSI_COUNT -ge 3 ]; then
        echo "    GSIs:"
        echo "$TABLE_DESC" | jq -r '.Table.GlobalSecondaryIndexes[]? | "      - " + .IndexName' 2>/dev/null || echo "      (No GSIs)"
        echo ""
    fi
done

echo ""
echo -e "${BLUE}📈 SUMMARY STATISTICS${NC}"
echo "========================================"
echo -e "${GREEN}Total Tables Analyzed: $TOTAL_TABLES${NC}"
echo -e "${GREEN}Total GSIs in Use: $TOTAL_GSIS${NC}"
echo -e "${RED}Critical Risk Tables (4+ GSIs): $CRITICAL_RISK_TABLES${NC}"
echo -e "${YELLOW}Moderate Risk Tables (2-3 GSIs): $MODERATE_RISK_TABLES${NC}"
echo -e "${GREEN}Low Risk Tables (0-1 GSIs): $LOW_RISK_TABLES${NC}"

# Calculate average GSI usage
if [ $TOTAL_TABLES -gt 0 ]; then
    AVG_GSIS=$(echo "scale=1; $TOTAL_GSIS / $TOTAL_TABLES" | bc)
    echo -e "${BLUE}Average GSIs per table: $AVG_GSIS${NC}"
fi

echo ""
echo -e "${BLUE}🚨 AUTHENTICATION STANDARDIZATION RISKS${NC}"
echo "================================================"

if [ $CRITICAL_RISK_TABLES -gt 0 ]; then
    echo -e "${RED}❌ CRITICAL: $CRITICAL_RISK_TABLES table(s) at or near GSI limit${NC}"
    echo -e "${RED}   Authentication changes requiring new GSIs will be BLOCKED${NC}"
    echo -e "${YELLOW}   Recommendation: Use code-only authentication standardization${NC}"
    echo ""
fi

if [ $MODERATE_RISK_TABLES -gt 0 ]; then
    echo -e "${YELLOW}⚠️  MODERATE: $MODERATE_RISK_TABLES table(s) with limited GSI capacity${NC}"
    echo -e "${YELLOW}   Plan GSI changes carefully using staged deployments${NC}"
    echo ""
fi

echo -e "${BLUE}💡 DEPLOYMENT STRATEGY RECOMMENDATIONS${NC}"
echo "=============================================="

if [ $CRITICAL_RISK_TABLES -gt 0 ]; then
    echo -e "${YELLOW}1. START with Code-Only Authentication Standardization${NC}"
    echo -e "${YELLOW}   - Use existing GSI patterns only${NC}"
    echo -e "${YELLOW}   - No infrastructure changes required${NC}"
    echo -e "${YELLOW}   - 80% of benefits with minimal risk${NC}"
    echo ""
    echo -e "${YELLOW}2. IF new GSIs are absolutely required:${NC}"
    echo -e "${YELLOW}   - Consolidate existing GSIs using composite keys${NC}"  
    echo -e "${YELLOW}   - Deploy GSI changes in separate weekly deployments${NC}"
    echo -e "${YELLOW}   - Plan for HOURS of GSI backfill time${NC}"
else
    echo -e "${GREEN}✅ GSI capacity available for authentication changes${NC}"
    echo -e "${GREEN}   Proceed with planned authentication standardization${NC}"
fi

echo ""
echo -e "${BLUE}⏰ ESTIMATED GSI DEPLOYMENT TIMES${NC}"
echo "===================================="

for TABLE in $TABLES; do
    # Get table size estimation
    TABLE_DESC=$(aws dynamodb describe-table --table-name $TABLE --region $REGION 2>/dev/null)
    ITEM_COUNT=$(echo "$TABLE_DESC" | jq -r '.Table.ItemCount // 0')
    TABLE_SIZE_BYTES=$(echo "$TABLE_DESC" | jq -r '.Table.TableSizeBytes // 0')
    
    if [ $ITEM_COUNT -gt 100000 ] || [ $TABLE_SIZE_BYTES -gt 1073741824 ]; then # > 1GB
        SHORT_TABLE_NAME=$(echo $TABLE | sed "s/aerotage-//g" | sed "s/-$STAGE//g")
        echo -e "${YELLOW}⏰ $SHORT_TABLE_NAME: Estimated 1-3 hours for GSI creation${NC}"
        echo "   Items: $(printf "%'d" $ITEM_COUNT), Size: $(echo "scale=1; $TABLE_SIZE_BYTES / 1024 / 1024" | bc)MB"
    fi
done

echo ""
echo -e "${GREEN}📋 Next Steps:${NC}"
echo "1. Review deployment strategy: AUTHENTICATION_STANDARDIZATION_DEPLOYMENT_STRATEGY.md"
echo "2. Run authentication requirements analysis: ./scripts/analyze-auth-requirements.sh"
echo "3. Choose deployment approach based on risk tolerance"
echo ""
echo -e "${BLUE}🎯 Recommendation: Start with Phase 2 (Code-Only) to minimize infrastructure risk${NC}" 