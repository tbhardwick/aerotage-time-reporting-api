#!/bin/bash

# Quick deployment verification script
# This tests that the new endpoints are deployed and responding
# We expect 401 responses since we're not providing authentication

set -e

API_BASE_URL="https://time-api-dev.aerotage.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Verifying Daily/Weekly Time Tracking Endpoints Deployment${NC}"
echo "API Base URL: $API_BASE_URL"
echo ""

# Function to test endpoint existence
test_endpoint_exists() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    
    echo -e "${BLUE}Testing: $name${NC}"
    echo "$method $endpoint"
    
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_BASE_URL$endpoint")
    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')
    
    # We expect 401 (Unauthorized) or 403 (Forbidden) for endpoints that require auth
    # 404 would indicate the endpoint doesn't exist
    if [ "$status_code" = "401" ] || [ "$status_code" = "403" ]; then
        echo -e "✅ ${GREEN}DEPLOYED${NC} - Status: $status_code (endpoint exists, auth required)"
    elif [ "$status_code" = "404" ]; then
        echo -e "❌ ${RED}NOT FOUND${NC} - Status: $status_code (endpoint not deployed)"
    elif [ "$status_code" = "400" ]; then
        echo -e "✅ ${GREEN}DEPLOYED${NC} - Status: $status_code (endpoint exists, bad request)"
    else
        echo -e "⚠️  ${YELLOW}UNEXPECTED${NC} - Status: $status_code"
        echo "Response: $response_body"
    fi
    echo ""
}

echo -e "${YELLOW}Testing new Daily/Weekly Time Tracking endpoints...${NC}"
echo ""

# Test the new endpoints
test_endpoint_exists "Get Work Schedule" "GET" "/users/work-schedule"
test_endpoint_exists "Update Work Schedule" "PUT" "/users/work-schedule"
test_endpoint_exists "Daily Summary" "GET" "/time-entries/daily-summary?startDate=2024-01-01&endDate=2024-01-01"
test_endpoint_exists "Weekly Overview" "GET" "/time-entries/weekly-overview?weekStartDate=2024-01-01"
test_endpoint_exists "Quick Add Time Entry" "POST" "/time-entries/quick-add"

echo -e "${YELLOW}Testing existing endpoints for comparison...${NC}"
echo ""

# Test some existing endpoints to make sure they still work
test_endpoint_exists "Get Projects" "GET" "/projects"
test_endpoint_exists "Get Time Entries" "GET" "/time-entries"
test_endpoint_exists "Get Users" "GET" "/users"

echo -e "${BLUE}Deployment verification completed!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. If all endpoints show 'DEPLOYED', the deployment was successful"
echo "2. Use the authenticated test scripts to verify functionality:"
echo "   - ./scripts/test-endpoints-curl.sh (requires JWT_TOKEN and PROJECT_ID)"
echo "   - ./scripts/test-daily-weekly-endpoints.js (interactive)"
echo "3. Check CloudWatch logs for any errors during deployment"
echo "4. Verify the DynamoDB table 'aerotage-user-work-schedules-dev' was created" 