import React from 'react';
import { Player, Station, Upgrade } from '../types';
import { PARTICLE_BASE_PRICE, REPAIR_COST, FUEL_COST, HIGH_DEMAND_THRESHOLD, LOW_DEMAND_THRESHOLD, HIGH_DEMAND_MULTIPLIER, LOW_DEMAND_MULTIPLIER } from '../constants';

interface StationMenuProps {
  station: Station;
  player: Player;
  upgrades: Upgrade[];
  onUndock: () => void;
  onSell: () => void;
  onRepair: () => void;
  onUpgrade: (id: string) => void;
}

const StationMenu: React.FC<StationMenuProps> = ({ 
  station, player, upgrades, onUndock, onSell, onRepair, onUpgrade 
}) => {
  const saturation = station.inventory / station.maxInventory;
  let demandMultiplier = 1.0;
  let demandLabel = 'NORMAL';
  let demandColor = 'text-emerald-400';

  if (saturation < HIGH_DEMAND_THRESHOLD) {
      demandMultiplier = HIGH_DEMAND_MULTIPLIER;
      demandLabel = 'HIGH';
      demandColor = 'text-amber-400';
  } else if (saturation > LOW_DEMAND_THRESHOLD) {
      demandMultiplier = LOW_DEMAND_MULTIPLIER;
      demandLabel = 'LOW';
      demandColor = 'text-red-400';
  }

  const unitPrice = Math.floor(PARTICLE_BASE_PRICE * station.priceMultiplier * demandMultiplier);
  const sellValue = player.cargo * unitPrice;
  const repairCost = Math.floor((player.maxIntegrity - player.integrity) * REPAIR_COST);
  const canRepair = player.credits >= repairCost && player.integrity < player.maxIntegrity;

  const getUpgradeCost = (u: Upgrade) => Math.floor(u.cost * Math.pow(1.5, u.level - 1));

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur">
      <div className="w-full max-w-4xl bg-slate-900 border-2 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)] p-8">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b border-emerald-900 pb-4">
            <div>
                <h1 className="text-4xl font-orbitron text-emerald-400">{station.name.toUpperCase()}</h1>
                <p className="text-emerald-700 font-mono text-sm">AUTHORIZED PERSONNEL ONLY // MARKET ACTIVE</p>
            </div>
            <div className="text-right">
                <div className="text-xs text-slate-500 mb-1">CURRENT BALANCE</div>
                <div className="text-3xl font-mono text-emerald-300">{player.credits.toLocaleString()} CR</div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
            {/* Left Column: Services */}
            <div className="space-y-6">
                {/* Cargo Market */}
                <div className="bg-black/40 p-6 border border-emerald-800">
                    <h2 className="text-xl font-orbitron text-slate-200 mb-4">RESOURCE EXCHANGE</h2>
                    
                    {/* Market Status */}
                    <div className="flex justify-between items-center mb-4 bg-slate-900 p-2 border border-slate-700">
                        <div className="text-xs text-slate-400">DEMAND LEVEL</div>
                        <div className={`font-bold font-mono ${demandColor}`}>{demandLabel}</div>
                    </div>

                    <div className="flex justify-between items-end mb-4">
                        <div className="text-slate-400 text-sm">CARGO HOLD</div>
                        <div className="font-mono text-emerald-400">{player.cargo} / {player.maxCargo}</div>
                    </div>
                    
                    <div className="flex justify-between items-center bg-slate-900 p-4 mb-4 border border-slate-700">
                        <div className="text-slate-300">Exotic Matter</div>
                        <div className="text-right">
                            <div className="text-xs text-slate-500">MARKET RATE</div>
                            <div className="text-emerald-400 font-mono">{unitPrice} CR/u</div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={onSell}
                        disabled={player.cargo === 0}
                        className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold tracking-widest"
                    >
                        SELL ALL ({sellValue} CR)
                    </button>
                    
                    <div className="mt-2 text-xs text-slate-500 text-center">
                        Station Inventory: {Math.floor(station.inventory)} / {station.maxInventory}
                    </div>
                </div>

                {/* Maintenance */}
                <div className="bg-black/40 p-6 border border-emerald-800">
                    <h2 className="text-xl font-orbitron text-slate-200 mb-4">DRYDOCK SERVICES</h2>
                    
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <div className="text-slate-400 text-sm">HULL INTEGRITY</div>
                            <div className="w-48 h-2 bg-slate-800 mt-1"><div className="h-full bg-cyan-500" style={{width: `${(player.integrity/player.maxIntegrity)*100}%`}}></div></div>
                        </div>
                        <button 
                            onClick={onRepair}
                            disabled={!canRepair || repairCost === 0}
                            className="px-4 py-2 bg-slate-700 hover:bg-cyan-700 disabled:opacity-50 text-xs font-mono"
                        >
                            REPAIR ({repairCost} CR)
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Column: Upgrades */}
            <div className="bg-black/40 p-6 border border-emerald-800 h-96 overflow-y-auto custom-scrollbar">
                <h2 className="text-xl font-orbitron text-slate-200 mb-4">OUTFITTING</h2>
                <div className="space-y-4">
                    {upgrades.map(u => {
                        const cost = getUpgradeCost(u);
                        const canAfford = player.credits >= cost;
                        const isMax = u.level >= u.maxLevel;
                        return (
                            <div key={u.id} className="p-4 border border-slate-700 bg-slate-900/50 hover:border-emerald-500/50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-emerald-300 text-sm">{u.name}</h4>
                                    <span className="text-[10px] text-slate-500">LVL {u.level}/{u.maxLevel}</span>
                                </div>
                                <p className="text-xs text-slate-400 mb-3 leading-tight">{u.description}</p>
                                <button 
                                    onClick={() => onUpgrade(u.id)}
                                    disabled={!canAfford || isMax}
                                    className={`w-full py-1 text-xs font-bold uppercase tracking-wider
                                        ${isMax ? 'bg-slate-800 text-slate-600' : canAfford ? 'bg-emerald-900 text-emerald-200 hover:bg-emerald-700' : 'bg-red-900/20 text-red-500 opacity-50'}
                                    `}
                                >
                                    {isMax ? 'MAX INSTALLED' : `INSTALL (${cost} CR)`}
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex justify-end">
            <button 
                onClick={onUndock}
                className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-orbitron tracking-wider clip-path-polygon"
                style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
            >
                UNDOCK SHIP
            </button>
        </div>

      </div>
    </div>
  );
};

export default StationMenu;