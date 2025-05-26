# Aerotage Time Reporting Application - Development Plan

## Project Overview

**Company**: Aerotage Design Group, Inc  
**Application Type**: Desktop Time Tracking & Billing Application  
**Target Platforms**: macOS and Windows  
**Architecture**: Electron Desktop App + AWS Serverless Backend  
**Similar Applications**: HarvestApp, Toggl, Clockify, FreshBooks Time Tracking

## 1. Application Architecture

### Frontend (Electron Desktop App)
- **Framework**: Electron with modern web technologies
- **UI Framework**: React with TypeScript
- **State Management**: React Context API with useReducer
- **Styling**: Tailwind CSS + Headless UI components
- **Charts/Reports**: Chart.js or Recharts
- **Date/Time**: date-fns or Day.js
- **Forms**: React Hook Form with Zod validation

### Backend (AWS Serverless)
- **Authentication**: AWS Cognito
- **API**: AWS API Gateway + Lambda Functions
- **Database**: Amazon DynamoDB
- **File Storage**: Amazon S3 (for invoices, reports)
- **Email**: Amazon SES (for notifications, invoices)
- **Infrastructure**: AWS CDK or Terraform

## 2. Core Features & Modules

### 2.1 Authentication & User Management
- **Login/Logout** with AWS Cognito
- **Multi-factor Authentication** (MFA)
- **Password Reset** functionality ✅ COMPLETED
- **User Roles**: Admin, Manager, Employee
- **Team Management** (assign users to teams)

#### Password Reset Implementation ✅ COMPLETED
- **Frontend Implementation**: Complete email-based password reset flow
- **AWS Cognito Integration**: resetPassword and confirmResetPassword functions
- **Security Features**: No user existence revelation, 15-minute code expiration
- **UX Enhancements**: Automatic focus management, clear instructions
- **Error Handling**: Comprehensive security-compliant error messaging
- **Testing Utilities**: Browser console testing functions available

### 2.2 User Management & Administration ✅ ENHANCED
- **User Profile Management** (personal info, contact details, hourly rates)
- **User Creation & Onboarding** (admin-only functionality)
- **Role Assignment & Permissions** (Admin, Manager, Employee with granular permissions)
- **Team Structure Management** (create teams, assign managers, add/remove members)
- **User Status Management** (active/inactive/suspended users)
- **Permission Matrix** (role-based access control for all features)
- **User Activity Monitoring** (login history, last activity tracking)
- **Bulk User Operations** (bulk import, export, status updates)

### 2.2 Time Tracking ✅ COMPLETED
- **Timer Interface** (start/stop/pause) ✅
- **Manual Time Entry** (add time retroactively) ✅
- **Time Categories** (billable/non-billable) ✅
- **Project Selection** dropdown ✅
- **Task Description** text field ✅
- **Daily/Weekly Time Sheets** ✅
- **Time Approval Workflow** (submit → review → approve) 🚧

### 2.3 Client & Project Management
- **Client Accounts** (company info, billing details)
- **Project Creation** (linked to clients)
- **Project Budgets** (time/cost limits)
- **Project Status** (active/inactive/completed)
- **Hourly Rates** (per project, per user, or global)

### 2.4 Team Management & User Administration
- **User Profiles** (contact info, hourly rates, department assignment)
- **Team Creation & Management** (hierarchical team structure)
- **Manager Assignment** (team leads with approval permissions)
- **User Onboarding Workflow** (account creation, initial setup)
- **Permission Management** (granular view/edit access by role)
- **Manager Dashboard** (team time overview, user performance metrics)
- **User Directory** (searchable company directory with contact info)
- **Deactivation & Offboarding** (secure user removal process)

### 2.5 Reporting & Analytics
- **Time Reports** (by user, project, date range)
- **Productivity Analytics** (hours per day/week)
- **Project Profitability** reports
- **Billable vs Non-billable** breakdowns
- **Export Options** (PDF, CSV, Excel)

### 2.6 Invoicing & Billing
- **Invoice Generation** (from approved time entries)
- **Invoice Templates** (customizable)
- **Invoice Status** (draft, sent, paid)
- **Payment Tracking**
- **Recurring Invoices** (for retainer clients)

## 3. React Context State Management

