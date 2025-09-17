import { calculateAdvancedSpreadProb } from './advancedSpreadModel'
import { analyzeGame } from './poissonModel'

/**
 * Unified Fire Emoji Bet Detection
 * This utility provides the EXACT same logic used by the Dashboard to show 🔥
 * so the Performance page can accurately tally wins and losses.
 */

export const detectFireEmojiBets = (game) => {
  const fireBets = []

  // Debug tracking
  if (game.awayTeamAbbr === 'WAS' && game.homeTeamAbbr === 'GB') {
    console.log('🔥 FIRE EMOJI DETECTOR CALLED for WAS @ GB');
    window.fireEmojiDetectorCalled = `Called for WAS @ GB - Week ${game.week}`;
  }

  // 1. MONEYLINE FIRE EMOJI DETECTION
  // Copy the exact logic from Dashboard.jsx lines 546-603
  if (game.analysis?.probabilities?.moneyline && game.bettingLines?.homeMoneyline && game.bettingLines?.awayMoneyline) {
    const homeWinProb = (game.analysis.probabilities.moneyline.homeWinProb || 0) * 100
    const awayWinProb = (game.analysis.probabilities.moneyline.awayWinProb || 0) * 100

    // Safe implied probability calculation with null checks
    const getImpliedProb = (odds) => {
      if (!odds || odds === 0) return 50
      return odds > 0 ? (100 / (odds + 100)) * 100 : (Math.abs(odds) / (Math.abs(odds) + 100)) * 100
    }

    const homeImplied = getImpliedProb(game.bettingLines.homeMoneyline)
    const awayImplied = getImpliedProb(game.bettingLines.awayMoneyline)

    const homeBaseEdge = homeWinProb - homeImplied
    const awayBaseEdge = awayWinProb - awayImplied

    // Apply pattern bonuses (simplified)
    let mlQualityBonus = 0
    let mlPatternMatch = false
    if (game.gameContext?.isDivisionGame && game.bettingLines.awayMoneyline >= 180 && game.bettingLines.awayMoneyline <= 350) {
      if (awayBaseEdge > 2) {
        mlQualityBonus += 4.5
        mlPatternMatch = true
      }
    }
    if (game.bettingLines.homeMoneyline >= 200 && homeBaseEdge > 3) {
      mlQualityBonus += 4.2
      mlPatternMatch = true
    }
    if (game.bettingLines.awayMoneyline >= 200 && awayBaseEdge > 3) {
      mlQualityBonus += 4.2
      mlPatternMatch = true
    }

    const adjustedHomeMLEdge = homeBaseEdge + (homeBaseEdge > 0 ? mlQualityBonus : 0)
    const adjustedAwayMLEdge = awayBaseEdge + (awayBaseEdge > 0 ? mlQualityBonus : 0)
    const mlMinEdge = mlPatternMatch ? 5.5 : 8.5

    // Check if we would actually bet
    const homeMLBet = adjustedHomeMLEdge >= mlMinEdge &&
      !(game.bettingLines.homeMoneyline >= -180 && game.bettingLines.homeMoneyline <= -120)
    const awayMLBet = adjustedAwayMLEdge >= mlMinEdge &&
      !(game.bettingLines.awayMoneyline >= -180 && game.bettingLines.awayMoneyline <= -120)

    if (homeMLBet) {
      fireBets.push({
        type: 'moneyline',
        team: game.homeTeamAbbr,
        teamName: game.homeTeam,
        odds: game.bettingLines.homeMoneyline,
        edge: adjustedHomeMLEdge,
        betText: `${game.homeTeamAbbr} ML ${game.bettingLines.homeMoneyline}`
      })
    }

    if (awayMLBet) {
      fireBets.push({
        type: 'moneyline',
        team: game.awayTeamAbbr,
        teamName: game.awayTeam,
        odds: game.bettingLines.awayMoneyline,
        edge: adjustedAwayMLEdge,
        betText: `${game.awayTeamAbbr} ML ${game.bettingLines.awayMoneyline}`
      })
    }
  }

  // 2. SPREAD FIRE EMOJI DETECTION
  // Copy the exact logic from Dashboard.jsx lines 628-691
  if (game.analysis?.probabilities?.spread) {
    try {
      // Use EXACT same logic as Dashboard - fix function call parameters
      const spreadAnalysis = calculateAdvancedSpreadProb(
        game.homeTeamStats,
        game.awayTeamStats,
        game.bettingLines?.spread,
        game.gameContext
      )

      // Debug for specific games
      if (game.awayTeamAbbr === 'WAS' && game.homeTeamAbbr === 'GB') {
        const debugInfo = {
          hasSpreadProb: !!game.analysis?.probabilities?.spread,
          spreadAnalysis: spreadAnalysis,
          recommendation: spreadAnalysis?.recommendation,
          willAddBet: !!(spreadAnalysis.recommendation && spreadAnalysis.recommendation !== 'PASS'),
          gameIsCompleted: game.isCompleted,
          homeScore: game.homeScore,
          awayScore: game.awayScore
        };
        console.log('🔍 WAS @ GB SPREAD ANALYSIS:', debugInfo);
        window.wasGBSpreadDebugInfo = debugInfo;
      }

      if (spreadAnalysis.recommendation && spreadAnalysis.recommendation !== 'PASS') {
        // EXACT COPY FROM DASHBOARD.JSX - Fire emoji spread logic
        let spreadText;
        if (game.isCompleted && game.homeScore !== null && game.awayScore !== null) {
          // For completed games, show the WINNING side, not our prediction
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
            const homeSpread = game.bettingLines.spread > 0 ? -game.bettingLines.spread : Math.abs(game.bettingLines.spread);
            spreadText = homeSpread >= 0
              ? `${game.homeTeamAbbr} +${homeSpread}`
              : `${game.homeTeamAbbr} ${homeSpread}`;
          } else {
            const awaySpread = game.bettingLines.spread > 0 ? game.bettingLines.spread : -Math.abs(game.bettingLines.spread);
            spreadText = awaySpread >= 0
              ? `${game.awayTeamAbbr} +${awaySpread}`
              : `${game.awayTeamAbbr} ${awaySpread}`;
          }
        }

        fireBets.push({
          type: 'spread',
          team: spreadAnalysis.recommendation === 'HOME' ? game.homeTeamAbbr : game.awayTeamAbbr,
          teamName: spreadAnalysis.recommendation === 'HOME' ? game.homeTeam : game.awayTeam,
          recommendation: spreadAnalysis.recommendation,
          spread: game.bettingLines.spread,
          betText: spreadText
        })
      }
    } catch (error) {
      console.warn('Error calculating spread analysis for fire emoji detection:', error)
    }
  }

  // 3. TOTAL FIRE EMOJI DETECTION
  // Copy the exact logic from Dashboard.jsx lines 703-731
  if (game.analysis?.probabilities?.total) {
    const overProb = game.analysis.probabilities.total.overProb * 100
    const underProb = game.analysis.probabilities.total.underProb * 100
    const predictedTotal = game.analysis.expectedPoints.home + game.analysis.expectedPoints.away

    // Same criteria as Dashboard: bet if predicted total differs by 3+ points
    const hasTotalEdge = Math.abs(predictedTotal - game.bettingLines.total) >= 3

    // Debug for specific games
    if (game.awayTeamAbbr === 'WAS' && game.homeTeamAbbr === 'GB') {
      console.log('🔍 WAS @ GB TOTAL ANALYSIS:', {
        hasTotalProb: !!game.analysis?.probabilities?.total,
        overProb: overProb,
        underProb: underProb,
        predictedTotal: predictedTotal,
        lineTotal: game.bettingLines.total,
        difference: Math.abs(predictedTotal - game.bettingLines.total),
        hasTotalEdge: hasTotalEdge,
        willAddBet: hasTotalEdge
      });
    }

    if (hasTotalEdge) {
      const prediction = predictedTotal > game.bettingLines.total ? 'Over' : 'Under'

      fireBets.push({
        type: 'total',
        prediction: prediction,
        total: game.bettingLines.total,
        predictedTotal: predictedTotal,
        edge: Math.abs(predictedTotal - game.bettingLines.total),
        betText: `${prediction} ${game.bettingLines.total}`
      })
    }
  }

  return fireBets
}

