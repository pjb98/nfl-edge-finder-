// Mathematical utilities for Poisson distribution calculations

// Calculate factorial
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

// Poisson probability mass function
export function poissonProbability(lambda, k) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// Calculate expected team scoring rate
export function calculateExpectedPoints(teamAvgPoints, opponentDefensiveRating, leagueAvg = 22.5) {
  // Fix the defensive rating calculation - should be inverse relationship
  // Lower defensive rating (0.8) = better defense = opponent scores less
  // Higher defensive rating (1.2) = worse defense = opponent scores more
  const adjustedDefensiveImpact = opponentDefensiveRating > 0 ? opponentDefensiveRating : 1.0;
  return teamAvgPoints * adjustedDefensiveImpact;
}

// Generate game score probabilities using Poisson distribution
export function calculateGameProbabilities(homeRate, awayRate, maxScore = 50) {
  const probabilities = {};
  
  for (let homeScore = 0; homeScore <= maxScore; homeScore++) {
    for (let awayScore = 0; awayScore <= maxScore; awayScore++) {
      const key = `${homeScore}-${awayScore}`;
      probabilities[key] = 
        poissonProbability(homeRate, homeScore) * 
        poissonProbability(awayRate, awayScore);
    }
  }
  
  return probabilities;
}

// Calculate moneyline probabilities
export function calculateMoneylineProbabilities(scoreProbabilities) {
  let homeWinProb = 0;
  let awayWinProb = 0;
  let tieProb = 0;
  
  Object.entries(scoreProbabilities).forEach(([scoreString, probability]) => {
    const [homeScore, awayScore] = scoreString.split('-').map(Number);
    
    if (homeScore > awayScore) {
      homeWinProb += probability;
    } else if (awayScore > homeScore) {
      awayWinProb += probability;
    } else {
      tieProb += probability;
    }
  });
  
  return { homeWinProb, awayWinProb, tieProb };
}

// Calculate spread probabilities
export function calculateSpreadProbabilities(scoreProbabilities, spread) {
  let coverProb = 0;
  let notCoverProb = 0;
  
  Object.entries(scoreProbabilities).forEach(([scoreString, probability]) => {
    const [homeScore, awayScore] = scoreString.split('-').map(Number);
    const margin = homeScore - awayScore;
    
    // For home team to cover the spread:
    // - If spread is positive (home favored): margin must be > spread
    // - If spread is negative (home underdog): margin + |spread| must be > 0
    if (spread > 0) {
      // Home team is favored by 'spread' points, they need to win by more than 'spread'
      if (margin > spread) {
        coverProb += probability;
      } else {
        notCoverProb += probability;
      }
    } else {
      // Home team is underdog by |spread| points, they need to lose by less than |spread| (or win)
      if (margin + Math.abs(spread) > 0) {
        coverProb += probability;
      } else {
        notCoverProb += probability;
      }
    }
  });
  
  return { coverProb, notCoverProb };
}

// Calculate over/under probabilities
export function calculateTotalProbabilities(scoreProbabilities, total) {
  let overProb = 0;
  let underProb = 0;
  
  Object.entries(scoreProbabilities).forEach(([scoreString, probability]) => {
    const [homeScore, awayScore] = scoreString.split('-').map(Number);
    const gameTotal = homeScore + awayScore;
    
    if (gameTotal > total) {
      overProb += probability;
    } else if (gameTotal < total) {
      underProb += probability;
    } else {
      // Push - split probability
      overProb += probability / 2;
      underProb += probability / 2;
    }
  });
  
  return { overProb, underProb };
}

// Convert probability to decimal odds
export function probabilityToOdds(probability) {
  return 1 / probability;
}

// Convert decimal odds to probability
export function oddsToProbability(odds) {
  return 1 / odds;
}

// Calculate expected value
export function calculateExpectedValue(probability, odds, stake = 100) {
  const payout = stake * (odds - 1);
  const expectedWin = probability * payout;
  const expectedLoss = (1 - probability) * stake;
  
  return expectedWin - expectedLoss;
}

// Kelly Criterion for optimal bet sizing
export function kellyBetSize(probability, odds, bankroll) {
  const b = odds - 1; // Net odds received
  const p = probability; // Probability of winning
  const q = 1 - p; // Probability of losing
  
  const kellyCriterion = (b * p - q) / b;
  return Math.max(0, kellyCriterion * bankroll);
}

// Complete game analysis
export function analyzeGame(homeTeamStats, awayTeamStats, bettingLines = {}) {
  const leagueAvg = 22.5; // Updated NFL average points per game
  
  // Calculate expected points for each team
  const homeExpectedPoints = calculateExpectedPoints(
    homeTeamStats.avgPointsScored || 22.5,
    awayTeamStats.defensiveRating || 1.0,
    leagueAvg
  );
  
  const awayExpectedPoints = calculateExpectedPoints(
    awayTeamStats.avgPointsScored || 22.5,
    homeTeamStats.defensiveRating || 1.0,
    leagueAvg
  );
  
  // Add home field advantage (typically 2.5-3 points)
  const homeAdvantage = 2.5;
  const adjustedHomePoints = homeExpectedPoints + homeAdvantage;
  
  // Generate score probabilities
  const scoreProbabilities = calculateGameProbabilities(adjustedHomePoints, awayExpectedPoints);
  
  // Calculate market probabilities
  const moneyline = calculateMoneylineProbabilities(scoreProbabilities);
  const spread = bettingLines.spread ? calculateSpreadProbabilities(scoreProbabilities, bettingLines.spread) : null;
  const total = bettingLines.total ? calculateTotalProbabilities(scoreProbabilities, bettingLines.total) : null;
  
  return {
    expectedPoints: {
      home: adjustedHomePoints,
      away: awayExpectedPoints
    },
    probabilities: {
      moneyline,
      spread,
      total
    },
    scoreProbabilities
  };
}