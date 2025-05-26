#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Build OpenAPI JSON from YAML source
 * This script converts the OpenAPI YAML specification to JSON format
 * and updates server URLs based on the deployment environment
 */

function buildOpenApiSpec() {
  try {
    // Read the OpenAPI YAML file
    const yamlPath = path.join(__dirname, '../docs/openapi.yaml');
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    
    // Parse YAML to JavaScript object
    const openApiSpec = yaml.load(yamlContent);
    
    // Get environment from command line arguments or default to 'dev'
    const stage = process.argv[2] || 'dev';
    const apiGatewayUrl = process.argv[3] || 'https://0z6kxagbh2.execute-api.us-east-1.amazonaws.com/dev';
    
    // Update server URLs based on environment
    openApiSpec.servers = [
      {
        url: apiGatewayUrl,
        description: stage === 'prod' ? 'Production server' : 'Development server'
      }
    ];
    
    // Add environment-specific information
    openApiSpec.info.version = `1.0.0-${stage}`;
    openApiSpec.info.description += `\n\n**Environment:** ${stage.toUpperCase()}`;
    
    // Ensure output directory exists
    const outputDir = path.join(__dirname, '../docs/swagger-ui');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write JSON file
    const jsonPath = path.join(outputDir, 'openapi.json');
    fs.writeFileSync(jsonPath, JSON.stringify(openApiSpec, null, 2));
    
    console.log(`✅ OpenAPI specification built successfully!`);
    console.log(`📁 Output: ${jsonPath}`);
    console.log(`🌐 Environment: ${stage}`);
    console.log(`🔗 API URL: ${apiGatewayUrl}`);
    
    return openApiSpec;
    
  } catch (error) {
    console.error('❌ Error building OpenAPI specification:', error.message);
    process.exit(1);
  }
}

// Run the build if this script is executed directly
if (require.main === module) {
  buildOpenApiSpec();
}

module.exports = { buildOpenApiSpec }; 