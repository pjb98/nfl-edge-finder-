import { useState, useEffect, lazy, Suspense } from 'react'
import './App.css'
import ErrorBoundary from './components/ErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'
import { config } from './config/environment'

// Lazy load components for better performance
const Homepage = lazy(() => import('./components/Homepage'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const Settings = lazy(() => import('./components/Settings'))

function App() {
  // Initialize state from localStorage or defaults
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('nfl-edge-currentView') || 'homepage'
  })
  const [selectedSeason, setSelectedSeason] = useState(() => {
    return localStorage.getItem('nfl-edge-selectedSeason') || config.defaultSeason
  })
  const [selectedWeek, setSelectedWeek] = useState(() => {
    return localStorage.getItem('nfl-edge-selectedWeek') || 'current'
  })

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('nfl-edge-currentView', currentView)
  }, [currentView])

  useEffect(() => {
    localStorage.setItem('nfl-edge-selectedSeason', selectedSeason)
  }, [selectedSeason])

  useEffect(() => {
    localStorage.setItem('nfl-edge-selectedWeek', selectedWeek)
  }, [selectedWeek])

  // Get current NFL week (with Tuesday advancement logic)
  const getCurrentNFLWeek = () => {
    const now = new Date()
    if (selectedSeason === '2024') {
      // 2024 season ended
      return 18
    } else {
      // 2025 season - calculate current week with Tuesday advancement
      const seasonStart = new Date('2025-09-04') // Week 1 start (Thursday)
      if (now < seasonStart) return 1

      // Calculate weeks since season start
      const diffTime = now - seasonStart
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      // Week advances on Tuesday after games (games are Thu/Sun/Mon, advance on Tue)
      // Week 1: Sep 4-10 (advance to Week 2 on Sep 10 Tuesday)
      // Week 2: Sep 11-17 (advance to Week 3 on Sep 17 Tuesday)
      const dayOfWeek = now.getDay() // 0=Sunday, 1=Monday, 2=Tuesday, etc.

      // Calculate base week from days elapsed
      let currentWeek = Math.floor(diffDays / 7) + 1

      // If it's Tuesday or later in the week, and we're past the games, advance
      if (dayOfWeek >= 2) { // Tuesday or later
        const weekStartDate = new Date(seasonStart)
        weekStartDate.setDate(seasonStart.getDate() + (currentWeek - 1) * 7)
        const weekEndDate = new Date(weekStartDate)
        weekEndDate.setDate(weekStartDate.getDate() + 6) // Sunday

        // If we're past the Sunday of the current week and it's Tuesday+, advance
        if (now > weekEndDate && dayOfWeek >= 2) {
          currentWeek += 1
        }
      }

      return Math.min(Math.max(currentWeek, 1), 18)
    }
  }

  const currentNFLWeek = getCurrentNFLWeek()

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <div className="app">
        {currentView !== 'homepage' && (
          <header className="app-header">
            <div className="header-brand">
              <div className="brand-logo">
                <span className="brand-text">NFL Edge Finder</span>
                <span className="brand-token">$NFE</span>
              </div>
              <div className="brand-subtitle">Advanced NFL Analytics Platform</div>
            </div>
            
            <nav className="header-nav">
              <div className="nav-tabs">
                <button
                  className={`nav-tab ${currentView === 'homepage' ? 'active' : ''}`}
                  onClick={() => setCurrentView('homepage')}
                >
                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                      <polyline points="9,22 9,12 15,12 15,22"></polyline>
                    </svg>
                  </span>
                  Home
                </button>
                <button
                  className={`nav-tab ${currentView === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setCurrentView('dashboard')}
                >
                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <path d="M9 9h6v6H9z"></path>
                      <path d="M3 9h6"></path>
                      <path d="M9 21v-6"></path>
                      <path d="M21 9H9"></path>
                    </svg>
                  </span>
                  Analytics
                </button>
                <button
                  className={`nav-tab ${currentView === 'settings' ? 'active' : ''}`}
                  onClick={() => setCurrentView('settings')}
                >
                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
                    </svg>
                  </span>
                  Settings
                </button>
              </div>
              
              {/* Season Selector */}
              {currentView === 'dashboard' && (
                <div className="season-selector-new">
                  <div className="season-label">Season:</div>
                  <div className="season-tabs">
                    {config.availableSeasons.map(season => (
                      <button
                        key={season}
                        className={`season-tab ${selectedSeason === season ? 'active' : ''}`}
                        onClick={() => setSelectedSeason(season)}
                      >
                        {season}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </nav>
          </header>
        )}
        
        <main className={`app-main ${currentView === 'homepage' ? 'homepage-main' : ''}`}>
          <Suspense fallback={
            <div className="loading-fallback">
              <div className="loading-spinner"></div>
              <p>Loading...</p>
            </div>
          }>
            {currentView === 'homepage' && <Homepage onNavigate={setCurrentView} />}
            {currentView === 'dashboard' && (
              <Dashboard
                season={selectedSeason}
                week={selectedWeek === 'current' ? currentNFLWeek : parseInt(selectedWeek)}
                isCurrentWeek={selectedWeek === 'current'}
                selectedWeek={selectedWeek}
                onWeekChange={setSelectedWeek}
                currentNFLWeek={currentNFLWeek}
              />
            )}
            {currentView === 'settings' && <Settings />}
          </Suspense>
        </main>
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
