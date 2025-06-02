# Multiple Account Management Reference

## 🎯 Quick Reference Card

| Task | GitHub | AWS |
|------|--------|-----|
| **Switch Account** | `gh auth switch --user USERNAME` | `export AWS_PROFILE=PROFILE` |
| **Check Status** | `gh auth status` | `aws sts get-caller-identity` |
| **List Accounts** | `gh auth status` | `aws configure list-profiles` |
| **Add Account** | `gh auth login` | `aws configure --profile NAME` |

### Current Accounts
- **GitHub**: `tbhardwick`, `bhardwick-voltasis`
- **AWS**: `aerotage`, `voltasis`

### 🚀 Quick Switching (Recommended)
```bash
work-aerotage     # Switch both GitHub and AWS to Aerotage
work-voltasis     # Switch both GitHub and AWS to Voltasis  
account-status    # Check current status of both
```

---

## 📋 Setup Instructions

### Initial Setup (One-time)

#### 1. GitHub CLI Multiple Accounts
```bash
# Authenticate first account
gh auth login --hostname github.com --git-protocol https --web

# Authenticate second account  
gh auth login --hostname github.com --git-protocol https --web
```

#### 2. AWS CLI Multiple Accounts
```bash
# Configure first profile
aws configure --profile aerotage

# Configure second profile
aws configure --profile voltasis
```

#### 3. Add Aliases to Shell Configuration
The aliases are automatically added to your `~/.zshrc` file. If you need to add them manually:

```bash
# Add to ~/.zshrc or ~/.bashrc
alias work-aerotage="gh auth switch --user tbhardwick && export AWS_PROFILE=aerotage && echo '🚀 Switched to Aerotage accounts'"
alias work-voltasis="gh auth switch --user bhardwick-voltasis && export AWS_PROFILE=voltasis && echo '🚀 Switched to Voltasis accounts'"
alias account-status="echo '=== GitHub ===' && gh auth status && echo '=== AWS ===' && echo 'Profile: \$AWS_PROFILE' && aws sts get-caller-identity"

# Reload shell configuration
source ~/.zshrc
```

### Troubleshooting Setup Issues

#### Permission Denied on GitHub CLI
```bash
# Fix .config directory permissions if needed
sudo chown -R $USER:staff ~/.config

# Re-authenticate
gh auth login --hostname github.com --git-protocol https --web
```

#### Git Push Permission Denied (Wrong Account)
```bash
# Configure git to use GitHub CLI for authentication
gh auth setup-git

# Verify the active account
gh auth status

# Try the git operation again
git push origin main
```

#### Aliases Not Working
```bash
# Check if aliases are defined
alias | grep work-

# If not found, reload shell configuration
source ~/.zshrc

# Or restart terminal
```

---

## Overview
This document provides a complete reference for managing multiple GitHub and AWS accounts, with emphasis on easy default account switching for AI tools like Cursor.

---

## 🐙 GitHub CLI Multiple Accounts

### Current Setup
- **Account 1**: `tbhardwick`
- **Account 2**: `bhardwick-voltasis`

### Basic Commands

#### Check Authentication Status
```bash
gh auth status
```

#### Switch Between Accounts
```bash
# Switch to specific account
gh auth switch --user tbhardwick
gh auth switch --user bhardwick-voltasis

# Interactive switch (auto-switches between 2 accounts)
gh auth switch
```

#### Add New Account
```bash
gh auth login --hostname github.com --git-protocol https --web
```

### 🤖 AI Tool Default Account Management

Since AI tools like Cursor use the **active account** by default, here's how to quickly set defaults:

#### Quick Default Switching
```bash
# Make tbhardwick the default
gh auth switch --user tbhardwick

# Make bhardwick-voltasis the default  
gh auth switch --user bhardwick-voltasis

# Verify which is active (look for "Active account: true")
gh auth status
```

#### Create Aliases for Easy Switching
Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# GitHub account aliases
alias gh-aerotage="gh auth switch --user tbhardwick"
alias gh-voltasis="gh auth switch --user bhardwick-voltasis"
alias gh-status="gh auth status"
```

Then reload: `source ~/.zshrc`

Usage:
```bash
gh-aerotage    # Switch to tbhardwick
gh-voltasis    # Switch to bhardwick-voltasis  
gh-status      # Check current active account
```

---

## ☁️ AWS CLI Multiple Accounts

### Current Setup
- **Profile 1**: `aerotage` 
- **Profile 2**: `voltasis`

### Basic Commands

#### List All Profiles
```bash
aws configure list-profiles
```

#### Check Current Configuration
```bash
aws configure list
```

#### Test Account Access
```bash
aws sts get-caller-identity --profile aerotage
aws sts get-caller-identity --profile voltasis
```

### Using Profiles

#### Method 1: Profile Flag (Explicit)
```bash
# Aerotage account
aws s3 ls --profile aerotage
aws ec2 describe-instances --profile aerotage
aws lambda list-functions --profile aerotage

# Voltasis account
aws s3 ls --profile voltasis
aws ec2 describe-instances --profile voltasis
aws lambda list-functions --profile voltasis
```

#### Method 2: Environment Variable (Session Default)
```bash
# Set aerotage as default for current session
export AWS_PROFILE=aerotage
aws s3 ls  # Uses aerotage

# Switch to voltasis
export AWS_PROFILE=voltasis
aws s3 ls  # Uses voltasis

# Clear default
unset AWS_PROFILE
```

#### Method 3: Global Default Profile
```bash
# Set permanent default
aws configure set default.profile aerotage

# Or set voltasis as default
aws configure set default.profile voltasis
```

### 🤖 AI Tool Default Account Management

AI tools like Cursor will use the **default AWS profile**. Here are the best strategies:

#### Strategy 1: Environment Variable (Recommended)
```bash
# Set for current terminal session
export AWS_PROFILE=aerotage    # For Aerotage work
export AWS_PROFILE=voltasis    # For Voltasis work