/**
 * Calculate if a fire emoji bet won or lost based on actual game results
 * Uses the EXACT same logic as Dashboard debug panel
 */
export const calculateFireBetResult = (fireBet, game) => {
  if (!game.isCompleted || game.homeScore === null || game.awayScore === null) {
    return { result: 'PENDING', won: null }
  }

  const actualScore = `${game.awayTeamAbbr} ${game.awayScore} - ${game.homeScore} ${game.homeTeamAbbr}`

  switch (fireBet.type) {
    case 'moneyline':
      // Use exact same logic as Dashboard debug (lines 885-896)
      const actualWinner = game.homeScore > game.awayScore ? 'HOME' :
                          game.awayScore > game.homeScore ? 'AWAY' : 'TIE'
      const team = fireBet.team === game.homeTeamAbbr ? 'HOME' : 'AWAY'
      const won = actualWinner === team
      return {
        result: won ? 'WIN' : 'LOSS',
        won: won,
        actualScore: actualScore,
        actualWinner: actualWinner,
        debug: `ML bet on ${fireBet.team} (${team}), actual winner: ${actualWinner}`
      }

    case 'spread':
      // Use exact same logic as Dashboard debug (lines 904-916)
      const actualMargin = game.homeScore - game.awayScore
      const homeCovers = actualMargin + game.bettingLines.spread > 0

      // Extract team from bet text like Dashboard does
      let spreadWon = false
      if (fireBet.betText.includes(game.homeTeamAbbr)) {
        // Bet shows home team - win if home covered
        spreadWon = homeCovers
      } else if (fireBet.betText.includes(game.awayTeamAbbr)) {
        // Bet shows away team - win if away covered
        spreadWon = !homeCovers
      }

      return {
        result: spreadWon ? 'WIN' : 'LOSS',
        won: spreadWon,
        actualScore: actualScore,
        actualMargin: actualMargin,
        homeCovers: homeCovers,
        debug: `Spread bet: ${fireBet.betText}, margin: ${actualMargin}, homeCovers: ${homeCovers}, won: ${spreadWon}`
      }

    case 'total':
      // Use exact same logic as Dashboard debug (lines 922-929)
      const actualTotal = game.homeScore + game.awayScore
      const side = fireBet.prediction.toUpperCase()
      let totalWon = false
      if (side === 'OVER') {
        totalWon = actualTotal > game.bettingLines.total
      } else {
        totalWon = actualTotal < game.bettingLines.total
      }

      return {
        result: totalWon ? 'WIN' : 'LOSS',
        won: totalWon,
        actualScore: actualScore,
        actualTotal: actualTotal,
        lineTotal: fireBet.total,
        debug: `Total bet: ${fireBet.prediction} ${fireBet.total}, actual: ${actualTotal}, won: ${totalWon}`
      }

    default:
      return { result: 'ERROR', won: null }
  }
}

