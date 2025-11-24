import React from 'react';
import { GameStats, NarrativeLog, GameState, Player } from '../types';
import { Radar, Zap, Shield, Box, CreditCard } from 'lucide-react';

interface HUDProps {
  stats: GameStats;
  logs: NarrativeLog[];
  gameState: GameState;
  player: Player;
  onRestart: () => void;
  onStart: () => void;
}

const HUD: React.FC<HUDProps> = ({ 
  stats, logs, gameState, player, onRestart, onStart 
}) => {

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
        {/* Mission Stats */}
        <div className="bg-black/60 border-l-4 border-cyan-500 p-4 backdrop-blur w-72">
          <div className="flex items-center gap-2 mb-3 text-cyan-400 border-b border-slate-700 pb-2">
            <Radar size={20} />
            <span className="font-orbitron font-bold">SECTOR {stats.level}</span>
          </div>
          <div className="space-y-3">
            <div>
                <div className="flex justify-between text-xs text-amber-500 mb-1">
                    <span>BLACK HOLE MASS</span>
                    <span className="font-mono">{stats.score.toLocaleString()} / {stats.particlesNeeded.toLocaleString()}</span>
                </div>
                <div className="h-1 bg-slate-800 w-full">
                    <div 
                        className="h-full bg-amber-500 transition-all duration-500" 
                        style={{ width: `${Math.min(100, (stats.score / stats.particlesNeeded) * 100)}%` }}
                    />
                </div>
            </div>
            
            <div className="flex items-center gap-2 text-emerald-400">
                <CreditCard size={16} />
                <span className="font-mono text-xl">{player.credits.toLocaleString()} CR</span>
            </div>
          </div>
        </div>

        {/* Narrative Log */}
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
