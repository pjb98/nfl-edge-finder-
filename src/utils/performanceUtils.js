import { getTeamStats2025 } from '../data/team-stats-2025'
import { analyzeGame } from './poissonModel'
import { comprehensiveGameAnalysis, calculateSmartEdges } from './enhancedBettingModel'
import { calculateAdvancedSpreadProb } from './advancedSpreadModel'
import nflDataPyService from '../services/nflDataPyService'
import { config } from '../config/environment'

export const calculateUnits = (americanOdds, isWin, betSize = 1) => {
  if (!isWin) return -betSize
  
  if (americanOdds > 0) {
    return betSize * (americanOdds / 100)
  } else {
    return betSize * (100 / Math.abs(americanOdds))
  }
}

export const getOverallPerformanceStats = async (season = config.defaultSeason) => {
  try {
    console.log('🏠 Homepage: Loading performance stats for season:', season)
    const completedGames = await getCompletedGamesForAnalysis(season)
    console.log('🏠 Homepage: Found', completedGames.length, 'completed games')
    
    if (completedGames.length === 0) {
      console.log('🏠 Homepage: No completed games found')
      return {
        totalGames: 0,
        overallWinRate: 0,
        totalUnits: 0,
        totalBets: 0
      }
    }

    const performanceData = analyzeModelPerformance(completedGames)
    const totalWins = performanceData.edgeWins
    const totalBets = performanceData.edgeWins + performanceData.edgeLosses
    const winRate = totalBets > 0 ? (totalWins / totalBets) * 100 : 0

    console.log('🏠 Homepage: Performance Results:', {
      totalWins,
      totalLosses: performanceData.edgeLosses,
      totalBets,
      winRate: winRate.toFixed(1) + '%',
      totalUnits: performanceData.totalUnits.toFixed(2)
    })

    return {
      totalGames: performanceData.totalGames,
      overallWinRate: winRate,
      totalUnits: performanceData.totalUnits,
      totalBets: totalBets
    }
  } catch (error) {
    console.error('Error calculating performance stats:', error)
    return {
      totalGames: 0,
      overallWinRate: 0,
      totalUnits: 0,
      totalBets: 0
    }
  }
}

const getCompletedGamesForAnalysis = async (selectedSeason) => {
  const completedGames = []
  
  try {
    const season = parseInt(selectedSeason)
    let weeksToAnalyze = []
    
    if (season === 2024) {
      weeksToAnalyze = [15, 16, 17, 18]
    } else {
      weeksToAnalyze = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
    }
    
    for (const week of weeksToAnalyze) {
      try {
        const weekGames = await nflDataPyService.getWeekSchedule(season, week, 'REG')
        const transformedGames = nflDataPyService.transformScheduleToGameFormat(weekGames)
        
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
    winRateByBetType: {
      moneyline: { wins: 0, total: 0, units: 0 },
      spread: { wins: 0, total: 0, units: 0 },
      overunder: { wins: 0, total: 0, units: 0 }
    }
  }
  
  completedGames.forEach(game => {
    try {
      const homeStats = getTeamStats2025(game.homeTeamAbbr)
      const awayStats = getTeamStats2025(game.awayTeamAbbr)
      
      if (!homeStats || !awayStats) return
      
      const mlAnalysis = analyzeGame(homeStats, awayStats, game)
      const comprehensiveAnalysis = comprehensiveGameAnalysis(homeStats, awayStats, game)
      
      const actualHomeScore = game.homeScore || 0
      const actualAwayScore = game.awayScore || 0
      const actualWinner = actualHomeScore > actualAwayScore ? 'HOME' : 
                          actualAwayScore > actualHomeScore ? 'AWAY' : 'TIE'
      
      if (actualWinner === 'TIE') return

      // Moneyline analysis
      if (game.homeMoneyline && game.awayMoneyline) {
        const mlPrediction = mlAnalysis.homeWinProb > 0.5 ? 'HOME' : 'AWAY'
        const mlOdds = mlPrediction === 'HOME' ? game.homeMoneyline : game.awayMoneyline
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
      }

      // Spread analysis
      if (game.homeSpread !== undefined) {
        const spreadAnalysis = calculateAdvancedSpreadProb(homeStats, awayStats, game)
        
        if (spreadAnalysis.recommendation && spreadAnalysis.recommendation !== 'PASS') {
          const actualMargin = actualHomeScore - actualAwayScore
          const homeSpreadResult = actualMargin + game.homeSpread > 0
          const awaySpreadResult = actualMargin + game.homeSpread < 0
          
          const isSpreadWin = (spreadAnalysis.recommendation === 'HOME' && homeSpreadResult) ||
                             (spreadAnalysis.recommendation === 'AWAY' && awaySpreadResult)
          
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
        }
      }

      // Over/Under analysis
      if (game.overUnder) {
        const totalScore = actualHomeScore + actualAwayScore
        const predictedTotal = mlAnalysis.projectedHomeScore + mlAnalysis.projectedAwayScore
        
        if (Math.abs(predictedTotal - game.overUnder) >= 3) {
          const prediction = predictedTotal > game.overUnder ? 'OVER' : 'UNDER'
          const isTotalWin = (prediction === 'OVER' && totalScore > game.overUnder) ||
                            (prediction === 'UNDER' && totalScore < game.overUnder)
          
          const totalUnits = calculateUnits(-110, isTotalWin, 1)
          
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
        }
      }
      
    } catch (error) {
      console.error('Error analyzing game performance:', error)
    }
  })
  
  return results
}