### Current Implementation ✅
```typescript
// AppContext.tsx - Centralized state management
interface AppState {
  timeEntries: TimeEntry[];
  projects: Project[];
  timer: TimerState;
  user: User | null;
}

type AppAction = 
  | { type: 'ADD_TIME_ENTRY'; payload: Omit<TimeEntry, 'id' | 'createdAt'> }
  | { type: 'UPDATE_TIME_ENTRY'; payload: { id: string; updates: Partial<TimeEntry> } }
  | { type: 'DELETE_TIME_ENTRY'; payload: string }
  | { type: 'START_TIMER'; payload: { projectId: string; description: string } }
  | { type: 'STOP_TIMER' }
  | { type: 'UPDATE_TIMER_TIME'; payload: number }
  | { type: 'SET_USER'; payload: AppState['user'] };
```

### Enhanced Implementation for Phase 8 ✅ NEW
```typescript
// AppContext.tsx - Enhanced with User Management
interface AppState {
  timeEntries: TimeEntry[];
  projects: Project[];
  clients: Client[];
  invoices: Invoice[];
  timer: TimerState;
  user: User | null;
  users: User[]; // ✅ NEW - All users in the system
  teams: Team[]; // ✅ NEW - Team management
  userSessions: UserSession[]; // ✅ NEW - Session tracking
  userInvitations: UserInvitation[]; // ✅ NEW - Invitation management
  permissions: PermissionMatrix; // ✅ NEW - Role-based permissions
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'employee';
  hourlyRate: number;
  teamId: string;
  department?: string;
  isActive: boolean;
  contactInfo?: {
    phone?: string;
    address?: string;
    emergencyContact?: string;
  };
  profilePicture?: string;
  jobTitle?: string;
  startDate: string;
  lastLogin?: string;
  permissions: {
    features: string[];
    projects: string[];
  };
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
    timezone: string;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  managerId: string;
  memberIds: string[];
  department?: string;
  parentTeamId?: string;
  permissions: {
    defaultRole: 'manager' | 'employee';
    projectAccess: string[];
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

type AppAction = 
  // Existing actions
  | { type: 'ADD_TIME_ENTRY'; payload: Omit<TimeEntry, 'id' | 'createdAt'> }
  | { type: 'UPDATE_TIME_ENTRY'; payload: { id: string; updates: Partial<TimeEntry> } }
  | { type: 'DELETE_TIME_ENTRY'; payload: string }
  | { type: 'START_TIMER'; payload: { projectId: string; description: string } }
  | { type: 'STOP_TIMER' }
  | { type: 'UPDATE_TIMER_TIME'; payload: number }
  | { type: 'SET_USER'; payload: AppState['user'] }
  
  // ✅ NEW - User Management Actions
  | { type: 'ADD_USER'; payload: Omit<User, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_USER'; payload: { id: string; updates: Partial<User> } }
  | { type: 'DELETE_USER'; payload: string }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'UPDATE_USER_STATUS'; payload: { id: string; isActive: boolean } }
  | { type: 'BULK_UPDATE_USERS'; payload: { userIds: string[]; updates: Partial<User> } }
  
  // ✅ NEW - Team Management Actions
  | { type: 'ADD_TEAM'; payload: Omit<Team, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_TEAM'; payload: { id: string; updates: Partial<Team> } }
  | { type: 'DELETE_TEAM'; payload: string }
  | { type: 'SET_TEAMS'; payload: Team[] }
  | { type: 'ADD_TEAM_MEMBER'; payload: { teamId: string; userId: string } }
  | { type: 'REMOVE_TEAM_MEMBER'; payload: { teamId: string; userId: string } }
  
  // ✅ NEW - Permission Management Actions
  | { type: 'UPDATE_USER_PERMISSIONS'; payload: { userId: string; permissions: User['permissions'] } }
  | { type: 'UPDATE_USER_ROLE'; payload: { userId: string; role: User['role'] } }
  | { type: 'SET_PERMISSION_MATRIX'; payload: PermissionMatrix }
  
  // ✅ NEW - Session Management Actions
  | { type: 'ADD_USER_SESSION'; payload: UserSession }
  | { type: 'UPDATE_USER_SESSION'; payload: { sessionId: string; updates: Partial<UserSession> } }
  | { type: 'LOGOUT_USER_SESSION'; payload: string }
  
  // ✅ NEW - Invitation Management Actions
  | { type: 'SEND_USER_INVITATION'; payload: Omit<UserInvitation, 'id' | 'createdAt'> }
  | { type: 'ACCEPT_USER_INVITATION'; payload: { invitationId: string; userId: string } }
  | { type: 'CANCEL_USER_INVITATION'; payload: string };
```

