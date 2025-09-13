import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'nfl_data.db');
const db = new Database(dbPath);

// Initialize database tables
export function initializeDatabase() {
  // Teams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      abbreviation TEXT,
      conference TEXT,
      division TEXT,
      home_venue TEXT
    )
  `);

  // Games table
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY,
      week INTEGER,
      season INTEGER,
      home_team_id INTEGER,
      away_team_id INTEGER,
      home_score INTEGER,
      away_score INTEGER,
      game_date DATE,
      weather_conditions TEXT,
      FOREIGN KEY (home_team_id) REFERENCES teams(id),
      FOREIGN KEY (away_team_id) REFERENCES teams(id)
    )
  `);

  // Team Stats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_stats (
      id INTEGER PRIMARY KEY,
      team_id INTEGER,
      week INTEGER,
      season INTEGER,
      points_scored REAL,
      points_allowed REAL,
      yards_gained REAL,
      yards_allowed REAL,
      turnovers INTEGER,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    )
  `);

  // Player Stats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS player_stats (
      id INTEGER PRIMARY KEY,
      player_name TEXT,
      team_id INTEGER,
      position TEXT,
      week INTEGER,
      season INTEGER,
      passing_yards INTEGER,
      rushing_yards INTEGER,
      receiving_yards INTEGER,
      touchdowns INTEGER,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    )
  `);

  // Bets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY,
      bet_type TEXT,
      game_id INTEGER,
      player_name TEXT,
      bet_amount REAL,
      odds REAL,
      calculated_probability REAL,
      expected_value REAL,
      result TEXT,
      profit_loss REAL,
      bet_date DATE,
      FOREIGN KEY (game_id) REFERENCES games(id)
    )
  `);

  console.log('Database initialized successfully');
}

// Database query functions
export const queries = {
  // Teams
  insertTeam: db.prepare(`
    INSERT INTO teams (name, abbreviation, conference, division, home_venue)
    VALUES (?, ?, ?, ?, ?)
  `),
  
  getTeams: db.prepare('SELECT * FROM teams'),
  
  getTeamById: db.prepare('SELECT * FROM teams WHERE id = ?'),

  // Games
  insertGame: db.prepare(`
    INSERT INTO games (week, season, home_team_id, away_team_id, home_score, away_score, game_date, weather_conditions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  getGames: db.prepare('SELECT * FROM games ORDER BY game_date DESC'),
  
  getGamesByWeek: db.prepare('SELECT * FROM games WHERE week = ? AND season = ?'),

  // Team Stats
  insertTeamStats: db.prepare(`
    INSERT INTO team_stats (team_id, week, season, points_scored, points_allowed, yards_gained, yards_allowed, turnovers)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  getTeamStats: db.prepare(`
    SELECT * FROM team_stats 
    WHERE team_id = ? AND season = ? 
    ORDER BY week DESC
  `),

  // Calculate team averages
  getTeamAverages: db.prepare(`
    SELECT 
      team_id,
      AVG(points_scored) as avg_points_scored,
      AVG(points_allowed) as avg_points_allowed,
      AVG(yards_gained) as avg_yards_gained,
      AVG(yards_allowed) as avg_yards_allowed
    FROM team_stats 
    WHERE team_id = ? AND season = ?
    GROUP BY team_id
  `)
};

export default db;