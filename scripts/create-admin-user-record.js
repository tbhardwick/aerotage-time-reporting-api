#!/usr/bin/env node

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

// Configuration
const USERS_TABLE = 'aerotage-users-dev';
const REGION = 'us-east-1';
const ADMIN_USER_ID = '0408a498-40c1-7071-acc9-90665ef117c3';
const ADMIN_EMAIL = 'bhardwick@aerotage.com';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function createAdminUserRecord() {
  try {
    console.log('🔧 Creating admin user record in DynamoDB...');
    console.log(`📋 User ID: ${ADMIN_USER_ID}`);
    console.log(`📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🗄️ Table: ${USERS_TABLE}`);
    
    const now = new Date().toISOString();
    
    // Create user record
    const userRecord = {
      id: ADMIN_USER_ID,
      email: ADMIN_EMAIL,
      name: 'Admin User',
      role: 'admin',
      status: 'active',
      hourlyRate: 100,
      department: 'Administration',
      teamId: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
      // Profile information
      firstName: 'Admin',
      lastName: 'User',
      phoneNumber: null,
      timezone: 'America/New_York',
      // Settings
      emailNotifications: true,
      slackNotifications: false,
      // Metadata
      createdBy: 'system',
      updatedBy: 'system'
    };
    
    console.log('\n📝 User record to create:');
    console.log(JSON.stringify(userRecord, null, 2));
    
    const command = new PutCommand({
      TableName: USERS_TABLE,
      Item: userRecord,
      ConditionExpression: 'attribute_not_exists(id)' // Only create if doesn't exist
    });
    
    await docClient.send(command);
    
    console.log('\n✅ SUCCESS: Admin user record created in DynamoDB!');
    console.log('🎉 The user should now be able to access all API endpoints.');
    
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      console.log('\n⚠️ User record already exists in DynamoDB');
      console.log('✅ No action needed - user record is already present');
    } else {
      console.error('\n❌ Failed to create user record:', error);
      console.error('Error details:', error.message);
    }
  }
}

// Run the script
createAdminUserRecord(); 