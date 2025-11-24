import React, { useEffect, useState } from 'react';
import { GameStats, Player, NarrativeLog, GameState, Upgrade } from '../types';
import { Radar, Battery, Activity, Zap, Shield, AlertTriangle } from 'lucide-react';

interface HUDProps {
  stats: GameStats;
  logs: NarrativeLog[];
  gameState: GameState;
  upgrades: Upgrade[];
  onUpgrade: (id: string) => void;
  onNextLevel: () => void;
  onRestart: () => void;
  onStart: () => void;
}

const HUD: React.FC<HUDProps> = ({ 
  stats, logs, gameState, upgrades, onUpgrade, onNextLevel, onRestart, onStart 
}) => {
  const [activeTab, setActiveTab] = useState<'mission' | 'systems'>('mission');

  const getUpgradeCost = (u: Upgrade) => Math.floor(u.cost * Math.pow(1.5, u.level - 1));

  if (gameState === GameState.MENU) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 backdrop-blur-sm">
        <div className="max-w-2xl w-full border border-cyan-500 bg-black/90 p-8 text-center shadow-[0_0_50px_rgba(6,182,212,0.3)]">
          <h1 className="text-6xl font-orbitron text-cyan-400 mb-4 tracking-widest uppercase">Singularity Shepherd</h1>
          <p className="text-xl text-slate-300 mb-8 font-light">
            Pilot the Void Harvester. Use your <span className="text-fuchsia-400">Singularity Drive (SPACE)</span> to tow asteroids into the Event Horizon. 
            Avoid the crush depth. Collect the Exotic Matter.
          </p>
          
          <div className="grid grid-cols-2 gap-4 text-left mb-8 bg-slate-900/50 p-6 rounded border border-slate-700">
             <div><strong className="text-cyan-400">WASD / Arrows</strong> : Thrust & Rotate</div>
             <div><strong className="text-fuchsia-400">SPACE (Hold)</strong> : Activate Singularity</div>
             <div><strong className="text-amber-400">Objective</strong> : Feed the Black Hole</div>
             <div><strong className="text-red-400">Warning</strong> : Don't fall in.</div>
          </div>

          <button 
            onClick={onStart}
            className="px-12 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-orbitron text-2xl tracking-wider clip-path-polygon transition-all hover:scale-105"
            style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
          >
            INITIATE SEQUENCE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
      
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        {/* Mission Stats */}
        <div className="bg-black/60 border-l-4 border-cyan-500 p-4 backdrop-blur w-64">
          <div className="flex items-center gap-2 mb-2 text-cyan-400">
            <Radar size={20} />
            <span className="font-orbitron font-bold">SECTOR {stats.level}</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-300">
              <span>SCORE</span>
              <span className="font-mono text-white">{stats.score.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-300">
              <span>PARTICLES</span>
              <span className="font-mono text-white">{stats.collected} / {stats.particlesNeeded}</span>
            </div>
            <div className="h-1 bg-slate-800 w-full mt-1">
              <div 
                className="h-full bg-cyan-400 transition-all duration-500" 
                style={{ width: `${Math.min(100, (stats.collected / stats.particlesNeeded) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Narrative Log (Comms) */}
        <div className="bg-black/60 border-r-4 border-amber-500 p-4 backdrop-blur w-96 max-h-48 overflow-hidden flex flex-col-reverse">
          {logs.slice(0, 3).map((log, i) => (
            <div key={i} className={`mb-3 ${i === 0 ? 'opacity-100' : 'opacity-60 text-sm'}`}>
              <div className="flex justify-between text-xs text-amber-600 mb-1 font-mono uppercase">
                <span>// {log.sender}</span>
                <span>{log.timestamp}</span>
              </div>
              <div className="text-amber-100 font-mono leading-tight">
                "{log.message}"
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Center Messages */}
      {(gameState === GameState.LEVEL_COMPLETE || gameState === GameState.GAME_OVER) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/70 backdrop-blur-md">
          <div className="max-w-4xl w-full p-8 bg-slate-900 border border-slate-600 shadow-2xl">
             <h2 className={`text-5xl font-orbitron text-center mb-2 ${gameState === GameState.LEVEL_COMPLETE ? 'text-green-400' : 'text-red-500'}`}>
               {gameState === GameState.LEVEL_COMPLETE ? 'SECTOR CLEARED' : 'SIGNAL LOST'}
             </h2>
             <p className="text-center text-slate-400 mb-8 font-mono">
               {gameState === GameState.LEVEL_COMPLETE ? 'Quota met. Docking for upgrades.' : 'Vessel integrity critical. Simulation terminated.'}
             </p>

             <div className="grid grid-cols-2 gap-6 mb-8">
               {upgrades.map(u => {
                 const cost = getUpgradeCost(u);
                 const canAfford = stats.score >= cost;
                 const isMax = u.level >= u.maxLevel;
                 return (
                   <div key={u.id} className="bg-black/40 p-4 border border-slate-700 flex flex-col justify-between hover:border-cyan-700 transition-colors">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                           <h4 className="text-cyan-300 font-bold">{u.name}</h4>
                           <span className="text-xs text-slate-500">Lvl {u.level}/{u.maxLevel}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-4 h-8">{u.description}</p>
                      </div>
                      <button 
                        disabled={!canAfford || isMax}
                        onClick={() => onUpgrade(u.id)}
                        className={`w-full py-2 text-sm font-bold uppercase tracking-wider flex justify-between px-4
                          ${isMax ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 
                            canAfford ? 'bg-cyan-900 text-cyan-100 hover:bg-cyan-700' : 'bg-red-900/30 text-red-400 opacity-50 cursor-not-allowed'
                          }
                        `}
                      >
                        <span>{isMax ? 'MAXED' : 'UPGRADE'}</span>
                        {!isMax && <span>{cost} CR</span>}
                      </button>
                   </div>
                 )
               })}
             </div>

             <div className="flex justify-center">
                {gameState === GameState.LEVEL_COMPLETE ? (
                  <button onClick={onNextLevel} className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-orbitron tracking-widest text-lg">
                    WARP TO SECTOR {stats.level + 1}
                  </button>
                ) : (
                  <button onClick={onRestart} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-orbitron tracking-widest text-lg">
                    REBOOT SYSTEM
                  </button>
                )}
             </div>
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <div className="flex justify-between items-end">
        {/* Ship Systems */}
        <div className="bg-black/60 border-l-4 border-fuchsia-500 p-4 backdrop-blur w-72">
           <h3 className="text-fuchsia-400 font-orbitron mb-2 text-sm flex items-center gap-2">
             <Zap size={16} /> SYSTEMS DIAGNOSTIC
           </h3>
           <div className="space-y-3">
             <div className="flex items-center gap-3">
                <Shield size={16} className="text-cyan-500" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-cyan-200 mb-1"><span>INTEGRITY</span> <span>100%</span></div>
                  <div className="h-2 bg-slate-800"><div className="h-full bg-cyan-500 w-full"></div></div>
                </div>
             </div>
             <div className="flex items-center gap-3">
                <Activity size={16} className="text-fuchsia-500" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-fuchsia-200 mb-1"><span>SINGULARITY COIL</span> <span>READY</span></div>
                  <div className="h-2 bg-slate-800"><div className="h-full bg-fuchsia-500 w-full"></div></div>
                </div>
             </div>
           </div>
        </div>
        
        {/* Controls Hint */}
        <div className="text-slate-500 font-mono text-xs text-right opacity-50">
          <div className="mb-1">VOID HARVESTER OS v9.2</div>
          <div>CONNECTED TO MAIN FRAME</div>
        </div>
      </div>
    </div>
  );
};

export default HUD;