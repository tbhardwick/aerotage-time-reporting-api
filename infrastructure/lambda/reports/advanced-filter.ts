import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createErrorResponse, createSuccessResponse } from '../shared/response-helper';
import { TimeEntryRepository } from '../shared/time-entry-repository';
import { UserRepository } from '../shared/user-repository';

// MANDATORY: Use repository pattern instead of direct DynamoDB
const timeEntryRepo = new TimeEntryRepository();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const userRepo = new UserRepository();

interface AdvancedFilterRequest {
  dataSource: 'time-entries' | 'projects' | 'clients' | 'users';
  filters: FilterCriteria[];
  groupBy?: GroupByOptions;
  aggregations?: AggregationOptions[];
  sorting?: SortingOptions[];
  pagination?: PaginationOptions;
  outputFormat?: 'detailed' | 'summary' | 'grouped';
}

interface FilterCriteria {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 
           'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'between' | 'in' | 'not_in' |
           'is_null' | 'is_not_null' | 'regex' | 'date_range';
  value: unknown;
  secondValue?: unknown; // For 'between' operator
  caseSensitive?: boolean;
  logicalOperator?: 'AND' | 'OR';
}

interface GroupByOptions {
  fields: string[];
  dateGrouping?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  customGrouping?: {
    field: string;
    ranges: { label: string; min?: number; max?: number; values?: unknown[] }[];
  };
}

interface AggregationOptions {
  field: string;
  function: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct_count' | 'median' | 'percentile';
  percentile?: number; // For percentile function
  alias?: string;
}

interface SortingOptions {
  field: string;
  direction: 'asc' | 'desc';
  nullsFirst?: boolean;
}

interface PaginationOptions {
  limit: number;
  offset: number;
  cursor?: string;
}

interface FilteredDataResponse {
  filterId: string;
  dataSource: string;
  appliedFilters: FilterCriteria[];
  resultCount: number;
  data: Record<string, unknown>[];
  groupedData?: Record<string, unknown>[];
  aggregations?: Record<string, unknown>;
  pagination?: {
    hasMore: boolean;
    nextCursor?: string;
    totalCount: number;
  };
  executionTime: number;
  generatedAt: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  
  try {
    console.log('Advanced filter request:', JSON.stringify(event, null, 2));

    // Extract user info from authorizer context
    const userId = getCurrentUserId(event);
    const user = getAuthenticatedUser(event);
    const userRole = user?.role || 'employee';
    
    if (!userId) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User authentication required');
    }

    // Parse request body
    let filterRequest: AdvancedFilterRequest;
    try {
      filterRequest = JSON.parse(event.body || '{}');
    } catch {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate required fields
    if (!filterRequest.dataSource || !filterRequest.filters) {
      return createErrorResponse(400, 'MISSING_REQUIRED_FIELDS', 'dataSource and filters are required');
    }

    // Validate data source
    const validDataSources = ['time-entries', 'projects', 'clients', 'users'];
    if (!validDataSources.includes(filterRequest.dataSource)) {
      return createErrorResponse(400, 'INVALID_DATA_SOURCE', `Data source must be one of: ${validDataSources.join(', ')}`);
    }

    // Apply role-based access control
    const accessControlledRequest = applyAccessControl(filterRequest, userId, userRole);

    // Execute advanced filtering
    const filteredData = await executeAdvancedFilter(accessControlledRequest, userId);
    
    const executionTime = Date.now() - startTime;
    filteredData.executionTime = executionTime;

    return createSuccessResponse(filteredData);

  } catch (error) {
    console.error('Error in advanced filtering:', error);
    
    return createErrorResponse(500, 'FILTER_FAILED', 'Failed to execute advanced filter');
  }
};

