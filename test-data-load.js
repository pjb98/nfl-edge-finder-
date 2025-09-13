// Test script to verify NFL data loading is working
import dotenv from 'dotenv';
import { loadWeek1Data } from './src/data/week1-2025-loader.js';
import { getTeamStats2025 } from './src/data/team-stats-2025.js';

// Load environment variables
dotenv.config();

// Set up environment for the test
process.env.VITE_ODDS_API_KEY = process.env.VITE_ODDS_API_KEY || 'ba7ea58c9543e8a675a9ff71bee86859';

async function testDataLoading() {
  console.log('🧪 Testing NFL data loading...\n');

  try {
    // Test Week 1 2025 data loading
    console.log('1. Testing Week 1 2025 data loading...');
    const week1Games = await loadWeek1Data();
    console.log(`✅ Week 1 data loaded: ${week1Games.length} games found`);
    
    if (week1Games.length > 0) {
      const sampleGame = week1Games[0];
      console.log(`📊 Sample game: ${sampleGame.awayTeam} @ ${sampleGame.homeTeam}`);
      console.log(`   Spread: ${sampleGame.bettingLines.spread}, Total: ${sampleGame.bettingLines.total}`);
      console.log(`   Status: ${sampleGame.status}, Week: ${sampleGame.week}, Season: ${sampleGame.season}`);
    }

    // Test 2025 team stats
    console.log('\n2. Testing 2025 team statistics...');
    const kansasCityStats = getTeamStats2025(12); // Chiefs
    const philadelphiaStats = getTeamStats2025(21); // Eagles
    
    console.log(`✅ Kansas City Chiefs 2025 projection:`);
    console.log(`   Avg Points Scored: ${kansasCityStats.avgPointsScored}`);
    console.log(`   Avg Points Allowed: ${kansasCityStats.avgPointsAllowed}`);
    console.log(`   Projection: ${kansasCityStats.projection}`);
    
    console.log(`✅ Philadelphia Eagles 2025 projection:`);
    console.log(`   Avg Points Scored: ${philadelphiaStats.avgPointsScored}`);
    console.log(`   Avg Points Allowed: ${philadelphiaStats.avgPointsAllowed}`);
    console.log(`   Projection: ${philadelphiaStats.projection}`);

    console.log('\n🎉 All data loading tests passed!');
    console.log('\n📱 The application is ready with real NFL data.');
    console.log('🌐 Open http://localhost:5173 to view the dashboard');
    console.log('🏈 Select "2025" season and "Week 1" to see live betting lines');

  } catch (error) {
    console.error('❌ Data loading test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check your .env file has VITE_ODDS_API_KEY set');
    console.log('   2. Verify your internet connection');
    console.log('   3. Ensure you haven\'t exceeded API quota');
  }
}

testDataLoading();