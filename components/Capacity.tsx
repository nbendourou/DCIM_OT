import React, { useState, useEffect, useMemo } from 'react';
import type { AllData, Capacities, DCPanel, Equipment, Rack, DCConnection, ACConnection } from '../types.ts';
import Header from './Header.tsx';
import { usePowerCalculations } from '../hooks/usePowerCalculations.ts';
import { TdhqPanel } from './TdhqPanel.tsx';
import { toNum } from '../utils/powerUtils.ts';

interface CapacityProps {
  allData: AllData;
  capacities: Capacities;
}

const ProgressBar: React.FC<{ value: number; capacity: number; }> = ({ value, capacity }) => {
  const percentage = capacity > 0 ? (value / capacity) * 100 : 0;
  let bgColor = 'bg-ok-green';
  if (percentage > 90) {
    bgColor = 'bg-danger-red';
  } else if (percentage > 80) {
    bgColor = 'bg-warning-orange';
  }

  return (
    <div className="w-full bg-slate-700 rounded-full h-4 relative">
      <div
        className={`${bgColor} h-4 rounded-full transition-all duration-500 flex items-center justify-center text-xs font-bold text-white`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      >
      {percentage > 10 && `${percentage.toFixed(1)}%`}
      </div>
    </div>
  );
};

// --- TYPE DEFINITIONS for calculated data structures ---
interface DetailedConnection {
    rackName: string;
    equipmentName: string;
    primaryPanel: string;
    primaryPower: number;
    redundantPanel: string;
    redundantPower: number;
}
interface CalculatedPanel {
    id: string;
    designation: string;
    chaine: string;
    rawPanel: DCPanel;
    ownPower: number;
    failoverPotentialPower: number;
    failoverActivePower: number;
    simulatedLoad: number;
    detailedConnections: DetailedConnection[];
}
interface CalculatedRectifier {
    id: string;
    totalPowerOnFailure: number;
    panels: CalculatedPanel[];
}

// --- NEW TYPE DEFINITIONS FOR AC ANALYSIS ---
interface PairedAcConnection {
    equipment: Equipment;
    rack: Rack;
    primary: ACConnection;
    redundant?: ACConnection;
}

interface CalculatedCanalis {
    id: string;
    ownPower: number;
    failoverPower: number;
    totalOnFailure: number;
    // Store detailed connection pairs for the report
    connectionPairs: PairedAcConnection[];
}


const AcCanalisCapacity: React.FC<{ allData: AllData, capacities: Capacities }> = ({ allData, capacities }) => {
    
    const calculatedAcData = useMemo(() => {
        const canalisCalculations = new Map<string, CalculatedCanalis>();
        const boxToCanalis = new Map<string, string>(allData.boitiersAC.map(box => [box.id, box.canalis]));
        const equipmentMap = new Map<string, Equipment>(allData.equipements.map(e => [e.id, e]));
        const rackMap = new Map<string, Rack>(allData.racks.map(r => [r.id, r]));

        // Group connections by equipment to find pairs
        const connectionsByEquipment = new Map<string, { voie1: ACConnection[], voie2: ACConnection[] }>();
        allData.connexionsAC.forEach(conn => {
            if (!connectionsByEquipment.has(conn.equipment_fk)) {
                connectionsByEquipment.set(conn.equipment_fk, { voie1: [], voie2: [] });
            }
            const entry = connectionsByEquipment.get(conn.equipment_fk)!;
            if (conn.voie === '1') entry.voie1.push(conn);
            else if (conn.voie === '2') entry.voie2.push(conn);
        });

        // Process paired connections to calculate own and failover power
        connectionsByEquipment.forEach((conns, equipmentId) => {
            const equipment = equipmentMap.get(equipmentId);
            if (!equipment) return;
            const rack = rackMap.get(equipment.rack_fk);
            if (!rack) return;

            const maxConns = Math.max(conns.voie1.length, conns.voie2.length);
            for (let i = 0; i < maxConns; i++) {
                const conn1 = conns.voie1[i];
                const conn2 = conns.voie2[i];
                
                const canalis1 = conn1 ? boxToCanalis.get(conn1.ac_box_fk) : undefined;
                const canalis2 = conn2 ? boxToCanalis.get(conn2.ac_box_fk) : undefined;
                
                const power1 = toNum(conn1?.puissance_kw);
                const power2 = toNum(conn2?.puissance_kw);

                // Helper to initialize and update canalis data
                const updateCanalis = (id: string, own: number, failover: number, primaryConn: ACConnection, redundantConn?: ACConnection) => {
                    if (!canalisCalculations.has(id)) {
                        canalisCalculations.set(id, { id, ownPower: 0, failoverPower: 0, totalOnFailure: 0, connectionPairs: [] });
                    }
                    const entry = canalisCalculations.get(id)!;
                    entry.ownPower += own;
                    entry.failoverPower += failover;
                    entry.connectionPairs.push({ equipment, rack, primary: primaryConn, redundant: redundantConn });
                };

                if (canalis1 && conn1) {
                    updateCanalis(canalis1, power1, canalis1 !== canalis2 ? power2 : 0, conn1, conn2);
                }
                if (canalis2 && conn2) {
                    updateCanalis(canalis2, power2, canalis1 !== canalis2 ? power1 : 0, conn2, conn1);
                }
            }
        });

        canalisCalculations.forEach(canalis => {
            canalis.totalOnFailure = canalis.ownPower + canalis.failoverPower;
        });

        return Array.from(canalisCalculations.values()).sort((a,b) => a.id.localeCompare(b.id));

    }, [allData]);

    const generateCanalisReport = (canalisData: CalculatedCanalis) => {
        // @ts-ignore
        const { jsPDF } = window.jspdf;
        // FIX: Changed orientation to landscape to provide more space for the new columns in the report.
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        doc.setFontSize(18);
        doc.text(`Rapport de Charge (N+1) - Canalis ${canalisData.id}`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, 280, 15, { align: 'right' });

        const capacity = 160;
        const percentage = capacity > 0 ? (canalisData.totalOnFailure / capacity) * 100 : 0;
        let color = '#22c55e'; // green
        if (percentage > 90) color = '#ef4444'; // red
        else if (percentage > 80) color = '#f97316'; // orange

        doc.setFontSize(12);
        doc.text("Résumé de la Charge", 14, 30);
        // @ts-ignore
        doc.autoTable({
            body: [
                ['Charge propre (phase normale):', `${canalisData.ownPower.toFixed(2)} kW`],
                ['Charge de basculement:', `${canalisData.failoverPower.toFixed(2)} kW`],
                [{ content: 'Puissance totale en cas de perte de redondance:', styles: { fontStyle: 'bold' } }, { content: `${canalisData.totalOnFailure.toFixed(2)} kW`, styles: { fontStyle: 'bold' } }],
            ],
            startY: 34, theme: 'plain', styles: { fontSize: 10 }, tableWidth: 120,
        });

        doc.setDrawColor('#cbd5e1');
        doc.rect(14, 58, 100, 5); // BG
        doc.setFillColor(color);
        doc.rect(14, 58, Math.min(100, (100 * percentage) / 100), 5, 'F'); // FG
        doc.setFontSize(10);
        doc.text(`${percentage.toFixed(1)}%`, 118, 62);
        
        let lastY = 70;

        const equipmentDetails = canalisData.connectionPairs
            .map(({ equipment, rack, primary, redundant }) => ({
                equipmentName: equipment.nom_equipement,
                rackName: `${rack.designation} (${rack.numero_baie})`,
                primaryBox: primary.ac_box_fk,
                primaryPower: toNum(primary.puissance_kw).toFixed(2) + ' kW',
                redundantBox: redundant?.ac_box_fk || 'N/A',
                redundantPower: toNum(redundant?.puissance_kw).toFixed(2) + ' kW',
            }))
            .sort((a,b) => a.primaryBox.localeCompare(b.primaryBox) || a.rackName.localeCompare(b.rackName) || a.equipmentName.localeCompare(b.equipmentName));
        
        doc.setFontSize(14);
        doc.text(`Équipements alimentés par le Canalis ${canalisData.id}`, 14, lastY);
        lastY += 6;

        const head = [['Baie', 'Équipement', `Boîtier AC (sur ${canalisData.id})`, 'Puissance Principale', 'Boîtier AC (Voie Redondante)', 'Puissance Redondante']];
        const body = equipmentDetails.map(d => [d.rackName, d.equipmentName, d.primaryBox, d.primaryPower, d.redundantBox, d.redundantPower]);
        
        // @ts-ignore
        doc.autoTable({
            head, body, startY: lastY, theme: 'grid', headStyles: { fillColor: [30, 41, 59] },
            columnStyles: { 3: { halign: 'right' }, 5: { halign: 'right' } }
        });

        const pageCount = doc.internal.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor('#f97316');
            doc.text("Orange Restricted", 14, pageHeight - 10);
            doc.setTextColor(150);
            doc.text(`Page ${i} sur ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
        }

        doc.save(`Rapport_Canalis_${canalisData.id}.pdf`);
    };

    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
            <h3 className="text-lg font-bold text-slate-100 mb-2">Capacité des Canalis AC (N+1)</h3>
            <p className="text-sm text-slate-400 mb-4">
                Analyse de la charge maximale sur chaque canalis en cas de perte de la voie redondante. Capacité de référence: 160kW.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {calculatedAcData.map((data) => (
                    <div key={data.id} className="bg-slate-900/50 p-4 rounded-md cursor-pointer hover:bg-slate-700/50" onClick={() => generateCanalisReport(data)}>
                        <div className="flex justify-between items-baseline mb-1">
                            <span className="font-bold text-lg text-primary">{data.id}</span>
                             <span className="text-slate-400 font-mono text-xs text-right">
                                {data.ownPower.toFixed(2)}kW (+{data.failoverPower.toFixed(2)}kW) = <span className="font-bold text-white text-sm">{data.totalOnFailure.toFixed(2)} kW</span>
                            </span>
                        </div>
                        <ProgressBar value={data.totalOnFailure} capacity={160} />
                    </div>
                ))}
                 {calculatedAcData.length === 0 && <p className="text-slate-500 text-sm">Aucune donnée de connexion AC trouvée pour l'analyse.</p>}
            </div>
        </div>
    );
};


const RectifierCard: React.FC<{
    rectifier: CalculatedRectifier;
    onClick: () => void;
}> = ({ rectifier, onClick }) => (
    <div 
        key={rectifier.id} 
        className="bg-slate-900/50 p-4 rounded-md cursor-pointer hover:bg-slate-700/50 transition-colors border border-slate-700 flex flex-col"
        onClick={onClick}
        title={`Cliquer pour générer le rapport pour ${rectifier.id}`}
    >
       <div className="flex justify-between items-baseline mb-1">
            <h4 className="font-bold text-primary flex-1 truncate pr-2">{rectifier.id}</h4>
            <span className="font-semibold text-slate-100">
                {rectifier.totalPowerOnFailure.toFixed(2)} kW / <span className="text-sm text-slate-400">80 kW</span>
            </span>
       </div>
       <ProgressBar value={rectifier.totalPowerOnFailure} capacity={80} />
       <div className="space-y-4 mt-4 pt-4 border-t border-slate-700/50">
           {rectifier.panels.map(panel => {
               const panelFailoverCapacity = 40;
               const totalOnFailure = panel.ownPower + panel.failoverPotentialPower;
               return (
                   <div key={panel.id}>
                        <div className="flex justify-between items-baseline text-sm mb-1">
                            <span className="font-semibold text-slate-200">{panel.id}</span>
                            <span className="text-slate-400 font-mono text-xs text-right">
                                {panel.ownPower.toFixed(2)}kW (+{panel.failoverPotentialPower.toFixed(2)}kW) = <span className="font-bold text-white text-sm">{totalOnFailure.toFixed(2)} kW</span>
                            </span>
                        </div>
                        <ProgressBar value={totalOnFailure} capacity={panelFailoverCapacity} />
                   </div>
               )
            })}
       </div>
    </div>
);


const Capacity: React.FC<CapacityProps> = ({ allData, capacities }) => {
  const [downedChains, setDownedChains] = useState<string[]>([]);
  const { chainLoads, calculateChainLoads } = usePowerCalculations(allData, capacities);
  const [selectedRoom, setSelectedRoom] = useState<string | 'all'>('all');
  
  const rooms = useMemo(() => ['all', ...[...new Set(allData.racks.map(r => r.salle))].sort()], [allData.racks]);
  
  useEffect(() => {
    calculateChainLoads(downedChains);
  }, [downedChains, allData, calculateChainLoads]);

  const toggleChain = (chain: string) => {
    setDownedChains(prev =>
      prev.includes(chain) ? prev.filter(c => c !== chain) : [...prev, chain]
    );
  };
  
   // FIX: Extracted connection pairing logic into its own useMemo hook so it can be shared with generateRectifierReport.
   const connectionPairs = useMemo(() => {
    const pairs = new Map<string, DCConnection | undefined>();
    const connectionsByEquipment = new Map<string, { voie1: DCConnection[], voie2: DCConnection[] }>();
    allData.connexionsDC.forEach(conn => {
        if (!connectionsByEquipment.has(conn.equipment_fk)) {
            connectionsByEquipment.set(conn.equipment_fk, { voie1: [], voie2: [] });
        }
        const entry = connectionsByEquipment.get(conn.equipment_fk)!;
        if (conn.voie === '1') entry.voie1.push(conn);
        else if (conn.voie === '2') entry.voie2.push(conn);
    });

    connectionsByEquipment.forEach(entry => {
        const v1Sorted = [...entry.voie1].sort((a, b) => a.id.localeCompare(b.id));
        const v2Sorted = [...entry.voie2].sort((a, b) => a.id.localeCompare(b.id));
        const len = Math.max(v1Sorted.length, v2Sorted.length);
        for (let i = 0; i < len; i++) {
            const v1 = v1Sorted[i];
            const v2 = v2Sorted[i];
            if (v1 && v2) {
                pairs.set(v1.id, v2);
                pairs.set(v2.id, v1);
            }
        }
    });
    return pairs;
  }, [allData.connexionsDC]);
  
   const calculatedDcData = useMemo(() => {
        const rectifiersByRoom = new Map<string, Map<string, CalculatedRectifier>>();
        const equipmentMap = new Map<string, Equipment>(allData.equipements.map(e => [e.id, e]));
        const rackMap = new Map<string, Rack>(allData.racks.map(r => [r.id, r]));

        allData.tableauxDC.forEach(panel => {
            const room = panel.salle;
            const idParts = panel.id.split('.');
            if (idParts.length < 5) return;
            const rectifierId = idParts.slice(0, -1).join('.');

            if (!rectifiersByRoom.has(room)) rectifiersByRoom.set(room, new Map());
            const roomRectifiers = rectifiersByRoom.get(room)!;

            if (!roomRectifiers.has(rectifierId)) {
                roomRectifiers.set(rectifierId, { id: rectifierId, totalPowerOnFailure: 0, panels: [] });
            }
            const rectifier = roomRectifiers.get(rectifierId)!;

            if (!rectifier.panels.some(p => p.id === panel.id)) {
                 rectifier.panels.push({
                    id: panel.id, designation: panel.designation, chaine: panel.chaine, rawPanel: panel,
                    ownPower: 0, failoverPotentialPower: 0, failoverActivePower: 0, simulatedLoad: 0, detailedConnections: [],
                });
            }
        });
        
        allData.connexionsDC.forEach(conn => {
            const equipment = equipmentMap.get(conn.equipment_fk);
            if (!equipment) return;
            const rack = rackMap.get(equipment.rack_fk);
            if (!rack) return;

            const primaryPanel = allData.tableauxDC.find(p => p.id === conn.dc_panel_fk);
            if (!primaryPanel) return;
            
            const idParts = primaryPanel.id.split('.');
            if (idParts.length < 5) return;
            const rectifierId = idParts.slice(0, -1).join('.');
            const rectifier = rectifiersByRoom.get(primaryPanel.salle)?.get(rectifierId);
            if (!rectifier) return;
            
            const calcPanel = rectifier.panels.find(p => p.id === primaryPanel.id);
            if (!calcPanel) return;
            
            const power = toNum(conn.puissance_kw);
            calcPanel.ownPower += power;

            const redundantConnection = connectionPairs.get(conn.id);
            const redundantPower = toNum(redundantConnection?.puissance_kw);
            const redundantPanel = redundantConnection ? allData.tableauxDC.find(p => p.id === redundantConnection.dc_panel_fk) : undefined;
            const redundantChain = redundantPanel ? redundantPanel.chaine : 'N/A';
            
            calcPanel.failoverPotentialPower += redundantPower;
            
            if (downedChains.includes(redundantChain) && !downedChains.includes(calcPanel.chaine)) {
                calcPanel.failoverActivePower += redundantPower;
            }
            
            // Group connections by equipment to show one line per equipment in the report
            const existingDetail = calcPanel.detailedConnections.find(d => d.equipmentName === equipment.nom_equipement && d.rackName === rack.designation);

            if (existingDetail) {
                 if (conn.voie === '1') {
                    existingDetail.primaryPower += power;
                    existingDetail.redundantPower += redundantPower;
                 } else {
                    existingDetail.primaryPower += power;
                    existingDetail.redundantPower += redundantPower;
                 }
            } else {
                 calcPanel.detailedConnections.push({
                    rackName: rack.designation,
                    equipmentName: equipment.nom_equipement,
                    primaryPanel: conn.dc_panel_fk,
                    primaryPower: power,
                    redundantPanel: redundantPanel?.id || 'N/A',
                    redundantPower: redundantPower
                });
            }
        });

        rectifiersByRoom.forEach(roomRectifiers => {
            roomRectifiers.forEach(rectifier => {
                rectifier.panels.forEach(panel => {
                    panel.simulatedLoad = panel.ownPower + panel.failoverActivePower;
                    panel.detailedConnections.sort((a,b) => a.rackName.localeCompare(b.rackName) || a.equipmentName.localeCompare(b.equipmentName));
                });
                rectifier.totalPowerOnFailure = rectifier.panels.reduce((sum, p) => sum + p.ownPower + p.failoverPotentialPower, 0);
            });
        });
        
        return rectifiersByRoom;
   }, [allData, downedChains, connectionPairs]);
   
   const generateRectifierReport = (rectifier: CalculatedRectifier) => {
        // @ts-ignore
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text(`Rapport de Charge (N+1) - Redresseur ${rectifier.id}`, 14, 20);
        
        doc.setFontSize(10);
        doc.text(`Généré le: ${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })}`, 280, 15, { align: 'right' });
        
        let lastY = 30;

        rectifier.panels.forEach(panel => {
            if (lastY > 160) {
                doc.addPage();
                lastY = 20;
            }

            const totalOnFailure = panel.ownPower + panel.failoverPotentialPower;
            
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42); 
            doc.text(`Tableau de Distribution: ${panel.id}`, 14, lastY);
            lastY += 6;
            
            doc.setFontSize(10);
            doc.text(`Charge propre: ${panel.ownPower.toFixed(2)} kW | Charge de basculement: ${panel.failoverPotentialPower.toFixed(2)} kW`, 14, lastY);
            
            doc.setFontSize(10);
            doc.setTextColor(220, 38, 38); 
            doc.setFont(undefined, 'bold');
            doc.text(`Puissance totale en cas de perte de redondance: ${totalOnFailure.toFixed(2)} kW`, 280, lastY, { align: 'right' });
            doc.setFont(undefined, 'normal');
            doc.setTextColor(40, 40, 40);
            lastY += 8;
            
            const head = [['Baie', 'Équipement', 'Tableau Voie Primaire', 'Puissance V Primaire', 'Tableau Voie Redondante', 'Puissance V Redondante']];
            
            const allConnectionsForPanel = allData.connexionsDC.filter(conn => conn.dc_panel_fk === panel.id);
            const equipmentConnectionDetails = new Map<string, { equipment: Equipment, rack: Rack, primaryConns: DCConnection[], redundantConns: (DCConnection | undefined)[] }>();
            
            allConnectionsForPanel.forEach(conn => {
                const eq = allData.equipements.find(e => e.id === conn.equipment_fk);
                if (!eq) return;
                
                if (!equipmentConnectionDetails.has(eq.id)) {
                    const rack = allData.racks.find(r => r.id === eq.rack_fk);
                    if (rack) {
                        equipmentConnectionDetails.set(eq.id, { equipment: eq, rack, primaryConns: [], redundantConns: [] });
                    }
                }
                const entry = equipmentConnectionDetails.get(eq.id);
                if (entry) {
                    entry.primaryConns.push(conn);
                    entry.redundantConns.push(connectionPairs.get(conn.id));
                }
            });

            const body = Array.from(equipmentConnectionDetails.values())
                .sort((a,b) => a.rack.designation.localeCompare(b.rack.designation))
                .flatMap(({ equipment, rack, primaryConns }) => {
                // Display each connection on its own line
                return primaryConns.map(conn => {
                    const redundantConn = connectionPairs.get(conn.id);
                    return [
                        rack.designation,
                        equipment.nom_equipement,
                        conn.dc_panel_fk,
                        `${toNum(conn.puissance_kw).toFixed(2)} kW`,
                        redundantConn?.dc_panel_fk || 'N/A',
                        `${toNum(redundantConn?.puissance_kw).toFixed(2)} kW`
                    ];
                });
            });


            (doc as any).autoTable({
                head: head, body: body, startY: lastY, theme: 'grid',
                headStyles: { fillColor: [30, 41, 59] }, styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: { 3: { halign: 'right' }, 5: { halign: 'right' } }
            });

            lastY = (doc as any).lastAutoTable.finalY + 15;
        });

        const pageCount = doc.internal.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor('#f97316');
            doc.text("Orange Restricted", 14, pageHeight - 10);
            doc.setTextColor(150);
            doc.text(`Page ${i} sur ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
        }

        doc.save(`Rapport_Redresseur_${rectifier.id}.pdf`);
   };

  return (
    <>
      <Header title="Capacité & Simulation de Pannes" />
      <div className="mt-6 space-y-8">
        <TdhqPanel chainLoads={chainLoads} onToggleChain={toggleChain} downedChains={downedChains} capacities={capacities} />
        
        <AcCanalisCapacity allData={allData} capacities={capacities} />

        <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
             <h3 className="text-lg font-bold text-slate-100 mb-2">Capacité des Redresseurs DC (N+1)</h3>
             <p className="text-sm text-slate-400 mb-4">
                Analyse de la charge maximale sur chaque tableau DC en cas de perte de la voie redondante. Capacité de référence: 40kW par tableau, 80kW par redresseur.
            </p>
            <div className="flex border-b border-slate-700 mb-4">
              {rooms.map(room => (
                <button
                  key={room}
                  onClick={() => setSelectedRoom(room)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${ selectedRoom === room ? 'border-b-2 border-primary text-primary' : 'text-slate-400 hover:text-white' }`}
                >
                  {room === 'all' ? 'Toutes les Salles' : `Salle ${room}`}
                </button>
              ))}
            </div>

            {Array.from(calculatedDcData.entries()).filter(([room]) => selectedRoom === 'all' || room === selectedRoom).map(([room, rectifiers]) => (
                <div key={room}>
                    <h4 className="text-xl font-bold text-primary mb-4 mt-4">{room}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* FIX: Add explicit types to sort callback parameters to resolve property access error on 'unknown'. */}
                        {Array.from(rectifiers.values()).sort((a: CalculatedRectifier, b: CalculatedRectifier) => a.id.localeCompare(b.id)).map((rectifier: CalculatedRectifier) => (
                             <RectifierCard key={rectifier.id} rectifier={rectifier} onClick={() => generateRectifierReport(rectifier)} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </>
  );
};

export default Capacity;