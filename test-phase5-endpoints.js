#!/usr/bin/env node

const { getCognitoToken } = require('./get-cognito-token');
const https = require('https');

// Configuration
const API_BASE_URL = 'https://k60bobrd9h.execute-api.us-east-1.amazonaws.com/dev';
const TEST_USER = {
  email: 'bhardwick@aerotage.com',
  password: 'Aerotage*2025'
};

/**
 * Make HTTP request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Test client creation
 */
async function testCreateClient(accessToken) {
  console.log(`\n🏢 TESTING CLIENT CREATION`);
  console.log('='.repeat(60));

  const clientData = {
    name: `Test Client ${Date.now()}`,
    email: 'client@testcompany.com',
    phone: '+1-555-0123',
    address: '123 Business St, Suite 100, Business City, BC 12345',
    contactPerson: 'John Smith',
    defaultHourlyRate: 150,
    isActive: true,
    notes: 'Test client created by automated test script'
  };

  console.log(`📤 Creating client:`, clientData);

  try {
    const response = await makeRequest(`${API_BASE_URL}/clients`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: clientData
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 201 && response.body.success) {
      const client = response.body.data;
      console.log(`✅ Client created successfully!`);
      console.log(`🆔 Client ID: ${client.id}`);
      console.log(`🏢 Client Name: ${client.name}`);
      console.log(`📧 Email: ${client.email}`);
      console.log(`💰 Default Rate: $${client.defaultHourlyRate}/hr`);
      
      return {
        success: true,
        client
      };
    } else {
      console.log(`❌ Client creation failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Client creation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test client listing
 */
async function testListClients(accessToken) {
  console.log(`\n📋 TESTING CLIENT LISTING`);
  console.log('='.repeat(60));

  try {
    const response = await makeRequest(`${API_BASE_URL}/clients?limit=10&isActive=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`📡 Response Status: ${response.statusCode}`);

    if (response.statusCode === 200 && response.body.success) {
      const { items: clients, pagination } = response.body.data;
      console.log(`✅ Clients retrieved successfully`);
      console.log(`📊 Total clients: ${pagination.total}`);
      console.log(`📄 Page size: ${pagination.limit}`);
      console.log(`🔄 Has more: ${pagination.hasMore}`);

      clients.forEach((client, index) => {
        console.log(`\n📋 Client ${index + 1}:`);
        console.log(`   ID: ${client.id}`);
        console.log(`   Name: ${client.name}`);
        console.log(`   Email: ${client.email || 'N/A'}`);
        console.log(`   Active: ${client.isActive ? '✅' : '❌'}`);
        console.log(`   Rate: $${client.defaultHourlyRate || 'N/A'}/hr`);
      });

      return {
        success: true,
        clients,
        pagination
      };
    } else {
      console.log(`❌ Client listing failed:`, response.body);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Client listing error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test client update
 */
async function testUpdateClient(accessToken, clientId) {
  console.log(`\n✏️ TESTING CLIENT UPDATE`);
  console.log('='.repeat(60));

  const updateData = {
    phone: '+1-555-9999',
    defaultHourlyRate: 175,
    notes: 'Updated by automated test script'
  };

  console.log(`📤 Updating client ${clientId}:`, updateData);

  try {
    const response = await makeRequest(`${API_BASE_URL}/clients/${clientId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: updateData
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const client = response.body.data;
      console.log(`✅ Client updated successfully!`);
      console.log(`📞 New Phone: ${client.phone}`);
      console.log(`💰 New Rate: $${client.defaultHourlyRate}/hr`);
      
      return {
        success: true,
        client
      };
    } else {
      console.log(`❌ Client update failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Client update error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test project creation
 */
async function testCreateProject(accessToken, clientId, clientName) {
  console.log(`\n📁 TESTING PROJECT CREATION`);
  console.log('='.repeat(60));

  const projectData = {
    name: `Test Project ${Date.now()}`,
    clientId: clientId,
    clientName: clientName,
    description: 'Test project created by automated test script',
    status: 'active',
    defaultHourlyRate: 150,
    defaultBillable: true,
    budget: {
      type: 'hours',
      value: 100,
      spent: 0
    },
    deadline: '2024-12-31',
    teamMembers: [],
    tags: ['test', 'automation', 'phase5']
  };

  console.log(`📤 Creating project:`, projectData);

  try {
    const response = await makeRequest(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: projectData
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 201 && response.body.success) {
      const project = response.body.data;
      console.log(`✅ Project created successfully!`);
      console.log(`🆔 Project ID: ${project.id}`);
      console.log(`📁 Project Name: ${project.name}`);
      console.log(`🏢 Client: ${project.clientName}`);
      console.log(`📊 Status: ${project.status}`);
      console.log(`💰 Rate: $${project.defaultHourlyRate}/hr`);
      console.log(`📅 Deadline: ${project.deadline}`);
      
      return {
        success: true,
        project
      };
    } else {
      console.log(`❌ Project creation failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Project creation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test project listing
 */
async function testListProjects(accessToken, clientId = null) {
  console.log(`\n📋 TESTING PROJECT LISTING`);
  console.log('='.repeat(60));

  let url = `${API_BASE_URL}/projects?limit=10&status=active`;
  if (clientId) {
    url += `&clientId=${clientId}`;
    console.log(`🔍 Filtering by client: ${clientId}`);
  }

  try {
    const response = await makeRequest(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`📡 Response Status: ${response.statusCode}`);

    if (response.statusCode === 200 && response.body.success) {
      const { items: projects, pagination } = response.body.data;
      console.log(`✅ Projects retrieved successfully`);
      console.log(`📊 Total projects: ${pagination.total}`);
      console.log(`📄 Page size: ${pagination.limit}`);
      console.log(`🔄 Has more: ${pagination.hasMore}`);

      projects.forEach((project, index) => {
        console.log(`\n📁 Project ${index + 1}:`);
        console.log(`   ID: ${project.id}`);
        console.log(`   Name: ${project.name}`);
        console.log(`   Client: ${project.clientName}`);
        console.log(`   Status: ${project.status}`);
        console.log(`   Rate: $${project.defaultHourlyRate || 'N/A'}/hr`);
        console.log(`   Deadline: ${project.deadline || 'N/A'}`);
        console.log(`   Team Members: ${project.teamMembers.length}`);
      });

      return {
        success: true,
        projects,
        pagination
      };
    } else {
      console.log(`❌ Project listing failed:`, response.body);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Project listing error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test project update
 */
async function testUpdateProject(accessToken, projectId) {
  console.log(`\n✏️ TESTING PROJECT UPDATE`);
  console.log('='.repeat(60));

  const updateData = {
    description: 'Updated by automated test script',
    status: 'paused',
    budget: {
      type: 'hours',
      value: 120,
      spent: 15
    },
    tags: ['test', 'automation', 'phase5', 'updated']
  };

  console.log(`📤 Updating project ${projectId}:`, updateData);

  try {
    const response = await makeRequest(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: updateData
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      const project = response.body.data;
      console.log(`✅ Project updated successfully!`);
      console.log(`📊 New Status: ${project.status}`);
      console.log(`💰 Budget: ${project.budget.value} hours (${project.budget.spent} spent)`);
      console.log(`🏷️ Tags: ${project.tags.join(', ')}`);
      
      return {
        success: true,
        project
      };
    } else {
      console.log(`❌ Project update failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Project update error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test client deletion (should fail if has projects)
 */
async function testDeleteClientWithProjects(accessToken, clientId) {
  console.log(`\n🗑️ TESTING CLIENT DELETION (WITH PROJECTS)`);
  console.log('='.repeat(60));

  console.log(`📤 Attempting to delete client ${clientId} (should fail due to projects)`);

  try {
    const response = await makeRequest(`${API_BASE_URL}/clients/${clientId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 400 && !response.body.success) {
      console.log(`✅ Client deletion correctly prevented due to existing projects!`);
      console.log(`🛡️ Error: ${response.body.error.message}`);
      
      return {
        success: true,
        preventedDeletion: true
      };
    } else {
      console.log(`❌ Client deletion should have been prevented`);
      return {
        success: false,
        error: 'Deletion was not prevented as expected'
      };
    }
  } catch (error) {
    console.log(`❌ Client deletion test error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test project deletion
 */
async function testDeleteProject(accessToken, projectId) {
  console.log(`\n🗑️ TESTING PROJECT DELETION`);
  console.log('='.repeat(60));

  console.log(`📤 Deleting project ${projectId}`);

  try {
    const response = await makeRequest(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      console.log(`✅ Project deleted successfully!`);
      
      return {
        success: true
      };
    } else {
      console.log(`❌ Project deletion failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Project deletion error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test client soft deletion
 */
async function testDeleteClient(accessToken, clientId) {
  console.log(`\n🗑️ TESTING CLIENT SOFT DELETION`);
  console.log('='.repeat(60));

  console.log(`📤 Soft deleting client ${clientId} (setting isActive = false)`);

  try {
    const response = await makeRequest(`${API_BASE_URL}/clients/${clientId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`📡 Response Status: ${response.statusCode}`);
    console.log(`📋 Response Body:`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      console.log(`✅ Client soft deleted successfully!`);
      
      return {
        success: true
      };
    } else {
      console.log(`❌ Client deletion failed`);
      return {
        success: false,
        error: response.body
      };
    }
  } catch (error) {
    console.log(`❌ Client deletion error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Complete test flow for Phase 5
 */
async function runPhase5Tests() {
  console.log(`\n🚀 TESTING PHASE 5 - PROJECT & CLIENT MANAGEMENT`);
  console.log('='.repeat(80));
  console.log(`📧 Test User: ${TEST_USER.email}`);
  console.log(`🕐 Test Time: ${new Date().toISOString()}`);
  console.log(`🌐 API Base URL: ${API_BASE_URL}`);

  const testResults = {
    authentication: false,
    createClient: false,
    listClients: false,
    updateClient: false,
    createProject: false,
    listProjects: false,
    updateProject: false,
    deleteClientWithProjects: false,
    deleteProject: false,
    deleteClient: false
  };

  let createdClient = null;
  let createdProject = null;

  try {
    // Step 1: Authenticate
    console.log(`\n🔐 Step 1: Authenticate with Cognito`);
    const authResult = await getCognitoToken(TEST_USER.email, TEST_USER.password);
    
    if (!authResult.success) {
      console.log(`❌ Authentication failed: ${authResult.error}`);
      return testResults;
    }

    const { token: accessToken, userId } = authResult;
    console.log(`✅ Authentication successful for user: ${userId}`);
    testResults.authentication = true;

    // Step 2: Create Client
    console.log(`\n🏢 Step 2: Create Client`);
    const createClientResult = await testCreateClient(accessToken);
    testResults.createClient = createClientResult.success;
    if (createClientResult.success) {
      createdClient = createClientResult.client;
    }

    // Step 3: List Clients
    console.log(`\n📋 Step 3: List Clients`);
    const listClientsResult = await testListClients(accessToken);
    testResults.listClients = listClientsResult.success;

    // Step 4: Update Client
    if (createdClient) {
      console.log(`\n✏️ Step 4: Update Client`);
      const updateClientResult = await testUpdateClient(accessToken, createdClient.id);
      testResults.updateClient = updateClientResult.success;
      if (updateClientResult.success) {
        createdClient = updateClientResult.client;
      }
    }

    // Step 5: Create Project
    if (createdClient) {
      console.log(`\n📁 Step 5: Create Project`);
      const createProjectResult = await testCreateProject(accessToken, createdClient.id, createdClient.name);
      testResults.createProject = createProjectResult.success;
      if (createProjectResult.success) {
        createdProject = createProjectResult.project;
      }
    }

    // Step 6: List Projects
    console.log(`\n📋 Step 6: List Projects`);
    const listProjectsResult = await testListProjects(accessToken, createdClient?.id);
    testResults.listProjects = listProjectsResult.success;

    // Step 7: Update Project
    if (createdProject) {
      console.log(`\n✏️ Step 7: Update Project`);
      const updateProjectResult = await testUpdateProject(accessToken, createdProject.id);
      testResults.updateProject = updateProjectResult.success;
    }

    // Step 8: Test Client Deletion Prevention
    if (createdClient && createdProject) {
      console.log(`\n🛡️ Step 8: Test Client Deletion Prevention`);
      const deleteClientWithProjectsResult = await testDeleteClientWithProjects(accessToken, createdClient.id);
      testResults.deleteClientWithProjects = deleteClientWithProjectsResult.success;
    }

    // Step 9: Delete Project
    if (createdProject) {
      console.log(`\n🗑️ Step 9: Delete Project`);
      const deleteProjectResult = await testDeleteProject(accessToken, createdProject.id);
      testResults.deleteProject = deleteProjectResult.success;
    }

    // Step 10: Delete Client (Soft Delete)
    if (createdClient) {
      console.log(`\n🗑️ Step 10: Delete Client (Soft Delete)`);
      const deleteClientResult = await testDeleteClient(accessToken, createdClient.id);
      testResults.deleteClient = deleteClientResult.success;
    }

  } catch (error) {
    console.error(`\n❌ TEST FAILED WITH ERROR:`, error);
  }

  // Summary
  console.log(`\n📊 PHASE 5 TEST SUMMARY`);
  console.log('='.repeat(80));
  
  const testSteps = [
    { name: 'Authentication', result: testResults.authentication },
    { name: 'Create Client', result: testResults.createClient },
    { name: 'List Clients', result: testResults.listClients },
    { name: 'Update Client', result: testResults.updateClient },
    { name: 'Create Project', result: testResults.createProject },
    { name: 'List Projects', result: testResults.listProjects },
    { name: 'Update Project', result: testResults.updateProject },
    { name: 'Client Deletion Prevention', result: testResults.deleteClientWithProjects },
    { name: 'Delete Project', result: testResults.deleteProject },
    { name: 'Delete Client', result: testResults.deleteClient }
  ];

  testSteps.forEach(step => {
    const status = step.result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${step.name}`);
  });

  const passedTests = testSteps.filter(step => step.result).length;
  const totalTests = testSteps.length;
  
  console.log(`\n🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log(`🎉 ALL PHASE 5 ENDPOINTS ARE WORKING CORRECTLY!`);
  } else {
    console.log(`🚨 Some tests failed. Please review the output above for details.`);
  }

  return testResults;
}

// CLI interface
if (require.main === module) {
  console.log(`
🧪 Phase 5 Endpoint Test Suite

This script will test all Phase 5 endpoints:
- Client Management (CRUD operations)
- Project Management (CRUD operations)
- Business logic validation
- Error handling

Using test credentials:
- Email: ${TEST_USER.email}
- API: ${API_BASE_URL}

Starting tests...
`);

  runPhase5Tests();
}

module.exports = {
  runPhase5Tests,
  testCreateClient,
  testListClients,
  testUpdateClient,
  testCreateProject,
  testListProjects,
  testUpdateProject,
  testDeleteClient,
  testDeleteProject
}; 