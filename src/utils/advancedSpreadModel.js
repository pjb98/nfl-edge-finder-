// Advanced NFL Spread Analysis Model
// Based on historical patterns and key performance indicators

// Key NFL Spread Betting Patterns & Factors
export function analyzeSpreadFactors(homeTeam, awayTeam, spread, gameContext = {}) {
  const factors = {
    strengthDifferential: 0,
    restAdvantage: 0,
    revengeSpot: 0,
    publicBetting: 0,
    weatherImpact: 0,
    motivationalEdge: 0,
    coachingEdge: 0,
    injuryImpact: 0,
    trendAnalysis: 0
  }

  // 1. TRUE STRENGTH DIFFERENTIAL (most important factor)
  const homeStrength = calculateTrueStrength(homeTeam)
  const awayStrength = calculateTrueStrength(awayTeam)
  const trueSpread = (homeStrength - awayStrength) + 2.5 // Home field advantage
  
  factors.strengthDifferential = Math.abs(trueSpread - spread)

  // 2. REST/TRAVEL ADVANTAGE
  if (gameContext.restDays) {
    const restDiff = gameContext.homeRestDays - gameContext.awayRestDays
    if (Math.abs(restDiff) >= 3) {
      factors.restAdvantage = restDiff > 0 ? 1.5 : -1.5 // Favor rested team
    }
  }

  // 3. DIVISIONAL/REVENGE SPOTS
  if (gameContext.isDivisionGame) {
    factors.revengeSpot = 0.8 // Division games typically closer
  }
  
  if (gameContext.isRevenge) {
    factors.revengeSpot += 1.2 // Revenge games have extra motivation
  }

  // 4. PUBLIC BETTING PATTERNS
  // When public heavily backs favorites, fade them
  if (Math.abs(spread) >= 7) {
    factors.publicBetting = spread > 0 ? -0.8 : 0.8 // Fade heavy favorites
  }

  // 5. WEATHER IMPACT ON SPREADS
  if (gameContext.weather) {
    const weather = gameContext.weather
    if (weather.temperature < 32 || weather.windSpeed > 20 || weather.precipitation) {
      // Bad weather typically helps underdogs (reduces variance)
      factors.weatherImpact = spread > 0 ? -1.0 : 1.0
    }
  }

  // 6. SITUATIONAL MOTIVATION
  if (gameContext.playoffImplications) {
    if (gameContext.homePlayoffNeed > gameContext.awayPlayoffNeed) {
      factors.motivationalEdge = 1.5
    } else if (gameContext.awayPlayoffNeed > gameContext.homePlayoffNeed) {
      factors.motivationalEdge = -1.5
    }
  }

  // 7. COACHING MATCHUP
  if (gameContext.homeCoachRating && gameContext.awayCoachRating) {
    const coachDiff = gameContext.homeCoachRating - gameContext.awayCoachRating
    factors.coachingEdge = coachDiff * 0.5
  }

  // 8. KEY INJURY IMPACT
  if (gameContext.injuries) {
    let injuryImpact = 0
    gameContext.injuries.forEach(injury => {
      const impact = getInjuryImpact(injury)
      injuryImpact += injury.team === 'home' ? -impact : impact
    })
    factors.injuryImpact = injuryImpact
  }

  // 9. RECENT TREND ANALYSIS
  factors.trendAnalysis = analyzeTrends(homeTeam, awayTeam, gameContext)

  return factors
}

function calculateTrueStrength(team) {
  // More sophisticated strength calculation
  const offensiveRating = (team.avgPointsScored || 22.5) * 
                          (team.yardsPerPlay || 5.5) / 5.5 *
                          (team.redZoneEfficiency || 0.55) / 0.55

  const defensiveRating = 45 - (team.avgPointsAllowed || 22.5) * 
                          (5.5 / (team.yardsPerPlayAllowed || 5.5)) *
                          (0.45 / (team.redZoneDefense || 0.45))

  const turnoverRating = (team.turnoverDifferential || 0) * 2.5
  const efficiency = (team.thirdDownConversion || 0.4) - (team.thirdDownDefense || 0.4)

  return offensiveRating + defensiveRating + turnoverRating + (efficiency * 10)
}

function getInjuryImpact(injury) {
  const impactMap = {
    'QB': 4.5,      // Quarterback injury = huge impact
    'RB1': 1.8,     // Starting RB
    'WR1': 2.2,     // #1 WR
    'OL': 1.5,      // Offensive line
    'DE': 1.2,      // Pass rusher
    'CB1': 1.8,     // Top corner
    'LB': 0.8,      // Linebacker
    'S': 1.0        // Safety
  }
  return impactMap[injury.position] || 0.5
}