### Context Provider Setup ✅
```typescript
// App.tsx - Proper provider wrapping
<ErrorBoundary>
  <AppProvider>
    <Router>
      <Navigation />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/time-tracking" element={<TimeTrackingNew />} />
        {/* ... other routes */}
      </Routes>
    </Router>
  </AppProvider>
</ErrorBoundary>
```

### Usage Pattern ✅
```typescript
// Component usage
const { state, dispatch } = useAppContext();

// Timer operations
dispatch({ type: 'START_TIMER', payload: { projectId, description } });
dispatch({ type: 'STOP_TIMER' });

// Time entry management
dispatch({ type: 'ADD_TIME_ENTRY', payload: timeEntry });
dispatch({ type: 'UPDATE_TIME_ENTRY', payload: { id, updates } });
```

## 4. Database Schema (DynamoDB)

### Primary Tables
```
Users ✅ ENHANCED
- PK: userId
- email, name, role, hourlyRate, teamId, isActive, department
- contactInfo: { phone, address, emergencyContact }
- profilePicture, jobTitle, startDate, lastLogin
- permissions: { features: [], projects: [] }
- preferences: { theme, notifications, timezone }
- createdAt, updatedAt, createdBy

Teams ✅ ENHANCED
- PK: teamId
- name, description, managerId, memberIds[]
- department, parentTeamId (for hierarchical structure)
- permissions: { defaultRole, projectAccess[] }
- isActive, createdAt, updatedAt, createdBy

UserSessions ✅ NEW
- PK: sessionId
- userId, loginTime, lastActivity, ipAddress
- userAgent, isActive, logoutTime
- securityFlags: { mfaVerified, passwordChangeRequired }

UserInvitations ✅ NEW
- PK: invitationId
- email, invitedBy, role, teamId, status
- invitationToken, expiresAt, acceptedAt
- onboardingCompleted, createdAt

UserActivity ✅ NEW
- PK: activityId
- userId, action, resource, timestamp
- details: { oldValue, newValue, metadata }
- ipAddress, userAgent, sessionId

Clients
- PK: clientId
- name, contactInfo, billingAddress, isActive

Projects
- PK: projectId
- clientId, name, description, budget, hourlyRate, status

TimeEntries
- PK: timeEntryId
- userId, projectId, date, startTime, endTime, duration, description, isBillable, status

Invoices
- PK: invoiceId
- clientId, projectIds[], timeEntryIds[], amount, status, dueDate
```

## 5. Application Structure ✅ IMPLEMENTED

```
src/
├── main/                          # Electron main process
│   ├── main.js                   # Main entry point
│   ├── menu.js                   # Application menu
│   └── windows/                  # Window management
├── renderer/                     # React frontend ✅
│   ├── components/               # Reusable UI components
│   │   ├── common/              # Generic components
│   │   ├── timer/               # Timer-specific components
│   │   ├── projects/            # Project management
│   │   ├── reports/             # Reporting components
│   │   └── invoices/            # Invoice components
│   ├── pages/                   # Main application pages ✅
│   │   ├── Dashboard.tsx        # ✅ Basic dashboard
│   │   ├── TimeTrackingNew.tsx  # ✅ Full time tracking interface
│   │   ├── Projects.tsx         # 🚧 Placeholder
│   │   ├── Reports.tsx          # 🚧 Placeholder
│   │   ├── Invoices.tsx         # 🚧 Placeholder
│   │   └── Settings.tsx         # 📋 Planned
│   ├── context/                 # React Context ✅
│   │   └── AppContext.tsx       # ✅ Main state management
│   ├── services/                # API services
│   ├── utils/                   # Utility functions
│   └── types/                   # TypeScript type definitions ✅
├── preload/                     # Electron preload scripts ✅
└── shared/                      # Shared utilities
```

## 6. Development Phases

### Phase 1: Foundation ✅ COMPLETED (Weeks 1-2)
- [x] Set up React + TypeScript in Electron
- [x] Configure Tailwind CSS and component library
- [x] Implement basic routing and navigation
- [x] Set up React Context state management
- [x] Create error boundary system

### Phase 2: Core Time Tracking ✅ COMPLETED (Weeks 3-4)
- [x] Build timer interface (start/stop/pause)
- [x] Implement manual time entry forms
- [x] Create project selection and management
- [x] Add time entry validation and storage
- [x] Build daily/weekly timesheet views
- [x] Implement time entry CRUD operations
- [x] Add billable/non-billable categorization
- [x] Create time summary and analytics

### Phase 3: Project & Client Management 🚧 IN PROGRESS (Weeks 5-6)
- [ ] Client management interface
- [ ] Project creation and editing
- [ ] User and team management
- [ ] Permission system implementation
- [ ] Project assignment workflows

