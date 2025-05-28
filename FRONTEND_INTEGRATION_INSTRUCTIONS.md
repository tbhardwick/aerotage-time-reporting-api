# Frontend Integration Instructions - Aerotage Time Reporting API

## 🚀 Quick Start

The Aerotage Time Reporting API is now deployed with a custom domain and ready for frontend integration. This document provides everything your frontend team needs to integrate with our complete business management solution.

## 🌐 API Endpoints

### **Production-Ready Custom Domain**
- **Base URL**: `https://time-api-dev.aerotage.com`
- **Environment**: Development (production-ready)
- **Status**: ✅ **LIVE and OPERATIONAL**

### **Backup URL** (if needed)
- **Fallback URL**: `https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev`

## 🔐 Authentication Setup

### **Cognito Configuration**
```javascript
const cognitoConfig = {
  userPoolId: 'us-east-1_EsdlgX9Qg',
  userPoolWebClientId: '148r35u6uultp1rmfdu22i8amb',
  region: 'us-east-1',
  identityPoolId: 'us-east-1:d79776bb-4b8e-4654-a10a-a45b1adaa787'
};
```

### **Authentication Flow**
1. **Login**: Use AWS Cognito SDK to authenticate users
2. **Get Token**: Extract the `AccessToken` from the authentication result
3. **API Calls**: Include token in Authorization header: `Bearer ${accessToken}`

### **Example Authentication Code**
```javascript
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

const userPool = new CognitoUserPool({
  UserPoolId: 'us-east-1_EsdlgX9Qg',
  ClientId: '148r35u6uultp1rmfdu22i8amb'
});

// Login function
async function login(email, password) {
  return new Promise((resolve, reject) => {
    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password
    });

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool
    });

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        const accessToken = result.getAccessToken().getJwtToken();
        resolve({ accessToken, user: result });
      },
      onFailure: (err) => reject(err)
    });
  });
}
```

## 📡 API Integration

### **Base API Client Setup**
```javascript
class AerotageAPI {
  constructor() {
    this.baseURL = 'https://time-api-dev.aerotage.com';
    this.accessToken = null;
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed');
    }

    return data;
  }
}

// Usage
const api = new AerotageAPI();
api.setAccessToken(accessToken);
```

## 🏗️ Complete API Reference

### **1. User Management**
```javascript
// Get user profile
const profile = await api.request(`/users/${userId}/profile`);

// Update user profile
const updatedProfile = await api.request(`/users/${userId}/profile`, {
  method: 'PUT',
  body: JSON.stringify({
    name: 'John Doe',
    jobTitle: 'Developer',
    department: 'Engineering'
  })
});

// Get user preferences
const preferences = await api.request(`/users/${userId}/preferences`);

// Update user preferences
const updatedPreferences = await api.request(`/users/${userId}/preferences`, {
  method: 'PUT',
  body: JSON.stringify({
    theme: 'dark',
    notifications: true,
    timezone: 'America/New_York'
  })
});
```

### **2. Time Entry Management**
```javascript
// Get time entries
const timeEntries = await api.request('/time-entries', {
  method: 'GET'
});

// Create time entry
const newTimeEntry = await api.request('/time-entries', {
  method: 'POST',
  body: JSON.stringify({
    projectId: 'project_123',
    description: 'Working on frontend integration',
    date: '2025-05-28',
    duration: 480, // minutes
    billable: true,
    tags: ['frontend', 'integration']
  })
});

// Update time entry
const updatedTimeEntry = await api.request(`/time-entries/${entryId}`, {
  method: 'PUT',
  body: JSON.stringify({
    description: 'Updated description',
    duration: 360
  })
});

// Submit time entries for approval
const submitResult = await api.request('/time-entries/submit', {
  method: 'POST',
  body: JSON.stringify({
    timeEntryIds: ['entry_1', 'entry_2']
  })
});
```

### **3. Project Management**
```javascript
// Get projects
const projects = await api.request('/projects');

// Create project
const newProject = await api.request('/projects', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Website Redesign',
    clientId: 'client_123',
    clientName: 'Acme Corp',
    status: 'active',
    defaultBillable: true,
    teamMembers: ['user_1', 'user_2'],
    tags: ['web', 'design'],
    defaultHourlyRate: 85,
    budget: {
      type: 'hours',
      value: 200,
      spent: 0
    }
  })
});

// Update project
const updatedProject = await api.request(`/projects/${projectId}`, {
  method: 'PUT',
  body: JSON.stringify({
    status: 'completed'
  })
});
```

