
import React from 'react';
import { GameStats, NarrativeLog, GameState, Player } from '../types';
import { Radar, Zap, Shield, Box, CreditCard, Crosshair } from 'lucide-react';

interface HUDProps {
  stats: GameStats;
  logs: NarrativeLog[];
  gameState: GameState;
  player: Player;
  onRestart: () => void;
  onStart: () => void;
  onNextSector?: () => void;
}

const HUD: React.FC<HUDProps> = ({ 
  stats, logs, gameState, player, onRestart, onStart, onNextSector 
}) => {

  const progress = Math.min(100, (stats.score / stats.particlesNeeded) * 100);
  const asteroidsRemaining = stats.currentAsteroids;
  const sectorCleaned = stats.initialAsteroids > 0 
    ? Math.floor(((stats.initialAsteroids - stats.currentAsteroids) / stats.initialAsteroids) * 100)
    : 0;
  
  // Asteroid Density (Inverse of cleaned, but visualized as % of initial load remaining)
  const density = stats.initialAsteroids > 0 
    ? Math.floor((stats.currentAsteroids / stats.initialAsteroids) * 100)
    : 0;

  if (gameState === GameState.MENU) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 backdrop-blur-sm">
        <div className="max-w-2xl w-full border border-cyan-500 bg-black/90 p-8 text-center shadow-[0_0_50px_rgba(6,182,212,0.3)]">
          <h1 className="text-6xl font-orbitron text-cyan-400 mb-4 tracking-widest uppercase">Singularity Shepherd</h1>
          <p className="text-xl text-slate-300 mb-8 font-light">
            Navigate the Deep Void. Forage for <span className="text-cyan-200">Exotic Matter</span>. 
            Tow asteroids to the Black Hole to fulfill your quota, but keep the loot for yourself to sell at <span className="text-emerald-400">Trading Stations</span>.
          </p>
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
        {/* Mission Stats (Left) */}
        <div className="bg-black/60 border-l-4 border-cyan-500 p-4 backdrop-blur w-72">
          <div className="flex items-center gap-2 mb-3 text-cyan-400 border-b border-slate-700 pb-2">
            <Radar size={20} />
            <span className="font-orbitron font-bold">SECTOR {stats.level}</span>
            <span className="text-xs text-slate-500 ml-auto">CLR: {stats.sectorsCleared}</span>
          </div>
          <div className="space-y-3">
            <div>
                <div className="flex justify-between text-xs text-amber-500 mb-1">
                    <span>BLACK HOLE MASS</span>
                    <span className="font-mono">{stats.score.toLocaleString()} / {stats.particlesNeeded.toLocaleString()}</span>
                </div>
                <div className="h-1 bg-slate-800 w-full relative">
                    <div 
                        className="h-full bg-amber-500 transition-all duration-500" 
                        style={{ width: `${progress}%` }}
                    />
                    {progress >= 100 && (
                        <div className="absolute top-0 right-0 -mt-1 w-2 h-2 bg-white rounded-full animate-ping"></div>
                    )}
                </div>
            </div>
            
            <div className="flex items-center gap-2 text-emerald-400">
                <CreditCard size={16} />
                <span className="font-mono text-xl">{player.credits.toLocaleString()} CR</span>
            </div>
          </div>
        </div>
        
        {/* Sector Analysis (Right) */}
        <div className="bg-black/60 border-t-4 border-purple-500 p-4 backdrop-blur w-72">
             <div className="flex items-center gap-2 mb-2 text-purple-400 border-b border-slate-700 pb-1">
                <Crosshair size={18} />
                <span className="font-orbitron font-bold text-sm">SECTOR ANALYSIS</span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-xs font-mono">
                <div className="text-slate-400">TARGETS REMAINING</div>
                <div className="text-right text-white">{asteroidsRemaining}</div>

                <div className="text-slate-400">PARTICLES COLL.</div>
                <div className="text-right text-cyan-300">{stats.collected}</div>

                <div className="text-slate-400">ASTEROID DENSITY</div>
                <div className="text-right text-amber-300">{density}%</div>

                <div className="text-slate-400">SECTOR CLEANED</div>
                <div className="text-right text-emerald-400">{sectorCleaned}%</div>
            </div>
        </div>
      </div>
      
      {/* Warp Jump Button - Appears when quota met */}
      {stats.score >= stats.particlesNeeded && gameState === GameState.PLAYING && (
         <div className="absolute top-32 left-1/2 -translate-x-1/2 pointer-events-auto">
            <button 
                onClick={onNextSector}
                className="group relative px-12 py-4 bg-transparent overflow-hidden clip-path-polygon"
                style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
            >
                <div className="absolute inset-0 w-full h-full bg-cyan-600/20 group-hover:bg-cyan-600/40 transition-colors border-2 border-cyan-400"></div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-cyan-400 animate-pulse"></div>
                <span className="relative font-orbitron text-2xl text-cyan-100 tracking-[0.2em] font-bold group-hover:text-white group-hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">
                    INITIATE WARP JUMP
                </span>
            </button>
            <div className="text-center text-cyan-300 text-xs font-mono mt-2 animate-pulse">
                SECTOR QUOTA MET - HYPERDRIVE READY
            </div>
         </div>
      )}

      {/* Center Messages (Game Over Only) */}
      {(gameState === GameState.GAME_OVER) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/70 backdrop-blur-md">
          <div className="max-w-xl w-full p-8 bg-slate-900 border border-red-600 shadow-2xl text-center">
             <h2 className="text-5xl font-orbitron text-red-500 mb-4">SIGNAL LOST</h2>
             <p className="text-slate-400 mb-8 font-mono">
               Vessel destroyed. Cargo lost. Simulation terminated.
             </p>
             <button onClick={onRestart} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-orbitron tracking-widest text-lg">
                REBOOT SYSTEM
             </button>
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <div className="flex justify-between items-end">
        {/* Ship Systems */}
        <div className="bg-black/60 border-l-4 border-fuchsia-500 p-4 backdrop-blur w-80">
           <h3 className="text-fuchsia-400 font-orbitron mb-2 text-sm flex items-center gap-2">
             <Zap size={16} /> SYSTEMS DIAGNOSTIC
           </h3>
           <div className="space-y-3">
             <div className="flex items-center gap-3">
                <Shield size={16} className="text-cyan-500" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-cyan-200 mb-1"><span>INTEGRITY</span> <span>{Math.floor(player.integrity)}/{player.maxIntegrity}</span></div>
                  <div className="h-2 bg-slate-800"><div className="h-full bg-cyan-500" style={{width: `${(player.integrity/player.maxIntegrity)*100}%`}}></div></div>
                </div>
             </div>
             
             <div className="flex items-center gap-3">
                <Box size={16} className="text-emerald-400" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-emerald-200 mb-1">
                      <span>CARGO HOLD</span> 
                      <span>{player.cargo}/{player.maxCargo}</span>
                  </div>
                  <div className="h-2 bg-slate-800">
                      <div className="h-full bg-emerald-500" style={{width: `${(player.cargo/player.maxCargo)*100}%`}}></div>
                  </div>
                  {player.cargo >= player.maxCargo && (
                      <div className="text-[10px] text-red-400 text-right mt-1 blink">CARGO FULL - DOCK TO SELL</div>
                  )}
                </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default HUD;