### Phase 4: Approval Workflow (Week 7)
- [ ] Time entry submission system
- [ ] Manager approval interface
- [ ] Status tracking and notifications
- [ ] Approval history and audit trail

### Phase 5: Reporting (Weeks 8-9)
- [ ] Basic time reports (user, project, date range)
- [ ] Charts and visualizations
- [ ] Export functionality (PDF, CSV)
- [ ] Advanced analytics and insights

### Phase 6: Invoicing (Weeks 10-11)
- [ ] Invoice generation from approved time
- [ ] Customizable invoice templates
- [ ] Invoice management (send, track, payment)
- [ ] Integration with payment systems (future)

### Phase 7: Polish & Testing (Week 12)
- [ ] UI/UX improvements
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] Documentation and deployment

### Password Reset Implementation ✅ COMPLETED (Week 12.5)
- [x] **Complete Email-Based Password Reset Flow**
  - Multi-step form: Email Request → Code Confirmation → Password Reset
  - AWS Cognito integration with resetPassword and confirmResetPassword
  - Enhanced focus management with automatic input focusing
  - Client-side password policy validation

- [x] **Security Best Practices**
  - No user existence revelation for invalid emails
  - 15-minute code expiration with clear messaging
  - Password policy enforcement (8+ chars, mixed case, numbers)
  - Rate limiting protection and comprehensive error handling

- [x] **Enhanced User Experience**
  - Clear instructions about email delivery and spam folders
  - Password requirements displayed prominently
  - Request new code functionality for expired codes
  - Immediate error clearing when users start typing

- [x] **Testing & Documentation**
  - Browser console testing utilities (passwordResetTests)
  - Comprehensive error handling with security-compliant messaging
  - Complete backend requirements documentation
  - Integration guide for backend team coordination

### Phase 8: User Management & Administration (Weeks 13-14) ✅ NEW PHASE
- [ ] **User Profile Management Interface**
  - Personal information editing (name, email, contact details)
  - Profile picture upload and management
  - Hourly rate configuration
  - Department and team assignment
  - User preferences and settings

- [ ] **User Creation & Onboarding System**
  - Admin-only user creation interface
  - Email invitation system for new users
  - Initial password setup and account activation
  - Onboarding checklist and guided setup
  - Welcome email templates and notifications

- [ ] **Role Assignment & Permission System**
  - Role selection interface (Admin, Manager, Employee)
  - Permission matrix configuration
  - Feature-level access control
  - Project-specific permissions
  - Time entry approval permissions by team

- [ ] **Team Structure Management**
  - Team creation and editing interface
  - Hierarchical team organization
  - Manager assignment and delegation
  - Team member addition and removal
  - Cross-team collaboration settings

- [ ] **User Status & Activity Management**
  - User status control (active/inactive/suspended)
  - Login history and activity tracking
  - Last activity timestamp monitoring
  - Session management and timeout settings
  - Security event logging

- [ ] **Advanced User Administration**
  - Bulk user import from CSV/Excel
  - User directory with advanced search
  - Bulk status updates and operations
  - User analytics and performance metrics
  - Deactivation and offboarding workflows

## 7. Current Implementation Status

### ✅ Working Features
1. **Timer System**
   - Start/stop timer with project selection
   - Real-time elapsed time display
   - Automatic time entry creation on stop
   - Visual feedback for running state

2. **Time Entry Management**
   - View all time entries with project details
   - Delete time entries with confirmation
   - Submit entries for approval
   - Billable/non-billable categorization
   - Status tracking (draft, submitted, approved)

3. **Project System**
   - Project selection dropdown
   - Project details (name, client, hourly rate)
   - Active/inactive project filtering

4. **State Management**
   - React Context with useReducer
   - Type-safe actions and state
   - Proper error handling
   - Component isolation

5. **UI/UX**
   - Modern, responsive design
   - Tailwind CSS styling
   - Error boundaries
   - Loading states and feedback

6. **Password Reset System** ✅ NEW
   - Complete email-based password reset flow
   - AWS Cognito integration with security best practices
   - Enhanced focus management and user experience
   - Comprehensive error handling and testing utilities
   - Client-side password policy validation
   - No user existence revelation for security

### 🚧 In Development
- Advanced time entry editing
- Project management interface
- Client management system
- User authentication integration

## 8. Key Dependencies & Stability Management

### Current Dependencies ✅ (All Stable Versions)

