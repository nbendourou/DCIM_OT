import React from 'react';
import type { ChainLoad, Capacities } from '../types.ts';
import { PowerIcon, WarningIcon, ArrowRightIcon } from './icons.tsx';

interface TdhqPanelProps {
  chainLoads: { [key: string]: ChainLoad };
  onToggleChain: (chain: string) => void;
  downedChains: string[];
  capacities: Capacities;
}

const ProgressBar: React.FC<{ value: number; capacity: number }> = ({ value, capacity }) => {
  const percentage = capacity > 0 ? (value / capacity) * 100 : 0;
  let bgColor = 'bg-ok-green';
  if (percentage > 90) {
    bgColor = 'bg-danger-red';
  } else if (percentage > 80) {
    bgColor = 'bg-warning-orange';
  }

  return (
    <div className="w-full bg-slate-700 rounded-full h-4">
      <div
        className={`${bgColor} h-4 rounded-full transition-all duration-500`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      ></div>
    </div>
  );
};

const ChainCard: React.FC<{
  chain: string;
  load: ChainLoad;
  isDown: boolean;
  onToggle: () => void;
  capacity: number;
}> = ({ chain, load, isDown, onToggle, capacity }) => {
  const totalLoad = load.final_p1 + load.final_p2 + load.final_p3;
  const totalCapacity = capacity * 3;
  const isOverloaded = load.final_p1 > capacity || load.final_p2 > capacity || load.final_p3 > capacity;

  return (
    <div className={`rounded-lg shadow-lg overflow-hidden transition-all duration-300 border ${isDown ? 'bg-slate-800 opacity-60 border-slate-700' : 'bg-slate-800 border-slate-700'}`}>
      <div className={`p-4 flex justify-between items-center ${isDown ? 'bg-slate-700' : 'bg-slate-700/50'}`}>
        <div className="flex items-center">
          <PowerIcon className="w-8 h-8 text-primary" />
          <h3 className="ml-3 text-2xl font-bold text-slate-100">Chaîne {chain}</h3>
          {isOverloaded && !isDown && <WarningIcon className="w-6 h-6 ml-3 text-danger-red animate-pulse" />}
        </div>
        <button
          onClick={onToggle}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${isDown ? 'bg-ok-green text-white hover:bg-green-600' : 'bg-danger-red text-white hover:bg-red-700'}`}
        >
          {isDown ? 'Démarrer' : 'Arrêter'}
        </button>
      </div>
      
      <div className="p-4 space-y-4">
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-sm font-medium text-slate-300">Charge Totale</span>
            <span className="text-lg font-bold text-slate-100">{totalLoad.toFixed(2)} kW</span>
          </div>
          <ProgressBar value={totalLoad} capacity={totalCapacity} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          {['p1', 'p2', 'p3'].map((phaseKey, index) => (
            <div key={phaseKey} className="bg-slate-900 p-3 rounded-md">
              <p className="text-sm text-slate-400">Phase {index + 1}</p>
              <p className={`text-xl font-bold ${load[`final_${phaseKey}` as keyof ChainLoad] > capacity ? 'text-danger-red' : 'text-slate-100'}`}>
                {(load[`final_${phaseKey}` as keyof ChainLoad] as number).toFixed(2)} kW
              </p>
              <p className="text-xs text-slate-500">/ {capacity} kW</p>
            </div>
          ))}
        </div>

        <div className="text-xs text-slate-400 space-y-2 pt-2 border-t border-slate-700">
            <p className="flex justify-between"><span>Charge IT AC:</span> <span>{(load.it_p1 + load.it_p2 + load.it_p3).toFixed(2)} kW</span></p>
            <p className="flex justify-between"><span>Charge IT DC:</span> <span>{load.it_dc.toFixed(2)} kW</span></p>
            <p className="flex justify-between"><span>Autres Charges AC:</span> <span>{(load.other_p1 + load.other_p2 + load.other_p3).toFixed(2)} kW</span></p>
            <p className="flex justify-between"><span>Autres Charges DC:</span> <span>{load.other_dc.toFixed(2)} kW</span></p>
            {(load.transferred_p1 > 0 || load.transferred_p2 > 0 || load.transferred_p3 > 0 || load.transferred_dc > 0) &&
                <p className="flex justify-between items-center text-warning-orange font-semibold">
                    <span><ArrowRightIcon className="w-3 h-3 inline-block mr-1"/>Charge Basculée:</span> 
                    <span>{(load.transferred_p1 + load.transferred_p2 + load.transferred_p3 + load.transferred_dc).toFixed(2)} kW</span>
                </p>
            }
        </div>

      </div>
    </div>
  );
};


export const TdhqPanel: React.FC<TdhqPanelProps> = ({ chainLoads, onToggleChain, downedChains, capacities }) => {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4 text-slate-100">Vue d'Ensemble des Chaînes de Puissance</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Object.keys(chainLoads).map(chain => {
            const capacityKey = `upsChain${chain}_kW` as keyof Capacities;
            const capacity = (capacities[capacityKey] as number) || 0;
            return (
              <ChainCard
                key={chain}
                chain={chain}
                load={chainLoads[chain]}
                isDown={downedChains.includes(chain)}
                onToggle={() => onToggleChain(chain)}
                capacity={capacity}
              />
            );
        })}
      </div>
    </div>
  );
};
