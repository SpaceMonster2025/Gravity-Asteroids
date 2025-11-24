import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import StationMenu from './components/StationMenu';
import { GameState, GameStats, NarrativeLog, Upgrade, Player, Station } from './types';
import { 
  INITIAL_UPGRADES, WORLD_WIDTH, WORLD_HEIGHT, PARTICLE_BASE_PRICE, REPAIR_COST, 
  STATIONS, HIGH_DEMAND_THRESHOLD, LOW_DEMAND_THRESHOLD, HIGH_DEMAND_MULTIPLIER, LOW_DEMAND_MULTIPLIER 
} from './constants';
import { generateMissionBriefing } from './services/aiService.ts';
import { initAudio } from './services/audioService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    level: 1,
    collected: 0,
    particlesNeeded: 0
  });
  
  // Used to force a hard reset of the GameCanvas component
  const [gameId, setGameId] = useState(0);
  
  const [upgrades, setUpgrades] = useState<Upgrade[]>(INITIAL_UPGRADES);
  const [logs, setLogs] = useState<NarrativeLog[]>([]);
  const [dockedStation, setDockedStation] = useState<Station | null>(null);

  // Stations State (Lifted from GameCanvas to be accessible by Menu)
  const stationsRef = useRef<Station[]>([]);

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
    vacuumRange: 100, // Initial vacuum range
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
    initAudio(); // Initialize audio context on user interaction
    setStats({ score: 0, level: 1, collected: 0, particlesNeeded: 0 });
    setUpgrades(INITIAL_UPGRADES);
    setLogs([]);
    
    // Initialize Stations with random start inventory
    stationsRef.current = STATIONS.map((s, i) => ({
      ...s,
      id: `station_${i}`,
      vel: { x: 0, y: 0 },
      angle: i * (Math.PI / 3), // Varied initial angles
      mass: 10000, // Immovable
      inventory: Math.floor(Math.random() * s.maxInventory * 0.5) // Start at 0-50% capacity
    }));

    setGameState(GameState.PLAYING);
    setGameId(prev => prev + 1); // Force Canvas Remount
    handleGameEvent('start');
  };

  const handleRestart = () => {
    // Reset player ref defaults
    playerRef.current.cargo = 0;
    playerRef.current.credits = 0;
    playerRef.current.integrity = 100;
    playerRef.current.vel = { x: 0, y: 0 };
    playerRef.current.singularityActive = false;
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
    
    // Calculate Price Dynamic
    const saturation = dockedStation.inventory / dockedStation.maxInventory;
    let demandMultiplier = 1.0;
    
    if (saturation < HIGH_DEMAND_THRESHOLD) demandMultiplier = HIGH_DEMAND_MULTIPLIER;
    else if (saturation > LOW_DEMAND_THRESHOLD) demandMultiplier = LOW_DEMAND_MULTIPLIER;
    
    const unitPrice = Math.floor(PARTICLE_BASE_PRICE * dockedStation.priceMultiplier * demandMultiplier);
    const value = playerRef.current.cargo * unitPrice;

    // Transaction
    playerRef.current.credits += value;
    dockedStation.inventory = Math.min(dockedStation.maxInventory, dockedStation.inventory + playerRef.current.cargo);
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
        key={gameId}
        gameState={gameState} 
        setGameState={setGameState}
        stats={stats}
        setStats={setStats}
        upgrades={upgrades}
        playerState={playerRef}
        stationsRef={stationsRef}
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