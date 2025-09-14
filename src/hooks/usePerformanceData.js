import { useState } from 'react'
import { analyzeGame } from '../utils/poissonModel'
import { comprehensiveGameAnalysis, calculateSmartEdges } from '../utils/enhancedBettingModel'
import { calculateAdvancedSpreadProb } from '../utils/advancedSpreadModel'
import { getTeamStats2025 } from '../data/team-stats-2025'
import nflDataPyService from '../services/nflDataPyService'
import { calculateUnits } from '../utils/performanceUtils'

export const usePerformanceData = () => {
  const [loading, setLoading] = useState(false)
  
  const getCompletedGamesForAnalysis = async (selectedSeason = '2025') => {
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
      },
      weeklyBreakdown: {}
    }
    
    completedGames.forEach(game => {
      try {
        const weekKey = `Week ${game.week}`
        
        if (!results.weeklyBreakdown[weekKey]) {
          results.weeklyBreakdown[weekKey] = {
            totalGames: 0,
            edgeWins: 0,
            edgeLosses: 0,
            totalUnits: 0,
            bestEdgePicks: []
          }
        }
        
        results.weeklyBreakdown[weekKey].totalGames++
        
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

        // ACTUAL Performance page logic - comprehensive analysis with smart edges
        
        // Create game context for pattern matching
        const gameContext = {
          isDivisionGame: homeStats.division === awayStats.division,
          weather: { temperature: 70, windSpeed: 5, precipitation: false }, // Basic weather
          isRevenge: false, // Simplified
          isPrimeTime: false, // Simplified
          homeRecentForm: [],
          awayRecentForm: [],
          homeInjuries: [],
          awayInjuries: []
        }
        
        // Create betting lines object
        const bettingLines = {
          homeMoneyline: game.homeMoneyline,
          awayMoneyline: game.awayMoneyline,
          spread: game.homeSpread,
          total: game.overUnder
        }
        
        // Use comprehensive analysis like Performance page
        const analysis = comprehensiveGameAnalysis(homeStats, awayStats, bettingLines, gameContext)
        
        // Helper function to get implied probability
        const getImpliedProbability = (americanOdds) => {
          if (americanOdds > 0) {
            return 100 / (americanOdds + 100) * 100
          } else {
            return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100) * 100
          }
        }
        
        // MONEYLINE ANALYSIS WITH SMART EDGES (like Performance page)
        if (bettingLines.homeMoneyline && bettingLines.awayMoneyline) {
          const homeWinProb = analysis.probabilities.moneyline.homeWinProb * 100
          const awayWinProb = analysis.probabilities.moneyline.awayWinProb * 100
          const homeImplied = getImpliedProbability(bettingLines.homeMoneyline)
          const awayImplied = getImpliedProbability(bettingLines.awayMoneyline)
          
          const homeBaseEdge = (homeWinProb / 100 - homeImplied / 100) * 100
          const awayBaseEdge = (awayWinProb / 100 - awayImplied / 100) * 100
          
          // Apply pattern bonuses like Performance page
          let mlQualityBonus = 0
          let mlPatternMatch = false
          
          // Pattern matching logic (simplified from Performance page)
          if (gameContext.isDivisionGame && bettingLines.awayMoneyline >= 180 && bettingLines.awayMoneyline <= 350) {
            if (awayBaseEdge > 2) {
              mlQualityBonus += 4.5
              mlPatternMatch = true
            }
          }
          
          // Value dogs pattern
          if (bettingLines.homeMoneyline >= 200 && homeBaseEdge > 3) {
            mlQualityBonus += 4.2
            mlPatternMatch = true
          }
          if (bettingLines.awayMoneyline >= 200 && awayBaseEdge > 3) {
            mlQualityBonus += 4.2
            mlPatternMatch = true
          }
          
          const adjustedHomeMLEdge = homeBaseEdge + (homeBaseEdge > 0 ? mlQualityBonus : 0)
          const adjustedAwayMLEdge = awayBaseEdge + (awayBaseEdge > 0 ? mlQualityBonus : 0)
          
          // Selective criteria like Performance page
          const mlMinEdge = mlPatternMatch ? 5.5 : 8.5
          
          let mlPrediction = null
          let mlOdds = 0
          
          // Don't bet short favorites
          if (adjustedHomeMLEdge >= mlMinEdge && 
              !(bettingLines.homeMoneyline >= -180 && bettingLines.homeMoneyline <= -120)) {
            mlPrediction = 'HOME'
            mlOdds = bettingLines.homeMoneyline
          } else if (adjustedAwayMLEdge >= mlMinEdge && 
                     !(bettingLines.awayMoneyline >= -180 && bettingLines.awayMoneyline <= -120)) {
            mlPrediction = 'AWAY'
            mlOdds = bettingLines.awayMoneyline
          }
          
          if (mlPrediction) {
            const isWin = mlPrediction === actualWinner
            const units = calculateUnits(mlOdds, isWin, 1)
            
            results.winRateByBetType.moneyline.total++
            results.winRateByBetType.moneyline.units += units
            results.totalUnits += units
            results.totalBets++
            
            if (isWin) {
              results.edgeWins++
              results.winRateByBetType.moneyline.wins++
              results.weeklyBreakdown[weekKey].edgeWins++
            } else {
              results.edgeLosses++
              results.weeklyBreakdown[weekKey].edgeLosses++
            }
            
            results.weeklyBreakdown[weekKey].totalUnits += units
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
              results.weeklyBreakdown[weekKey].edgeWins++
            } else {
              results.edgeLosses++
              results.weeklyBreakdown[weekKey].edgeLosses++
            }
            
            results.weeklyBreakdown[weekKey].totalUnits += spreadUnits
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
              results.weeklyBreakdown[weekKey].edgeWins++
            } else {
              results.edgeLosses++
              results.weeklyBreakdown[weekKey].edgeLosses++
            }
            
            results.weeklyBreakdown[weekKey].totalUnits += totalUnits
          }
        }
        
      } catch (error) {
        console.error('Error analyzing game performance:', error)
      }
    })
    
    return results
  }
  
  const loadPerformanceData = async (selectedSeason = '2025') => {
    setLoading(true)
    try {
      const completedGames = await getCompletedGamesForAnalysis(selectedSeason)
      
      if (completedGames.length > 0) {
        const analysis = analyzeModelPerformance(completedGames)
        const totalWins = analysis.edgeWins
        const totalBets = analysis.edgeWins + analysis.edgeLosses  
        const winRate = totalBets > 0 ? (totalWins / totalBets) * 100 : 0
        
        return {
          performanceData: analysis,
          overallWinRate: winRate,
          totalUnits: analysis.totalUnits,
          totalBets: totalBets,
          totalGames: completedGames.length
        }
      }
      
      return {
        performanceData: null,
        overallWinRate: 0,
        totalUnits: 0,
        totalBets: 0,
        totalGames: 0
      }
      
    } catch (error) {
      console.error('Error loading performance data:', error)
      return {
        performanceData: null,
        overallWinRate: 0,
        totalUnits: 0,
        totalBets: 0,
        totalGames: 0
      }
    } finally {
      setLoading(false)
    }
  }
  
  return {
    loadPerformanceData,
    loading
  }
}