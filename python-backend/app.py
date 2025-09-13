#!/usr/bin/env python3
"""
NFL Data Backend Service
Uses nfl-data-py to provide NFL schedules, scores, and team data via REST API
Preserves Odds API credits by handling non-betting data
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import nfl_data_py as nfl
import pandas as pd
from datetime import datetime
import json
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Cache to avoid repeated API calls
cache = {}
cache_expiry = 300  # 5 minutes

def is_cache_valid(cache_key):
    """Check if cached data is still valid"""
    if cache_key not in cache:
        return False
    return (datetime.now() - cache[cache_key]['timestamp']).seconds < cache_expiry

def get_current_season():
    """Get current NFL season year"""
    now = datetime.now()
    if now.month >= 9:  # September onwards = current year
        return now.year
    else:  # January-August = previous year's season
        return now.year - 1

@app.route('/')
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "NFL Data Backend",
        "version": "1.0.0",
        "data_source": "nfl-data-py"
    })

@app.route('/api/schedules')
def get_schedules():
    """Get NFL schedules for specified years"""
    years = request.args.get('years', str(get_current_season()))
    year_list = [int(y.strip()) for y in years.split(',')]
    
    cache_key = f"schedules_{'-'.join(map(str, year_list))}"
    
    if is_cache_valid(cache_key):
        print(f"Using cached schedules data")
        return jsonify(cache[cache_key]['data'])
    
    try:
        print(f"Fetching NFL schedules for years: {year_list}")
        schedules = nfl.import_schedules(years=year_list)
        
        # Convert DataFrame to dict for JSON serialization
        schedules_dict = schedules.to_dict('records')
        
        # Process and clean the data
        processed_schedules = []
        for game in schedules_dict:
            # Handle NaN values and convert to proper types
            processed_game = {}
            for key, value in game.items():
                if pd.isna(value):
                    processed_game[key] = None
                elif isinstance(value, (pd.Timestamp, datetime)):
                    processed_game[key] = value.isoformat() if value else None
                else:
                    processed_game[key] = value
            processed_schedules.append(processed_game)
        
        # Cache the result
        cache[cache_key] = {
            'data': processed_schedules,
            'timestamp': datetime.now()
        }
        
        print(f"Successfully fetched {len(processed_schedules)} games")
        return jsonify(processed_schedules)
        
    except Exception as e:
        print(f"Error fetching schedules: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/schedules/week')
def get_week_schedule():
    """Get NFL schedule for specific week"""
    year = int(request.args.get('year', get_current_season()))
    week = int(request.args.get('week', 1))
    season_type = request.args.get('season_type', 'REG')  # REG, POST
    
    cache_key = f"week_{year}_{week}_{season_type}"
    
    if is_cache_valid(cache_key):
        print(f"Using cached week {week} data")
        return jsonify(cache[cache_key]['data'])
    
    try:
        print(f"Fetching NFL schedule for {year} week {week} ({season_type})")
        schedules = nfl.import_schedules(years=[year])
        
        # Filter for specific week and game type 
        # Note: nfl-data-py uses 'game_type' not 'season_type'
        week_games = schedules[
            (schedules['week'] == week) & 
            (schedules['game_type'] == season_type)
        ]
        
        # Convert to dict
        week_dict = week_games.to_dict('records')
        
        # Process the data
        processed_games = []
        for game in week_dict:
            processed_game = {}
            for key, value in game.items():
                if pd.isna(value):
                    processed_game[key] = None
                elif isinstance(value, (pd.Timestamp, datetime)):
                    processed_game[key] = value.isoformat() if value else None
                else:
                    processed_game[key] = value
            processed_games.append(processed_game)
        
        # Cache the result
        cache[cache_key] = {
            'data': processed_games,
            'timestamp': datetime.now()
        }
        
        print(f"Successfully fetched {len(processed_games)} games for week {week}")
        return jsonify(processed_games)
        
    except Exception as e:
        print(f"Error fetching week schedule: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/team-stats')
def get_team_stats():
    """Get team statistics"""
    years = request.args.get('years', str(get_current_season()))
    year_list = [int(y.strip()) for y in years.split(',')]
    
    cache_key = f"team_stats_{'-'.join(map(str, year_list))}"
    
    if is_cache_valid(cache_key):
        print(f"Using cached team stats data")
        return jsonify(cache[cache_key]['data'])
    
    try:
        print(f"Fetching team stats for years: {year_list}")
        # Get weekly data to calculate team averages
        weekly_data = nfl.import_weekly_data(years=year_list, data_type='team')
        
        # Calculate season averages by team
        team_stats = weekly_data.groupby(['recent_team', 'season']).agg({
            'points_scored': 'mean',
            'points_allowed': 'mean',
            'yards_gained': 'mean',
            'yards_allowed': 'mean',
            'turnovers': 'mean'
        }).reset_index()
        
        # Convert to dict
        stats_dict = team_stats.to_dict('records')
        
        # Process the data
        processed_stats = []
        for stat in stats_dict:
            processed_stat = {}
            for key, value in stat.items():
                if pd.isna(value):
                    processed_stat[key] = None
                else:
                    processed_stat[key] = float(value) if isinstance(value, (int, float)) else value
            processed_stats.append(processed_stat)
        
        # Cache the result
        cache[cache_key] = {
            'data': processed_stats,
            'timestamp': datetime.now()
        }
        
        print(f"Successfully calculated stats for {len(processed_stats)} team-seasons")
        return jsonify(processed_stats)
        
    except Exception as e:
        print(f"Error fetching team stats: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/player-stats')
def get_player_stats():
    """Get player statistics"""
    years = request.args.get('years', str(get_current_season()))
    year_list = [int(y.strip()) for y in years.split(',')]
    position = request.args.get('position', None)  # QB, RB, WR, etc.
    
    cache_key = f"player_stats_{'-'.join(map(str, year_list))}_{position or 'all'}"
    
    if is_cache_valid(cache_key):
        print(f"Using cached player stats data")
        return jsonify(cache[cache_key]['data'])
    
    try:
        print(f"Fetching player stats for years: {year_list}, position: {position}")
        weekly_data = nfl.import_weekly_data(years=year_list)
        
        # Filter by position if specified
        if position:
            weekly_data = weekly_data[weekly_data['position'] == position]
        
        # Get season totals/averages by player
        player_stats = weekly_data.groupby(['player_id', 'player_display_name', 'recent_team', 'season']).agg({
            'passing_yards': 'sum',
            'passing_tds': 'sum',
            'rushing_yards': 'sum', 
            'rushing_tds': 'sum',
            'receiving_yards': 'sum',
            'receiving_tds': 'sum',
            'fantasy_points_ppr': 'sum'
        }).reset_index()
        
        # Convert to dict and limit results
        stats_dict = player_stats.head(500).to_dict('records')  # Limit for performance
        
        # Process the data
        processed_stats = []
        for stat in stats_dict:
            processed_stat = {}
            for key, value in stat.items():
                if pd.isna(value):
                    processed_stat[key] = None
                else:
                    processed_stat[key] = float(value) if isinstance(value, (int, float)) else value
            processed_stats.append(processed_stat)
        
        # Cache the result
        cache[cache_key] = {
            'data': processed_stats,
            'timestamp': datetime.now()
        }
        
        print(f"Successfully fetched stats for {len(processed_stats)} players")
        return jsonify(processed_stats)
        
    except Exception as e:
        print(f"Error fetching player stats: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/current-week')
def get_current_week():
    """Get current NFL week information"""
    try:
        current_date = datetime.now()
        current_year = get_current_season()
        
        # Simple week calculation (can be improved)
        season_start = datetime(current_year, 9, 1)  # Approximate season start
        weeks_since_start = max(1, (current_date - season_start).days // 7)
        current_week = min(weeks_since_start, 18)  # Cap at week 18
        
        return jsonify({
            "current_year": current_year,
            "current_week": current_week,
            "season_type": "REG" if current_week <= 18 else "POST",
            "timestamp": current_date.isoformat()
        })
        
    except Exception as e:
        print(f"Error getting current week: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("NFL Starting NFL Data Backend Service")
    print("Data Using nfl-data-py for comprehensive NFL data")
    print("Link CORS enabled for React frontend integration")
    print("Cache Caching enabled (5 minute expiry)")
    
    # Check if nfl_data_py is available
    try:
        test_data = nfl.import_schedules(years=[2024])
        print(f"Success nfl-data-py connection successful ({len(test_data)} games found)")
    except Exception as e:
        print(f"Warning nfl-data-py test failed: {str(e)}")
    
    app.run(host='0.0.0.0', port=5001, debug=True)