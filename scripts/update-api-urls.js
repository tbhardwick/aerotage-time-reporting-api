#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const OLD_URL = 'https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev';
const NEW_URL = 'https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev';

// Files to update (relative to project root)
const FILES_TO_UPDATE = [
  'infrastructure/lib/api-stack.ts',
  'infrastructure/package.json',
  'test-simple-curl.sh',
  'docs/OPENAPI_DOCUMENTATION.md',
  '.cursor/rules/aerotage-api-project-rule.mdc',
  'docs/openapi.yaml',
  '.cursor/rules/frontend-integration-support.mdc',
  'README.md',
  'docs/DEPLOYMENT_GUIDE.md',
  'docs/swagger-ui/openapi.json',
  'docs/FRONTEND_INTEGRATION_GUIDE.md',
  'docs/swagger-ui/index.html',
  'docs/PROJECT_STATUS.md',
  'docs/TROUBLESHOOTING.md',
  'docs/API_REFERENCE.md'
];

function getCurrentApiUrl() {
  try {
    // Get the current API URL from CloudFormation
    const result = execSync(
      `aws cloudformation describe-stacks --stack-name AerotageAPI-dev --query 'Stacks[0].Outputs[?OutputKey==\`AerotageTimeApiEndpoint7C136A20\`].OutputValue' --output text`,
      { encoding: 'utf8' }
    ).trim();
    
    if (result && result !== 'None' && !result.includes('error')) {
      return result;
    }
  } catch (error) {
    console.log('Could not get URL from CloudFormation, using hardcoded value');
  }
  
  return NEW_URL;
}

function updateFile(filePath, oldUrl, newUrl) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const updatedContent = content.replace(new RegExp(oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newUrl);
    
    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
      return true;
    } else {
      console.log(`📝 No changes needed: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

function updateOpenApiDocs(newUrl) {
  try {
    // Rebuild OpenAPI documentation with new URL
    const buildScript = path.join(__dirname, 'build-openapi.js');
    if (fs.existsSync(buildScript)) {
      console.log('🔄 Rebuilding OpenAPI documentation...');
      execSync(`node ${buildScript} dev ${newUrl}`, { stdio: 'inherit' });
      console.log('✅ OpenAPI documentation rebuilt');
    }
  } catch (error) {
    console.error('❌ Error rebuilding OpenAPI docs:', error.message);
  }
}

function main() {
  console.log('🔄 Updating API URLs in documentation...');
  console.log(`📍 Old URL: ${OLD_URL}`);
  
  // Check for custom domain argument
  const args = process.argv.slice(2);
  const domainFlag = args.findIndex(arg => arg === '--domain');
  let currentUrl;
  
  if (domainFlag !== -1 && args[domainFlag + 1]) {
    // Use custom domain if provided
    const customDomain = args[domainFlag + 1];
    currentUrl = customDomain.startsWith('https://') ? customDomain : `https://${customDomain}`;
    console.log(`📍 Using custom domain: ${currentUrl}`);
  } else {
    // Get current API URL from CloudFormation
    currentUrl = getCurrentApiUrl();
    console.log(`📍 New URL: ${currentUrl}`);
  }
  
  if (currentUrl === OLD_URL) {
    console.log('✅ URLs are already up to date');
    return;
  }

  let updatedCount = 0;
  const projectRoot = path.resolve(__dirname, '..');

  // Update all files
  FILES_TO_UPDATE.forEach(relativePath => {
    const fullPath = path.join(projectRoot, relativePath);
    if (updateFile(fullPath, OLD_URL, currentUrl)) {
      updatedCount++;
    }
  });

  // Rebuild OpenAPI documentation
  updateOpenApiDocs(currentUrl);

  console.log(`\n📊 Summary: Updated ${updatedCount} files`);
  console.log('🎉 API URL update complete!');
  
  // Show next steps
  console.log('\n📋 Next steps:');
  console.log('1. Review the changes: git diff');
  console.log('2. Test the updated URLs');
  console.log('3. Commit the changes: git add . && git commit -m "docs: update API URLs to current endpoint"');
}

if (require.main === module) {
  main();
}

module.exports = { updateFile, getCurrentApiUrl }; 