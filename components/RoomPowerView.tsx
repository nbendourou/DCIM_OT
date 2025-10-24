import React from 'react';
import type { Rack, Capacities } from '../types.ts';
import { toNum } from '../utils/powerUtils.ts';
import { PowerIcon } from './icons.tsx';

interface RoomPowerViewProps {
  racksInRoom: Rack[];
  roomName: string;
  capacities: Capacities;
}

const Stat: React.FC<{ label: string; value: string; unit: string; }> = ({ label, value, unit }) => (
    <div className="bg-slate-900/50 p-3 rounded-lg text-center">
        <p className="text-sm text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        <p className="text-xs text-slate-500">{unit}</p>
    </div>
);

const RoomPowerView: React.FC<RoomPowerViewProps> = ({ racksInRoom, roomName, capacities }) => {
    const totalAC = racksInRoom.reduce((sum, r) => sum + toNum(r.conso_baie_v1_ph1_kw) + toNum(r.conso_baie_v1_ph2_kw) + toNum(r.conso_baie_v1_ph3_kw) + toNum(r.conso_baie_v2_ph1_kw) + toNum(r.conso_baie_v2_ph2_kw) + toNum(r.conso_baie_v2_ph3_kw), 0);
    const totalDC = racksInRoom.reduce((sum, r) => sum + toNum(r.conso_baie_v1_dc_kw) + toNum(r.conso_baie_v2_dc_kw), 0);
    const totalPower = totalAC + totalDC;
    
    const capacityKey = `room${roomName}_kW` as keyof Capacities;
    const roomCapacity = (capacities[capacityKey] as number) || 0;
    
    const percentage = roomCapacity > 0 ? (totalPower / roomCapacity) * 100 : 0;

    let bgColor = 'bg-ok-green';
    if (percentage > 90) {
        bgColor = 'bg-danger-red';
    } else if (percentage > 80) {
        bgColor = 'bg-warning-orange';
    }

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
      <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center">
          <PowerIcon className="w-6 h-6 mr-3 text-primary"/>
          Résumé Électrique - Salle {roomName}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Stat label="Charge Totale" value={totalPower.toFixed(2)} unit="kW" />
        <Stat label="Charge AC" value={totalAC.toFixed(2)} unit="kW" />
        <Stat label="Charge DC" value={totalDC.toFixed(2)} unit="kW" />
      </div>
       <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-sm font-medium text-slate-300">Utilisation de la Capacité de la Salle</span>
            <span className="text-lg font-bold text-slate-100">
                {totalPower.toFixed(2)} kW / <span className="text-base font-normal text-slate-400">{roomCapacity.toFixed(2)} kW</span>
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-4">
              <div
                className={`${bgColor} h-4 rounded-full transition-all duration-500 flex items-center justify-center text-xs font-bold text-white`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              >
                  {percentage.toFixed(1)}%
              </div>
          </div>
       </div>
    </div>
  );
};

export default RoomPowerView;