function applyAccessControl(request: AdvancedFilterRequest, userId: string, userRole: string): AdvancedFilterRequest {
  // Apply role-based filtering
  if (userRole === 'employee') {
    // Employees can only see their own data
    const userFilter: FilterCriteria = {
      field: 'userId',
      operator: 'equals',
      value: userId,
      logicalOperator: 'AND',
    };
    
    request.filters.push(userFilter);
  }

  return request;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function executeAdvancedFilter(request: AdvancedFilterRequest, userId: string): Promise<FilteredDataResponse> {
  const startTime = Date.now();
  
  const filterId = `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Get raw data from data source
  const rawData = await fetchDataFromSource(request.dataSource);
  
  // Apply filters
  const filteredData = applyFilters(rawData, request.filters);
  
  // Apply grouping if specified
  let groupedData: Record<string, unknown>[] | undefined;
  if (request.groupBy) {
    groupedData = applyGrouping(filteredData, request.groupBy);
  }

  // Apply aggregations if specified
  let aggregations: Record<string, unknown> | undefined;
  if (request.aggregations && request.aggregations.length > 0) {
    aggregations = applyAggregations(filteredData, request.aggregations);
  }

  // Apply sorting
  let sortedData = filteredData;
  if (request.sorting && request.sorting.length > 0) {
    sortedData = applySorting(filteredData, request.sorting);
  }

  // Apply pagination
  let paginatedData = sortedData;
  let paginationInfo;
  if (request.pagination) {
    const paginationResult = applyPagination(sortedData, request.pagination);
    paginatedData = paginationResult.data;
    paginationInfo = paginationResult.pagination;
  }

  // Format output based on requested format
  const outputData = formatOutput(paginatedData, groupedData, request.outputFormat || 'detailed');

  const executionTime = Date.now() - startTime;

  return {
    filterId,
    dataSource: request.dataSource,
    appliedFilters: request.filters,
    resultCount: filteredData.length,
    data: outputData,
    groupedData,
    aggregations,
    pagination: paginationInfo,
    executionTime,
    generatedAt: new Date().toISOString(),
  };
}

async function fetchDataFromSource(dataSource: string): Promise<Record<string, unknown>[]> {
  try {
    switch (dataSource) {
      case 'time-entries':
        // Use TimeEntryRepository instead of direct DynamoDB access
        const result = await timeEntryRepo.listTimeEntries({});
        return result.items as unknown as Record<string, unknown>[];
      
      case 'projects':
        // Mock projects data - in production, create ProjectRepository
        return [
          { id: 'proj1', name: 'Project Alpha', status: 'active', clientId: 'client1' },
          { id: 'proj2', name: 'Project Beta', status: 'completed', clientId: 'client2' },
          { id: 'proj3', name: 'Project Gamma', status: 'active', clientId: 'client1' },
        ];
      
      case 'clients':
        // Mock clients data - in production, create ClientRepository
        return [
          { id: 'client1', name: 'Acme Corp', isActive: true },
          { id: 'client2', name: 'Beta Inc', isActive: true },
          { id: 'client3', name: 'Gamma LLC', isActive: false },
        ];
      
      case 'users':
        // Mock users data - in production, implement getUsersList in UserRepository
        return [
          { id: 'user1', name: 'John Doe', role: 'employee', department: 'Development' },
          { id: 'user2', name: 'Jane Smith', role: 'manager', department: 'Design' },
          { id: 'user3', name: 'Bob Johnson', role: 'admin', department: 'Operations' },
        ];
      
      default:
        throw new Error(`Unsupported data source: ${dataSource}`);
    }
  } catch (error) {
    console.error(`Error fetching data from ${dataSource}:`, error);
    return [];
  }
}

function applyFilters(data: Record<string, unknown>[], filters: FilterCriteria[]): Record<string, unknown>[] {
  return data.filter(item => {
    let result = true;
    let currentLogicalOperator = 'AND';

    for (const filter of filters) {
      const fieldValue = getNestedValue(item, filter.field);
      const filterResult = evaluateFilter(fieldValue, filter);

      if (currentLogicalOperator === 'AND') {
        result = result && filterResult;
      } else {
        result = result || filterResult;
      }

      currentLogicalOperator = filter.logicalOperator || 'AND';
    }

    return result;
  });
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current, key) => current?.[key as keyof typeof current], obj);
}

function evaluateFilter(value: unknown, filter: FilterCriteria): boolean {
  const { operator, value: filterValue, secondValue, caseSensitive = true } = filter;

  // Handle null/undefined values
  if (operator === 'is_null') {
    return value == null;
  }
  if (operator === 'is_not_null') {
    return value != null;
  }
  if (value == null) {
    return false;
  }

  // Convert to string for string operations if needed
  let stringValue = String(value);
  let stringFilterValue = String(filterValue);
  
  if (!caseSensitive) {
    stringValue = stringValue.toLowerCase();
    stringFilterValue = stringFilterValue.toLowerCase();
  }

  switch (operator) {
    case 'equals':
      return value === filterValue;
    
    case 'not_equals':
      return value !== filterValue;
    
    case 'contains':
      return stringValue.includes(stringFilterValue);
    
    case 'not_contains':
      return !stringValue.includes(stringFilterValue);
    
    case 'starts_with':
      return stringValue.startsWith(stringFilterValue);
    
    case 'ends_with':
      return stringValue.endsWith(stringFilterValue);
    
    case 'greater_than':
      return Number(value) > Number(filterValue);
    
    case 'less_than':
      return Number(value) < Number(filterValue);
    
    case 'greater_equal':
      return Number(value) >= Number(filterValue);
    
    case 'less_equal':
      return Number(value) <= Number(filterValue);
    
    case 'between':
      const numValue = Number(value);
      return numValue >= Number(filterValue) && numValue <= Number(secondValue);
    
    case 'in':
      return Array.isArray(filterValue) && filterValue.includes(value);
    
    case 'not_in':
      return Array.isArray(filterValue) && !filterValue.includes(value);
    
    case 'regex':
      try {
        const regex = new RegExp(String(filterValue), caseSensitive ? 'g' : 'gi');
        return regex.test(stringValue);
      } catch {
        return false;
      }
    
    case 'date_range':
      const dateValue = new Date(String(value));
      const startDate = new Date(String(filterValue));
      const endDate = new Date(String(secondValue));
      return dateValue >= startDate && dateValue <= endDate;
    
    default:
      return false;
  }
}

function applyGrouping(data: Record<string, unknown>[], groupBy: GroupByOptions): Record<string, unknown>[] {
  const groups = new Map<string, Record<string, unknown>[]>();

  data.forEach(item => {
    let groupKey: string;

    if (groupBy.dateGrouping && groupBy.fields.length === 1) {
      // Date-based grouping
      const dateValue = new Date(getNestedValue(item, groupBy.fields[0]) as string);
      groupKey = formatDateForGrouping(dateValue, groupBy.dateGrouping);
    } else if (groupBy.customGrouping) {
      // Custom range-based grouping
      const value = getNestedValue(item, groupBy.customGrouping.field);
      groupKey = findCustomGroup(value, groupBy.customGrouping.ranges);
    } else {
      // Standard field-based grouping
      groupKey = groupBy.fields.map(field => getNestedValue(item, field) as string).join('|');
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(item);
  });

  return Array.from(groups.entries()).map(([key, items]) => ({
    groupKey: key,
    count: items.length,
    items,
  }));
}

function formatDateForGrouping(date: Date, grouping: string): string {
  switch (grouping) {
    case 'day':
      return date.toISOString().split('T')[0];
    case 'week':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return `Week of ${weekStart.toISOString().split('T')[0]}`;
    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    case 'quarter':
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${quarter}`;
    case 'year':
      return String(date.getFullYear());
    default:
      return date.toISOString().split('T')[0];
  }
}

