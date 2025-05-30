#!/bin/bash

# Create DynamoDB record for existing Cognito admin user
# Since the Cognito user already exists, we just need the DynamoDB record

set -e

echo "🔧 Creating DynamoDB record for existing admin user"
echo "=================================================="

# Configuration
USERS_TABLE="aerotage-users-dev"
REGION="us-east-1"
ADMIN_EMAIL="bhardwick@aerotage.com"

# Generate UUID for the user ID
generate_uuid() {
    if command -v uuidgen &> /dev/null; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        echo "$(date +%s)-$(shuf -i 1000-9999 -n 1)-$(shuf -i 1000-9999 -n 1)-$(shuf -i 1000-9999 -n 1)"
    fi
}

USER_ID=$(generate_uuid)
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")

echo "Creating DynamoDB user record..."
echo "User ID: $USER_ID"
echo "Email: $ADMIN_EMAIL"
echo "Table: $USERS_TABLE"

# Create the DynamoDB item
aws dynamodb put-item \
    --region "$REGION" \
    --table-name "$USERS_TABLE" \
    --item '{
        "id": {"S": "'$USER_ID'"},
        "email": {"S": "'$ADMIN_EMAIL'"},
        "name": {"S": "Brad Hardwick"},
        "role": {"S": "admin"},
        "department": {"S": "Administration"},
        "jobTitle": {"S": "System Administrator"},
        "hourlyRate": {"N": "100"},
        "permissions": {"S": "{\"features\":[\"time-tracking\",\"reports\",\"admin\",\"user-management\",\"project-management\"],\"projects\":[]}"},
        "isActive": {"BOOL": true},
        "startDate": {"S": "'$NOW'"},
        "preferences": {"S": "{\"theme\":\"light\",\"notifications\":true,\"timezone\":\"UTC\"}"},
        "contactInfo": {"S": "{\"phone\":\"\",\"address\":\"\"}"},
        "createdAt": {"S": "'$NOW'"},
        "updatedAt": {"S": "'$NOW'"},
        "createdBy": {"S": "system"}
    }'

echo "✅ DynamoDB user record created successfully!"
echo "🆔 User ID: $USER_ID"
echo "📧 Email: $ADMIN_EMAIL"
echo "📊 Role: admin"
echo ""
echo "🎉 Admin user setup complete!"
echo "You can now test the email change workflow with: $ADMIN_EMAIL"
echo "Password: Aerotage*2025" 