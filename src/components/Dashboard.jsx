import { useState, useEffect } from 'react'
import { analyzeGame } from '../utils/poissonModel'
import { comprehensiveGameAnalysis } from '../utils/enhancedBettingModel'
import { calculateAdvancedSpreadProb } from '../utils/advancedSpreadModel'
import { getCurrentNFLInfo } from '../data/getCurrentNFLInfo'
import { getTeamStats2025 } from '../data/team-stats-2025'
import { formatOddsWithProbability, formatSpreadWithOdds, formatTotalWithOdds, formatMoneyline, formatOddsOnly } from '../utils/oddsFormatting'
import nflDataPyService from '../services/nflDataPyService'
import { getWeek1ESPNData } from '../data/week1-2025-espn-data'

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

  // Note: Removed transformAPIGameData function - no longer needed since nfl-data-py handles all data transformation

  // Load real NFL data
  useEffect(() => {
    const loadRealData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        console.log(`🎯 Dashboard loading real data for ${season} week ${week}`)
        
        let weekGames = []
        
        // Special case: Use ESPN data for Week 1 2025
        if (parseInt(season) === 2025 && week === 1) {
          console.log(`📰 Loading Week 1 2025 data from ESPN betting lines...`)
          weekGames = getWeek1ESPNData()
          console.log(`✅ Loaded ${weekGames.length} games from ESPN data for ${season} week ${week}`)
        }
        // Use nfl-data-py Python backend for 2024+ data, static files for older seasons
        else if (parseInt(season) >= 2024) {
          console.log(`📡 Loading ${season} data from nfl-data-py backend...`)
          
          try {
            // Check if Python backend is available
            await nflDataPyService.checkHealth()
            
            // Fetch week data from nfl-data-py backend
            const scheduleData = await nflDataPyService.getWeekSchedule(parseInt(season), week, 'REG')
            weekGames = nflDataPyService.transformScheduleToGameFormat(scheduleData)
            console.log(`✅ Loaded ${weekGames.length} games from nfl-data-py backend for ${season} week ${week}`)
            
          } catch (error) {
            console.warn(`⚠️ nfl-data-py backend unavailable: ${error.message}`)
            console.log('📁 No fallback available for current season data')
            weekGames = []
          }
        } else {
          console.log('📁 Loading historical data from static files...')
          // For historical data, try Python backend first, then fallback
          try {
            const scheduleData = await nflDataPyService.getWeekSchedule(parseInt(season), week, 'REG')
            weekGames = nflDataPyService.transformScheduleToGameFormat(scheduleData)
          } catch (error) {
            console.warn('Failed to get historical data from Python backend:', error)
            weekGames = []
          }
        }
        console.log(`📊 Dashboard received ${weekGames ? weekGames.length : 0} games from getRealGamesBySeasonAndWeek`)
        console.log('Games received:', weekGames)
        
        if (weekGames.length === 0) {
          console.log(`❌ Dashboard: No games found, setting empty state`)
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
            referee: game.network, // Referee (using network field)
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
      console.log(`Fetching player data for ${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`)
      
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
        
        <div className="week-selector-dashboard">
          <div className="week-display">
            <span className="week-label">Week {week}</span>
            {isCurrentWeek && <span className="current-week-badge">CURRENT WEEK</span>}
          </div>
          
          <div className="week-controls">
            <button
              className={selectedWeek === 'current' ? 'week-btn active' : 'week-btn'}
              onClick={() => onWeekChange('current')}
            >
              Current Week
            </button>
            <select 
              value={selectedWeek === 'current' ? currentNFLWeek : selectedWeek}
              onChange={(e) => onWeekChange(e.target.value)}
              className="week-dropdown"
            >
              {Array.from({length: 18}, (_, i) => i + 1).map(weekNum => (
                <option key={weekNum} value={weekNum}>
                  Week {weekNum}
                </option>
              ))}
            </select>
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
        
        {!loading && !error && analysis.length > 0 && (
          <div className="data-source-indicator">
            <p>📊 Data source: {analysis[0]?.detailedOdds?.source || 'Unknown'} | Last updated: {new Date(analysis[0]?.detailedOdds?.lastUpdate || Date.now()).toLocaleTimeString()}</p>
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
                  // Show model predictions only if we would actually bet (using same criteria as performance calculations)
                  const homeWinProb = game.analysis.probabilities.moneyline.homeWinProb * 100;
                  const awayWinProb = game.analysis.probabilities.moneyline.awayWinProb * 100;
                  const homeImplied = Math.abs(game.bettingLines.homeMoneyline) / (Math.abs(game.bettingLines.homeMoneyline) + 100) * 100;
                  const awayImplied = Math.abs(game.bettingLines.awayMoneyline) / (Math.abs(game.bettingLines.awayMoneyline) + 100) * 100;
                  
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
                    return (
                      <div className="calculated-probabilities">
                        <small>Model Prediction: {game.homeTeamAbbr} {homeWinProb.toFixed(1)}% | {game.awayTeamAbbr} {awayWinProb.toFixed(1)}%</small>
                        <small style={{color: '#22c55e', fontWeight: 'bold'}}>
                          🔥 {homeMLBet ? `${game.homeTeamAbbr} +${adjustedHomeMLEdge.toFixed(1)}% edge` : 
                              awayMLBet ? `${game.awayTeamAbbr} +${adjustedAwayMLEdge.toFixed(1)}% edge` : ''}
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
                      {game.bettingLines.spread > 0 
                        ? `${game.homeTeamAbbr} ${formatSpreadWithOdds(-game.bettingLines.spread, -110)}`
                        : `${game.awayTeamAbbr} ${formatSpreadWithOdds(game.bettingLines.spread, -110)}`
                      }
                    </span>
                  </div>
                  {(() => {
                    // Use advanced spread analysis to match performance calculations
                    const spreadAnalysis = calculateAdvancedSpreadProb(game.homeTeamStats, game.awayTeamStats, game);
                    
                    if (spreadAnalysis.recommendation && spreadAnalysis.recommendation !== 'PASS') {
                      const recommendedTeam = spreadAnalysis.recommendation === 'HOME' ? game.homeTeamAbbr : game.awayTeamAbbr;
                      const probability = spreadAnalysis.recommendation === 'HOME' ? 
                        spreadAnalysis.homeWinProb : spreadAnalysis.awayWinProb;
                      
                      return (
                        <div className="calculated-probabilities">
                          <small>Model Prediction: {recommendedTeam} {(probability * 100).toFixed(1)}% to cover</small>
                          <small style={{color: '#22c55e', fontWeight: 'bold'}}>
                            🔥 {recommendedTeam} spread bet
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
                    // Show total prediction only if we would actually bet (using same criteria as performance)
                    const overProb = game.analysis.probabilities.total.overProb * 100;
                    const underProb = game.analysis.probabilities.total.underProb * 100;
                    const predictedTotal = game.analysis.expectedPoints.home + game.analysis.expectedPoints.away;
                    
                    // Same criteria as performance calculations: bet if predicted total differs by 3+ points
                    const hasTotalEdge = Math.abs(predictedTotal - game.bettingLines.total) >= 3;
                    
                    if (hasTotalEdge) {
                      return (
                        <div className="calculated-probabilities">
                          <small>Model Prediction: Over {overProb.toFixed(1)}% | Under {underProb.toFixed(1)}%</small>
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
                    // For completed games, show actual result
                    if (game.isCompleted && game.homeScore !== null && game.awayScore !== null && game.bettingLines.total) {
                      const totalScore = game.homeScore + game.awayScore;
                      const overUnderLine = game.bettingLines.total;
                      if (totalScore > overUnderLine) {
                        return 'Over Hit ✅';
                      } else if (totalScore < overUnderLine) {
                        return 'Under Hit ✅';
                      } else {
                        return 'Push';
                      }
                    }
                    
                    // For future games, show analysis
                    if (game.analysis.probabilities.total) {
                      if (game.analysis.probabilities.total.overProb > 0.55) {
                        return 'Over +EV';
                      } else if (game.analysis.probabilities.total.underProb > 0.55) {
                        return 'Under +EV';
                      } else {
                        return 'No Edge';
                      }
                    }
                    
                    return 'Analyzing...';
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