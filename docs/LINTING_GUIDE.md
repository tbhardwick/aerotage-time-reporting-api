# Aerotage Time Reporting API - Linting Guide

## 📋 **Overview**

This document provides comprehensive guidance for code quality and linting standards in the Aerotage Time Reporting API backend repository. Our linting configuration is specifically optimized for AWS serverless backend development.

## 🛠️ **ESLint Configuration**

### **Technology Stack**
- **ESLint**: v9.27.0 with flat config format
- **TypeScript Parser**: @typescript-eslint/parser v8.32.1
- **TypeScript Plugin**: @typescript-eslint/eslint-plugin v8.32.1
- **Base Config**: @eslint/js recommended rules

### **Configuration File Structure**

The main configuration is in `eslint.config.js` (ESLint v9 flat config format):

```javascript
// eslint.config.js
const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  // Global ignores
  // Base TypeScript configuration
  // Lambda function specific rules
  // CDK Infrastructure specific rules
  // Test file specific rules
];
```

## 🎯 **Rule Categories**

### **1. Global Rules (All TypeScript Files)**

#### **TypeScript-Specific Rules**
- `@typescript-eslint/explicit-function-return-type`: `warn` - Encourages explicit return types
- `@typescript-eslint/no-explicit-any`: `error` - Prevents use of `any` type
- `@typescript-eslint/no-unused-vars`: `error` - Catches unused variables
- `@typescript-eslint/no-floating-promises`: `error` - Ensures Promise handling
- `@typescript-eslint/await-thenable`: `error` - Validates await usage

#### **Code Quality Rules**
- `no-console`: `warn` - Allows console.log but warns about it
- `no-debugger`: `error` - Prevents debugger statements
- `prefer-const`: `error` - Enforces const for non-reassigned variables
- `no-var`: `error` - Prevents use of var keyword
- `object-shorthand`: `error` - Enforces object method shorthand

#### **Security Rules**
- `no-eval`: `error` - Prevents eval() usage
- `no-implied-eval`: `error` - Prevents implied eval
- `no-new-func`: `error` - Prevents Function constructor

#### **Performance Rules**
- `no-sync`: `warn` - Discourages synchronous methods (important for Lambda)
- `no-loop-func`: `error` - Prevents function creation in loops

### **2. Lambda Function Rules** (`infrastructure/lambda/**/*.ts`, `src/handlers/**/*.ts`)

Lambda functions have stricter rules for production reliability:

```javascript
{
  files: ['infrastructure/lambda/**/*.ts', 'src/handlers/**/*.ts'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'error', // Required
    'no-console': 'warn', // Allowed for CloudWatch logging
  }
}
```

**Rationale**: Lambda functions are production code that needs explicit typing and proper error handling.

### **3. CDK Infrastructure Rules** (`infrastructure/lib/**/*.ts`, `infrastructure/bin/**/*.ts`)

CDK files have relaxed rules for infrastructure patterns:

```javascript
{
  files: ['infrastructure/lib/**/*.ts', 'infrastructure/bin/**/*.ts'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'off', // Allowed for deployment output
  }
}
```

**Rationale**: CDK often requires unused parameters (like scope, id) and console output for deployment feedback.

### **4. Test File Rules** (`**/*.test.ts`, `**/*.spec.ts`, `tests/**/*.ts`)

Test files have the most relaxed rules:

```javascript
{
  files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'no-console': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
  }
}
```

**Rationale**: Tests often need flexible typing and console output for debugging.

## 🚫 **Ignored Files & Patterns**

The linter automatically ignores:

### **Build Artifacts**
- `dist/` - Compiled TypeScript output
- `cdk.out/` - CDK CloudFormation output
- `*.js` - Compiled JavaScript files
- `*.d.ts` - TypeScript declaration files
- `coverage/` - Test coverage reports

### **Dependencies**
- `node_modules/` - Package dependencies
- `infrastructure/node_modules/` - CDK dependencies

### **CDK Assets**
- `**/asset.*/**` - CDK asset bundles
- `infrastructure/cdk.out/**` - CDK deployment artifacts
- `infrastructure/dist/**` - CDK build output

### **Frontend Protection**
The linter prevents frontend code from being added to this backend repository:
- `src/components/` - React components
- `src/renderer/` - Electron renderer code
- `public/` - Static assets
- `build/` - Frontend build output
- `electron/` - Electron-specific code
- `*.html`, `*.css`, `*.scss`, `*.sass` - Frontend files

## 📋 **Available Linting Commands**

### **Basic Commands**

```bash
# Standard linting - shows all issues
npm run lint

# Auto-fix issues where possible
npm run lint:fix

# Strict mode - fails on ANY warnings (use in CI/CD)
npm run lint:check

# User-friendly summary with context
npm run lint:summary
```

### **Example Output**

```bash
$ npm run lint:summary

Running ESLint...

/infrastructure/lambda/users/create.ts
   5:5  warning  Unexpected console statement  no-console
  18:5  warning  Unexpected console statement  no-console

✖ 70 problems (0 errors, 70 warnings)

✅ Linting complete! Only warnings remain (console.log in Lambda functions is acceptable for logging)
```

## 🔧 **IDE Integration**

### **Visual Studio Code**

Create `.vscode/settings.json`:

