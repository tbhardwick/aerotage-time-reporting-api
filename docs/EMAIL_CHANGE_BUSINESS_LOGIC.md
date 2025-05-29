# Email Change Business Logic - Frontend Implementation Guide

## 📋 Overview

This document outlines the updated business logic for email change requests and provides implementation guidance for the frontend team. The business logic has been updated to provide more appropriate admin permissions while maintaining security for regular users.

## 🔐 Business Rules

### **Admin Users**
- ✅ **Can view ALL email change requests** (for approval purposes)
- ✅ **Can approve their own email change requests**
- ✅ **Can approve other users' email change requests**
- ✅ **Can reject email change requests**
- ✅ **Have full administrative control over the email change process**

### **Manager/Employee Users**
- ✅ **Can view only their own email change requests**
- ❌ **Cannot approve any email change requests** (including their own)
- ❌ **Cannot reject any email change requests**
- ✅ **Can create and cancel their own email change requests**

## 🎯 Frontend Implementation Requirements

### **1. Admin Dashboard - Email Change Management**

#### **Display Logic**
```typescript
// Admin users should see ALL email change requests
if (userRole === 'admin') {
  // Show all pending, approved, and rejected requests
  // Display approval/rejection buttons for pending requests
  // Show approval history and admin notes
}
```

#### **Required UI Components**
- **Email Change Requests List**: Show all requests with status indicators
- **Approval Interface**: Buttons for approve/reject with admin notes field
- **Request Details**: Full request information including verification status
- **Status Indicators**: Clear visual status (pending, approved, rejected, completed)

#### **API Calls for Admins**
```typescript
// Get all email change requests
GET /email-change
// Optional filters: ?status=pending_approval&limit=20&sortBy=requestedAt&sortOrder=desc

// Approve a request (including own requests)
POST /email-change/{requestId}/approve
{
  "approved": true,
  "adminNotes": "Approval reason or notes"
}

// Reject a request
POST /email-change/{requestId}/reject
{
  "approved": false,
  "adminNotes": "Rejection reason"
}
```

### **2. User Dashboard - Personal Email Changes**

#### **Display Logic**
```typescript
// Regular users (managers/employees) see only their own requests
if (userRole === 'manager' || userRole === 'employee') {
  // Show only current user's email change requests
  // Display status but no approval controls
  // Show "Pending Admin Approval" message for pending requests
}
```

#### **Required UI Components**
- **Personal Request Status**: Current request status and progress
- **Request History**: Previous email change requests
- **Status Messages**: Clear messaging about approval requirements
- **No Approval Controls**: Regular users cannot approve/reject

#### **API Calls for Regular Users**
```typescript
// Get own email change requests only
GET /email-change?userId={currentUserId}

// Create new email change request
POST /email-change
{
  "newEmail": "new.email@example.com",
  "reason": "personal_preference",
  "customReason": "Optional custom reason"
}

// Cancel own pending request
DELETE /email-change/{requestId}
```

## 🔄 Email Change Workflow

### **Complete Process Flow**

1. **User Initiates Change**
   - User submits email change request
   - System sends verification emails to both current and new email addresses
   - Status: `pending_verification`

2. **Email Verification**
   - User clicks verification links in both emails
   - Both emails must be verified before approval
   - Status: `pending_approval`

3. **Admin Approval** ⭐ **UPDATED LOGIC**
   - **Admins can approve their own requests** (new behavior)
   - **Regular users must wait for admin approval**
   - Admin provides approval/rejection notes
   - Status: `approved` or `rejected`

4. **Email Change Processing**
   - System processes approved email changes (24-48 hours)
   - User profile email is updated
   - Status: `completed`

## 📊 API Response Examples

