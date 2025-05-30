#!/bin/bash

# Complete Aerotage Admin User Setup Script
# This script creates both Cognito users and DynamoDB user records

set -e

echo "🔧 Complete Aerotage Admin User Setup"
echo "====================================="

# Configuration
USER_POOL_ID="us-east-1_EsdlgX9Qg"
USERS_TABLE="aerotage-users-dev"
STAGE="dev"
REGION="us-east-1"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to check if AWS CLI is configured
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS CLI is not configured. Please run 'aws configure' first.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ AWS CLI is configured${NC}"
}

# Function to generate UUID
generate_uuid() {
    # Use uuidgen if available, otherwise use a simple alternative
    if command -v uuidgen &> /dev/null; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        # Simple UUID-like generator using date and random
        echo "$(date +%s)-$(shuf -i 1000-9999 -n 1)-$(shuf -i 1000-9999 -n 1)-$(shuf -i 1000-9999 -n 1)"
    fi
}

# Function to create complete admin user (Cognito + DynamoDB)
create_complete_admin_user() {
    local email=$1
    local temp_password=$2
    local user_id=$(generate_uuid)
    local now=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    
    echo -e "${YELLOW}🔄 Creating complete admin user: $email${NC}"
    
    # Step 1: Create Cognito user
    echo "   📝 Creating Cognito user..."
    aws cognito-idp admin-create-user \
        --user-pool-id "$USER_POOL_ID" \
        --username "$email" \
        --user-attributes \
            Name=email,Value="$email" \
            Name=given_name,Value="Admin" \
            Name=family_name,Value="User" \
            Name=email_verified,Value=true \
            Name=custom:role,Value=admin \
        --temporary-password "$temp_password" \
        --message-action SUPPRESS \
        > /dev/null

    # Step 2: Add user to admin group
    echo "   👥 Adding to admin group..."
    aws cognito-idp admin-add-user-to-group \
        --user-pool-id "$USER_POOL_ID" \
        --username "$email" \
        --group-name admin \
        > /dev/null

    # Step 3: Create DynamoDB user record
    echo "   💾 Creating DynamoDB user record..."
    
    # Create the DynamoDB item JSON
    local dynamodb_item=$(cat <<EOF
{
    "id": {"S": "$user_id"},
    "email": {"S": "$email"},
    "name": {"S": "Admin User"},
    "role": {"S": "admin"},
    "department": {"S": "Administration"},
    "jobTitle": {"S": "System Administrator"},
    "hourlyRate": {"N": "100"},
    "permissions": {"S": "{\"features\":[\"time-tracking\",\"reports\",\"admin\",\"user-management\",\"project-management\"],\"projects\":[]}"},
    "isActive": {"BOOL": true},
    "startDate": {"S": "$now"},
    "preferences": {"S": "{\"theme\":\"light\",\"notifications\":true,\"timezone\":\"UTC\"}"},
    "contactInfo": {"S": "{\"phone\":\"\",\"address\":\"\"}"},
    "createdAt": {"S": "$now"},
    "updatedAt": {"S": "$now"},
    "createdBy": {"S": "system"}
}
EOF
)

    # Put item in DynamoDB
    aws dynamodb put-item \
        --region "$REGION" \
        --table-name "$USERS_TABLE" \
        --item "$dynamodb_item" \
        --condition-expression "attribute_not_exists(id)" \
        > /dev/null

    echo -e "${GREEN}✅ Complete admin user created successfully${NC}"
    echo -e "   🆔 User ID: $user_id"
    echo -e "   📧 Email: $email"
    echo -e "   🔑 Temporary Password: $temp_password"
    echo -e "   📊 Role: admin"
    echo -e "   ${YELLOW}⚠️  User must change password on first login${NC}"
    
    # Store user ID for potential future use
    echo "$user_id" > "/tmp/admin_user_id.txt"
}

