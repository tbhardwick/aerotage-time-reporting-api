#!/bin/bash

# TypeScript Fixes Integration Script - Phase 1
# This script implements the selective cherry-pick strategy

set -e  # Exit on any error

echo "🔧 TypeScript Fixes Integration - Phase 1"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
print_status "Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "feature/custom-domain-dev" ]; then
    print_error "This script should be run from the feature/custom-domain-dev branch"
    print_status "Current branch: $CURRENT_BRANCH"
    print_status "Please checkout feature/custom-domain-dev first:"
    echo "  git checkout feature/custom-domain-dev"
    exit 1
fi

# Check if working directory is clean
if ! git diff-index --quiet HEAD --; then
    print_error "Working directory is not clean. Please commit or stash changes first."
    git status --porcelain
    exit 1
fi

# Step 1: Create integration branch
INTEGRATION_BRANCH="fix/typescript-integration-custom-domain"
print_status "Creating integration branch: $INTEGRATION_BRANCH"

if git show-ref --verify --quiet refs/heads/$INTEGRATION_BRANCH; then
    print_warning "Branch $INTEGRATION_BRANCH already exists"
    read -p "Do you want to delete it and recreate? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git branch -D $INTEGRATION_BRANCH
        print_success "Deleted existing branch"
    else
        print_error "Aborting. Please handle the existing branch manually."
        exit 1
    fi
fi

git checkout -b $INTEGRATION_BRANCH
print_success "Created and switched to branch: $INTEGRATION_BRANCH"

# Step 2: Get baseline linting status
print_status "Getting baseline linting status..."
echo "Running npm run lint to get current error count..."
BASELINE_OUTPUT=$(npm run lint 2>&1 || true)
BASELINE_ERRORS=$(echo "$BASELINE_OUTPUT" | grep -o '[0-9]\+ errors' | grep -o '[0-9]\+' || echo "0")
BASELINE_WARNINGS=$(echo "$BASELINE_OUTPUT" | grep -o '[0-9]\+ warnings' | grep -o '[0-9]\+' || echo "0")

print_status "Baseline: $BASELINE_ERRORS errors, $BASELINE_WARNINGS warnings"

# Step 3: Cherry-pick TypeScript fixes
print_status "Cherry-picking TypeScript fixes from fix/typescript-strict-mode..."

# Array of commits to cherry-pick (in reverse chronological order for proper application)
COMMITS=(
    "cc247ab"  # TypeScript strict mode improvements - reduced linting errors from 798 to 774
    "4429ead"  # improve TypeScript types in enhanced-dashboard.ts
    "acf7ac4"  # improve TypeScript types in invitation-repository.ts
    "dfa4be1"  # improve TypeScript types in validation.ts
)

SUCCESSFUL_PICKS=0
FAILED_PICKS=0

for commit in "${COMMITS[@]}"; do
    print_status "Cherry-picking commit: $commit"
    
    # Get commit message for context
    COMMIT_MSG=$(git log --format="%s" -n 1 $commit 2>/dev/null || echo "Unknown commit")
    print_status "  Message: $COMMIT_MSG"
    
    if git cherry-pick $commit; then
        print_success "  ✓ Successfully cherry-picked $commit"
        ((SUCCESSFUL_PICKS++))
    else
        print_error "  ✗ Failed to cherry-pick $commit"
        print_warning "  Conflict detected. You may need to resolve manually."
        
        # Check if there are conflicts
        if git status --porcelain | grep -q "^UU\|^AA\|^DD"; then
            print_status "  Conflicts found in:"
            git status --porcelain | grep "^UU\|^AA\|^DD" | sed 's/^/    /'
            
            read -p "Do you want to abort this cherry-pick and continue with others? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                git cherry-pick --abort
                print_warning "  Aborted cherry-pick for $commit"
            else
                print_status "  Please resolve conflicts manually, then run:"
                echo "    git add <resolved-files>"
                echo "    git cherry-pick --continue"
                echo "    Then re-run this script or continue manually"
                exit 1
            fi
        fi
        ((FAILED_PICKS++))
    fi
done

# Step 4: Apply automatic fixes
print_status "Applying automatic TypeScript fixes..."
if npm run lint:fix; then
    print_success "Applied automatic fixes"
else
    print_warning "Some automatic fixes may have failed"
fi

# Step 5: Check improvement
print_status "Checking improvement after cherry-picking..."
AFTER_OUTPUT=$(npm run lint 2>&1 || true)
AFTER_ERRORS=$(echo "$AFTER_OUTPUT" | grep -o '[0-9]\+ errors' | grep -o '[0-9]\+' || echo "0")
AFTER_WARNINGS=$(echo "$AFTER_OUTPUT" | grep -o '[0-9]\+ warnings' | grep -o '[0-9]\+' || echo "0")

print_status "After cherry-picking: $AFTER_ERRORS errors, $AFTER_WARNINGS warnings"

# Calculate improvement
ERROR_REDUCTION=$((BASELINE_ERRORS - AFTER_ERRORS))
WARNING_CHANGE=$((BASELINE_WARNINGS - AFTER_WARNINGS))

print_status "Improvement Summary:"
echo "  Errors: $BASELINE_ERRORS → $AFTER_ERRORS (reduction: $ERROR_REDUCTION)"
echo "  Warnings: $BASELINE_WARNINGS → $AFTER_WARNINGS (change: $WARNING_CHANGE)"

# Step 6: Test TypeScript compilation
print_status "Testing TypeScript compilation..."
cd infrastructure
if npm run build; then
    print_success "TypeScript compilation successful"
else
    print_error "TypeScript compilation failed"
    cd ..
    exit 1
fi
cd ..

# Step 7: Summary and next steps
echo ""
print_success "Phase 1 Complete!"
echo "=================="
echo "Cherry-pick Results:"
echo "  Successful: $SUCCESSFUL_PICKS"
echo "  Failed: $FAILED_PICKS"
echo ""
echo "Linting Improvement:"
echo "  Error reduction: $ERROR_REDUCTION"
echo "  Current errors: $AFTER_ERRORS"
echo "  Target: <50 errors"
echo ""

if [ $AFTER_ERRORS -lt 50 ]; then
    print_success "🎉 Target achieved! Errors are now below 50."
else
    REMAINING=$((AFTER_ERRORS - 50))
    print_status "📋 Still need to fix $REMAINING more errors to reach target."
fi

echo ""
print_status "Next Steps:"
echo "1. Review the changes: git log --oneline"
echo "2. Test critical endpoints: npm run test:api"
echo "3. If satisfied, proceed to Phase 2 manual fixes"
echo "4. Or continue with additional targeted fixes"
echo ""
print_status "Current branch: $(git branch --show-current)"
print_status "To return to original branch: git checkout feature/custom-domain-dev" 