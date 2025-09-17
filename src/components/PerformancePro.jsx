import { useState, useEffect } from 'react'
import { analyzeCompletedFireBets } from '../utils/fireEmojiBetDetector'
import nflDataPyService from '../services/nflDataPyService'
import { getTeamStats2025 } from '../data/team-stats-2025'
import { analyzeGame } from '../utils/poissonModel'
import { comprehensiveGameAnalysis } from '../utils/enhancedBettingModel'
import { config } from '../config/environment'

function PerformancePro() {
  const [loading, setLoading] = useState(true)
  const [performanceData, setPerformanceData] = useState(null)
  const [selectedSeason, setSelectedSeason] = useState(config.defaultSeason)
  const [timeframe, setTimeframe] = useState('all') // all, recent, month

  useEffect(() => {
    loadPerformanceData()
  }, [selectedSeason, timeframe])

  const loadPerformanceData = async () => {
    setLoading(true)
    try {
      const completedGames = await getCompletedGamesForAnalysis()
      const analysis = analyzeCompletedFireBets(completedGames)

      // Calculate additional professional metrics
      const enhancedAnalysis = {
        ...analysis,
        roi: analysis.totalBets > 0 ? ((analysis.totalUnits / analysis.totalBets) * 100) : 0,
        winRate: analysis.totalBets > 0 ? ((analysis.wins / analysis.totalBets) * 100) : 0,
        avgBetSize: 1, // Standard unit size
        totalGames: completedGames.length,
        sharpeRatio: calculateSharpeRatio(analysis.detailedResults),
        maxDrawdown: calculateMaxDrawdown(analysis.detailedResults),
        profitFactor: calculateProfitFactor(analysis.detailedResults),
        streaks: calculateStreaks(analysis.detailedResults)
      }

      setPerformanceData(enhancedAnalysis)
    } catch (error) {
      console.error('Error loading performance data:', error)
    }
    setLoading(false)
  }

  const getCompletedGamesForAnalysis = async () => {
    const completedGames = []

    try {
      const season = parseInt(selectedSeason)
      let weeksToAnalyze = []

      if (season === 2024) {
        weeksToAnalyze = timeframe === 'recent' ? [17, 18] : [15, 16, 17, 18]
      } else {
        const allWeeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
        weeksToAnalyze = timeframe === 'recent' ? allWeeks.slice(-4) : allWeeks
      }

      for (const week of weeksToAnalyze) {
        try {
          const weekGames = await nflDataPyService.getWeekSchedule(season, week, 'REG')
          const transformedGames = nflDataPyService.transformScheduleToGameFormat(weekGames)

          const completed = transformedGames.filter(game => game.isCompleted)
          const processedGames = completed.map(game => {
            const homeStats = getTeamStats2025(game.homeTeamAbbr) || getDefaultStats()
            const awayStats = getTeamStats2025(game.awayTeamAbbr) || getDefaultStats()

            const gameContext = {
              isDivisionGame: homeStats.division === awayStats.division,
              weather: { temperature: 70, windSpeed: 5, precipitation: false },
              isRevenge: false,
              isPrimeTime: false,
              homeRecentForm: [],
              awayRecentForm: [],
              homeInjuries: [],
              awayInjuries: []
            }

            const enhancedGame = {
              ...game,
              bettingLines: {
                spread: game.bettingLines?.spread || game.bettingLines?.homeSpread,
                total: game.bettingLines?.total || game.bettingLines?.overUnder,
                homeMoneyline: game.bettingLines?.homeMoneyline,
                awayMoneyline: game.bettingLines?.awayMoneyline
              },
              homeTeamStats: homeStats,
              awayTeamStats: awayStats,
              gameContext: gameContext
            }

            const basicAnalysis = analyzeGame(homeStats, awayStats, enhancedGame.bettingLines)
            const comprehensiveAnalysis = comprehensiveGameAnalysis(homeStats, awayStats, enhancedGame.bettingLines, gameContext)

            enhancedGame.analysis = {
              ...comprehensiveAnalysis,
              probabilities: basicAnalysis.probabilities || {},
              expectedPoints: basicAnalysis.expectedPoints || comprehensiveAnalysis.expectedPoints
            }

            return enhancedGame
          })

          completedGames.push(...processedGames)
        } catch (error) {
          console.log(`Week ${week} data not available:`, error.message)
        }
      }
    } catch (error) {
      console.error('Error fetching completed games:', error)
    }

    return completedGames
  }

  const getDefaultStats = () => ({
    pointsPerGame: 21,
    pointsAllowedPerGame: 21,
    yardsPerGame: 350,
    yardsAllowedPerGame: 350,
    offensiveRating: 1.0,
    defensiveRating: 1.0
  })

  const calculateSharpeRatio = (results) => {
    if (!results || results.length === 0) return 0
    const returns = results.map(r => r.units)
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    const stdDev = Math.sqrt(variance)
    return stdDev > 0 ? avgReturn / stdDev : 0
  }

  const calculateMaxDrawdown = (results) => {
    if (!results || results.length === 0) return 0
    let runningTotal = 0
    let maxTotal = 0
    let maxDrawdown = 0

    results.forEach(result => {
      runningTotal += result.units
      if (runningTotal > maxTotal) {
        maxTotal = runningTotal
      }
      const currentDrawdown = maxTotal - runningTotal
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown
      }
    })

    return maxDrawdown
  }

  const calculateProfitFactor = (results) => {
    if (!results || results.length === 0) return 0
    const winningBets = results.filter(r => r.units > 0)
    const losingBets = results.filter(r => r.units < 0)

    const totalWins = winningBets.reduce((sum, r) => sum + r.units, 0)
    const totalLosses = Math.abs(losingBets.reduce((sum, r) => sum + r.units, 0))

    return totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0
  }

  const calculateStreaks = (results) => {
    if (!results || results.length === 0) return { currentWin: 0, currentLoss: 0, longestWin: 0, longestLoss: 0 }

    let currentWin = 0, currentLoss = 0, longestWin = 0, longestLoss = 0
    let tempWin = 0, tempLoss = 0

    results.forEach(result => {
      if (result.won === true) {
        tempWin++
        tempLoss = 0
        currentWin = tempWin
        if (tempWin > longestWin) longestWin = tempWin
      } else if (result.won === false) {
        tempLoss++
        tempWin = 0
        currentLoss = tempLoss
        if (tempLoss > longestLoss) longestLoss = tempLoss
      }
    })

    return { currentWin, currentLoss, longestWin, longestLoss }
  }

  const formatCurrency = (value) => {
    return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2)
  }

  const formatPercentage = (value) => {
    return `${value.toFixed(1)}%`
  }

  return (
    <div className="performance-pro">
      {/* Header Section */}
      <div className="performance-header">
        <div className="header-content">
          <h1>Performance Analytics</h1>
          <p>Comprehensive analysis of betting model performance and key metrics</p>

          {/* Controls */}
          <div className="performance-controls">
            <div className="control-group">
              <label>Season</label>
              <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)}>
                {config.availableSeasons.map(season => (
                  <option key={season} value={season}>{season}</option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label>Timeframe</label>
              <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                <option value="all">All Available</option>
                <option value="recent">Recent Weeks</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="metrics-section">
        <div className="metrics-grid">
          <div className="metric-card primary">
            <div className="metric-header">
              <h3>Total Return</h3>
              <div className="metric-icon">💰</div>
            </div>
            <div className="metric-value">
              {loading ? '...' : formatCurrency(performanceData?.totalUnits || 0)}
            </div>
            <div className="metric-subtitle">Units</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <h3>Win Rate</h3>
              <div className="metric-icon">🎯</div>
            </div>
            <div className="metric-value">
              {loading ? '...' : formatPercentage(performanceData?.winRate || 0)}
            </div>
            <div className="metric-subtitle">
              {performanceData ? `${performanceData.wins}/${performanceData.totalBets}` : '0/0'}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <h3>ROI</h3>
              <div className="metric-icon">📈</div>
            </div>
            <div className="metric-value">
              {loading ? '...' : formatPercentage(performanceData?.roi || 0)}
            </div>
            <div className="metric-subtitle">Return on Investment</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <h3>Profit Factor</h3>
              <div className="metric-icon">⚖️</div>
            </div>
            <div className="metric-value">
              {loading ? '...' : (performanceData?.profitFactor || 0).toFixed(2)}
            </div>
            <div className="metric-subtitle">Win/Loss Ratio</div>
          </div>
        </div>
      </div>

      {/* Advanced Metrics */}
      <div className="advanced-section">
        <h2>Advanced Metrics</h2>
        <div className="advanced-grid">
          <div className="advanced-card">
            <h3>Risk Metrics</h3>
            <div className="advanced-stats">
              <div className="advanced-stat">
                <span className="stat-label">Max Drawdown</span>
                <span className="stat-value">{loading ? '...' : formatCurrency(performanceData?.maxDrawdown || 0)}</span>
              </div>
              <div className="advanced-stat">
                <span className="stat-label">Sharpe Ratio</span>
                <span className="stat-value">{loading ? '...' : (performanceData?.sharpeRatio || 0).toFixed(2)}</span>
              </div>
              <div className="advanced-stat">
                <span className="stat-label">Total Bets</span>
                <span className="stat-value">{performanceData?.totalBets || 0}</span>
              </div>
            </div>
          </div>

          <div className="advanced-card">
            <h3>Streak Analysis</h3>
            <div className="advanced-stats">
              <div className="advanced-stat">
                <span className="stat-label">Current Streak</span>
                <span className="stat-value">
                  {loading ? '...' :
                    performanceData?.streaks?.currentWin > 0 ? `${performanceData.streaks.currentWin}W` :
                    performanceData?.streaks?.currentLoss > 0 ? `${performanceData.streaks.currentLoss}L` : '-'
                  }
                </span>
              </div>
              <div className="advanced-stat">
                <span className="stat-label">Longest Win Streak</span>
                <span className="stat-value">{performanceData?.streaks?.longestWin || 0}</span>
              </div>
              <div className="advanced-stat">
                <span className="stat-label">Longest Loss Streak</span>
                <span className="stat-value">{performanceData?.streaks?.longestLoss || 0}</span>
              </div>
            </div>
          </div>

          <div className="advanced-card">
            <h3>Bet Type Breakdown</h3>
            <div className="bet-type-stats">
              <div className="bet-type">
                <span className="bet-label">Moneyline</span>
                <span className="bet-record">
                  {performanceData?.byType?.moneyline ?
                    `${performanceData.byType.moneyline.wins}-${performanceData.byType.moneyline.losses}` : '0-0'}
                </span>
                <span className="bet-units">
                  {performanceData?.byType?.moneyline ?
                    formatCurrency(performanceData.byType.moneyline.units) : '+0.00'}
                </span>
              </div>
              <div className="bet-type">
                <span className="bet-label">Spread</span>
                <span className="bet-record">
                  {performanceData?.byType?.spread ?
                    `${performanceData.byType.spread.wins}-${performanceData.byType.spread.losses}` : '0-0'}
                </span>
                <span className="bet-units">
                  {performanceData?.byType?.spread ?
                    formatCurrency(performanceData.byType.spread.units) : '+0.00'}
                </span>
              </div>
              <div className="bet-type">
                <span className="bet-label">Total</span>
                <span className="bet-record">
                  {performanceData?.byType?.total ?
                    `${performanceData.byType.total.wins}-${performanceData.byType.total.losses}` : '0-0'}
                </span>
                <span className="bet-units">
                  {performanceData?.byType?.total ?
                    formatCurrency(performanceData.byType.total.units) : '+0.00'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bets Table */}
      <div className="recent-bets-section">
        <div className="section-header">
          <h2>Recent Bets</h2>
          <div className="section-filters">
            <button className="filter-btn active">All</button>
            <button className="filter-btn">Wins</button>
            <button className="filter-btn">Losses</button>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading performance data...</p>
          </div>
        ) : performanceData?.detailedResults?.length > 0 ? (
          <div className="bets-table-container">
            <table className="bets-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Game</th>
                  <th>Bet</th>
                  <th>Type</th>
                  <th>Result</th>
                  <th>Units</th>
                </tr>
              </thead>
              <tbody>
                {performanceData.detailedResults
                  .slice(0, 20)
                  .map((bet, index) => (
                  <tr key={index} className={bet.won === true ? 'win-row' : bet.won === false ? 'loss-row' : ''}>
                    <td>Week {bet.week}</td>
                    <td>{bet.game}</td>
                    <td className="bet-text">{bet.bet}</td>
                    <td className="bet-type">{bet.type}</td>
                    <td className={`result ${bet.result?.toLowerCase()}`}>
                      {bet.result}
                    </td>
                    <td className={`units ${bet.units >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(bet.units)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-data-state">
            <div className="no-data-icon">📊</div>
            <h3>No Performance Data</h3>
            <p>No betting data available for the selected timeframe. Check back after some games are completed.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default PerformancePro