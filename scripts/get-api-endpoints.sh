#!/bin/bash

# Get API Endpoints for Frontend Configuration
# Usage: ./scripts/get-api-endpoints.sh [environment]
# Example: ./scripts/get-api-endpoints.sh dev

ENVIRONMENT=${1:-dev}

echo "🚀 Aerotage Time Reporting API - Current Endpoints"
echo "=================================================="
echo ""

# Check if the API stack exists
API_STACK_NAME="AerotageAPI-${ENVIRONMENT}"
if ! aws cloudformation describe-stacks --stack-name "$API_STACK_NAME" &>/dev/null; then
    echo "❌ Stack '$API_STACK_NAME' not found!"
    echo "Available environments:"
    aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --output text | grep "AerotageAPI-" | awk '{print $5}' | sed 's/AerotageAPI-/  - /'
    exit 1
fi

echo "📍 Environment: $ENVIRONMENT"
echo "📦 API Stack: $API_STACK_NAME"

# Check for custom domain stack
DOMAIN_STACK_NAME="AerotageDomain-${ENVIRONMENT}"
CUSTOM_DOMAIN_URL=""

if aws cloudformation describe-stacks --stack-name "$DOMAIN_STACK_NAME" &>/dev/null; then
    echo "📦 Domain Stack: $DOMAIN_STACK_NAME"
    CUSTOM_DOMAIN_URL=$(aws cloudformation describe-stacks --stack-name "$DOMAIN_STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text 2>/dev/null)
fi

# Get API Gateway URL as fallback
API_GATEWAY_URL=$(aws cloudformation describe-stacks --stack-name "$API_STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" --output text 2>/dev/null)

# Determine which URL to use
if [ -n "$CUSTOM_DOMAIN_URL" ] && [ "$CUSTOM_DOMAIN_URL" != "None" ]; then
    API_URL="$CUSTOM_DOMAIN_URL"
    echo "✅ Using Custom Domain: $API_URL"
    echo "📋 Raw API Gateway URL: $API_GATEWAY_URL"
elif [ -n "$API_GATEWAY_URL" ] && [ "$API_GATEWAY_URL" != "None" ]; then
    API_URL="$API_GATEWAY_URL"
    echo "⚠️  Using Raw API Gateway URL: $API_URL"
    echo "💡 Consider setting up custom domain for production use"
else
    echo "❌ Could not retrieve API URL from stack outputs"
    exit 1
fi

echo ""

# Test the API
echo "🔍 Testing API connectivity..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" 2>/dev/null)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ API is responding correctly (200 OK - health endpoint working)"
elif [ "$HTTP_STATUS" = "401" ]; then
    echo "✅ API is responding correctly (401 Unauthorized - expected for some endpoints)"
elif [ "$HTTP_STATUS" = "000" ]; then
    echo "❌ API is not reachable (DNS resolution or network error)"
else
    echo "⚠️  API responded with status: $HTTP_STATUS"
fi

echo ""
echo "📋 Frontend Configuration:"
echo "=========================="
echo ""
echo "Update your frontend API configuration with:"
echo ""
echo "const API_BASE_URL = '$API_URL';"
echo ""
echo "or for environment files:"
echo ""
echo "REACT_APP_API_BASE_URL=$API_URL"
echo "# or"
echo "VITE_API_BASE_URL=$API_URL"
echo ""

echo "🔗 Key Endpoints:"
echo "=================="
echo ""
echo "• Health Check:         GET    ${API_URL}/health"
echo "• List Users:           GET    ${API_URL}/users"
echo "• User Profile:         GET    ${API_URL}/users/{id}/profile"
echo "• User Preferences:     GET    ${API_URL}/users/{id}/preferences"
echo "• User Sessions:        GET    ${API_URL}/users/{id}/sessions"
echo "• Projects:             GET    ${API_URL}/projects"
echo "• Clients:              GET    ${API_URL}/clients"
echo "• Time Entries:         GET    ${API_URL}/time-entries"
echo "• Reports:              POST   ${API_URL}/reports/time"
echo "• Analytics:            POST   ${API_URL}/analytics/dashboard/enhanced"
echo "• Invoices:             GET    ${API_URL}/invoices"
echo "• User Invitations:     GET    ${API_URL}/user-invitations"
echo ""

echo "📝 Notes:"
echo "========="
echo "• Most endpoints require Cognito JWT authentication"
echo "• Use Authorization: Bearer {token} header for authenticated endpoints"
echo "• Health endpoint (/health) is public and doesn't require authentication"
echo "• API returns 401 Unauthorized for missing/invalid tokens"
echo ""

echo "🧪 Testing:"
echo "==========="
echo "• Run comprehensive tests: node scripts/test-all-endpoints.js"
echo "• Test OpenAPI coverage:   node scripts/test-openapi-coverage.js"
echo "• Build documentation:     node scripts/build-openapi.js $ENVIRONMENT $API_URL"
echo ""

echo "🐛 Troubleshooting:"
echo "==================="
echo "• If getting DNS errors, verify the URL is correct"
echo "• If getting 403 Forbidden, check Cognito token validity"
echo "• If getting 401 Unauthorized, ensure Authorization header is set"
echo "• For CORS issues, ensure proper headers are included"
echo "• Check CloudWatch logs for detailed error information" 