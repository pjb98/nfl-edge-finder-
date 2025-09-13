import { useState, useEffect } from 'react'
import { analyzeGame } from '../utils/poissonModel'
import { comprehensiveGameAnalysis, calculateSmartEdges } from '../utils/enhancedBettingModel'
import { calculateAdvancedSpreadProb } from '../utils/advancedSpreadModel'
import { getTeamStats2025 } from '../data/team-stats-2025'
import nflDataPyService from '../services/nflDataPyService'
import { config } from '../config/environment'

function Performance() {
  const [performanceData, setPerformanceData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bestEdges, setBestEdges] = useState([])
  const [weeklyResults, setWeeklyResults] = useState({})
  const [selectedWeekView, setSelectedWeekView] = useState('all')
  const [selectedSeason, setSelectedSeason] = useState(config.defaultSeason)
  
  useEffect(() => {
    loadPerformanceData()
  }, [selectedSeason])
  
  const loadPerformanceData = async () => {
    setLoading(true)
    try {
      // Load completed games from multiple weeks to validate model performance
      const completedGames = await getCompletedGamesForAnalysis()
      
      if (completedGames.length > 0) {
        const analysis = analyzeModelPerformance(completedGames)
        setPerformanceData(analysis)
        setBestEdges(analysis.bestEdgePicks)
        setWeeklyResults(analysis.weeklyBreakdown)
      }
      
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
        // For 2024, use completed weeks
        weeksToAnalyze = [15, 16, 17, 18]
      } else {
        // For 2025, check all weeks for completed games
        weeksToAnalyze = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
      }
      
      for (const week of weeksToAnalyze) {
        try {
          const weekGames = await nflDataPyService.getWeekSchedule(season, week, 'REG')
          const transformedGames = nflDataPyService.transformScheduleToGameFormat(weekGames)
          
          // Filter for completed games only
          const completed = transformedGames.filter(game => game.isCompleted)
          completedGames.push(...completed)
        } catch (error) {
          console.log(`${season} Week ${week} data not available`)
        }
      }
      
    } catch (error) {
      console.error('Error fetching completed games:', error)
    }
    
    return completedGames
  }
  
  const analyzeModelPerformance = (completedGames) => {
    const results = {
      totalGames: completedGames.length,
      edgeWins: 0,
      edgeLosses: 0,
      totalUnits: 0,
      totalBets: 0,
      bestEdgePicks: [],
      winRateByBetType: {
        moneyline: { wins: 0, total: 0, units: 0 },
        spread: { wins: 0, total: 0, units: 0 },
        overunder: { wins: 0, total: 0, units: 0 }
      },
      weeklyBreakdown: {}
    }
    
    // console.log('Analyzing performance for', completedGames.length, 'completed games')
    
    completedGames.forEach(game => {
      try {
        // console.log('Processing game:', game.awayTeamAbbr, '@', game.homeTeamAbbr, 'Week', game.week)
        
        const weekKey = `Week ${game.week}`
        
        // Initialize weekly data if not exists
        if (!results.weeklyBreakdown[weekKey]) {
          results.weeklyBreakdown[weekKey] = {
            week: game.week,
            totalGames: 0,
            edgePicks: 0,
            edgeWins: 0,
            edgeLosses: 0,
            totalUnits: 0,
            bestEdge: 0,
            picks: []
          }
        }
        
        results.weeklyBreakdown[weekKey].totalGames++
        
        // Get team stats for the game
        const homeStats = getTeamStats2025(game.homeTeamId) || getDefaultStats()
        const awayStats = getTeamStats2025(game.awayTeamId) || getDefaultStats()
        
        // Enhanced game context for better analysis
        const gameContext = {
          isDivisionGame: homeStats.division === awayStats.division,
          weather: game.weatherConditions ? parseWeatherConditions(game.weatherConditions) : {},
          isPlayoffs: game.week > 18,
          isPrimeTime: game.gameTime && (game.gameTime.includes('8:') || game.gameTime.includes('Monday') || game.gameTime.includes('Thursday')),
          variance: 0.18, // Slightly higher variance for more realistic modeling
          homeRecentForm: [], // Would need recent game data
          awayRecentForm: [], // Would need recent game data
          homeInjuries: [],   // Would need injury data
          awayInjuries: []    // Would need injury data
        }

        // Run enhanced model analysis
        const analysis = comprehensiveGameAnalysis(homeStats, awayStats, game.bettingLines, gameContext)
        
        // Check moneyline predictions with smart edge detection
        const homeWinProb = analysis.probabilities.moneyline.homeWinProb * 100
        const awayWinProb = analysis.probabilities.moneyline.awayWinProb * 100
        const homeImplied = getImpliedProbability(game.bettingLines.homeMoneyline)
        const awayImplied = getImpliedProbability(game.bettingLines.awayMoneyline)
        
        const homeEdgeCalc = calculateSmartEdges(analysis.probabilities.moneyline.homeWinProb, homeImplied / 100, 'moneyline', 'medium')
        const awayEdgeCalc = calculateSmartEdges(analysis.probabilities.moneyline.awayWinProb, awayImplied / 100, 'moneyline', 'medium')
        
        // High-Profitability Moneyline Analysis - Focus on proven winning scenarios
        const homeImpliedProb = getImpliedProbability(game.bettingLines.homeMoneyline) / 100
        const awayImpliedProb = getImpliedProbability(game.bettingLines.awayMoneyline) / 100
        
        // Calculate base edges
        const homeBaseEdge = (homeWinProb / 100 - homeImpliedProb) * 100
        const awayBaseEdge = (awayWinProb / 100 - awayImpliedProb) * 100
        
        // Apply proven NFL moneyline patterns for higher profitability
        let mlQualityBonus = 0
        let mlPatternMatch = false
        let mlReasoning = []
        
        // PATTERN 1: Road Dogs in Division Games (+180 to +350 range)
        if (gameContext.isDivisionGame && 
            game.bettingLines.awayMoneyline >= 180 && game.bettingLines.awayMoneyline <= 350) {
          if (awayBaseEdge > 2) {
            mlQualityBonus += 4.5 // Division road dogs with value are excellent
            mlPatternMatch = true
            mlReasoning.push('Division road dog value')
          }
        }
        
        // PATTERN 2: Playoff Contenders as Underdogs (motivation edge)
        const homeWins = homeStats.wins || 0
        const awayWins = awayStats.wins || 0
        const isLateInSeason = game.week >= 14
        
        if (isLateInSeason) {
          // Away team is playoff contender underdog
          if (awayWins >= 7 && game.bettingLines.awayMoneyline > 150) {
            if (awayBaseEdge > 1) {
              mlQualityBonus += 3.8 // Playoff teams as dogs are motivated
              mlPatternMatch = true
              mlReasoning.push('Playoff contender as underdog')
            }
          }
          // Home team is playoff contender underdog  
          if (homeWins >= 7 && game.bettingLines.homeMoneyline > 150) {
            if (homeBaseEdge > 1) {
              mlQualityBonus += 3.8
              mlPatternMatch = true
              mlReasoning.push('Playoff contender as underdog')
            }
          }
        }
        
        // PATTERN 3: Revenge Game Underdogs
        if (gameContext.isRevenge) {
          // Home underdog in revenge spot
          if (game.bettingLines.homeMoneyline > 120 && homeBaseEdge > 0) {
            mlQualityBonus += 3.2
            mlPatternMatch = true
            mlReasoning.push('Revenge game underdog')
          }
          // Away underdog in revenge spot
          if (game.bettingLines.awayMoneyline > 120 && awayBaseEdge > 0) {
            mlQualityBonus += 3.2
            mlPatternMatch = true
            mlReasoning.push('Revenge game underdog')
          }
        }
        
        // PATTERN 4: Weather Game Underdogs (bad weather levels playing field)
        if (gameContext.weather && 
            (gameContext.weather.temperature < 32 || gameContext.weather.windSpeed > 20 || gameContext.weather.precipitation)) {
          // Home dog in weather
          if (game.bettingLines.homeMoneyline > 130 && homeBaseEdge > -1) {
            mlQualityBonus += 2.8
            mlPatternMatch = true
            mlReasoning.push('Weather game underdog')
          }
          // Away dog in weather
          if (game.bettingLines.awayMoneyline > 130 && awayBaseEdge > -1) {
            mlQualityBonus += 2.8
            mlPatternMatch = true
            mlReasoning.push('Weather game underdog')
          }
        }
        
        // PATTERN 5: Short Favorites (avoid betting on slight favorites -120 to -180)
        // These are often coin flips with bad payout
        const avoidShortFavorites = (
          (game.bettingLines.homeMoneyline >= -180 && game.bettingLines.homeMoneyline <= -120) ||
          (game.bettingLines.awayMoneyline >= -180 && game.bettingLines.awayMoneyline <= -120)
        )
        
        // PATTERN 6: Value Dogs (+200 or higher with model support)
        const bigDogThreshold = 200
        if (game.bettingLines.homeMoneyline >= bigDogThreshold && homeBaseEdge > 3) {
          mlQualityBonus += 4.2 // Big home dogs with model support
          mlPatternMatch = true
          mlReasoning.push('Value home dog')
        }
        if (game.bettingLines.awayMoneyline >= bigDogThreshold && awayBaseEdge > 3) {
          mlQualityBonus += 4.2 // Big away dogs with model support  
          mlPatternMatch = true
          mlReasoning.push('Value away dog')
        }
        
        // Apply quality bonus to edges
        const adjustedHomeMLEdge = homeBaseEdge + (homeBaseEdge > 0 ? mlQualityBonus : 0)
        const adjustedAwayMLEdge = awayBaseEdge + (awayBaseEdge > 0 ? mlQualityBonus : 0)
        
        // SELECTIVE CRITERIA: Only bet moneylines with high-confidence scenarios
        // Avoid short favorites entirely, focus on pattern matches or strong edges
        const mlMinEdge = mlPatternMatch ? 5.5 : 8.5 // Higher threshold than spread
        
        let mlPickFound = false
        let mlPrediction = null
        let mlBestEdge = 0
        let mlOdds = 0
        
        // Don't bet short favorites at all
        if (!avoidShortFavorites) {
          if (adjustedHomeMLEdge >= mlMinEdge && 
              !(game.bettingLines.homeMoneyline >= -180 && game.bettingLines.homeMoneyline <= -120)) {
            mlPickFound = true
            mlPrediction = 'home'
            mlBestEdge = adjustedHomeMLEdge
            mlOdds = game.bettingLines.homeMoneyline
          } else if (adjustedAwayMLEdge >= mlMinEdge && 
                     !(game.bettingLines.awayMoneyline >= -180 && game.bettingLines.awayMoneyline <= -120)) {
            mlPickFound = true
            mlPrediction = 'away'
            mlBestEdge = adjustedAwayMLEdge
            mlOdds = game.bettingLines.awayMoneyline
          }
        }
        
        if (mlPickFound) {
          const actualWinner = game.homeScore > game.awayScore ? 'home' : 'away'
          const isWin = mlPrediction === actualWinner
          const units = calculateUnits(mlOdds, isWin, 1)
          
          results.winRateByBetType.moneyline.total++
          results.winRateByBetType.moneyline.units += units
          results.totalUnits += units
          results.totalBets++
          
          if (isWin) {
            results.edgeWins++
            results.winRateByBetType.moneyline.wins++
          } else {
            results.edgeLosses++
          }
          
          results.weeklyBreakdown[weekKey].edgePicks++
          results.weeklyBreakdown[weekKey].totalUnits += units
          
          if (isWin) {
            results.weeklyBreakdown[weekKey].edgeWins++
          } else {
            results.weeklyBreakdown[weekKey].edgeLosses++
          }
          
          if (mlBestEdge > results.weeklyBreakdown[weekKey].bestEdge) {
            results.weeklyBreakdown[weekKey].bestEdge = mlBestEdge
          }
          
          const pick = {
            game: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
            week: game.week,
            prediction: mlPrediction === 'home' ? game.homeTeamAbbr : game.awayTeamAbbr,
            edge: mlBestEdge.toFixed(1),
            outcome: isWin ? 'WIN' : 'LOSS',
            score: `${game.awayScore}-${game.homeScore}`,
            betType: 'Moneyline',
            odds: mlOdds,
            units: units.toFixed(2),
            confidence: mlPatternMatch && mlBestEdge >= 7 ? 'high' : 'medium',
            reasoning: mlReasoning.join(', ') || 'Statistical edge'
          }
          
          results.bestEdgePicks.push(pick)
          results.weeklyBreakdown[weekKey].picks.push(pick)
        }
        
        // High-Profitability Spread Analysis - Focus on proven winning patterns
        if (analysis.probabilities.spread && game.bettingLines.spread) {
          try {
            const homeSpreadProb = analysis.probabilities.spread.homeWinProb
            const awaySpreadProb = analysis.probabilities.spread.awayWinProb
            const spreadImplied = 0.5238 // Standard -110 odds implied probability
            
            // Calculate base edges
            const homeSpreadEdge = (homeSpreadProb - spreadImplied) * 100
            const awaySpreadEdge = (awaySpreadProb - spreadImplied) * 100
            
            // Apply proven NFL spread betting patterns for higher win rates
            let qualityBonus = 0
            let patternMatch = false
            let reasoning = []
            
            // PATTERN 1: Fade Heavy Favorites (7+ point spreads)
            if (Math.abs(game.bettingLines.spread) >= 7) {
              const underdog = game.bettingLines.spread < 0 ? 'away' : 'home'
              if ((underdog === 'home' && homeSpreadEdge > 0) || (underdog === 'away' && awaySpreadEdge > 0)) {
                qualityBonus += 3.5 // Heavy favorites struggle ATS
                patternMatch = true
                reasoning.push('Fading heavy favorite')
              }
            }
            
            // PATTERN 2: Weather Games (favor unders and dogs)
            if (gameContext.weather && 
                (gameContext.weather.temperature < 35 || gameContext.weather.windSpeed > 18 || gameContext.weather.precipitation)) {
              const underdog = game.bettingLines.spread < 0 ? 'away' : 'home'
              if ((underdog === 'home' && homeSpreadEdge > 0) || (underdog === 'away' && awaySpreadEdge > 0)) {
                qualityBonus += 2.8 // Bad weather helps underdogs
                patternMatch = true
                reasoning.push('Weather favors underdog')
              }
            }
            
            // PATTERN 3: Division Games - Typically closer
            if (gameContext.isDivisionGame && Math.abs(game.bettingLines.spread) >= 4) {
              const underdog = game.bettingLines.spread < 0 ? 'away' : 'home'
              if ((underdog === 'home' && homeSpreadEdge > -1) || (underdog === 'away' && awaySpreadEdge > -1)) {
                qualityBonus += 2.2 // Division games are closer
                patternMatch = true
                reasoning.push('Division rivalry')
              }
            }
            
            // PATTERN 4: Prime Time Dogs (Monday/Thursday night underdogs)
            if (gameContext.isPrimeTime && Math.abs(game.bettingLines.spread) >= 3) {
              const underdog = game.bettingLines.spread < 0 ? 'away' : 'home'
              if ((underdog === 'home' && homeSpreadEdge > 0) || (underdog === 'away' && awaySpreadEdge > 0)) {
                qualityBonus += 2.5 // Prime time underdogs perform well
                patternMatch = true
                reasoning.push('Prime time underdog')
              }
            }
            
            // PATTERN 5: Strength Mismatch - When our model shows clear disagreement
            const homeStrengthRating = (homeStats.avgPointsScored || 22.5) - (homeStats.avgPointsAllowed || 22.5)
            const awayStrengthRating = (awayStats.avgPointsScored || 22.5) - (awayStats.avgPointsAllowed || 22.5)
            const modelSpread = (homeStrengthRating - awayStrengthRating) + 2.5 // Include HFA
            const spreadDiscrepancy = Math.abs(modelSpread - game.bettingLines.spread)
            
            if (spreadDiscrepancy >= 4.5) {
              // Our model disagrees significantly with the line
              const modelFavorite = modelSpread > game.bettingLines.spread ? 'home' : 'away'
              if ((modelFavorite === 'home' && homeSpreadEdge > 0) || (modelFavorite === 'away' && awaySpreadEdge > 0)) {
                qualityBonus += 3.2 // Model shows significant edge
                patternMatch = true
                reasoning.push('Significant model disagreement')
              }
            }
            
            // Apply quality bonus to edges
            const adjustedHomeEdge = homeSpreadEdge + (homeSpreadEdge > 0 ? qualityBonus : 0)
            const adjustedAwayEdge = awaySpreadEdge + (awaySpreadEdge > 0 ? qualityBonus : 0)
            
            // VERY SELECTIVE: Only take bets with high confidence (7%+ adjusted edge OR pattern match with 4%+ edge)
            const minEdge = patternMatch ? 4.0 : 7.0
            
            if (adjustedHomeEdge >= minEdge || adjustedAwayEdge >= minEdge) {
              const bestEdge = adjustedHomeEdge > adjustedAwayEdge ? adjustedHomeEdge : adjustedAwayEdge
              const spreadPrediction = adjustedHomeEdge > adjustedAwayEdge ? 'home' : 'away'
              const actualSpreadWinner = (game.homeScore + game.bettingLines.spread) > game.awayScore ? 'home' : 'away'
              const isSpreadWin = spreadPrediction === actualSpreadWinner
              
              const spreadUnits = calculateUnits(-110, isSpreadWin, 1)
              
              results.winRateByBetType.spread.total++
              results.winRateByBetType.spread.units += spreadUnits
              results.totalUnits += spreadUnits
              results.totalBets++
              
              if (isSpreadWin) {
                results.edgeWins++
                results.winRateByBetType.spread.wins++
              } else {
                results.edgeLosses++
              }
              
              results.weeklyBreakdown[weekKey].edgePicks++
              results.weeklyBreakdown[weekKey].totalUnits += spreadUnits
              
              if (isSpreadWin) {
                results.weeklyBreakdown[weekKey].edgeWins++
              } else {
                results.weeklyBreakdown[weekKey].edgeLosses++
              }
              
              if (bestEdge > results.weeklyBreakdown[weekKey].bestEdge) {
                results.weeklyBreakdown[weekKey].bestEdge = bestEdge
              }
              
              const spreadPick = {
                game: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
                week: game.week,
                prediction: spreadPrediction === 'home' 
                  ? `${game.homeTeamAbbr} ${game.bettingLines.spread >= 0 ? '+' : ''}${game.bettingLines.spread}`
                  : `${game.awayTeamAbbr} ${game.bettingLines.spread <= 0 ? '+' : ''}${-game.bettingLines.spread}`,
                edge: bestEdge.toFixed(1),
                outcome: isSpreadWin ? 'WIN' : 'LOSS',
                score: `${game.awayScore}-${game.homeScore}`,
                betType: 'Spread',
                odds: -110,
                units: spreadUnits.toFixed(2),
                confidence: patternMatch && bestEdge >= 6 ? 'high' : 'medium',
                reasoning: reasoning.join(', ') || 'Statistical edge'
              }
              
              results.bestEdgePicks.push(spreadPick)
              results.weeklyBreakdown[weekKey].picks.push(spreadPick)
            }
          } catch (error) {
            console.error('Error in spread analysis:', error)
          }
        }
        
        // Check over/under predictions with enhanced model
        if (analysis.probabilities.total && game.bettingLines.total) {
          const overProb = analysis.probabilities.total.overProb
          const underProb = analysis.probabilities.total.underProb
          const totalImplied = 0.5238 // Standard -110 odds implied probability
          
          const overEdgeCalc = calculateSmartEdges(overProb, totalImplied, 'total', 'medium')
          const underEdgeCalc = calculateSmartEdges(underProb, totalImplied, 'total', 'medium')
          
          if (overEdgeCalc.hasEdge || underEdgeCalc.hasEdge) {
            const bestTotalEdge = Math.abs(overEdgeCalc.edge) > Math.abs(underEdgeCalc.edge) ? overEdgeCalc : underEdgeCalc
            const totalPrediction = Math.abs(overEdgeCalc.edge) > Math.abs(underEdgeCalc.edge) ? 'over' : 'under'
            const actualTotal = game.homeScore + game.awayScore
            const actualTotalResult = actualTotal > game.bettingLines.total ? 'over' : 'under'
            const totalEdgeSize = Math.abs(bestTotalEdge.edge)
            const isTotalWin = totalPrediction === actualTotalResult
            
            const totalUnits = calculateUnits(-110, isTotalWin, 1) // Standard -110 odds
            
            results.winRateByBetType.overunder.total++
            results.winRateByBetType.overunder.units += totalUnits
            results.totalUnits += totalUnits
            results.totalBets++
            
            if (isTotalWin) {
              results.edgeWins++
              results.winRateByBetType.overunder.wins++
            } else {
              results.edgeLosses++
            }
            
            results.weeklyBreakdown[weekKey].edgePicks++
            results.weeklyBreakdown[weekKey].totalUnits += totalUnits
            
            if (isTotalWin) {
              results.weeklyBreakdown[weekKey].edgeWins++
            } else {
              results.weeklyBreakdown[weekKey].edgeLosses++
            }
            
            if (totalEdgeSize > results.weeklyBreakdown[weekKey].bestEdge) {
              results.weeklyBreakdown[weekKey].bestEdge = totalEdgeSize
            }
            
            const totalPick = {
              game: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
              week: game.week,
              prediction: `${totalPrediction.toUpperCase()} ${game.bettingLines.total}`,
              edge: totalEdgeSize.toFixed(1),
              outcome: isTotalWin ? 'WIN' : 'LOSS',
              score: `${game.awayScore}-${game.homeScore} (${actualTotal})`,
              betType: 'Over/Under',
              odds: -110,
              units: totalUnits.toFixed(2)
            }
            
            results.bestEdgePicks.push(totalPick)
            results.weeklyBreakdown[weekKey].picks.push(totalPick)
          }
        }
        
      } catch (error) {
        console.error('Error analyzing game:', error)
      }
    })
    
    // Sort best edges by edge size
    results.bestEdgePicks.sort((a, b) => parseFloat(b.edge) - parseFloat(a.edge))
    results.bestEdgePicks = results.bestEdgePicks.slice(0, 10) // Top 10
    
    return results
  }
  
  const getImpliedProbability = (americanOdds) => {
    if (!americanOdds || americanOdds === 0) return 50.0
    
    if (americanOdds > 0) {
      return (100 / (americanOdds + 100)) * 100
    } else {
      return (Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)) * 100
    }
  }
  
  const getDefaultStats = () => ({
    avgPointsScored: 22.5,
    avgPointsAllowed: 22.5,
    defensiveRating: 1.0
  })
  
  // Calculate units won/lost based on American odds
  const calculateUnits = (americanOdds, isWin, betSize = 1) => {
    if (!isWin) return -betSize // Loss = lose the bet amount
    
    if (americanOdds > 0) {
      // Positive odds: +200 means win $2 for every $1 bet
      return betSize * (americanOdds / 100)
    } else {
      // Negative odds: -150 means win $1 for every $1.50 bet
      return betSize * (100 / Math.abs(americanOdds))
    }
  }

  // Parse weather conditions string into structured data
  const parseWeatherConditions = (weatherString) => {
    const weather = {
      temperature: 70, // Default moderate temperature
      windSpeed: 5,    // Default light wind
      precipitation: false
    }
    
    if (!weatherString) return weather
    
    const lowerWeather = weatherString.toLowerCase()
    
    // Temperature parsing
    if (lowerWeather.includes('cold')) weather.temperature = 30
    if (lowerWeather.includes('hot')) weather.temperature = 85
    if (lowerWeather.includes('dome') || lowerWeather.includes('indoor')) weather.temperature = 72
    
    // Wind parsing
    if (lowerWeather.includes('wind')) weather.windSpeed = 15
    if (lowerWeather.includes('gusty')) weather.windSpeed = 20
    
    // Precipitation parsing
    if (lowerWeather.includes('rain') || lowerWeather.includes('snow')) weather.precipitation = true
    
    return weather
  }

  return (
    <div className="performance-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            🎯 Model Performance Analytics
          </div>
          <h1 className="hero-title">
            Track Record
            <span className="hero-subtitle">Validated Against Real Results</span>
          </h1>
          <p className="hero-description">
            See how our statistical model performs in real NFL games. Every prediction is tracked 
            and validated against actual outcomes to ensure transparency and accuracy.
          </p>
          
          {/* Season Selector - Only show if multiple seasons available */}
          {config.availableSeasons.length > 1 && (
            <div className="season-selector" style={{marginBottom: '2rem'}}>
              <div className="season-label" style={{color: '#87ceeb', marginBottom: '0.5rem'}}>Season:</div>
              <div className="season-tabs">
                {config.availableSeasons.map(season => (
                  <button
                    key={season}
                    className={`season-tab ${selectedSeason === season ? 'active' : ''}`}
                    onClick={() => setSelectedSeason(season)}
                    style={{
                      padding: '0.5rem 1rem',
                      margin: '0 0.25rem',
                      border: 'none',
                      borderRadius: '8px',
                      background: selectedSeason === season ? '#87ceeb' : 'rgba(135, 206, 235, 0.1)',
                      color: selectedSeason === season ? '#1a1a1a' : '#87ceeb',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {season}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {!loading && performanceData && (
            <div className="hero-stats">
              <div className="stat">
                <div className="stat-value">
                  {performanceData.totalUnits >= 0 ? '+' : ''}{performanceData.totalUnits.toFixed(2)}
                </div>
                <div className="stat-label">Total Units</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {performanceData.totalBets > 0 
                    ? ((performanceData.totalUnits / performanceData.totalBets) * 100).toFixed(1)
                    : '0.0'}%
                </div>
                <div className="stat-label">ROI</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {performanceData.edgeWins + performanceData.edgeLosses > 0 
                    ? ((performanceData.edgeWins / (performanceData.edgeWins + performanceData.edgeLosses)) * 100).toFixed(1)
                    : '0.0'}%
                </div>
                <div className="stat-label">Win Rate</div>
              </div>
            </div>
          )}
          
          {loading && (
            <div className="hero-stats">
              <div className="stat">
                <div className="stat-value">Loading...</div>
                <div className="stat-label">Analyzing Games</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Performance Metrics Section */}
      <section className="features-section">
        <div className="container">
          <h2>Performance Breakdown</h2>
          <p className="section-subtitle">
            Detailed analysis of model accuracy across different bet types
          </p>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Edge Accuracy</h3>
              {loading ? (
                <p>Calculating win rate...</p>
              ) : performanceData ? (
                <>
                  <p><strong>{performanceData.edgeWins + performanceData.edgeLosses > 0 
                    ? ((performanceData.edgeWins / (performanceData.edgeWins + performanceData.edgeLosses)) * 100).toFixed(1)
                    : '0.0'}% Win Rate</strong></p>
                  <p>{performanceData.edgeWins} wins, {performanceData.edgeLosses} losses on 5%+ edges</p>
                </>
              ) : (
                <p>No data available</p>
              )}
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Moneyline Performance</h3>
              {loading ? (
                <p>Analyzing moneyline bets...</p>
              ) : performanceData?.winRateByBetType.moneyline.total > 0 ? (
                <>
                  <p><strong>{performanceData.winRateByBetType.moneyline.units >= 0 ? '+' : ''}{performanceData.winRateByBetType.moneyline.units.toFixed(2)} Units</strong></p>
                  <p><strong>{((performanceData.winRateByBetType.moneyline.wins / performanceData.winRateByBetType.moneyline.total) * 100).toFixed(1)}% Win Rate</strong></p>
                  <p>{performanceData.winRateByBetType.moneyline.wins}/{performanceData.winRateByBetType.moneyline.total} correct picks</p>
                </>
              ) : (
                <p>No significant moneyline edges found</p>
              )}
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Spread Performance</h3>
              {loading ? (
                <p>Analyzing spread bets...</p>
              ) : performanceData?.winRateByBetType.spread.total > 0 ? (
                <>
                  <p><strong>{performanceData.winRateByBetType.spread.units >= 0 ? '+' : ''}{performanceData.winRateByBetType.spread.units.toFixed(2)} Units</strong></p>
                  <p><strong>{((performanceData.winRateByBetType.spread.wins / performanceData.winRateByBetType.spread.total) * 100).toFixed(1)}% Win Rate</strong></p>
                  <p>{performanceData.winRateByBetType.spread.wins}/{performanceData.winRateByBetType.spread.total} correct picks</p>
                </>
              ) : (
                <p>No significant spread edges found</p>
              )}
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Over/Under Performance</h3>
              {loading ? (
                <p>Analyzing over/under bets...</p>
              ) : performanceData?.winRateByBetType.overunder.total > 0 ? (
                <>
                  <p><strong>{performanceData.winRateByBetType.overunder.units >= 0 ? '+' : ''}{performanceData.winRateByBetType.overunder.units.toFixed(2)} Units</strong></p>
                  <p><strong>{((performanceData.winRateByBetType.overunder.wins / performanceData.winRateByBetType.overunder.total) * 100).toFixed(1)}% Win Rate</strong></p>
                  <p>{performanceData.winRateByBetType.overunder.wins}/{performanceData.winRateByBetType.overunder.total} correct picks</p>
                </>
              ) : (
                <p>No significant over/under edges found</p>
              )}
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Best Edge Found</h3>
              {loading ? (
                <p>Finding best edges...</p>
              ) : bestEdges.length > 0 ? (
                <>
                  <p><strong>+{bestEdges[0].edge}% Edge</strong></p>
                  <p>{bestEdges[0].game} - Week {bestEdges[0].week}</p>
                  <p className={bestEdges[0].outcome === 'WIN' ? 'text-green' : 'text-red'}>
                    {bestEdges[0].outcome} ({bestEdges[0].score})
                  </p>
                </>
              ) : (
                <p>No significant edges identified</p>
              )}
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🏆</div>
              <h3>Games Tracked</h3>
              {loading ? (
                <p>Loading game data...</p>
              ) : performanceData ? (
                <>
                  <p><strong>{performanceData.totalGames} Total Games</strong></p>
                  <p>From completed {selectedSeason} NFL weeks</p>
                </>
              ) : (
                <p>Unable to load game data</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Weekly Breakdown Section */}
      <section className="features-section">
        <div className="container">
          <h2>Weekly Performance</h2>
          <p className="section-subtitle">
            Model performance broken down by NFL week
          </p>
          
          {loading ? (
            <div className="loading-message">
              <p>Analyzing weekly performance...</p>
            </div>
          ) : Object.keys(weeklyResults).length > 0 ? (
            <div className="weekly-breakdown">
              <div className="features-grid">
                {Object.values(weeklyResults)
                  .sort((a, b) => a.week - b.week)
                  .map((weekData, index) => (
                  <div key={index} className="feature-card">
                    <div className="feature-icon">📅</div>
                    <h3>Week {weekData.week}</h3>
                    <p><strong>Games:</strong> {weekData.totalGames}</p>
                    <p><strong>Edge Picks:</strong> {weekData.edgePicks}</p>
                    {weekData.edgePicks > 0 ? (
                      <>
                        <p><strong>Units:</strong> {weekData.totalUnits >= 0 ? '+' : ''}{weekData.totalUnits.toFixed(2)}</p>
                        <p><strong>Win Rate:</strong> {((weekData.edgeWins / weekData.edgePicks) * 100).toFixed(1)}%</p>
                        <p><strong>Record:</strong> {weekData.edgeWins}-{weekData.edgeLosses}</p>
                        <p><strong>Best Edge:</strong> +{weekData.bestEdge.toFixed(1)}%</p>
                      </>
                    ) : (
                      <p><em>No significant edges found</em></p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="no-data-message">
              <p>No weekly data available</p>
            </div>
          )}
        </div>
      </section>

      {/* Best Edges Table */}
      <section className="tokenomics-section">
        <div className="container">
          <h2>Top Model Picks</h2>
          <p className="section-subtitle">
            Our highest-confidence predictions and their outcomes
          </p>
          
          {loading ? (
            <div className="loading-message">
              <p>Analyzing completed games to validate model performance...</p>
            </div>
          ) : bestEdges.length > 0 ? (
            <div className="best-edges-table">
              <table>
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Week</th>
                    <th>Prediction</th>
                    <th>Odds</th>
                    <th>Edge</th>
                    <th>Outcome</th>
                    <th>Units</th>
                  </tr>
                </thead>
                <tbody>
                  {bestEdges.map((pick, index) => (
                    <tr key={index} className={pick.outcome === 'WIN' ? 'win-row' : 'loss-row'}>
                      <td>{pick.game}</td>
                      <td>Week {pick.week}</td>
                      <td>{pick.prediction}</td>
                      <td>{pick.odds > 0 ? `+${pick.odds}` : pick.odds}</td>
                      <td>+{pick.edge}%</td>
                      <td className={pick.outcome === 'WIN' ? 'text-green' : 'text-red'}>
                        {pick.outcome}
                      </td>
                      <td className={parseFloat(pick.units) >= 0 ? 'text-green' : 'text-red'}>
                        {parseFloat(pick.units) >= 0 ? '+' : ''}{pick.units}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-data-message">
              <p>No significant edges found in available data. This could mean:</p>
              <ul>
                <li>The model is conservative and only identifies high-confidence opportunities</li>
                <li>Recent games didn't present clear statistical advantages</li>
                <li>More historical data is needed for comprehensive analysis</li>
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="homepage-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <h3>NFL Edge Finder</h3>
              <p>Transparent Performance Tracking</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 NFL Edge Finder. All performance data is validated against real game outcomes.</p>
            <p className="disclaimer">
              Past performance does not guarantee future results. Always gamble responsibly.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Performance