function analyzeTrends(homeTeam, awayTeam, gameContext) {
  let trendScore = 0
  
  // ATS (Against the Spread) trends would go here
  // This would require historical ATS data
  
  // For now, use basic momentum indicators
  if (gameContext.homeRecentForm && gameContext.awayRecentForm) {
    const homeForm = gameContext.homeRecentForm.slice(0, 3) // Last 3 games
    const awayForm = gameContext.awayRecentForm.slice(0, 3)
    
    const homeMomentum = homeForm.reduce((sum, game) => 
      sum + (game.covered ? 1 : -1), 0) / homeForm.length
    const awayMomentum = awayForm.reduce((sum, game) => 
      sum + (game.covered ? 1 : -1), 0) / awayForm.length
      
    trendScore = (homeMomentum - awayMomentum) * 1.2
  }
  
  return trendScore
}

// Advanced spread probability calculation (original version)
function calculateAdvancedSpreadProbOriginal(homeTeam, awayTeam, spread, gameContext = {}) {
  // Get all the factors
  const factors = analyzeSpreadFactors(homeTeam, awayTeam, spread, gameContext)
  
  // Calculate base probability using enhanced Poisson
  const homeRate = calculateAdjustedRate(homeTeam, awayTeam, gameContext, 'home')
  const awayRate = calculateAdjustedRate(awayTeam, homeTeam, gameContext, 'away')
  
  // Generate score probabilities with realistic variance
  const variance = calculateGameVariance(homeTeam, awayTeam, gameContext)
  const scoreProbabilities = generateScoreProbabilities(homeRate, awayRate, variance)
  
  // Calculate raw spread probabilities
  let homeCoverProb = 0
  let awayCoverProb = 0
  
  Object.entries(scoreProbabilities).forEach(([scoreString, probability]) => {
    const [homeScore, awayScore] = scoreString.split('-').map(Number)
    const margin = homeScore - awayScore
    const adjustedMargin = margin + spread
    
    if (adjustedMargin > 0) {
      homeCoverProb += probability
    } else if (adjustedMargin < 0) {
      awayCoverProb += probability
    }
    // Push scenarios ignored for simplicity
  })

  // Apply factor-based adjustments
  const totalFactorImpact = 
    factors.strengthDifferential * 0.25 +
    factors.restAdvantage * 0.15 +
    factors.revengeSpot * 0.12 +
    factors.publicBetting * 0.10 +
    factors.weatherImpact * 0.08 +
    factors.motivationalEdge * 0.10 +
    factors.coachingEdge * 0.08 +
    factors.injuryImpact * 0.12 +
    factors.trendAnalysis * 0.10

  // Adjust probabilities based on factors (max 15% adjustment)
  const maxAdjustment = 0.15
  const adjustment = Math.max(-maxAdjustment, Math.min(maxAdjustment, totalFactorImpact * 0.01))
  
  const adjustedHomeCover = Math.max(0.1, Math.min(0.9, homeCoverProb + adjustment))
  const adjustedAwayCover = Math.max(0.1, Math.min(0.9, awayCoverProb - adjustment))
  
  // Normalize to ensure they sum to ~1
  const total = adjustedHomeCover + adjustedAwayCover
  
  return {
    homeWinProb: adjustedHomeCover / total,
    awayWinProb: adjustedAwayCover / total,
    factors,
    confidence: calculateConfidence(factors, variance),
    recommendation: getRecommendation(factors, adjustedHomeCover / total, adjustedAwayCover / total, spread)
  }
}

function calculateAdjustedRate(team, opponent, gameContext, side) {
  let baseRate = team.avgPointsScored || 22.5
  
  // Defensive adjustment
  const oppDefRating = opponent.defensiveRating || 1.0
  baseRate *= oppDefRating
  
  // Home field advantage
  if (side === 'home') {
    let homeAdvantage = 2.5
    if (gameContext.weather?.temperature < 32) homeAdvantage += 0.5
    if (gameContext.isDivisionGame) homeAdvantage += 0.3
    baseRate += homeAdvantage
  }
  
  // Weather adjustments
  if (gameContext.weather) {
    if (gameContext.weather.temperature < 32) baseRate *= 0.95
    if (gameContext.weather.windSpeed > 15) baseRate *= 0.92
    if (gameContext.weather.precipitation) baseRate *= 0.88
  }
  
  // Pace adjustment
  if (team.pace) {
    baseRate *= team.pace
  }
  
  return Math.max(10, baseRate) // Minimum 10 points
}