function findCustomGroup(value: unknown, ranges: Record<string, unknown>[]): string {
  for (const range of ranges) {
    if (range.values && Array.isArray(range.values) && range.values.includes(value)) {
      return range.label as string;
    }
    if (range.min !== undefined && range.max !== undefined) {
      const numValue = Number(value);
      if (numValue >= Number(range.min) && numValue <= Number(range.max)) {
        return range.label as string;
      }
    }
  }
  return 'Other';
}

function applyAggregations(data: Record<string, unknown>[], aggregations: AggregationOptions[]): Record<string, unknown> {
  const results: Record<string, unknown> = {};

  aggregations.forEach(agg => {
    const values = data.map(item => getNestedValue(item, agg.field)).filter(v => v != null);
    const numericValues = values.map(val => Number(val)); // Convert to numbers first
    const alias = agg.alias || `${agg.function}_${agg.field}`;

    switch (agg.function) {
      case 'sum':
        results[alias] = numericValues.reduce((sum, val) => sum + val, 0);
        break;
      
      case 'avg':
        results[alias] = numericValues.length > 0 ? numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length : 0;
        break;
      
      case 'count':
        results[alias] = values.length;
        break;
      
      case 'distinct_count':
        results[alias] = new Set(values).size;
        break;
      
      case 'min':
        results[alias] = numericValues.length > 0 ? Math.min(...numericValues) : null;
        break;
      
      case 'max':
        results[alias] = numericValues.length > 0 ? Math.max(...numericValues) : null;
        break;
      
      case 'median':
        const sortedValues = numericValues.sort((a, b) => a - b);
        const mid = Math.floor(sortedValues.length / 2);
        results[alias] = sortedValues.length > 0 ? 
          (sortedValues.length % 2 === 0 ? 
            (sortedValues[mid - 1] + sortedValues[mid]) / 2 : 
            sortedValues[mid]) : null;
        break;
      
      case 'percentile':
        const percentile = agg.percentile || 50;
        const sortedPercentileValues = numericValues.sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sortedPercentileValues.length) - 1;
        results[alias] = sortedPercentileValues.length > 0 ? sortedPercentileValues[Math.max(0, index)] : null;
        break;
    }
  });

  return results;
}

