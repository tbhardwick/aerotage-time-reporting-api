#!/bin/bash

# Manual User Creation Script for Aerotage Time Reporting
# Use this if the main setup script encounters issues

echo "🔧 Creating Test Users Manually"
echo "==============================="

USER_POOL_ID="us-east-1_EsdlgX9Qg"

# Function to create user with email as username
create_user_with_email() {
    local email=$1
    local role=$2
    local group=$3
    local temp_password="TempPassword123!"
    
    echo "🔄 Creating user: $email"
    
    # Create user (email is the username)
    aws cognito-idp admin-create-user \
        --user-pool-id "$USER_POOL_ID" \
        --username "$email" \
        --user-attributes \
            Name=email,Value="$email" \
            Name=given_name,Value="Test" \
            Name=family_name,Value="User" \
            Name=email_verified,Value=true \
            Name=custom:role,Value="$role" \
        --temporary-password "$temp_password" \
        --message-action SUPPRESS
    
    # Add to group
    aws cognito-idp admin-add-user-to-group \
        --user-pool-id "$USER_POOL_ID" \
        --username "$email" \
        --group-name "$group"
    
    echo "✅ Created: $email (password: $temp_password)"
}

# Example usage - replace with your email addresses
echo "Replace the email addresses below with real ones and uncomment the lines:"
echo ""
echo "# Admin user"
echo "# create_user_with_email 'your-admin@domain.com' 'admin' 'admin'"
echo ""
echo "# Test user for password reset"
echo "# create_user_with_email 'your-test@domain.com' 'employee' 'employee'"
echo ""
echo "💡 Tip: Edit this script and uncomment the lines above with your real email addresses" 