### **4. Client Management**
```javascript
// Get clients
const clients = await api.request('/clients');

// Create client
const newClient = await api.request('/clients', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Acme Corporation',
    email: 'contact@acme.com',
    phone: '+1-555-0123',
    address: '123 Business St, City, State 12345',
    contactPerson: 'John Smith',
    defaultHourlyRate: 85,
    isActive: true,
    notes: 'Important client'
  })
});
```

### **5. Reporting & Analytics**
```javascript
// Generate time report
const timeReport = await api.request('/reports/time', {
  method: 'POST',
  body: JSON.stringify({
    startDate: '2025-05-01',
    endDate: '2025-05-31',
    groupBy: 'user',
    includeDetails: true
  })
});

// Generate enhanced dashboard
const dashboard = await api.request('/analytics/dashboard/enhanced', {
  method: 'POST',
  body: JSON.stringify({
    timeframe: 'month',
    realTime: true,
    includeForecasting: true,
    includeBenchmarks: true
  })
});

// Export report
const exportResult = await api.request('/reports/export', {
  method: 'POST',
  body: JSON.stringify({
    reportType: 'time',
    format: 'pdf',
    startDate: '2025-05-01',
    endDate: '2025-05-31'
  })
});
```

### **6. Invoice Management**
```javascript
// Get invoices
const invoices = await api.request('/invoices');

// Generate invoice
const newInvoice = await api.request('/invoices', {
  method: 'POST',
  body: JSON.stringify({
    clientId: 'client_123',
    projectIds: ['project_1', 'project_2'],
    issueDate: '2025-05-28',
    dueDate: '2025-06-28',
    paymentTerms: 'Net 30',
    currency: 'USD',
    taxRate: 0.08
  })
});

// Send invoice
const sendResult = await api.request(`/invoices/${invoiceId}/send`, {
  method: 'POST',
  body: JSON.stringify({
    recipientEmails: ['client@example.com'],
    subject: 'Invoice for May 2025',
    attachPdf: true
  })
});
```

## 🎨 UI Integration Examples

### **Time Entry Form Component**
```jsx
import React, { useState } from 'react';

const TimeEntryForm = ({ onSubmit, projects }) => {
  const [formData, setFormData] = useState({
    projectId: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    duration: '',
    billable: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await api.request('/time-entries', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          duration: parseInt(formData.duration) * 60 // convert hours to minutes
        })
      });
      onSubmit(result.data);
    } catch (error) {
      console.error('Failed to create time entry:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <select 
        value={formData.projectId} 
        onChange={(e) => setFormData({...formData, projectId: e.target.value})}
        required
      >
        <option value="">Select Project</option>
        {projects.map(project => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      
      <input
        type="text"
        placeholder="Description"
        value={formData.description}
        onChange={(e) => setFormData({...formData, description: e.target.value})}
        required
      />
      
      <input
        type="date"
        value={formData.date}
        onChange={(e) => setFormData({...formData, date: e.target.value})}
        required
      />
      
      <input
        type="number"
        placeholder="Hours"
        value={formData.duration}
        onChange={(e) => setFormData({...formData, duration: e.target.value})}
        step="0.25"
        min="0"
        required
      />
      
      <label>
        <input
          type="checkbox"
          checked={formData.billable}
          onChange={(e) => setFormData({...formData, billable: e.target.checked})}
        />
        Billable
      </label>
      
      <button type="submit">Create Time Entry</button>
    </form>
  );
};
```

### **Dashboard Component**
```jsx
import React, { useState, useEffect } from 'react';

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.request('/analytics/dashboard/enhanced', {
          method: 'POST',
          body: JSON.stringify({
            timeframe: 'month',
            realTime: true,
            includeForecasting: true
          })
        });
        setDashboardData(response.data);
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="dashboard">
      <div className="summary-cards">
        <div className="card">
          <h3>Total Revenue</h3>
          <p>${dashboardData.summary.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="card">
          <h3>Total Hours</h3>
          <p>{dashboardData.summary.totalHours}</p>
        </div>
        <div className="card">
          <h3>Active Projects</h3>
          <p>{dashboardData.summary.activeProjects}</p>
        </div>
        <div className="card">
          <h3>Team Utilization</h3>
          <p>{dashboardData.summary.teamUtilization}%</p>
        </div>
      </div>
      
      {dashboardData.alerts.length > 0 && (
        <div className="alerts">
          <h3>Alerts</h3>
          {dashboardData.alerts.map(alert => (
            <div key={alert.id} className={`alert alert-${alert.type}`}>
              <strong>{alert.title}</strong>
              <p>{alert.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

## 🔧 Error Handling

### **Standard Error Response Format**
```javascript
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  },
  "timestamp": "2025-05-28T12:00:00.000Z"
}
```

### **Error Handling Example**
```javascript
async function handleAPICall(apiCall) {
  try {
    const result = await apiCall();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('API Error:', error);
    
    // Handle specific error codes
    if (error.message.includes('UNAUTHORIZED')) {
      // Redirect to login
      window.location.href = '/login';
    } else if (error.message.includes('VALIDATION')) {
      // Show validation errors to user
      showValidationErrors(error.message);
    } else {
      // Show generic error
      showErrorMessage('An unexpected error occurred. Please try again.');
    }
    
    return { success: false, error: error.message };
  }
}
```

## 📊 Real-time Features

### **WebSocket Alternative (Polling)**
```javascript
class RealTimeUpdates {
  constructor(api) {
    this.api = api;
    this.intervals = new Map();
  }

