#!/usr/bin/env node

const { getCognitoToken } = require('./scripts/get-cognito-token');
const https = require('https');

const API_BASE_URL = 'https://time-api-dev.aerotage.com';
// ... existing code ... 