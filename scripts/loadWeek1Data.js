#!/usr/bin/env node

// Real NFL Week 1 2025 Data Loader
// Fetches live data from ESPN API and The Odds API

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenv.config();

// Set up global fetch for Node.js
global.fetch = fetch;

class NFLWeek1DataLoader {
  constructor() {
    this.oddsApiKey = process.env.VITE_ODDS_API_KEY || process.env.REACT_APP_ODDS_API_KEY;
    
    if (!this.oddsApiKey || this.oddsApiKey === 'your-api-key-here') {
      console.error('❌ Missing API key. Please set VITE_ODDS_API_KEY in your .env file');
      console.log('Get your free key from: https://the-odds-api.com/');
      process.exit(1);
    }

    console.log('🔑 Using API key:', this.oddsApiKey.substring(0, 8) + '...');
  }

  // Fetch current NFL games from The Odds API
  async fetchCurrentNFLGames() {
    const url = new URL('https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds');
    url.searchParams.set('apiKey', this.oddsApiKey);
    url.searchParams.set('regions', 'us');
    url.searchParams.set('markets', 'h2h,spreads,totals');
    url.searchParams.set('bookmakers', 'draftkings,fanduel,betmgm,caesars,pointsbetus');
    url.searchParams.set('oddsFormat', 'american');
    url.searchParams.set('dateFormat', 'iso');

    console.log('🎯 Fetching current NFL games from The Odds API...');
    
    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key - Please check your .env file');
        } else if (response.status === 429) {
          throw new Error('API quota exceeded - You may need to upgrade your plan');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Retrieved ${data.length} NFL games with live betting odds`);
      
      // Log API quota usage
      const requestsUsed = response.headers.get('x-requests-used');
      const requestsRemaining = response.headers.get('x-requests-remaining');
      console.log(`📊 API Usage: ${requestsUsed} used, ${requestsRemaining} remaining`);
      
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch NFL games:', error.message);
      throw error;
    }
  }

  // Fetch NFL scores/results
  async fetchNFLScores() {
    const url = new URL('https://api.the-odds-api.com/v4/sports/americanfootball_nfl/scores');
    url.searchParams.set('apiKey', this.oddsApiKey);
    url.searchParams.set('daysFrom', '3');

    console.log('🏈 Fetching recent NFL scores...');
    
    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Retrieved ${data.length} recent NFL games with scores`);
      
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch NFL scores:', error.message);
      return [];
    }
  }

  // Get week number from date
  getWeekFromDate(dateStr) {
    const gameDate = new Date(dateStr);
    const year = gameDate.getFullYear();
    
    // 2025 NFL season starts around September 4, 2025
    const seasonStart = new Date(2025, 8, 4); // September 4, 2025
    
    if (year === 2025 && gameDate >= seasonStart) {
      const diffDays = Math.floor((gameDate - seasonStart) / (24 * 60 * 60 * 1000));
      return Math.max(1, Math.min(18, Math.floor(diffDays / 7) + 1));
    }
    
    return 1; // Default to week 1
  }

  // Transform API data to application format
  transformGamesData(gamesData, scoresData = []) {
    console.log('🔄 Transforming games data...');
    
    return gamesData.map(game => {
      // Find corresponding score data
      const scoreData = scoresData.find(score => 
        score.id === game.id || 
        (score.home_team === game.home_team && score.away_team === game.away_team)
      );

      // Extract betting lines
      let bettingLines = {
        spread: 0,
        total: 45.0,
        homeMoneyline: -110,
        awayMoneyline: -110
      };

      if (game.bookmakers && game.bookmakers.length > 0) {
        const primaryBook = game.bookmakers.find(b => b.key === 'draftkings') || game.bookmakers[0];
        const markets = primaryBook.markets || [];

        // Extract spread
        const spreadMarket = markets.find(m => m.key === 'spreads');
        if (spreadMarket && spreadMarket.outcomes) {
          const homeOutcome = spreadMarket.outcomes.find(o => o.name === game.home_team);
          if (homeOutcome) {
            bettingLines.spread = parseFloat(homeOutcome.point) || 0;
          }
        }

        // Extract total
        const totalsMarket = markets.find(m => m.key === 'totals');
        if (totalsMarket && totalsMarket.outcomes && totalsMarket.outcomes[0]) {
          bettingLines.total = parseFloat(totalsMarket.outcomes[0].point) || 45.0;
        }

        // Extract moneylines
        const h2hMarket = markets.find(m => m.key === 'h2h');
        if (h2hMarket && h2hMarket.outcomes) {
          const homeML = h2hMarket.outcomes.find(o => o.name === game.home_team);
          const awayML = h2hMarket.outcomes.find(o => o.name === game.away_team);
          
          if (homeML) bettingLines.homeMoneyline = parseInt(homeML.price) || -110;
          if (awayML) bettingLines.awayMoneyline = parseInt(awayML.price) || -110;
        }
      }

      // Extract scores if available
      const homeScore = scoreData?.scores ? 
        (scoreData.scores.find(s => s.name === game.home_team)?.score || 0) : 0;
      const awayScore = scoreData?.scores ? 
        (scoreData.scores.find(s => s.name === game.away_team)?.score || 0) : 0;

      const isCompleted = scoreData?.completed === true;
      const gameDate = new Date(game.commence_time);

      return {
        id: game.id,
        homeTeamId: this.getTeamId(game.home_team),
        awayTeamId: this.getTeamId(game.away_team),
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        homeTeamAbbr: this.getTeamAbbr(game.home_team),
        awayTeamAbbr: this.getTeamAbbr(game.away_team),
        week: this.getWeekFromDate(game.commence_time),
        season: 2025,
        gameDate: game.commence_time,
        gameTime: gameDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          timeZoneName: 'short'
        }),
        venue: 'TBD', // Odds API doesn't provide venue
        network: 'TBD', // Odds API doesn't provide network
        weatherConditions: 'Unknown',
        status: isCompleted ? 'STATUS_FINAL' : 'STATUS_SCHEDULED',
        isCompleted: isCompleted,
        homeScore: homeScore,
        awayScore: awayScore,
        bettingLines: bettingLines,
        lastUpdate: new Date().toISOString()
      };
    });
  }

  // Helper: Map team names to IDs
  getTeamId(teamName) {
    const teamMap = {
      'Arizona Cardinals': 22, 'Atlanta Falcons': 1, 'Baltimore Ravens': 33, 'Buffalo Bills': 2,
      'Carolina Panthers': 29, 'Chicago Bears': 3, 'Cincinnati Bengals': 4, 'Cleveland Browns': 5,
      'Dallas Cowboys': 6, 'Denver Broncos': 7, 'Detroit Lions': 8, 'Green Bay Packers': 9,
      'Houston Texans': 34, 'Indianapolis Colts': 11, 'Jacksonville Jaguars': 30, 'Kansas City Chiefs': 12,
      'Las Vegas Raiders': 13, 'Los Angeles Chargers': 24, 'Los Angeles Rams': 14, 'Miami Dolphins': 15,
      'Minnesota Vikings': 16, 'New England Patriots': 17, 'New Orleans Saints': 18, 'New York Giants': 19,
      'New York Jets': 20, 'Philadelphia Eagles': 21, 'Pittsburgh Steelers': 23, 'San Francisco 49ers': 25,
      'Seattle Seahawks': 26, 'Tampa Bay Buccaneers': 27, 'Tennessee Titans': 10, 'Washington Commanders': 28
    };
    return teamMap[teamName] || 999;
  }

  // Helper: Map team names to abbreviations
  getTeamAbbr(teamName) {
    const abbrMap = {
      'Arizona Cardinals': 'ARI', 'Atlanta Falcons': 'ATL', 'Baltimore Ravens': 'BAL', 'Buffalo Bills': 'BUF',
      'Carolina Panthers': 'CAR', 'Chicago Bears': 'CHI', 'Cincinnati Bengals': 'CIN', 'Cleveland Browns': 'CLE',
      'Dallas Cowboys': 'DAL', 'Denver Broncos': 'DEN', 'Detroit Lions': 'DET', 'Green Bay Packers': 'GB',
      'Houston Texans': 'HOU', 'Indianapolis Colts': 'IND', 'Jacksonville Jaguars': 'JAX', 'Kansas City Chiefs': 'KC',
      'Las Vegas Raiders': 'LV', 'Los Angeles Chargers': 'LAC', 'Los Angeles Rams': 'LAR', 'Miami Dolphins': 'MIA',
      'Minnesota Vikings': 'MIN', 'New England Patriots': 'NE', 'New Orleans Saints': 'NO', 'New York Giants': 'NYG',
      'New York Jets': 'NYJ', 'Philadelphia Eagles': 'PHI', 'Pittsburgh Steelers': 'PIT', 'San Francisco 49ers': 'SF',
      'Seattle Seahawks': 'SEA', 'Tampa Bay Buccaneers': 'TB', 'Tennessee Titans': 'TEN', 'Washington Commanders': 'WAS'
    };
    return abbrMap[teamName] || 'UNK';
  }

  // Save data to JSON files
  async saveDataToFiles(gamesData) {
    const dataDir = path.join(process.cwd(), 'src', 'data');
    
    try {
      // Ensure data directory exists
      await fs.mkdir(dataDir, { recursive: true });

      // Filter Week 1 2025 games
      const week1Games = gamesData.filter(game => 
        game.week === 1 && game.season === 2025
      );

      // Save Week 1 2025 games
      const week1File = path.join(dataDir, 'nfl-week1-2025.json');
      await fs.writeFile(week1File, JSON.stringify({
        week: 1,
        season: 2025,
        lastUpdate: new Date().toISOString(),
        games: week1Games
      }, null, 2));

      console.log(`✅ Saved ${week1Games.length} Week 1 2025 games to ${week1File}`);

      // Save all current games
      const allGamesFile = path.join(dataDir, 'current-nfl-games.json');
      await fs.writeFile(allGamesFile, JSON.stringify({
        lastUpdate: new Date().toISOString(),
        totalGames: gamesData.length,
        games: gamesData
      }, null, 2));

      console.log(`✅ Saved ${gamesData.length} total games to ${allGamesFile}`);

      return week1Games;
    } catch (error) {
      console.error('❌ Failed to save data files:', error.message);
      throw error;
    }
  }

  // Main execution
  async run() {
    try {
      console.log('🚀 Starting NFL Week 1 2025 data loading...\n');

      // Fetch current games with odds
      const currentGames = await this.fetchCurrentNFLGames();
      
      // Fetch recent scores
      const recentScores = await this.fetchNFLScores();

      // Transform data
      const transformedGames = this.transformGamesData(currentGames, recentScores);

      // Filter for Week 1 2025 specifically
      const week1Games = transformedGames.filter(game => 
        game.week === 1 && game.season === 2025
      );

      if (week1Games.length === 0) {
        console.log('⚠️  No Week 1 2025 games found. This may be because:');
        console.log('   • The 2025 season hasn\'t started yet');
        console.log('   • Games are scheduled for different weeks');
        console.log('   • The API doesn\'t have 2025 data yet');
        console.log('\n📊 Available games by week:');
        
        const gamesByWeek = transformedGames.reduce((acc, game) => {
          const key = `${game.season} Week ${game.week}`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
        
        Object.entries(gamesByWeek).forEach(([key, count]) => {
          console.log(`   • ${key}: ${count} games`);
        });
      }

      // Save all data
      const savedGames = await this.saveDataToFiles(transformedGames);

      console.log('\n🎉 Data loading completed successfully!');
      console.log(`📈 Week 1 2025 games found: ${week1Games.length}`);
      console.log(`📈 Total games in database: ${transformedGames.length}`);

      if (week1Games.length > 0) {
        console.log('\n🏈 Week 1 2025 Games Preview:');
        week1Games.forEach(game => {
          const spread = game.bettingLines.spread > 0 ? `+${game.bettingLines.spread}` : game.bettingLines.spread;
          console.log(`   ${game.awayTeam} @ ${game.homeTeam} (${spread}) O/U ${game.bettingLines.total}`);
        });
      }

      return week1Games;
    } catch (error) {
      console.error('❌ Data loading failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const loader = new NFLWeek1DataLoader();
  loader.run().catch(console.error);
}

export default NFLWeek1DataLoader;