# Daily and Weekly Time Tracking - Implementation Guide

## Overview

This document outlines the implementation of the daily and weekly time tracking feature enhancement for the Aerotage Time Reporting API. This feature provides users with comprehensive daily and weekly views to help them account for all their work time and identify gaps in their time tracking.

## 🎯 Feature Goals

- **Daily Time Accountability**: Help users review their time allocation for specific days
- **Weekly Time Patterns**: Provide insights into weekly work patterns and productivity trends
- **Gap Analysis**: Identify periods where no time was tracked during work hours
- **Work Schedule Management**: Allow users to configure their work schedules for accurate analysis
- **Quick Time Entry**: Enable simplified time entry creation to fill identified gaps

## 📋 Implementation Status

### ✅ Completed Components

#### 1. Database Schema
- **User Work Schedules Table**: `aerotage-user-work-schedules-{stage}`
  - Stores user-specific work schedules with timezone support
  - Configurable work hours for each day of the week
  - Weekly target hours calculation

#### 2. TypeScript Types
- **Daily/Weekly Time Tracking Types**: Added to `shared/types.ts`
  - `UserWorkSchedule`, `WorkDaySchedule`
  - `DailySummary`, `WeeklyOverview`
  - `TimeGap`, `ProjectTimeBreakdown`
  - Request/Response interfaces
  - Error codes for validation

#### 3. Lambda Functions

##### Daily Summary (`/time-entries/daily-summary`)
- **Purpose**: Get aggregated time data for specific days with gap analysis
- **Method**: GET
- **Parameters**:
  - `startDate` (required): YYYY-MM-DD
  - `endDate` (required): YYYY-MM-DD
  - `userId` (optional): Target user ID
  - `includeGaps` (optional): Include gap analysis (default: true)
  - `targetHours` (optional): Override target hours

##### Weekly Overview (`/time-entries/weekly-overview`)
- **Purpose**: Comprehensive weekly time analysis with patterns and trends
- **Method**: GET
- **Parameters**:
  - `weekStartDate` (required): YYYY-MM-DD (must be Monday)
  - `userId` (optional): Target user ID
  - `includeComparison` (optional): Include previous week comparison

##### Work Schedule Management
- **Get Schedule** (`/users/work-schedule`, `/users/{id}/work-schedule`)
  - **Method**: GET
  - **Purpose**: Retrieve user's work schedule configuration
  
- **Update Schedule** (`/users/work-schedule`, `/users/{id}/work-schedule`)
  - **Method**: PUT
  - **Purpose**: Update user's work schedule configuration

##### Quick Time Entry (`/time-entries/quick-add`)
- **Purpose**: Simplified time entry creation for filling gaps
- **Method**: POST
- **Features**:
  - Overlap detection
  - Automatic duration calculation
  - Gap filling support

#### 4. API Integration
- **Environment Variables**: Added work schedules table configuration
- **IAM Permissions**: DynamoDB access for new table
- **API Gateway**: Configured new endpoints with authentication

## 📊 API Endpoints

### Daily Summary
```
GET /time-entries/daily-summary?startDate=2024-01-15&endDate=2024-01-19&includeGaps=true
```

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "summaries": [
      {
        "date": "2024-01-15",
        "dayOfWeek": "Monday",
        "totalHours": 8.0,
        "billableHours": 7.0,
        "targetHours": 8.0,
        "completionPercentage": 100.0,
        "entriesCount": 5,
        "projectBreakdown": [...],
        "timeGaps": [...],
        "workingHours": {
          "firstEntry": "08:00",
          "lastEntry": "17:30",
          "totalSpan": "9h 30m"
        }
      }
    ],
    "periodSummary": {
      "totalDays": 5,
      "workDays": 5,
      "totalHours": 38.5,
      "averageHoursPerDay": 7.7,
      "targetHours": 40.0,
      "completionPercentage": 96.25
    }
  }
}
```

### Weekly Overview
```
GET /time-entries/weekly-overview?weekStartDate=2024-01-15&includeComparison=true
```

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "weekInfo": {
      "weekStartDate": "2024-01-15",
      "weekEndDate": "2024-01-19",
      "weekNumber": 3,
      "year": 2024
    },
    "dailySummaries": [...],
    "weeklyTotals": {
      "totalHours": 38.5,
      "billableHours": 35.0,
      "targetHours": 40.0,
      "completionPercentage": 96.25
    },
    "patterns": {
      "mostProductiveDay": "Tuesday",
      "leastProductiveDay": "Friday",
      "averageStartTime": "08:15",
      "averageEndTime": "17:30"
    },
    "projectDistribution": [...],
    "comparison": {
      "previousWeek": {
        "totalHours": 35.0,
        "change": "+3.5",
        "changePercentage": "+10.0%"
      }
    }
  }
}
```

