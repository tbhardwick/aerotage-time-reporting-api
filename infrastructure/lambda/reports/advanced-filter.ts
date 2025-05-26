import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCurrentUserId, getAuthenticatedUser } from '../shared/auth-helper';
import { createSuccessResponse, createErrorResponse } from '../shared/response-helper';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

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
  value: any;
  secondValue?: any; // For 'between' operator
  caseSensitive?: boolean;
  logicalOperator?: 'AND' | 'OR';
}

interface GroupByOptions {
  fields: string[];
  dateGrouping?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  customGrouping?: {
    field: string;
    ranges: { label: string; min?: number; max?: number; values?: any[] }[];
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
  data: any[];
  groupedData?: any[];
  aggregations?: { [key: string]: any };
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
    } catch (error) {
      return createErrorResponse(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // Validate required fields
    if (!filterRequest.dataSource || !filterRequest.filters) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'dataSource and filters are required',
          },
        }),
      };
    }

    // Validate data source
    const validDataSources = ['time-entries', 'projects', 'clients', 'users'];
    if (!validDataSources.includes(filterRequest.dataSource)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_DATA_SOURCE',
            message: `Data source must be one of: ${validDataSources.join(', ')}`,
          },
        }),
      };
    }

    // Apply role-based access control
    const accessControlledRequest = applyAccessControl(filterRequest, userId, userRole);

    // Execute advanced filtering
    const filteredData = await executeAdvancedFilter(accessControlledRequest, userId);
    
    const executionTime = Date.now() - startTime;
    filteredData.executionTime = executionTime;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: filteredData,
      }),
    };

  } catch (error) {
    console.error('Error in advanced filtering:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'FILTER_FAILED',
          message: 'Failed to execute advanced filter',
        },
      }),
    };
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

async function executeAdvancedFilter(request: AdvancedFilterRequest, userId: string): Promise<FilteredDataResponse> {
  const filterId = `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Get raw data from data source
  const rawData = await fetchDataFromSource(request.dataSource);
  
  // Apply filters
  const filteredData = applyFilters(rawData, request.filters);
  
  // Apply grouping if specified
  let groupedData: any[] | undefined;
  if (request.groupBy) {
    groupedData = applyGrouping(filteredData, request.groupBy);
  }

  // Apply aggregations if specified
  let aggregations: { [key: string]: any } | undefined;
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

  return {
    filterId,
    dataSource: request.dataSource,
    appliedFilters: request.filters,
    resultCount: filteredData.length,
    data: outputData,
    groupedData,
    aggregations,
    pagination: paginationInfo,
    executionTime: 0, // Will be set by caller
    generatedAt: new Date().toISOString(),
  };
}

async function fetchDataFromSource(dataSource: string): Promise<any[]> {
  let tableName: string;
  
  switch (dataSource) {
    case 'time-entries':
      tableName = process.env.TIME_ENTRIES_TABLE!;
      break;
    case 'projects':
      tableName = process.env.PROJECTS_TABLE!;
      break;
    case 'clients':
      tableName = process.env.CLIENTS_TABLE!;
      break;
    case 'users':
      tableName = process.env.USERS_TABLE!;
      break;
    default:
      throw new Error(`Unsupported data source: ${dataSource}`);
  }

  if (!tableName) {
    throw new Error(`Table name not configured for data source: ${dataSource}`);
  }

  try {
    const command = new ScanCommand({
      TableName: tableName,
    });
    
    const result = await docClient.send(command);
    return result.Items || [];
  } catch (error) {
    console.error(`Error fetching data from ${dataSource}:`, error);
    return [];
  }
}

function applyFilters(data: any[], filters: FilterCriteria[]): any[] {
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

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function evaluateFilter(value: any, filter: FilterCriteria): boolean {
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
        const regex = new RegExp(filterValue, caseSensitive ? 'g' : 'gi');
        return regex.test(stringValue);
      } catch {
        return false;
      }
    
    case 'date_range':
      const dateValue = new Date(value);
      const startDate = new Date(filterValue);
      const endDate = new Date(secondValue);
      return dateValue >= startDate && dateValue <= endDate;
    
    default:
      return false;
  }
}

function applyGrouping(data: any[], groupBy: GroupByOptions): any[] {
  const groups = new Map<string, any[]>();

  data.forEach(item => {
    let groupKey: string;

    if (groupBy.dateGrouping && groupBy.fields.length === 1) {
      // Date-based grouping
      const dateValue = new Date(getNestedValue(item, groupBy.fields[0]));
      groupKey = formatDateForGrouping(dateValue, groupBy.dateGrouping);
    } else if (groupBy.customGrouping) {
      // Custom range-based grouping
      const value = getNestedValue(item, groupBy.customGrouping.field);
      groupKey = findCustomGroup(value, groupBy.customGrouping.ranges);
    } else {
      // Standard field-based grouping
      groupKey = groupBy.fields.map(field => getNestedValue(item, field)).join('|');
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

function findCustomGroup(value: any, ranges: any[]): string {
  for (const range of ranges) {
    if (range.values && range.values.includes(value)) {
      return range.label;
    }
    if (range.min !== undefined && range.max !== undefined) {
      const numValue = Number(value);
      if (numValue >= range.min && numValue <= range.max) {
        return range.label;
      }
    }
  }
  return 'Other';
}

function applyAggregations(data: any[], aggregations: AggregationOptions[]): { [key: string]: any } {
  const results: { [key: string]: any } = {};

  aggregations.forEach(agg => {
    const values = data.map(item => getNestedValue(item, agg.field)).filter(v => v != null);
    const alias = agg.alias || `${agg.function}_${agg.field}`;

    switch (agg.function) {
      case 'sum':
        results[alias] = values.reduce((sum, val) => sum + Number(val), 0);
        break;
      
      case 'avg':
        results[alias] = values.length > 0 ? values.reduce((sum, val) => sum + Number(val), 0) / values.length : 0;
        break;
      
      case 'count':
        results[alias] = values.length;
        break;
      
      case 'distinct_count':
        results[alias] = new Set(values).size;
        break;
      
      case 'min':
        results[alias] = values.length > 0 ? Math.min(...values.map(Number)) : null;
        break;
      
      case 'max':
        results[alias] = values.length > 0 ? Math.max(...values.map(Number)) : null;
        break;
      
      case 'median':
        const sortedValues = values.map(Number).sort((a, b) => a - b);
        const mid = Math.floor(sortedValues.length / 2);
        results[alias] = sortedValues.length > 0 ? 
          (sortedValues.length % 2 === 0 ? 
            (sortedValues[mid - 1] + sortedValues[mid]) / 2 : 
            sortedValues[mid]) : null;
        break;
      
      case 'percentile':
        const percentile = agg.percentile || 50;
        const sortedPercentileValues = values.map(Number).sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sortedPercentileValues.length) - 1;
        results[alias] = sortedPercentileValues.length > 0 ? sortedPercentileValues[Math.max(0, index)] : null;
        break;
    }
  });

  return results;
}

function applySorting(data: any[], sorting: SortingOptions[]): any[] {
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

function applyPagination(data: any[], pagination: PaginationOptions): {
  data: any[];
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

function formatOutput(data: any[], groupedData: any[] | undefined, format: string): any[] {
  switch (format) {
    case 'summary':
      return data.map(item => {
        // Return only key fields for summary
        const summary: any = {};
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