#!/bin/bash

# Aerotage Admin User Setup Script
# This script addresses the admin@aerotage.com email issue and sets up proper admin users

set -e

echo "🔧 Aerotage Admin User Setup"
echo "=============================="

# Configuration
USER_POOL_ID="us-east-1_EsdlgX9Qg"
STAGE="dev"

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

# Function to create admin user
create_admin_user() {
    local email=$1
    local temp_password=$2
    
    echo -e "${YELLOW}🔄 Creating admin user: $email${NC}"
    
    # Create the user (using email as username since signInAliases is email)
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
    
    # Add user to admin group (using email as username)
    aws cognito-idp admin-add-user-to-group \
        --user-pool-id "$USER_POOL_ID" \
        --username "$email" \
        --group-name admin \
        > /dev/null
    
    echo -e "${GREEN}✅ Admin user created successfully${NC}"
    echo -e "   Username: $email"
    echo -e "   Email: $email"
    echo -e "   Temporary Password: $temp_password"
    echo -e "   ${YELLOW}⚠️  User must change password on first login${NC}"
}

# Function to create test user
create_test_user() {
    local email=$1
    local temp_password=$2
    
    echo -e "${YELLOW}🔄 Creating test user: $email${NC}"
    
    # Create the user (using email as username since signInAliases is email)
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
    
    # Add user to employee group (using email as username)
    aws cognito-idp admin-add-user-to-group \
        --user-pool-id "$USER_POOL_ID" \
        --username "$email" \
        --group-name employee \
        > /dev/null
    
    echo -e "${GREEN}✅ Test user created successfully${NC}"
    echo -e "   Username: $email"
    echo -e "   Email: $email"
    echo -e "   Temporary Password: $temp_password"
    echo -e "   ${YELLOW}⚠️  Use this user to test password reset${NC}"
}

# Function to update monitoring email
update_monitoring_email() {
    local new_email=$1
    
    echo -e "${YELLOW}🔄 Updating monitoring email configuration${NC}"
    echo -e "   Current: admin@aerotage.com"
    echo -e "   New: $new_email"
    
    # Create backup of monitoring stack
    cp infrastructure/lib/monitoring-stack.ts infrastructure/lib/monitoring-stack.ts.backup
    
    # Update the email in monitoring stack
    sed -i.tmp "s/admin@aerotage.com/$new_email/g" infrastructure/lib/monitoring-stack.ts
    rm infrastructure/lib/monitoring-stack.ts.tmp 2>/dev/null || true
    
    echo -e "${GREEN}✅ Monitoring email updated${NC}"
    echo -e "${YELLOW}   📝 Please run 'npm run deploy:dev' in infrastructure/ to apply changes${NC}"
}

# Main script
main() {
    echo -e "${YELLOW}This script will help you set up proper admin and test users.${NC}"
    echo ""
    
    # Check prerequisites
    check_aws_cli
    
    # Get admin email
    echo -e "${YELLOW}📧 Please provide a real email address for admin notifications:${NC}"
    read -p "Admin email: " admin_email
    
    if [[ ! "$admin_email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        echo -e "${RED}❌ Invalid email format${NC}"
        exit 1
    fi
    
    # Get test email
    echo -e "${YELLOW}📧 Please provide an email address for testing password reset:${NC}"
    read -p "Test user email: " test_email
    
    if [[ ! "$test_email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        echo -e "${RED}❌ Invalid email format${NC}"
        exit 1
    fi
    
    # Generate temporary passwords
    admin_temp_password="AdminTemp123!"
    test_temp_password="TestTemp123!"
    
    echo ""
    echo -e "${YELLOW}🚀 Creating users...${NC}"
    
    # Create admin user
    create_admin_user "$admin_email" "$admin_temp_password"
    
    echo ""
    
    # Create test user
    create_test_user "$test_email" "$test_temp_password"
    
    echo ""
    
    # Update monitoring email configuration
    if [ -f "infrastructure/lib/monitoring-stack.ts" ]; then
        update_monitoring_email "$admin_email"
    else
        echo -e "${YELLOW}⚠️  Monitoring stack not found. Please manually update admin@aerotage.com to $admin_email${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Setup Complete!${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "   1. Update infrastructure/lib/monitoring-stack.ts if not done automatically"
    echo "   2. Run 'cd infrastructure && npm run deploy:dev' to apply monitoring changes"
    echo "   3. Test password reset with the test user"
    echo "   4. Update frontend AWS configuration with the provided values"
    echo ""
    echo -e "${YELLOW}🔑 Login Information:${NC}"
    echo "   Admin User:"
    echo "     - Username: $admin_email"
    echo "     - Email: $admin_email"
    echo "     - Temp Password: $admin_temp_password"
    echo ""
    echo "   Test User (for password reset testing):"
    echo "     - Username: $test_email"
    echo "     - Email: $test_email"
    echo "     - Temp Password: $test_temp_password"
    echo ""
    echo -e "${YELLOW}⚠️  Important: Both users must change their passwords on first login${NC}"
}

# Run main function
main "$@" 