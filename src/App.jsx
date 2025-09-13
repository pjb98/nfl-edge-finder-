import { useState, useEffect } from 'react'
import './App.css'
import Homepage from './components/Homepage'
import Dashboard from './components/Dashboard'
import Performance from './components/Performance'
import Settings from './components/Settings'
import ErrorBoundary from './components/ErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'
import { config } from './config/environment'

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

  // Get current NFL week (simplified logic)
  const getCurrentNFLWeek = () => {
    const now = new Date()
    if (selectedSeason === '2024') {
      // 2024 season ended
      return 18
    } else {
      // 2025 season - calculate current week
      const seasonStart = new Date('2025-09-04')
      if (now < seasonStart) return 1
      const diffTime = Math.abs(now - seasonStart)
      const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7))
      return Math.min(Math.max(diffWeeks + 1, 1), 18)
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
                  <span className="nav-icon">🏠</span>
                  Home
                </button>
                <button 
                  className={`nav-tab ${currentView === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setCurrentView('dashboard')}
                >
                  <span className="nav-icon">📊</span>
                  Analytics
                </button>
                <button 
                  className={`nav-tab ${currentView === 'performance' ? 'active' : ''}`}
                  onClick={() => setCurrentView('performance')}
                >
                  <span className="nav-icon">🎯</span>
                  Performance
                </button>
                <button 
                  className={`nav-tab ${currentView === 'settings' ? 'active' : ''}`}
                  onClick={() => setCurrentView('settings')}
                >
                  <span className="nav-icon">⚙️</span>
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
        
        <main className={`app-main ${(currentView === 'homepage' || currentView === 'performance') ? 'homepage-main' : ''}`}>
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
          {currentView === 'performance' && <Performance />}
          {currentView === 'settings' && <Settings />}
        </main>
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