function applySorting(data: Record<string, unknown>[], sorting: SortingOptions[]): Record<string, unknown>[] {
  return data.sort((a, b) => {
    for (const sort of sorting) {
      const aValue = getNestedValue(a, sort.field);
      const bValue = getNestedValue(b, sort.field);
      
      // Handle null values
      if (aValue == null && bValue == null) continue;
      if (aValue == null) return sort.nullsFirst ? -1 : 1;
      if (bValue == null) return sort.nullsFirst ? 1 : -1;
      
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else {
        comparison = Number(aValue) - Number(bValue);
      }
      
      if (comparison !== 0) {
        return sort.direction === 'desc' ? -comparison : comparison;
      }
    }
    return 0;
  });
}

function applyPagination(data: Record<string, unknown>[], pagination: PaginationOptions): {
  data: Record<string, unknown>[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    totalCount: number;
  };
} {
  const startIndex = pagination.offset;
  const endIndex = startIndex + pagination.limit;
  const paginatedData = data.slice(startIndex, endIndex);
  const hasMore = endIndex < data.length;

  return {
    data: paginatedData,
    pagination: {
      hasMore,
      nextCursor: hasMore ? (endIndex).toString() : undefined,
      totalCount: data.length,
    },
  };
}

function formatOutput(data: Record<string, unknown>[], groupedData: Record<string, unknown>[] | undefined, format: string): Record<string, unknown>[] {
  switch (format) {
    case 'summary':
      return data.map(item => {
        // Return only key fields for summary
        const summary: Record<string, unknown> = {};
        ['id', 'name', 'status', 'date', 'amount', 'hours'].forEach(field => {
          if (item[field] !== undefined) {
            summary[field] = item[field];
          }
        });
        return summary;
      });
    
    case 'grouped':
      return groupedData || data;
    
    case 'detailed':
    default:
      return data;
  }
} 