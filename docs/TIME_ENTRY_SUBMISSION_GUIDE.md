# Time Entry Submission Implementation Guide

## 🎯 **Overview**

This guide provides comprehensive instructions for frontend developers to implement the time entry submission process correctly according to the Aerotage Time Reporting API requirements. The submission process involves creating time entries, validating them, and submitting them for manager approval.

**Target Audience**: Frontend developers working on the Electron application  
**API Base URL**: `https://time-api-dev.aerotage.com/`  
**Authentication**: JWT tokens from AWS Cognito required for all endpoints

---

## 📋 **Time Entry Submission Workflow**

### **Process Overview**
1. **Create Time Entries** → Status: `draft`
2. **Validate Entries** → Check required fields and business rules
3. **Submit for Approval** → Status: `draft` → `submitted`
4. **Manager Review** → Status: `submitted` → `approved` or `rejected`
5. **Handle Results** → Update UI based on approval/rejection

### **Status Transitions**
```
draft → submitted → approved ✅
draft → submitted → rejected → draft (can be resubmitted)
```

**Important**: Only `draft` and `rejected` entries can be edited or deleted.

---

## 🔧 **API Endpoints Required**

### **Core Endpoints**
- `POST /time-entries` - Create time entry
- `PUT /time-entries/{id}` - Update time entry (draft/rejected only)
- `DELETE /time-entries/{id}` - Delete time entry (draft/rejected only)
- `POST /time-entries/submit` - Submit entries for approval
- `GET /time-entries` - List time entries with filtering

### **Manager-Only Endpoints**
- `POST /time-entries/approve` - Approve submitted entries
- `POST /time-entries/reject` - Reject submitted entries

---

## 📝 **Time Entry Data Structure**

### **Required Fields**
```typescript
interface CreateTimeEntryRequest {
  projectId: string;        // REQUIRED - Must be valid project ID
  description: string;      // REQUIRED - Work description (min 10 chars)
  date: string;            // REQUIRED - Format: YYYY-MM-DD
  duration: number;        // REQUIRED - Duration in minutes (min 1)
  isBillable?: boolean;    // Optional - Default: true
  hourlyRate?: number;     // Optional - Override project rate
  tags?: string[];         // Optional - Categorization tags
  notes?: string;          // Optional - Additional notes
}
```

### **Response Structure**
```typescript
interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  description: string;
  date: string;
  duration: number;
  isBillable: boolean;
  hourlyRate?: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  tags: string[];
  notes?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 🚀 **Implementation Examples**

### **1. Create Time Entry**

```typescript
// services/time-entry-service.ts
import { apiClient } from './api-client';

interface CreateTimeEntryRequest {
  projectId: string;
  description: string;
  date: string;
  duration: number;
  isBillable?: boolean;
  hourlyRate?: number;
  tags?: string[];
  notes?: string;
}

class TimeEntryService {
  async createTimeEntry(data: CreateTimeEntryRequest): Promise<TimeEntry> {
    // Validate required fields
    this.validateTimeEntry(data);
    
    try {
      const response = await apiClient.post<TimeEntry>('time-entries', data);
      return response;
    } catch (error) {
      throw this.handleTimeEntryError(error);
    }
  }

  private validateTimeEntry(data: CreateTimeEntryRequest): void {
    if (!data.projectId) {
      throw new Error('Project is required');
    }
    if (!data.description || data.description.trim().length < 10) {
      throw new Error('Description must be at least 10 characters');
    }
    if (!data.date || !this.isValidDate(data.date)) {
      throw new Error('Valid date is required (YYYY-MM-DD)');
    }
    if (!data.duration || data.duration < 1) {
      throw new Error('Duration must be at least 1 minute');
    }
    if (data.duration > 1440) { // 24 hours
      throw new Error('Duration cannot exceed 24 hours');
    }
  }

  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }
}