# Function to create complete test user (Cognito + DynamoDB)
create_complete_test_user() {
    local email=$1
    local temp_password=$2
    local user_id=$(generate_uuid)
    local now=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    
    echo -e "${YELLOW}🔄 Creating complete test user: $email${NC}"
    
    # Step 1: Create Cognito user
    echo "   📝 Creating Cognito user..."
    aws cognito-idp admin-create-user \
        --user-pool-id "$USER_POOL_ID" \
        --username "$email" \
        --user-attributes \
            Name=email,Value="$email" \
            Name=given_name,Value="Test" \
            Name=family_name,Value="User" \
            Name=email_verified,Value=true \
            Name=custom:role,Value=employee \
        --temporary-password "$temp_password" \
        --message-action SUPPRESS \
        > /dev/null

    # Step 2: Add user to employee group
    echo "   👥 Adding to employee group..."
    aws cognito-idp admin-add-user-to-group \
        --user-pool-id "$USER_POOL_ID" \
        --username "$email" \
        --group-name employee \
        > /dev/null

    # Step 3: Create DynamoDB user record
    echo "   💾 Creating DynamoDB user record..."
    
    # Create the DynamoDB item JSON
    local dynamodb_item=$(cat <<EOF
{
    "id": {"S": "$user_id"},
    "email": {"S": "$email"},
    "name": {"S": "Test User"},
    "role": {"S": "employee"},
    "department": {"S": "Engineering"},
    "jobTitle": {"S": "Software Developer"},
    "hourlyRate": {"N": "75"},
    "permissions": {"S": "{\"features\":[\"time-tracking\",\"reports\"],\"projects\":[]}"},
    "isActive": {"BOOL": true},
    "startDate": {"S": "$now"},
    "preferences": {"S": "{\"theme\":\"light\",\"notifications\":true,\"timezone\":\"UTC\"}"},
    "contactInfo": {"S": "{\"phone\":\"\",\"address\":\"\"}"},
    "createdAt": {"S": "$now"},
    "updatedAt": {"S": "$now"},
    "createdBy": {"S": "system"}
}
EOF
)

    # Put item in DynamoDB
    aws dynamodb put-item \
        --region "$REGION" \
        --table-name "$USERS_TABLE" \
        --item "$dynamodb_item" \
        --condition-expression "attribute_not_exists(id)" \
        > /dev/null

    echo -e "${GREEN}✅ Complete test user created successfully${NC}"
    echo -e "   🆔 User ID: $user_id"
    echo -e "   📧 Email: $email"
    echo -e "   🔑 Temporary Password: $temp_password"
    echo -e "   📊 Role: employee"
    echo -e "   ${YELLOW}⚠️  User must change password on first login${NC}"
}

# Function to check if tables exist
check_tables() {
    echo "🔍 Checking required tables..."
    
    # Check if users table exists
    if ! aws dynamodb describe-table --region "$REGION" --table-name "$USERS_TABLE" &> /dev/null; then
        echo -e "${RED}❌ Users table '$USERS_TABLE' not found!${NC}"
        echo -e "${YELLOW}   Please deploy the database stack first: cd infrastructure && cdk deploy AerotageDB-dev${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Required tables found${NC}"
}

# Main script
main() {
    echo -e "${YELLOW}This script will create complete admin and test users (Cognito + DynamoDB).${NC}"
    echo ""
    
    # Check prerequisites
    check_aws_cli
    check_tables
    
    # Get admin email
    echo -e "${YELLOW}📧 Please provide a real email address for admin notifications:${NC}"
    read -p "Admin email: " admin_email
    
    if [[ ! "$admin_email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        echo -e "${RED}❌ Invalid email format${NC}"
        exit 1
    fi
    
    # Get test email
    echo -e "${YELLOW}📧 Please provide an email address for testing:${NC}"
    read -p "Test user email: " test_email
    
    if [[ ! "$test_email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        echo -e "${RED}❌ Invalid email format${NC}"
        exit 1
    fi
    
    # Generate temporary passwords
    admin_temp_password="AdminTemp123!"
    test_temp_password="TestTemp123!"
    
    echo ""
    echo -e "${YELLOW}🚀 Creating complete users...${NC}"
    
    # Create complete admin user
    create_complete_admin_user "$admin_email" "$admin_temp_password"
    
    echo ""
    
    # Create complete test user
    create_complete_test_user "$test_email" "$test_temp_password"
    
    echo ""
    echo -e "${GREEN}🎉 Complete Setup Finished!${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "   1. Test login with the admin account: $admin_email"
    echo "   2. Change the temporary password on first login"
    echo "   3. Test the email change workflow if needed"
    echo "   4. Test with the test user account for additional validation"
    echo ""
    echo -e "${YELLOW}🔑 Login Information:${NC}"
    echo "   Admin User:"
    echo "     - Email: $admin_email"
    echo "     - Temp Password: $admin_temp_password"
    echo "     - Role: admin"
    echo ""
    echo "   Test User:"
    echo "     - Email: $test_email"
    echo "     - Temp Password: $test_temp_password"
    echo "     - Role: employee"
    echo ""
    echo -e "${YELLOW}⚠️  Important: Both users must change their passwords on first login${NC}"
    echo ""
    echo -e "${GREEN}✅ Both Cognito users and DynamoDB records have been created!${NC}"
}

# Run main function
main "$@" 