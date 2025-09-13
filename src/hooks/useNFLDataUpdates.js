// React Hook for NFL Data Updates
// Handles automatic data updates and provides real-time information

import { useState, useEffect } from 'react';
import NFLDataUpdateService from '../data/nflDataUpdate.js';

export const useNFLDataUpdates = () => {
  const [updateService] = useState(() => new NFLDataUpdateService());
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateStatus, setUpdateStatus] = useState('idle');
  const [seasonInfo, setSeasonInfo] = useState(null);
  const [recentCompletedGames, setRecentCompletedGames] = useState([]);
  const [liveGameCount, setLiveGameCount] = useState(0);

  useEffect(() => {
    // Initialize the service and get current season info
    const currentInfo = updateService.getCurrentNFLWeek();
    setSeasonInfo(currentInfo);

    // Start automatic updates for active seasons
    if (currentInfo.isActive) {
      updateService.startAutomaticUpdates();
      setUpdateStatus('monitoring');
    } else {
      setUpdateStatus('completed_season');
    }

    // Listen for real-time game completion events
    const handleGameCompleted = (event) => {
      const gameResult = event.detail;
      setLastUpdate(new Date());
      setRecentCompletedGames(prev => [gameResult, ...prev.slice(0, 4)]); // Keep last 5 games
      setUpdateStatus('updated');
      
      // Auto-clear update status after 30 seconds
      setTimeout(() => setUpdateStatus('monitoring'), 30000);
    };

    // Add event listener for game completions
    if (typeof window !== 'undefined') {
      window.addEventListener('nflGameCompleted', handleGameCompleted);
    }

    return () => {
      // Cleanup
      if (typeof window !== 'undefined') {
        window.removeEventListener('nflGameCompleted', handleGameCompleted);
      }
      updateService.stopGameMonitoring();
    };
  }, [updateService]);

  const performUpdate = async () => {
    setUpdateStatus('updating');
    try {
      const result = await updateService.manualUpdate(
        seasonInfo.season, 
        seasonInfo.week - 1
      );
      
      if (result.success) {
        setLastUpdate(new Date());
        setUpdateStatus('updated');
        console.log(`Updated ${result.updatedTeams} team stats`);
      } else {
        setUpdateStatus('error');
        console.error('Update failed:', result.error);
      }
    } catch (error) {
      setUpdateStatus('error');
      console.error('Update error:', error);
    }
  };

  const manualUpdate = async (season, week) => {
    return await performUpdate(season, week);
  };

  return {
    seasonInfo,
    lastUpdate,
    updateStatus,
    manualUpdate,
    recentCompletedGames,
    liveGameCount,
    isMonitoring: updateStatus === 'monitoring',
    canUpdate: seasonInfo?.isActive || false,
    isRealTimeActive: updateStatus === 'monitoring'
  };
};

export default useNFLDataUpdates;