export const timeEntryService = new TimeEntryService();
```

### **2. Submit Time Entries for Approval**

```typescript
// services/time-entry-service.ts (continued)

interface SubmitTimeEntriesRequest {
  timeEntryIds: string[];
}

interface SubmitTimeEntriesResponse {
  successful: string[];
  failed: Array<{
    id: string;
    error: string;
  }>;
}

class TimeEntryService {
  async submitTimeEntries(entryIds: string[]): Promise<SubmitTimeEntriesResponse> {
    if (!entryIds || entryIds.length === 0) {
      throw new Error('At least one time entry must be selected');
    }

    // Validate entries can be submitted
    await this.validateEntriesForSubmission(entryIds);

    try {
      const response = await apiClient.post<SubmitTimeEntriesResponse>(
        'time-entries/submit',
        { timeEntryIds: entryIds }
      );
      
      return response;
    } catch (error) {
      throw this.handleSubmissionError(error);
    }
  }

  private async validateEntriesForSubmission(entryIds: string[]): Promise<void> {
    // Get current entries to validate status
    const entries = await this.getTimeEntriesByIds(entryIds);
    
    const invalidEntries = entries.filter(entry => 
      entry.status !== 'draft' && entry.status !== 'rejected'
    );
    
    if (invalidEntries.length > 0) {
      throw new Error(
        `Cannot submit entries that are not in draft or rejected status: ${
          invalidEntries.map(e => e.id).join(', ')
        }`
      );
    }

    // Validate required fields
    const incompleteEntries = entries.filter(entry =>
      !entry.description || 
      entry.description.trim().length < 10 ||
      !entry.projectId ||
      entry.duration < 1
    );

    if (incompleteEntries.length > 0) {
      throw new Error(
        `Some entries are incomplete and cannot be submitted: ${
          incompleteEntries.map(e => e.id).join(', ')
        }`
      );
    }
  }

  private async getTimeEntriesByIds(ids: string[]): Promise<TimeEntry[]> {
    // Implementation to fetch specific entries
    const promises = ids.map(id => this.getTimeEntry(id));
    return Promise.all(promises);
  }
}
```

### **3. React Component Example**

```typescript
// components/TimeEntrySubmission.tsx
import React, { useState, useEffect } from 'react';
import { timeEntryService } from '../services/time-entry-service';

interface TimeEntrySubmissionProps {
  selectedEntries: TimeEntry[];
  onSubmissionComplete: (result: SubmitTimeEntriesResponse) => void;
  onCancel: () => void;
}