```json
{
  "dependencies": {
    "@headlessui/react": "^2.2.4",
    "@heroicons/react": "^2.2.0",
    "@hookform/resolvers": "^5.0.1",
    "@reduxjs/toolkit": "^2.8.2",
    "@types/react": "^19.1.5",
    "@types/react-dom": "^19.1.5",
    "aws-amplify": "^6.14.4",
    "chart.js": "^4.4.9",
    "date-fns": "^4.1.0",
    "electron-log": "^5.2.4",
    "electron-store": "^8.2.0",
    "electron-updater": "^6.3.9",
    "jspdf": "^3.0.1",
    "react": "^19.1.0",
    "react-chartjs-2": "^5.3.0",
    "react-dom": "^19.1.0",
    "react-hook-form": "^7.56.4",
    "react-redux": "^9.2.0",
    "react-router-dom": "^7.6.0",
    "redux-persist": "^6.0.0",
    "typescript": "^5.8.3",
    "xlsx": "^0.18.5",
    "zod": "^3.25.23"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@tailwindcss/forms": "^0.5.10",
    "@tailwindcss/typography": "^0.5.16",
    "@types/node": "^22.15.21",
    "autoprefixer": "^10.4.21",
    "concurrently": "^9.1.2",
    "css-loader": "^7.1.2",
    "electron": "^36.3.1",
    "electron-builder": "^25.1.8",
    "electron-reload": "^1.5.0",
    "electronmon": "^2.0.2",
    "eslint": "^8.57.0",
    "events": "^3.3.0",
    "html-webpack-plugin": "^5.6.3",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "playwright": "^1.40.0",
    "postcss": "^8.5.3",
    "postcss-loader": "^8.1.1",
    "style-loader": "^4.0.0",
    "tailwindcss": "^3.4.17",
    "ts-loader": "^9.5.2",
    "wait-on": "^8.0.3",
    "webpack": "^5.99.9",
    "webpack-cli": "^6.0.1",
    "webpack-dev-server": "^5.2.1"
  }
}
```

### 🔒 Dependency Stability Management

**Policy**: This project enforces **stable-only dependencies** for maximum reliability.

#### ✅ Stability Achievements
- **Zero unstable dependencies**: All alpha/beta/RC versions eliminated
- **Automated monitoring**: `npm run check-deps` script prevents unstable packages
- **Security tracking**: Regular `npm audit` for vulnerability monitoring
- **Breaking change management**: Systematic approach to major version updates

#### ⚠️ Known Issues
- **xlsx package**: Security vulnerabilities (Prototype Pollution & ReDoS)
  - **Status**: No upstream fix available
  - **Alternatives**: Evaluating `exceljs` or `papaparse`
  - **Risk**: Documented and accepted pending replacement

#### 🛠️ Dependency Tools
```bash
# Check for unstable dependencies
npm run check-deps

# Security audit
npm audit

# Check for updates
npm outdated
```

#### 📋 Recent Dependency Actions
- ✅ **electron-reload**: Replaced alpha version `2.0.0-alpha.1` → stable `1.5.0`
- ✅ **electron**: Updated to latest patch `36.3.1`
- ⚠️ **electron-store**: Reverted from `10.0.1` to `8.2.0` (v10+ is ESM-only breaking change)

#### 🔮 Planned Major Updates
- **electron-store v10+**: Requires ESM migration (planned for separate phase)
- **ESLint 9.x**: Major version update (breaking changes)
- **Tailwind CSS 4.x**: Major version update (significant changes expected)

📚 **See [DEPENDENCY_ANALYSIS.md](./DEPENDENCY_ANALYSIS.md) for comprehensive analysis**

## 9. AWS Backend Structure (Separate Repository)

### Infrastructure Components
- **API Gateway**: RESTful API endpoints
- **Lambda Functions**: Business logic
- **DynamoDB**: Data storage
- **Cognito**: User authentication
- **S3**: File storage for invoices/reports
- **SES**: Email notifications
- **CloudWatch**: Logging and monitoring

