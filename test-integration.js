// Test integration of nfl-data-py backend with React frontend
import nflDataPyService from './src/services/nflDataPyService.js';

async function testIntegration() {
  console.log('🧪 Testing nfl-data-py integration...\n');

  try {
    // Test 1: Backend health check
    console.log('1. Testing backend health...');
    const health = await nflDataPyService.checkHealth();
    console.log('✅ Backend is healthy:', health.service);

    // Test 2: Get Week 1 2024 schedule
    console.log('\n2. Fetching Week 1 2024 schedule...');
    const scheduleData = await nflDataPyService.getWeekSchedule(2024, 1, 'REG');
    console.log(`✅ Found ${scheduleData.length} games for Week 1 2024`);

    // Test 3: Transform to Dashboard format
    console.log('\n3. Transforming to Dashboard format...');
    const gameData = nflDataPyService.transformScheduleToGameFormat(scheduleData);
    console.log(`✅ Transformed ${gameData.length} games`);

    // Test 4: Show sample game
    if (gameData.length > 0) {
      const sampleGame = gameData[0];
      console.log('\n🏈 Sample Game:');
      console.log(`   ${sampleGame.awayTeam} @ ${sampleGame.homeTeam}`);
      console.log(`   Date: ${sampleGame.gameDate} ${sampleGame.gameTime}`);
      console.log(`   Venue: ${sampleGame.venue}`);
      console.log(`   Weather: ${sampleGame.weatherConditions}`);
      console.log(`   Status: ${sampleGame.status}`);
      console.log(`   Moneyline: ${sampleGame.bettingLines.awayMoneyline} / ${sampleGame.bettingLines.homeMoneyline}`);
      console.log(`   Spread: ${sampleGame.bettingLines.spread}`);
      console.log(`   Total: ${sampleGame.bettingLines.total}`);
      if (sampleGame.isCompleted) {
        console.log(`   Final Score: ${sampleGame.awayTeamAbbr} ${sampleGame.awayScore} - ${sampleGame.homeTeamAbbr} ${sampleGame.homeScore}`);
      }
    }

    // Test 5: Get team stats
    console.log('\n4. Testing team stats...');
    const teamStats = await nflDataPyService.getTeamStats([2024]);
    console.log(`✅ Retrieved team stats for ${teamStats.length} team-seasons`);

    console.log('\n🎉 Integration test completed successfully!');
    console.log('📱 The React app can now use nfl-data-py for comprehensive NFL data');
    console.log('🔗 Backend: http://localhost:5001');
    console.log('🌐 Frontend: http://localhost:5173');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure Python backend is running: cd python-backend && python app.py');
    console.log('   2. Check that all dependencies are installed: pip install -r requirements.txt');
    console.log('   3. Verify CORS is enabled for localhost:5173');
  }
}

testIntegration();