#!/bin/bash

echo "🗑️ Deleting existing time entries table..."
aws dynamodb delete-table --table-name aerotage-time-entries-dev

echo "⏳ Waiting for table deletion to complete..."
aws dynamodb wait table-not-exists --table-name aerotage-time-entries-dev

echo "✅ Table deleted successfully!"

echo "🚀 Deploying updated database stack..."
cd infrastructure
npm run deploy:dev

echo "✅ Time entries table recreated with correct structure!" 