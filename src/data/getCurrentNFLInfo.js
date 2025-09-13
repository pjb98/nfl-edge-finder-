// Get current NFL week and season information
export const getCurrentNFLInfo = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-based, so add 1
  
  // NFL season typically runs from September to February
  let season = year;
  let week = 1;
  let isActive = false;
  
  if (month >= 9) {
    // September or later = current year season
    season = year;
    isActive = true;
    
    // Rough week calculation (can be improved)
    const seasonStart = new Date(year, 8, 1); // September 1st
    const daysSinceStart = Math.floor((now - seasonStart) / (1000 * 60 * 60 * 24));
    week = Math.min(Math.max(Math.floor(daysSinceStart / 7) + 1, 1), 18);
    
  } else if (month <= 2) {
    // January or February = previous year's season (playoffs)
    season = year - 1;
    isActive = true;
    week = 19; // Playoffs
    
  } else {
    // March-August = offseason
    season = year - 1; // Previous season
    isActive = false;
    week = 18;
  }
  
  return {
    season,
    week,
    isActive
  };
};