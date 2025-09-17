import { useState, useEffect } from 'react'
import { analyzeGame } from '../utils/poissonModel'
import { calculateSmartEdges, comprehensiveGameAnalysis } from '../utils/enhancedBettingModel'
import { calculateAdvancedSpreadProb } from '../utils/advancedSpreadModel'
import { getTeamStats2025 } from '../data/team-stats-2025'
import nflDataPyService from '../services/nflDataPyService'
import { config } from '../config/environment'
import { calculateUnits } from '../utils/performanceUtils'
import { analyzeCompletedFireBets, calculateUnitsFromOdds, detectFireEmojiBets, calculateFireBetResult } from '../utils/fireEmojiBetDetector'

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
        const analysis = await analyzeModelPerformance(completedGames, selectedSeason)
        const totalWins = analysis.edgeWins
        const totalBets = analysis.edgeWins + analysis.edgeLosses  
        const winRate = totalBets > 0 ? (totalWins / totalBets) * 100 : 0
        
        console.log('📊 Performance: Results for season', selectedSeason, ':', {
          totalWins,
          totalLosses: analysis.edgeLosses,
          totalBets,
          winRate: winRate.toFixed(1) + '%',
          totalUnits: analysis.totalUnits.toFixed(2)
        })
        
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
        // For 2024, use completed weeks
        weeksToAnalyze = [15, 16, 17, 18]
      } else {
        // For 2025, check all weeks for completed games
        weeksToAnalyze = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
      }
      
      const weeksMsg = `📅 PERFORMANCE DEBUG: Analyzing weeks: ${weeksToAnalyze.join(', ')}`;
      window.performanceDebugLogs.push(weeksMsg);
      
      for (const week of weeksToAnalyze) {
        try {
          const weekGames = await nflDataPyService.getWeekSchedule(season, week, 'REG')
          const transformedGames = nflDataPyService.transformScheduleToGameFormat(weekGames)
          
          // Filter for completed games only
          // Filter for completed games and add analysis data like Dashboard does
          const completed = transformedGames.filter(game => game.isCompleted)

          // Process completed games to add analysis data (same as Dashboard)
          const processedCompletedGames = completed.map(game => {
            // Get team stats (same as Dashboard)
            const homeStats = getTeamStats2025(game.homeTeamAbbr) || {
              pointsPerGame: 21,
              pointsAllowedPerGame: 21,
              yardsPerGame: 350,
              yardsAllowedPerGame: 350,
              offensiveRating: 1.0,
              defensiveRating: 1.0
            }
            const awayStats = getTeamStats2025(game.awayTeamAbbr) || {
              pointsPerGame: 21,
              pointsAllowedPerGame: 21,
              yardsPerGame: 350,
              yardsAllowedPerGame: 350,
              offensiveRating: 1.0,
              defensiveRating: 1.0
            }

            // Create game context (same as Dashboard)
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

            // Create the exact same structure as Dashboard - ensure betting lines are properly formatted
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

            // Debug for WAS @ GB specifically - BEFORE calling analyzeGame
            if (game.awayTeamAbbr === 'WAS' && game.homeTeamAbbr === 'GB') {
              console.log('🚨 WAS @ GB: ABOUT TO CALL analyzeGame with:', {
                homeStats: homeStats,
                awayStats: awayStats,
                bettingLines: enhancedGame.bettingLines
              });
              window.wasGBBeforeAnalysis = {
                homeStats: homeStats,
                awayStats: awayStats,
                bettingLines: enhancedGame.bettingLines
              };

              // Store a simple flag so we know this game was processed
              window.wasGBGameProcessed = `Found WAS @ GB game - Week ${game.week}, Completed: ${game.isCompleted}`;
            }

            // Run analyses like Dashboard does
            const basicAnalysis = analyzeGame(homeStats, awayStats, enhancedGame.bettingLines)
            const comprehensiveAnalysis = comprehensiveGameAnalysis(homeStats, awayStats, enhancedGame.bettingLines, gameContext)

            // Debug for WAS @ GB specifically - check what analyzeGame returns
            if (game.awayTeamAbbr === 'WAS' && game.homeTeamAbbr === 'GB') {
              console.log('🚨 WAS @ GB: analyzeGame RETURNED:', basicAnalysis);
              window.wasGBRawAnalysis = basicAnalysis;

              const analysisDebug = {
                bettingLinesInput: enhancedGame.bettingLines,
                basicAnalysisProbs: basicAnalysis?.probabilities,
                hasSpread: !!basicAnalysis?.probabilities?.spread,
                hasTotal: !!basicAnalysis?.probabilities?.total,
                spreadValue: enhancedGame.bettingLines.spread,
                totalValue: enhancedGame.bettingLines.total,
                fullBasicAnalysis: basicAnalysis
              };
              console.log('🔍 WAS @ GB ANALYSIS DEBUG:', analysisDebug);
              window.wasGBAnalysisDebug = analysisDebug;
            }

            // Merge analyses exactly like Dashboard does - preserve probabilities from basicAnalysis
            enhancedGame.analysis = {
              ...comprehensiveAnalysis,
              probabilities: basicAnalysis.probabilities || {},
              expectedPoints: basicAnalysis.expectedPoints || comprehensiveAnalysis.expectedPoints
            }

            // Debug the final merged analysis for WAS @ GB
            if (game.awayTeamAbbr === 'WAS' && game.homeTeamAbbr === 'GB') {
              console.log('🔍 WAS @ GB FINAL ANALYSIS:', {
                finalAnalysisHasSpread: !!enhancedGame.analysis?.probabilities?.spread,
                finalAnalysisHasTotal: !!enhancedGame.analysis?.probabilities?.total,
                finalProbabilities: enhancedGame.analysis?.probabilities
              });
              window.wasGBFinalAnalysis = {
                finalAnalysisHasSpread: !!enhancedGame.analysis?.probabilities?.spread,
                finalAnalysisHasTotal: !!enhancedGame.analysis?.probabilities?.total,
                finalProbabilities: enhancedGame.analysis?.probabilities
              };
            }

            return enhancedGame
          })

          // Add debug info for each week
          const weekMsg = `📊 Week ${week}: Found ${transformedGames.length} total games, ${processedCompletedGames.length} completed games with analysis`;
          console.log(weekMsg);
          window.performanceDebugLogs.push(weekMsg);

          // Debug Week 2 specifically since that's where you see fire emoji data
          if (week === 2) {
            console.log(`🔍 Week 2 DEBUG: Raw games:`, transformedGames.map(g => ({
              game: `${g.awayTeamAbbr} @ ${g.homeTeamAbbr}`,
              isCompleted: g.isCompleted,
              homeScore: g.homeScore,
              awayScore: g.awayScore
            })));

            const week2DebugMsg = `🔍 Week 2 DETAILS: ${transformedGames.length} total games, ${completed.length} completed`;
            window.performanceDebugLogs.push(week2DebugMsg);
          }
          
          // Log Week 2 games specifically
          if (week === 2 && processedCompletedGames.length > 0) {
            const week2Msg = `🎯 Week 2 Games Found: ${processedCompletedGames.map(g => `${g.awayTeamAbbr}@${g.homeTeamAbbr} (${g.homeScore}-${g.awayScore})`).join(', ')}`;
            console.log(week2Msg);
            window.performanceDebugLogs.push(week2Msg);
          }

          completedGames.push(...processedCompletedGames)
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
  
  const analyzeModelPerformance = async (completedGames, season) => {
    // Add initial debug message for performance analysis
    const analysisMsg = `🔍 PERFORMANCE ANALYSIS: Starting analysis of ${completedGames.length} completed games using fire emoji bet detector`;
    console.log(analysisMsg);
    if (!window.performanceDebugLogs) window.performanceDebugLogs = [];
    window.performanceDebugLogs.push(analysisMsg);

    // IMPORTANT: Process games the same way Dashboard does to get analysis data
    const processedGames = completedGames.map(game => {
      try {
        // Get team stats (same as Dashboard)
        let homeStats, awayStats;
        if (parseInt(season) === 2025) {
          homeStats = getTeamStats2025(game.homeTeamId);
          awayStats = getTeamStats2025(game.awayTeamId);
        } else {
          // Use default stats for older seasons if no specific stats available
          homeStats = game.homeTeamStats || getDefaultStats();
          awayStats = game.awayTeamStats || getDefaultStats();
        }

        // Create game context (same as Dashboard)
        const gameContext = {
          isDivisionGame: homeStats?.division === awayStats?.division,
          weather: { temperature: 70, windSpeed: 5, precipitation: false },
          isRevenge: false,
          isPrimeTime: false,
          homeRecentForm: [],
          awayRecentForm: [],
          homeInjuries: [],
          awayInjuries: []
        };

        // Run comprehensive analysis (same as Dashboard)
        const analysis = analyzeGame(homeStats, awayStats, game);

        // Return processed game with same structure as Dashboard
        return {
          ...game,
          homeTeamStats: homeStats,
          awayTeamStats: awayStats,
          analysis,
          gameContext
        };
      } catch (error) {
        console.warn(`Error processing game ${game.awayTeamAbbr} @ ${game.homeTeamAbbr}:`, error);
        return game; // Return original game if processing fails
      }
    });

    const processingMsg = `📊 GAME PROCESSING: Processed ${processedGames.length} games with analysis data`;
    console.log(processingMsg);
    window.performanceDebugLogs.push(processingMsg);

    // Use the unified fire emoji analysis from utils (same as Dashboard)
    const fireEmojiResults = analyzeCompletedFireBets(processedGames);

    // ALSO keep the detailed game-by-game debugging for troubleshooting
    const detailedGameDebug = [];
    let totalFireBetsFound = 0;
    let betTypeBreakdown = { moneyline: 0, spread: 0, total: 0 };

    processedGames.forEach(game => {
      if (!game.isCompleted || game.homeScore === null || game.awayScore === null) {
        return;
      }

      // Debug WAS @ GB immediately before calling detectFireEmojiBets
      if (game.awayTeamAbbr === 'WAS' && game.homeTeamAbbr === 'GB') {
        console.log('🎯 WAS @ GB: About to call detectFireEmojiBets with game object');
      }

      // Get fire emoji bets for this specific game
      const fireEmojiBets = detectFireEmojiBets(game);

      // Debug WAS @ GB fire emoji detection results
      if (game.awayTeamAbbr === 'WAS' && game.homeTeamAbbr === 'GB') {
        console.log('🎯 WAS @ GB: detectFireEmojiBets returned:', fireEmojiBets.map(bet => ({ type: bet.type, betText: bet.betText })));
      }

      // Debug for WAS @ GB specifically - check the exact game object structure
      if (game.awayTeamAbbr === 'WAS' && game.homeTeamAbbr === 'GB') {
        console.log('🔍 WAS @ GB GAME OBJECT STRUCTURE:', {
          hasAnalysis: !!game.analysis,
          analysisKeys: game.analysis ? Object.keys(game.analysis) : [],
          hasProbabilities: !!game.analysis?.probabilities,
          probabilitiesKeys: game.analysis?.probabilities ? Object.keys(game.analysis.probabilities) : [],
          spreadProb: game.analysis?.probabilities?.spread,
          totalProb: game.analysis?.probabilities?.total,
          moneylineProb: game.analysis?.probabilities?.moneyline,
          bettingLines: game.bettingLines,
          homeTeamStats: !!game.homeTeamStats,
          awayTeamStats: !!game.awayTeamStats
        });
        window.wasGBGameStructure = {
          hasAnalysis: !!game.analysis,
          analysisKeys: game.analysis ? Object.keys(game.analysis) : [],
          hasProbabilities: !!game.analysis?.probabilities,
          probabilitiesKeys: game.analysis?.probabilities ? Object.keys(game.analysis.probabilities) : [],
          spreadProb: game.analysis?.probabilities?.spread,
          totalProb: game.analysis?.probabilities?.total,
          moneylineProb: game.analysis?.probabilities?.moneyline,
          bettingLines: game.bettingLines,
          homeTeamStats: !!game.homeTeamStats,
          awayTeamStats: !!game.awayTeamStats
        };
      }

      // Debug for WAS @ GB specifically
      if (game.awayTeamAbbr === 'WAS' && game.homeTeamAbbr === 'GB') {
        console.log(`🔍 WAS @ GB FIRE EMOJI DETECTION:`, {
          totalBets: fireEmojiBets.length,
          bets: fireEmojiBets.map(bet => ({ type: bet.type, betText: bet.betText })),
          hasAnalysis: !!game.analysis,
          hasSpreadProb: !!game.analysis?.probabilities?.spread,
          hasTotalProb: !!game.analysis?.probabilities?.total,
          hasMoneylineProb: !!game.analysis?.probabilities?.moneyline,
          hasBettingLines: !!game.bettingLines,
          gameStructure: {
            homeTeam: game.homeTeamAbbr,
            awayTeam: game.awayTeamAbbr,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            spread: game.bettingLines?.spread,
            total: game.bettingLines?.total,
            homeML: game.bettingLines?.homeMoneyline,
            awayML: game.bettingLines?.awayMoneyline
          }
        });
      }

      if (fireEmojiBets.length > 0) {
        const gameDebug = {
          game: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
          week: game.week,
          score: `${game.awayTeamAbbr} ${game.awayScore} - ${game.homeScore} ${game.homeTeamAbbr}`,
          bets: []
        };

        fireEmojiBets.forEach(fireBet => {
          // Count bet types
          totalFireBetsFound++;
          if (betTypeBreakdown[fireBet.type] !== undefined) {
            betTypeBreakdown[fireBet.type]++;
          }

          // Calculate win/loss for this specific bet
          const result = calculateFireBetResult(fireBet, game);

          gameDebug.bets.push({
            type: fireBet.type,
            betText: fireBet.betText,
            result: result.result,
            won: result.won,
            debug: result.debug,
            units: result.won === true ? (fireBet.type === 'moneyline' && fireBet.odds ? calculateUnitsFromOdds(fireBet.odds, true) : 1) :
                   result.won === false ? -1 : 0
          });
        });

        detailedGameDebug.push(gameDebug);
      }
    });

    // Store detailed game-by-game results and debug info for website display
    window.fireEmojiGameByGameDebug = detailedGameDebug;

    const debugSummary = {
      totalGamesProcessed: processedGames.filter(g => g.isCompleted).length,
      gamesWithFireBets: detailedGameDebug.length,
      totalFireBetsDetected: totalFireBetsFound,
      betTypeBreakdown: betTypeBreakdown,
      unifiedAnalysisTotal: fireEmojiResults.totalBets
    };

    // Store debug info for website display
    window.fireEmojiDetectionSummary = debugSummary;

    // Check WAS @ GB specifically and store results
    const wasGBGame = processedGames.find(g => g.awayTeamAbbr === 'WAS' && g.homeTeamAbbr === 'GB');
    if (wasGBGame) {
      const wasGBFireBets = detectFireEmojiBets(wasGBGame);
      window.wasGBDebugInfo = {
        totalBets: wasGBFireBets.length,
        bets: wasGBFireBets.map(bet => ({ type: bet.type, betText: bet.betText })),
        hasAnalysis: !!wasGBGame.analysis,
        hasSpreadProb: !!wasGBGame.analysis?.probabilities?.spread,
        hasTotalProb: !!wasGBGame.analysis?.probabilities?.total,
        hasMoneylineProb: !!wasGBGame.analysis?.probabilities?.moneyline,
        hasBettingLines: !!wasGBGame.bettingLines,
        gameStructure: {
          homeTeam: wasGBGame.homeTeamAbbr,
          awayTeam: wasGBGame.awayTeamAbbr,
          homeScore: wasGBGame.homeScore,
          awayScore: wasGBGame.awayScore,
          spread: wasGBGame.bettingLines?.spread,
          total: wasGBGame.bettingLines?.total,
          homeML: wasGBGame.bettingLines?.homeMoneyline,
          awayML: wasGBGame.bettingLines?.awayMoneyline
        }
      };
    }

    console.log(`🎯 FIRE EMOJI DETECTION SUMMARY:`, debugSummary);
    console.log('🎯 GAME-BY-GAME FIRE EMOJI DEBUG:', detailedGameDebug);

    const resultsMsg = `🔥 FIRE EMOJI ANALYSIS: Found ${fireEmojiResults.totalBets} fire emoji bets - ${fireEmojiResults.wins} wins, ${fireEmojiResults.losses} losses, ${fireEmojiResults.totalUnits.toFixed(2)} units`;
    console.log(resultsMsg);
    window.performanceDebugLogs.push(resultsMsg);

    // Log detailed breakdown by type
    const typeBreakdownMsg = `📊 BY TYPE: ML=${fireEmojiResults.byType.moneyline.bets} (${fireEmojiResults.byType.moneyline.wins}W-${fireEmojiResults.byType.moneyline.losses}L), Spread=${fireEmojiResults.byType.spread.bets} (${fireEmojiResults.byType.spread.wins}W-${fireEmojiResults.byType.spread.losses}L), Total=${fireEmojiResults.byType.total.bets} (${fireEmojiResults.byType.total.wins}W-${fireEmojiResults.byType.total.losses}L)`;
    console.log(typeBreakdownMsg);
    window.performanceDebugLogs.push(typeBreakdownMsg);

    // Log detailed bet results for debugging
    fireEmojiResults.detailedResults.forEach(betResult => {
      const betMsg = `🎯 BET: ${betResult.bet} in ${betResult.game} Week ${betResult.week} → ${betResult.result} (${betResult.units >= 0 ? '+' : ''}${betResult.units.toFixed(2)} units)`;
      console.log(betMsg);
      window.performanceDebugLogs.push(betMsg);

      // Add debug information if available
      if (betResult.debug) {
        const debugMsg = `   ℹ️  ${betResult.debug}`;
        console.log(debugMsg);
        window.performanceDebugLogs.push(debugMsg);
      }
    });

    // Create weekly breakdown
    const weeklyBreakdown = {};
    fireEmojiResults.detailedResults.forEach(bet => {
      const weekKey = `Week ${bet.week}`;
      if (!weeklyBreakdown[weekKey]) {
        weeklyBreakdown[weekKey] = {
          week: bet.week,
          totalGames: completedGames.filter(g => g.week === bet.week).length,
          edgePicks: 0,
          edgeWins: 0,
          edgeLosses: 0,
          totalUnits: 0,
          bestEdge: 0,
          picks: []
        };
      }

      weeklyBreakdown[weekKey].edgePicks++;
      if (bet.won === true) {
        weeklyBreakdown[weekKey].edgeWins++;
      } else if (bet.won === false) {
        weeklyBreakdown[weekKey].edgeLosses++;
      }
      weeklyBreakdown[weekKey].totalUnits += bet.units;
      weeklyBreakdown[weekKey].picks.push({
        game: bet.game,
        prediction: bet.bet,
        outcome: bet.result,
        score: bet.actualScore,
        units: bet.units.toFixed(2)
      });
    });

    const results = {
      totalGames: completedGames.length,
      edgeWins: fireEmojiResults.wins,
      edgeLosses: fireEmojiResults.losses,
      totalUnits: fireEmojiResults.totalUnits,
      totalBets: fireEmojiResults.totalBets,
      bestEdgePicks: fireEmojiResults.detailedResults
        .filter(bet => bet.won !== null)
        .map(bet => ({
          game: bet.game,
          week: bet.week,
          prediction: bet.bet,
          type: bet.type,
          odds: bet.type === 'moneyline' ? (bet.units > 1 ? `+${Math.round((bet.units * 100))}` : `-${Math.round((100/bet.units))}`) : '-110',
          edge: '5.0', // Placeholder since we don't store exact edge
          outcome: bet.result,
          score: bet.actualScore,
          units: bet.units.toFixed(2)
        })),
      winRateByBetType: {
        moneyline: {
          wins: fireEmojiResults.byType.moneyline.wins,
          total: fireEmojiResults.byType.moneyline.bets,
          units: fireEmojiResults.byType.moneyline.units
        },
        spread: {
          wins: fireEmojiResults.byType.spread.wins,
          total: fireEmojiResults.byType.spread.bets,
          units: fireEmojiResults.byType.spread.units
        },
        overunder: {
          wins: fireEmojiResults.byType.total.wins,
          total: fireEmojiResults.byType.total.bets,
          units: fireEmojiResults.byType.total.units
        }
      },
      weeklyBreakdown
    }

    const finalMsg = `✅ PERFORMANCE ANALYSIS COMPLETE: Using exact Dashboard fire emoji logic`;
    console.log(finalMsg);
    window.performanceDebugLogs.push(finalMsg);

    return results
  }

  const analyzeStoredFireBets = (storedBets) => {
    const results = {
      totalBets: 0,
      wins: 0,
      losses: 0,
      totalUnits: 0,
      byType: {
        moneyline: { bets: 0, wins: 0, losses: 0, units: 0 },
        spread: { bets: 0, wins: 0, losses: 0, units: 0 },
        total: { bets: 0, wins: 0, losses: 0, units: 0 }
      },
      detailedResults: []
    };

    storedBets.forEach(bet => {
      if (!bet.gameData.isCompleted || bet.gameData.homeScore === null || bet.gameData.awayScore === null) {
        return; // Skip incomplete games
      }

      results.totalBets++;
      results.byType[bet.type].bets++;

      // Calculate win/loss using same logic as fire emoji detector
      let won = false;
      let debug = '';

      switch (bet.type) {
        case 'moneyline':
          const actualWinner = bet.gameData.homeScore > bet.gameData.awayScore ? 'HOME' :
                              bet.gameData.awayScore > bet.gameData.homeScore ? 'AWAY' : 'TIE';
          const team = bet.team === bet.gameData.homeTeamAbbr ? 'HOME' : 'AWAY';
          won = actualWinner === team;
          debug = `ML bet on ${bet.team} (${team}), actual winner: ${actualWinner}`;
          break;

        case 'spread':
          const actualMargin = bet.gameData.homeScore - bet.gameData.awayScore;
          const homeCovers = actualMargin + bet.gameData.bettingLines.spread > 0;
          if (bet.betText.includes(bet.gameData.homeTeamAbbr)) {
            won = homeCovers;
          } else if (bet.betText.includes(bet.gameData.awayTeamAbbr)) {
            won = !homeCovers;
          }
          debug = `Spread bet: ${bet.betText}, margin: ${actualMargin}, homeCovers: ${homeCovers}, won: ${won}`;
          break;

        case 'total':
          const actualTotal = bet.gameData.homeScore + bet.gameData.awayScore;
          const side = bet.prediction.toUpperCase();
          if (side === 'OVER') {
            won = actualTotal > bet.gameData.bettingLines.total;
          } else {
            won = actualTotal < bet.gameData.bettingLines.total;
          }
          debug = `Total bet: ${bet.prediction} ${bet.total}, actual: ${actualTotal}, won: ${won}`;
          break;
      }

      if (won) {
        results.wins++;
        results.byType[bet.type].wins++;
        const unitsWon = bet.type === 'moneyline' && bet.odds ? calculateUnitsFromOdds(bet.odds, true) : 1;
        results.totalUnits += unitsWon;
        results.byType[bet.type].units += unitsWon;
      } else {
        results.losses++;
        results.totalUnits -= 1;
        results.byType[bet.type].units -= 1;
      }

      results.detailedResults.push({
        game: bet.game,
        week: bet.week,
        bet: bet.betText,
        type: bet.type,
        result: won ? 'WIN' : 'LOSS',
        won: won,
        actualScore: `${bet.gameData.awayTeamAbbr} ${bet.gameData.awayScore} - ${bet.gameData.homeScore} ${bet.gameData.homeTeamAbbr}`,
        debug: debug,
        units: won ? (bet.type === 'moneyline' && bet.odds ? calculateUnitsFromOdds(bet.odds, true) : 1) : -1
      });
    });

    return results;
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

  const tallyDisplayedFireEmojis = async () => {
    const results = {
      totalBets: 0,
      wins: 0,
      losses: 0,
      totalUnits: 0,
      byType: {
        moneyline: { bets: 0, wins: 0, losses: 0, units: 0 },
        spread: { bets: 0, wins: 0, losses: 0, units: 0 },
        total: { bets: 0, wins: 0, losses: 0, units: 0 }
      },
      detailedResults: []
    };

    // Use the EXACT same logic as the debug area to find fire emoji bets
    const completedGames = await getCompletedGamesForAnalysis();

    console.log('📊 TALLYING: Processing', completedGames.length, 'completed games for fire emoji bets');

    completedGames.forEach(game => {
      if (!game.isCompleted || game.homeScore === null || game.awayScore === null) {
        return;
      }

      // Debug the first few games to see what data structure we have
      if (results.totalBets === 0) {
        const debugInfo = {
          game: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
          hasAnalysis: !!game.analysis,
          hasProbabilities: !!game.analysis?.probabilities,
          hasMoneyline: !!game.analysis?.probabilities?.moneyline,
          hasSpread: !!game.analysis?.probabilities?.spread,
          hasTotal: !!game.analysis?.probabilities?.total,
          hasBettingLines: !!game.bettingLines,
          homeMoneyline: game.bettingLines?.homeMoneyline,
          awayMoneyline: game.bettingLines?.awayMoneyline,
          analysis: game.analysis,
          bettingLines: game.bettingLines
        };
        console.log('🔍 FIRE EMOJI DEBUG: Sample game structure:', debugInfo);
        window.fireEmojiDebugInfo = debugInfo;
      }

      // Use detectFireEmojiBets to get EXACTLY the same bets as Dashboard shows
      const fireEmojiBets = detectFireEmojiBets(game);
      const bets = fireEmojiBets.map(fireBet => ({
        type: fireBet.type,
        bet: `${fireBet.type === 'moneyline' ? 'ML' : fireBet.type === 'spread' ? 'Spread' : 'Total'}: ${fireBet.betText}`,
        betText: fireBet.betText,
        team: fireBet.team || fireBet.teamName,
        odds: fireBet.odds,
        recommendation: fireBet.recommendation,
        prediction: fireBet.prediction,
        total: fireBet.total,
        predictedTotal: fireBet.predictedTotal,
        edge: fireBet.edge,
        spread: fireBet.spread
      }));

      // Debug message for WAS @ GB game to verify bet text (corrected format)
      if (game.awayTeamAbbr === 'WAS' && game.homeTeamAbbr === 'GB' && bets.length > 0) {
        console.log(`🔍 WAS @ GB SPREAD CHECK:`, bets.filter(bet => bet.type === 'spread').map(bet => ({
          betText: bet.betText,
          recommendation: bet.recommendation,
          type: bet.type,
          originalBet: bet.bet
        })));
        console.log(`🔍 WAS @ GB ALL BETS:`, bets.map(bet => ({
          betText: bet.betText,
          type: bet.type,
          originalBet: bet.bet
        })));
      }


      // Now calculate win/loss for each bet using EXACT same logic as debug area
      const actualWinner = game.homeScore > game.awayScore ? 'HOME' : game.awayScore > game.homeScore ? 'AWAY' : 'TIE';
      const actualMargin = game.homeScore - game.awayScore;
      const actualTotal = game.homeScore + game.awayScore;

      bets.forEach(bet => {
        results.totalBets++;
        results.byType[bet.type].bets++;

        let won = false;
        if (bet.bet.includes('ML:')) {
          const team = bet.bet.includes(game.homeTeamAbbr) ? 'HOME' : 'AWAY';
          won = actualWinner === team;
        } else if (bet.bet.includes('Spread:')) {
          const betText = bet.bet.split('Spread: ')[1];
          const homeCovers = actualMargin + game.bettingLines.spread > 0;
          if (betText.includes(game.homeTeamAbbr)) {
            won = homeCovers;
          } else if (betText.includes(game.awayTeamAbbr)) {
            won = !homeCovers;
          }
        } else if (bet.bet.includes('Total:')) {
          const side = bet.bet.includes('Over') ? 'OVER' : 'UNDER';
          if (side === 'OVER') {
            won = actualTotal > game.bettingLines.total;
          } else {
            won = actualTotal < game.bettingLines.total;
          }
        }

        if (won) {
          results.wins++;
          results.byType[bet.type].wins++;
          const unitsWon = bet.type === 'moneyline' && bet.odds ? calculateUnitsFromOdds(bet.odds, true) : 1;
          results.totalUnits += unitsWon;
          results.byType[bet.type].units += unitsWon;
        } else {
          results.losses++;
          results.byType[bet.type].losses++;
          results.totalUnits -= 1;
          results.byType[bet.type].units -= 1;
        }

        // Add detailed debug information for each bet
        let debugInfo = `${bet.bet} -> ${won ? 'WIN' : 'LOSS'}`;
        if (bet.type === 'moneyline') {
          debugInfo += ` (${actualWinner === (bet.team === game.homeTeamAbbr ? 'HOME' : 'AWAY') ? 'Correct' : 'Incorrect'} winner prediction)`;
        } else if (bet.type === 'spread') {
          const actualMargin = game.homeScore - game.awayScore;
          const homeCovers = actualMargin + game.bettingLines.spread > 0;
          debugInfo += ` (Margin: ${actualMargin}, Home covers: ${homeCovers}, Bet on: ${bet.recommendation})`;
        } else if (bet.type === 'total') {
          const actualTotal = game.homeScore + game.awayScore;
          debugInfo += ` (Predicted: ${bet.predictedTotal?.toFixed(1)}, Actual: ${actualTotal}, Line: ${bet.total})`;
        }

        results.detailedResults.push({
          game: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
          week: game.week,
          bet: bet.bet,
          type: bet.type,
          result: won ? 'WIN' : 'LOSS',
          won: won,
          actualScore: `${game.awayTeamAbbr} ${game.awayScore} - ${game.homeScore} ${game.homeTeamAbbr}`,
          units: won ? (bet.type === 'moneyline' && bet.odds ? calculateUnitsFromOdds(bet.odds, true) : 1) : -1,
          debug: debugInfo,
          actualWinner: actualWinner,
          actualMargin: actualMargin,
          actualTotal: actualTotal
        });
      });
    });

    console.log('📊 TALLY RESULTS:', results);

    // Store detailed results globally for debug display
    window.fireEmojiBetResults = fireEmojiResults;
    window.fireEmojiDetailedBets = fireEmojiResults.detailedResults;

    // Store summary for debug display using unified results
    const summaryMsg = `🎯 FIRE EMOJI BET SUMMARY:\nTotal Bets: ${fireEmojiResults.totalBets}\nWins: ${fireEmojiResults.wins}\nLosses: ${fireEmojiResults.losses}\nWin Rate: ${fireEmojiResults.totalBets > 0 ? ((fireEmojiResults.wins / fireEmojiResults.totalBets) * 100).toFixed(1) : 0}%\nUnits: ${fireEmojiResults.totalUnits.toFixed(2)}\n\nBy Type:\nMoneyline: ${fireEmojiResults.byType.moneyline.wins}W-${fireEmojiResults.byType.moneyline.losses}L (${fireEmojiResults.byType.moneyline.bets} bets)\nSpread: ${fireEmojiResults.byType.spread.wins}W-${fireEmojiResults.byType.spread.losses}L (${fireEmojiResults.byType.spread.bets} bets)\nTotal: ${fireEmojiResults.byType.total.wins}W-${fireEmojiResults.byType.total.losses}L (${fireEmojiResults.byType.total.bets} bets)`;

    console.log(summaryMsg);
    window.fireEmojiBetSummary = summaryMsg;

    return fireEmojiResults;
  };

  return (
    <div className="performance-simple-horizontal">
      <div className="perf-metric">
        <div className="perf-label">Total Units</div>
        <div className="perf-value positive">
          {loading ? '...' : performanceData ?
            `${performanceData.totalUnits >= 0 ? '+' : ''}${performanceData.totalUnits.toFixed(2)}`
            : '+0.00'}
        </div>
      </div>
      <div className="perf-metric">
        <div className="perf-label">Record</div>
        <div className="perf-value neutral">
          {loading ? '...' : performanceData ?
            `${performanceData.edgeWins}-${performanceData.edgeLosses}-0`
            : '0-0-0'}
        </div>
      </div>
      <div className="perf-metric">
        <div className="perf-label">ROI</div>
        <div className="perf-value positive">
          {loading ? '...' : performanceData ?
            `+${performanceData.totalBets > 0
              ? ((performanceData.totalUnits / performanceData.totalBets) * 100).toFixed(2)
              : '0.00'}%`
            : '+0.00%'}
        </div>
      </div>
    </div>
  )
}

export default Performance
