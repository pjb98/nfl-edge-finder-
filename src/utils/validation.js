// Data validation utilities for production safety

export const validateGameData = (game) => {
  if (!game || typeof game !== 'object') {
    return { isValid: false, errors: ['Game data is missing or invalid'] }
  }

  const errors = []
  const required = ['homeTeamId', 'awayTeamId', 'week', 'season']
  
  // Check required fields
  required.forEach(field => {
    if (game[field] === undefined || game[field] === null) {
      errors.push(`Missing required field: ${field}`)
    }
  })

  // Validate team IDs
  if (game.homeTeamId && (typeof game.homeTeamId !== 'number' || game.homeTeamId < 1 || game.homeTeamId > 32)) {
    errors.push('Invalid homeTeamId')
  }
  
  if (game.awayTeamId && (typeof game.awayTeamId !== 'number' || game.awayTeamId < 1 || game.awayTeamId > 32)) {
    errors.push('Invalid awayTeamId')
  }

  // Validate week and season
  if (game.week && (typeof game.week !== 'number' || game.week < 1 || game.week > 22)) {
    errors.push('Invalid week number')
  }

  if (game.season && (typeof game.season !== 'number' || game.season < 2020 || game.season > 2030)) {
    errors.push('Invalid season year')
  }

  // Validate betting lines if present
  if (game.bettingLines && typeof game.bettingLines === 'object') {
    const bettingErrors = validateBettingLines(game.bettingLines)
    errors.push(...bettingErrors)
  }

  // Validate scores if game is completed
  if (game.isCompleted) {
    if (typeof game.homeScore !== 'number' || game.homeScore < 0 || game.homeScore > 100) {
      errors.push('Invalid homeScore for completed game')
    }
    if (typeof game.awayScore !== 'number' || game.awayScore < 0 || game.awayScore > 100) {
      errors.push('Invalid awayScore for completed game')
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export const validateBettingLines = (lines) => {
  const errors = []
  
  // Validate moneylines
  if (lines.homeMoneyline !== undefined && lines.homeMoneyline !== null) {
    if (typeof lines.homeMoneyline !== 'number' || Math.abs(lines.homeMoneyline) < 100 || Math.abs(lines.homeMoneyline) > 2000) {
      errors.push('Invalid homeMoneyline value')
    }
  }
  
  if (lines.awayMoneyline !== undefined && lines.awayMoneyline !== null) {
    if (typeof lines.awayMoneyline !== 'number' || Math.abs(lines.awayMoneyline) < 100 || Math.abs(lines.awayMoneyline) > 2000) {
      errors.push('Invalid awayMoneyline value')
    }
  }

  // Validate spread
  if (lines.spread !== undefined && lines.spread !== null) {
    if (typeof lines.spread !== 'number' || Math.abs(lines.spread) > 30) {
      errors.push('Invalid spread value')
    }
  }

  // Validate total
  if (lines.total !== undefined && lines.total !== null) {
    if (typeof lines.total !== 'number' || lines.total < 20 || lines.total > 80) {
      errors.push('Invalid total points value')
    }
  }

  return errors
}

export const validateTeamStats = (stats) => {
  if (!stats || typeof stats !== 'object') {
    return { isValid: false, errors: ['Team stats are missing or invalid'] }
  }

  const errors = []

  // Validate points scored/allowed
  if (stats.avgPointsScored !== undefined) {
    if (typeof stats.avgPointsScored !== 'number' || stats.avgPointsScored < 0 || stats.avgPointsScored > 60) {
      errors.push('Invalid avgPointsScored')
    }
  }

  if (stats.avgPointsAllowed !== undefined) {
    if (typeof stats.avgPointsAllowed !== 'number' || stats.avgPointsAllowed < 0 || stats.avgPointsAllowed > 60) {
      errors.push('Invalid avgPointsAllowed')
    }
  }

  // Validate defensive rating
  if (stats.defensiveRating !== undefined) {
    if (typeof stats.defensiveRating !== 'number' || stats.defensiveRating < 0.5 || stats.defensiveRating > 2.0) {
      errors.push('Invalid defensiveRating')
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export const validateProbability = (prob) => {
  return typeof prob === 'number' && prob >= 0 && prob <= 1 && !isNaN(prob)
}

export const validateEdge = (edge) => {
  return typeof edge === 'number' && Math.abs(edge) <= 100 && !isNaN(edge)
}

export const sanitizeNumericInput = (value, min = 0, max = 1000, defaultValue = 0) => {
  const num = parseFloat(value)
  if (isNaN(num)) return defaultValue
  return Math.max(min, Math.min(max, num))
}

export const validateAPIResponse = (response, expectedStructure) => {
  try {
    if (!response || typeof response !== 'object') {
      return { isValid: false, error: 'Invalid response format' }
    }

    // Check if response has expected properties
    for (const prop of expectedStructure) {
      if (!(prop in response)) {
        return { isValid: false, error: `Missing property: ${prop}` }
      }
    }

    return { isValid: true }
  } catch (error) {
    return { isValid: false, error: `Validation error: ${error.message}` }
  }
}