# Check what's active
echo $AWS_PROFILE
aws sts get-caller-identity
```

#### Strategy 2: Create Switching Aliases
Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# AWS account aliases
alias aws-aerotage="export AWS_PROFILE=aerotage && echo 'Switched to Aerotage AWS account'"
alias aws-voltasis="export AWS_PROFILE=voltasis && echo 'Switched to Voltasis AWS account'"
alias aws-clear="unset AWS_PROFILE && echo 'Cleared AWS profile'"
alias aws-status="echo 'Current AWS Profile:' \$AWS_PROFILE && aws sts get-caller-identity"
```

Usage:
```bash
aws-aerotage   # Switch to aerotage profile
aws-voltasis   # Switch to voltasis profile
aws-clear      # Clear profile (use default)
aws-status     # Check current profile and identity
```

#### Strategy 3: Project-Specific Environment Files
Create `.env` files in project directories:

**For Aerotage projects** (`.env.aerotage`):
```bash
export AWS_PROFILE=aerotage
export AWS_REGION=us-east-1
```

**For Voltasis projects** (`.env.voltasis`):
```bash
export AWS_PROFILE=voltasis
export AWS_REGION=us-east-1
```

Load with:
```bash
source .env.aerotage   # Load Aerotage settings
source .env.voltasis   # Load Voltasis settings
```

### CDK Deployments with Profiles
```bash
# Deploy to specific account
cd infrastructure
npx cdk deploy --profile aerotage
npx cdk deploy --profile voltasis

# Or set environment variable first
export AWS_PROFILE=aerotage
npx cdk deploy
```

---

## 🔄 Quick Switching Workflow

### For AI Tools (Cursor, etc.)

#### Before Starting Work:
```bash
# 1. Set GitHub account
gh auth switch --user tbhardwick        # or bhardwick-voltasis

# 2. Set AWS account  
export AWS_PROFILE=aerotage              # or voltasis

# 3. Verify settings
gh auth status
aws sts get-caller-identity

# 4. Start your AI tool (Cursor, etc.)
```

#### Quick Status Check:
```bash
# Check both at once
echo "=== GitHub ===" && gh auth status && echo "=== AWS ===" && echo "Profile: $AWS_PROFILE" && aws sts get-caller-identity
```

### Recommended Aliases (All-in-One)

**These aliases are automatically configured in your `~/.zshrc` file:**

```bash
# Combined account switching
alias work-aerotage="gh auth switch --user tbhardwick && export AWS_PROFILE=aerotage && echo '🚀 Switched to Aerotage accounts'"
alias work-voltasis="gh auth switch --user bhardwick-voltasis && export AWS_PROFILE=voltasis && echo '🚀 Switched to Voltasis accounts'"

# Status check
alias account-status="echo '=== GitHub ===' && gh auth status && echo '=== AWS ===' && echo 'Profile: $AWS_PROFILE' && aws sts get-caller-identity"

# Individual service aliases
alias gh-aerotage="gh auth switch --user tbhardwick"
alias gh-voltasis="gh auth switch --user bhardwick-voltasis"
alias gh-status="gh auth status"
alias aws-aerotage="export AWS_PROFILE=aerotage && echo 'Switched to Aerotage AWS account'"
alias aws-voltasis="export AWS_PROFILE=voltasis && echo 'Switched to Voltasis AWS account'"
alias aws-clear="unset AWS_PROFILE && echo 'Cleared AWS profile'"
alias aws-status="echo 'Current AWS Profile:' \$AWS_PROFILE && aws sts get-caller-identity"
```

Usage:
```bash
work-aerotage     # Switch both GitHub and AWS to Aerotage
work-voltasis     # Switch both GitHub and AWS to Voltasis  
account-status    # Check current status of both
```

---

## 🛠️ Configuration Files

### GitHub CLI Config Location
```
~/.config/gh/
```

### AWS CLI Config Location
```
~/.aws/config
~/.aws/credentials
```

### Shell Configuration
```
~/.zshrc (for zsh)
~/.bashrc (for bash)
```

### View Configuration Files
```bash
# GitHub CLI config
cat ~/.config/gh/hosts.yml

# AWS profiles
cat ~/.aws/config
cat ~/.aws/credentials

# Shell aliases
cat ~/.zshrc | grep alias
```

---

## 🚨 Troubleshooting

### GitHub CLI Issues
```bash
# Permission denied
gh auth login --hostname github.com --git-protocol https --web

# Check authentication
gh auth status

# Re-authenticate
gh auth logout
gh auth login

# Fix config directory permissions
sudo chown -R $USER:staff ~/.config
```

### AWS CLI Issues
```bash
# Check configuration
aws configure list
aws configure list-profiles

# Test access
aws sts get-caller-identity --profile PROFILE_NAME

# Reconfigure profile
aws configure --profile PROFILE_NAME
```

### Environment Variable Issues
```bash
# Check current AWS profile
echo $AWS_PROFILE

# Clear if needed
unset AWS_PROFILE

# Set for session
export AWS_PROFILE=profile_name
```

### Alias Issues
```bash
# Check if aliases are loaded
alias | grep work-

# Reload shell configuration
source ~/.zshrc

# Or restart terminal
```

---

## 📝 Best Practices

1. **Always verify active accounts** before starting work
2. **Use descriptive profile names** (aerotage, voltasis vs account1, account2)
3. **Set environment variables** for AI tool sessions
4. **Create aliases** for quick switching
5. **Document which accounts** are used for which projects
6. **Test access** after switching accounts
7. **Use the quick switching aliases** for efficiency
8. **Check account status** before important operations 