### API Endpoints ✅ ENHANCED FOR PHASE 8
```
Authentication:
POST /auth/login
POST /auth/logout
POST /auth/refresh

Users: ✅ ENHANCED
GET /users                    # List all users (admin/manager only)
POST /users                   # Create new user (admin only)
PUT /users/{id}              # Update user profile
DELETE /users/{id}           # Deactivate user (admin only)
GET /users/{id}/profile      # Get user profile
PUT /users/{id}/profile      # Update user profile
PUT /users/{id}/permissions  # Update user permissions (admin only)
PUT /users/{id}/role        # Update user role (admin only)
POST /users/invite          # Send user invitation (admin only)
GET /users/invitations      # List pending invitations

Teams: ✅ NEW
GET /teams                   # List all teams
POST /teams                  # Create new team (admin/manager only)
PUT /teams/{id}             # Update team details
DELETE /teams/{id}          # Delete team (admin only)
POST /teams/{id}/members    # Add team member
DELETE /teams/{id}/members/{userId}  # Remove team member
GET /teams/{id}/members     # List team members

Sessions: ✅ NEW
GET /sessions               # List active sessions (admin only)
DELETE /sessions/{id}       # Logout specific session
GET /users/{id}/sessions    # User's active sessions
POST /users/{id}/logout-all # Logout all user sessions

Activity: ✅ NEW
GET /activity               # System activity log (admin only)
GET /users/{id}/activity    # User activity history

Projects:
GET /projects
POST /projects
PUT /projects/{id}
DELETE /projects/{id}

Time Entries:
GET /time-entries
POST /time-entries
PUT /time-entries/{id}
DELETE /time-entries/{id}

Reports:
GET /reports/time
GET /reports/projects
GET /reports/users

Invoices:
GET /invoices
POST /invoices
PUT /invoices/{id}
POST /invoices/{id}/send
```

## 9.1 AWS Backend Setup Plan - Detailed Instructions ✅ NEW

### 🎯 **Phase 9: AWS Backend Infrastructure Setup**
**Timeline**: Weeks 15-16 | **Status**: 📋 **READY TO START**

#### **Prerequisites & Setup Instructions**

##### **Step 1: Repository Structure Decision ✅ RECOMMENDED**

**Create a separate backend repository** with this structure:
```
aerotage-time-reporting-api/          # New repository
├── README.md
├── package.json
├── tsconfig.json
├── .gitignore
├── .env.example
├── infrastructure/                   # AWS CDK infrastructure
│   ├── cdk.json
│   ├── bin/
│   │   └── aerotage-time-api.ts     # CDK app entry point
│   ├── lib/                         # CDK stack definitions
│   │   ├── cognito-stack.ts         # Authentication
│   │   ├── api-stack.ts             # API Gateway + Lambda
│   │   ├── database-stack.ts        # DynamoDB tables
│   │   ├── storage-stack.ts         # S3 buckets
│   │   └── monitoring-stack.ts      # CloudWatch
│   └── test/                        # Infrastructure tests
├── src/                             # Lambda functions
│   ├── handlers/                    # API endpoint handlers
│   │   ├── auth/                    # Authentication endpoints
│   │   ├── users/                   # User management
│   │   ├── teams/                   # Team management
│   │   ├── projects/                # Project endpoints
│   │   ├── time-entries/            # Time tracking
│   │   ├── reports/                 # Reporting
│   │   └── invoices/                # Invoice management
│   ├── models/                      # Data models
│   ├── utils/                       # Shared utilities
│   ├── middleware/                  # Auth & validation middleware
│   └── types/                       # TypeScript types
├── tests/                           # Integration & unit tests
└── docs/                           # API documentation
```

##### **Step 2: AWS Account & CLI Setup**

**🚀 Install AWS CLI (if not installed):**
```bash
# macOS (using Homebrew)
brew install awscli

# Verify installation
aws --version
```

**🔐 Configure AWS Credentials:**
```bash
# Configure AWS CLI with your credentials
aws configure

# You'll need:
# - AWS Access Key ID
# - AWS Secret Access Key  
# - Default region (e.g., us-east-1)
# - Default output format (json)
```

**🔑 Set up AWS Profile (recommended for multiple environments):**
```bash
# Create profiles for different environments
aws configure --profile aerotage-dev
aws configure --profile aerotage-staging  
aws configure --profile aerotage-prod

# Test access
aws sts get-caller-identity --profile aerotage-dev
```

##### **Step 3: Infrastructure as Code Choice**

**✅ RECOMMENDED: AWS CDK (TypeScript)**
- **Advantages**: Same language as your frontend (TypeScript)
- **Benefits**: Type safety, better IDE support, familiar syntax
- **Learning Curve**: Easier for JavaScript/TypeScript developers

**📦 Install AWS CDK:**
```bash
# Install CDK globally
npm install -g aws-cdk

# Verify installation  
cdk --version

# Bootstrap CDK (one-time setup per AWS account/region)
cdk bootstrap --profile aerotage-dev
```

##### **Step 4: Create Backend Repository**