function calculateGameVariance(homeTeam, awayTeam, gameContext) {
  let baseVariance = 0.16
  
  // Weather increases variance
  if (gameContext.weather) {
    if (gameContext.weather.windSpeed > 20) baseVariance += 0.03
    if (gameContext.weather.precipitation) baseVariance += 0.02
  }
  
  // Division games are typically closer (less variance)
  if (gameContext.isDivisionGame) baseVariance -= 0.02
  
  // Playoff implications can increase variance
  if (gameContext.playoffImplications) baseVariance += 0.02
  
  return Math.max(0.10, Math.min(0.25, baseVariance))
}

function generateScoreProbabilities(homeRate, awayRate, variance) {
  const probabilities = {}
  const maxScore = 55
  
  // Adjusted Poisson with variance
  const homeVariance = homeRate * (1 + variance)
  const awayVariance = awayRate * (1 + variance)
  
  for (let h = 0; h <= maxScore; h++) {
    for (let a = 0; a <= maxScore; a++) {
      const key = `${h}-${a}`
      probabilities[key] = poissonPMF(homeVariance, h) * poissonPMF(awayVariance, a)
    }
  }
  
  return probabilities
}

function poissonPMF(lambda, k) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k)
}

function factorial(n) {
  if (n <= 1) return 1
  return n * factorial(n - 1)
}

function calculateConfidence(factors, variance) {
  // Higher confidence when multiple factors align
  const factorAlignment = Math.abs(
    factors.strengthDifferential +
    factors.restAdvantage +
    factors.motivationalEdge +
    factors.injuryImpact
  )
  
  // Lower variance = higher confidence
  const varianceConfidence = (0.25 - variance) / 0.15
  
  const totalConfidence = (factorAlignment * 0.4 + varianceConfidence * 0.6)
  
  if (totalConfidence > 2.5) return 'high'
  if (totalConfidence > 1.5) return 'medium'
  return 'low'
}

function getRecommendation(factors, homeCoverProb, awayCoverProb, spread) {
  const threshold = 0.58 // Need 58%+ probability for recommendation
  
  if (homeCoverProb >= threshold) {
    return {
      side: 'home',
      team: spread < 0 ? 'favorite' : 'underdog',
      probability: homeCoverProb,
      reasoning: generateReasoning(factors, 'home')
    }
  }
  
  if (awayCoverProb >= threshold) {
    return {
      side: 'away',
      team: spread > 0 ? 'favorite' : 'underdog',  
      probability: awayCoverProb,
      reasoning: generateReasoning(factors, 'away')
    }
  }
  
  return {
    side: 'none',
    reasoning: 'No significant edge detected'
  }
}

function generateReasoning(factors, side) {
  const reasons = []
  
  if (Math.abs(factors.strengthDifferential) > 2) {
    reasons.push('Significant strength mismatch')
  }
  
  if (Math.abs(factors.restAdvantage) > 1) {
    reasons.push('Rest advantage')
  }
  
  if (factors.weatherImpact > 0.5) {
    reasons.push('Weather favors play')
  }
  
  if (Math.abs(factors.motivationalEdge) > 1) {
    reasons.push('Motivational edge')
  }
  
  if (Math.abs(factors.injuryImpact) > 2) {
    reasons.push('Key injury impact')
  }
  
  return reasons.join(', ') || 'Statistical edge detected'
}

// Overloaded version to handle game objects (as called from Dashboard.jsx)
export function calculateAdvancedSpreadProb(homeTeamStats, awayTeamStats, gameOrSpread, gameContext = {}) {
  // Handle different call signatures
  if (typeof gameOrSpread === 'object' && gameOrSpread !== null) {
    // Called with game object: calculateAdvancedSpreadProb(homeTeamStats, awayTeamStats, game)
    const game = gameOrSpread;
    const spread = game.bettingLines?.spread || 0;
    const context = game.gameContext || gameContext;

    return calculateAdvancedSpreadProbOriginal(homeTeamStats, awayTeamStats, spread, context);
  } else {
    // Called with spread value: calculateAdvancedSpreadProb(homeTeamStats, awayTeamStats, spread, gameContext)
    const spread = gameOrSpread || 0;
    return calculateAdvancedSpreadProbOriginal(homeTeamStats, awayTeamStats, spread, gameContext);
  }
}
