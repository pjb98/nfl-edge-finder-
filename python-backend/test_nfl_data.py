#!/usr/bin/env python3
"""
Test script to explore nfl-data-py data structure
"""

import nfl_data_py as nfl
import pandas as pd

def explore_schedule_data():
    print("Exploring NFL schedule data structure...")
    
    try:
        # Get a small sample of schedule data
        schedules = nfl.import_schedules(years=[2024])
        print(f"Found {len(schedules)} games in 2024")
        
        # Show column names
        print("\nAvailable columns:")
        for i, col in enumerate(schedules.columns):
            print(f"  {i+1:2d}. {col}")
        
        # Show first few rows
        print("\nFirst 3 games:")
        first_games = schedules.head(3)
        for idx, game in first_games.iterrows():
            print(f"\nGame {idx + 1}:")
            for col in ['gameday', 'week', 'season', 'season_type', 'away_team', 'home_team']:
                if col in game:
                    print(f"  {col}: {game[col]}")
        
        # Check Week 1 regular season games
        week1 = schedules[(schedules['week'] == 1) & (schedules['season_type'] == 'REG')]
        print(f"\nFound {len(week1)} Week 1 regular season games")
        
        if len(week1) > 0:
            sample_game = week1.iloc[0]
            print("\nSample Week 1 game:")
            for col, val in sample_game.items():
                if pd.notna(val):
                    print(f"  {col}: {val}")
    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    explore_schedule_data()