**🚀 Initialize the Backend Repository:**
```bash
# Navigate to parent directory
cd ..

# Create new repository directory
mkdir aerotage-time-reporting-api
cd aerotage-time-reporting-api

# Initialize git and npm
git init
npm init -y

# Install CDK dependencies
npm install aws-cdk-lib constructs
npm install -D typescript @types/node ts-node

# Install Lambda dependencies
npm install aws-lambda @aws-sdk/client-dynamodb @aws-sdk/client-cognito-identity-provider
npm install -D @types/aws-lambda

# Create initial CDK app
cdk init app --language typescript
```

**📁 Add to Cursor Workspace:**
```bash
# In your main Cursor workspace, add the backend folder
# File > Add Folder to Workspace > Select aerotage-time-reporting-api
```

##### **Step 5: Environment Configuration**

**🌍 Environment Setup (.env files):**
```bash
# .env.development
AWS_PROFILE=aerotage-dev
AWS_REGION=us-east-1
STAGE=dev
COGNITO_USER_POOL_NAME=aerotage-time-dev
API_NAME=aerotage-time-api-dev

# .env.staging  
AWS_PROFILE=aerotage-staging
AWS_REGION=us-east-1
STAGE=staging
COGNITO_USER_POOL_NAME=aerotage-time-staging
API_NAME=aerotage-time-api-staging

# .env.production
AWS_PROFILE=aerotage-prod
AWS_REGION=us-east-1
STAGE=prod
COGNITO_USER_POOL_NAME=aerotage-time-prod
API_NAME=aerotage-time-api-prod
```

##### **Step 6: Initial Infrastructure Code**

**🏗️ CDK Stack Structure:**

```typescript
// bin/aerotage-time-api.ts
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from '../lib/cognito-stack';
import { DatabaseStack } from '../lib/database-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();

const stage = process.env.STAGE || 'dev';

// Cognito User Pool
const cognitoStack = new CognitoStack(app, `AerotageAuth-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

