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
    
    // Clear debug logs at start
    window.performanceDebugLogs = []
    
    // Force add initial debug message
    const initMsg = `🎯 PERFORMANCE DEBUG: Starting analysis for season ${selectedSeason}`;
    console.log(initMsg);
    window.performanceDebugLogs.push(initMsg);
    
    try {
      const season = parseInt(selectedSeason)
      let weeksToAnalyze = []
      
      if (season === 2024) {
        weeksToAnalyze = [15, 16, 17, 18]
      } else {
        weeksToAnalyze = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
      }
      
      console.log(`🎯 PERFORMANCE: Starting analysis for ${season}, weeks:`, weeksToAnalyze)
      const weeksMsg = `📅 PERFORMANCE DEBUG: Analyzing weeks: ${weeksToAnalyze.join(', ')}`;
      window.performanceDebugLogs.push(weeksMsg);
      
      for (const week of weeksToAnalyze) {
        try {
          const weekGames = await nflDataPyService.getWeekSchedule(season, week, 'REG')
          const transformedGames = nflDataPyService.transformScheduleToGameFormat(weekGames)
          
          const completed = transformedGames.filter(game => game.isCompleted)
          
          // Add debug info for each week
          const weekMsg = `📊 Week ${week}: Found ${completed.length} completed games`;
          console.log(weekMsg);
          window.performanceDebugLogs.push(weekMsg);
          
          // Log Week 2 games specifically
          if (week === 2 && completed.length > 0) {
            const week2Msg = `🎯 Week 2 Games Found: ${completed.map(g => `${g.awayTeamAbbr}@${g.homeTeamAbbr} (${g.homeScore}-${g.awayScore})`).join(', ')}`;
            console.log(week2Msg);
            window.performanceDebugLogs.push(week2Msg);
          }
          
          completedGames.push(...completed)
        } catch (error) {
          const errorMsg = `❌ ${season} Week ${week} data not available: ${error.message}`;
          console.log(errorMsg);
          window.performanceDebugLogs.push(errorMsg);
        }
      }
      
    } catch (error) {
      console.error('Error fetching completed games:', error)
      const mainErrorMsg = `🚨 PERFORMANCE ERROR: ${error.message}`;
      window.performanceDebugLogs.push(mainErrorMsg);
    }
    
    const finalMsg = `✅ PERFORMANCE DEBUG: Analysis complete. Found ${completedGames.length} total completed games`;
    console.log(finalMsg);
    window.performanceDebugLogs.push(finalMsg);
    
    return completedGames
  }
  
  const analyzeModelPerformance = (completedGames) => {
    // Add initial debug message for performance analysis
    const analysisMsg = `🔍 PERFORMANCE ANALYSIS: Starting analysis of ${completedGames.length} completed games`;
    console.log(analysisMsg);
    if (!window.performanceDebugLogs) window.performanceDebugLogs = [];
    window.performanceDebugLogs.push(analysisMsg);
    
    // Log Week 2 games specifically for debugging
    const week2Games = completedGames.filter(g => g.week === 2);
    if (week2Games.length > 0) {
      const week2AnalysisMsg = `🎯 WEEK 2 ANALYSIS: Processing ${week2Games.length} Week 2 games: ${week2Games.map(g => `${g.awayTeamAbbr}@${g.homeTeamAbbr}`).join(', ')}`;
      console.log(week2AnalysisMsg);
      window.performanceDebugLogs.push(week2AnalysisMsg);
    }
    
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

        // Use EXACT same logic as Dashboard for consistency
        
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
        
        // Create betting lines object - use the same structure as Dashboard
        const bettingLines = {
          homeMoneyline: game.bettingLines?.homeMoneyline || game.homeMoneyline,
          awayMoneyline: game.bettingLines?.awayMoneyline || game.awayMoneyline,
          spread: game.bettingLines?.spread || game.homeSpread,
          total: game.bettingLines?.total || game.overUnder
        }
        
        // Use comprehensive analysis like Dashboard
        const analysis = comprehensiveGameAnalysis(homeStats, awayStats, bettingLines, gameContext)
        
        // Helper function to get implied probability (EXACT same as Dashboard)
        const getImpliedProbability = (americanOdds) => {
          if (americanOdds > 0) {
            return 100 / (americanOdds + 100) * 100
          } else {
            return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100) * 100
          }
        }
        
        // MONEYLINE ANALYSIS - COPY EXACT Dashboard logic
        if (bettingLines.homeMoneyline && bettingLines.awayMoneyline) {
          const homeWinProb = analysis.probabilities.moneyline.homeWinProb * 100
          const awayWinProb = analysis.probabilities.moneyline.awayWinProb * 100
          const homeImplied = getImpliedProbability(bettingLines.homeMoneyline)
          const awayImplied = getImpliedProbability(bettingLines.awayMoneyline)
          
          const homeBaseEdge = homeWinProb - homeImplied
          const awayBaseEdge = awayWinProb - awayImplied
          
          // EXACT same pattern bonuses as Dashboard
          let mlQualityBonus = 0
          let mlPatternMatch = false
          
          // Pattern matching logic (EXACT copy from Dashboard)
          if (gameContext.isDivisionGame && bettingLines.awayMoneyline >= 180 && bettingLines.awayMoneyline <= 350) {
            if (awayBaseEdge > 2) {
              mlQualityBonus += 4.5
              mlPatternMatch = true
            }
          }
          
          // Value dogs pattern (EXACT copy from Dashboard)
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
          
          // EXACT same criteria as Dashboard
          const mlMinEdge = mlPatternMatch ? 5.5 : 8.5
          
          let mlPrediction = null
          let mlOdds = 0
          
          // EXACT same exclusion logic as Dashboard
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
            
            // DEBUG: Log each moneyline bet for comparison
            if (game.week === 2) {
              const debugMsg = `🎯 PERFORMANCE ML BET: ${game.awayTeamAbbr} @ ${game.homeTeamAbbr} - Predicted: ${mlPrediction}, Actual: ${actualWinner}, ${isWin ? 'WIN' : 'LOSS'}`;
              console.log(debugMsg);
              
              // Store for mobile display
              if (!window.performanceDebugLogs) window.performanceDebugLogs = [];
              window.performanceDebugLogs.push(debugMsg);
            }
            
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

        // Spread analysis - MATCH Dashboard logic exactly
        if (bettingLines.spread !== undefined) {
          const spreadAnalysis = calculateAdvancedSpreadProb(homeStats, awayStats, game)
          
          if (spreadAnalysis.recommendation && spreadAnalysis.recommendation !== 'PASS') {
            const actualMargin = actualHomeScore - actualAwayScore
            
            // Calculate who actually covered the spread
            const homeCovers = actualMargin + bettingLines.spread > 0;
            
            // Check if our recommendation was correct
            const isSpreadWin = (spreadAnalysis.recommendation === 'HOME' && homeCovers) ||
                               (spreadAnalysis.recommendation === 'AWAY' && !homeCovers)
            
            const spreadUnits = calculateUnits(-110, isSpreadWin, 1)
            
            results.winRateByBetType.spread.total++
            results.winRateByBetType.spread.units += spreadUnits
            results.totalUnits += spreadUnits
            results.totalBets++
            
            // DEBUG: Log each spread bet for comparison
            if (game.week === 2) {
              const debugMsg = `🎯 PERFORMANCE SPREAD BET: ${game.awayTeamAbbr} @ ${game.homeTeamAbbr} - Predicted: ${spreadAnalysis.recommendation}, Covers: ${homeCovers ? 'HOME' : 'AWAY'}, ${isSpreadWin ? 'WIN' : 'LOSS'}`;
              console.log(debugMsg);
              
              // Store for mobile display
              if (!window.performanceDebugLogs) window.performanceDebugLogs = [];
              window.performanceDebugLogs.push(debugMsg);
            }
            
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

        // Over/Under analysis - MATCH Dashboard logic exactly
        if (bettingLines.total) {
          const totalScore = actualHomeScore + actualAwayScore
          const predictedTotal = mlAnalysis.projectedHomeScore + mlAnalysis.projectedAwayScore
          
          if (Math.abs(predictedTotal - bettingLines.total) >= 3) {
            // Check if our prediction was correct
            const prediction = predictedTotal > bettingLines.total ? 'OVER' : 'UNDER'
            const isTotalWin = (prediction === 'OVER' && totalScore > bettingLines.total) ||
                              (prediction === 'UNDER' && totalScore < bettingLines.total)
            
            const totalUnits = calculateUnits(-110, isTotalWin, 1)
            
            results.winRateByBetType.overunder.total++
            results.winRateByBetType.overunder.units += totalUnits
            results.totalUnits += totalUnits
            results.totalBets++
            
            // DEBUG: Log each total bet for comparison
            if (game.week === 2) {
              const debugMsg = `🎯 PERFORMANCE TOTAL BET: ${game.awayTeamAbbr} @ ${game.homeTeamAbbr} - Predicted: ${prediction}, Actual Total: ${totalScore} vs Line: ${bettingLines.total}, ${isTotalWin ? 'WIN' : 'LOSS'}`;
              console.log(debugMsg);
              
              // Store for mobile display
              if (!window.performanceDebugLogs) window.performanceDebugLogs = [];
              window.performanceDebugLogs.push(debugMsg);
            }
            
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