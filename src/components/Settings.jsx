import { useTheme } from '../contexts/ThemeContext'

function Settings() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="settings">
      <div className="settings-header">
        <h2>Settings</h2>
        <p>Customize your NFL Edge Finder experience</p>
      </div>

      {/* Coming Soon Notice for Production */}
      <div className="coming-soon-notice" style={{
        background: 'rgba(135, 206, 235, 0.1)',
        border: '1px solid rgba(135, 206, 235, 0.3)',
        borderRadius: '8px',
        padding: '2rem',
        margin: '2rem 0',
        textAlign: 'center'
      }}>
        <h3 style={{color: '#87ceeb', marginBottom: '1rem'}}>🚀 Coming Soon</h3>
        <p style={{color: '#cccccc', marginBottom: '1rem'}}>
          Advanced settings and customization features are currently in development.
        </p>
        <p style={{color: '#999999', fontSize: '0.9rem'}}>
          The current analytics use optimized default settings for maximum profitability.
        </p>
      </div>

      <div className="settings-content" style={{opacity: 0.6, pointerEvents: 'none'}}>
        <div className="settings-section">
          <h3>Appearance</h3>
          
          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="dark-mode-toggle">Dark Mode</label>
              <span className="setting-description">
                Switch between light and dark themes
              </span>
            </div>
            
            <div className="setting-control">
              <label className="toggle-switch">
                <input
                  id="dark-mode-toggle"
                  type="checkbox"
                  checked={theme === 'dark'}
                  onChange={toggleTheme}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Betting Analysis</h3>
          
          <div className="setting-item">
            <div className="setting-info">
              <label>Default Bankroll</label>
              <span className="setting-description">
                Set your default bankroll for Kelly Criterion calculations
              </span>
            </div>
            <div className="setting-control">
              <input 
                type="number" 
                placeholder="1000" 
                className="setting-input"
              />
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Risk Tolerance</label>
              <span className="setting-description">
                Adjust conservative vs aggressive betting recommendations
              </span>
            </div>
            <div className="setting-control">
              <select className="setting-select">
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Data & Models</h3>
          
          <div className="setting-item">
            <div className="setting-info">
              <label>Home Field Advantage</label>
              <span className="setting-description">
                Points added to home team in calculations
              </span>
            </div>
            <div className="setting-control">
              <input 
                type="number" 
                step="0.1"
                placeholder="2.8" 
                className="setting-input"
              />
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Model Confidence Threshold</label>
              <span className="setting-description">
                Minimum edge percentage to highlight opportunities
              </span>
            </div>
            <div className="setting-control">
              <input 
                type="number" 
                step="0.5"
                placeholder="5.0" 
                className="setting-input"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <p className="settings-note">
          Changes are saved automatically. Refresh the dashboard to see updated calculations.
        </p>
      </div>
    </div>
  )
}

export default Settings