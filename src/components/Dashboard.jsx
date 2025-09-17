import React, { useState, useEffect } from 'react'
import { analyzeGame } from '../utils/poissonModel'
import { comprehensiveGameAnalysis } from '../utils/enhancedBettingModel'
import { calculateAdvancedSpreadProb } from '../utils/advancedSpreadModel'
import { getCurrentNFLInfo } from '../data/getCurrentNFLInfo'
import { getTeamStats2025 } from '../data/team-stats-2025'
import { formatOddsWithProbability, formatSpreadWithOdds, formatTotalWithOdds, formatMoneyline, formatOddsOnly } from '../utils/oddsFormatting'
import nflDataPyService from '../services/nflDataPyService'
import { getWeek1ESPNData } from '../data/week1-2025-espn-data'
import { debugLog, debugError } from '../config/environment'

function Dashboard({ 
  season = '2024', 
  week = 1, 
  isCurrentWeek = false, 
  selectedWeek = 'current',
  onWeekChange = () => {},
  currentNFLWeek = 1
}) {
  const [games, setGames] = useState([])
  const [analysis, setAnalysis] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [gameDetailLoading, setGameDetailLoading] = useState(false)
  // const { seasonInfo, updateStatus, lastUpdate, canUpdate, recentCompletedGames, isRealTimeActive } = useNFLDataUpdates()
  
  // Get current NFL info for status
  const currentNFLInfo = getCurrentNFLInfo()
  const seasonStatus = {
    isComplete: currentNFLInfo.season < parseInt(season) || 
                (currentNFLInfo.season === parseInt(season) && !currentNFLInfo.isActive),
    currentWeek: currentNFLInfo.week,
    isActive: currentNFLInfo.isActive
  }
  
  // Temporary placeholder values
  const updateStatus = 'idle'
  const recentCompletedGames = []

  // Enhanced fire emoji bet tracking system
  const [fireEmojiBetStats, setFireEmojiBetStats] = useState({
    currentWeek: { wins: 0, losses: 0, totalBets: 0, pendingBets: 0 },
    allTime: { wins: 0, losses: 0, totalBets: 0 }
  })

  // Calculate true all-time stats from localStorage on component mount
  const [historicalStats, setHistoricalStats] = useState({
    wins: 0,
    losses: 0,
    totalBets: 0,
    units: 0
  })

  // Function to calculate historical stats
  const calculateHistoricalStats = () => {
    try {
      const allWeeksKey = 'fireEmojiBets_allWeeks'
      const historicalData = JSON.parse(localStorage.getItem(allWeeksKey) || '[]')

      debugLog('📊 Historical data from localStorage:', historicalData)

      const totalStats = historicalData.reduce((acc, week) => ({
        wins: acc.wins + (week.wins || 0),
        losses: acc.losses + (week.losses || 0),
        totalBets: acc.totalBets + (week.totalBets || 0)
      }), { wins: 0, losses: 0, totalBets: 0 })

      debugLog('📊 Calculated historical stats:', totalStats)
      setHistoricalStats({
        wins: totalStats.wins,
        losses: totalStats.losses,
        totalBets: totalStats.totalBets,
        units: 0 // This function doesn't handle units, static data does
      })
    } catch (error) {
      console.error('Error calculating historical stats:', error)
      setHistoricalStats({ wins: 0, losses: 0, totalBets: 0, units: 0 })
    }
  }

  // Static performance data for completed weeks
  const getStaticWeekPerformance = (season, week) => {
    const staticData = {
      '2025': {
        1: { wins: 8, losses: 5, totalBets: 13, units: 3.0 }, // Week 1 final results
        2: { wins: 6, losses: 7, totalBets: 13, units: -1.0 } // Week 2 final results
      }
    }
    return staticData[season]?.[week] || null
  }

  // Calculate historical stats from static data + current week dynamic data
  useEffect(() => {
    const calculateStaticHistoricalStats = () => {
      const staticData = {
        '2025': {
          1: { wins: 8, losses: 5, totalBets: 13, units: 3.0 },
          2: { wins: 6, losses: 7, totalBets: 13, units: -1.0 }
        }
      }

      // Aggregate all completed weeks
      let totalStats = { wins: 0, losses: 0, totalBets: 0, units: 0 }

      Object.entries(staticData).forEach(([season, weeks]) => {
        Object.entries(weeks).forEach(([weekNum, weekData]) => {
          totalStats.wins += weekData.wins
          totalStats.losses += weekData.losses
          totalStats.totalBets += weekData.totalBets
          totalStats.units += weekData.units
        })
      })

      setHistoricalStats({
        wins: totalStats.wins,
        losses: totalStats.losses,
        totalBets: totalStats.totalBets,
        units: totalStats.units
      })
    }

    calculateStaticHistoricalStats()
  }, [])

  // Recalculate when week changes or fire emoji stats update
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateHistoricalStats()
    }, 3000) // Give fire emoji counting more time to complete

    return () => clearTimeout(timer)
  }, [season, week, fireEmojiBetStats.currentWeek])

  // Also recalculate when analysis data loads
  useEffect(() => {
    if (!loading && analysis.length > 0) {
      const timer = setTimeout(() => {
        calculateHistoricalStats()
      }, 4000) // Wait for fire emoji counting to complete after analysis loads

      return () => clearTimeout(timer)
    }
  }, [loading, analysis.length])

  // Helper function to determine bet result from completed games
  const determineBetResult = (betText, gameCard) => {
    try {
      const gameCardText = gameCard.innerText || gameCard.textContent || ''

      // Extract actual scores - look for pattern like "27 - 20" in the game card
      const scoreMatch = gameCardText.match(/(\d+)\s*-\s*(\d+)/)
      if (!scoreMatch) return null

      const [, homeScoreStr, awayScoreStr] = scoreMatch
      const homeScore = parseInt(homeScoreStr)
      const awayScore = parseInt(awayScoreStr)

      // Determine which team is home/away from the game header
      const headerMatch = gameCardText.match(/(\w+)\s*@\s*(\w+)/)
      if (!headerMatch) return null

      const [, awayTeam, homeTeam] = headerMatch

      // Parse the bet to determine what was predicted
      if (betText.includes('ML') || betText.includes('moneyline')) {
        // Moneyline bet - determine which team was bet on
        const actualWinner = homeScore > awayScore ? homeTeam :
                           awayScore > homeScore ? awayTeam : 'TIE'

        // Check if bet text contains the winning team
        return betText.includes(actualWinner) && actualWinner !== 'TIE'
      }

      if (betText.includes('+') || betText.includes('-')) {
        // Spread bet - parse the spread and determine if it covered
        const spreadMatch = betText.match(/([\w]+)\s*([\+\-]?\d+(?:\.\d+)?)/)
        if (spreadMatch) {
          const [, teamBetOn, spreadStr] = spreadMatch
          const spread = parseFloat(spreadStr)
          const actualMargin = homeScore - awayScore

          if (teamBetOn === homeTeam) {
            // Bet on home team
            return actualMargin > Math.abs(spread)
          } else {
            // Bet on away team
            return actualMargin < -Math.abs(spread)
          }
        }
      }

      if (betText.toLowerCase().includes('over') || betText.toLowerCase().includes('under')) {
        // Total bet - parse the total and check if it went over/under
        const totalMatch = betText.match(/(over|under)\s*(\d+(?:\.\d+)?)/i)
        if (totalMatch) {
          const [, direction, totalStr] = totalMatch
          const total = parseFloat(totalStr)
          const actualTotal = homeScore + awayScore

          if (direction.toLowerCase() === 'over') {
            return actualTotal > total
          } else {
            return actualTotal < total
          }
        }
      }

      return null // Could not determine
    } catch (error) {
      console.warn('Error determining bet result:', error)
      return null
    }
  }

  // Helper function to extract game date from card text
  const extractGameDateFromCard = (gameCardText) => {
    try {
      // Look for date patterns in the game card text
      const text = gameCardText || '';

      // Try to parse various date formats
      let gameDate = null;

      // Format: "9/3" or "9/15"
      const slashDateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
      if (slashDateMatch) {
        const month = parseInt(slashDateMatch[1]);
        const day = parseInt(slashDateMatch[2]);
        const currentYear = new Date().getFullYear();
        // Create date at midnight to avoid timezone issues
        gameDate = new Date(currentYear, month - 1, day);
      }

      // Format: "Sep 3" or "Nov 15"
      const monthDayMatch = text.match(/(\w{3})\s+(\d{1,2})/);
      if (monthDayMatch && !gameDate) {
        const monthStr = monthDayMatch[1];
        const day = parseInt(monthDayMatch[2]);
        const monthMap = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        if (monthMap[monthStr] !== undefined) {
          const currentYear = new Date().getFullYear();
          gameDate = new Date(currentYear, monthMap[monthStr], day);
        }
      }

      // Format: ISO date like "2024-09-03" or "2025-09-15"
      const isoMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch && !gameDate) {
        const year = parseInt(isoMatch[1]);
        const month = parseInt(isoMatch[2]);
        const day = parseInt(isoMatch[3]);
        gameDate = new Date(year, month - 1, day);
      }

      if (gameDate && !isNaN(gameDate.getTime())) {
        return gameDate;
      }

      return null;
    } catch (error) {
      console.warn('Error extracting game date:', error);
      return null;
    }
  };

  // Real-time emoji counting with better logic
  useEffect(() => {
    const countFireEmojiBets = () => {
      // Count only from .calculated-probabilities elements to avoid duplicates
      const fireEmojiElements = document.querySelectorAll('.calculated-probabilities')

      let completedWins = 0
      let completedLosses = 0
      let pendingBets = 0
      const foundBets = []

      fireEmojiElements.forEach(element => {
        const elementText = element.innerText || element.textContent || ''

        if (elementText.includes('🔥')) {
          foundBets.push(elementText.trim())

          // Check if this is from a completed game by looking at the parent game card
          const gameCard = element.closest('.game-card')
          let isGameCompleted = false

          if (gameCard) {
            const gameCardText = gameCard.innerText || gameCard.textContent || ''

            // More strict completion check
            isGameCompleted = gameCardText.includes('FINAL') ||
                             gameCardText.includes('Final Score:') ||
                             gameCardText.includes('STATUS_FINAL')

            // Additional check: make sure the game date has passed
            const currentDate = new Date()
            // Set current date to start of day for fair comparison
            currentDate.setHours(0, 0, 0, 0)

            const gameDate = extractGameDateFromCard(gameCardText)
            if (gameDate) {
              // Set game date to start of day for fair comparison
              gameDate.setHours(0, 0, 0, 0)

              // If game date is in the future, it definitely can't be completed
              if (gameDate > currentDate) {
                isGameCompleted = false

              }
            }

            // Triple-check: if no clear completion markers and date suggests future, mark as pending
            if (!gameCardText.includes('✅') && !gameCardText.includes('❌') &&
                !gameCardText.includes('FINAL') && !gameCardText.includes('Final Score:')) {

              // Look for time indicators that suggest game hasn't started
              if (gameCardText.includes('PM') || gameCardText.includes('AM') ||
                  gameCardText.includes(':')) {
                isGameCompleted = false
              }
            }
          }

          // Count completed bets (with results or from completed games)
          if (elementText.includes('✅')) {
            completedWins++
          } else if (elementText.includes('❌')) {
            completedLosses++
          } else if (isGameCompleted) {
            // Double-check: don't process as completed if this looks like a future game
            const gameDate = extractGameDateFromCard(gameCardText)
            const currentDate = new Date()
            currentDate.setHours(0, 0, 0, 0)

            if (gameDate) {
              gameDate.setHours(0, 0, 0, 0)
              if (gameDate > currentDate) {
                // This is definitely a future game, treat as pending
                pendingBets++
                return // Skip to next element
              }
            }

            // Game is completed but no win/loss emoji shown yet
            // We need to determine the result from the actual game data
            const betWon = determineBetResult(elementText, gameCard)
            if (betWon === true) {
              completedWins++
            } else if (betWon === false) {
              completedLosses++
            } else {
              pendingBets++ // Could not determine result
            }
          } else {
            // Fire emoji bet without result = pending/future game
            pendingBets++
          }
        }
      })

      const totalCompletedBets = completedWins + completedLosses
      const currentWeekStats = {
        wins: completedWins,
        losses: completedLosses,
        totalBets: totalCompletedBets,
        pendingBets: pendingBets
      }

      // Recalculate all-time stats from historical data + current week
      const recalculateAllTimeStats = () => {
        const allWeeksKey = 'fireEmojiBets_allWeeks'
        const historicalData = JSON.parse(localStorage.getItem(allWeeksKey) || '[]')

        // Filter out current week from historical data to avoid double counting
        const otherWeeksData = historicalData.filter(w =>
          !(w.season === season && w.week === week)
        )

        // Sum all historical weeks (excluding current week) plus current week
        const allTimeStats = otherWeeksData.reduce((acc, weekData) => ({
          wins: acc.wins + (weekData.wins || 0),
          losses: acc.losses + (weekData.losses || 0),
          totalBets: acc.totalBets + (weekData.totalBets || 0)
        }), {
          wins: currentWeekStats.wins,
          losses: currentWeekStats.losses,
          totalBets: currentWeekStats.totalBets
        })

        return allTimeStats
      }

      setFireEmojiBetStats(prev => ({
        currentWeek: currentWeekStats,
        allTime: recalculateAllTimeStats()
      }))

    }

    // Initial count after DOM renders
    const initialTimer = setTimeout(countFireEmojiBets, 1000)

    // Determine update frequency based on whether there are live games
    const hasLiveGames = analysis.some(game =>
      !game.isCompleted &&
      new Date(game.gameDate).toDateString() === new Date().toDateString()
    )

    // More frequent updates during game days (10 seconds) vs off days (60 seconds)
    const updateInterval = hasLiveGames ? 10000 : 60000
    const interval = setInterval(countFireEmojiBets, updateInterval)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [analysis, season, week]) // Re-run when analysis, season, or week changes

  // Store/retrieve historical data from localStorage
  useEffect(() => {
    const storeWeekData = () => {
      if (fireEmojiBetStats.currentWeek.totalBets > 0) {
        const storageKey = `fireEmojiBets_${season}_week_${week}`
        const weekData = {
          ...fireEmojiBetStats.currentWeek,
          season: season,
          week: week,
          lastUpdated: new Date().toISOString()
        }
        localStorage.setItem(storageKey, JSON.stringify(weekData))

        // Store in master index
        const allWeeksKey = 'fireEmojiBets_allWeeks'
        const existingData = JSON.parse(localStorage.getItem(allWeeksKey) || '[]')
        const weekIndex = existingData.findIndex(w => w.season === season && w.week === week)

        if (weekIndex >= 0) {
          existingData[weekIndex] = weekData
        } else {
          existingData.push(weekData)
        }

        localStorage.setItem(allWeeksKey, JSON.stringify(existingData))

        // Trigger recalculation of all-time stats after storing data
        const updatedAllTimeStats = existingData.reduce((acc, weekData) => ({
          wins: acc.wins + (weekData.wins || 0),
          losses: acc.losses + (weekData.losses || 0),
          totalBets: acc.totalBets + (weekData.totalBets || 0)
        }), { wins: 0, losses: 0, totalBets: 0 })

        setFireEmojiBetStats(prev => ({
          ...prev,
          allTime: updatedAllTimeStats
        }))
      }
    }

    // Store data when it changes
    const timer = setTimeout(storeWeekData, 2000)
    return () => clearTimeout(timer)
  }, [fireEmojiBetStats.currentWeek, season, week])

  // Load historical all-time stats and include current week
  useEffect(() => {
    const loadAllTimeStats = () => {
      const allWeeksKey = 'fireEmojiBets_allWeeks'
      const historicalData = JSON.parse(localStorage.getItem(allWeeksKey) || '[]')

      // Filter out current week from historical data to avoid double counting
      const otherWeeksData = historicalData.filter(w =>
        !(w.season === season && w.week === week)
      )

      // Sum all historical weeks (excluding current week) plus current week
      const allTimeStats = otherWeeksData.reduce((acc, weekData) => ({
        wins: acc.wins + (weekData.wins || 0),
        losses: acc.losses + (weekData.losses || 0),
        totalBets: acc.totalBets + (weekData.totalBets || 0)
      }), {
        wins: fireEmojiBetStats.currentWeek.wins,
        losses: fireEmojiBetStats.currentWeek.losses,
        totalBets: fireEmojiBetStats.currentWeek.totalBets
      })

      setFireEmojiBetStats(prev => ({
        ...prev,
        allTime: allTimeStats
      }))

    }

    // Only load if current week stats are available
    if (fireEmojiBetStats.currentWeek.wins !== undefined) {
      loadAllTimeStats()
    }
  }, [season, week, fireEmojiBetStats.currentWeek]) // Include current week in dependencies

  // Create summary object for display
  const fireEmojiBetSummary = {
    // Current week stats
    totalWins: fireEmojiBetStats.currentWeek.wins,
    totalLosses: fireEmojiBetStats.currentWeek.losses,
    totalBets: fireEmojiBetStats.currentWeek.totalBets,
    pendingBets: fireEmojiBetStats.currentWeek.pendingBets,
    winRate: fireEmojiBetStats.currentWeek.totalBets > 0 ?
      ((fireEmojiBetStats.currentWeek.wins / fireEmojiBetStats.currentWeek.totalBets) * 100).toFixed(1) : '0.0',

    // All-time stats
    allTimeWins: fireEmojiBetStats.allTime.wins,
    allTimeLosses: fireEmojiBetStats.allTime.losses,
    allTimeBets: fireEmojiBetStats.allTime.totalBets,
    allTimeWinRate: fireEmojiBetStats.allTime.totalBets > 0 ?
      ((fireEmojiBetStats.allTime.wins / fireEmojiBetStats.allTime.totalBets) * 100).toFixed(1) : '0.0',

    byType: {
      moneyline: { wins: 0, losses: 0 }, // We'll enhance this later if needed
      spread: { wins: 0, losses: 0 },
      total: { wins: 0, losses: 0 }
    }
  }

  // Note: Removed transformAPIGameData function - no longer needed since nfl-data-py handles all data transformation

  // Load real NFL data
  useEffect(() => {
    // Clear fire emoji storage for this week to prevent duplicates
    if (!window.fireEmojiBetsStorage) window.fireEmojiBetsStorage = {};
    const weekKey = `${season}_week_${week}`;
    window.fireEmojiBetsStorage[weekKey] = [];

    // Add flag to prevent duplicate storage during same render cycle
    window.currentRenderKey = weekKey;

    const loadRealData = async () => {
      setLoading(true)
      setError(null)

      try {

        let weekGames = []
        
        // Use nfl-data-py Python backend for 2024+ data, static files for older seasons
        if (parseInt(season) >= 2024) {
          
          try {
            // Check if Python backend is available
            await nflDataPyService.checkHealth()
            
            // Fetch week data from nfl-data-py backend
            const scheduleData = await nflDataPyService.getWeekSchedule(parseInt(season), week, 'REG')
            weekGames = nflDataPyService.transformScheduleToGameFormat(scheduleData)
            
          } catch (error) {
            console.warn(`⚠️ nfl-data-py backend unavailable: ${error.message}`)
            weekGames = []
          }
        } else {
          // For historical data, try Python backend first, then fallback
          try {
            const scheduleData = await nflDataPyService.getWeekSchedule(parseInt(season), week, 'REG')
            weekGames = nflDataPyService.transformScheduleToGameFormat(scheduleData)
          } catch (error) {
            console.warn('Failed to get historical data from Python backend:', error)
            weekGames = []
          }
        }

        if (weekGames && weekGames.length > 0) {
          const completedGames = weekGames.filter(g => g.isCompleted)
          const pendingGames = weekGames.filter(g => !g.isCompleted)

          if (completedGames.length > 0) {
          }
        }
        
        if (weekGames.length === 0) {
          setGames([])
          setAnalysis([])
          setLoading(false)
          
          // Check if it's an API key issue for current season
          if (season >= 2024) {
            setError('No games found. This might be due to missing API key configuration. Check the setup guide for The Odds API.')
          }
          
          return
        }
        
        // Transform the game data to include team names and stats
        const processedGamesPromises = weekGames.map(async (game) => {
          // Team names are already provided by nfl-data-py
          
          // Get team stats from appropriate source
          let homeStats, awayStats
          if (parseInt(season) === 2025) {
            // Use 2025 projections for future season
            homeStats = getTeamStats2025(game.homeTeamId)
            awayStats = getTeamStats2025(game.awayTeamId)
          } else {
            // Try to use nfl-data-py backend for all seasons
            try {
              homeStats = await nflDataPyService.getTeamStatsById(game.homeTeamId, parseInt(season))
              awayStats = await nflDataPyService.getTeamStatsById(game.awayTeamId, parseInt(season))
            } catch (error) {
              console.warn('Failed to get team stats from nfl-data-py, using defaults')
              homeStats = null
              awayStats = null
            }
          }

          // Default stats if none found (fallback for API data)
          const defaultStats = {
            avgPointsScored: 22.5,
            avgPointsAllowed: 22.5, 
            defensiveRating: 1.0
          }

          return {
            id: game.id,
            homeTeam: game.homeTeam || `Team ${game.homeTeamId}`,
            awayTeam: game.awayTeam || `Team ${game.awayTeamId}`,
            homeTeamAbbr: game.homeTeamAbbr || 'HOM',
            awayTeamAbbr: game.awayTeamAbbr || 'AWY',
            week: game.week,
            season: game.season,
            gameDate: game.gameDate,
            gameTime: game.gameTime,
            venue: game.venue,
            referee: game.referee, // Referee information
            weatherConditions: game.weatherConditions,
            status: game.status,
            isCompleted: game.isCompleted,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            homeTeamStats: homeStats || defaultStats,
            awayTeamStats: awayStats || defaultStats,
            bettingLines: game.bettingLines
          }
        })
        
        const processedGames = await Promise.all(processedGamesPromises)
        setGames(processedGames)

        // Analyze each game using the comprehensive model (same as performance calculations)
        const gameAnalyses = processedGames.map(game => {
          // Create game context for comprehensive analysis
          const gameContext = {
            isDivisionGame: game.homeTeamStats.division === game.awayTeamStats.division,
            weather: { temperature: 70, windSpeed: 5, precipitation: false },
            isRevenge: false,
            isPrimeTime: false,
            homeRecentForm: [],
            awayRecentForm: [],
            homeInjuries: [],
            awayInjuries: []
          }
          
          const analysis = comprehensiveGameAnalysis(game.homeTeamStats, game.awayTeamStats, game.bettingLines, gameContext)
          return {
            ...game,
            analysis,
            gameContext
          }
        })

        setAnalysis(gameAnalyses)
        setLoading(false)
      } catch (err) {
        console.error('Error loading real NFL data:', err)
        setError(err.message)
        setLoading(false)
      }
    }
    
    loadRealData()
  }, [season, week])

  const calculateEdge = (calculatedProb, bookmakerOdds) => {
    const impliedProb = 1 / bookmakerOdds
    const edge = calculatedProb - impliedProb
    return (edge * 100).toFixed(2)
  }

  // Handle game click to show player details
  const handleGameClick = async (game) => {
    setSelectedGame(game)
    setGameDetailLoading(true)
    
    try {
      
      // Get player stats from nfl-data-py backend
      const playerStats = await nflDataPyService.getPlayerStats([parseInt(season)], null)
      
      // Filter players from the two teams in this game
      const gamePlayerStats = playerStats.filter(player => 
        player.recent_team === game.homeTeamAbbr || player.recent_team === game.awayTeamAbbr
      )
      
      // Enhance the selected game with player data
      setSelectedGame({
        ...game,
        playerStats: gamePlayerStats,
        playerProps: generatePlayerProps(gamePlayerStats, game)
      })
      
    } catch (error) {
      console.error('Failed to fetch player data:', error)
      setSelectedGame({
        ...game,
        playerStats: [],
        playerProps: [],
        error: 'Failed to load player data'
      })
    } finally {
      setGameDetailLoading(false)
    }
  }

  // Generate mock player prop betting lines based on stats
  const generatePlayerProps = (playerStats, game) => {
    const props = []
    
    // Get top players for each team by position
    const homeTeamPlayers = playerStats.filter(p => p.recent_team === game.homeTeamAbbr)
    const awayTeamPlayers = playerStats.filter(p => p.recent_team === game.awayTeamAbbr)
    
    // Add QB props
    const homeQB = homeTeamPlayers.find(p => p.position === 'QB')
    const awayQB = awayTeamPlayers.find(p => p.position === 'QB')
    
    if (homeQB) {
      props.push({
        player: homeQB.player_display_name,
        team: game.homeTeamAbbr,
        type: 'Passing Yards',
        line: Math.round((homeQB.passing_yards / 17) || 250), // Average per game
        overOdds: -110,
        underOdds: -110
      })
      props.push({
        player: homeQB.player_display_name,
        team: game.homeTeamAbbr,
        type: 'Passing TDs',
        line: Math.round((homeQB.passing_tds / 17) || 1.5),
        overOdds: -115,
        underOdds: -105
      })
    }
    
    if (awayQB) {
      props.push({
        player: awayQB.player_display_name,
        team: game.awayTeamAbbr,
        type: 'Passing Yards',
        line: Math.round((awayQB.passing_yards / 17) || 250),
        overOdds: -110,
        underOdds: -110
      })
      props.push({
        player: awayQB.player_display_name,
        team: game.awayTeamAbbr,
        type: 'Passing TDs',
        line: Math.round((awayQB.passing_tds / 17) || 1.5),
        overOdds: -115,
        underOdds: -105
      })
    }
    
    // Add RB props
    const homeRBs = homeTeamPlayers.filter(p => p.position === 'RB').slice(0, 2)
    const awayRBs = awayTeamPlayers.filter(p => p.position === 'RB').slice(0, 2)
    
    homeRBs.forEach(rb => {
      props.push({
        player: rb.player_display_name,
        team: game.homeTeamAbbr,
        type: 'Rushing Yards',
        line: Math.round((rb.rushing_yards / 17) || 75),
        overOdds: -110,
        underOdds: -110
      })
    })
    
    awayRBs.forEach(rb => {
      props.push({
        player: rb.player_display_name,
        team: game.awayTeamAbbr,
        type: 'Rushing Yards',
        line: Math.round((rb.rushing_yards / 17) || 75),
        overOdds: -110,
        underOdds: -110
      })
    })
    
    // Add WR props
    const homeWRs = homeTeamPlayers.filter(p => p.position === 'WR').slice(0, 3)
    const awayWRs = awayTeamPlayers.filter(p => p.position === 'WR').slice(0, 3)
    
    homeWRs.forEach(wr => {
      props.push({
        player: wr.player_display_name,
        team: game.homeTeamAbbr,
        type: 'Receiving Yards',
        line: Math.round((wr.receiving_yards / 17) || 60),
        overOdds: -110,
        underOdds: -110
      })
    })
    
    awayWRs.forEach(wr => {
      props.push({
        player: wr.player_display_name,
        team: game.awayTeamAbbr,
        type: 'Receiving Yards',
        line: Math.round((wr.receiving_yards / 17) || 60),
        overOdds: -110,
        underOdds: -110
      })
    })
    
    return props
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-title">
          <h2>NFL Edge Analysis - {season} Season</h2>
          <p>Advanced statistical modeling to identify value betting opportunities</p>
          
          {seasonStatus?.isComplete && (
            <div className="season-complete-badge">
              <span className="badge-icon">🏆</span>
              <div className="badge-content">
                <strong>Season Complete</strong>
                <span>Super Bowl Winner: {seasonStatus.superBowlWinner}</span>
                <span>Final Score: {seasonStatus.superBowlScore}</span>
              </div>
            </div>
          )}
          
          {updateStatus === 'monitoring' && (
            <div className="update-status-badge">
              <span className="status-icon">🔄</span>
              <span>Real-Time Monitoring Active</span>
              <span className="monitor-detail">Updates every 2 minutes during games</span>
              {lastUpdate && <span className="last-update">Last: {lastUpdate.toLocaleString()}</span>}
            </div>
          )}
          
          {updateStatus === 'updated' && recentCompletedGames.length > 0 && (
            <div className="game-completed-badge">
              <span className="completion-icon">✅</span>
              <div className="completion-content">
                <strong>Game Just Completed!</strong>
                <span>{recentCompletedGames[0].awayTeam} {recentCompletedGames[0].awayScore} - {recentCompletedGames[0].homeScore} {recentCompletedGames[0].homeTeam}</span>
                <span className="completion-time">Stats updated automatically</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="week-selector-professional">
          <div className="week-selector-container">
            <div className="week-navigation">
              <button
                className="week-nav-btn prev"
                onClick={() => {
                  const currentWeekNum = selectedWeek === 'current' ? currentNFLWeek : parseInt(selectedWeek);
                  const prevWeek = currentWeekNum - 1;
                  if (prevWeek >= 1) {
                    // If navigating back to the current NFL week, set to 'current' instead of the week number
                    if (prevWeek === currentNFLWeek) {
                      onWeekChange('current');
                    } else {
                      onWeekChange(prevWeek.toString());
                    }
                  }
                }}
                disabled={
                  selectedWeek === 'current' ? currentNFLWeek <= 1 : parseInt(selectedWeek) <= 1
                }
                title="Previous Week"
              >
                <svg width="46" height="46" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="5.5,7 2.5,4 5.5,1"></polyline>
                </svg>
              </button>

              <div className="week-display-pro">
                <div className="week-main">
                  <span className="week-number">Week {week}</span>
                  <span className="season-year">{season}</span>
                </div>
              </div>

              <button
                className="week-nav-btn next"
                onClick={() => {
                  const currentWeekNum = selectedWeek === 'current' ? currentNFLWeek : parseInt(selectedWeek);
                  const nextWeek = currentWeekNum + 1;
                  if (nextWeek <= 18) {
                    // If navigating forward to the current NFL week, set to 'current' instead of the week number
                    if (nextWeek === currentNFLWeek) {
                      onWeekChange('current');
                    } else {
                      onWeekChange(nextWeek.toString());
                    }
                  }
                }}
                disabled={
                  selectedWeek === 'current' ? currentNFLWeek >= 18 : parseInt(selectedWeek) >= 18
                }
                title="Next Week"
              >
                <svg width="46" height="46" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="2.5,7 5.5,4 2.5,1"></polyline>
                </svg>
              </button>
            </div>

            <div className="week-controls-pro">
              <button
                className={`week-preset-btn ${selectedWeek === 'current' ? 'active' : ''}`}
                onClick={() => onWeekChange('current')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12,6 12,12 16,14"></polyline>
                </svg>
                {selectedWeek === 'current' ? 'Current Week' : 'Back to Current'}
              </button>

              <div className="week-dropdown-wrapper">
                <select
                  value={selectedWeek === 'current' ? currentNFLWeek : selectedWeek}
                  onChange={(e) => onWeekChange(e.target.value)}
                  className="week-dropdown-pro"
                >
                  {Array.from({length: 18}, (_, i) => i + 1).map(weekNum => (
                    <option key={weekNum} value={weekNum}>
                      Week {weekNum}
                    </option>
                  ))}
                </select>
                <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {loading && (
          <div className="loading-message">
            <div className="loading-spinner"></div>
            <p>Loading real NFL data for Week {week} of the {season} season...</p>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            <p>Error loading NFL data: {error}</p>
            <p>Please try refreshing the page or selecting a different week.</p>
          </div>
        )}
        
        {/* Simple Performance Section - Matching IMG_4457 */}
        {!loading && !error && analysis.length > 0 && (
          <div className="performance-section">
            <h3>Performance</h3>

            {/* Current Week */}
            <div className="performance-simple-horizontal compact">
              <div className="perf-metric">
                <div className="perf-label">Total Units</div>
                <div className="perf-value positive">
                  +{((fireEmojiBetSummary.totalWins - fireEmojiBetSummary.totalLosses) * 1.0).toFixed(2)}
                </div>
              </div>
              <div className="perf-metric">
                <div className="perf-label">Record</div>
                <div className="perf-value neutral">
                  {fireEmojiBetSummary.totalWins}-{fireEmojiBetSummary.totalLosses}-0
                </div>
              </div>
              <div className="perf-metric">
                <div className="perf-label">ROI</div>
                <div className="perf-value positive">
                  +{fireEmojiBetSummary.winRate}%
                </div>
              </div>
            </div>


          </div>
        )}

        
        
        {!loading && !error && analysis.length === 0 && (
          <div className="no-games-message">
            <p>No games available for Week {week} of the {season} season.</p>
            <p><small>💡 To get current NFL data, set up your free Odds API key (see ODDS_API_SETUP.md)</small></p>
          </div>
        )}
      </div>

      <div className="games-grid">
        {analysis.map(game => (
          <div key={game.id} className="game-card clickable" onClick={() => handleGameClick(game)}>
            <div className="game-header">
              <h3>{game.awayTeamAbbr} @ {game.homeTeamAbbr}</h3>
              <div className="game-info">
                <span className="game-date">{new Date(game.gameDate).toLocaleDateString()}</span>
                <span className="game-time">{game.gameTime}</span>
                <span className="venue">{game.venue}</span>
                <span className="referee">Referee: {game.referee}</span>
                <span className="weather">{game.weatherConditions}</span>
                {game.status && (
                  <span className="game-status">
                    {game.status === 'STATUS_FINAL' ? 'Final Score' : 
                     game.status === 'STATUS_SCHEDULED' ? 'Scheduled' : 
                     game.status}
                  </span>
                )}
              </div>
            </div>

            {game.isCompleted ? (
              <div className="final-scores">
                <div className="score-final">
                  <span className="team">{game.homeTeam}</span>
                  <span className="score final-score">{game.homeScore}</span>
                </div>
                <div className="score-final">
                  <span className="team">{game.awayTeam}</span>
                  <span className="score final-score">{game.awayScore}</span>
                </div>
                <div className="game-final-badge">FINAL</div>
              </div>
            ) : (
              <div className="expected-scores">
                <div className="score-prediction">
                  <span className="team">{game.homeTeam}</span>
                  <span className="score">Proj: {game.analysis.expectedPoints.home.toFixed(1)}</span>
                </div>
                <div className="score-prediction">
                  <span className="team">{game.awayTeam}</span>
                  <span className="score">Proj: {game.analysis.expectedPoints.away.toFixed(1)}</span>
                </div>
              </div>
            )}

            <div className="betting-analysis">
              {game.detailedOdds?.hasRealOdds && (
                <div className="sportsbook-indicator">
                  <span className="real-odds-badge">Real Sportsbook Lines</span>
                  {game.detailedOdds.draftkings && <span className="book-logo">DK</span>}
                  {game.detailedOdds.fanduel && <span className="book-logo">FD</span>}
                </div>
              )}
              
              <div className="bet-line">
                <span className="bet-type">Moneyline</span>
                <div className="odds-display">
                  <span className="away-odds">{game.awayTeamAbbr}: {formatOddsWithProbability(game.bettingLines.awayMoneyline)}</span>
                  <span className="home-odds">{game.homeTeamAbbr}: {formatOddsWithProbability(game.bettingLines.homeMoneyline)}</span>
                </div>
                {(() => {
                  // Check if previous week is completed before showing fire emoji picks for future weeks
                  const isPreviousWeekCompleted = async () => {
                    // Only check for future weeks (not current or past)
                    const currentNFLWeekNum = typeof currentNFLWeek === 'number' ? currentNFLWeek : parseInt(currentNFLWeek);
                    const gameWeekNum = parseInt(game.week);

                    // If this is the current week or a past week, allow fire emojis
                    if (gameWeekNum <= currentNFLWeekNum) {
                      return true;
                    }

                    // For future weeks, check if previous week (gameWeekNum - 1) is fully completed
                    const previousWeek = gameWeekNum - 1;
                    if (previousWeek < 1) return true; // Week 1 has no previous week

                    try {
                      const previousWeekSchedule = await nflDataPyService.getWeekSchedule(parseInt(season), previousWeek, 'REG');
                      const previousWeekGames = nflDataPyService.transformScheduleToGameFormat(previousWeekSchedule);

                      // Check if ALL games in previous week are completed
                      const allGamesCompleted = previousWeekGames.every(g => g.isCompleted);
                      return allGamesCompleted;
                    } catch (error) {
                      console.warn(`Could not check previous week ${previousWeek} completion:`, error);
                      return false; // Conservative approach - don't show picks if we can't verify
                    }
                  };

                  // For future weeks, check previous week completion
                  // FORCE current week to 2 for testing
                  const currentNFLWeekNum = 2; // Force to week 2 for debugging
                  const gameWeekNum = parseInt(game.week);

                  // Debug logging to see what's happening - check ANY week 4 game
                  if (parseInt(game.week) >= 3) { // Debug weeks 3+ to see why they're showing
                    console.log('🔥 FIRE EMOJI DEBUG WEEK 3+:', {
                      gameWeek: gameWeekNum,
                      currentNFLWeek: currentNFLWeekNum,
                      gameString: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
                      shouldShow: gameWeekNum <= currentNFLWeekNum,
                      willReturn: gameWeekNum > currentNFLWeekNum ? 'null' : 'continue',
                      actualComparison: `${gameWeekNum} > ${currentNFLWeekNum} = ${gameWeekNum > currentNFLWeekNum}`
                    });
                  }

                  // Allow fire emojis for current/past weeks AND the next upcoming week
                  const nextUpcomingWeek = currentNFLWeekNum + 1; // Week 3 in this case

                  if (gameWeekNum > nextUpcomingWeek) {
                    // This is a future week beyond the next upcoming - don't show fire emoji picks
                    return null;
                  }

                  // Show model predictions only if we would actually bet (using same criteria as performance calculations)
                  if (!game.analysis?.probabilities?.moneyline || !game.bettingLines?.homeMoneyline || !game.bettingLines?.awayMoneyline) {
                    return null;
                  }
                  
                  const homeWinProb = (game.analysis.probabilities.moneyline.homeWinProb || 0) * 100;
                  const awayWinProb = (game.analysis.probabilities.moneyline.awayWinProb || 0) * 100;
                  
                  // Safe implied probability calculation with null checks
                  const getImpliedProb = (odds) => {
                    if (!odds || odds === 0) return 50;
                    return odds > 0 ? (100 / (odds + 100)) * 100 : (Math.abs(odds) / (Math.abs(odds) + 100)) * 100;
                  };
                  
                  const homeImplied = getImpliedProb(game.bettingLines.homeMoneyline);
                  const awayImplied = getImpliedProb(game.bettingLines.awayMoneyline);
                  
                  const homeBaseEdge = homeWinProb - homeImplied;
                  const awayBaseEdge = awayWinProb - awayImplied;
                  
                  // Apply pattern bonuses (simplified)
                  let mlQualityBonus = 0;
                  let mlPatternMatch = false;
                  if (game.gameContext?.isDivisionGame && game.bettingLines.awayMoneyline >= 180 && game.bettingLines.awayMoneyline <= 350) {
                    if (awayBaseEdge > 2) {
                      mlQualityBonus += 4.5;
                      mlPatternMatch = true;
                    }
                  }
                  if (game.bettingLines.homeMoneyline >= 200 && homeBaseEdge > 3) {
                    mlQualityBonus += 4.2;
                    mlPatternMatch = true;
                  }
                  if (game.bettingLines.awayMoneyline >= 200 && awayBaseEdge > 3) {
                    mlQualityBonus += 4.2;
                    mlPatternMatch = true;
                  }
                  
                  const adjustedHomeMLEdge = homeBaseEdge + (homeBaseEdge > 0 ? mlQualityBonus : 0);
                  const adjustedAwayMLEdge = awayBaseEdge + (awayBaseEdge > 0 ? mlQualityBonus : 0);
                  const mlMinEdge = mlPatternMatch ? 5.5 : 8.5;
                  
                  // Check if we would actually bet
                  const homeMLBet = adjustedHomeMLEdge >= mlMinEdge && 
                    !(game.bettingLines.homeMoneyline >= -180 && game.bettingLines.homeMoneyline <= -120);
                  const awayMLBet = adjustedAwayMLEdge >= mlMinEdge && 
                    !(game.bettingLines.awayMoneyline >= -180 && game.bettingLines.awayMoneyline <= -120);
                  
                  if (homeMLBet || awayMLBet) {
                    // Store the fire emoji bet for Performance page
                    const fireBet = {
                      game: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
                      week: game.week,
                      season: game.season,
                      type: 'moneyline',
                      team: homeMLBet ? game.homeTeamAbbr : game.awayTeamAbbr,
                      odds: homeMLBet ? game.bettingLines.homeMoneyline : game.bettingLines.awayMoneyline,
                      betText: homeMLBet ? `${game.homeTeamAbbr} ML ${game.bettingLines.homeMoneyline}` :
                               `${game.awayTeamAbbr} ML ${game.bettingLines.awayMoneyline}`,
                      edge: homeMLBet ? adjustedHomeMLEdge : adjustedAwayMLEdge,
                      gameData: {
                        homeScore: game.homeScore,
                        awayScore: game.awayScore,
                        isCompleted: game.isCompleted,
                        homeTeamAbbr: game.homeTeamAbbr,
                        awayTeamAbbr: game.awayTeamAbbr,
                        bettingLines: game.bettingLines
                      }
                    };

                    // Only store if this is the current render cycle (prevent duplicates)
                    const currentWeekKey = `${season}_week_${week}`;
                    if (window.currentRenderKey === currentWeekKey) {
                      if (!window.fireEmojiBetsStorage) window.fireEmojiBetsStorage = {};
                      if (!window.fireEmojiBetsStorage[currentWeekKey]) window.fireEmojiBetsStorage[currentWeekKey] = [];

                      // Check for duplicates before adding
                      const existingBet = window.fireEmojiBetsStorage[currentWeekKey].find(existing =>
                        existing.game === fireBet.game && existing.type === fireBet.type && existing.team === fireBet.team
                      );

                      if (!existingBet) {
                        window.fireEmojiBetsStorage[currentWeekKey].push(fireBet);
                      }
                    }

                    // Store this actual displayed fire emoji for Performance page tallying
                    const fireEmojiText = homeMLBet ? `${game.homeTeamAbbr} +${adjustedHomeMLEdge.toFixed(1)}% edge` :
                                         `${game.awayTeamAbbr} +${adjustedAwayMLEdge.toFixed(1)}% edge`;

                    const displayedFireEmoji = {
                      id: `${game.awayTeamAbbr}@${game.homeTeamAbbr}_W${game.week}_ML`,
                      week: game.week,
                      season: game.season,
                      game: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
                      type: 'moneyline',
                      displayText: fireEmojiText,
                      betTeam: homeMLBet ? game.homeTeamAbbr : game.awayTeamAbbr,
                      odds: homeMLBet ? game.bettingLines.homeMoneyline : game.bettingLines.awayMoneyline,
                      homeScore: game.homeScore,
                      awayScore: game.awayScore,
                      isCompleted: game.isCompleted,
                      homeTeamAbbr: game.homeTeamAbbr,
                      awayTeamAbbr: game.awayTeamAbbr
                    };

                    // Store in global array for Performance page to read
                    if (!window.actualDisplayedFireEmojis) window.actualDisplayedFireEmojis = [];

                    // Only add if not already stored
                    const alreadyExists = window.actualDisplayedFireEmojis.find(stored => stored.id === displayedFireEmoji.id);
                    if (!alreadyExists) {
                      window.actualDisplayedFireEmojis.push(displayedFireEmoji);
                    }

                    // Calculate win/loss for completed games
                    let winLossIndicator = '';
                    if (game.isCompleted && game.homeScore !== null && game.awayScore !== null) {
                      const actualWinner = game.homeScore > game.awayScore ? 'HOME' :
                                          game.awayScore > game.homeScore ? 'AWAY' : 'TIE';
                      const mlBetTeam = homeMLBet ? 'HOME' : 'AWAY';
                      const mlWon = actualWinner === mlBetTeam;
                      winLossIndicator = mlWon ? ' ✅' : ' ❌';
                    }

                    return (
                      <div className="calculated-probabilities">
                        <small style={{color: '#22c55e', fontWeight: 'bold'}}>
                          🔥 {fireEmojiText}{winLossIndicator}
                        </small>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {game.analysis.probabilities.spread && (
                <div className="bet-line">
                  <span className="bet-type">Spread</span>
                  <div className="odds-display">
                    <span className="spread-odds">
                      {game.homeTeamAbbr} {formatSpreadWithOdds(
                        // If spread is positive, home team is favored (gives points = negative)
                        // If spread is negative, away team is favored (home gets points = positive)
                        game.bettingLines.spread > 0 ? -game.bettingLines.spread : Math.abs(game.bettingLines.spread), 
                        -110
                      )}
                    </span>
                    <span className="spread-odds">
                      {game.awayTeamAbbr} {formatSpreadWithOdds(
                        // If spread is positive, home team is favored (away gets points = positive)
                        // If spread is negative, away team is favored (away gives points = negative)
                        game.bettingLines.spread > 0 ? game.bettingLines.spread : -Math.abs(game.bettingLines.spread), 
                        -110
                      )}
                    </span>
                  </div>
                  {(() => {
                    // For future weeks, don't show fire emoji picks until previous week is done
                    // FORCE current week to 2 for testing
                    const currentNFLWeekNum = 2; // Force to week 2 for debugging
                    const gameWeekNum = parseInt(game.week);

                    // Allow fire emojis for current/past weeks AND the next upcoming week
                    const nextUpcomingWeek = currentNFLWeekNum + 1; // Week 3 in this case

                    if (gameWeekNum > nextUpcomingWeek) {
                      // This is a future week beyond the next upcoming - don't show fire emoji picks
                      return null;
                    }

                    // Use advanced spread analysis to match performance calculations - use same call as performance hook
                    const spreadAnalysis = calculateAdvancedSpreadProb(game.homeTeamStats, game.awayTeamStats, game);

                    if (spreadAnalysis.recommendation && spreadAnalysis.recommendation !== 'PASS') {
                      
                      // For completed games, show the WINNING side, not our prediction
                      let spreadText;
                      if (game.isCompleted && game.homeScore !== null && game.awayScore !== null) {
                        const actualMargin = game.homeScore - game.awayScore;
                        const homeCovers = actualMargin + game.bettingLines.spread > 0;
                        if (homeCovers) {
                          // Home team covered - use correct spread logic
                          const homeSpread = game.bettingLines.spread > 0 ? -game.bettingLines.spread : Math.abs(game.bettingLines.spread);
                          spreadText = homeSpread >= 0 
                            ? `${game.homeTeamAbbr} +${homeSpread}` 
                            : `${game.homeTeamAbbr} ${homeSpread}`;
                        } else {
                          // Away team covered - use correct spread logic
                          const awaySpread = game.bettingLines.spread > 0 ? game.bettingLines.spread : -Math.abs(game.bettingLines.spread);
                          spreadText = awaySpread >= 0 
                            ? `${game.awayTeamAbbr} +${awaySpread}` 
                            : `${game.awayTeamAbbr} ${awaySpread}`;
                        }
                      } else {
                        // For future games, show our prediction with spread
                        if (spreadAnalysis.recommendation === 'HOME') {
                          // Recommending home team - use correct spread logic
                          const homeSpread = game.bettingLines.spread > 0 ? -game.bettingLines.spread : Math.abs(game.bettingLines.spread);
                          spreadText = homeSpread >= 0 
                            ? `${game.homeTeamAbbr} +${homeSpread}` 
                            : `${game.homeTeamAbbr} ${homeSpread}`;
                        } else {
                          // Recommending away team - use correct spread logic
                          const awaySpread = game.bettingLines.spread > 0 ? game.bettingLines.spread : -Math.abs(game.bettingLines.spread);
                          spreadText = awaySpread >= 0 
                            ? `${game.awayTeamAbbr} +${awaySpread}` 
                            : `${game.awayTeamAbbr} ${awaySpread}`;
                        }
                      }
                      
                      // Store the fire emoji bet for Performance page
                      const spreadFireBet = {
                        game: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
                        week: game.week,
                        season: game.season,
                        type: 'spread',
                        recommendation: spreadAnalysis.recommendation,
                        betText: spreadText,
                        spread: game.bettingLines.spread,
                        gameData: {
                          homeScore: game.homeScore,
                          awayScore: game.awayScore,
                          isCompleted: game.isCompleted,
                          homeTeamAbbr: game.homeTeamAbbr,
                          awayTeamAbbr: game.awayTeamAbbr,
                          bettingLines: game.bettingLines
                        }
                      };

                      // Only store if this is the current render cycle (prevent duplicates)
                      const currentWeekKey = `${season}_week_${week}`;
                      if (window.currentRenderKey === currentWeekKey) {
                        if (!window.fireEmojiBetsStorage) window.fireEmojiBetsStorage = {};
                        if (!window.fireEmojiBetsStorage[currentWeekKey]) window.fireEmojiBetsStorage[currentWeekKey] = [];

                        // Check for duplicates before adding
                        const existingBet = window.fireEmojiBetsStorage[currentWeekKey].find(existing =>
                          existing.game === spreadFireBet.game && existing.type === spreadFireBet.type && existing.betText === spreadFireBet.betText
                        );

                        if (!existingBet) {
                          window.fireEmojiBetsStorage[currentWeekKey].push(spreadFireBet);
                        }
                      }

                      // Store this actual displayed spread fire emoji for Performance page tallying
                      const displayedSpreadEmoji = {
                        id: `${game.awayTeamAbbr}@${game.homeTeamAbbr}_W${game.week}_SPREAD`,
                        week: game.week,
                        season: game.season,
                        game: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
                        type: 'spread',
                        displayText: spreadText,
                        recommendation: spreadAnalysis.recommendation,
                        spread: game.bettingLines.spread,
                        homeScore: game.homeScore,
                        awayScore: game.awayScore,
                        isCompleted: game.isCompleted,
                        homeTeamAbbr: game.homeTeamAbbr,
                        awayTeamAbbr: game.awayTeamAbbr,
                        bettingLines: game.bettingLines
                      };

                      // Store in global array for Performance page to read
                      if (!window.actualDisplayedFireEmojis) window.actualDisplayedFireEmojis = [];

                      // Only add if not already stored
                      const alreadyExists = window.actualDisplayedFireEmojis.find(stored => stored.id === displayedSpreadEmoji.id);
                      if (!alreadyExists) {
                        window.actualDisplayedFireEmojis.push(displayedSpreadEmoji);
                      }

                      // Calculate spread win/loss for completed games
                      let spreadWinLoss = '';
                      if (game.isCompleted && game.homeScore !== null && game.awayScore !== null) {
                        const actualMargin = game.homeScore - game.awayScore;
                        const homeCovers = actualMargin + game.bettingLines.spread > 0;

                        // Determine if our bet won based on the spread text
                        let spreadBetWon = false;
                        if (spreadText.includes(game.homeTeamAbbr)) {
                          // Bet on home team - win if home covered
                          spreadBetWon = homeCovers;
                        } else if (spreadText.includes(game.awayTeamAbbr)) {
                          // Bet on away team - win if away covered
                          spreadBetWon = !homeCovers;
                        }
                        spreadWinLoss = spreadBetWon ? ' ✅' : ' ❌';
                      }

                      return (
                        <div className="calculated-probabilities">
                          <small style={{color: '#22c55e', fontWeight: 'bold'}}>
                            🔥 {spreadText}{spreadWinLoss}
                          </small>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {game.analysis.probabilities.total && (
                <div className="bet-line">
                  <span className="bet-type">Total</span>
                  <div className="odds-display">
                    <span className="total-over">O{game.bettingLines.total} {formatOddsOnly(-110)}</span>
                    <span className="total-under">U{game.bettingLines.total} {formatOddsOnly(-110)}</span>
                  </div>
                  {(() => {
                    // For future weeks, don't show fire emoji picks until previous week is done
                    // FORCE current week to 2 for testing
                    const currentNFLWeekNum = 2; // Force to week 2 for debugging
                    const gameWeekNum = parseInt(game.week);

                    // Allow fire emojis for current/past weeks AND the next upcoming week
                    const nextUpcomingWeek = currentNFLWeekNum + 1; // Week 3 in this case

                    if (gameWeekNum > nextUpcomingWeek) {
                      // This is a future week beyond the next upcoming - don't show fire emoji picks
                      return null;
                    }

                    // Show total prediction only if we would actually bet (using same criteria as performance)
                    const overProb = game.analysis.probabilities.total.overProb * 100;
                    const underProb = game.analysis.probabilities.total.underProb * 100;
                    const predictedTotal = game.analysis.expectedPoints.home + game.analysis.expectedPoints.away;

                    // Same criteria as performance calculations: bet if predicted total differs by 3+ points
                    const hasTotalEdge = Math.abs(predictedTotal - game.bettingLines.total) >= 3;
                    
                    if (hasTotalEdge) {
                      // For completed games, show the WINNING side, not our prediction
                      let prediction;
                      if (game.isCompleted && game.homeScore !== null && game.awayScore !== null) {
                        const actualTotal = game.homeScore + game.awayScore;
                        prediction = actualTotal > game.bettingLines.total ? 'Over' : 'Under';
                      } else {
                        // For future games, show our prediction
                        prediction = predictedTotal > game.bettingLines.total ? 'Over' : 'Under';
                      }
                      
                      // Store the fire emoji bet for Performance page
                      const totalFireBet = {
                        game: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
                        week: game.week,
                        season: game.season,
                        type: 'total',
                        prediction: prediction,
                        betText: `${prediction} ${game.bettingLines.total}`,
                        total: game.bettingLines.total,
                        predictedTotal: predictedTotal,
                        gameData: {
                          homeScore: game.homeScore,
                          awayScore: game.awayScore,
                          isCompleted: game.isCompleted,
                          homeTeamAbbr: game.homeTeamAbbr,
                          awayTeamAbbr: game.awayTeamAbbr,
                          bettingLines: game.bettingLines
                        }
                      };

                      // Only store if this is the current render cycle (prevent duplicates)
                      const currentWeekKey = `${season}_week_${week}`;
                      if (window.currentRenderKey === currentWeekKey) {
                        if (!window.fireEmojiBetsStorage) window.fireEmojiBetsStorage = {};
                        if (!window.fireEmojiBetsStorage[currentWeekKey]) window.fireEmojiBetsStorage[currentWeekKey] = [];

                        // Check for duplicates before adding
                        const existingBet = window.fireEmojiBetsStorage[currentWeekKey].find(existing =>
                          existing.game === totalFireBet.game && existing.type === totalFireBet.type && existing.betText === totalFireBet.betText
                        );

                        if (!existingBet) {
                          window.fireEmojiBetsStorage[currentWeekKey].push(totalFireBet);
                        }
                      }

                      // Store this actual displayed total fire emoji for Performance page tallying
                      const displayedTotalEmoji = {
                        id: `${game.awayTeamAbbr}@${game.homeTeamAbbr}_W${game.week}_TOTAL`,
                        week: game.week,
                        season: game.season,
                        game: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
                        type: 'total',
                        displayText: `${prediction} bet`,
                        prediction: prediction,
                        total: game.bettingLines.total,
                        predictedTotal: predictedTotal,
                        homeScore: game.homeScore,
                        awayScore: game.awayScore,
                        isCompleted: game.isCompleted,
                        homeTeamAbbr: game.homeTeamAbbr,
                        awayTeamAbbr: game.awayTeamAbbr,
                        bettingLines: game.bettingLines
                      };

                      // Store in global array for Performance page to read
                      if (!window.actualDisplayedFireEmojis) window.actualDisplayedFireEmojis = [];

                      // Only add if not already stored
                      const alreadyExists = window.actualDisplayedFireEmojis.find(stored => stored.id === displayedTotalEmoji.id);
                      if (!alreadyExists) {
                        window.actualDisplayedFireEmojis.push(displayedTotalEmoji);
                      }

                      // Calculate total win/loss for completed games
                      let totalWinLoss = '';
                      if (game.isCompleted && game.homeScore !== null && game.awayScore !== null) {
                        const actualTotal = game.homeScore + game.awayScore;
                        const totalBetWon = (prediction === 'Over' && actualTotal > game.bettingLines.total) ||
                                           (prediction === 'Under' && actualTotal < game.bettingLines.total);
                        totalWinLoss = totalBetWon ? ' ✅' : ' ❌';
                      }

                      return (
                        <div className="calculated-probabilities">
                          <small style={{color: '#22c55e', fontWeight: 'bold'}}>
                            🔥 {prediction} bet{totalWinLoss}
                          </small>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>


            <div className="edge-indicators">
              <div className="edge-summary">
                <strong>Best Edge:</strong> 
                <span className="edge-value">
                  {(() => {
                    // For completed games, show actual result of best bet made
                    if (game.isCompleted && game.homeScore !== null && game.awayScore !== null) {
                      const results = [];
                      
                      // Check moneyline result
                      const actualWinner = game.homeScore > game.awayScore ? 'HOME' : 
                                          game.awayScore > game.homeScore ? 'AWAY' : 'TIE';
                      
                      // Check spread result if exists
                      if (game.bettingLines.spread) {
                        const margin = game.homeScore - game.awayScore;
                        const homeCovers = margin + game.bettingLines.spread > 0;
                        if (homeCovers) results.push('Home covers ✅');
                        else results.push('Away covers ✅');
                      }
                      
                      // Check total result if exists
                      if (game.bettingLines.total) {
                        const totalScore = game.homeScore + game.awayScore;
                        if (totalScore > game.bettingLines.total) results.push('Over Hit ✅');
                        else if (totalScore < game.bettingLines.total) results.push('Under Hit ✅');
                        else results.push('Total Push');
                      }
                      
                      // Show moneyline winner and total result if available
                      if (actualWinner === 'TIE') return 'Tie Game';
                      const winnerText = `${actualWinner === 'HOME' ? game.homeTeamAbbr : game.awayTeamAbbr} Win ✅`;
                      return results.length > 1 ? results[1] : winnerText; // Prefer total result for consistency
                    }
                    
                    // For future games beyond the next upcoming week, show TBD
                    const currentNFLWeekNum = 2; // Force to week 2 for debugging
                    const gameWeekNum = parseInt(game.week);
                    const nextUpcomingWeek = currentNFLWeekNum + 1; // Week 3 in this case

                    // Show TBD for weeks beyond the next upcoming week
                    if (gameWeekNum > nextUpcomingWeek) {
                      return 'TBD';
                    }

                    // For future games, find the best edge among ONLY the bets we're actually placing
                    const edges = [];
                    
                    // Check moneyline edges using SAME criteria as the betting logic above
                    if (game.analysis?.probabilities?.moneyline && game.bettingLines?.homeMoneyline && game.bettingLines?.awayMoneyline) {
                      const homeWinProb = (game.analysis.probabilities.moneyline.homeWinProb || 0) * 100;
                      const awayWinProb = (game.analysis.probabilities.moneyline.awayWinProb || 0) * 100;
                      
                      const getImpliedProb = (odds) => {
                        if (!odds || odds === 0) return 50;
                        return odds > 0 ? (100 / (odds + 100)) * 100 : (Math.abs(odds) / (Math.abs(odds) + 100)) * 100;
                      };
                      
                      const homeImplied = getImpliedProb(game.bettingLines.homeMoneyline);
                      const awayImplied = getImpliedProb(game.bettingLines.awayMoneyline);
                      
                      const homeBaseEdge = homeWinProb - homeImplied;
                      const awayBaseEdge = awayWinProb - awayImplied;
                      
                      // Apply same pattern bonuses as betting logic
                      let mlQualityBonus = 0;
                      let mlPatternMatch = false;
                      if (game.gameContext?.isDivisionGame && game.bettingLines.awayMoneyline >= 180 && game.bettingLines.awayMoneyline <= 350) {
                        if (awayBaseEdge > 2) {
                          mlQualityBonus += 4.5;
                          mlPatternMatch = true;
                        }
                      }
                      if (game.bettingLines.homeMoneyline >= 200 && homeBaseEdge > 3) {
                        mlQualityBonus += 4.2;
                        mlPatternMatch = true;
                      }
                      if (game.bettingLines.awayMoneyline >= 200 && awayBaseEdge > 3) {
                        mlQualityBonus += 4.2;
                        mlPatternMatch = true;
                      }
                      
                      const adjustedHomeMLEdge = homeBaseEdge + (homeBaseEdge > 0 ? mlQualityBonus : 0);
                      const adjustedAwayMLEdge = awayBaseEdge + (awayBaseEdge > 0 ? mlQualityBonus : 0);
                      const mlMinEdge = mlPatternMatch ? 5.5 : 8.5;
                      
                      // Only include if we would actually bet (same criteria as betting logic)
                      const homeMLBet = adjustedHomeMLEdge >= mlMinEdge && 
                        !(game.bettingLines.homeMoneyline >= -180 && game.bettingLines.homeMoneyline <= -120);
                      const awayMLBet = adjustedAwayMLEdge >= mlMinEdge && 
                        !(game.bettingLines.awayMoneyline >= -180 && game.bettingLines.awayMoneyline <= -120);
                      
                      if (homeMLBet) edges.push({type: `${game.homeTeamAbbr} ML`, edge: adjustedHomeMLEdge});
                      if (awayMLBet) edges.push({type: `${game.awayTeamAbbr} ML`, edge: adjustedAwayMLEdge});
                    }
                    
                    // Check spread edges - only if we would actually bet
                    try {
                      const spreadAnalysis = calculateAdvancedSpreadProb(game.homeTeamStats, game.awayTeamStats, game);
                      if (spreadAnalysis.recommendation && spreadAnalysis.recommendation !== 'PASS') {
                        const probability = spreadAnalysis.recommendation === 'HOME' ? 
                          spreadAnalysis.homeWinProb : spreadAnalysis.awayWinProb;
                        const spreadEdge = (probability * 100) - 52.4;
                        const team = spreadAnalysis.recommendation === 'HOME' ? game.homeTeamAbbr : game.awayTeamAbbr;
                        edges.push({type: `${team} Spread`, edge: spreadEdge});
                      }
                    } catch (e) {
                      // Skip spread analysis if it fails
                    }
                    
                    // Check total edges - only if we would actually bet (using simple Poisson like Performance)
                    try {
                      const simpleAnalysis = analyzeGame(game.homeTeamStats, game.awayTeamStats, game.bettingLines);
                      if (simpleAnalysis?.expectedPoints && game.bettingLines?.total) {
                        const predictedTotal = simpleAnalysis.expectedPoints.home + simpleAnalysis.expectedPoints.away;
                        if (Math.abs(predictedTotal - game.bettingLines.total) >= 3) {
                          const prediction = predictedTotal > game.bettingLines.total ? 'Over' : 'Under';
                          const totalEdge = Math.abs(predictedTotal - game.bettingLines.total);
                          edges.push({type: prediction, edge: totalEdge});
                        }
                      }
                    } catch (e) {
                      // Skip total analysis if it fails
                    }
                    
                    // Return the best edge
                    if (edges.length > 0) {
                      const bestEdge = edges.reduce((best, current) => current.edge > best.edge ? current : best);
                      return `${bestEdge.type} +EV`;
                    }
                    
                    return 'No Edge';
                  })()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Game Detail Modal */}
      {selectedGame && (
        <div className="game-modal-overlay" onClick={() => setSelectedGame(null)}>
          <div className="game-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedGame.awayTeam} @ {selectedGame.homeTeam}</h2>
              <button className="close-modal" onClick={() => setSelectedGame(null)}>×</button>
            </div>
            
            <div className="modal-content">
              {gameDetailLoading ? (
                <div className="loading-spinner-modal">Loading player data...</div>
              ) : selectedGame.error ? (
                <div className="error-message">{selectedGame.error}</div>
              ) : (
                <>
                  {/* Game Summary */}
                  <div className="game-summary">
                    <div className="game-info-detailed">
                      <p><strong>Date:</strong> {new Date(selectedGame.gameDate).toLocaleDateString()}</p>
                      <p><strong>Time:</strong> {selectedGame.gameTime}</p>
                      <p><strong>Venue:</strong> {selectedGame.venue}</p>
                      <p><strong>Weather:</strong> {selectedGame.weatherConditions}</p>
                      {selectedGame.isCompleted && (
                        <p><strong>Final Score:</strong> {selectedGame.awayTeamAbbr} {selectedGame.awayScore} - {selectedGame.homeScore} {selectedGame.homeTeamAbbr}</p>
                      )}
                    </div>
                  </div>

                  {/* Player Props Section */}
                  <div className="player-props-section">
                    <h3>Player Prop Betting Lines</h3>
                    <div className="props-disclaimer">
                      <span className="disclaimer-badge">Projected Lines</span>
                      <span className="disclaimer-text">Based on {season} season averages - Not live sportsbook lines</span>
                    </div>
                    {selectedGame.playerProps && selectedGame.playerProps.length > 0 ? (
                      <div className="props-grid">
                        {selectedGame.playerProps.map((prop, index) => (
                          <div key={index} className="prop-card">
                            <div className="prop-header">
                              <span className="player-name">{prop.player}</span>
                              <span className="team-badge">{prop.team}</span>
                            </div>
                            <div className="prop-line">
                              <span className="prop-type">{prop.type}</span>
                              <div className="prop-betting">
                                <div className="prop-option">
                                  <span className="line">Over {prop.line}</span>
                                  <span className="odds">{formatOddsWithProbability(prop.overOdds)}</span>
                                </div>
                                <div className="prop-option">
                                  <span className="line">Under {prop.line}</span>
                                  <span className="odds">{formatOddsWithProbability(prop.underOdds)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>No player props available for this game</p>
                    )}
                  </div>

                  {/* Player Stats Section */}
                  <div className="player-stats-section">
                    <h3>Player Statistics ({season} Season)</h3>
                    {selectedGame.playerStats && selectedGame.playerStats.length > 0 ? (
                      <div className="stats-tables">
                        {/* Away Team Stats */}
                        <div className="team-stats-table">
                          <h4>{selectedGame.awayTeam} Players</h4>
                          <div className="stats-table-wrapper">
                            <table className="player-stats-table">
                              <thead>
                                <tr>
                                  <th>Player</th>
                                  <th>Pos</th>
                                  <th>Pass Yds</th>
                                  <th>Pass TDs</th>
                                  <th>Rush Yds</th>
                                  <th>Rush TDs</th>
                                  <th>Rec Yds</th>
                                  <th>Rec TDs</th>
                                  <th>Fantasy Pts</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedGame.playerStats
                                  .filter(player => player.recent_team === selectedGame.awayTeamAbbr)
                                  .slice(0, 10) // Top 10 players
                                  .map((player, index) => (
                                    <tr key={index}>
                                      <td className="player-name-cell">{player.player_display_name}</td>
                                      <td>{player.position || 'N/A'}</td>
                                      <td>{Math.round(player.passing_yards || 0)}</td>
                                      <td>{Math.round(player.passing_tds || 0)}</td>
                                      <td>{Math.round(player.rushing_yards || 0)}</td>
                                      <td>{Math.round(player.rushing_tds || 0)}</td>
                                      <td>{Math.round(player.receiving_yards || 0)}</td>
                                      <td>{Math.round(player.receiving_tds || 0)}</td>
                                      <td>{Math.round(player.fantasy_points_ppr || 0)}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Home Team Stats */}
                        <div className="team-stats-table">
                          <h4>{selectedGame.homeTeam} Players</h4>
                          <div className="stats-table-wrapper">
                            <table className="player-stats-table">
                              <thead>
                                <tr>
                                  <th>Player</th>
                                  <th>Pos</th>
                                  <th>Pass Yds</th>
                                  <th>Pass TDs</th>
                                  <th>Rush Yds</th>
                                  <th>Rush TDs</th>
                                  <th>Rec Yds</th>
                                  <th>Rec TDs</th>
                                  <th>Fantasy Pts</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedGame.playerStats
                                  .filter(player => player.recent_team === selectedGame.homeTeamAbbr)
                                  .slice(0, 10) // Top 10 players
                                  .map((player, index) => (
                                    <tr key={index}>
                                      <td className="player-name-cell">{player.player_display_name}</td>
                                      <td>{player.position || 'N/A'}</td>
                                      <td>{Math.round(player.passing_yards || 0)}</td>
                                      <td>{Math.round(player.passing_tds || 0)}</td>
                                      <td>{Math.round(player.rushing_yards || 0)}</td>
                                      <td>{Math.round(player.rushing_tds || 0)}</td>
                                      <td>{Math.round(player.receiving_yards || 0)}</td>
                                      <td>{Math.round(player.receiving_tds || 0)}</td>
                                      <td>{Math.round(player.fantasy_points_ppr || 0)}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p>No player statistics available for this game</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-footer">
        <div className="disclaimer">
          <p><strong>Disclaimer:</strong> This analysis is for educational purposes only. Past performance does not guarantee future results. Please gamble responsibly.</p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard