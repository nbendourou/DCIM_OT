import React, { useState, useMemo, useEffect } from 'react';
import type { AllData, Capacities, Rack, RackPowerAnomaly } from '../types.ts';
import Header from './Header.tsx';
import MatrixView from './MatrixView.tsx';
import RoomPowerView from './RoomPowerView.tsx';
import { usePowerCalculations } from '../hooks/usePowerCalculations.ts';

interface RoomsProps {
  allData: AllData;
  capacities: Capacities;
  onSelectRack: (rack: Rack) => void;
  rackPowerAnomalies: { [key: string]: RackPowerAnomaly };
}

const Rooms: React.FC<RoomsProps> = ({ allData, capacities, onSelectRack, rackPowerAnomalies }) => {
  const rooms = useMemo(() => {
    if (!allData?.racks) return [];
    const roomSet = new Set(allData.racks.map(r => r.salle));
    return Array.from(roomSet).sort();
  }, [allData]);

  const [selectedRoom, setSelectedRoom] = useState<string | null>(rooms.length > 0 ? rooms[0] : null);
  
  const { rackUtilizations } = usePowerCalculations(allData, capacities);

  useEffect(() => {
      if (!selectedRoom && rooms.length > 0) {
          setSelectedRoom(rooms[0]);
      }
      if(selectedRoom && !rooms.includes(selectedRoom)){
          setSelectedRoom(rooms.length > 0 ? rooms[0] : null);
      }
  }, [rooms, selectedRoom]);

  const racksInSelectedRoom = useMemo(() => {
    if (!selectedRoom || !allData?.racks) return [];
    return allData.racks.filter(r => r.salle === selectedRoom);
  }, [allData, selectedRoom]);

  if (!allData) return null;

  return (
    <>
      <Header title="Gestion des Salles" />
      <div className="mt-6">
        <div className="flex border-b border-slate-700">
          {rooms.map(room => (
            <button
              key={room}
              onClick={() => setSelectedRoom(room)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                selectedRoom === room
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Salle {room}
            </button>
          ))}
        </div>
        
        {selectedRoom ? (
          <div className="mt-6 space-y-8">
            <RoomPowerView 
                racksInRoom={racksInSelectedRoom} 
                roomName={selectedRoom.toUpperCase()} 
                capacities={capacities}
            />

            <MatrixView
                racks={racksInSelectedRoom}
                utilizations={rackUtilizations}
                onSelectRack={onSelectRack}
                allData={allData}
                capacities={capacities}
                rackPowerAnomalies={rackPowerAnomalies}
            />
          </div>
        ) : (
             <div className="text-center text-slate-500 py-16">
                 {rooms.length > 0 ? "Veuillez sélectionner une salle." : "Aucune salle n'a été trouvée dans les données."}
            </div>
        )}
      </div>
    </>
  );
};

export default Rooms;
