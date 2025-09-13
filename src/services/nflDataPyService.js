// NFL Data Python Service
// Connects to Python backend using nfl-data-py for game data
// Preserves Odds API credits by handling non-betting data

class NFLDataPyService {
  constructor() {
    // Auto-detect the correct backend URL based on current hostname
    const currentHost = window.location.hostname;
    const backendHost = currentHost === 'localhost' || currentHost === '127.0.0.1' 
      ? 'localhost' 
      : currentHost; // Use the same IP as the frontend
    
    this.baseURL = `http://${backendHost}:5001/api`;
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes to match backend
    
    console.log('🐍 NFL Data Python Service initialized');
    console.log('🔗 Backend URL:', this.baseURL);
    console.log('📱 Detected host:', currentHost, '-> Backend host:', backendHost);
  }

  // Check if cache is valid
  isCacheValid(cacheEntry) {
    return cacheEntry && (Date.now() - cacheEntry.timestamp) < this.cacheExpiry;
  }

  // Generic API fetch with error handling
  async fetchFromAPI(endpoint, params = {}) {
    // Ensure endpoint starts with / for proper URL construction
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullURL = `${this.baseURL}${cleanEndpoint}`;
    const url = new URL(fullURL);
    
    // Add query parameters
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.set(key, params[key]);
      }
    });

    const cacheKey = url.toString();
    const cached = this.cache.get(cacheKey);
    
    if (this.isCacheValid(cached)) {
      console.log(`🔄 Using cached data for ${endpoint}`);
      return cached.data;
    }

    try {
      console.log(`📡 Fetching from Python backend: ${url.toString()}`);
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check if it's an error response
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Cache the result
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      console.log(`✅ Successfully fetched from ${endpoint}: ${Array.isArray(data) ? data.length : 'N/A'} items`);
      return data;
      
    } catch (error) {
      console.error(`❌ Error fetching from ${endpoint}:`, error.message);
      
      // Return cached data if available, even if expired
      if (cached) {
        console.log('🔄 Using expired cache due to fetch error');
        return cached.data;
      }
      
      throw error;
    }
  }

  // Get NFL schedules for specific years
  async getSchedules(years = [2024, 2025]) {
    const yearString = years.join(',');
    return await this.fetchFromAPI('/schedules', { years: yearString });
  }

  // Get schedule for specific week
  async getWeekSchedule(year = 2025, week = 1, seasonType = 'REG') {
    return await this.fetchFromAPI('/schedules/week', {
      year: year,
      week: week,
      season_type: seasonType
    });
  }

  // Get team statistics
  async getTeamStats(years = [2024, 2025]) {
    const yearString = years.join(',');
    return await this.fetchFromAPI('/team-stats', { years: yearString });
  }

  // Get player statistics
  async getPlayerStats(years = [2024], position = null) {
    const params = { years: years.join(',') };
    if (position) params.position = position;
    
    return await this.fetchFromAPI('/player-stats', params);
  }

  // Get current NFL week info
  async getCurrentWeek() {
    return await this.fetchFromAPI('/current-week');
  }

  // Transform nfl-data-py schedule to Dashboard format
  transformScheduleToGameFormat(scheduleData) {
    if (!Array.isArray(scheduleData)) {
      console.warn('Expected array for schedule data');
      return [];
    }

    return scheduleData.map(game => {
      // Extract basic game info
      const gameDate = new Date(game.gameday);
      const gameTime = game.gametime || gameDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        timeZoneName: 'short'
      });

      // Build weather conditions string
      let weatherConditions = 'Unknown';
      if (game.temp && game.wind) {
        weatherConditions = `${game.temp}°F, Wind ${game.wind}mph`;
        if (game.roof && game.roof !== 'outdoors') {
          weatherConditions = `${game.roof} (${weatherConditions})`;
        }
      } else if (game.roof) {
        weatherConditions = game.roof;
      }

      return {
        id: game.game_id || `${game.season}_${game.week}_${game.away_team}_${game.home_team}`,
        homeTeamId: this.getTeamId(game.home_team),
        awayTeamId: this.getTeamId(game.away_team),
        homeTeam: this.getFullTeamName(game.home_team),
        awayTeam: this.getFullTeamName(game.away_team),
        homeTeamAbbr: game.home_team,
        awayTeamAbbr: game.away_team,
        week: game.week,
        season: game.season,
        gameDate: game.gameday,
        gameTime: gameTime,
        venue: game.stadium || game.location || 'TBD',
        network: game.referee || 'TBD', // Referee from nfl-data-py
        weatherConditions: weatherConditions,
        status: game.home_score !== null ? 'STATUS_FINAL' : 'STATUS_SCHEDULED',
        isCompleted: game.home_score !== null && game.away_score !== null,
        homeScore: game.home_score || 0,
        awayScore: game.away_score || 0,
        
        // Real betting lines from nfl-data-py!
        bettingLines: {
          spread: game.spread_line || 0,
          total: game.total_line || game.total || 45.0,
          homeMoneyline: game.home_moneyline || -110,
          awayMoneyline: game.away_moneyline || -110
        },
        
        // Additional rich data from nfl-data-py
        gameId: game.game_id,
        gameType: game.game_type,
        stadium: game.stadium,
        surface: game.surface,
        roof: game.roof,
        temperature: game.temp,
        wind: game.wind,
        referee: game.referee,
        homeCoach: game.home_coach,
        awayCoach: game.away_coach,
        homeQB: game.home_qb_name,
        awayQB: game.away_qb_name,
        isDivisionGame: game.div_game === 1,
        isOvertime: game.overtime === 1,
        lastUpdate: new Date().toISOString()
      };
    });
  }

  // Helper: Get team ID from abbreviation
  getTeamId(teamAbbr) {
    const teamMap = {
      'ARI': 22, 'ATL': 1, 'BAL': 33, 'BUF': 2, 'CAR': 29, 'CHI': 3,
      'CIN': 4, 'CLE': 5, 'DAL': 6, 'DEN': 7, 'DET': 8, 'GB': 9,
      'HOU': 34, 'IND': 11, 'JAX': 30, 'KC': 12, 'LV': 13, 'LAC': 24,
      'LAR': 14, 'MIA': 15, 'MIN': 16, 'NE': 17, 'NO': 18, 'NYG': 19,
      'NYJ': 20, 'PHI': 21, 'PIT': 23, 'SF': 25, 'SEA': 26, 'TB': 27,
      'TEN': 10, 'WAS': 28
    };
    return teamMap[teamAbbr] || 999;
  }

  // Helper: Get full team name from abbreviation
  getFullTeamName(teamAbbr) {
    const nameMap = {
      'ARI': 'Arizona Cardinals', 'ATL': 'Atlanta Falcons', 'BAL': 'Baltimore Ravens',
      'BUF': 'Buffalo Bills', 'CAR': 'Carolina Panthers', 'CHI': 'Chicago Bears',
      'CIN': 'Cincinnati Bengals', 'CLE': 'Cleveland Browns', 'DAL': 'Dallas Cowboys',
      'DEN': 'Denver Broncos', 'DET': 'Detroit Lions', 'GB': 'Green Bay Packers',
      'HOU': 'Houston Texans', 'IND': 'Indianapolis Colts', 'JAX': 'Jacksonville Jaguars',
      'KC': 'Kansas City Chiefs', 'LV': 'Las Vegas Raiders', 'LAC': 'Los Angeles Chargers',
      'LAR': 'Los Angeles Rams', 'MIA': 'Miami Dolphins', 'MIN': 'Minnesota Vikings',
      'NE': 'New England Patriots', 'NO': 'New Orleans Saints', 'NYG': 'New York Giants',
      'NYJ': 'New York Jets', 'PHI': 'Philadelphia Eagles', 'PIT': 'Pittsburgh Steelers',
      'SF': 'San Francisco 49ers', 'SEA': 'Seattle Seahawks', 'TB': 'Tampa Bay Buccaneers',
      'TEN': 'Tennessee Titans', 'WAS': 'Washington Commanders'
    };
    return nameMap[teamAbbr] || `Team ${teamAbbr}`;
  }

  // Transform team stats to expected format
  transformTeamStats(teamStatsData) {
    if (!Array.isArray(teamStatsData)) {
      return {};
    }

    const statsMap = {};
    teamStatsData.forEach(stat => {
      const teamId = this.getTeamId(stat.recent_team);
      statsMap[teamId] = {
        teamId: teamId,
        avgPointsScored: stat.points_scored || 22.0,
        avgPointsAllowed: stat.points_allowed || 22.0,
        defensiveRating: (stat.points_allowed || 22.0) / 22.0, // Normalized rating
        wins: 0, // Will be calculated from schedule
        losses: 0,
        ties: 0,
        winPercentage: 0.5,
        pointDifferential: (stat.points_scored || 22.0) - (stat.points_allowed || 22.0),
        totalYards: stat.yards_gained || 350,
        yardsAllowed: stat.yards_allowed || 350,
        turnovers: stat.turnovers || 1.5
      };
    });

    return statsMap;
  }

  // Get team stats by ID (fetches from backend)
  async getTeamStatsById(teamId, season = 2024) {
    try {
      const teamStatsData = await this.getTeamStats([season]);
      const statsMap = this.transformTeamStats(teamStatsData);
      
      return statsMap[teamId] || {
        teamId: teamId,
        avgPointsScored: 22.0,
        avgPointsAllowed: 22.0,
        defensiveRating: 1.0,
        wins: 8,
        losses: 8,
        ties: 0,
        winPercentage: 0.5,
        pointDifferential: 0
      };
    } catch (error) {
      console.warn(`Failed to get team stats for ${teamId}:`, error);
      return {
        teamId: teamId,
        avgPointsScored: 22.0,
        avgPointsAllowed: 22.0,
        defensiveRating: 1.0,
        wins: 8,
        losses: 8,
        ties: 0,
        winPercentage: 0.5,
        pointDifferential: 0
      };
    }
  }

  // Check backend health
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const health = await response.json();
      console.log('🟢 Python backend is healthy:', health);
      return health;
    } catch (error) {
      console.error('🔴 Python backend health check failed:', error);
      throw error;
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log('🗑️ NFL Data Python service cache cleared');
  }

  // Get cache stats
  getCacheStats() {
    const validEntries = Array.from(this.cache.values()).filter(entry => 
      this.isCacheValid(entry)
    ).length;
    
    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries: this.cache.size - validEntries,
      cacheExpiry: this.cacheExpiry / 1000 // in seconds
    };
  }
}

// Export singleton instance
export default new NFLDataPyService();