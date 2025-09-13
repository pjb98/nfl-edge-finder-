// Enhanced NFL betting model with advanced analytics
// Incorporates multiple data points and sophisticated edge detection

import { poissonProbability } from './poissonModel.js'

// Enhanced team strength calculation
export function calculateTeamStrength(teamStats, recentForm = [], injuries = [], weather = {}) {
  const baseStrength = {
    offense: teamStats.avgPointsScored || 22.5,
    defense: teamStats.avgPointsAllowed || 22.5,
    efficiency: (teamStats.avgPointsScored || 22.5) / (teamStats.avgPointsAllowed || 22.5)
  }

  // Apply recent form adjustment (last 3-5 games weighted more heavily)
  let formAdjustment = 1.0
  if (recentForm.length > 0) {
    const recentAvg = recentForm.reduce((sum, game) => sum + game.pointsScored, 0) / recentForm.length
    const seasonAvg = teamStats.avgPointsScored || 22.5
    formAdjustment = Math.min(Math.max(recentAvg / seasonAvg, 0.8), 1.3) // Cap adjustments
  }

  // Weather impact (dome games = no impact, cold/wind/rain = reduce offense)
  let weatherAdjustment = 1.0
  if (weather.temperature < 32) weatherAdjustment *= 0.95
  if (weather.windSpeed > 15) weatherAdjustment *= 0.92
  if (weather.precipitation) weatherAdjustment *= 0.90

  // Injury impact (simplified - would need actual injury data)
  let injuryAdjustment = 1.0
  injuries.forEach(injury => {
    if (injury.position === 'QB') injuryAdjustment *= 0.85
    else if (injury.position === 'RB' || injury.position === 'WR') injuryAdjustment *= 0.95
  })

  return {
    adjustedOffense: baseStrength.offense * formAdjustment * weatherAdjustment * injuryAdjustment,
    adjustedDefense: baseStrength.defense,
    efficiency: baseStrength.efficiency * formAdjustment * injuryAdjustment
  }
}

// Advanced Poisson with variance adjustment
export function enhancedPoissonModel(homeRate, awayRate, variance = 0.15) {
  const scoreProbabilities = {}
  const maxScore = 60 // Increased for extreme scenarios
  
  // Add variance to account for game uncertainty
  const homeVariance = homeRate * (1 + variance)
  const awayVariance = awayRate * (1 + variance)
  
  for (let homeScore = 0; homeScore <= maxScore; homeScore++) {
    for (let awayScore = 0; awayScore <= maxScore; awayScore++) {
      const key = `${homeScore}-${awayScore}`
      // Use adjusted rates with variance
      scoreProbabilities[key] = 
        poissonProbability(homeVariance, homeScore) * 
        poissonProbability(awayVariance, awayScore)
    }
  }
  
  return scoreProbabilities
}

// Enhanced spread analysis with multiple factors
export function advancedSpreadAnalysis(scoreProbabilities, spread, gameContext = {}) {
  let homeCoversProb = 0
  let awayCoversProb = 0
  let pushProb = 0
  
  Object.entries(scoreProbabilities).forEach(([scoreString, probability]) => {
    const [homeScore, awayScore] = scoreString.split('-').map(Number)
    const margin = homeScore - awayScore
    const adjustedMargin = margin + spread // Home team perspective
    
    if (adjustedMargin > 0.5) {
      homeCoversProb += probability
    } else if (adjustedMargin < -0.5) {
      awayCoversProb += probability
    } else {
      pushProb += probability
    }
  })

  // Contextual adjustments
  let contextAdjustment = 1.0
  
  // Division games tend to be closer
  if (gameContext.isDivisionGame) {
    const favorite = spread < 0 ? 'home' : 'away'
    if (favorite === 'home') homeCoversProb *= 0.95
    else awayCoversProb *= 0.95
  }
  
  // Playoff implications
  if (gameContext.playoffImplications) {
    contextAdjustment *= 1.05 // Increase variance
  }
  
  // Rest advantage
  if (gameContext.restAdvantage) {
    if (gameContext.restAdvantage === 'home') homeCoversProb *= 1.08
    else awayCoversProb *= 1.08
  }

  return {
    homeWinProb: homeCoversProb * contextAdjustment,
    awayWinProb: awayCoversProb * contextAdjustment,
    pushProb
  }
}

// Enhanced totals analysis with situational factors
export function advancedTotalAnalysis(scoreProbabilities, total, gameContext = {}) {
  let overProb = 0
  let underProb = 0
  let pushProb = 0
  
  Object.entries(scoreProbabilities).forEach(([scoreString, probability]) => {
    const [homeScore, awayScore] = scoreString.split('-').map(Number)
    const gameTotal = homeScore + awayScore
    
    if (gameTotal > total + 0.5) {
      overProb += probability
    } else if (gameTotal < total - 0.5) {
      underProb += probability
    } else {
      pushProb += probability
    }
  })

  // Situational adjustments
  let situationMultiplier = 1.0
  
  // Weather impact on totals
  if (gameContext.weather) {
    const weather = gameContext.weather
    if (weather.temperature < 32 || weather.windSpeed > 20 || weather.precipitation) {
      underProb *= 1.15 // Weather favors under
      overProb *= 0.90
    }
  }
  
  // Pace factors
  if (gameContext.paceFactor) {
    if (gameContext.paceFactor > 1.1) { // Fast pace teams
      overProb *= 1.10
      underProb *= 0.95
    } else if (gameContext.paceFactor < 0.9) { // Slow pace teams
      underProb *= 1.10
      overProb *= 0.95
    }
  }
  
  // Defensive matchup strength
  if (gameContext.defensiveStrength) {
    if (gameContext.defensiveStrength > 1.2) { // Strong defenses
      underProb *= 1.12
      overProb *= 0.92
    }
  }

  return {
    overProb: overProb * situationMultiplier,
    underProb: underProb * situationMultiplier,
    pushProb
  }
}