### **Admin View - All Requests**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "b828162a-1933-44ca-881e-72cd04d5ff0e",
        "userId": "0408a498-40c1-7071-acc9-90665ef117c3",
        "userName": "Thomas Hardwick",
        "currentEmail": "bhardwick@aerotage.com",
        "newEmail": "brad.hardwick@voltasis.com",
        "status": "pending_approval",
        "reason": "personal_preference",
        "currentEmailVerified": true,
        "newEmailVerified": true,
        "requestedAt": "2025-05-29T14:21:41.122Z",
        "verifiedAt": "2025-05-29T19:16:03.134Z"
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### **Approval Success Response**
```json
{
  "success": true,
  "data": {
    "requestId": "b828162a-1933-44ca-881e-72cd04d5ff0e",
    "status": "approved",
    "approvedAt": "2025-05-29T20:58:48.218Z",
    "approvedBy": {
      "id": "0408a498-40c1-7071-acc9-90665ef117c3",
      "name": "Thomas Hardwick"
    },
    "estimatedCompletionTime": "2025-05-30T20:58:49.097Z"
  },
  "message": "Email change request approved successfully"
}
```

## 🎨 UI/UX Recommendations

### **Admin Interface**
- **Clear Status Indicators**: Use color coding for different statuses
- **Approval Actions**: Prominent approve/reject buttons with confirmation dialogs
- **Admin Notes**: Required field for approval/rejection reasons
- **Self-Approval Indicator**: Show when admin is approving their own request
- **Bulk Actions**: Consider bulk approval for multiple requests

### **User Interface**
- **Progress Indicator**: Show verification and approval progress
- **Clear Messaging**: Explain approval requirements and timelines
- **Status Updates**: Real-time status updates when possible
- **Help Text**: Guidance on email verification process

### **Status Display**
```typescript
const statusConfig = {
  'pending_verification': {
    color: 'orange',
    message: 'Waiting for email verification',
    icon: 'mail'
  },
  'pending_approval': {
    color: 'blue',
    message: 'Waiting for admin approval',
    icon: 'clock'
  },
  'approved': {
    color: 'green',
    message: 'Approved - Processing email change',
    icon: 'check'
  },
  'rejected': {
    color: 'red',
    message: 'Request rejected',
    icon: 'x'
  },
  'completed': {
    color: 'green',
    message: 'Email change completed',
    icon: 'check-circle'
  }
};
```

## 🔧 Implementation Checklist

### **Backend Integration**
- [ ] Update API service calls to handle new business logic
- [ ] Implement role-based request filtering
- [ ] Add admin approval interface
- [ ] Handle self-approval scenarios

### **UI Components**
- [ ] Admin email change management dashboard
- [ ] User email change status display
- [ ] Approval/rejection modal dialogs
- [ ] Status indicator components

### **User Experience**
- [ ] Clear messaging for different user roles
- [ ] Progress indicators for email change process
- [ ] Confirmation dialogs for approval actions
- [ ] Error handling and user feedback

### **Testing**
- [ ] Test admin can see all requests
- [ ] Test admin can approve own requests
- [ ] Test regular users see only own requests
- [ ] Test regular users cannot approve requests
- [ ] Test approval/rejection workflows

## 🚨 Important Notes

### **Security Considerations**
- **Role Validation**: Always validate user roles on both frontend and backend
- **Permission Checks**: Verify permissions before showing approval controls
- **Audit Trail**: Log all approval/rejection actions for security auditing

### **Error Handling**
- **403 Forbidden**: User doesn't have permission for the action
- **404 Not Found**: Email change request doesn't exist
- **400 Bad Request**: Invalid request data or business rule violation

### **Performance**
- **Pagination**: Implement pagination for large request lists
- **Real-time Updates**: Consider WebSocket or polling for status updates
- **Caching**: Cache user role and permissions appropriately

## 📞 Support

For questions about this implementation:
- **Backend API**: All endpoints are live and tested
- **Business Logic**: Implemented and deployed
- **Test Data**: Sample email change request available for testing

The backend is ready to support the complete email change workflow with the new business logic! 