  startPolling(endpoint, callback, interval = 30000) {
    const intervalId = setInterval(async () => {
      try {
        const data = await this.api.request(endpoint);
        callback(data);
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, interval);

    this.intervals.set(endpoint, intervalId);
  }

  stopPolling(endpoint) {
    const intervalId = this.intervals.get(endpoint);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(endpoint);
    }
  }
}

// Usage
const realTime = new RealTimeUpdates(api);
realTime.startPolling('/analytics/real-time', (data) => {
  updateDashboard(data);
}, 30000); // Poll every 30 seconds
```

## 🧪 Testing

### **Test Credentials**
```javascript
const testUser = {
  email: 'bhardwick@aerotage.com',
  password: 'Aerotage*2025'
};
```

### **API Health Check**
```javascript
// Test API connectivity
async function testAPIConnection() {
  try {
    const response = await fetch('https://time-api-dev.aerotage.com/health');
    const data = await response.json();
    console.log('API Status:', data);
    return data.success;
  } catch (error) {
    console.error('API connection failed:', error);
    return false;
  }
}
```

## 📚 Additional Resources

### **Interactive API Documentation**
- **Swagger UI**: Available at the custom domain (coming soon)
- **OpenAPI Spec**: Complete API specification with examples

### **Environment Variables**
```javascript
// .env file
REACT_APP_API_BASE_URL=https://time-api-dev.aerotage.com
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_EsdlgX9Qg
REACT_APP_COGNITO_CLIENT_ID=148r35u6uultp1rmfdu22i8amb
REACT_APP_COGNITO_REGION=us-east-1
REACT_APP_COGNITO_IDENTITY_POOL_ID=us-east-1:d79776bb-4b8e-4654-a10a-a45b1adaa787
```

### **TypeScript Types** (Optional)
```typescript
interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  description: string;
  date: string;
  duration: number; // in minutes
  billable: boolean;
  hourlyRate?: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  defaultBillable: boolean;
  teamMembers: string[];
  tags: string[];
  defaultHourlyRate?: number;
  budget?: {
    type: 'hours' | 'amount';
    value: number;
    spent: number;
  };
  createdAt: string;
  updatedAt: string;
}
```

## 🚀 Deployment Checklist

- [ ] Set up Cognito authentication
- [ ] Configure API base URL
- [ ] Implement error handling
- [ ] Add loading states
- [ ] Test all major workflows
- [ ] Implement real-time updates (polling)
- [ ] Add proper TypeScript types
- [ ] Set up environment variables
- [ ] Test with provided credentials
- [ ] Implement logout functionality

## 🆘 Support

If you encounter any issues:

1. **Check API Status**: Test the health endpoint
2. **Verify Authentication**: Ensure tokens are valid
3. **Check Network**: Verify CORS and network connectivity
4. **Review Logs**: Check browser console for errors
5. **Contact Backend Team**: For API-specific issues

## 📈 Performance Tips

1. **Caching**: Implement client-side caching for frequently accessed data
2. **Pagination**: Use limit/offset parameters for large datasets
3. **Debouncing**: Debounce search and filter inputs
4. **Lazy Loading**: Load data as needed
5. **Error Boundaries**: Implement React error boundaries
6. **Optimistic Updates**: Update UI immediately, sync with server

---

**API Status**: ✅ **LIVE and READY**  
**Last Updated**: May 28, 2025  
**Version**: 1.0.0  

The Aerotage Time Reporting API provides a complete, enterprise-grade business management solution with 46+ endpoints across time tracking, project management, client management, reporting, analytics, and invoicing. Start integrating today! 