import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import StationMenu from './components/StationMenu';
import { GameState, GameStats, NarrativeLog, Upgrade, Player, Station } from './types';
import { INITIAL_UPGRADES, WORLD_WIDTH, WORLD_HEIGHT, PARTICLE_BASE_PRICE, REPAIR_COST } from './constants';
import { generateMissionBriefing } from './services/aiService.ts';

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
  const [dockedStation, setDockedStation] = useState<Station | null>(null);

  // Mutable player state to avoid re-renders on every physics frame, but accessible to UI
  const playerRef = useRef<Player>({
    id: 'player',
    pos: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
    vel: { x: 0, y: 0 },
    angle: 0,
    radius: 15,
    mass: 2, // Significantly reduced mass (was 20)
    fuel: 100,
    maxFuel: 100,
    integrity: 100,
    maxIntegrity: 100,
    singularityActive: false,
    singularityRadius: 200,
    singularityStrength: 1,
    cargo: 0,
    maxCargo: 50,
    credits: 0
  });

  // Force update for HUD when meaningful stats change (credits, cargo)
  // We use a dummy state to trigger re-renders periodically or on event
  const [, setTick] = useState(0);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      const interval = setInterval(() => setTick(t => t + 1), 500); // 2fps UI update for non-critical bars
      return () => clearInterval(interval);
    }
  }, [gameState]);

  const addLog = (log: NarrativeLog) => {
    setLogs(prev => [log, ...prev]);
  };

  const handleGameEvent = useCallback(async (type: 'start' | 'success' | 'fail') => {
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

  const handleRestart = () => {
    // Reset player ref defaults
    playerRef.current.cargo = 0;
    playerRef.current.credits = 0;
    playerRef.current.integrity = 100;
    handleStartGame();
  };

  const handleDock = (station: Station) => {
    setDockedStation(station);
    setGameState(GameState.DOCKED);
  };

  const handleUndock = () => {
    setDockedStation(null);
    setGameState(GameState.PLAYING);
  };

  // Station Actions
  const handleSellCargo = () => {
    if (!dockedStation) return;
    const value = Math.floor(playerRef.current.cargo * PARTICLE_BASE_PRICE * dockedStation.priceMultiplier);
    playerRef.current.credits += value;
    playerRef.current.cargo = 0;
    setTick(t => t + 1); // Force UI update
  };

  const handleRepair = () => {
    const cost = Math.floor((playerRef.current.maxIntegrity - playerRef.current.integrity) * REPAIR_COST);
    if (playerRef.current.credits >= cost) {
      playerRef.current.credits -= cost;
      playerRef.current.integrity = playerRef.current.maxIntegrity;
      setTick(t => t + 1);
    }
  };

  const handleUpgrade = (id: string) => {
    setUpgrades(prev => prev.map(u => {
      if (u.id === id) {
        const cost = Math.floor(u.cost * Math.pow(1.5, u.level - 1));
        if (playerRef.current.credits >= cost && u.level < u.maxLevel) {
          playerRef.current.credits -= cost;
          setTick(t => t + 1);
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
        playerState={playerRef}
        onGameEvent={handleGameEvent}
        onDock={handleDock}
      />
      
      <HUD 
        gameState={gameState}
        stats={stats}
        logs={logs}
        player={playerRef.current}
        onRestart={handleRestart}
        onStart={handleStartGame}
      />

      {gameState === GameState.DOCKED && dockedStation && (
        <StationMenu 
            station={dockedStation}
            player={playerRef.current}
            upgrades={upgrades}
            onUndock={handleUndock}
            onSell={handleSellCargo}
            onRepair={handleRepair}
            onUpgrade={handleUpgrade}
        />
      )}
    </div>
  );
};

export default App;