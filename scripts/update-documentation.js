#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  OPENAPI_FILE: 'docs/openapi.yaml',
  BUILD_SCRIPT: 'scripts/build-openapi.js',
  API_BASE_URL: 'https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev/',
  DOCUMENTATION_STACK: 'AerotageDocumentation-dev',
  STAGE: 'dev'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  try {
    log(`🔄 ${description}...`, 'blue');
    const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    log(`✅ ${description} completed`, 'green');
    return result;
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, 'red');
    throw error;
  }
}

function checkOpenAPIFile() {
  if (!fs.existsSync(CONFIG.OPENAPI_FILE)) {
    throw new Error(`OpenAPI file not found: ${CONFIG.OPENAPI_FILE}`);
  }
  log(`📄 OpenAPI file found: ${CONFIG.OPENAPI_FILE}`, 'green');
}

function validateOpenAPISpec() {
  try {
    execCommand(`node ${CONFIG.BUILD_SCRIPT} ${CONFIG.STAGE} ${CONFIG.API_BASE_URL}`, 'Validating OpenAPI specification');
    return true;
  } catch (error) {
    log('❌ OpenAPI validation failed. Please fix the YAML syntax errors.', 'red');
    return false;
  }
}

function deployDocumentation() {
  const deployCommand = `cd infrastructure && STAGE=${CONFIG.STAGE} cdk deploy ${CONFIG.DOCUMENTATION_STACK} --require-approval never --progress events`;
  execCommand(deployCommand, 'Deploying documentation to CloudFront');
}

function getDocumentationUrl() {
  try {
    const output = execSync(`cd infrastructure && aws cloudformation describe-stacks --stack-name ${CONFIG.DOCUMENTATION_STACK} --query 'Stacks[0].Outputs[?OutputKey==\`DocumentationUrl\`].OutputValue' --output text`, { encoding: 'utf8' });
    return output.trim();
  } catch (error) {
    log('⚠️  Could not retrieve documentation URL', 'yellow');
    return 'https://d1g30r0bcfgd1s.cloudfront.net';
  }
}

function checkForNewEndpoints() {
  try {
    // Check git diff for new API endpoints in the API stack
    const gitDiff = execSync('git diff HEAD~1 infrastructure/lib/api-stack.ts', { encoding: 'utf8' });
    const newEndpoints = [];
    
    // Look for new API Gateway resources
    const endpointRegex = /\+.*\.addMethod\(['"](\w+)['"],.*\)/g;
    let match;
    while ((match = endpointRegex.exec(gitDiff)) !== null) {
      newEndpoints.push(match[1]);
    }
    
    if (newEndpoints.length > 0) {
      log(`🆕 Detected new endpoints: ${newEndpoints.join(', ')}`, 'cyan');
      return newEndpoints;
    }
    
    return [];
  } catch (error) {
    log('ℹ️  Could not detect new endpoints automatically', 'yellow');
    return [];
  }
}

function updateProjectRules() {
  const rulesFile = '.cursor/rules/aerotage-api-project-rule.mdc';
  if (fs.existsSync(rulesFile)) {
    const content = fs.readFileSync(rulesFile, 'utf8');
    const updatedContent = content.replace(
      /- \*\*Interactive API Docs\*\*: `https:\/\/[^`]+`/,
      `- **Interactive API Docs**: \`${getDocumentationUrl()}\``
    );
    fs.writeFileSync(rulesFile, updatedContent);
    log('📝 Updated project rules with current documentation URL', 'green');
  }
}

function generateCommitMessage(newEndpoints) {
  const baseMessage = 'docs: update API documentation';
  if (newEndpoints.length > 0) {
    return `${baseMessage} - Added documentation for new endpoints: ${newEndpoints.join(', ')} - Updated OpenAPI specification and deployed to CloudFront - Documentation available at: ${getDocumentationUrl()}`;
  }
  return `${baseMessage} - Updated OpenAPI specification and deployed to CloudFront - Documentation available at: ${getDocumentationUrl()}`;
}

function main() {
  log('🚀 Starting documentation update process...', 'bright');
  
  try {
    // Check if we're in the right directory
    if (!fs.existsSync('infrastructure') || !fs.existsSync('docs')) {
      throw new Error('Please run this script from the project root directory');
    }
    
    // Detect new endpoints
    const newEndpoints = checkForNewEndpoints();
    
    // Check OpenAPI file exists
    checkOpenAPIFile();
    
    // Validate OpenAPI specification
    if (!validateOpenAPISpec()) {
      process.exit(1);
    }
    
    // Deploy documentation
    deployDocumentation();
    
    // Update project rules
    updateProjectRules();
    
    // Get documentation URL
    const docUrl = getDocumentationUrl();
    
    // Commit changes if there are any
    try {
      execCommand('git add docs/', 'Staging documentation changes');
      const commitMessage = generateCommitMessage(newEndpoints);
      execCommand(`git commit -m "${commitMessage}"`, 'Committing documentation updates');
    } catch (error) {
      log('ℹ️  No documentation changes to commit', 'yellow');
    }
    
    // Success summary
    log('\n🎉 Documentation update completed successfully!', 'green');
    log(`📖 Documentation URL: ${docUrl}`, 'cyan');
    log('✨ The documentation is now live and up-to-date', 'green');
    
    if (newEndpoints.length > 0) {
      log(`\n📋 Next steps for new endpoints:`, 'yellow');
      log(`   1. Review the documentation at ${docUrl}`, 'yellow');
      log(`   2. Test the new endpoints in the Swagger UI`, 'yellow');
      log(`   3. Update any integration guides if needed`, 'yellow');
    }
    
  } catch (error) {
    log(`\n💥 Documentation update failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📚 Aerotage API Documentation Updater

Usage: node scripts/update-documentation.js [options]

Options:
  --help, -h     Show this help message
  --validate     Only validate OpenAPI spec without deploying
  --deploy       Force deploy even if no changes detected

Description:
  This script automates the process of updating API documentation:
  1. Detects new API endpoints from git changes
  2. Validates the OpenAPI specification
  3. Builds the JSON specification
  4. Deploys updated documentation to CloudFront
  5. Updates project rules with current URLs
  6. Commits documentation changes

Examples:
  node scripts/update-documentation.js           # Full update process
  node scripts/update-documentation.js --validate # Only validate spec
  node scripts/update-documentation.js --deploy   # Force deploy
  `);
  process.exit(0);
}

if (args.includes('--validate')) {
  log('🔍 Validation mode: Only checking OpenAPI specification...', 'blue');
  checkOpenAPIFile();
  if (validateOpenAPISpec()) {
    log('✅ OpenAPI specification is valid!', 'green');
  } else {
    process.exit(1);
  }
} else {
  main();
} 