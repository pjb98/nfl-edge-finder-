import { useTheme } from '../contexts/ThemeContext'

function Homepage({ onNavigate }) {
  const { isDarkMode } = useTheme()

  const features = [
    {
      icon: "🏈",
      title: "NFL-Focused Analytics",
      description: "Specialized algorithms built exclusively for NFL games, teams, and player props"
    },
    {
      icon: "📊",
      title: "Advanced Statistical Models",
      description: "Poisson distribution and Monte Carlo simulations for precise NFL edge detection"
    },
    {
      icon: "⚡",
      title: "Real-Time NFL Data",
      description: "Live NFL scores, stats, and odds from multiple sportsbooks updated instantly"
    },
    {
      icon: "💎",
      title: "Solana-Powered Rewards",
      description: "Hold $NFE tokens to access premium NFL predictions and exclusive features"
    }
  ]

  const roadmapItems = [
    {
      quarter: "Q1 2025",
      title: "Token Launch & Core Platform",
      items: [
        "🚀 $NFE Token Launch on pump.fun",
        "📱 Mobile-Optimized NFL Platform", 
        "🏈 Complete 2025 NFL Season Integration",
        "💎 Premium Feature Access System"
      ],
      status: "active"
    },
    {
      quarter: "Q2 2025",
      title: "Advanced NFL Features",
      items: [
        "🎯 NFL Player Props AI Enhancement",
        "🤝 Major Sportsbook API Integrations",
        "📊 Advanced NFL Portfolio Tracking",
        "🏆 NFL Prediction Tournaments"
      ],
      status: "upcoming"
    },
    {
      quarter: "Q3 2025",
      title: "NFL Ecosystem Expansion",
      items: [
        "🏈 College Football Analytics",
        "🎮 NFL Fantasy Integration",
        "📈 Advanced NFL Metrics Dashboard",
        "💎 Exclusive NFL NFT Collection"
      ],
      status: "upcoming"
    },
    {
      quarter: "Q4 2025",
      title: "Community & Governance",
      items: [
        "🗳️ Community Voting on Features",
        "🏆 Premium NFL Holder Benefits",
        "💰 Revenue Sharing Program",
        "🚀 Major Exchange Listings"
      ],
      status: "upcoming"
    }
  ]

  const pumpFunFeatures = [
    { 
      title: "Fair Launch", 
      description: "No presale, no team allocation - everyone starts equal on pump.fun",
      icon: "⚖️"
    },
    { 
      title: "Development Fund", 
      description: "Trading fees fund continuous platform development and token buybacks",
      icon: "🔧"
    }
  ]

  return (
    <div className="homepage">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            🚀 Launching Soon on Solana
          </div>
          <h1 className="hero-title">
            NFL Edge Finder
            <span className="hero-subtitle">$NFE Token</span>
          </h1>
          <p className="hero-description">
            The ultimate NFL analytics platform that uses advanced statistical models to find profitable 
            betting edges. Powered by real-time data, AI algorithms, and the Solana blockchain.
          </p>
          

          <div className="hero-actions">
            <a 
              href="https://dexscreener.com/solana/YOUR_TOKEN_ADDRESS_HERE" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-primary"
            >
              📈 View on DexScreener
            </a>
            <a 
              href="https://x.com/statstack_onsol" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              🐦 Twitter
            </a>
            <a 
              href="https://t.me/StatStack" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              📱 Telegram
            </a>
            <button className="btn-secondary" onClick={() => onNavigate('dashboard')}>
              🏈 Launch App
            </button>
          </div>

        </div>
        
        <div className="hero-visual">
          <div className="floating-cards">
            <div className="floating-card card-1">
              <div className="card-header">PHI vs DAL</div>
              <div className="card-edge">+12.4% Edge</div>
            </div>
            <div className="floating-card card-2">
              <div className="card-header">KC vs BUF</div>
              <div className="card-edge">+8.7% Edge</div>
            </div>
            <div className="floating-card card-3">
              <div className="card-header">SF vs SEA</div>
              <div className="card-edge">+15.2% Edge</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2>Why NFL Edge Finder Token?</h2>
          <p className="section-subtitle">
            Combining traditional sports analytics with cutting-edge blockchain technology
          </p>
          
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pump.fun Launch Section */}
      <section className="tokenomics-section">
        <div className="container">
          <h2>pump.fun Launch</h2>
          <p className="section-subtitle">
            Fair launch on pump.fun - the most trusted memecoin launchpad on Solana
          </p>
          
          <div className="pump-fun-content">
            <div className="pump-fun-stats">
              <div className="pump-stat">
                <div className="pump-stat-value">1B</div>
                <div className="pump-stat-label">Total Supply</div>
              </div>
              <div className="pump-stat">
                <div className="pump-stat-value">0%</div>
                <div className="pump-stat-label">Team Tokens</div>
              </div>
              <div className="pump-stat">
                <div className="pump-stat-value">100%</div>
                <div className="pump-stat-label">Fair Launch</div>
              </div>
            </div>
            
            <div className="pump-fun-features">
              {pumpFunFeatures.map((feature, index) => (
                <div key={index} className="pump-feature-card">
                  <div className="pump-feature-icon">{feature.icon}</div>
                  <h4>{feature.title}</h4>
                  <p>{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="roadmap-section">
        <div className="container">
          <h2>Roadmap to the Future</h2>
          <p className="section-subtitle">
            Building the ultimate sports analytics and DeFi ecosystem
          </p>
          
          <div className="roadmap-timeline">
            {roadmapItems.map((item, index) => (
              <div key={index} className={`roadmap-item ${item.status}`}>
                <div className="roadmap-marker">
                  <div className="roadmap-dot"></div>
                </div>
                <div className="roadmap-content">
                  <div className="roadmap-quarter">{item.quarter}</div>
                  <h3>{item.title}</h3>
                  <ul>
                    {item.items.map((listItem, idx) => (
                      <li key={idx}>{listItem}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Find Your Edge?</h2>
            <p>
              Join thousands of smart bettors who use data-driven insights to maximize their profits. 
              Hold $NFE tokens to unlock premium features and exclusive predictions.
            </p>
            
            <div className="cta-actions">
              <a 
                href="https://dexscreener.com/solana/YOUR_TOKEN_ADDRESS_HERE" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-primary large"
              >
                ⚡ Buy $NFE on Solana
              </a>
              <button className="btn-secondary large" onClick={() => onNavigate('dashboard')}>
                📊 Try Analytics Platform
              </button>
            </div>

            <div className="social-links">
              <a href="https://x.com/statstack_onsol" target="_blank" rel="noopener noreferrer">
                🐦 Twitter
              </a>
              <a href="https://t.me/StatStack" target="_blank" rel="noopener noreferrer">
                📱 Telegram
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="homepage-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <h3>NFL Edge Finder</h3>
              <p>Powered by $NFE Token</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 NFL Edge Finder. All rights reserved.</p>
            <p className="disclaimer">
              This platform is for entertainment and educational purposes. Always gamble responsibly.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Homepage