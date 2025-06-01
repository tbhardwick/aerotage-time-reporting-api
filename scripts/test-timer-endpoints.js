const { getCognitoToken } = require('./get-cognito-token');

const API_BASE_URL = 'https://time-api-dev.aerotage.com';

async function testTimerEndpoints() {
  try {
    console.log('🔐 Getting authentication token...');
    const authResult = await getCognitoToken('bhardwick@aerotage.com', 'Aerotage*2025');
    const token = authResult.AccessToken;
    
    console.log('✅ Authentication successful');
    
    // Test 1: Get timer status (should be no active timer)
    console.log('\n📊 Testing timer status...');
    const statusResponse = await fetch(`${API_BASE_URL}/time-entries/timer/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const statusData = await statusResponse.json();
    console.log('Timer Status Response:', JSON.stringify(statusData, null, 2));
    
    // Test 2: Start timer
    console.log('\n▶️ Testing start timer...');
    const startResponse = await fetch(`${API_BASE_URL}/time-entries/timer/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectId: 'proj_test_123',
        description: 'Testing timer endpoints',
        tags: ['testing', 'api']
      })
    });
    
    const startData = await startResponse.json();
    console.log('Start Timer Response:', JSON.stringify(startData, null, 2));
    
    if (startData.success) {
      // Test 3: Get timer status again (should show active timer)
      console.log('\n📊 Testing timer status with active timer...');
      const activeStatusResponse = await fetch(`${API_BASE_URL}/time-entries/timer/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const activeStatusData = await activeStatusResponse.json();
      console.log('Active Timer Status Response:', JSON.stringify(activeStatusData, null, 2));
      
      // Wait a few seconds to accumulate some time
      console.log('\n⏳ Waiting 3 seconds to accumulate timer time...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Test 4: Stop timer
      console.log('\n⏹️ Testing stop timer...');
      const stopResponse = await fetch(`${API_BASE_URL}/time-entries/timer/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'Completed testing timer endpoints'
        })
      });
      
      const stopData = await stopResponse.json();
      console.log('Stop Timer Response:', JSON.stringify(stopData, null, 2));
      
      // Test 5: Final timer status (should be no active timer)
      console.log('\n📊 Testing final timer status...');
      const finalStatusResponse = await fetch(`${API_BASE_URL}/time-entries/timer/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const finalStatusData = await finalStatusResponse.json();
      console.log('Final Timer Status Response:', JSON.stringify(finalStatusData, null, 2));
    }
    
    console.log('\n✅ Timer endpoint testing completed!');
    
  } catch (error) {
    console.error('❌ Error testing timer endpoints:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', await error.response.text());
    }
  }
}

// Run the test
testTimerEndpoints(); 