export const TimeEntrySubmission: React.FC<TimeEntrySubmissionProps> = ({
  selectedEntries,
  onSubmissionComplete,
  onCancel
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    validateSelectedEntries();
  }, [selectedEntries]);

  const validateSelectedEntries = () => {
    const errors: string[] = [];

    // Check if any entries selected
    if (selectedEntries.length === 0) {
      errors.push('Please select at least one time entry to submit');
    }

    // Check entry status
    const invalidStatusEntries = selectedEntries.filter(
      entry => entry.status !== 'draft' && entry.status !== 'rejected'
    );
    if (invalidStatusEntries.length > 0) {
      errors.push(
        `${invalidStatusEntries.length} entries cannot be submitted (already submitted or approved)`
      );
    }

    // Check required fields
    const incompleteEntries = selectedEntries.filter(
      entry => !entry.description || 
               entry.description.trim().length < 10 ||
               !entry.projectId ||
               entry.duration < 1
    );
    if (incompleteEntries.length > 0) {
      errors.push(
        `${incompleteEntries.length} entries are incomplete and need to be fixed before submission`
      );
    }

    // Check for future dates
    const today = new Date().toISOString().split('T')[0];
    const futureEntries = selectedEntries.filter(entry => entry.date > today);
    if (futureEntries.length > 0) {
      errors.push(
        `${futureEntries.length} entries have future dates and cannot be submitted`
      );
    }

    setValidationErrors(errors);
  };

  const handleSubmit = async () => {
    if (validationErrors.length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const entryIds = selectedEntries.map(entry => entry.id);
      const result = await timeEntryService.submitTimeEntries(entryIds);
      
      onSubmissionComplete(result);
    } catch (error) {
      console.error('Submission failed:', error);
      setValidationErrors([error.message || 'Submission failed']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = validationErrors.length === 0 && selectedEntries.length > 0;

  return (
    <div className="time-entry-submission">
      <h3>Submit Time Entries for Approval</h3>
      
      <div className="submission-summary">
        <p>
          <strong>{selectedEntries.length}</strong> entries selected for submission
        </p>
        <p>
          Total Hours: <strong>
            {(selectedEntries.reduce((sum, entry) => sum + entry.duration, 0) / 60).toFixed(2)}
          </strong>
        </p>
      </div>

      {validationErrors.length > 0 && (
        <div className="validation-errors">
          <h4>Please fix the following issues:</h4>
          <ul>
            {validationErrors.map((error, index) => (
              <li key={index} className="error-item">{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="selected-entries">
        <h4>Entries to Submit:</h4>
        <div className="entries-list">
          {selectedEntries.map(entry => (
            <div key={entry.id} className="entry-item">
              <div className="entry-info">
                <span className="date">{entry.date}</span>
                <span className="description">{entry.description}</span>
                <span className="duration">{(entry.duration / 60).toFixed(2)}h</span>
                <span className={`status ${entry.status}`}>{entry.status}</span>
              </div>
              {(!entry.description || entry.description.length < 10) && (
                <div className="entry-error">Description too short</div>
              )}
              {entry.duration < 1 && (
                <div className="entry-error">Invalid duration</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="submission-actions">
        <button 
          type="button" 
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button 
          type="button" 
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="primary"
        >
          {isSubmitting ? 'Submitting...' : `Submit ${selectedEntries.length} Entries`}
        </button>
      </div>
    </div>
  );
};
```

### **4. Handling Submission Results**

```typescript
// components/SubmissionResultHandler.tsx
import React from 'react';

interface SubmissionResultHandlerProps {
  result: SubmitTimeEntriesResponse;
  onClose: () => void;
  onRetry?: (failedIds: string[]) => void;
}

export const SubmissionResultHandler: React.FC<SubmissionResultHandlerProps> = ({
  result,
  onClose,
  onRetry
}) => {
  const hasFailures = result.failed.length > 0;
  const allSuccessful = result.successful.length > 0 && result.failed.length === 0;

  return (
    <div className="submission-result">
      {allSuccessful && (
        <div className="success-message">
          <h3>✅ Submission Successful</h3>
          <p>
            <strong>{result.successful.length}</strong> time entries have been submitted for approval.
          </p>
          <p>Your manager will review and approve these entries.</p>
        </div>
      )}

      {hasFailures && (
        <div className="partial-success-message">
          <h3>⚠️ Partial Success</h3>
          {result.successful.length > 0 && (
            <p>
              <strong>{result.successful.length}</strong> entries submitted successfully.
            </p>
          )}
          <p>
            <strong>{result.failed.length}</strong> entries failed to submit:
          </p>
          
          <div className="failed-entries">
            {result.failed.map((failure, index) => (
              <div key={index} className="failure-item">
                <span className="entry-id">Entry {failure.id}:</span>
                <span className="error-message">{failure.error}</span>
              </div>
            ))}
          </div>

          {onRetry && (
            <button 
              onClick={() => onRetry(result.failed.map(f => f.id))}
              className="retry-button"
            >
              Fix and Retry Failed Entries
            </button>
          )}
        </div>
      )}

      <div className="result-actions">
        <button onClick={onClose} className="primary">
          {allSuccessful ? 'Done' : 'Close'}
        </button>
      </div>
    </div>
  );
};
```

### **5. Complete Time Entry Management Hook**

```typescript
// hooks/useTimeEntrySubmission.ts
import { useState, useCallback } from 'react';
import { timeEntryService } from '../services/time-entry-service';

export const useTimeEntrySubmission = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmitTimeEntriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitEntries = useCallback(async (entryIds: string[]) => {
    setIsSubmitting(true);
    setError(null);
    setSubmissionResult(null);

    try {
      const result = await timeEntryService.submitTimeEntries(entryIds);
      setSubmissionResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Submission failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setSubmissionResult(null);
    setError(null);
  }, []);

  return {
    submitEntries,
    isSubmitting,
    submissionResult,
    error,
    clearResults
  };
};
```

---

## ⚠️ **Important Business Rules**

### **Validation Requirements**
1. **Description**: Minimum 10 characters, descriptive of work performed
2. **Duration**: Minimum 1 minute, maximum 24 hours (1440 minutes)
3. **Date**: Cannot be future dates, must be valid YYYY-MM-DD format
4. **Project**: Must be a valid, active project ID
5. **Status**: Only `draft` and `rejected` entries can be submitted

### **Submission Rules**
1. **Batch Submission**: Multiple entries can be submitted together
2. **Partial Success**: Some entries may succeed while others fail
3. **Status Change**: Successfully submitted entries change to `submitted` status
4. **Immutability**: Submitted entries cannot be edited until approved/rejected

### **Manager Approval Rules**
1. **Role Requirement**: Only users with `manager` or `admin` role can approve/reject
2. **Bulk Operations**: Managers can approve/reject multiple entries at once
3. **Rejection Reason**: Required when rejecting entries
4. **Status Tracking**: Approval/rejection timestamps and user IDs are recorded

---

## 🚨 **Error Handling**

### **Common API Errors**

```typescript
// Error handling examples
const handleTimeEntryError = (error: any): Error => {
  switch (error.response?.data?.code) {
    case 'VALIDATION_ERROR':
      return new Error(`Invalid data: ${error.response.data.details?.reason || 'Please check your input'}`);
    
    case 'PROJECT_NOT_FOUND':
      return new Error('Selected project is not valid or has been deleted');
    
    case 'INVALID_STATUS_TRANSITION':
      return new Error('This time entry cannot be submitted in its current status');
    
    case 'FUTURE_DATE_NOT_ALLOWED':
      return new Error('Cannot create time entries for future dates');
    
    case 'DUPLICATE_TIME_ENTRY':
      return new Error('A time entry already exists for this project and time period');
    
    case 'INSUFFICIENT_PERMISSIONS':
      return new Error('You do not have permission to perform this action');
    
    case 'TIME_ENTRY_NOT_FOUND':
      return new Error('Time entry not found or has been deleted');
    
    default:
      return new Error(error.message || 'An unexpected error occurred');
  }
};
```

### **Validation Error Examples**

```typescript
// Frontend validation before API calls
const validateTimeEntryData = (data: CreateTimeEntryRequest): string[] => {
  const errors: string[] = [];

  if (!data.projectId?.trim()) {
    errors.push('Project selection is required');
  }

  if (!data.description?.trim()) {
    errors.push('Description is required');
  } else if (data.description.trim().length < 10) {
    errors.push('Description must be at least 10 characters');
  }

  if (!data.date) {
    errors.push('Date is required');
  } else {
    const entryDate = new Date(data.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    if (entryDate > today) {
      errors.push('Cannot create time entries for future dates');
    }
  }

  if (!data.duration || data.duration < 1) {
    errors.push('Duration must be at least 1 minute');
  } else if (data.duration > 1440) {
    errors.push('Duration cannot exceed 24 hours');
  }

  if (data.hourlyRate !== undefined && data.hourlyRate < 0) {
    errors.push('Hourly rate cannot be negative');
  }

  return errors;
};
```

---

## 📊 **Testing Examples**

### **Unit Test Example**

```typescript
// __tests__/time-entry-service.test.ts
import { timeEntryService } from '../services/time-entry-service';
import { apiClient } from '../services/api-client';

jest.mock('../services/api-client');

describe('TimeEntryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTimeEntry', () => {
    it('should create time entry with valid data', async () => {
      const mockEntry = {
        id: 'entry-123',
        projectId: 'project-456',
        description: 'Frontend development work',
        date: '2024-01-15',
        duration: 480,
        status: 'draft'
      };

      (apiClient.post as jest.Mock).mockResolvedValue(mockEntry);

      const result = await timeEntryService.createTimeEntry({
        projectId: 'project-456',
        description: 'Frontend development work',
        date: '2024-01-15',
        duration: 480
      });

      expect(result).toEqual(mockEntry);
      expect(apiClient.post).toHaveBeenCalledWith('time-entries', {
        projectId: 'project-456',
        description: 'Frontend development work',
        date: '2024-01-15',
        duration: 480
      });
    });

    it('should throw error for invalid description', async () => {
      await expect(
        timeEntryService.createTimeEntry({
          projectId: 'project-456',
          description: 'short',
          date: '2024-01-15',
          duration: 480
        })
      ).rejects.toThrow('Description must be at least 10 characters');
    });
  });

  describe('submitTimeEntries', () => {
    it('should submit valid entries', async () => {
      const mockResponse = {
        successful: ['entry-1', 'entry-2'],
        failed: []
      };

      (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await timeEntryService.submitTimeEntries(['entry-1', 'entry-2']);

      expect(result).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith('time-entries/submit', {
        timeEntryIds: ['entry-1', 'entry-2']
      });
    });
  });
});
```

---

## 🎯 **Best Practices**

### **1. User Experience**
- **Progressive Validation**: Validate fields as user types
- **Clear Error Messages**: Specific, actionable error messages
- **Batch Operations**: Allow users to submit multiple entries at once
- **Status Indicators**: Clear visual indicators for entry status
- **Confirmation Dialogs**: Confirm before submitting entries

### **2. Performance**
- **Debounced Validation**: Avoid excessive API calls during typing
- **Optimistic Updates**: Update UI immediately, handle errors gracefully
- **Pagination**: Load time entries in pages for better performance
- **Caching**: Cache project and client data to reduce API calls

### **3. Error Recovery**
- **Retry Logic**: Allow users to retry failed submissions
- **Partial Success Handling**: Handle mixed success/failure results
- **Offline Support**: Queue submissions when offline (if applicable)
- **Auto-save**: Save drafts automatically to prevent data loss

### **4. Security**
- **Input Sanitization**: Sanitize all user inputs before sending to API
- **Token Refresh**: Handle JWT token expiration gracefully
- **Permission Checks**: Validate user permissions before showing UI elements
- **Audit Trail**: Log important user actions for security

---

## 📚 **Additional Resources**

### **Related Documentation**
- **[API Reference](./API_REFERENCE.md)** - Complete endpoint documentation
- **[Frontend Integration Guide](./FRONTEND_INTEGRATION_GUIDE.md)** - General integration guide
- **[Daily/Weekly Time Tracking](./DAILY_WEEKLY_TIME_TRACKING_IMPLEMENTATION.md)** - Enhanced time tracking features

### **API Endpoints Reference**
- **Base URL**: `https://time-api-dev.aerotage.com/`
- **Authentication**: Include `Authorization: Bearer {jwt-token}` header
- **Content-Type**: `application/json` for all requests

### **Support**
For questions or issues with the time entry submission implementation, refer to the troubleshooting guide or contact the backend development team.

---

This guide provides everything needed to implement the time entry submission process correctly according to the API requirements. Follow these patterns and examples to ensure proper integration with the Aerotage Time Reporting API. 