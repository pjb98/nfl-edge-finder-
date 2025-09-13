# NFL Data Backend Service

This Python Flask service provides NFL data using the `nfl-data-py` library, preserving your Odds API credits for betting-specific data only.

## Features

- **Complete NFL Schedules** - All games with dates, times, teams
- **Team Statistics** - Season averages, defensive ratings, performance metrics  
- **Player Statistics** - Individual player stats by position and season
- **Current Week Detection** - Automatically determines current NFL week
- **Caching** - 5-minute cache to improve performance and reduce API calls
- **CORS Enabled** - Ready for React frontend integration

## Quick Setup

### 1. Install Python Dependencies
```bash
cd python-backend
pip install -r requirements.txt
```

### 2. Start the Server
```bash
python app.py
```

The server will start at `http://localhost:5001`

### 3. Test the API
```bash
# Health check
curl http://localhost:5001/

# Get current season schedule
curl http://localhost:5001/api/schedules

# Get specific week
curl http://localhost:5001/api/schedules/week?year=2024&week=1

# Get team stats
curl http://localhost:5001/api/team-stats?years=2024
```

## Available Endpoints

### Schedules
- `GET /api/schedules` - Full season schedules
  - Query params: `years=2024,2025` (comma-separated)
- `GET /api/schedules/week` - Specific week schedule
  - Query params: `year=2024&week=1&season_type=REG`

### Statistics  
- `GET /api/team-stats` - Team performance statistics
  - Query params: `years=2024,2025`
- `GET /api/player-stats` - Player statistics
  - Query params: `years=2024&position=QB`

### Utilities
- `GET /api/current-week` - Current NFL week information
- `GET /` - Health check

## Integration with React Frontend

The React app will:
1. Use this Python backend for **NFL game data** (schedules, scores, stats)
2. Use The Odds API directly for **betting lines** (spreads, moneylines, totals)
3. Combine both data sources for complete game analysis

## Data Sources

- **Primary**: nfl-data-py (via nflfastR)
- **Coverage**: 1999-present
- **Update Frequency**: Weekly during season
- **Cost**: Completely free

## Performance

- **Caching**: 5-minute cache reduces repeated API calls
- **Pagination**: Large datasets automatically limited 
- **Error Handling**: Graceful degradation with detailed error messages
- **CORS**: Cross-origin requests enabled for browser security

## Next Steps

1. Start this Python service: `python app.py`
2. Update React app to call this backend for NFL data
3. Keep Odds API for betting lines only
4. Enjoy unlimited NFL data access! 🏈