#!/bin/bash

# Get API Endpoints for Frontend Configuration
# Usage: ./scripts/get-api-endpoints.sh [environment]
# Example: ./scripts/get-api-endpoints.sh dev

ENVIRONMENT=${1:-dev}

echo "🚀 Aerotage Time Reporting API - Current Endpoints"
echo "=================================================="
echo ""

# Check if the stack exists
STACK_NAME="AerotageAPI-${ENVIRONMENT}"
if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" &>/dev/null; then
    echo "❌ Stack '$STACK_NAME' not found!"
    echo "Available environments:"
    aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --output text | grep "AerotageAPI-" | awk '{print $5}' | sed 's/AerotageAPI-/  - /'
    exit 1
fi

echo "📍 Environment: $ENVIRONMENT"
echo "📦 Stack: $STACK_NAME"
echo ""

# Get API Gateway URL
API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" --output text 2>/dev/null)

if [ -z "$API_URL" ] || [ "$API_URL" = "None" ]; then
    echo "❌ Could not retrieve API Gateway URL from stack outputs"
    exit 1
fi

echo "✅ API Gateway URL: $API_URL"
echo ""

# Test the API
echo "🔍 Testing API connectivity..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}user-invitations" 2>/dev/null)

if [ "$HTTP_STATUS" = "401" ]; then
    echo "✅ API is responding correctly (401 Unauthorized - expected for unauthenticated requests)"
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
echo "• List Invitations:     GET    ${API_URL}user-invitations"
echo "• Create Invitation:    POST   ${API_URL}user-invitations"
echo "• Resend Invitation:    POST   ${API_URL}user-invitations/{id}/resend"
echo "• Cancel Invitation:    DELETE ${API_URL}user-invitations/{id}"
echo "• Validate Token:       GET    ${API_URL}user-invitations/validate/{token}"
echo "• Accept Invitation:    POST   ${API_URL}user-invitations/accept"
echo ""

echo "📝 Notes:"
echo "========="
echo "• All endpoints except validate and accept require Cognito JWT authentication"
echo "• Use Authorization: Bearer {token} header for authenticated endpoints"
echo "• API returns 401 Unauthorized for missing/invalid tokens"
echo ""

echo "🐛 Troubleshooting:"
echo "==================="
echo "• If getting DNS errors, verify the URL is correct"
echo "• If getting 403 Forbidden, check Cognito token validity"
echo "• If getting 401 Unauthorized, ensure Authorization header is set"
echo "• For CORS issues, ensure proper headers are included" 