// Utility functions for formatting betting odds and calculating implied probabilities

/**
 * Convert American odds to implied probability percentage
 * @param {number} americanOdds - American odds format (e.g., -110, +200)
 * @returns {number} - Implied probability as a percentage (e.g., 52.38)
 */
export function americanOddsToImpliedProbability(americanOdds) {
  if (!americanOdds || americanOdds === 0) return 50.0;
  
  if (americanOdds > 0) {
    // Positive odds: Probability = 100 / (odds + 100)
    return (100 / (americanOdds + 100)) * 100;
  } else {
    // Negative odds: Probability = |odds| / (|odds| + 100)
    return (Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)) * 100;
  }
}

/**
 * Format American odds with implied probability
 * @param {number} americanOdds - American odds format
 * @returns {string} - Formatted string like "-110 (52.4%)"
 */
export function formatOddsWithProbability(americanOdds) {
  if (!americanOdds || americanOdds === 0) return "EVEN (50.0%)";
  
  const impliedProb = americanOddsToImpliedProbability(americanOdds);
  const formattedOdds = americanOdds > 0 ? `+${americanOdds}` : `${americanOdds}`;
  
  return `${formattedOdds} (${impliedProb.toFixed(1)}%)`;
}

/**
 * Format American odds without probability percentage
 * @param {number} americanOdds - American odds format
 * @returns {string} - Formatted string like "-110"
 */
export function formatOddsOnly(americanOdds) {
  if (!americanOdds || americanOdds === 0) return "EVEN";
  
  return americanOdds > 0 ? `+${americanOdds}` : `${americanOdds}`;
}

/**
 * Calculate the vig (sportsbook edge) from two-way betting lines
 * @param {number} odds1 - First side odds
 * @param {number} odds2 - Second side odds  
 * @returns {number} - Vig percentage
 */
export function calculateVig(odds1, odds2) {
  const prob1 = americanOddsToImpliedProbability(odds1);
  const prob2 = americanOddsToImpliedProbability(odds2);
  
  return (prob1 + prob2) - 100;
}

/**
 * Convert point spread to formatted string with odds
 * @param {number} spread - Point spread (positive for underdog, negative for favorite)
 * @param {number} odds - American odds for the spread bet
 * @returns {string} - Formatted spread like "+3.5 (-110)" or "-7 (+105)"
 */
export function formatSpreadWithOdds(spread, odds = -110) {
  const spreadStr = spread > 0 ? `+${spread}` : `${spread}`;
  const oddsStr = formatOddsOnly(odds);
  
  return `${spreadStr} ${oddsStr}`;
}

/**
 * Convert total (over/under) to formatted string with odds
 * @param {number} total - Total points line
 * @param {number} overOdds - Odds for the over
 * @param {number} underOdds - Odds for the under
 * @returns {object} - Formatted over/under with odds
 */
export function formatTotalWithOdds(total, overOdds = -110, underOdds = -110) {
  return {
    over: `O${total} ${formatOddsWithProbability(overOdds)}`,
    under: `U${total} ${formatOddsWithProbability(underOdds)}`,
    display: `O/U ${total}`
  };
}

/**
 * Convert decimal odds to American odds
 * @param {number} decimal - Decimal odds (e.g., 1.91, 2.50)
 * @returns {number} - American odds
 */
export function decimalToAmerican(decimal) {
  if (decimal >= 2.0) {
    return Math.round((decimal - 1) * 100);
  } else {
    return Math.round(-100 / (decimal - 1));
  }
}

/**
 * Convert probability percentage to American odds
 * @param {number} probability - Probability as percentage (e.g., 52.4)
 * @returns {number} - American odds
 */
export function probabilityToAmerican(probability) {
  if (probability >= 50) {
    return Math.round(-probability / (100 - probability) * 100);
  } else {
    return Math.round((100 - probability) / probability * 100);
  }
}

/**
 * Format moneyline odds for both teams
 * @param {number} homeOdds - Home team moneyline odds
 * @param {number} awayOdds - Away team moneyline odds
 * @returns {object} - Formatted moneyline odds with vig info
 */
export function formatMoneyline(homeOdds, awayOdds) {
  const vig = calculateVig(homeOdds, awayOdds);
  
  return {
    home: formatOddsWithProbability(homeOdds),
    away: formatOddsWithProbability(awayOdds),
    vig: vig.toFixed(1),
    display: `${formatOddsWithProbability(awayOdds)} / ${formatOddsWithProbability(homeOdds)}`
  };
}

/**
 * Get odds color coding based on value
 * @param {number} americanOdds - American odds
 * @returns {string} - CSS class name for styling
 */
export function getOddsColorClass(americanOdds) {
  if (americanOdds >= 200) return 'odds-heavy-underdog';
  if (americanOdds >= 100) return 'odds-underdog';
  if (americanOdds >= -120) return 'odds-slight-favorite';
  if (americanOdds >= -200) return 'odds-favorite';
  return 'odds-heavy-favorite';
}

/**
 * Determine if odds represent good value based on calculated probability
 * @param {number} oddsImpliedProb - Implied probability from odds
 * @param {number} calculatedProb - Our calculated probability
 * @param {number} threshold - Minimum edge threshold (default 5%)
 * @returns {object} - Value analysis
 */
export function analyzeOddsValue(oddsImpliedProb, calculatedProb, threshold = 5) {
  const edge = calculatedProb - oddsImpliedProb;
  
  return {
    hasValue: edge >= threshold,
    edge: edge.toFixed(1),
    recommendation: edge >= threshold ? 'BET' : edge >= 0 ? 'LEAN' : 'PASS'
  };
}