/**
 * Calculate units won/lost based on American odds
 */
export const calculateUnitsFromOdds = (americanOdds, won, stake = 1) => {
  if (!won) return -stake // Lost the bet

  if (!americanOdds || americanOdds === 0) return 0

  if (americanOdds > 0) {
    // Positive odds: win amount = (odds/100) * stake
    return (americanOdds / 100) * stake
  } else {
    // Negative odds: win amount = (100/abs(odds)) * stake
    return (100 / Math.abs(americanOdds)) * stake
  }
}

/**
 * Get all fire emoji bets from completed games and calculate their results
 */
export const analyzeCompletedFireBets = (completedGames) => {
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
  }

  for (const game of completedGames) {
    const fireBets = detectFireEmojiBets(game)

    for (const bet of fireBets) {
      const result = calculateFireBetResult(bet, game)

      results.totalBets++
      results.byType[bet.type].bets++

      if (result.won === true) {
        results.wins++
        results.byType[bet.type].wins++

        // Calculate units won for moneyline bets (spread and total use standard -110)
        let unitsWon = 1 // Default for spread/total wins
        if (bet.type === 'moneyline' && bet.odds) {
          unitsWon = calculateUnitsFromOdds(bet.odds, true)
        }
        results.totalUnits += unitsWon
        results.byType[bet.type].units += unitsWon

      } else if (result.won === false) {
        results.losses++
        results.byType[bet.type].losses++
        results.totalUnits -= 1 // Lost 1 unit
        results.byType[bet.type].units -= 1
      }

      results.detailedResults.push({
        game: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`,
        week: game.week,
        bet: bet.betText,
        type: bet.type,
        result: result.result,
        won: result.won,
        actualScore: result.actualScore,
        debug: result.debug || '',
        units: result.won === true ? (bet.type === 'moneyline' && bet.odds ? calculateUnitsFromOdds(bet.odds, true) : 1) :
               result.won === false ? -1 : 0
      })
    }
  }

  return results
}