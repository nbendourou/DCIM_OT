import React, { useState, useMemo } from 'react';
import type { AllData, DCPanelUtilization, DCConnection, DCPanel, Rack, Equipment, ACConnection, ChainLoad } from '../types.ts';
import Header from './Header.tsx';
import { DownloadIcon } from './icons.tsx';
import { toNum, getRackPowerType } from '../utils/powerUtils.ts';


// Helper function to convert array of objects to CSV
function convertToCSV(objArray: any[]) {
    if (!objArray || objArray.length === 0) return '';
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let str = '';
    const headers = Object.keys(array[0]);
    str += headers.join(',') + '\r\n';

    for (let i = 0; i < array.length; i++) {
        let line = '';
        for (const index in array[i]) {
            if (line !== '') line += ',';
            let value = array[i][index] === null || array[i][index] === undefined ? '' : array[i][index];
            if (typeof value === 'string' && value.includes(',')) {
                value = `"${value}"`;
            }
            line += value;
        }
        str += line + '\r\n';
    }
    return str;
}

// Helper function to trigger CSV download
function downloadCSV(csvStr: string, filename: string) {
    const blob = new Blob([`\uFEFF${csvStr}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel compatibility
    const link = document.createElement("a");
    if (link.download !== undefined) { 
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

interface ReportingProps {
  allData: AllData;
  dcPanelUtilizations: { [key: string]: DCPanelUtilization };
}

const ReportCard: React.FC<{title: string; description: string; onDownload: () => void}> = ({ title, description, onDownload }) => (
    <div className="bg-slate-800 p-5 rounded-lg shadow-lg flex items-center justify-between border border-slate-700">
        <div>
            <h3 className="font-bold text-lg text-white">{title}</h3>
            <p className="text-sm text-slate-400 mt-1">{description}</p>
        </div>
        <button 
            onClick={onDownload}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors"
        >
            <DownloadIcon className="w-5 h-5 mr-2"/>
            Télécharger
        </button>
    </div>
);


// --- DC INVENTORY REPORT COMPONENTS ---

const BREAKER_TOTALS = new Map<string, number>([
    ['25', 4], ['32', 5], ['40', 4], ['63', 35],
    ['80', 10], ['100', 10], ['125', 2]
]);

// Updated interfaces to reflect the new data structure.
interface BreakerUsageInfo {
  total: number;
  used: number;
  remaining: number;
  connections: {
    conn: DCConnection;
    equipment?: Equipment;
    rack?: Rack;
  }[];
}

interface PanelWithUsage {
    panel: DCPanel;
    usage: Map<string, BreakerUsageInfo>;
}

interface RectifierData {
    id: string;
    panels: PanelWithUsage[];
}

interface RoomData {
    [rectifierId: string]: RectifierData;
}

interface ReportData {
    [roomName: string]: RoomData;
}

const DcInventoryReport: React.FC<{allData: AllData}> = ({ allData }) => {
    
    const reportData = useMemo<ReportData>(() => {
        const data: ReportData = {};
        const equipmentMap = new Map(allData.equipements.map(e => [e.id, e]));
        const rackMap = new Map(allData.racks.map(r => [r.id, r]));

        // Group panels by a derived rectifier ID
        const rectifiersByRoom = new Map<string, Map<string, DCPanel[]>>();

        allData.tableauxDC.forEach(panel => {
            if (!panel.id || !panel.salle) return;
            const idParts = panel.id.split('.');
            // A valid ID should look like IT.1-SWB.REC.A.4.1
            if (idParts.length < 5) return; 
            
            // The rectifier ID is the panel ID minus the last segment.
            const rectifierId = idParts.slice(0, -1).join('.');
            const room = panel.salle;

            if (!rectifiersByRoom.has(room)) {
                rectifiersByRoom.set(room, new Map());
            }
            const roomRectifiers = rectifiersByRoom.get(room)!;
            if (!roomRectifiers.has(rectifierId)) {
                roomRectifiers.set(rectifierId, []);
            }
            roomRectifiers.get(rectifierId)!.push(panel);
        });
        
        // Build the final, structured report data
        rectifiersByRoom.forEach((rectifiers, roomName) => {
            if (!data[roomName]) data[roomName] = {};
            
            rectifiers.forEach((panels, rectifierId) => {
                const panelsWithUsage: PanelWithUsage[] = panels.map(panel => {
                    const usage = new Map<string, BreakerUsageInfo>();
                    const panelConnections = allData.connexionsDC.filter(c => c.dc_panel_fk === panel.id);

                    BREAKER_TOTALS.forEach((total, rating) => {
                        const connectionsForRating = panelConnections
                            .filter(c => String(toNum(c.breaker_rating_a)) === rating)
                            .map(conn => {
                                // FIX: Cast equipment to the correct type to safely access its properties.
                                // This resolves errors where properties like 'id' and 'rack_fk' could not be found on type 'unknown'.
                                const equipment = equipmentMap.get(conn.equipment_fk) as Equipment | undefined;
                                const validEquipment = (equipment && equipment.id) ? equipment : undefined;
                                const rack = validEquipment ? rackMap.get(validEquipment.rack_fk) : undefined;
                                return { conn, equipment: validEquipment, rack };
                            });
                        
                        // FIX: Sum the 'breaker_number' field as it represents a quantity, not an ID.
                        const usedCount = connectionsForRating.reduce((sum, item) => sum + toNum(item.conn.breaker_number), 0);

                        usage.set(rating, {
                            total: total,
                            used: usedCount,
                            remaining: total - usedCount,
                            connections: connectionsForRating
                        });
                    });
                    return { panel, usage };
                });

                data[roomName][rectifierId] = {
                    id: rectifierId,
                    panels: panelsWithUsage.sort((a,b) => a.panel.id.localeCompare(b.panel.id)),
                };
            });
        });

        return data;
    }, [allData]);

    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
            <h3 className="text-lg font-bold text-slate-100 mb-2">Inventaire des Tableaux DC</h3>
            <p className="text-sm text-slate-400 mb-4">
                Analyse détaillée de la disponibilité des disjoncteurs par salle, redresseur et tableau.
            </p>
            <div className="space-y-6">
                {Object.keys(reportData).sort().map(roomName => (
                    <div key={roomName}>
                        <h4 className="text-2xl font-bold text-primary mb-4 border-b-2 border-primary/30 pb-2">Salle {roomName}</h4>
                        <div className="space-y-6">
                            {/* FIX: Add explicit types to sort and map parameters to resolve property access errors on 'unknown'. */}
                            {Object.values(reportData[roomName]).sort((a: RectifierData, b: RectifierData) => a.id.localeCompare(b.id)).map((rectifier: RectifierData) => (
                                <div key={rectifier.id} className="bg-slate-900/40 p-4 rounded-lg">
                                    <h5 className="text-xl font-semibold text-slate-200 mb-4">{rectifier.id}</h5>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {rectifier.panels.map(({ panel, usage }) => (
                                             <div key={panel.id} className="bg-slate-800/50 p-4 rounded-md border border-slate-700">
                                                <p className="font-bold text-slate-100">{panel.id}</p>
                                                <p className="text-xs text-slate-400 mb-3">Chaîne {panel.chaine}</p>
                                                
                                                <div className="space-y-3">
                                                    {Array.from(usage.entries()).map(([rating, usageInfo]) => (
                                                        <div key={rating} className="text-xs">
                                                            <div className="grid grid-cols-4 gap-2 items-center font-mono">
                                                                <span className="font-bold text-slate-300">{rating}A</span>
                                                                <span>Total: {usageInfo.total}</span>
                                                                <span className={usageInfo.used > 0 ? 'text-warning-orange' : ''}>Utilisés: {usageInfo.used}</span>
                                                                <span className="font-bold text-ok-green">Restants: {usageInfo.remaining}</span>
                                                            </div>
                                                            {usageInfo.connections.length > 0 && (
                                                                <ul className="pl-5 mt-1 text-slate-400 text-[11px] list-disc">
                                                                    {usageInfo.connections.map(({conn, rack, equipment}) => (
                                                                        <li key={conn.id}>
                                                                            {/* FIX: Display 'breaker_number' as a quantity. */}
                                                                            {toNum(conn.breaker_number)} disjoncteur(s) &rarr; <span className="font-semibold text-slate-300">{rack?.designation || 'N/A'}</span> ({equipment?.nom_equipement || 'N/A'})
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

const Reporting: React.FC<ReportingProps> = ({ allData }) => {
    const [selectedRoom, setSelectedRoom] = useState<string>('');
    const [selectedRackIds, setSelectedRackIds] = useState<string[]>([]);
    const [selectedChainForAnalysis, setSelectedChainForAnalysis] = useState<'A' | 'B' | 'C'>('A');


    const rooms = useMemo(() => [...new Set(allData.racks.map(r => r.salle))].sort(), [allData.racks]);
    
    const racksByRow = useMemo(() => {
        if (!selectedRoom) return new Map<string, Rack[]>();
        const rackMap = new Map<string, Rack[]>();
        allData.racks
            .filter(r => r.salle === selectedRoom)
            .forEach(rack => {
                const row = rack.rangee;
                if (!rackMap.has(row)) {
                    rackMap.set(row, []);
                }
                rackMap.get(row)!.push(rack);
            });
        
        // Sort racks within each row
        rackMap.forEach((racks, row) => {
            rackMap.set(row, racks.sort((a, b) => toNum(a.numero_baie) - toNum(b.numero_baie)));
        });

        return rackMap;
    }, [allData.racks, selectedRoom]);

    const handleRoomChange = (room: string) => {
        setSelectedRoom(room);
        setSelectedRackIds([]); // Reset rack selection when room changes
    };

    const toggleRackSelection = (rackId: string) => {
        setSelectedRackIds(prev =>
            prev.includes(rackId)
                ? prev.filter(id => id !== rackId)
                : [...prev, rackId]
        );
    };

    const generateWiringPDF = () => {
        if (selectedRackIds.length === 0) {
            alert("Veuillez sélectionner au moins une baie.");
            return;
        }
        
        // @ts-ignore
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        selectedRackIds.forEach((rackId, index) => {
            const rack = allData.racks.find(r => r.id === rackId);
            const equipments = allData.equipements.filter(eq => eq.rack_fk === rackId);
            if (!rack) return;

            if (index > 0) {
                doc.addPage();
            }

            // Header
            doc.setFontSize(18);
            doc.setTextColor(40, 40, 40);
            doc.text("Fiche de Câblage Électrique", 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, 280, 15, { align: 'right' });
            
            doc.setFontSize(12);
            doc.setTextColor(40,40,40);
            doc.text(`Baie: ${rack.designation} (${rack.numero_baie})`, 14, 30);
            doc.text(`Salle: ${rack.salle} / Rangée: ${rack.rangee}`, 14, 36);

            // Table Data
            const head = [['Équipement (Type)', 'U (Hauteur)', 'Alim.', 'Connexions Voie 1', 'Connexions Voie 2', 'Puissance (kW)']];
            const body = equipments
              .sort((a,b) => toNum(b.u_position) - toNum(a.u_position))
              .map(eq => {
                const getConnections = (voie: '1' | '2'): string => {
                    const ac = allData.connexionsAC
                        .filter(c => c.equipment_fk === eq.id && c.voie === voie)
                        .map(c => `AC | Boîtier: ${c.ac_box_fk}\nPrise: ${c.outlet_name}\nPhase: ${c.phase}`)
                        .join('\n\n');
                    const dc = allData.connexionsDC
                        .filter(c => c.equipment_fk === eq.id && c.voie === voie)
                        .map(c => `DC | Tableau: ${c.dc_panel_fk}\nDisj.: ${c.breaker_number}x ${c.breaker_rating_a}A`)
                        .join('\n\n');
                    return [ac, dc].filter(Boolean).join('\n\n') || 'N/A';
                };
                const totalPower = allData.connexionsAC.concat(allData.connexionsDC as any[])
                    .filter(c => c.equipment_fk === eq.id)
                    .reduce((sum, c) => sum + toNum(c.puissance_kw), 0);

                return [
                    `${eq.nom_equipement}\n(${eq.type_equipement})`,
                    `U${eq.u_position} (${eq.hauteur_u}U)`,
                    eq.type_alimentation,
                    getConnections('1'),
                    getConnections('2'),
                    totalPower.toFixed(2),
                ];
            });

            // AutoTable Plugin
            // @ts-ignore
            doc.autoTable({
                head: head,
                body: body,
                startY: 42,
                theme: 'grid',
                headStyles: { fillColor: [51, 65, 85], textColor: 240 },
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: {
                    0: { cellWidth: 50 },
                    1: { cellWidth: 20 },
                    2: { cellWidth: 15 },
                    3: { cellWidth: 70 },
                    4: { cellWidth: 70 },
                    5: { cellWidth: 20, halign: 'right' },
                }
            });
        });

        // Add footer to all pages
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

        doc.save(`Fiches_Cablage_${selectedRackIds.length > 1 ? 'Multiples' : selectedRackIds[0]}.pdf`);
    };

    const generatePhaseLoadPDF = () => {
        const chain = selectedChainForAnalysis;
        
        // Create maps for efficient lookups
        const equipmentMap = new Map(allData.equipements.map(e => [e.id, e]));
        const rackMap = new Map(allData.racks.map(r => [r.id, r]));
        const roomChainMapping: { [key: string]: { voie1: string, voie2: string } } = {
            'ITN1': { voie1: 'A', voie2: 'B' },
            'ITN2': { voie1: 'A', voie2: 'C' },
            'ITN3': { voie1: 'B', voie2: 'C' },
        };

        // Collect all load items for the selected chain
        let loadItems: any[] = [];
        let totalIT = { p1: 0, p2: 0, p3: 0, dc: 0 };

        allData.connexionsAC.forEach(conn => {
            // FIX: Add explicit type cast to resolve 'unknown' type error for 'eq'
            const eq = equipmentMap.get(conn.equipment_fk) as Equipment | undefined;
            if (!eq) return;
            // FIX: Add explicit type cast to resolve 'unknown' type error for 'rack'
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
                    // FIX: Changed incorrect variable 'c' to the correct loop variable 'conn'.
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
            
            // DEFINITIVE FIX: Use the same robust logic as AC connections to determine the chain.
            // This replaces the faulty logic that relied on a `chaine` property in the `tableauxDC` data.
            const mapping = roomChainMapping[rack.salle];
            const connChain = conn.voie === '1' ? mapping?.voie1 : mapping?.voie2;
            
            if (connChain === chain) {
                 const item = {
                    baie: `${rack.designation} (${rack.salle}/${rack.numero_baie})`,
                    equipement: eq.nom_equipement,
                    voie: `Voie ${conn.voie}`,
                    // FIX: Changed incorrect variable 'c' to the correct loop variable 'conn'.
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
        
        // Header
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text(`Rapport d'Analyse de Charge - Chaîne ${chain}`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 280, 15, { align: 'right' });

        // Summary
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

        // NEW: DC Calculation Details Table
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

        
        // Other consumers
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

        // IT equipment details
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
        
        // Add footer to all pages
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
        
        doc.save(`Analyse_Charge_Phase_Chaine_${chain}.pdf`);
    };

    const handleDownloadEquipment = () => {
        const csv = convertToCSV(allData.equipements);
        downloadCSV(csv, 'dcim_inventaire_equipements.csv');
    };
    
    const handleDownloadRacks = () => {
        const csv = convertToCSV(allData.racks);
        downloadCSV(csv, 'dcim_inventaire_baies.csv');
    };
    
    const generateAuditReportPDF = () => {
        // 1. Get all equipment with power > 0
        const equipmentWithPower = new Set(
            allData.equipements
                .filter(eq => {
                    const acPower = allData.connexionsAC
                        .filter(c => c.equipment_fk === eq.id)
                        .reduce((sum, c) => sum + toNum(c.puissance_kw), 0);
                    const dcPower = allData.connexionsDC
                        .filter(c => c.equipment_fk === eq.id)
                        .reduce((sum, c) => sum + toNum(c.puissance_kw), 0);
                    return (acPower + dcPower) > 0;
                })
                .map(eq => eq.id)
        );

        // 2. Filter racks that contain at least one such equipment
        const racksToReport = allData.racks
            .filter(rack => allData.equipements.some(eq => eq.rack_fk === rack.id && equipmentWithPower.has(eq.id)))
            .sort((a, b) => 
                a.salle.localeCompare(b.salle) || 
                a.rangee.localeCompare(b.rangee) || 
                toNum(a.numero_baie) - toNum(b.numero_baie)
            );

        if (racksToReport.length === 0) {
            alert("Aucune baie avec des équipements alimentés n'a été trouvée pour l'audit.");
            return;
        }

        // @ts-ignore
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;

        racksToReport.forEach((rack, index) => {
            if (index > 0) doc.addPage();

            // Header
            doc.setFontSize(18);
            doc.text("Rapport d'Audit et de Conformité", margin, 20);
            doc.setFontSize(12);
            doc.text(`Baie: ${rack.designation}`, margin, 28);
            doc.text(`Salle: ${rack.salle} | Rangée: ${rack.rangee}`, margin, 34);

            // Table
            const equipmentsInRack = allData.equipements
                .filter(eq => eq.rack_fk === rack.id && equipmentWithPower.has(eq.id))
                .sort((a, b) => toNum(b.u_position) - toNum(a.u_position));

            const body = equipmentsInRack.map(eq => [
                eq.nom_equipement,
                `U${toNum(eq.u_position)}`,
                `${toNum(eq.hauteur_u)}U`,
                eq.numero_serie || 'N/A',
                '' // Empty for manual checkbox
            ]);

            // @ts-ignore
            doc.autoTable({
                head: [['Nom Équipement', 'Position U', 'Hauteur U', 'N° de Série', 'Conforme (Oui/Non)']],
                body: body,
                startY: 42,
                theme: 'grid',
                headStyles: { fillColor: '#1e293b' },
                didDrawCell: (data: any) => {
                    // Draw a box in the "Conforme" column for manual checking
                    if (data.section === 'body' && data.column.index === 4) {
                        doc.setDrawColor(150);
                        doc.rect(data.cell.x + 2, data.cell.y + 2, 4, 4);
                    }
                }
            });
            
            let lastY = (doc as any).lastAutoTable.finalY + 15;

            // Anomalies Section
            doc.setFontSize(12);
            doc.text("Anomalies constatées :", margin, lastY);
            lastY += 5;
            for(let i = 0; i < 5; i++) {
                doc.setDrawColor(200);
                doc.line(margin, lastY + (i * 8), pageWidth - margin, lastY + (i * 8));
            }

            lastY += 5 * 8 + 15;

            // Signature Section
            doc.line(margin, lastY, margin + 70, lastY);
            doc.text("Signature de l'auditeur :", margin, lastY + 5);

            doc.line(pageWidth - margin - 50, lastY, pageWidth - margin, lastY);
            doc.text("Date :", pageWidth - margin - 50, lastY + 5);
        });
        
        // Footer for all pages
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor('#f97316');
            doc.text("Orange Restricted", margin, pageHeight - 10);
            doc.setTextColor(150);
            doc.text(`Page ${i} sur ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        }

        doc.save('Rapport_Audit_Conformite.pdf');
    };

  return (
    <>
      <Header title="Rapports & Exports de Données" />
      <div className="mt-6 space-y-8">
        
        <ReportCard 
            title="Rapport d'Audit et de Conformité"
            description="Générer un rapport d'inventaire PDF pour les audits physiques sur site. Inclut uniquement les baies avec des équipements alimentés."
            onDownload={generateAuditReportPDF}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReportCard 
                title="Inventaire Complet des Équipements"
                description="Exporter un fichier CSV de tous les équipements listés dans le DCIM."
                onDownload={handleDownloadEquipment}
            />
            <ReportCard 
                title="Inventaire Complet des Baies"
                description="Exporter un fichier CSV de toutes les baies, incluant leurs données de consommation."
                onDownload={handleDownloadRacks}
            />
        </div>
        
        {/* Phase Load Analysis Report Generator */}
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
            <h3 className="text-lg font-bold text-slate-100 mb-2">Rapport d'Analyse de Charge par Phase</h3>
            <p className="text-sm text-slate-400 mb-4">
                Sélectionnez une chaîne de puissance pour générer un rapport PDF détaillant la contribution de chaque équipement sur chaque phase.
            </p>
             <div className="flex items-center gap-4">
                <select 
                    value={selectedChainForAnalysis} 
                    onChange={e => setSelectedChainForAnalysis(e.target.value as 'A' | 'B' | 'C')} 
                    className="bg-slate-900 border border-slate-600 rounded-md p-2"
                >
                    <option value="A">Chaîne A</option>
                    <option value="B">Chaîne B</option>
                    <option value="C">Chaîne C</option>
                </select>
                <button 
                    onClick={generatePhaseLoadPDF}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover ml-auto"
                >
                    Générer PDF
                </button>
            </div>
        </div>


        {/* Rack Wiring Sheet Generator */}
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
            <h3 className="text-lg font-bold text-slate-100 mb-2">Générateur de Fiche de Câblage PDF</h3>
            <p className="text-sm text-slate-400 mb-4">
                Sélectionnez une ou plusieurs baies pour générer un PDF contenant les fiches de câblage.
            </p>

            <div className="space-y-4">
                 <div className="flex items-center gap-4">
                    <select 
                        value={selectedRoom} 
                        onChange={e => handleRoomChange(e.target.value)} 
                        className="bg-slate-900 border border-slate-600 rounded-md p-2"
                    >
                        <option value="">-- Choisir une Salle --</option>
                        {rooms.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>

                    <button 
                        onClick={generateWiringPDF}
                        disabled={selectedRackIds.length === 0}
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover disabled:bg-slate-600 disabled:cursor-not-allowed ml-auto"
                    >
                        Générer PDF ({selectedRackIds.length})
                    </button>
                </div>

                <div className="bg-slate-900/50 border border-slate-700 rounded-md p-4 space-y-4 min-h-[12rem] overflow-x-auto">
                    {selectedRoom ? (
                        Array.from(racksByRow.entries()).length > 0 ? (
                            Array.from(racksByRow.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([row, racksInRow]) => (
                                <div key={row}>
                                    <h4 className="font-semibold text-slate-300 mb-2">Rangée {row}</h4>
                                    <div className="flex flex-nowrap gap-3 pb-2">
                                        {racksInRow.map(rack => {
                                            const isSelected = selectedRackIds.includes(rack.id);
                                            const v1_total = toNum(rack.conso_baie_v1_ph1_kw) + toNum(rack.conso_baie_v1_ph2_kw) + toNum(rack.conso_baie_v1_ph3_kw) + toNum(rack.conso_baie_v1_dc_kw);
                                            const v2_total = toNum(rack.conso_baie_v2_ph1_kw) + toNum(rack.conso_baie_v2_ph2_kw) + toNum(rack.conso_baie_v2_ph3_kw) + toNum(rack.conso_baie_v2_dc_kw);
                                            const totalPower = v1_total + v2_total;
                                            const powerType = getRackPowerType(rack, allData);
                                            
                                            let bgColor = 'bg-slate-700 hover:bg-slate-600';
                                            let label = '';

                                            if (totalPower > 0) {
                                                switch(powerType) {
                                                    case 'AC_TRI': bgColor = 'bg-green-500/60 hover:bg-green-400/60'; label = 'TRI'; break;
                                                    case 'AC_MONO': bgColor = 'bg-sky-500/60 hover:bg-sky-400/60'; label = 'MONO'; break;
                                                    case 'DC': bgColor = 'bg-violet-500/60 hover:bg-violet-400/60'; label = 'DC'; break;
                                                }
                                            }
                                            
                                            return (
                                                <button
                                                    key={rack.id}
                                                    onClick={() => toggleRackSelection(rack.id)}
                                                    className={`w-14 h-14 flex-shrink-0 flex flex-col items-center justify-center rounded-md border-2 text-sm font-semibold transition-all ${bgColor} ${
                                                        isSelected ? 'border-primary' : 'border-transparent'
                                                    }`}
                                                    title={rack.designation}
                                                >
                                                    <span className="text-lg text-white">{rack.numero_baie}</span>
                                                    <span className="text-[10px] text-slate-200 h-3">{label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        ) : (
                             <div className="flex items-center justify-center h-32 text-slate-500">
                                Aucune baie dans cette salle.
                             </div>
                        )
                    ) : (
                        <div className="flex items-center justify-center h-32 text-slate-500">
                            Sélectionnez une salle pour voir les baies.
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        <DcInventoryReport allData={allData} />

      </div>
    </>
  );
};

export default Reporting;