### Work Schedule Management
```
GET /users/work-schedule
PUT /users/work-schedule
GET /users/{id}/work-schedule
PUT /users/{id}/work-schedule
```

**Work Schedule Structure**:
```json
{
  "userId": "user_123",
  "schedule": {
    "monday": { "start": "09:00", "end": "17:00", "targetHours": 8 },
    "tuesday": { "start": "09:00", "end": "17:00", "targetHours": 8 },
    "wednesday": { "start": "09:00", "end": "17:00", "targetHours": 8 },
    "thursday": { "start": "09:00", "end": "17:00", "targetHours": 8 },
    "friday": { "start": "09:00", "end": "16:00", "targetHours": 7 },
    "saturday": { "start": null, "end": null, "targetHours": 0 },
    "sunday": { "start": null, "end": null, "targetHours": 0 }
  },
  "timezone": "America/New_York",
  "weeklyTargetHours": 39
}
```

### Quick Time Entry
```
POST /time-entries/quick-add
```

**Request Body**:
```json
{
  "date": "2024-01-15",
  "startTime": "10:00",
  "endTime": "10:30",
  "projectId": "proj_123",
  "description": "Coffee break",
  "isBillable": false,
  "fillGap": true
}
```

## 🔧 Technical Implementation Details

### Database Design

