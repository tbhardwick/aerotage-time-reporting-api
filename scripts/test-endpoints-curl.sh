#!/bin/bash

# Daily and Weekly Time Tracking Endpoints - Curl Test Script
# 
# This script provides quick curl commands to test the new endpoints.
# You'll need to provide a valid JWT token and project ID.

set -e

# Configuration
API_BASE_URL="https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev"
TODAY=$(date +%Y-%m-%d)
LAST_WEEK=$(date -v-7d +%Y-%m-%d)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Daily and Weekly Time Tracking Endpoints Test${NC}"
echo "API Base URL: $API_BASE_URL"
echo "Today: $TODAY"
echo "Last Week: $LAST_WEEK"

# Check if JWT token is provided
if [ -z "$JWT_TOKEN" ]; then
    echo -e "${YELLOW}Please set JWT_TOKEN environment variable:${NC}"
    echo "export JWT_TOKEN='your-jwt-token-here'"
    echo ""
    echo -e "${YELLOW}You can get a JWT token by:${NC}"
    echo "1. Logging into the Aerotage app"
    echo "2. Using AWS Cognito CLI"
    echo "3. Using the existing test scripts"
    exit 1
fi

# Check if project ID is provided
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}Please set PROJECT_ID environment variable:${NC}"
    echo "export PROJECT_ID='your-project-id-here'"
    echo ""
    echo -e "${YELLOW}You can get a project ID by calling:${NC}"
    echo "curl -H \"Authorization: Bearer \$JWT_TOKEN\" \"$API_BASE_URL/projects\""
    exit 1
fi

echo -e "${GREEN}Using JWT_TOKEN: ${JWT_TOKEN:0:20}...${NC}"
echo -e "${GREEN}Using PROJECT_ID: $PROJECT_ID${NC}"
echo ""

# Function to make API calls
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    
    echo -e "${BLUE}Testing: $name${NC}"
    echo "$method $endpoint"
    
    if [ -n "$data" ]; then
        echo "Request body: $data"
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $JWT_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $JWT_TOKEN" \
            "$API_BASE_URL$endpoint")
    fi
    
    # Split response and status code
    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "✅ ${GREEN}SUCCESS${NC} - Status: $status_code"
        echo "Response: $response_body" | jq '.' 2>/dev/null || echo "$response_body"
    else
        echo -e "❌ ${RED}FAILED${NC} - Expected: $expected_status, Got: $status_code"
        echo "Response: $response_body"
    fi
    echo ""
}

# Test 1: Get work schedule (might not exist yet)
test_endpoint "Get Work Schedule" "GET" "/users/work-schedule" "" "200"

# Test 2: Create/Update work schedule
work_schedule_data='{
  "schedule": {
    "monday": { "start": "09:00", "end": "17:00", "targetHours": 8 },
    "tuesday": { "start": "09:00", "end": "17:00", "targetHours": 8 },
    "wednesday": { "start": "09:00", "end": "17:00", "targetHours": 8 },
    "thursday": { "start": "09:00", "end": "17:00", "targetHours": 8 },
    "friday": { "start": "09:00", "end": "16:00", "targetHours": 7 },
    "saturday": { "start": null, "end": null, "targetHours": 0 },
    "sunday": { "start": null, "end": null, "targetHours": 0 }
  },
  "timezone": "America/New_York"
}'

test_endpoint "Update Work Schedule" "PUT" "/users/work-schedule" "$work_schedule_data" "200"

# Test 3: Get work schedule again (should now exist)
test_endpoint "Get Work Schedule (after update)" "GET" "/users/work-schedule" "" "200"

# Test 4: Quick add time entry
quick_entry_data="{
  \"date\": \"$TODAY\",
  \"startTime\": \"10:00\",
  \"endTime\": \"11:00\",
  \"projectId\": \"$PROJECT_ID\",
  \"description\": \"Test time entry from curl script\",
  \"isBillable\": true,
  \"fillGap\": false
}"

test_endpoint "Quick Add Time Entry" "POST" "/time-entries/quick-add" "$quick_entry_data" "201"

# Test 5: Daily summary for today
test_endpoint "Daily Summary (Today)" "GET" "/time-entries/daily-summary?startDate=$TODAY&endDate=$TODAY&includeGaps=true" "" "200"

# Test 6: Get Monday of current week for weekly overview
get_monday() {
    local date="$1"
    local day_of_week=$(date -j -f "%Y-%m-%d" "$date" +%u)  # 1=Monday, 7=Sunday
    local days_to_subtract=$((day_of_week - 1))
    date -j -v-${days_to_subtract}d -f "%Y-%m-%d" "$date" +%Y-%m-%d
}

CURRENT_MONDAY=$(get_monday "$TODAY")
test_endpoint "Weekly Overview" "GET" "/time-entries/weekly-overview?weekStartDate=$CURRENT_MONDAY&includeComparison=true" "" "200"

# Test 7: Daily summary with date range
test_endpoint "Daily Summary (Date Range)" "GET" "/time-entries/daily-summary?startDate=$LAST_WEEK&endDate=$TODAY&includeGaps=false" "" "200"

# Test 8: Test error handling - invalid date format
test_endpoint "Daily Summary (Invalid Date)" "GET" "/time-entries/daily-summary?startDate=invalid&endDate=2024-01-01" "" "400"

# Test 9: Test error handling - future date
FUTURE_DATE=$(date -v+1d +%Y-%m-%d)
test_endpoint "Daily Summary (Future Date)" "GET" "/time-entries/daily-summary?startDate=$FUTURE_DATE&endDate=$FUTURE_DATE" "" "400"

# Test 10: Test error handling - invalid work schedule
invalid_schedule_data='{
  "schedule": {
    "monday": { "start": "17:00", "end": "09:00", "targetHours": 8 }
  }
}'

test_endpoint "Update Work Schedule (Invalid)" "PUT" "/users/work-schedule" "$invalid_schedule_data" "400"

echo -e "${BLUE}Test completed!${NC}"
echo ""
echo -e "${YELLOW}Additional manual tests you can run:${NC}"
echo ""
echo "# Test with different user (if you have manager/admin access):"
echo "curl -H \"Authorization: Bearer \$JWT_TOKEN\" \"$API_BASE_URL/users/USER_ID/work-schedule\""
echo ""
echo "# Test daily summary with different parameters:"
echo "curl -H \"Authorization: Bearer \$JWT_TOKEN\" \"$API_BASE_URL/time-entries/daily-summary?startDate=$LAST_WEEK&endDate=$TODAY&targetHours=6\""
echo ""
echo "# Test weekly overview for different week:"
echo "curl -H \"Authorization: Bearer \$JWT_TOKEN\" \"$API_BASE_URL/time-entries/weekly-overview?weekStartDate=$LAST_WEEK&includeComparison=false\""
echo ""
echo -e "${YELLOW}Check AWS Console:${NC}"
echo "1. DynamoDB Tables: aerotage-user-work-schedules-dev, aerotage-time-entries-dev"
echo "2. CloudWatch Logs: /aws/lambda/aerotage-*-dev"
echo "3. API Gateway: Check request/response logs" 