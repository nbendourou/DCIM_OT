import React from 'react';
// FIX: Add AllData to the type imports.
import type { Rack, RackUtilization, AllData } from '../types.ts';
import { toNum, getRackPowerType } from '../utils/powerUtils.ts';

interface FloorPlanViewProps {
  racks: Rack[];
  utilizations: { [key: string]: RackUtilization };
  onSelectRack: (rack: Rack) => void;
  allData: AllData;
}

const RackCard: React.FC<{ 
    rack: Rack; 
    utilization: RackUtilization; 
    onClick: () => void;
    // FIX: Removed 'AC' type as it is not a valid return type for getRackPowerType.
    powerType: 'DC' | 'AC_TRI' | 'AC_MONO';
}> = ({ rack, utilization, onClick, powerType }) => {
    const percentage = utilization?.percentage || 0;
    const totalPower = utilization?.totalPower || 0;
    
    // Default color is slate for racks with 0 power
    let bgColor = 'bg-slate-700/40';
    let typeIndicator: React.ReactNode = null;

    // Apply specific colors only if power is consumed
    if (totalPower > 0) {
        switch (powerType) {
            case 'AC_MONO':
                bgColor = 'bg-sky-500/60 hover:bg-sky-400/60';
                typeIndicator = <div title="AC Monophasé" className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-sky-500 text-white rounded px-1.5 py-0.5 shadow-md">MONO</div>;
                break;
            case 'AC_TRI':
                bgColor = 'bg-green-500/60 hover:bg-green-400/60';
                typeIndicator = <div title="AC Triphasé" className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-green-500 text-white rounded px-1.5 py-0.5 shadow-md">TRI</div>;
                break;
            case 'DC':
                bgColor = 'bg-violet-500/60 hover:bg-violet-400/60';
                typeIndicator = <div title="DC" className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-violet-500 text-white rounded px-1.5 py-0.5 shadow-md">DC</div>;
                break;
        }
    }


    let borderColor = 'border-transparent';
    let animationClass = '';
    if (percentage > 90) {
        borderColor = 'border-danger-red';
        animationClass = 'animate-pulse';
    } else if (percentage > 80) {
        borderColor = 'border-warning-orange';
    }
    
    const is800mm = rack.dimensions?.includes('800');
    const widthClass = is800mm ? 'w-20' : 'w-16';

    return (
        <div
            onClick={onClick}
            className={`relative flex-shrink-0 ${widthClass} h-28 p-2 rounded-md ${bgColor} border-2 ${borderColor} ${animationClass} cursor-pointer transition-all flex flex-col justify-between items-center text-center`}
            title={`${rack.designation}\nPuissance: ${utilization?.totalPower.toFixed(2)} kW`}
        >
            {typeIndicator}
            <p className="text-xs font-bold text-slate-200">{utilization?.totalPower.toFixed(1)} kW</p>
            <div className="font-bold text-slate-100 text-lg">{percentage.toFixed(0)}%</div>
            <p className="text-sm font-semibold text-slate-400">{rack.numero_baie}</p>
        </div>
    );
};

const FloorPlanView: React.FC<FloorPlanViewProps> = ({ racks, utilizations, onSelectRack, allData }) => {
    const rows = [...new Set(racks.map(r => r.rangee))].sort();

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-200">Plan de Salle</h3>
            {rows.map(row => {
                const racksInRow = racks.filter(r => r.rangee === row).sort((a, b) => toNum(a.numero_baie) - toNum(b.numero_baie));
                if (racksInRow.length === 0) return null;

                return (
                    <div key={row} className="bg-slate-800 p-4 rounded-lg">
                        <h4 className="text-md font-bold text-slate-300 mb-4">Rangée {row}</h4>
                        <div className="flex flex-nowrap gap-3 overflow-x-auto pb-3 -mb-3">
                            {racksInRow.map(rack => (
                                <RackCard
                                    key={rack.id}
                                    rack={rack}
                                    utilization={utilizations[rack.id]}
                                    onClick={() => onSelectRack(rack)}
                                    // FIX: Pass the required `allData` argument to getRackPowerType.
                                    powerType={getRackPowerType(rack, allData)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
             {rows.length === 0 && (
                <div className="text-center text-slate-500 py-8">
                    Aucune baie à afficher pour cette salle.
                </div>
            )}
        </div>
    );
};

export default FloorPlanView;