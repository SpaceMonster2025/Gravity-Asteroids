import React, { useState, useEffect, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import { GameState, GameStats, NarrativeLog, Upgrade } from './types';
import { INITIAL_UPGRADES } from './constants';
import { generateMissionBriefing } from './services/aiService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    level: 1,
    collected: 0,
    particlesNeeded: 0
  });
  
  const [upgrades, setUpgrades] = useState<Upgrade[]>(INITIAL_UPGRADES);
  const [logs, setLogs] = useState<NarrativeLog[]>([]);

  const addLog = (log: NarrativeLog) => {
    setLogs(prev => [log, ...prev]);
  };

  const handleGameEvent = useCallback(async (type: 'start' | 'success' | 'fail') => {
    // Generate AI flavor text
    // We do this optimistically to not block UI
    const log = await generateMissionBriefing(stats.level, stats.score, type);
    addLog(log);
  }, [stats.level, stats.score]);

  const handleStartGame = () => {
    setStats({ score: 0, level: 1, collected: 0, particlesNeeded: 0 });
    setUpgrades(INITIAL_UPGRADES);
    setLogs([]);
    setGameState(GameState.PLAYING);
    handleGameEvent('start');
  };

  const handleNextLevel = () => {
    setStats(prev => ({
      ...prev,
      level: prev.level + 1,
      collected: 0 // Reset collection but keep score
    }));
    setGameState(GameState.PLAYING);
  };

  const handleRestart = () => {
    handleStartGame();
  };

  const handleUpgrade = (id: string) => {
    setUpgrades(prev => prev.map(u => {
      if (u.id === id) {
        const cost = Math.floor(u.cost * Math.pow(1.5, u.level - 1));
        if (stats.score >= cost && u.level < u.maxLevel) {
          setStats(s => ({ ...s, score: s.score - cost }));
          return { ...u, level: u.level + 1 };
        }
      }
      return u;
    }));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      <div className="scanlines"></div>
      
      <GameCanvas 
        gameState={gameState} 
        setGameState={setGameState}
        stats={stats}
        setStats={setStats}
        upgrades={upgrades}
        onGameEvent={handleGameEvent}
      />
      
      <HUD 
        gameState={gameState}
        stats={stats}
        logs={logs}
        upgrades={upgrades}
        onUpgrade={handleUpgrade}
        onNextLevel={handleNextLevel}
        onRestart={handleRestart}
        onStart={handleStartGame}
      />
    </div>
  );
};

export default App;