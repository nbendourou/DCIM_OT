

import React, { useMemo, useEffect } from 'react';
import { usePowerCalculations } from '../hooks/usePowerCalculations.ts';
import type { AllData, Capacities, Rack, ChainLoad, Equipment, DCConnection, RackUtilization, RackPowerAnomaly } from '../types.ts';
import Header from './Header.tsx';
import { toNum, parseRackDimensions } from '../utils/powerUtils.ts';
import { ServerIcon, WarningIcon, PowerIcon } from './icons.tsx';

const StatCard: React.FC<{ title: string; value: string; subtext?: string; icon: React.ReactNode; onClick?: () => void; }> = ({ title, value, subtext, icon, onClick }) => (
  <div 
    className={`bg-slate-800 p-4 rounded-lg shadow-lg flex items-center border border-slate-700 ${onClick ? 'cursor-pointer hover:bg-slate-700/50 transition-colors' : ''}`}
    onClick={onClick}
  >
    <div className="p-3 rounded-full bg-slate-700 mr-4">
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
    </div>
  </div>
);

const PhaseImbalanceCard: React.FC<{
  chain: string;
  load: ChainLoad;
  capacity: number;
  onClick: () => void;
}> = ({ chain, load, capacity, onClick }) => {
    const p1 = load.final_p1;
    const p2 = load.final_p2;
    const p3 = load.final_p3;

    const maxPhase = Math.max(p1, p2, p3);
    // Consider minPhase to be 0 if one of the phases has no load to avoid misleading imbalance percentages on partially loaded chains.
    const minPhase = (p1 > 0 && p2 > 0 && p3 > 0) ? Math.min(p1, p2, p3) : (maxPhase > 0 && (p1 === 0 || p2 === 0 || p3 === 0)) ? 0 : Math.min(p1, p2, p3);
    
    const imbalancePercent = maxPhase > 0 ? ((maxPhase - minPhase) / maxPhase) * 100 : 0;
    const isImbalanced = imbalancePercent > 20;

    return (
        <div 
            className="bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-700 cursor-pointer hover:bg-slate-700/50 transition-colors"
            onClick={onClick}
        >
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-lg text-slate-200">Chaîne {chain}</h4>
                {isImbalanced && (
                    <div className="flex items-center text-warning-orange text-sm font-semibold">
                        <WarningIcon className="w-5 h-5 mr-1" />
                        Déséquilibre: {imbalancePercent.toFixed(0)}%
                    </div>
                )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
                {[p1, p2, p3].map((phaseLoad, index) => (
                    <div key={index} className="bg-slate-900/50 p-2 rounded-md">
                        <p className="text-xs text-slate-400">Phase {index + 1}</p>
                        <p className={`text-lg font-bold ${phaseLoad > capacity ? 'text-danger-red' : 'text-slate-100'}`}>
                            {phaseLoad.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500">kW</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TopAnomaliesCard: React.FC<{
    topRacks: (Rack & { anomaly: RackPowerAnomaly })[];
    onSelectRack: (rack: Rack) => void;
}> = ({ topRacks, onSelectRack }) => {
    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Top 5 des Écarts de Consommation</h3>
            {topRacks.length > 0 ? (
                <div className="space-y-3">
                    {topRacks.map(({ rack, anomaly }) => (
                        <div 
                            key={rack.id} 
                            onClick={() => onSelectRack(rack)}
                            className="bg-slate-900/50 p-3 rounded-md hover:bg-slate-700/50 transition-colors cursor-pointer flex justify-between items-center"
                        >
                            <div>
                                <p className="font-semibold text-slate-200">{rack.designation}</p>
                                <p className="text-xs text-slate-400">{rack.salle} / {rack.rangee}</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-lg font-bold ${anomaly.isOverPower ? 'text-danger-red' : 'text-slate-100'}`}>
                                    {anomaly.powerDifferenceKw > 0 ? '+' : ''}{anomaly.powerDifferenceKw.toFixed(2)} kW
                                </p>
                                <p className="text-xs text-slate-400">
                                    Réel: {anomaly.totalReal.toFixed(2)} / Calc: {anomaly.totalCalculated.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-slate-500 text-center py-4">Aucune donnée de consommation réelle pour comparer.</p>
            )}
        </div>
    );
};


interface DashboardProps {
  allData: AllData;
  capacities: Capacities;
  onSelectRack: (rack: Rack) => void;
  rackPowerAnomalies: { [key: string]: RackPowerAnomaly };
}

const Dashboard: React.FC<DashboardProps> = ({ allData, capacities, onSelectRack, rackPowerAnomalies }) => {
  const { rackUtilizations, chainLoads, calculateChainLoads } = usePowerCalculations(allData, capacities);
  
  useEffect(() => {
      calculateChainLoads();
  }, [allData, calculateChainLoads]);

  const topAnomalyRacks = useMemo(() => {
    if (!allData || !rackPowerAnomalies) return [];

    return allData.racks
      .map(rack => ({ rack, anomaly: rackPowerAnomalies[rack.id] }))
      .filter(({ anomaly }) => anomaly && anomaly.totalReal > 0)
      .sort((a, b) => Math.abs(b.anomaly.powerDifferenceKw) - Math.abs(a.anomaly.powerDifferenceKw))
      .slice(0, 5);
  }, [allData, rackPowerAnomalies]);


  const rooms = useMemo<string[]>(() => {
    if (!allData?.racks) return [];
    return [...new Set(allData.racks.map(r => r.salle))].sort();
  }, [allData?.racks]);

  const dashboardStats = useMemo(() => {
    if (!allData || !rackUtilizations) {
      return { totalRacks: 0, highPowerRacks: 0, totalITPower: 0, totalOtherPower: 0, powerPerRoom: {} as { [key: string]: { ac: number; dc: number; total: number } }, physicalOccupancyPercent: 0, totalUUsed: 0, totalUAvailable: 0, heavyRacksCount: 0, heavyRacks: [], strandedPowerKw: 0, strandedSpaceU: 0 };
    }

    const totalRacks = allData.racks.length;
    const highPowerRacks = Object.values(rackUtilizations).filter((u: { percentage: number }) => u.percentage > 80).length;

    const powerPerRoom = rooms.reduce((acc: { [key: string]: { ac: number; dc: number; total: number } }, room) => {
      const racksInRoom = allData.racks.filter(r => r.salle === room);
      const ac = racksInRoom.reduce((sum: number, r) => sum + toNum(r.conso_baie_v1_ph1_kw) + toNum(r.conso_baie_v1_ph2_kw) + toNum(r.conso_baie_v1_ph3_kw) + toNum(r.conso_baie_v2_ph1_kw) + toNum(r.conso_baie_v2_ph2_kw) + toNum(r.conso_baie_v2_ph3_kw), 0);
      const dc = racksInRoom.reduce((sum: number, r) => sum + toNum(r.conso_baie_v1_dc_kw) + toNum(r.conso_baie_v2_dc_kw), 0);
      acc[room] = { ac, dc, total: ac + dc };
      return acc;
    }, {} as { [key: string]: { ac: number; dc: number; total: number } });

    const totalITPower = Object.values(powerPerRoom).reduce((sum: number, roomData: { total: number }) => sum + roomData.total, 0);
    const totalOtherPower = allData.autresConsommateurs.reduce((sum: number, c) => sum + toNum(c.acp1) + toNum(c.acp2) + toNum(c.acp3) + toNum(c.dc), 0);

    // Physical Occupancy
    const totalUAvailable = allData.racks.reduce((sum: number, rack) => sum + parseRackDimensions(rack.dimensions), 0);
    const totalUUsed = allData.equipements
        .filter(eq => eq.type_equipement !== 'PDU')
        .reduce((sum: number, eq) => sum + toNum(eq.hauteur_u), 0);
    const physicalOccupancyPercent = totalUAvailable > 0 ? (totalUUsed / totalUAvailable) * 100 : 0;

    // Heavy Racks
    const heavyRacks = allData.racks.map(rack => {
        const equipmentsInRack = allData.equipements.filter(eq => eq.rack_fk === rack.id);
        const currentWeight = equipmentsInRack.reduce((sum: number, eq) => sum + toNum(eq.poids_kg), 0);
        const maxWeight = toNum(rack.poids_max_kg);
        const weightPercent = maxWeight > 0 ? (currentWeight / maxWeight) * 100 : 0;
        return { rack, currentWeight, maxWeight, weightPercent };
    }).filter(r => r.weightPercent > 80);
    const heavyRacksCount = heavyRacks.length;

    // Stranded Capacity
    let strandedPowerKw = 0;
    let strandedSpaceU = 0;
    
    const rackPhysicalUsage = allData.racks.map(rack => {
        const totalU = parseRackDimensions(rack.dimensions);
        const usedU = allData.equipements
            .filter(eq => eq.rack_fk === rack.id && eq.type_equipement !== 'PDU')
            .reduce((sum: number, eq) => sum + toNum(eq.hauteur_u), 0);
        const uPercent = totalU > 0 ? (usedU / totalU) * 100 : 0;
        return { rackId: rack.id, totalU, usedU, uPercent };
    });

    rackPhysicalUsage.filter(r => r.uPercent > 95).forEach(r => {
        const utilization = rackUtilizations[r.rackId];
        if (utilization && utilization.capacity > utilization.totalPower) {
            strandedPowerKw += utilization.capacity - utilization.totalPower;
        }
    });

    Object.entries(rackUtilizations).filter(([, u]: [string, { percentage: number }]) => u.percentage > 80).forEach(([rackId]) => {
        const physical = rackPhysicalUsage.find(r => r.rackId === rackId);
        if (physical) {
            strandedSpaceU += physical.totalU - physical.usedU;
        }
    });

    return { totalRacks, highPowerRacks, totalITPower, totalOtherPower, powerPerRoom, physicalOccupancyPercent, totalUUsed, totalUAvailable, heavyRacksCount, heavyRacks, strandedPowerKw, strandedSpaceU };
  }, [allData, rackUtilizations, rooms]);

  const maxChartPower = useMemo(() => {
    const allTotals = Object.entries(dashboardStats.powerPerRoom).map(([roomName, p]: [string, { total: number }]) => {
        const capacityKey = `room${roomName}_kW` as keyof Capacities;
        const roomCapacity = capacities[capacityKey] as number || 500;
        return Math.max(p.total, roomCapacity);
    });
    if (allTotals.length === 0) return 500;
    const maxVal = Math.max(...allTotals);
    return Math.ceil(maxVal / 50) * 50 || 50;
  }, [dashboardStats.powerPerRoom, capacities]);

  const generateHighPowerRacksReport = () => {
    // @ts-ignore - jsPDF and autoTable are loaded from CDN
    const { jsPDF } = window.jspdf;
    
    const highPowerRacks = allData.racks
        .filter(rack => {
            const utilization = rackUtilizations[rack.id];
            return utilization && utilization.percentage > 80;
        })
        // FIX: Add type assertion to resolve 'unknown' type error. The filter above ensures these values exist.
        .sort((a, b) => (rackUtilizations[b.id] as RackUtilization).percentage - (rackUtilizations[a.id] as RackUtilization).percentage);
        
    if (highPowerRacks.length === 0) {
        alert("Aucune baie à forte charge à rapporter.");
        return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    highPowerRacks.forEach((rack, index) => {
        if (index > 0) {
            doc.addPage();
        }

        doc.setFontSize(18);
        doc.setTextColor('#0f172a');
        doc.text(`Rapport de Charge: ${rack.designation}`, margin, 20);
        
        doc.setFontSize(10);
        doc.setTextColor('#64748b');
        doc.text(`Salle: ${rack.salle} | Rangée: ${rack.rangee} | Numéro: ${rack.numero_baie}`, margin, 26);
        doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, pageWidth - margin, 20, { align: 'right' });
        
        let lastY = 35;
        
        const totalU = parseRackDimensions(rack.dimensions);
        const uHeight = 3;
        const rackVisHeight = totalU * uHeight;
        const rackVisWidth = 70;
        const rackVisX = (pageWidth / 2) - (rackVisWidth / 2);
        
        doc.setDrawColor('#cbd5e1');
        doc.rect(rackVisX, lastY, rackVisWidth, rackVisHeight);

        doc.setFontSize(6);
        doc.setTextColor('#94a3b8');
        for (let i = 0; i < totalU; i++) {
            const uNum = totalU - i;
            doc.text(String(uNum), rackVisX - 3, lastY + (i * uHeight) + (uHeight / 1.5), { align: 'right' });
        }

        const equipmentsInRack = allData.equipements.filter(eq => eq.rack_fk === rack.id);

        equipmentsInRack.forEach(eq => {
            const startU = toNum(eq.u_position);
            const heightU = toNum(eq.hauteur_u) || 1;
            const eqY = lastY + ((totalU - startU - heightU + 1) * uHeight);
            const eqHeight = heightU * uHeight;
            doc.setFillColor('#38bdf8');
            doc.rect(rackVisX + 0.5, eqY + 0.5, rackVisWidth - 1, eqHeight - 1, 'F');
            doc.setTextColor('#FFFFFF');
            doc.setFontSize(7);
            const textLines = doc.splitTextToSize(`${eq.nom_equipement} (${heightU}U)`, rackVisWidth - 4);
            doc.text(textLines, rackVisX + 3, eqY + eqHeight / 2, { baseline: 'middle' });
        });
        
        lastY += rackVisHeight + 10;
        
        if (lastY > pageHeight - 60) {
            doc.addPage();
            lastY = 20;
        }
        
        doc.setFontSize(14);
        doc.setTextColor('#0f172a');
        doc.text("Détail de la Puissance par Équipement", margin, lastY);
        lastY += 5;

        const tableBody = equipmentsInRack.map(eq => {
            const acPower = allData.connexionsAC.filter(c => c.equipment_fk === eq.id).reduce((sum, c) => sum + toNum(c.puissance_kw), 0);
            const dcPower = allData.connexionsDC.filter(c => c.equipment_fk === eq.id).reduce((sum, c) => sum + toNum(c.puissance_kw), 0);
            return [eq.nom_equipement, `U${toNum(eq.u_position)} (${toNum(eq.hauteur_u)}U)`, (acPower + dcPower).toFixed(2) + ' kW'];
        });

        const utilization = rackUtilizations[rack.id];
        const anomaly = rackPowerAnomalies[rack.id];
        const hasRealData = anomaly && anomaly.totalReal > 0;

        const footData = [];
        footData.push([{ content: `Puissance Calculée (${utilization?.percentage.toFixed(1)}%)`, styles: { fontStyle: 'bold' } }, '', { content: `${utilization?.totalPower.toFixed(2)} kW`, styles: { fontStyle: 'bold' } }]);
        if(hasRealData){
            footData.push([{ content: `Puissance Réelle Mesurée`, styles: { fontStyle: 'bold' } }, '', { content: `${anomaly.totalReal.toFixed(2)} kW`, styles: { fontStyle: 'bold' } }]);
            const diffColor = anomaly.isOverPower ? [239, 68, 68] : [34, 197, 94];
            footData.push([{ content: `Écart (Réel vs. Calculé)`, styles: { fontStyle: 'bold' } }, '', { content: `${anomaly.powerDifferenceKw.toFixed(2)} kW (${anomaly.powerDifferencePercent.toFixed(1)}%)`, styles: { fontStyle: 'bold', textColor: diffColor } }]);
        }


        // @ts-ignore
        doc.autoTable({
            startY: lastY,
            head: [['Équipement', 'Position', 'Puissance Consommée']],
            body: tableBody,
            foot: footData,
            theme: 'grid',
            headStyles: { fillColor: '#1e293b' },
            footStyles: { fillColor: '#334155' },
            margin: { left: margin, right: margin }
        });
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#f97316'); // Orange for the restricted text
        doc.text("Orange Restricted", margin, pageHeight - 10);
        doc.setTextColor(150); // Reset to gray for the page number
        doc.text(`Page ${i} sur ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    doc.save('rapport_baies_forte_charge.pdf');
  };
  
  const generateHeavyRacksReport = () => {
    // @ts-ignore - jsPDF and autoTable are loaded from CDN
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    const heavyRacksData = dashboardStats.heavyRacks.sort((a,b) => b.weightPercent - a.weightPercent);

    if (heavyRacksData.length === 0) {
        alert("Aucune baie en surcharge pondérale à rapporter.");
        return;
    }
    
    doc.setFontSize(18);
    doc.text("Rapport des Baies à Forte Charge (Poids)", margin, 20);
    doc.setFontSize(10);
    doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, pageWidth - margin, 15, { align: 'right' });

    const tableBody = heavyRacksData.map(({ rack, currentWeight, maxWeight, weightPercent }) => {
        return [
            rack.designation,
            rack.salle,
            currentWeight.toFixed(2) + ' kg',
            maxWeight.toFixed(2) + ' kg',
            weightPercent.toFixed(1) + '%'
        ];
    });

    // @ts-ignore
    doc.autoTable({
        startY: 30,
        head: [['Désignation', 'Salle', 'Poids Actuel', 'Poids Max', 'Taux de Charge']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: '#1e293b' },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#f97316'); // Orange for the restricted text
        doc.text("Orange Restricted", margin, pageHeight - 10);
        doc.setTextColor(150); // Reset to gray for the page number
        doc.text(`Page ${i} sur ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    doc.save('rapport_baies_forte_charge_poids.pdf');
  };

  const generateAllRacksReport = () => {
    // @ts-ignore - jsPDF and autoTable are loaded from CDN
    const { jsPDF } = window.jspdf;
    
    const racksWithEquipment = allData.racks
        .filter(rack => allData.equipements.some(eq => eq.rack_fk === rack.id))
        .sort((a, b) => {
            const salleCompare = a.salle.localeCompare(b.salle);
            if (salleCompare !== 0) return salleCompare;
            const rangeeCompare = a.rangee.localeCompare(b.rangee);
            if (rangeeCompare !== 0) return rangeeCompare;
            return toNum(a.numero_baie) - toNum(b.numero_baie);
        });
        
    if (racksWithEquipment.length === 0) {
        alert("Aucune baie avec des équipements n'a été trouvée.");
        return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    racksWithEquipment.forEach((rack, index) => {
        if (index > 0) doc.addPage();
        doc.setFontSize(18);
        doc.setTextColor('#0f172a');
        doc.text(`Inventaire Baie: ${rack.designation}`, margin, 20);
        doc.setFontSize(10);
        doc.setTextColor('#64748b');
        doc.text(`Salle: ${rack.salle} | Rangée: ${rack.rangee} | Numéro: ${rack.numero_baie}`, margin, 26);
        doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, pageWidth - margin, 20, { align: 'right' });
        
        let lastY = 35;
        const totalU = parseRackDimensions(rack.dimensions);
        const uHeight = 3;
        const rackVisHeight = totalU * uHeight;
        const rackVisWidth = 70;
        const rackVisX = (pageWidth / 2) - (rackVisWidth / 2);
        
        doc.setDrawColor('#cbd5e1');
        doc.rect(rackVisX, lastY, rackVisWidth, rackVisHeight);

        doc.setFontSize(6);
        doc.setTextColor('#94a3b8');
        for (let i = 0; i < totalU; i++) {
            doc.text(String(totalU - i), rackVisX - 3, lastY + (i * uHeight) + (uHeight / 1.5), { align: 'right' });
        }

        const equipmentsInRack = allData.equipements.filter(eq => eq.rack_fk === rack.id);
        equipmentsInRack.forEach(eq => {
            const startU = toNum(eq.u_position);
            const heightU = toNum(eq.hauteur_u) || 1;
            const eqY = lastY + ((totalU - startU - heightU + 1) * uHeight);
            const eqHeight = heightU * uHeight;
            doc.setFillColor('#38bdf8');
            doc.rect(rackVisX + 0.5, eqY + 0.5, rackVisWidth - 1, eqHeight - 1, 'F');
            doc.setTextColor('#FFFFFF');
            doc.setFontSize(7);
            const textLines = doc.splitTextToSize(`${eq.nom_equipement} (${heightU}U)`, rackVisWidth - 4);
            doc.text(textLines, rackVisX + 3, eqY + eqHeight / 2, { baseline: 'middle' });
        });
        
        lastY += rackVisHeight + 10;
        
        if (lastY > pageHeight - 60) {
            doc.addPage();
            lastY = 20;
        }
        
        doc.setFontSize(14);
        doc.setTextColor('#0f172a');
        doc.text("Détail des Équipements Installés", margin, lastY);
        lastY += 5;

        const tableBody = equipmentsInRack.map(eq => {
            const acPower = allData.connexionsAC.filter(c => c.equipment_fk === eq.id).reduce((sum, c) => sum + toNum(c.puissance_kw), 0);
            const dcPower = allData.connexionsDC.filter(c => c.equipment_fk === eq.id).reduce((sum, c) => sum + toNum(c.puissance_kw), 0);
            return [eq.nom_equipement, `U${toNum(eq.u_position)} (${toNum(eq.hauteur_u)}U)`, (acPower + dcPower).toFixed(2) + ' kW'];
        });

        const utilization = rackUtilizations[rack.id];
        const anomaly = rackPowerAnomalies[rack.id];
        const hasRealData = anomaly && anomaly.totalReal > 0;

        const footData = [];
        footData.push([{ content: `Puissance Calculée (${utilization?.percentage.toFixed(1)}%)`, styles: { fontStyle: 'bold' } }, '', { content: `${utilization?.totalPower.toFixed(2)} kW`, styles: { fontStyle: 'bold' } }]);
        if(hasRealData){
            footData.push([{ content: `Puissance Réelle Mesurée`, styles: { fontStyle: 'bold' } }, '', { content: `${anomaly.totalReal.toFixed(2)} kW`, styles: { fontStyle: 'bold' } }]);
            const diffColor = anomaly.isOverPower ? [239, 68, 68] : [34, 197, 94];
            footData.push([{ content: `Écart (Réel vs. Calculé)`, styles: { fontStyle: 'bold' } }, '', { content: `${anomaly.powerDifferenceKw.toFixed(2)} kW (${anomaly.powerDifferencePercent.toFixed(1)}%)`, styles: { fontStyle: 'bold', textColor: diffColor } }]);
        }

        // @ts-ignore
        doc.autoTable({
            startY: lastY,
            head: [['Équipement', 'Position', 'Puissance Consommée']],
            body: tableBody,
            foot: footData,
            theme: 'grid',
            headStyles: { fillColor: '#1e293b' },
            footStyles: { fillColor: '#334155' },
            margin: { left: margin, right: margin }
        });
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#f97316'); // Orange for the restricted text
        doc.text("Orange Restricted", margin, pageHeight - 10);
        doc.setTextColor(150); // Reset to gray for the page number
        doc.text(`Page ${i} sur ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    doc.save('rapport_inventaire_baies.pdf');
  };

  const generatePhysicalOccupancyReport = () => {
    // @ts-ignore - jsPDF and autoTable are loaded from CDN
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const racksData = allData.racks.map(rack => {
        const totalU = parseRackDimensions(rack.dimensions);
        const equipmentsInRack = allData.equipements.filter(eq => eq.rack_fk === rack.id);
        const usedU = equipmentsInRack
            .filter(eq => eq.type_equipement !== 'PDU')
            .reduce((sum, eq) => sum + toNum(eq.hauteur_u), 0);
        const occupancyPercent = totalU > 0 ? (usedU / totalU) * 100 : 0;
        const currentWeight = equipmentsInRack.reduce((sum, eq) => sum + toNum(eq.poids_kg), 0);
        const maxWeight = toNum(rack.poids_max_kg);
        const weightPercent = maxWeight > 0 ? (currentWeight / maxWeight) * 100 : 0;

        return {
            ...rack,
            usedU,
            totalU,
            occupancyPercent,
            currentWeight,
            maxWeight,
            weightPercent,
        };
    }).sort((a, b) => 
        a.salle.localeCompare(b.salle) || 
        a.rangee.localeCompare(b.rangee) || 
        toNum(a.numero_baie) - toNum(b.numero_baie)
    );

    doc.setFontSize(18);
    doc.text("Rapport d'Occupation Physique des Baies", 15, 20);
    doc.setFontSize(10);
    doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, 282, 15, { align: 'right' });

    const tableBody = racksData.map(r => [
        r.numero_baie,
        r.designation,
        r.salle,
        r.rangee,
        `${r.usedU} / ${r.totalU}`,
        `${r.occupancyPercent.toFixed(1)}%`,
        `${r.currentWeight.toFixed(1)} / ${r.maxWeight.toFixed(0)}`,
        `${r.weightPercent.toFixed(1)}%`,
    ]);

    // @ts-ignore
    doc.autoTable({
        startY: 30,
        head: [['N° Baie', 'Désignation', 'Salle', 'Rangée', 'U Utilisés / Total', 'Taux Occupation U', 'Poids Actuel / Max (kg)', 'Taux Charge Poids']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: '#1e293b' },
        didParseCell: function (data: any) {
            if (data.section === 'body' && data.column.index === 0) {
                 if (racksData[data.row.index -1]?.salle !== racksData[data.row.index]?.salle) {
                     data.cell.styles.borderTopWidth = 1;
                     data.cell.styles.borderTopColor = '#94a3b8';
                 }
            }
        }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#f97316'); // Orange for the restricted text
        doc.text("Orange Restricted", 15, doc.internal.pageSize.getHeight() - 10);
        doc.setTextColor(150); // Reset to gray for the page number
        doc.text(`Page ${i} sur ${pageCount}`, doc.internal.pageSize.getWidth() - 15, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }

    doc.save('rapport_occupation_physique.pdf');
  };
  
  const generateStrandedSpaceReport = () => {
    // @ts-ignore
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    const strandedSpaceRacks = Object.entries(rackUtilizations)
        // FIX: Add explicit type to the callback parameter to fix `util.percentage` access on `unknown` type.
        .filter(([, util]) => (util as RackUtilization).percentage > 80)
        .map(([rackId, util]) => {
            const rack = allData.racks.find(r => r.id === rackId);
            if (!rack) return null;

            const totalU = parseRackDimensions(rack.dimensions);
            const usedU = allData.equipements
                .filter(eq => eq.rack_fk === rack.id && eq.type_equipement !== 'PDU')
                .reduce((sum, eq) => sum + toNum(eq.hauteur_u), 0);
            
            const strandedU = totalU - usedU;

            return { rack, strandedU, powerPercentage: (util as RackUtilization).percentage };
        })
        .filter((item): item is { rack: Rack; strandedU: number; powerPercentage: number; } => item !== null && item.strandedU > 0)
        .sort((a,b) => b.strandedU - a.strandedU);

    if (strandedSpaceRacks.length === 0) {
        alert("Aucun espace orphelin à rapporter.");
        return;
    }

    doc.setFontSize(18);
    doc.text("Rapport sur l'Espace Orphelin", 15, 20);
    doc.setFontSize(10);
    doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, 195, 15, { align: 'right' });
    doc.text("Espace (U) disponible dans les baies dont la charge électrique est > 80%", 15, 26);

    const tableBody = strandedSpaceRacks.map(item => [
        item.rack.numero_baie,
        item.rack.designation,
        item.rack.salle,
        item.strandedU,
        `${item.powerPercentage.toFixed(1)}%`
    ]);

    // @ts-ignore
    doc.autoTable({
        startY: 35,
        head: [['N° Baie', 'Désignation', 'Salle', 'Espace Orphelin (U)', 'Charge Électrique']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: '#1e293b' },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#f97316'); // Orange for the restricted text
        doc.text("Orange Restricted", 15, doc.internal.pageSize.getHeight() - 10);
        doc.setTextColor(150); // Reset to gray for the page number
        doc.text(`Page ${i} sur ${pageCount}`, doc.internal.pageSize.getWidth() - 15, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }
    
    doc.save('rapport_espace_orphelin.pdf');
  };
  
    const generateStrandedPowerReport = () => {
        // @ts-ignore
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        
        const strandedPowerRacks = allData.racks.map(rack => {
            const totalU = parseRackDimensions(rack.dimensions);
            const usedU = allData.equipements
                .filter(eq => eq.rack_fk === rack.id && eq.type_equipement !== 'PDU')
                .reduce((sum, eq) => sum + toNum(eq.hauteur_u), 0);
            const uPercent = totalU > 0 ? (usedU / totalU) * 100 : 0;
            return { rack, uPercent };
        })
        .filter(item => item.uPercent > 95)
        .map(item => {
            const utilization = rackUtilizations[item.rack.id];
            if (!utilization || utilization.capacity <= utilization.totalPower) return null;
            return {
                ...item,
                strandedPower: utilization.capacity - utilization.totalPower,
            }
        })
        .filter((item): item is { rack: Rack; uPercent: number; strandedPower: number; } => item !== null)
        .sort((a,b) => b.strandedPower - a.strandedPower);

        if (strandedPowerRacks.length === 0) {
            alert("Aucune puissance orpheline à rapporter.");
            return;
        }

        doc.setFontSize(18);
        doc.text("Rapport sur la Puissance Orpheline", 15, 20);
        doc.setFontSize(10);
        doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, 195, 15, { align: 'right' });
        doc.text("Puissance (kW) disponible dans les baies dont l'occupation physique est > 95%", 15, 26);
    
        const tableBody = strandedPowerRacks.map(item => [
            item.rack.numero_baie,
            item.rack.designation,
            item.rack.salle,
            `${item.strandedPower.toFixed(2)} kW`,
            `${item.uPercent.toFixed(1)}%`
        ]);
    
        // @ts-ignore
        doc.autoTable({
            startY: 35,
            head: [['N° Baie', 'Désignation', 'Salle', 'Puissance Orpheline (kW)', 'Occupation Physique']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: '#1e293b' },
        });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor('#f97316'); // Orange for the restricted text
            doc.text("Orange Restricted", 15, doc.internal.pageSize.getHeight() - 10);
            doc.setTextColor(150); // Reset to gray for the page number
            doc.text(`Page ${i} sur ${pageCount}`, doc.internal.pageSize.getWidth() - 15, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
        }
    
        doc.save('rapport_puissance_orpheline.pdf');
    };

    const generateChainLoadAnalysisPDF = (chain: 'A' | 'B' | 'C') => {
        const equipmentMap = new Map(allData.equipements.map(e => [e.id, e]));
        const rackMap = new Map(allData.racks.map(r => [r.id, r]));
        const roomChainMapping: { [key: string]: { voie1: string, voie2: string } } = {
            'ITN1': { voie1: 'A', voie2: 'B' },
            'ITN2': { voie1: 'A', voie2: 'C' },
            'ITN3': { voie1: 'B', voie2: 'C' },
        };

        let loadItems: any[] = [];
        let totalIT = { p1: 0, p2: 0, p3: 0, dc: 0 };

        allData.connexionsAC.forEach(conn => {
            const eq = equipmentMap.get(conn.equipment_fk) as Equipment | undefined;
            if (!eq) return;
            const rack = rackMap.get(eq.rack_fk) as Rack | undefined;
            if (!rack) return;
            const mapping = roomChainMapping[rack.salle];
            const connChain = conn.voie === '1' ? mapping?.voie1 : mapping?.voie2;

            if (connChain === chain) {
                const power = toNum(conn.puissance_kw);
                const p = conn.phase === 'P123' ? power / 3 : power;
                const item = {
                    baie: `${rack.designation} (${rack.salle}/${rack.numero_baie})`,
                    equipement: eq.nom_equipement,
                    voie: `Voie ${conn.voie}`,
                    connexion: `AC | Boîtier: ${conn.ac_box_fk}\nPrise: ${conn.outlet_name}`,
                    p1: (conn.phase === 'P1' || conn.phase === 'P123') ? p : 0,
                    p2: (conn.phase === 'P2' || conn.phase === 'P123') ? p : 0,
                    p3: (conn.phase === 'P3' || conn.phase === 'P123') ? p : 0,
                    dc: 0,
                };
                loadItems.push(item);
                totalIT.p1 += item.p1; totalIT.p2 += item.p2; totalIT.p3 += item.p3;
            }
        });

        allData.connexionsDC.forEach(conn => {
            const eq = equipmentMap.get(conn.equipment_fk) as Equipment | undefined;
            if (!eq) return;
            const rack = rackMap.get(eq.rack_fk) as Rack | undefined;
            if (!rack) return;
            
            const mapping = roomChainMapping[rack.salle];
            const connChain = conn.voie === '1' ? mapping?.voie1 : mapping?.voie2;
            
            if (connChain === chain) {
                 const item = {
                    baie: `${rack.designation} (${rack.salle}/${rack.numero_baie})`,
                    equipement: eq.nom_equipement,
                    voie: `Voie ${conn.voie}`,
                    connexion: `DC | Tableau: ${conn.dc_panel_fk}\nDisj.: ${conn.breaker_number}x${conn.breaker_rating_a}A`,
                    p1: 0, p2: 0, p3: 0,
                    dc: toNum(conn.puissance_kw),
                };
                loadItems.push(item);
                totalIT.dc += item.dc;
            }
        });
        
        loadItems = loadItems.sort((a, b) => a.baie.localeCompare(b.baie) || a.equipement.localeCompare(b.equipement));
        const otherConsumer = allData.autresConsommateurs.find(c => c.chaine === chain);

        // @ts-ignore
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text(`Rapport d'Analyse de Charge - Chaîne ${chain}`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Date: ${new Date().toLocaleString('fr-FR')}`, 280, 15, { align: 'right' });

        const RECTIFIER_EFFICIENCY = 0.96;
        const totalDC = totalIT.dc + toNum(otherConsumer?.dc);
        const acFromDC = totalDC / RECTIFIER_EFFICIENCY;
        const acFromDC_perPhase = acFromDC / 3;
        const finalP1 = totalIT.p1 + toNum(otherConsumer?.acp1) + acFromDC_perPhase;
        const finalP2 = totalIT.p2 + toNum(otherConsumer?.acp2) + acFromDC_perPhase;
        const finalP3 = totalIT.p3 + toNum(otherConsumer?.acp3) + acFromDC_perPhase;
        const totalFinal = finalP1 + finalP2 + finalP3;

        doc.setFontSize(12);
        doc.text("Résumé de la Charge Finale", 14, 30);
        // @ts-ignore
        doc.autoTable({
            body: [
                ['Phase 1', finalP1.toFixed(2) + ' kW'],
                ['Phase 2', finalP2.toFixed(2) + ' kW'],
                ['Phase 3', finalP3.toFixed(2) + ' kW'],
                ['CHARGE TOTALE', { content: totalFinal.toFixed(2) + ' kW', styles: { fontStyle: 'bold' } }],
            ],
            startY: 34,
            theme: 'plain',
            styles: { fontSize: 10 },
            tableWidth: 80,
        });

        let lastY = (doc as any).lastAutoTable.finalY + 10;

        doc.setFontSize(12);
        doc.text("Détail du Calcul de la Charge DC", 14, lastY);
        // @ts-ignore
        doc.autoTable({
            startY: lastY + 4,
            head: [['Description', 'Valeur']],
            body: [
                ['Charge IT DC Totale', `${totalIT.dc.toFixed(2)} kW`],
                ['Charge "Autres" DC', `${toNum(otherConsumer?.dc).toFixed(2)} kW`],
                [{ content: 'Charge DC Globale', styles: { fontStyle: 'bold' } }, { content: `${totalDC.toFixed(2)} kW`, styles: { fontStyle: 'bold' } }],
                ['Efficacité Redresseur', '96%'],
                ['Charge AC Équivalente (depuis DC)', `${acFromDC.toFixed(2)} kW`],
                ['Charge AC par Phase (distribuée)', `${acFromDC_perPhase.toFixed(2)} kW`],
            ],
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85] },
            styles: { fontSize: 9 },
        });
        lastY = (doc as any).lastAutoTable.finalY + 10;
        
        if (otherConsumer) {
            doc.setFontSize(12);
            doc.text("Contribution des 'Autres Consommateurs' (AC Directe)", 14, lastY);
            // @ts-ignore
            doc.autoTable({
                head: [['Charge Ph1 (kW)', 'Charge Ph2 (kW)', 'Charge Ph3 (kW)']],
                body: [[
                    toNum(otherConsumer.acp1).toFixed(2),
                    toNum(otherConsumer.acp2).toFixed(2),
                    toNum(otherConsumer.acp3).toFixed(2),
                ]],
                startY: lastY + 4,
                theme: 'grid',
                headStyles: { fillColor: [51, 65, 85] },
            });
            lastY = (doc as any).lastAutoTable.finalY + 10;
        }

        doc.setFontSize(12);
        doc.text("Détail de la Charge IT par Équipement", 14, lastY);
        const body = loadItems.map(item => [
            item.baie, item.equipement, item.voie, item.connexion,
            item.p1 > 0 ? item.p1.toFixed(2) : '',
            item.p2 > 0 ? item.p2.toFixed(2) : '',
            item.p3 > 0 ? item.p3.toFixed(2) : '',
            item.dc > 0 ? item.dc.toFixed(2) : '',
        ]);
        body.push([
            { content: 'TOTAL CHARGE IT DIRECTE', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: totalIT.p1.toFixed(2), styles: { fontStyle: 'bold' } },
            { content: totalIT.p2.toFixed(2), styles: { fontStyle: 'bold' } },
            { content: totalIT.p3.toFixed(2), styles: { fontStyle: 'bold' } },
            { content: totalIT.dc.toFixed(2), styles: { fontStyle: 'bold' } },
        ]);

        // @ts-ignore
        doc.autoTable({
            head: [['Baie (Salle/Numéro)', 'Équipement', "Voie d'Alim.", 'Connexion', 'Charge Ph1 (kW)', 'Charge Ph2 (kW)', 'Charge Ph3 (kW)', 'Charge DC (kW)']],
            body: body,
            startY: lastY + 4,
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85] },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 40 }, 1: { cellWidth: 40 }, 2: { cellWidth: 15 }, 3: { cellWidth: 60 },
                4: { cellWidth: 20, halign: 'right' }, 5: { cellWidth: 20, halign: 'right' },
                6: { cellWidth: 20, halign: 'right' }, 7: { cellWidth: 20, halign: 'right' },
            }
        });
        
        const pageCount = doc.internal.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor('#f97316'); // Orange for the restricted text
            doc.text("Orange Restricted", 14, pageHeight - 10);
            doc.setTextColor(150); // Reset to gray for the page number
            doc.text(`Page ${i} sur ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
        }
        
        doc.save(`Analyse_Charge_Chaine_${chain}.pdf`);
    };

  return (
    <>
      <Header title="Tableau de Bord Global" />
      <div className="mt-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Baies" value={dashboardStats.totalRacks.toString()} icon={<ServerIcon className="w-6 h-6 text-primary"/>} onClick={generateAllRacksReport} />
          <StatCard title="Baies à Forte Charge (>80%)" value={dashboardStats.highPowerRacks.toString()} icon={<WarningIcon className="w-6 h-6 text-warning-orange"/>} onClick={dashboardStats.highPowerRacks > 0 ? generateHighPowerRacksReport : undefined} />
          <StatCard title="Puissance Totale ITN" value={`${dashboardStats.totalITPower.toFixed(1)} kW`} icon={<PowerIcon className="w-6 h-6 text-ok-green"/>} />
          <StatCard title="Puissance (Autres Conso.)" value={`${dashboardStats.totalOtherPower.toFixed(1)} kW`} icon={<PowerIcon className="w-6 h-6 text-slate-400"/>} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {rooms.map(room => (<StatCard key={room} title={`Charge Salle ${room}`} value={`${(dashboardStats.powerPerRoom[room]?.total || 0).toFixed(1)} kW`} subtext={`AC: ${(dashboardStats.powerPerRoom[room]?.ac || 0).toFixed(1)}kW | DC: ${(dashboardStats.powerPerRoom[room]?.dc || 0).toFixed(1)}kW`} icon={<PowerIcon className="w-6 h-6 text-primary"/>} />))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
                <h3 className="text-lg font-bold text-slate-100 mb-4">Consommation Électrique par Salle</h3>
                <div className="w-full h-72 flex justify-around items-end space-x-4 px-4 pt-6">
                    {rooms.map(room => {
                        const roomData = dashboardStats.powerPerRoom[room];
                        const capacityKey = `room${room.toUpperCase()}_kW` as keyof Capacities;
                        const roomCapacity = capacities[capacityKey] as number || 500;
                        if (!roomData) return null;
                        const consumedHeight = maxChartPower > 0 ? (roomData.total / maxChartPower) * 100 : 0;
                        const capacityHeight = maxChartPower > 0 ? (roomCapacity / maxChartPower) * 100 : 0;
                        return (<div key={room} className="flex flex-col items-center flex-1 h-full"><div className="w-full h-full flex items-end justify-center relative"><div className="absolute bottom-0 w-3/5 bg-slate-700/50 rounded-t-md" style={{ height: `${capacityHeight}%` }} title={`Capacité: ${roomCapacity.toFixed(0)} kW`}></div><div className="w-3/5 bg-primary/70 rounded-t-md hover:bg-primary transition-colors z-10 relative" style={{ height: `${consumedHeight}%` }} title={`Consommé: ${roomData.total.toFixed(2)} kW`}>{consumedHeight > 10 && (<span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-200">{roomData.total.toFixed(1)}kW</span>)}</div></div><p className="text-sm font-semibold text-slate-300 mt-2">{room.toUpperCase()}</p></div>);
                    })}
                </div>
                 <div className="flex justify-center mt-4 text-xs text-slate-400 space-x-4">
                    <div className="flex items-center"><div className="w-3 h-3 bg-primary/70 mr-2 rounded-sm"></div>Puissance Consommée (kW)</div>
                    <div className="flex items-center"><div className="w-3 h-3 bg-slate-700/50 mr-2 rounded-sm"></div>Capacité Max (kW)</div>
                </div>
            </div>
            <TopAnomaliesCard topRacks={topAnomalyRacks} onSelectRack={onSelectRack} />
        </div>


        <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-100">Indicateurs de Performance Clés (KPI)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                    title="Taux d'Occupation Physique" 
                    value={`${dashboardStats.physicalOccupancyPercent.toFixed(1)}%`}
                    subtext={`${dashboardStats.totalUUsed} U / ${dashboardStats.totalUAvailable} U`}
                    icon={<ServerIcon className="w-6 h-6 text-primary"/>} 
                    onClick={generatePhysicalOccupancyReport}
                />
                <StatCard 
                    title="Puissance Orpheline" 
                    value={`${dashboardStats.strandedPowerKw.toFixed(1)} kW`}
                    subtext="Dans baies physiquement pleines (>95%)"
                    icon={<PowerIcon className="w-6 h-6 text-slate-400"/>} 
                    onClick={generateStrandedPowerReport}
                />
                 <StatCard 
                    title="Espace Orphelin" 
                    value={`${dashboardStats.strandedSpaceU} U`}
                    subtext="Dans baies électriquement pleines (>80%)"
                    icon={<ServerIcon className="w-6 h-6 text-slate-400"/>} 
                    onClick={generateStrandedSpaceReport}
                />
            </div>
            <div className="mt-6">
                <h3 className="text-lg font-bold text-slate-100 mb-4">Équilibre des Phases</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {Object.keys(chainLoads).sort().map(chain => {
                        const capacityKey = `upsChain${chain}_kW` as keyof Capacities;
                        const capacity = (capacities[capacityKey] as number) || 0;
                        return (
                          <PhaseImbalanceCard
                            key={chain}
                            chain={chain}
                            load={chainLoads[chain]}
                            capacity={capacity}
                            onClick={() => generateChainLoadAnalysisPDF(chain as 'A' | 'B' | 'C')}
                          />
                        );
                    })}
                </div>
            </div>
        </div>

      </div>
    </>
  );
};

export default Dashboard;
