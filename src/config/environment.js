// Environment configuration for development vs production
export const isDevelopment = import.meta.env.DEV
export const isProduction = import.meta.env.PROD

export const config = {
  // Show debug logs only in development
  enableDebugLogs: isDevelopment,
  
  // Show 2024 data only in development
  show2024Data: isDevelopment,
  
  // Default season
  defaultSeason: isProduction ? '2025' : '2025',
  
  // Available seasons
  availableSeasons: isProduction ? ['2025'] : ['2024', '2025'],
  
  // API configuration
  api: {
    timeout: 10000, // 10 second timeout
    retries: 3,
    baseURL: isProduction ? 'https://api.nfl-edge-finder.com' : 'http://localhost:5000'
  },
  
  // Performance settings
  performance: {
    enableAnalytics: isProduction,
    lazyLoadThreshold: 1000,
    maxCacheAge: isProduction ? 300000 : 60000 // 5min prod, 1min dev
  },
  
  // Feature flags
  features: {
    enableServiceWorker: isProduction,
    enableErrorReporting: isProduction,
    enablePerformanceMetrics: isProduction
  }
}

// Utility functions
export const debugLog = (...args) => {
  if (config.enableDebugLogs) {
    console.log(...args)
  }
}

export const debugError = (...args) => {
  if (config.enableDebugLogs) {
    console.error(...args)
  }
}