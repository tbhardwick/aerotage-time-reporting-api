"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
var auth_helper_1 = require("../shared/auth-helper");
var response_helper_1 = require("../shared/response-helper");
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var dynamoClient = new client_dynamodb_1.DynamoDBClient({});
var docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var startTime, userId, user, userRole, filterRequest, validDataSources, accessControlledRequest, filteredData, executionTime, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                startTime = Date.now();
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                console.log('Advanced filter request:', JSON.stringify(event, null, 2));
                userId = (0, auth_helper_1.getCurrentUserId)(event);
                user = (0, auth_helper_1.getAuthenticatedUser)(event);
                userRole = (user === null || user === void 0 ? void 0 : user.role) || 'employee';
                if (!userId) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(401, 'UNAUTHORIZED', 'User authentication required')];
                }
                filterRequest = void 0;
                try {
                    filterRequest = JSON.parse(event.body || '{}');
                }
                catch (error) {
                    return [2 /*return*/, (0, response_helper_1.createErrorResponse)(400, 'INVALID_JSON', 'Invalid JSON in request body')];
                }
                // Validate required fields
                if (!filterRequest.dataSource || !filterRequest.filters) {
                    return [2 /*return*/, {
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
                        }];
                }
                validDataSources = ['time-entries', 'projects', 'clients', 'users'];
                if (!validDataSources.includes(filterRequest.dataSource)) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                            },
                            body: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'INVALID_DATA_SOURCE',
                                    message: "Data source must be one of: ".concat(validDataSources.join(', ')),
                                },
                            }),
                        }];
                }
                accessControlledRequest = applyAccessControl(filterRequest, userId, userRole);
                return [4 /*yield*/, executeAdvancedFilter(accessControlledRequest, userId)];
            case 2:
                filteredData = _a.sent();
                executionTime = Date.now() - startTime;
                filteredData.executionTime = executionTime;
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify({
                            success: true,
                            data: filteredData,
                        }),
                    }];
            case 3:
                error_1 = _a.sent();
                console.error('Error in advanced filtering:', error_1);
                return [2 /*return*/, {
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
                    }];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function applyAccessControl(request, userId, userRole) {
    // Apply role-based filtering
    if (userRole === 'employee') {
        // Employees can only see their own data
        var userFilter = {
            field: 'userId',
            operator: 'equals',
            value: userId,
            logicalOperator: 'AND',
        };
        request.filters.push(userFilter);
    }
    return request;
}
function executeAdvancedFilter(request, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var filterId, rawData, filteredData, groupedData, aggregations, sortedData, paginatedData, paginationInfo, paginationResult, outputData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    filterId = "filter-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
                    return [4 /*yield*/, fetchDataFromSource(request.dataSource)];
                case 1:
                    rawData = _a.sent();
                    filteredData = applyFilters(rawData, request.filters);
                    if (request.groupBy) {
                        groupedData = applyGrouping(filteredData, request.groupBy);
                    }
                    if (request.aggregations && request.aggregations.length > 0) {
                        aggregations = applyAggregations(filteredData, request.aggregations);
                    }
                    sortedData = filteredData;
                    if (request.sorting && request.sorting.length > 0) {
                        sortedData = applySorting(filteredData, request.sorting);
                    }
                    paginatedData = sortedData;
                    if (request.pagination) {
                        paginationResult = applyPagination(sortedData, request.pagination);
                        paginatedData = paginationResult.data;
                        paginationInfo = paginationResult.pagination;
                    }
                    outputData = formatOutput(paginatedData, groupedData, request.outputFormat || 'detailed');
                    return [2 /*return*/, {
                            filterId: filterId,
                            dataSource: request.dataSource,
                            appliedFilters: request.filters,
                            resultCount: filteredData.length,
                            data: outputData,
                            groupedData: groupedData,
                            aggregations: aggregations,
                            pagination: paginationInfo,
                            executionTime: 0, // Will be set by caller
                            generatedAt: new Date().toISOString(),
                        }];
            }
        });
    });
}
function fetchDataFromSource(dataSource) {
    return __awaiter(this, void 0, void 0, function () {
        var tableName, command, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    switch (dataSource) {
                        case 'time-entries':
                            tableName = process.env.TIME_ENTRIES_TABLE;
                            break;
                        case 'projects':
                            tableName = process.env.PROJECTS_TABLE;
                            break;
                        case 'clients':
                            tableName = process.env.CLIENTS_TABLE;
                            break;
                        case 'users':
                            tableName = process.env.USERS_TABLE;
                            break;
                        default:
                            throw new Error("Unsupported data source: ".concat(dataSource));
                    }
                    if (!tableName) {
                        throw new Error("Table name not configured for data source: ".concat(dataSource));
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    command = new lib_dynamodb_1.ScanCommand({
                        TableName: tableName,
                    });
                    return [4 /*yield*/, docClient.send(command)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.Items || []];
                case 3:
                    error_2 = _a.sent();
                    console.error("Error fetching data from ".concat(dataSource, ":"), error_2);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function applyFilters(data, filters) {
    return data.filter(function (item) {
        var result = true;
        var currentLogicalOperator = 'AND';
        for (var _i = 0, filters_1 = filters; _i < filters_1.length; _i++) {
            var filter = filters_1[_i];
            var fieldValue = getNestedValue(item, filter.field);
            var filterResult = evaluateFilter(fieldValue, filter);
            if (currentLogicalOperator === 'AND') {
                result = result && filterResult;
            }
            else {
                result = result || filterResult;
            }
            currentLogicalOperator = filter.logicalOperator || 'AND';
        }
        return result;
    });
}
function getNestedValue(obj, path) {
    return path.split('.').reduce(function (current, key) { return current === null || current === void 0 ? void 0 : current[key]; }, obj);
}
function evaluateFilter(value, filter) {
    var operator = filter.operator, filterValue = filter.value, secondValue = filter.secondValue, _a = filter.caseSensitive, caseSensitive = _a === void 0 ? true : _a;
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
    var stringValue = String(value);
    var stringFilterValue = String(filterValue);
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
            var numValue = Number(value);
            return numValue >= Number(filterValue) && numValue <= Number(secondValue);
        case 'in':
            return Array.isArray(filterValue) && filterValue.includes(value);
        case 'not_in':
            return Array.isArray(filterValue) && !filterValue.includes(value);
        case 'regex':
            try {
                var regex = new RegExp(filterValue, caseSensitive ? 'g' : 'gi');
                return regex.test(stringValue);
            }
            catch (_b) {
                return false;
            }
        case 'date_range':
            var dateValue = new Date(value);
            var startDate = new Date(filterValue);
            var endDate = new Date(secondValue);
            return dateValue >= startDate && dateValue <= endDate;
        default:
            return false;
    }
}
function applyGrouping(data, groupBy) {
    var groups = new Map();
    data.forEach(function (item) {
        var groupKey;
        if (groupBy.dateGrouping && groupBy.fields.length === 1) {
            // Date-based grouping
            var dateValue = new Date(getNestedValue(item, groupBy.fields[0]));
            groupKey = formatDateForGrouping(dateValue, groupBy.dateGrouping);
        }
        else if (groupBy.customGrouping) {
            // Custom range-based grouping
            var value = getNestedValue(item, groupBy.customGrouping.field);
            groupKey = findCustomGroup(value, groupBy.customGrouping.ranges);
        }
        else {
            // Standard field-based grouping
            groupKey = groupBy.fields.map(function (field) { return getNestedValue(item, field); }).join('|');
        }
        if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
        }
        groups.get(groupKey).push(item);
    });
    return Array.from(groups.entries()).map(function (_a) {
        var key = _a[0], items = _a[1];
        return ({
            groupKey: key,
            count: items.length,
            items: items,
        });
    });
}
function formatDateForGrouping(date, grouping) {
    switch (grouping) {
        case 'day':
            return date.toISOString().split('T')[0];
        case 'week':
            var weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            return "Week of ".concat(weekStart.toISOString().split('T')[0]);
        case 'month':
            return "".concat(date.getFullYear(), "-").concat(String(date.getMonth() + 1).padStart(2, '0'));
        case 'quarter':
            var quarter = Math.floor(date.getMonth() / 3) + 1;
            return "".concat(date.getFullYear(), "-Q").concat(quarter);
        case 'year':
            return String(date.getFullYear());
        default:
            return date.toISOString().split('T')[0];
    }
}
function findCustomGroup(value, ranges) {
    for (var _i = 0, ranges_1 = ranges; _i < ranges_1.length; _i++) {
        var range = ranges_1[_i];
        if (range.values && range.values.includes(value)) {
            return range.label;
        }
        if (range.min !== undefined && range.max !== undefined) {
            var numValue = Number(value);
            if (numValue >= range.min && numValue <= range.max) {
                return range.label;
            }
        }
    }
    return 'Other';
}
function applyAggregations(data, aggregations) {
    var results = {};
    aggregations.forEach(function (agg) {
        var values = data.map(function (item) { return getNestedValue(item, agg.field); }).filter(function (v) { return v != null; });
        var alias = agg.alias || "".concat(agg.function, "_").concat(agg.field);
        switch (agg.function) {
            case 'sum':
                results[alias] = values.reduce(function (sum, val) { return sum + Number(val); }, 0);
                break;
            case 'avg':
                results[alias] = values.length > 0 ? values.reduce(function (sum, val) { return sum + Number(val); }, 0) / values.length : 0;
                break;
            case 'count':
                results[alias] = values.length;
                break;
            case 'distinct_count':
                results[alias] = new Set(values).size;
                break;
            case 'min':
                results[alias] = values.length > 0 ? Math.min.apply(Math, values.map(Number)) : null;
                break;
            case 'max':
                results[alias] = values.length > 0 ? Math.max.apply(Math, values.map(Number)) : null;
                break;
            case 'median':
                var sortedValues = values.map(Number).sort(function (a, b) { return a - b; });
                var mid = Math.floor(sortedValues.length / 2);
                results[alias] = sortedValues.length > 0 ?
                    (sortedValues.length % 2 === 0 ?
                        (sortedValues[mid - 1] + sortedValues[mid]) / 2 :
                        sortedValues[mid]) : null;
                break;
            case 'percentile':
                var percentile = agg.percentile || 50;
                var sortedPercentileValues = values.map(Number).sort(function (a, b) { return a - b; });
                var index = Math.ceil((percentile / 100) * sortedPercentileValues.length) - 1;
                results[alias] = sortedPercentileValues.length > 0 ? sortedPercentileValues[Math.max(0, index)] : null;
                break;
        }
    });
    return results;
}
function applySorting(data, sorting) {
    return data.sort(function (a, b) {
        for (var _i = 0, sorting_1 = sorting; _i < sorting_1.length; _i++) {
            var sort = sorting_1[_i];
            var aValue = getNestedValue(a, sort.field);
            var bValue = getNestedValue(b, sort.field);
            // Handle null values
            if (aValue == null && bValue == null)
                continue;
            if (aValue == null)
                return sort.nullsFirst ? -1 : 1;
            if (bValue == null)
                return sort.nullsFirst ? 1 : -1;
            var comparison = 0;
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue);
            }
            else {
                comparison = Number(aValue) - Number(bValue);
            }
            if (comparison !== 0) {
                return sort.direction === 'desc' ? -comparison : comparison;
            }
        }
        return 0;
    });
}
function applyPagination(data, pagination) {
    var startIndex = pagination.offset;
    var endIndex = startIndex + pagination.limit;
    var paginatedData = data.slice(startIndex, endIndex);
    var hasMore = endIndex < data.length;
    return {
        data: paginatedData,
        pagination: {
            hasMore: hasMore,
            nextCursor: hasMore ? (endIndex).toString() : undefined,
            totalCount: data.length,
        },
    };
}
function formatOutput(data, groupedData, format) {
    switch (format) {
        case 'summary':
            return data.map(function (item) {
                // Return only key fields for summary
                var summary = {};
                ['id', 'name', 'status', 'date', 'amount', 'hours'].forEach(function (field) {
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
