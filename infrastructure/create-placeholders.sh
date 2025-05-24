#!/bin/bash

# Create all placeholder Lambda functions
endpoints=(
  "users/get"
  "users/update"
  "users/delete"
  "users/invite"
  "teams/list"
  "teams/create"
  "teams/update"
  "teams/delete"
  "projects/list"
  "projects/create"
  "projects/update"
  "projects/delete"
  "clients/list"
  "clients/create"
  "clients/update"
  "clients/delete"
  "time-entries/list"
  "time-entries/create"
  "time-entries/update"
  "time-entries/delete"
  "time-entries/submit"
  "time-entries/approve"
  "time-entries/reject"
  "reports/time"
  "reports/projects"
  "reports/users"
  "reports/export"
  "reports/analytics"
  "invoices/list"
  "invoices/generate"
  "invoices/update"
  "invoices/send"
  "invoices/status"
)

for endpoint in "${endpoints[@]}"; do
  dir="lambda/$(dirname $endpoint)"
  file="lambda/${endpoint}.ts"
  
  mkdir -p "$dir"
  
  cat > "$file" << 'TSEOF'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Placeholder endpoint request:', event);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Placeholder endpoint - implementation pending',
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    };
  }
};
TSEOF
done

echo "Created placeholder Lambda functions" 