```json
{
  "eslint.enable": true,
  "eslint.format.enable": true,
  "eslint.validate": ["typescript"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "dbaeumer.vscode-eslint"
}
```

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "amazonwebservices.aws-toolkit-vscode"
  ]
}
```

### **WebStorm/IntelliJ IDEA**

1. Go to **File** → **Settings** → **Languages & Frameworks** → **JavaScript** → **Code Quality Tools** → **ESLint**
2. Enable **Automatic ESLint configuration**
3. Set **Configuration file** to use flat config format
4. Enable **Run eslint --fix on save**
5. Set **Node interpreter** to project Node.js version

### **Vim/Neovim**

For Vim users with ALE:

```vim
" .vimrc or init.vim
let g:ale_linters = {
\   'typescript': ['eslint'],
\}
let g:ale_fixers = {
\   'typescript': ['eslint'],
\}
let g:ale_fix_on_save = 1
```

## 🚀 **Development Workflow**

### **Pre-Commit Workflow**

```bash
# 1. Write your code
vim infrastructure/lambda/new-feature/handler.ts

# 2. Fix obvious issues automatically
npm run lint:fix

# 3. Check for remaining issues
npm run lint

# 4. Run tests
npm run test

# 5. Build to ensure TypeScript compilation
npm run build

# 6. Commit your changes
git add .
git commit -m "feat: add new feature handler"
```

### **Pull Request Workflow**

```bash
# Before creating PR
npm run lint:check          # Ensure no warnings in CI mode
npm run test:coverage       # Ensure test coverage
npm run build               # Verify compilation

# Create PR with clean code
git push origin feature/new-feature
```

### **CI/CD Integration**

Example GitHub Actions workflow:

```yaml
name: Code Quality

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint:check    # Fail on any warnings
      - run: npm run test:coverage
      - run: npm run build
```

## 🎯 **Best Practices**

### **Writing Lambda Functions**

✅ **Good Example**:
```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Processing request:', JSON.stringify(event)); // OK: CloudWatch logging
    
    // Business logic here
    const result = await processRequest(event);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: true, data: result })
    };
  } catch (error: unknown) {
    console.error('Handler error:', error); // OK: Error logging
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

const processRequest = async (event: APIGatewayProxyEvent): Promise<unknown> => {
  // Implementation
  return {};
};
```

❌ **Bad Example**:
```typescript
// Missing return type annotation
export const handler = async (event) => {
  // No error handling
  const result = someAsyncOperation(); // Missing await
  
  return {
    statusCode: 200,
    body: result // Should be JSON.stringify()
  };
};
```

### **Writing CDK Code**

✅ **Good Example**:
```typescript
export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    
    console.log(`Deploying API stack for stage: ${props.stage}`); // OK: Deployment info
    
    // Unused parameter with underscore prefix
    const createFunction = (_name: string, handler: string): lambda.Function => {
      return new lambda.Function(this, 'Function', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler,
        code: lambda.Code.fromAsset('lambda')
      });
    };
  }
}
```

### **Common Issues & Solutions**

#### **Issue 1: Floating Promises**
```typescript
// ❌ Bad: Floating promise
someAsyncFunction();

// ✅ Good: Properly awaited
await someAsyncFunction();

// ✅ Good: Explicitly ignored
void someAsyncFunction();
```

#### **Issue 2: Any Types**
```typescript
// ❌ Bad: Using any
const data: any = getApiResponse();

// ✅ Good: Proper typing
interface ApiResponse {
  id: string;
  name: string;
}
const data: ApiResponse = getApiResponse();
```

#### **Issue 3: Console Statements in Non-Lambda Code**
```typescript
// ❌ Bad: Console in regular code
const processData = (input: string): string => {
  console.log('Processing:', input); // Should use proper logging
  return input.toUpperCase();
};

// ✅ Good: Use structured logging
import { logger } from '../utils/logger';

const processData = (input: string): string => {
  logger.info('Processing data', { input });
  return input.toUpperCase();
};
```

## 🔍 **Troubleshooting**

### **Common ESLint Issues**

#### **Error: "Cannot find module '@typescript-eslint/parser'"**
```bash
# Reinstall dependencies
npm install
cd infrastructure && npm install
```

#### **Error: "Parsing error: ESLint configuration is invalid"**
```bash
# Check ESLint version
npm list eslint

# Ensure using v9+
npm install eslint@^9.27.0
```

#### **Too Many Console Warnings**
If you have too many console warnings, consider:
1. Using structured logging instead of console.log
2. Removing debug console statements
3. Using the `lint:fix` command to identify fixable issues

#### **TypeScript Compilation Errors in ESLint**
```bash
# Ensure TypeScript project is properly configured
npm run build

# Check tsconfig.json paths in eslint.config.js
```

### **Performance Issues**

If linting is slow:
1. Check if you have too many files in included directories
2. Ensure build artifacts are properly ignored
3. Consider running on specific directories:
   ```bash
   npx eslint infrastructure/lambda/**/*.ts
   ```

## 📚 **Additional Resources**

- [ESLint v9 Flat Config Documentation](https://eslint.org/docs/latest/use/configure/configuration-files-new)
- [TypeScript ESLint Rules](https://typescript-eslint.io/rules/)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [AWS CDK Best Practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)

---

**📝 Note**: This linting configuration is specifically designed for backend AWS serverless development. It enforces patterns that work well with Lambda functions, CDK infrastructure, and TypeScript best practices while preventing frontend code from being accidentally added to this repository. 