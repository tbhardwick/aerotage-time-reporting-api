# Documentation Workflow Guide

## 🚀 Overview

This guide explains the automated documentation workflow for the Aerotage Time Reporting API. After implementing new API endpoints, the documentation must be updated to ensure consistency and accuracy.

## 📋 Quick Start

After implementing new API endpoints, simply run:

```bash
npm run update:docs
```

This single command handles the entire documentation update process automatically.

## 🔄 Automated Workflow

### What the Script Does

The `npm run update:docs` command runs `scripts/update-documentation.js` which:

1. **🔍 Detects Changes**: Automatically scans git diff for new API endpoints
2. **📄 Validates Spec**: Checks OpenAPI YAML syntax and structure
3. **🔨 Builds Documentation**: Converts YAML to JSON specification
4. **🚀 Deploys**: Updates CloudFront distribution with new documentation
5. **📝 Updates Rules**: Refreshes project rules with current URLs
6. **💾 Commits**: Automatically commits documentation changes

### Benefits

- ✅ **Consistency**: Ensures all new endpoints are documented
- ✅ **Automation**: Reduces manual work and human error
- ✅ **Validation**: Catches YAML syntax errors before deployment
- ✅ **Integration**: Seamlessly integrates with development workflow
- ✅ **Tracking**: Automatically commits changes with descriptive messages

## 📚 Available Commands

### Primary Commands

```bash
# Full automated update process
npm run update:docs

# Only validate OpenAPI specification (no deployment)
npm run validate:docs

# Build JSON specification from YAML (no deployment)
npm run build:docs
```

### Advanced Usage

```bash
# Show help and options
node scripts/update-documentation.js --help

# Validate only (same as npm run validate:docs)
node scripts/update-documentation.js --validate

# Force deploy even if no changes detected
node scripts/update-documentation.js --deploy
```

## 📝 Manual Process (When Needed)

If you need to manually update documentation:

### 1. Edit OpenAPI Specification

Edit `docs/openapi.yaml` to add new endpoints:

```yaml
paths:
  /your-new-endpoint:
    post:
      tags:
        - Your Feature
      summary: Brief description
      description: Detailed description
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/YourSchema'
      responses:
        '201':
          description: Success response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/YourResponse'
```

### 2. Add Schemas

Define request/response schemas in the `components/schemas` section:

```yaml
components:
  schemas:
    YourSchema:
      type: object
      required:
        - field1
        - field2
      properties:
        field1:
          type: string
          description: Description of field1
        field2:
          type: integer
          description: Description of field2
```

### 3. Validate and Deploy

```bash
# Validate the specification
npm run validate:docs

# Build and deploy
npm run update:docs
```

## 🎯 Best Practices

### When Implementing New Phases

1. **Plan Documentation First**: Design your API documentation alongside your endpoints
2. **Use Consistent Patterns**: Follow existing patterns for similar endpoints
3. **Include Examples**: Provide realistic request/response examples
4. **Add Descriptions**: Write clear, helpful descriptions for all fields
5. **Tag Appropriately**: Use consistent tags for endpoint organization
6. **Test Documentation**: Use the live Swagger UI to test your endpoints

### OpenAPI Specification Guidelines

#### Endpoint Documentation
- **Summary**: Brief, action-oriented description (e.g., "Create time entry")
- **Description**: Detailed explanation of what the endpoint does
- **Parameters**: Document all path, query, and header parameters
- **Request Body**: Include schema references and examples
- **Responses**: Document all possible response codes and schemas

#### Schema Design
- **Required Fields**: Clearly mark required vs optional fields
- **Field Descriptions**: Explain what each field represents
- **Data Types**: Use appropriate types (string, integer, boolean, etc.)
- **Validation**: Include format, minimum/maximum, enum values
- **Examples**: Provide realistic example values

#### Error Handling
- **Standard Errors**: Use consistent error response format
- **Error Codes**: Document specific error codes and meanings
- **Status Codes**: Use appropriate HTTP status codes

## 🔧 Troubleshooting

### Common Issues

#### YAML Syntax Errors
```bash
# Error: bad indentation of a mapping entry
```
**Solution**: Check YAML indentation (use spaces, not tabs)

#### Validation Failures
```bash
# Error: OpenAPI validation failed
```
**Solution**: Run `npm run validate:docs` to see specific errors

#### Deployment Issues
```bash
# Error: Stack does not exist
```
**Solution**: Ensure the documentation stack is deployed first

### Getting Help

1. **Check Logs**: The script provides detailed error messages
2. **Validate First**: Always run `npm run validate:docs` before deploying
3. **Manual Fallback**: Use the manual process if automation fails
4. **Review Examples**: Look at existing endpoints for patterns

## 📊 Integration with Development Workflow

### Phase Implementation Checklist

When implementing a new phase (e.g., Phase 5: Project Management):

- [ ] **Implement Lambda Functions**: Create the actual API endpoints
- [ ] **Update OpenAPI Spec**: Add all new endpoints to `docs/openapi.yaml`
- [ ] **Add Schemas**: Define all request/response schemas
- [ ] **Run Documentation Update**: `npm run update:docs`
- [ ] **Test in Swagger UI**: Verify documentation is correct and functional
- [ ] **Update Integration Guides**: Update frontend integration documentation
- [ ] **Commit Changes**: Ensure all documentation changes are committed

### Git Workflow Integration

The documentation update process integrates seamlessly with your git workflow:

1. **Feature Branch**: Create branch for new phase
2. **Implement Endpoints**: Code the Lambda functions and API Gateway integration
3. **Update Documentation**: Edit OpenAPI spec and run `npm run update:docs`
4. **Test**: Verify endpoints work and documentation is accurate
5. **Commit**: All changes (code + docs) are committed together
6. **Pull Request**: Review includes both implementation and documentation

## 🌐 Live Documentation

### Current URLs

- **Development**: https://djfreip4iwrq0.cloudfront.net
- **Staging**: (Will be available when staging is deployed)
- **Production**: (Will be available when production is deployed)

### Features

- **Interactive Testing**: Test endpoints directly in the browser
- **Authentication Support**: Built-in JWT token authentication
- **Real-time Updates**: Documentation updates automatically via CloudFront
- **Mobile Responsive**: Works on all devices
- **Search Functionality**: Find endpoints quickly
- **Code Examples**: Copy-paste ready code samples

## 🚀 Future Enhancements

### Planned Improvements

1. **Automatic Schema Generation**: Generate schemas from TypeScript interfaces
2. **API Testing Integration**: Automated testing against live documentation
3. **Version Management**: Support for multiple API versions
4. **Custom Domain**: Move to `docs.aerotage.com` for production
5. **Analytics**: Track documentation usage and popular endpoints

### Contributing

To improve the documentation workflow:

1. **Suggest Improvements**: Create issues for workflow enhancements
2. **Update Scripts**: Improve the automation scripts
3. **Add Templates**: Create templates for common endpoint patterns
4. **Enhance Validation**: Add more comprehensive validation rules

---

**Remember**: Good documentation is as important as good code. Keep it updated, accurate, and helpful! 📚✨ 