#### User Work Schedules Table
- **Table Name**: `aerotage-user-work-schedules-{stage}`
- **Partition Key**: `PK` (USER#{userId})
- **Sort Key**: `SK` (WORK_SCHEDULE)
- **Attributes**:
  - `userId`: User identifier
  - `schedule`: JSON serialized work schedule
  - `timezone`: User's timezone
  - `weeklyTargetHours`: Calculated weekly target
  - `createdAt`, `updatedAt`: Timestamps

### Security & Permissions

#### Role-Based Access
- **Employees**: Can only view/edit their own work schedule and time data
- **Managers**: Can view team members' data
- **Admins**: Can view all users' data

#### Data Validation
- **Date Format**: YYYY-MM-DD validation
- **Time Format**: HH:MM validation
- **Time Range**: Start time must be before end time
- **Future Dates**: Cannot analyze future dates
- **Overlap Detection**: Prevents overlapping time entries

### Performance Considerations

#### Optimizations Implemented
- **Date Range Limits**: Maximum 31 days for daily summary
- **Efficient Queries**: Uses DynamoDB GSIs for fast lookups
- **Simplified Weekly View**: Excludes gap analysis for performance
- **Caching Ready**: Structure supports future caching implementation

#### Query Patterns
- **User-Date Lookup**: `GSI1PK = USER#{userId}, GSI1SK begins_with DATE#{date}`
- **Project-Date Lookup**: `GSI2PK = PROJECT#{projectId}, GSI2SK begins_with DATE#{date}`
- **Status-Date Lookup**: `GSI3PK = STATUS#{status}, GSI3SK begins_with DATE#{date}`

## 🚀 Deployment Instructions

### Prerequisites
- Existing Aerotage Time Reporting API infrastructure
- AWS CDK v2 installed
- Node.js 20.x runtime

### Deployment Steps

1. **Deploy Database Changes**:
   ```bash
   cd infrastructure
   cdk deploy AerotageDatabase-dev
   ```

2. **Deploy API Changes**:
   ```bash
   cdk deploy AerotageApi-dev
   ```

3. **Verify Deployment**:
   ```bash
   # Test daily summary endpoint
   curl -H "Authorization: Bearer <token>" \
     "https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev/time-entries/daily-summary?startDate=2024-01-15&endDate=2024-01-15"
   
   # Test work schedule endpoint
   curl -H "Authorization: Bearer <token>" \
     "https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev/users/work-schedule"
   ```

## 📝 Usage Examples

### Frontend Integration

#### Get Daily Summary
```typescript
const response = await fetch('/api/time-entries/daily-summary?' + new URLSearchParams({
  startDate: '2024-01-15',
  endDate: '2024-01-19',
  includeGaps: 'true'
}), {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { data } = await response.json();
console.log('Daily summaries:', data.summaries);
console.log('Period summary:', data.periodSummary);
```

#### Update Work Schedule
```typescript
const scheduleUpdate = {
  schedule: {
    monday: { start: '08:00', end: '16:00', targetHours: 8 },
    friday: { start: '09:00', end: '15:00', targetHours: 6 }
  },
  timezone: 'America/Los_Angeles'
};

const response = await fetch('/api/users/work-schedule', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(scheduleUpdate)
});
```

#### Quick Add Time Entry
```typescript
const quickEntry = {
  date: '2024-01-15',
  startTime: '14:00',
  endTime: '14:30',
  projectId: 'proj_123',
  description: 'Team meeting',
  isBillable: true,
  fillGap: true
};

const response = await fetch('/api/time-entries/quick-add', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(quickEntry)
});
```

## 🔍 Testing

### Unit Tests
- Daily summary calculations
- Gap analysis algorithms
- Work schedule validation
- Time overlap detection

### Integration Tests
- End-to-end daily summary flow
- Weekly overview with real data
- Work schedule CRUD operations
- Quick time entry creation

### Manual Testing Checklist
- [ ] Daily summary with various date ranges
- [ ] Weekly overview with comparison data
- [ ] Work schedule creation and updates
- [ ] Gap analysis accuracy
- [ ] Quick time entry validation
- [ ] Permission enforcement (employee vs manager)
- [ ] Error handling for invalid inputs

## 🐛 Known Limitations

### Current Implementation
1. **Project Names**: Currently shows placeholder project names (TODO: Fetch actual names)
2. **Client Names**: Currently shows placeholder client names (TODO: Fetch actual names)
3. **Average Times**: Weekly patterns use simplified calculations (TODO: Calculate from actual data)
4. **Gap Analysis**: Basic implementation (TODO: More sophisticated gap detection)

### Future Enhancements
1. **Real-time Updates**: WebSocket support for live updates
2. **Advanced Analytics**: Machine learning for productivity insights
3. **Mobile Optimization**: Optimized endpoints for mobile apps
4. **Bulk Operations**: Batch time entry creation
5. **Integration**: Calendar integration for automatic gap detection

## 📚 Related Documentation

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Frontend Integration Guide](./FRONTEND_INTEGRATION_GUIDE.md) - Integration patterns
- [Security Guide](./SECURITY_GUIDE.md) - Security implementation details
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Infrastructure deployment

## 🤝 Contributing

When extending this feature:

1. **Follow Patterns**: Use existing patterns for new endpoints
2. **Add Tests**: Include unit and integration tests
3. **Update Types**: Add TypeScript types for new interfaces
4. **Document Changes**: Update this documentation
5. **Security Review**: Ensure proper permission checks

## 📞 Support

For questions or issues with this feature:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review the implementation in the `feature/daily-weekly-time-tracking` branch
3. Contact the development team for assistance

---

**Implementation Date**: January 2024  
**Version**: 1.0.0  
**Status**: ✅ Complete - Ready for Frontend Integration 