// DynamoDB Tables
const databaseStack = new DatabaseStack(app, `AerotageDB-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

// API Gateway + Lambda
const apiStack = new ApiStack(app, `AerotageAPI-${stage}`, {
  stage,
  userPool: cognitoStack.userPool,
  tables: databaseStack.tables,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
```

##### **Step 7: Development Workflow**

**📝 Package.json Scripts:**
```json
{
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "cdk": "cdk",
    "deploy:dev": "cdk deploy --all --profile aerotage-dev",
    "deploy:staging": "cdk deploy --all --profile aerotage-staging", 
    "deploy:prod": "cdk deploy --all --profile aerotage-prod",
    "destroy:dev": "cdk destroy --all --profile aerotage-dev",
    "test": "jest",
    "lint": "eslint . --ext .ts"
  }
}
```

**🚀 Deployment Commands:**
```bash
# Development environment
npm run deploy:dev

# Staging environment  
npm run deploy:staging

# Production environment
npm run deploy:prod
```

##### **Step 8: Frontend Integration**

**🔗 Update Frontend AWS Amplify Configuration:**
```typescript
// src/aws-config.ts
import { Amplify } from 'aws-amplify';

const awsConfig = {
  Auth: {
    region: process.env.AWS_REGION || 'us-east-1',
    userPoolId: process.env.USER_POOL_ID,
    userPoolWebClientId: process.env.USER_POOL_CLIENT_ID,
  },
  API: {
    endpoints: [
      {
        name: 'AerotageTimeAPI',
        endpoint: process.env.API_ENDPOINT,
        region: process.env.AWS_REGION || 'us-east-1',
      },
    ],
  },
};

Amplify.configure(awsConfig);
```

##### **Step 9: API Development Plan**

**📋 Implementation Priority:**
1. **Authentication APIs** (login, logout, token refresh)
2. **User Management APIs** (CRUD, invitations)
3. **Team Management APIs** (teams, members)
4. **Project & Client APIs** (existing frontend features)
5. **Time Entry APIs** (timer integration)
6. **Reporting APIs** (charts and exports)
7. **Invoice APIs** (generation and management)

##### **Step 10: Security & Monitoring**

**🔐 Security Configuration:**
```typescript
// API Gateway with Cognito Authorization
const api = new apigateway.RestApi(this, 'API', {
  restApiName: `aerotage-time-api-${stage}`,
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
  },
});

const auth = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
  cognitoUserPools: [userPool],
});
```

**📊 CloudWatch Monitoring:**
```typescript
// Lambda function with monitoring
const lambda = new lambda.Function(this, 'Handler', {
  // ... configuration
  environment: {
    LOG_LEVEL: 'INFO',
  },
});

// CloudWatch alarms
new cloudwatch.Alarm(this, 'ErrorAlarm', {
  metric: lambda.metricErrors(),
  threshold: 5,
  evaluationPeriods: 2,
});
```

#### **🎯 Next Steps - Implementation Plan**

##### **Week 15: Infrastructure Foundation**
1. **Day 1-2**: Set up AWS CLI, create backend repo
2. **Day 3-4**: Implement Cognito and DynamoDB stacks
3. **Day 5**: Deploy development environment and test

##### **Week 16: API Development**  
1. **Day 1-2**: Authentication endpoints
2. **Day 3-4**: User management APIs
3. **Day 5**: Frontend integration and testing

##### **Week 17: Feature APIs**
1. **Day 1-2**: Project and Client APIs
2. **Day 3-4**: Time Entry APIs
3. **Day 5**: Testing and validation

##### **Week 18: Advanced Features**
1. **Day 1-2**: Reporting APIs
2. **Day 3-4**: Invoice APIs
3. **Day 5**: Production deployment

#### **📚 Additional Resources**

**📖 Documentation Links:**
- [AWS CDK TypeScript Guide](https://docs.aws.amazon.com/cdk/v2/guide/work-with-cdk-typescript.html)
- [AWS Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [API Gateway with Lambda](https://docs.aws.amazon.com/apigateway/latest/developerguide/getting-started-with-lambda-integration.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

**🔧 Useful Commands:**
```bash
# CDK Commands
cdk diff                    # Show changes
cdk synth                   # Generate CloudFormation
cdk deploy --hotswap        # Fast deployment for Lambda changes
cdk destroy                 # Clean up resources

# AWS CLI Commands  
aws cognito-idp list-users --user-pool-id <pool-id>
aws dynamodb scan --table-name <table-name>
aws logs tail /aws/lambda/<function-name> --follow
```

## 10. Security Considerations ✅ ENHANCED FOR PHASE 8

- **Data Encryption**: All data encrypted in transit and at rest
- **Authentication**: AWS Cognito with MFA
- **Authorization**: Enhanced role-based access control with granular permissions
- **API Security**: JWT tokens, rate limiting, request validation
- **Local Storage**: Encrypted local data storage
- **Audit Logging**: Track all user actions and administrative changes
- **Session Management**: Secure session handling with timeout controls
- **User Permissions**: Feature-level and project-level access control
- **Password Policies**: Strong password requirements and rotation
- **Account Security**: Account lockout, suspicious activity detection

## 11. Deployment Strategy

### Desktop App
- **macOS**: Code signing and notarization
- **Windows**: Code signing with certificate
- **Auto-updates**: Using electron-updater
- **Distribution**: Direct download or Mac App Store

### Backend
- **Infrastructure as Code**: AWS CDK or Terraform
- **CI/CD Pipeline**: GitHub Actions or AWS CodePipeline
- **Environment Management**: Dev, Staging, Production
- **Monitoring**: CloudWatch dashboards and alerts

## 12. Future Enhancements

- **Mobile App**: React Native companion app
- **Integrations**: QuickBooks, Xero, Slack, Jira
- **Advanced Analytics**: Machine learning insights
- **API Access**: Public API for third-party integrations
- **White-label**: Customizable branding for resellers
- **Single Sign-On**: Enterprise SSO integration
- **Advanced Reporting**: Custom report builder
- **Workflow Automation**: Automated approval and notification rules

## 13. Success Metrics ✅ ENHANCED FOR PHASE 8

- **User Adoption**: Number of active users
- **Time Tracking Accuracy**: Percentage of billable time captured
- **Invoice Generation**: Time from work completion to invoice
- **User Satisfaction**: App store ratings and user feedback
- **Performance**: App responsiveness and reliability
- **User Management Efficiency**: Time to onboard new users
- **Permission Compliance**: Proper access control adherence
- **Team Productivity**: Manager oversight and team performance metrics
- **Security Metrics**: Login success rates, security incidents
- **Administrative Efficiency**: Bulk operations and user management speed

---

This plan provides a comprehensive roadmap for developing a professional time tracking application that can compete with established solutions while being tailored to Aerotage Design Group's specific needs. The React Context implementation provides a solid foundation for the current scope while remaining scalable for future enhancements. **Phase 8 adds essential user management capabilities** that transform the application into a complete enterprise solution with proper user administration, team management, and security controls.