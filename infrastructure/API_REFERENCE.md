# Aerotage Time Reporting API - Endpoint Reference

## 🌐 Base URL
```
https://<api-gateway-id>.execute-api.<region>.amazonaws.com/<stage>
```

## 🔐 Authentication
All endpoints require AWS Cognito authentication using Bearer tokens:
```
Authorization: Bearer <cognito-jwt-token>
```

## 👥 User Management APIs

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/users` | List all users | Admin, Manager |
| POST | `/users` | Create new user | Admin |
| GET | `/users/{id}` | Get user by ID | Admin, Manager, Own Profile |
| PUT | `/users/{id}` | Update user profile | Admin, Own Profile |
| DELETE | `/users/{id}` | Delete/deactivate user | Admin |
| POST | `/users/invite` | Send user invitation | Admin |

### User Object Structure
```typescript
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'employee';
  hourlyRate?: number;
  teamId?: string;
  department?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## 👥 Team Management APIs

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/teams` | List all teams | Admin, Manager |
| POST | `/teams` | Create new team | Admin, Manager |
| PUT | `/teams/{id}` | Update team details | Admin, Manager |
| DELETE | `/teams/{id}` | Delete team | Admin |

### Team Object Structure
```typescript
interface Team {
  id: string;
  name: string;
  description?: string;
  managerId: string;
  memberIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## 📋 Project Management APIs

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/projects` | List projects | All Users |
| POST | `/projects` | Create new project | Admin, Manager |
| PUT | `/projects/{id}` | Update project | Admin, Manager |
| DELETE | `/projects/{id}` | Delete project | Admin |

### Project Object Structure
```typescript
interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  budget?: {
    hours?: number;
    amount?: number;
  };
  hourlyRate: number;
  status: 'active' | 'inactive' | 'completed';
  createdAt: string;
  updatedAt: string;
}
```

## 🏢 Client Management APIs

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/clients` | List all clients | All Users |
| POST | `/clients` | Create new client | Admin, Manager |
| PUT | `/clients/{id}` | Update client | Admin, Manager |
| DELETE | `/clients/{id}` | Delete client | Admin |

### Client Object Structure
```typescript
interface Client {
  id: string;
  name: string;
  contactInfo: {
    email?: string;
    phone?: string;
    address?: string;
  };
  billingAddress?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## ⏱️ Time Entry APIs

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/time-entries` | List time entries | Own Entries, Manager (Team), Admin (All) |
| POST | `/time-entries` | Create time entry | Employee, Manager, Admin |
| PUT | `/time-entries/{id}` | Update time entry | Entry Owner (if draft) |
| DELETE | `/time-entries/{id}` | Delete time entry | Entry Owner (if draft) |
| POST | `/time-entries/submit` | Submit for approval | Entry Owner |
| POST | `/time-entries/approve` | Approve time entries | Manager, Admin |
| POST | `/time-entries/reject` | Reject time entries | Manager, Admin |

### Time Entry Object Structure
```typescript
interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  date: string;
  duration: number; // minutes
  description: string;
  isBillable: boolean;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}
```

## 📊 Reporting APIs

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/reports/time` | Time reports with filtering | All Users |
| GET | `/reports/projects` | Project-based reports | Manager, Admin |
| GET | `/reports/users` | User productivity reports | Manager, Admin |
| POST | `/reports/export` | Generate report exports | All Users |
| GET | `/reports/analytics` | Analytics and chart data | All Users |

### Query Parameters for Reports
```typescript
interface ReportFilters {
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  projectId?: string;
  clientId?: string;
  userId?: string;
  status?: 'draft' | 'submitted' | 'approved' | 'rejected';
  isBillable?: boolean;
  format?: 'json' | 'csv' | 'excel' | 'pdf';
}
```

## 🧾 Invoice APIs

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/invoices` | List invoices | Manager, Admin |
| POST | `/invoices` | Generate new invoice | Manager, Admin |
| PUT | `/invoices/{id}` | Update invoice | Manager, Admin |
| POST | `/invoices/{id}/send` | Send invoice via email | Manager, Admin |
| PUT | `/invoices/{id}/status` | Update invoice status | Manager, Admin |

### Invoice Object Structure
```typescript
interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  projectIds: string[];
  timeEntryIds: string[];
  amount: number;
  tax?: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issueDate: string;
  dueDate: string;
  sentDate?: string;
  paidDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

## 🔍 Common Query Parameters

### Pagination
```typescript
interface PaginationParams {
  limit?: number; // default: 50, max: 100
  offset?: number; // default: 0
  sortBy?: string; // field name
  sortOrder?: 'asc' | 'desc'; // default: 'desc'
}
```

### Filtering
```typescript
interface FilterParams {
  search?: string; // text search
  status?: string; // status filter
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  isActive?: boolean; // active/inactive filter
}
```

## 📝 Response Format

### Success Response
```typescript
interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}
```

### Error Response
```typescript
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

## 🚨 HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

## 🔐 Permission Matrix

| Role | Users | Teams | Projects | Clients | Time Entries | Reports | Invoices |
|------|-------|-------|----------|---------|--------------|---------|----------|
| **Admin** | Full | Full | Full | Full | All | All | Full |
| **Manager** | Team | Team | Full | Full | Team | Team | Full |
| **Employee** | Own | View | View | View | Own | Own | None |

## 🌐 CORS Configuration

The API is configured to allow cross-origin requests from your frontend domain:

```javascript
// Headers included in all responses
{
  "Access-Control-Allow-Origin": "*", // Configure for production
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
}
```

## 📱 Frontend Integration Example

```typescript
// API client example
class AerotageApiClient {
  constructor(private baseUrl: string, private authToken: string) {}

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  // Example usage
  async getTimeEntries(filters: ReportFilters) {
    const params = new URLSearchParams(filters as any);
    return this.request<TimeEntry[]>(`/time-entries?${params}`);
  }

  async createTimeEntry(entry: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.request<TimeEntry>('/time-entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }
}
```

---

**📚 Additional Resources:**
- [AWS API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [AWS Cognito Authentication](https://docs.aws.amazon.com/cognito/)
- [Frontend Integration Guide](./FRONTEND_INTEGRATION.md)

**🔧 Testing:**
Use tools like Postman, curl, or your frontend application to test the API endpoints. Remember to include proper authentication headers for all requests. 