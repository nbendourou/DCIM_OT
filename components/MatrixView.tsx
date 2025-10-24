import React, { useState, useMemo } from 'react';
import type { Rack, AllData, Capacities, RackUtilization, RackPowerAnomaly } from '../types.ts';
import { toNum, getRackPowerType } from '../utils/powerUtils.ts';
import { PowerIcon, WarningIcon } from './icons.tsx';

interface MatrixViewProps {
  racks: Rack[];
  onSelectRack: (rack: Rack) => void;
  allData: AllData;
  capacities: Capacities;
  utilizations: { [key: string]: RackUtilization };
  rackPowerAnomalies: { [key: string]: RackPowerAnomaly };
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
    <div className="w-full bg-slate-700 rounded-full h-2.5">
      <div className={`${bgColor} h-2.5 rounded-full`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
    </div>
  );
};

const RackCard: React.FC<{ 
    rack: Rack; 
    utilization: RackUtilization; 
    anomaly: RackPowerAnomaly | undefined;
    onClick: () => void;
    powerType: 'DC' | 'AC_TRI' | 'AC_MONO';
}> = ({ rack, utilization, anomaly, onClick, powerType }) => {
    const percentage = utilization?.percentage || 0;
    const totalPower = utilization?.totalPower || 0;

    // Default color is slate for racks with 0 power
    let bgColor = 'bg-slate-700/40 hover:bg-slate-600/60';
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
    
    let borderColor = 'border-slate-600';
    if (percentage > 90) {
        borderColor = 'border-danger-red';
    } else if (percentage > 80) {
        borderColor = 'border-warning-orange';
    }
    
    return (
        <div
            onClick={onClick}
            className={`relative p-3 rounded-md ${bgColor} border ${borderColor} cursor-pointer transition-all flex flex-col justify-between items-center text-center`}
            title={`${rack.designation}\nPuissance: ${utilization?.totalPower.toFixed(2)} kW`}
        >
            {typeIndicator}
            {anomaly?.hasAnomaly && (
                 <WarningIcon className="absolute top-1.5 right-1.5 w-4 h-4 text-warning-orange" title={anomaly.isOverPower ? `Écart de puissance: ${anomaly.powerDifferenceKw.toFixed(2)} kW` : `Déséquilibre de phase > 20%`} />
            )}
            <p className="text-xs font-bold text-slate-200 h-8 break-words leading-tight flex items-center justify-center">
                {rack.designation}
                <span className="text-slate-400 ml-1">({rack.numero_baie})</span>
            </p>
            <p className="text-lg font-bold text-slate-100 my-1">{percentage.toFixed(0)}%</p>
            <p className="text-xs font-semibold text-slate-400">{utilization?.totalPower.toFixed(1)} kW</p>
        </div>
    );
};


const MatrixView: React.FC<MatrixViewProps> = ({ racks, onSelectRack, allData, capacities, utilizations, rackPowerAnomalies }) => {
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const rows = useMemo(() => {
        const rowMap: { [key: string]: { racks: Rack[], totalAC: number, totalDC: number } } = {};
        racks.forEach(rack => {
            if (!rowMap[rack.rangee]) {
                rowMap[rack.rangee] = { racks: [], totalAC: 0, totalDC: 0 };
            }
            rowMap[rack.rangee].racks.push(rack);
            rowMap[rack.rangee].totalAC += toNum(rack.conso_baie_v1_ph1_kw) + toNum(rack.conso_baie_v1_ph2_kw) + toNum(rack.conso_baie_v1_ph3_kw) + toNum(rack.conso_baie_v2_ph1_kw) + toNum(rack.conso_baie_v2_ph2_kw) + toNum(rack.conso_baie_v2_ph3_kw);
            rowMap[rack.rangee].totalDC += toNum(rack.conso_baie_v1_dc_kw) + toNum(rack.conso_baie_v2_dc_kw);
        });
        return Object.entries(rowMap).sort(([a], [b]) => a.localeCompare(b));
    }, [racks]);

    if (racks.length === 0) {
        return <div className="text-center text-slate-500 py-16">Aucune baie à afficher.</div>;
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Matrice des Rangées</h3>
            {rows.map(([row, data]) => (
                <div key={row} className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                    <div
                        className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer hover:bg-slate-700/50 transition-colors"
                        onClick={() => setExpandedRow(expandedRow === row ? null : row)}
                    >
                        <div className="flex items-center mb-3 md:mb-0">
                            <div className="bg-primary text-white w-12 h-12 flex items-center justify-center rounded-lg text-2xl font-bold mr-4">{row}</div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-100">Rangée {row}</h4>
                                <p className="text-sm text-slate-400">{data.racks.length} Baies</p>
                            </div>
                        </div>
                        <div className="w-full md:w-3/5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="font-semibold text-slate-300">Charge AC</span>
                                    <span>{data.totalAC.toFixed(2)} / {capacities.rowAC_kW.toFixed(1)} kW</span>
                                </div>
                                <ProgressBar value={data.totalAC} capacity={capacities.rowAC_kW} />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="font-semibold text-slate-300">Charge DC</span>
                                    <span>{data.totalDC.toFixed(2)} / {capacities.rowDC_kW.toFixed(1)} kW</span>
                                </div>
                                <ProgressBar value={data.totalDC} capacity={capacities.rowDC_kW} />
                            </div>
                        </div>
                    </div>
                    {expandedRow === row && (
                        <div className="p-4 border-t border-slate-700 bg-slate-900/30">
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4">
                                {data.racks.sort((a,b) => toNum(a.numero_baie) - toNum(b.numero_baie)).map(rack => (
                                    <RackCard 
                                        key={rack.id}
                                        rack={rack}
                                        utilization={utilizations[rack.id]}
                                        anomaly={rackPowerAnomalies[rack.id]}
                                        onClick={() => onSelectRack(rack)}
                                        powerType={getRackPowerType(rack, allData)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default MatrixView;
