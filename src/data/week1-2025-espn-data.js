// Week 1 2025 NFL betting data from ESPN
// One-time import for real betting lines

export const week1_2025_games = [
  {
    id: "2025_1_PHI_DAL",
    homeTeam: "Philadelphia Eagles",
    awayTeam: "Dallas Cowboys", 
    homeTeamAbbr: "PHI",
    awayTeamAbbr: "DAL",
    homeTeamId: 21,
    awayTeamId: 6,
    week: 1,
    season: 2025,
    gameDate: "2025-09-04",
    gameTime: "8:20 PM ET",
    venue: "Lincoln Financial Field",
    network: "NBC",
    weatherConditions: "Clear",
    status: "STATUS_SCHEDULED",
    isCompleted: false,
    homeScore: 0,
    awayScore: 0,
    bettingLines: {
      spread: -7.0,  // Eagles favored by 7
      total: 46.5,
      homeMoneyline: -300,  // Eagles -300
      awayMoneyline: 250    // Cowboys +250
    }
  },
  {
    id: "2025_1_KC_LAC",
    homeTeam: "Los Angeles Chargers", // Playing in Brazil but Chargers listed as home
    awayTeam: "Kansas City Chiefs",
    homeTeamAbbr: "LAC", 
    awayTeamAbbr: "KC",
    homeTeamId: 24,
    awayTeamId: 12,
    week: 1,
    season: 2025,
    gameDate: "2025-09-05",
    gameTime: "8:00 PM ET", 
    venue: "Corinthians Arena, São Paulo, Brazil",
    network: "YouTube",
    weatherConditions: "Dome",
    status: "STATUS_SCHEDULED",
    isCompleted: false,
    homeScore: 0,
    awayScore: 0,
    bettingLines: {
      spread: 2.5,   // Chiefs favored by 2.5, so Chargers (home) get +2.5
      total: 44.5,
      homeMoneyline: 135,   // Chargers +135
      awayMoneyline: -155   // Chiefs -155
    }
  },
  {
    id: "2025_1_NYG_WAS",
    homeTeam: "Washington Commanders",
    awayTeam: "New York Giants",
    homeTeamAbbr: "WAS",
    awayTeamAbbr: "NYG", 
    homeTeamId: 28,
    awayTeamId: 19,
    week: 1,
    season: 2025,
    gameDate: "2025-09-07",
    gameTime: "1:00 PM ET",
    venue: "Northwest Stadium",
    network: "CBS",
    weatherConditions: "Clear",
    status: "STATUS_SCHEDULED", 
    isCompleted: false,
    homeScore: 0,
    awayScore: 0,
    bettingLines: {
      spread: -7.5,  // Commanders favored by 7.5
      total: 45.5,
      homeMoneyline: -400,  // Commanders -400
      awayMoneyline: 300    // Giants +300
    }
  },
  {
    id: "2025_1_TB_ATL",
    homeTeam: "Atlanta Falcons",
    awayTeam: "Tampa Bay Buccaneers",
    homeTeamAbbr: "ATL",
    awayTeamAbbr: "TB",
    homeTeamId: 1, 
    awayTeamId: 27,
    week: 1,
    season: 2025,
    gameDate: "2025-09-07", 
    gameTime: "1:00 PM ET",
    venue: "Mercedes-Benz Stadium",
    network: "FOX",
    weatherConditions: "Dome",
    status: "STATUS_SCHEDULED",
    isCompleted: false,
    homeScore: 0,
    awayScore: 0,
    bettingLines: {
      spread: 1.5,   // Buccaneers favored by 1.5 (away team favored)
      total: 48.5,
      homeMoneyline: 115,   // Falcons +115
      awayMoneyline: -135   // Buccaneers -135
    }
  },
  {
    id: "2025_1_CAR_JAX",
    homeTeam: "Jacksonville Jaguars",
    awayTeam: "Carolina Panthers",
    homeTeamAbbr: "JAX",
    awayTeamAbbr: "CAR",
    homeTeamId: 30,
    awayTeamId: 29,
    week: 1,
    season: 2025,
    gameDate: "2025-09-07",
    gameTime: "1:00 PM ET", 
    venue: "EverBank Stadium",
    network: "CBS",
    weatherConditions: "Clear",
    status: "STATUS_SCHEDULED",
    isCompleted: false,
    homeScore: 0,
    awayScore: 0,
    bettingLines: {
      spread: -2.5,  // Jaguars favored by 2.5
      total: 45.5,
      homeMoneyline: -165,  // Jaguars -165
      awayMoneyline: 140    // Panthers +140
    }
  },
  {
    id: "2025_1_MIA_IND",
    homeTeam: "Indianapolis Colts",
    awayTeam: "Miami Dolphins", 
    homeTeamAbbr: "IND",
    awayTeamAbbr: "MIA",
    homeTeamId: 11,
    awayTeamId: 15,
    week: 1,
    season: 2025,
    gameDate: "2025-09-07",
    gameTime: "1:00 PM ET",
    venue: "Lucas Oil Stadium",
    network: "CBS", 
    weatherConditions: "Dome",
    status: "STATUS_SCHEDULED",
    isCompleted: false,
    homeScore: 0,
    awayScore: 0,
    bettingLines: {
      spread: -1.0,  // Colts favored by 1
      total: 45.5,
      homeMoneyline: -120,  // Colts -120
      awayMoneyline: 100    // Dolphins EVEN (translated to +100)
    }
  },
  {
    id: "2025_1_LV_NE",
    homeTeam: "New England Patriots",
    awayTeam: "Las Vegas Raiders",
    homeTeamAbbr: "NE", 
    awayTeamAbbr: "LV",
    homeTeamId: 17,
    awayTeamId: 13,
    week: 1,
    season: 2025,
    gameDate: "2025-09-07",
    gameTime: "1:00 PM ET",
    venue: "Gillette Stadium",
    network: "CBS",
    weatherConditions: "Clear", 
    status: "STATUS_SCHEDULED",
    isCompleted: false,
    homeScore: 0,
    awayScore: 0,
    bettingLines: {
      spread: -2.0,  // Patriots favored by 2
      total: 43.5,
      homeMoneyline: -135,  // Patriots -135
      awayMoneyline: 115    // Raiders +115
    }
  },
  {
    id: "2025_1_PIT_NYJ",
    homeTeam: "New York Jets",
    awayTeam: "Pittsburgh Steelers",
    homeTeamAbbr: "NYJ",
    awayTeamAbbr: "PIT",
    homeTeamId: 20,
    awayTeamId: 23, 
    week: 1,
    season: 2025,
    gameDate: "2025-09-07",
    gameTime: "1:00 PM ET",
    venue: "MetLife Stadium",
    network: "CBS",
    weatherConditions: "Clear",
    status: "STATUS_SCHEDULED",
    isCompleted: false,
    homeScore: 0,
    awayScore: 0,
    bettingLines: {
      spread: 2.5,   // Steelers favored by 2.5 (away team favored)
      total: 39.5,
      homeMoneyline: 135,   // Jets +135
      awayMoneyline: -155   // Steelers -155
    }
  },
  {
    id: "2025_1_CIN_CLE",
    homeTeam: "Cleveland Browns",
    awayTeam: "Cincinnati Bengals",
    homeTeamAbbr: "CLE",
    awayTeamAbbr: "CIN",
    homeTeamId: 5,
    awayTeamId: 4,
    week: 1,
    season: 2025,
    gameDate: "2025-09-07",
    gameTime: "1:00 PM ET",
    venue: "Huntington Bank Field", 
    network: "CBS",
    weatherConditions: "Clear",
    status: "STATUS_SCHEDULED",
    isCompleted: false,
    homeScore: 0,
    awayScore: 0,
    bettingLines: {
      spread: 5.0,   // Bengals favored by 5 (away team favored)
      total: 44.5,
      homeMoneyline: 200,   // Browns +200
      awayMoneyline: -240   // Bengals -240
    }
  },
  {
    id: "2025_1_ARI_NO", 
    homeTeam: "New Orleans Saints",
    awayTeam: "Arizona Cardinals",
    homeTeamAbbr: "NO",
    awayTeamAbbr: "ARI",
    homeTeamId: 18,
    awayTeamId: 22,
    week: 1,
    season: 2025,
    gameDate: "2025-09-07",
    gameTime: "1:00 PM ET",
    venue: "Caesars Superdome",
    network: "FOX",
    weatherConditions: "Dome",
    status: "STATUS_SCHEDULED",
    isCompleted: false,
    homeScore: 0,
    awayScore: 0,
    bettingLines: {
      spread: 4.5,   // Cardinals favored by 4.5 (away team favored)
      total: 41.5,
      homeMoneyline: 165,   // Saints +165
      awayMoneyline: -195   // Cardinals -195
    }
  }
]

// Function to get Week 1 2025 ESPN data
export function getWeek1ESPNData() {
  return week1_2025_games
}