// Advanced moneyline with motivation and situational factors
export function advancedMoneylineAnalysis(scoreProbabilities, gameContext = {}) {
  let homeWinProb = 0
  let awayWinProb = 0
  let tieProb = 0
  
  Object.entries(scoreProbabilities).forEach(([scoreString, probability]) => {
    const [homeScore, awayScore] = scoreString.split('-').map(Number)
    
    if (homeScore > awayScore) {
      homeWinProb += probability
    } else if (awayScore > homeScore) {
      awayWinProb += probability
    } else {
      tieProb += probability
    }
  })

  // Situational adjustments for moneyline
  if (gameContext.motivation) {
    if (gameContext.motivation === 'home') homeWinProb *= 1.08
    else if (gameContext.motivation === 'away') awayWinProb *= 1.08
  }
  
  // Prime time games (home teams historically perform worse)
  if (gameContext.isPrimeTime) {
    homeWinProb *= 0.96
    awayWinProb *= 1.02
  }
  
  // Coaching matchup
  if (gameContext.coachingEdge) {
    if (gameContext.coachingEdge === 'home') homeWinProb *= 1.05
    else awayWinProb *= 1.05
  }

  return { homeWinProb, awayWinProb, tieProb }
}

// Smart edge detection with dynamic thresholds
export function calculateSmartEdges(modelProb, impliedProb, betType = 'moneyline', confidence = 'medium') {
  // Dynamic thresholds based on bet type and confidence
  const thresholds = {
    moneyline: {
      high: 0.08,    // 8% for high confidence
      medium: 0.05,  // 5% for medium confidence  
      low: 0.03      // 3% for low confidence
    },
    spread: {
      high: 0.06,    // 6% for spreads (more predictable)
      medium: 0.035, // 3.5% for medium confidence
      low: 0.02      // 2% for low confidence
    },
    total: {
      high: 0.07,    // 7% for totals
      medium: 0.04,  // 4% for medium confidence
      low: 0.025     // 2.5% for low confidence
    }
  }
  
  const threshold = thresholds[betType]?.[confidence] || 0.05
  const edge = (modelProb * 100) - (impliedProb * 100)
  
  return {
    edge,
    hasEdge: Math.abs(edge) >= (threshold * 100),
    confidence: Math.abs(edge) >= (threshold * 100 * 1.5) ? 'high' : 
                Math.abs(edge) >= (threshold * 100) ? 'medium' : 'low',
    expectedValue: calculateExpectedValue(modelProb, impliedProb),
    kellyBet: calculateKellyBet(modelProb, impliedProb)
  }
}

// Expected Value calculation
function calculateExpectedValue(trueProb, impliedProb) {
  const decimalOdds = 1 / impliedProb
  const profit = decimalOdds - 1
  return (trueProb * profit) - ((1 - trueProb) * 1)
}

// Kelly Criterion bet sizing
function calculateKellyBet(trueProb, impliedProb, maxKelly = 0.25) {
  const decimalOdds = 1 / impliedProb
  const b = decimalOdds - 1
  const kelly = ((trueProb * decimalOdds) - 1) / b
  return Math.max(0, Math.min(kelly, maxKelly)) // Cap at 25% of bankroll
}

// Comprehensive game analysis with all factors
export function comprehensiveGameAnalysis(homeTeamStats, awayTeamStats, bettingLines, gameContext = {}) {
  // Calculate enhanced team strengths
  const homeStrength = calculateTeamStrength(
    homeTeamStats, 
    gameContext.homeRecentForm, 
    gameContext.homeInjuries, 
    gameContext.weather
  )
  
  const awayStrength = calculateTeamStrength(
    awayTeamStats,
    gameContext.awayRecentForm,
    gameContext.awayInjuries,
    gameContext.weather
  )
  
  // Apply home field advantage (contextual)
  let homeAdvantage = 2.5 // Standard
  if (gameContext.weather?.temperature < 32) homeAdvantage += 0.5 // Cold weather
  if (gameContext.isDivisionGame) homeAdvantage += 0.3 // Division rivalry
  if (gameContext.isPlayoffs) homeAdvantage += 0.8 // Playoff atmosphere
  
  const adjustedHomeRate = homeStrength.adjustedOffense + homeAdvantage
  const adjustedAwayRate = awayStrength.adjustedOffense
  
  // Generate enhanced score probabilities
  const scoreProbabilities = enhancedPoissonModel(
    adjustedHomeRate, 
    adjustedAwayRate, 
    gameContext.variance || 0.15
  )
  
  // Advanced betting market analysis
  const moneylineAnalysis = advancedMoneylineAnalysis(scoreProbabilities, gameContext)
  const spreadAnalysis = bettingLines.spread ? 
    advancedSpreadAnalysis(scoreProbabilities, bettingLines.spread, gameContext) : null
  const totalAnalysis = bettingLines.total ?
    advancedTotalAnalysis(scoreProbabilities, bettingLines.total, gameContext) : null
  
  return {
    teamStrengths: { home: homeStrength, away: awayStrength },
    expectedPoints: { 
      home: adjustedHomeRate, 
      away: adjustedAwayRate,
      homeAdvantage 
    },
    probabilities: {
      moneyline: moneylineAnalysis,
      spread: spreadAnalysis,
      total: totalAnalysis
    },
    scoreProbabilities,
    gameContext
  }
}