import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Rack, Equipment, RackUtilization, AllData, ACConnection, DCConnection } from '../types.ts';
import { CloseIcon, ServerIcon, PlusIcon, EditIcon, TrashIcon, WarningIcon } from './icons.tsx';
import { toNum, parseRackDimensions, getOutletsForACBox, deleteEquipmentAndUpdateState, recalculateRackPower, getRackPowerType, calculateImbalance } from '../utils/powerUtils.ts';

interface RackDetailModalProps {
  rack: Rack;
  equipments: Equipment[];
  utilization: RackUtilization;
  onClose: () => void;
  onSelectEquipment: (equipmentId: string) => void;
  allData: AllData;
  setAllData: React.Dispatch<React.SetStateAction<AllData | null>>;
}

const ProgressBar: React.FC<{ value: number }> = ({ value }) => {
  const percentage = Math.min(value, 100);
  let bgColor = 'bg-ok-green';
  if (percentage > 90) {
    bgColor = 'bg-danger-red';
  } else if (percentage > 80) {
    bgColor = 'bg-warning-orange';
  }

  return (
    <div className="w-full bg-slate-700 rounded-full h-2.5">
      <div
        className={`${bgColor} h-2.5 rounded-full transition-all duration-500`}
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
};

const PowerInputField: React.FC<{label: string, value: number | string | undefined, onChange: (val: string) => void, disabled: boolean}> = ({label, value, onChange, disabled}) => (
    <div>
        <label className="text-xs text-slate-400">{label}</label>
        <input 
            type="text"
            disabled={disabled}
            value={String(value || '0').replace('.', ',')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-sm rounded bg-slate-900 border-slate-600 p-1 text-center disabled:bg-slate-800/50 disabled:border-transparent"
        />
    </div>
);

const ConnectionSelectField: React.FC<{label: string, value: string | undefined, onChange: (val: string) => void, disabled: boolean, options: {value: string, label: string}[]}> = ({label, value, onChange, disabled, options}) => (
    <div>
        <label className="text-xs text-slate-400">{label}</label>
        <select
            disabled={disabled}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-sm rounded bg-slate-900 border-slate-600 p-1 disabled:bg-slate-800/50 disabled:border-transparent disabled:text-slate-400"
        >
            <option value="">Aucun</option>
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);

// --- NEW HELPER COMPONENTS FOR POWER DISPLAY ---

const ImbalanceIndicator: React.FC<{ p1?: number|string, p2?: number|string, p3?: number|string, title: string }> = ({ p1, p2, p3, title }) => {
  const imbalance = calculateImbalance(toNum(p1), toNum(p2), toNum(p3));

  if (imbalance < 1) return null;

  const isCritical = imbalance > 20;
  const textColor = isCritical ? 'text-warning-orange' : 'text-slate-400';
  
  return (
    <div className={`mt-3 text-center text-xs ${textColor} ${isCritical ? 'font-bold' : ''}`}>
      {title}: {imbalance.toFixed(0)}%
      {isCritical && <WarningIcon className="w-3 h-3 inline-block ml-1" />}
    </div>
  );
};

const VoiePowerDetails: React.FC<{
  voie: '1' | '2';
  rack: Rack;
  rackPowerType: 'DC' | 'AC_TRI' | 'AC_MONO';
}> = ({ voie, rack, rackPowerType }) => {
    const v = `v${voie}` as 'v1' | 'v2';
    
    const renderRealValue = (calculatedKw: number | string, realKw?: number | string) => {
        const calculated = toNum(calculatedKw);
        const real = toNum(realKw);
        const hasRealData = realKw !== undefined && realKw !== null && String(realKw).trim() !== '';

        let realColor = 'text-slate-500';

        if (hasRealData) {
            if (real > calculated) {
                realColor = 'text-danger-red';
            } else {
                realColor = 'text-ok-green';
            }
        }

        return (
            <div className={`p-2 rounded-lg bg-slate-900 border border-slate-700/50 text-center flex items-center justify-center ${realColor}`}>
                <span className="font-bold">{hasRealData ? real.toFixed(2) : '-.--'}</span>
            </div>
        );
    };
    
    // Sums for MONO AC display
    const calculatedMonoAc = toNum(rack[`conso_baie_${v}_ph1_kw`]) + toNum(rack[`conso_baie_${v}_ph2_kw`]) + toNum(rack[`conso_baie_${v}_ph3_kw`]);
    
    const realPh1 = rack[`conso_reelle_${v}_ph1_kw`];
    const realPh2 = rack[`conso_reelle_${v}_ph2_kw`];
    const realPh3 = rack[`conso_reelle_${v}_ph3_kw`];

    const hasRealMonoAcData = 
        (realPh1 !== undefined && String(realPh1).trim() !== '') ||
        (realPh2 !== undefined && String(realPh2).trim() !== '') ||
        (realPh3 !== undefined && String(realPh3).trim() !== '');

    const realMonoAc = toNum(realPh1) + toNum(realPh2) + toNum(realPh3);


    return (
        <div className="bg-slate-900/30 p-3 rounded-md">
            <p className="font-semibold text-center text-slate-300 mb-3">Consommation Voie {voie} (kW)</p>
            {(rackPowerType === 'DC' || rackPowerType === 'AC_MONO') && (
                <div className="space-y-2 max-w-xs mx-auto">
                    <div className="flex items-center">
                        <div className="w-16 text-sm text-slate-400 text-right pr-2 font-medium">Calc:</div>
                        <div className="flex-1 p-2 rounded-lg bg-slate-900 border border-slate-700/50 text-center">
                            <span className="font-semibold text-slate-200">{
                                rackPowerType === 'DC' 
                                    ? toNum(rack[`conso_baie_${v}_dc_kw`]).toFixed(2) 
                                    : calculatedMonoAc.toFixed(2)
                            }</span>
                        </div>
                    </div>
                     <div className="flex items-center">
                        <div className="w-16 text-sm text-slate-400 text-right pr-2 font-medium">Réel:</div>
                        <div className="flex-1">
                            {renderRealValue(
                                rackPowerType === 'DC' 
                                    ? rack[`conso_baie_${v}_dc_kw`] 
                                    : calculatedMonoAc, 
                                rackPowerType === 'DC' 
                                    ? rack[`conso_reelle_${v}_dc_kw`] 
                                    : (hasRealMonoAcData ? realMonoAc : undefined)
                            )}
                        </div>
                    </div>
                </div>
            )}
            {rackPowerType === 'AC_TRI' && (
                <>
                    <div className="space-y-3">
                        <div className="grid grid-cols-4 gap-3 text-center text-xs font-semibold text-slate-300">
                            <div />
                            <div>Ph 1</div>
                            <div>Ph 2</div>
                            <div>Ph 3</div>
                        </div>

                        <div className="grid grid-cols-4 gap-3 items-center">
                            <div className="text-sm text-slate-400 text-right pr-2 font-medium">Calc:</div>
                            <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/50 text-center">
                                <span className="font-semibold text-slate-200">{toNum(rack[`conso_baie_${v}_ph1_kw`]).toFixed(2)}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/50 text-center">
                                <span className="font-semibold text-slate-200">{toNum(rack[`conso_baie_${v}_ph2_kw`]).toFixed(2)}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/50 text-center">
                                <span className="font-semibold text-slate-200">{toNum(rack[`conso_baie_${v}_ph3_kw`]).toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-3 items-center">
                            <div className="text-sm text-slate-400 text-right pr-2 font-medium">Réel:</div>
                            {renderRealValue(rack[`conso_baie_${v}_ph1_kw`], rack[`conso_reelle_${v}_ph1_kw`])}
                            {renderRealValue(rack[`conso_baie_${v}_ph2_kw`], rack[`conso_reelle_${v}_ph2_kw`])}
                            {renderRealValue(rack[`conso_baie_${v}_ph3_kw`], rack[`conso_reelle_${v}_ph3_kw`])}
                        </div>
                    </div>
                    <ImbalanceIndicator 
                        title="Déséquilibre Réel"
                        p1={rack[`conso_reelle_${v}_ph1_kw`]}
                        p2={rack[`conso_reelle_${v}_ph2_kw`]}
                        p3={rack[`conso_reelle_${v}_ph3_kw`]}
                    />
                </>
            )}
        </div>
    );
}


const RackVisualizer: React.FC<{ 
    rack: Rack; 
    equipments: Equipment[], 
    onSelectEquipment: (equipmentId: string) => void,
    allData: AllData 
}> = ({ rack, equipments, onSelectEquipment, allData }) => {
    const totalU = parseRackDimensions(rack.dimensions);
    
    const pdus = equipments.filter(eq => eq.type_equipement === 'PDU');
    const regularEquipments = equipments.filter(eq => eq.type_equipement !== 'PDU');
    
    const roomChainMapping = { 'ITN1': { voie1: 'A', voie2: 'B' }, 'ITN2': { voie1: 'A', voie2: 'C' }, 'ITN3': { voie1: 'B', voie2: 'C' } };

    const getPduChain = (pdu: Equipment): 'A' | 'B' | 'C' | null => {
        if (!rack?.salle) return null;
        const pduConnection = allData.connexionsAC.find(c => c.equipment_fk === pdu.id) || allData.connexionsDC.find(c => c.equipment_fk === pdu.id);
        if (!pduConnection) return null;

        const mapping = roomChainMapping[rack.salle as keyof typeof roomChainMapping] || { voie1: 'A', voie2: 'B' }; // default mapping
        if (pduConnection.voie === '1') return mapping.voie1 as 'A' | 'B' | 'C';
        if (pduConnection.voie === '2') return mapping.voie2 as 'A' | 'B' | 'C';

        return null;
    };

    const getPduColors = (pdu: Equipment) => {
        const chain = getPduChain(pdu);
        switch (chain) {
            case 'A': return 'bg-danger-red/50 border-danger-red/80 hover:bg-danger-red/70'; // Red for A
            case 'B': return 'bg-ok-green/50 border-ok-green/80 hover:bg-ok-green/70'; // Green for B
            case 'C': return 'bg-yellow-500/50 border-yellow-500/80 hover:bg-yellow-500/70'; // Yellow for C
            default: return 'bg-dc-purple/50 border-dc-purple/80 hover:bg-dc-purple/70'; // Default
        }
    };

    const renderPDUs = () => {
        const pduElements = [];
        const pduHeightU = 30;
        const gridRowStart = totalU - 30 + 1;

        if (pdus.length > 0) {
            const firstPdu = pdus[0];
            pduElements.push(
                <div
                    key={`pdu-${firstPdu.id}`}
                    onClick={() => onSelectEquipment(firstPdu.id)}
                    className={`col-start-102 col-span-1 ${getPduColors(firstPdu)} rounded-sm flex items-center justify-center cursor-pointer`}
                    style={{ gridRow: `${gridRowStart} / span ${pduHeightU}` }}
                    title={`${firstPdu.nom_equipement} (PDU)`}
                >
                    <span className="text-white text-[10px] font-bold transform -rotate-90 whitespace-nowrap">{firstPdu.nom_equipement}</span>
                </div>
            );
        }
        if (pdus.length > 1) {
            const secondPdu = pdus[1];
             pduElements.push(
                <div
                    key={`pdu-${secondPdu.id}`}
                    onClick={() => onSelectEquipment(secondPdu.id)}
                    className={`col-start-1 col-span-1 ${getPduColors(secondPdu)} rounded-sm flex items-center justify-center cursor-pointer`}
                    style={{ gridRow: `${gridRowStart} / span ${pduHeightU}` }}
                    title={`${secondPdu.nom_equipement} (PDU)`}
                >
                   <span className="text-white text-[10px] font-bold transform -rotate-90 whitespace-nowrap">{secondPdu.nom_equipement}</span>
                </div>
            );
        }
        return pduElements;
    };

    const CopperPatchPanel: React.FC<{ equipment: Equipment; onClick: () => void; }> = ({ equipment, onClick }) => (
        <div 
            onClick={onClick} 
            className="h-full w-full bg-orange-500/30 border-2 border-orange-500/80 rounded-sm flex items-center justify-between p-1 cursor-pointer hover:bg-orange-500/50 text-left"
            title={`${equipment.nom_equipement} (Cuivre)`}
        >
            <span className="text-xs font-bold text-white truncate flex-shrink-0 mr-2">{equipment.nom_equipement}</span>
            <div className="flex-grow grid grid-cols-12 gap-px h-full p-px">
                {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="bg-slate-900/70 border-b border-orange-900/50" title={`Port ${i+1}`}></div>
                ))}
            </div>
        </div>
    );

    const FiberPatchPanel: React.FC<{ equipment: Equipment; onClick: () => void; }> = ({ equipment, onClick }) => (
        <div 
            onClick={onClick} 
            className="h-full w-full bg-yellow-400/30 border-2 border-yellow-400/80 rounded-sm flex items-center justify-between p-1 cursor-pointer hover:bg-yellow-400/50 text-left"
            title={`${equipment.nom_equipement} (Fibre)`}
        >
            <span className="text-xs font-bold text-white truncate flex-shrink-0 mr-2">{equipment.nom_equipement}</span>
            <div className="flex-grow grid grid-cols-12 gap-px h-full p-px">
                {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="bg-slate-900/70 border border-slate-700/50 rounded-sm flex items-center justify-center" title={`Port ${i+1}`}>
                        <div className="w-px h-px bg-cyan-300/80"></div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderUSlots = () => {
        return regularEquipments.map(eq => {
            const startU = toNum(eq.u_position);
            const heightU = toNum(eq.hauteur_u) || 1;
            const endU = startU + heightU - 1;
            const gridRowStart = totalU - endU + 1;

            if (startU < 1 || endU > totalU) {
                console.warn(`Equipment ${eq.id} at U${startU} with height ${heightU}U is out of rack bounds (1-${totalU}U).`);
                return null;
            }

            let content: React.ReactNode;

            switch (eq.type_equipement) {
                case 'Patch Panel Cuivre':
                    content = <CopperPatchPanel equipment={eq} onClick={() => onSelectEquipment(eq.id)} />;
                    break;
                case 'Patch Panel Fibre':
                    content = <FiberPatchPanel equipment={eq} onClick={() => onSelectEquipment(eq.id)} />;
                    break;
                case 'Passe câble':
                    content = (
                        <div
                            onClick={() => onSelectEquipment(eq.id)}
                            className="h-full w-full bg-slate-600/50 border-2 border-slate-500/80 rounded-sm flex items-center justify-between px-2 cursor-pointer hover:bg-slate-600/70 text-left"
                            title={`${eq.nom_equipement} (Passe câble)`}
                        >
                            <span className="text-xs font-bold text-white truncate">{eq.nom_equipement}</span>
                            <div className="w-3/4 h-1 bg-slate-900/50 rounded-full"></div>
                        </div>
                    );
                    break;
                default:
                    content = (
                        <div
                            onClick={() => onSelectEquipment(eq.id)}
                            className="h-full w-full bg-primary/30 border-2 border-primary/80 rounded-sm flex items-center justify-between px-2 cursor-pointer hover:bg-primary/50 text-left"
                            title={`${eq.nom_equipement} (U${startU} - U${endU})`}
                        >
                            <span className="text-xs font-bold text-white truncate">{eq.nom_equipement}</span>
                            <span className="text-xs text-slate-300 font-mono flex-shrink-0 ml-2">{heightU}U</span>
                        </div>
                    );
                    break;
            }

            return (
                <div
                    key={`eq-${eq.id}`}
                    className="col-start-2 col-span-100"
                    style={{ gridRow: `${gridRowStart} / span ${heightU}` }}
                >
                    {content}
                </div>
            );
        });
    };
    
    const renderULabels = () => {
         const labels = [];
         for (let u = totalU; u >= 1; u--) {
             labels.push(
                <div key={`label-${u}`} className="text-[10px] text-slate-500 text-right pr-2 flex items-center justify-end">{u}</div>
             );
         }
         return labels;
    };

    return (
        <div className="bg-slate-900/50 p-4 rounded-lg">
            <h3 className="text-md font-semibold text-slate-200 mb-3">Visualisation de la Baie ({totalU}U)</h3>
            <div className="flex">
                <div className="grid" style={{ gridTemplateRows: `repeat(${totalU}, 1.25rem)` }}>
                    {renderULabels()}
                </div>
                <div className="flex-grow bg-slate-800 border-2 border-slate-700 rounded-md p-1 grid grid-cols-102 gap-x-1" style={{ gridTemplateRows: `repeat(${totalU}, 1.25rem)` }}>
                    {renderPDUs()}
                    {renderUSlots()}
                </div>
            </div>
        </div>
    );
};


export const RackDetailModal: React.FC<RackDetailModalProps> = ({ rack, equipments, utilization, onClose, onSelectEquipment, allData, setAllData }) => {
  const [isAddingEquipment, setIsAddingEquipment] = useState(false);
  const [newEquipment, setNewEquipment] = useState({
      nom_equipement: '',
      type_equipement: 'Serveur',
      type_alimentation: 'AC',
      u_position: 1,
      hauteur_u: 1,
      poids_kg: '',
      numero_serie: '',
  });

  const [isEditingPower, setIsEditingPower] = useState(false);
  const [editableRack, setEditableRack] = useState<Rack>(rack);

  // State for dragging
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setEditableRack(rack);
  }, [rack]);
  
  // Effect for automatic AC connection inheritance and global state update
  useEffect(() => {
    const pdusInRack = equipments.filter(eq => eq.type_equipement === 'PDU');
    
    const findConnection = (voie: '1' | '2'): { boxId: string, outlet: string } => {
        let pduForVoie = pdusInRack.find(pdu => 
            allData.connexionsAC.some(c => c.equipment_fk === pdu.id && c.voie === voie)
        );
        let connection: ACConnection | undefined;

        if (pduForVoie) {
            connection = allData.connexionsAC.find(c => c.equipment_fk === pduForVoie!.id && c.voie === voie);
        } else {
            // If no PDU, check the first non-PDU equipment for a connection on that voie
            const firstEquipment = equipments.find(eq => eq.type_equipement !== 'PDU' && allData.connexionsAC.some(c => c.equipment_fk === eq.id && c.voie === voie));
            if (firstEquipment) {
                connection = allData.connexionsAC.find(c => c.equipment_fk === firstEquipment.id && c.voie === voie);
            }
        }
        
        if (!connection) {
            return { boxId: '', outlet: '' };
        }

        let outlet = connection.outlet_name;
        // For single-phase connections, reconstruct the descriptive name to match dropdown options.
        if (connection.phase && ['P1', 'P2', 'P3'].includes(connection.phase)) {
            const box = allData.boitiersAC.find(b => b.id === connection.ac_box_fk);
            const outlets = box ? getOutletsForACBox(box.configuration) : [];
            const fullOutletName = `${connection.outlet_name} (${connection.phase})`;
            
            // Use the reconstructed name only if it exists in the box's configuration.
            // This handles cases where the old format ("MONO 1") is still in use.
            if (outlets.includes(fullOutletName)) {
                outlet = fullOutletName;
            }
        }
        
        return { boxId: connection.ac_box_fk, outlet: outlet };
    };

    const v1 = findConnection('1');
    const v2 = findConnection('2');
    
    const needsGlobalUpdate = 
        rack.ac_box_id_v1 !== v1.boxId || 
        rack.ac_outlet_v1 !== v1.outlet || 
        rack.ac_box_id_v2 !== v2.boxId || 
        rack.ac_outlet_v2 !== v2.outlet;

    setEditableRack(prev => ({
        ...prev,
        ac_box_id_v1: v1.boxId,
        ac_outlet_v1: v1.outlet,
        ac_box_id_v2: v2.boxId,
        ac_outlet_v2: v2.outlet,
    }));

    if (needsGlobalUpdate) {
        setAllData(prevData => {
            if (!prevData) return null;
            const updatedRacks = prevData.racks.map(r => {
                if (r.id === rack.id) {
                    return {
                        ...r,
                        ac_box_id_v1: v1.boxId,
                        ac_outlet_v1: v1.outlet,
                        ac_box_id_v2: v2.boxId,
                        ac_outlet_v2: v2.outlet,
                    };
                }
                return r;
            });
            return { ...prevData, racks: updatedRacks };
        });
    }
    
  }, [rack, equipments, allData.connexionsAC, allData.boitiersAC, setAllData]);


  const handleDeleteEquipment = (equipmentId: string, equipmentName: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'équipement "${equipmentName}" ? Cette action est irréversible et supprimera également ses connexions électriques.`)) {
        setAllData(prevData => {
            if (!prevData) return null;
            return deleteEquipmentAndUpdateState(prevData, equipmentId);
        });
    }
  };
  
  const handleMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('header') && !target.closest('input, button, select')) {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleNewEquipmentTypeChange = (newType: string) => {
    if (newType === 'PDU') {
        setNewEquipment(prev => ({
            ...prev,
            type_equipement: newType,
            u_position: 1,
            hauteur_u: 30,
        }));
    } else {
        setNewEquipment(prev => ({
            ...prev,
            type_equipement: newType,
            u_position: prev.u_position === 0 ? 1 : prev.u_position, 
            hauteur_u: prev.hauteur_u === 30 ? 1 : prev.hauteur_u,
        }));
    }
  };

  const handleAddEquipment = () => {
    if (!newEquipment.nom_equipement.trim()) {
        alert("Le nom de l'équipement ne peut pas être vide.");
        return;
    }

    const newEqId = `EQ-${Date.now()}`;
    const newEqData: Equipment = {
        id: newEqId,
        rack_fk: rack.id,
        nom_equipement: newEquipment.nom_equipement,
        type_alimentation: newEquipment.type_alimentation as 'AC' | 'DC' | 'AC/DC',
        type_equipement: newEquipment.type_equipement,
        u_position: toNum(newEquipment.u_position) || 1,
        hauteur_u: toNum(newEquipment.hauteur_u) || 1,
        poids_kg: toNum(newEquipment.poids_kg),
        numero_serie: newEquipment.numero_serie,
        statut: 'Planifié',
    };

    let newConnectionsAC: ACConnection[] = [];
    let newConnectionsDC: DCConnection[] = [];

    const pdusInRack = equipments.filter(eq => eq.type_equipement === 'PDU');
    const pduIds = pdusInRack.map(p => p.id);
    
    const pduAcConnections = allData.connexionsAC.filter(c => pduIds.includes(c.equipment_fk));
    const pduDcConnections = allData.connexionsDC.filter(c => pduIds.includes(c.equipment_fk));

    const acTemplateV1 = pduAcConnections.find(c => c.voie === '1');
    const acTemplateV2 = pduAcConnections.find(c => c.voie === '2');
    const dcTemplateV1 = pduDcConnections.find(c => c.voie === '1');
    const dcTemplateV2 = pduDcConnections.find(c => c.voie === '2');

    if (['AC', 'AC/DC'].includes(newEqData.type_alimentation)) {
        if (acTemplateV1) {
            newConnectionsAC.push({
                id: `ACC-${Date.now()}-v1`,
                equipment_fk: newEqId,
                ac_box_fk: acTemplateV1.ac_box_fk,
                outlet_name: acTemplateV1.outlet_name,
                phase: 'P1', // Default phase as requested
                voie: '1',
                puissance_kw: 0,
            });
        }
        if (acTemplateV2) {
             newConnectionsAC.push({
                id: `ACC-${Date.now()}-v2`,
                equipment_fk: newEqId,
                ac_box_fk: acTemplateV2.ac_box_fk,
                outlet_name: acTemplateV2.outlet_name,
                phase: 'P1', // Default phase
                voie: '2',
                puissance_kw: 0,
            });
        }
    }

    if (['DC', 'AC/DC'].includes(newEqData.type_alimentation)) {
         if (dcTemplateV1) {
            newConnectionsDC.push({
                id: `DCC-${Date.now()}-v1`,
                equipment_fk: newEqId,
                dc_panel_fk: dcTemplateV1.dc_panel_fk,
                breaker_number: 1, // Default number, user can edit
                breaker_rating_a: dcTemplateV1.breaker_rating_a, // Inherit rating
                voie: '1',
                puissance_kw: 0,
            });
        }
        if (dcTemplateV2) {
            newConnectionsDC.push({
                id: `DCC-${Date.now()}-v2`,
                equipment_fk: newEqId,
                dc_panel_fk: dcTemplateV2.dc_panel_fk,
                breaker_number: 1, // Default number
                breaker_rating_a: dcTemplateV2.breaker_rating_a, // Inherit rating
                voie: '2',
                puissance_kw: 0,
            });
        }
    }

    setAllData(prevData => {
        if (!prevData) return null;

        const dataWithNewItems = {
            ...prevData,
            equipements: [...prevData.equipements, newEqData],
            connexionsAC: [...prevData.connexionsAC, ...newConnectionsAC],
            connexionsDC: [...prevData.connexionsDC, ...newConnectionsDC],
        };

        const updatedRacks = dataWithNewItems.racks.map(r => {
            if (r.id === rack.id) {
                return recalculateRackPower(r, dataWithNewItems);
            }
            return r;
        });
        
        return {
            ...dataWithNewItems,
            racks: updatedRacks,
        };
    });

    setIsAddingEquipment(false);
    setNewEquipment({ nom_equipement: '', type_equipement: 'Serveur', type_alimentation: 'AC', u_position: 1, hauteur_u: 1, poids_kg: '', numero_serie: '' });
  };
  
  const handlePowerChange = (field: keyof Rack, value: string) => {
    setEditableRack(prev => ({ ...prev, [field]: value }));
  };

  const savePowerChanges = () => {
    setAllData(prev => {
        if (!prev) return null;
        return {
            ...prev,
            racks: prev.racks.map(r => r.id === editableRack.id ? editableRack : r)
        };
    });
    setIsEditingPower(false);
  };
  
  const rackPowerType = getRackPowerType(rack, allData);

  const availableOutletsV1 = useMemo(() => {
    const selectedBox = allData.boitiersAC.find(box => box.id === editableRack.ac_box_id_v1);
    if (!selectedBox) return [];
    return getOutletsForACBox(selectedBox.configuration).map(o => ({ value: o, label: o }));
  }, [editableRack.ac_box_id_v1, allData.boitiersAC]);

  const availableOutletsV2 = useMemo(() => {
    const selectedBox = allData.boitiersAC.find(box => box.id === editableRack.ac_box_id_v2);
    if (!selectedBox) return [];
    return getOutletsForACBox(selectedBox.configuration).map(o => ({ value: o, label: o }));
  }, [editableRack.ac_box_id_v2, allData.boitiersAC]);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-40" onClick={onClose}>
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl max-h-[90vh] bg-slate-800 border border-slate-700 shadow-2xl flex flex-col rounded-lg" 
        onClick={e => e.stopPropagation()}
        style={{ transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))` }}
      >
        <header 
          className={`p-4 border-b border-slate-700 flex justify-between items-center ${isDragging ? 'cursor-grabbing' : 'cursor-move'}`}
          onMouseDown={handleMouseDown}
        >
          <div className="flex-grow mr-4">
             {isEditingPower ? (
                <input
                    type="text"
                    value={editableRack.designation}
                    onChange={(e) => handlePowerChange('designation', e.target.value)}
                    className="text-xl font-bold text-slate-100 bg-slate-900 border border-slate-600 rounded-md px-2 py-1 w-full max-w-sm cursor-text"
                    autoFocus
                />
            ) : (
                <h2 className="text-xl font-bold text-slate-100">{rack.designation}</h2>
            )}
            <p className="text-sm text-slate-400">Baie {rack.numero_baie} - Salle {rack.salle} / Rangée {rack.rangee}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700 flex-shrink-0" style={{ cursor: 'pointer' }}>
            <CloseIcon className="w-6 h-6 text-slate-400" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div className="bg-slate-900/50 p-4 rounded-lg">
                    <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm font-medium text-slate-300">Consommation Électrique</span>
                        <span className="text-lg font-bold text-slate-100">
                            {utilization?.totalPower.toFixed(2)} kW / <span className="text-base font-normal text-slate-400">{utilization?.capacity.toFixed(2)} kW</span>
                        </span>
                    </div>
                    <ProgressBar value={utilization?.percentage || 0} />
                    <p className="text-right text-sm font-bold mt-1">{utilization?.percentage.toFixed(1)}%</p>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-md font-semibold text-slate-200">Consommation & Connexions</h3>
                        {!isEditingPower ? (
                            <button onClick={() => setIsEditingPower(true)} className="flex items-center text-sm text-primary hover:text-primary-hover"><EditIcon className="w-4 h-4 mr-1"/> Modifier</button>
                        ) : (
                            <div className="space-x-2">
                                <button onClick={() => { setIsEditingPower(false); setEditableRack(rack); }} className="px-3 py-1 text-xs bg-slate-600 rounded">Annuler</button>
                                <button onClick={savePowerChanges} className="px-3 py-1 text-xs bg-ok-green text-white rounded">Enregistrer</button>
                            </div>
                        )}
                    </div>
                    {isEditingPower ? (
                        <>
                            <div>
                                <label className="text-sm font-medium text-slate-300">Capacité PDU (kW)</label>
                                <input
                                    type="text"
                                    disabled={!isEditingPower}
                                    value={String(editableRack.puissance_pdu_kw).replace('.', ',')}
                                    onChange={(e) => handlePowerChange('puissance_pdu_kw', e.target.value)}
                                    className="w-full mt-1 text-lg rounded bg-slate-800 border-slate-600 p-1 text-center font-bold disabled:bg-slate-900/50 disabled:border-transparent"
                                />
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-700/50">
                                <p className="font-semibold text-center text-slate-300 mb-2">Consommation Réelle Mesurée (kW)</p>
                                {rackPowerType === 'AC_TRI' && (
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                        <div>
                                            <p className="font-semibold text-xs text-center text-slate-400 mb-2">Voie 1</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <PowerInputField disabled={!isEditingPower} label="Ph 1" value={editableRack.conso_reelle_v1_ph1_kw} onChange={(v) => handlePowerChange('conso_reelle_v1_ph1_kw', v)} />
                                                <PowerInputField disabled={!isEditingPower} label="Ph 2" value={editableRack.conso_reelle_v1_ph2_kw} onChange={(v) => handlePowerChange('conso_reelle_v1_ph2_kw', v)} />
                                                <PowerInputField disabled={!isEditingPower} label="Ph 3" value={editableRack.conso_reelle_v1_ph3_kw} onChange={(v) => handlePowerChange('conso_reelle_v1_ph3_kw', v)} />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-xs text-center text-slate-400 mb-2">Voie 2</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <PowerInputField disabled={!isEditingPower} label="Ph 1" value={editableRack.conso_reelle_v2_ph1_kw} onChange={(v) => handlePowerChange('conso_reelle_v2_ph1_kw', v)} />
                                                <PowerInputField disabled={!isEditingPower} label="Ph 2" value={editableRack.conso_reelle_v2_ph2_kw} onChange={(v) => handlePowerChange('conso_reelle_v2_ph2_kw', v)} />
                                                <PowerInputField disabled={!isEditingPower} label="Ph 3" value={editableRack.conso_reelle_v2_ph3_kw} onChange={(v) => handlePowerChange('conso_reelle_v2_ph3_kw', v)} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {rackPowerType === 'AC_MONO' && (
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                        <div>
                                            <p className="font-semibold text-xs text-center text-slate-400 mb-2">Voie 1</p>
                                            <PowerInputField disabled={!isEditingPower} label="Phase 1" value={editableRack.conso_reelle_v1_ph1_kw} onChange={(v) => handlePowerChange('conso_reelle_v1_ph1_kw', v)} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-xs text-center text-slate-400 mb-2">Voie 2</p>
                                            <PowerInputField disabled={!isEditingPower} label="Phase 1" value={editableRack.conso_reelle_v2_ph1_kw} onChange={(v) => handlePowerChange('conso_reelle_v2_ph1_kw', v)} />
                                        </div>
                                    </div>
                                )}
                                {rackPowerType === 'DC' && (
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                        <div>
                                            <p className="font-semibold text-xs text-center text-slate-400 mb-2">Voie 1</p>
                                            <PowerInputField disabled={!isEditingPower} label="DC" value={editableRack.conso_reelle_v1_dc_kw} onChange={(v) => handlePowerChange('conso_reelle_v1_dc_kw', v)} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-xs text-center text-slate-400 mb-2">Voie 2</p>
                                            <PowerInputField disabled={!isEditingPower} label="DC" value={editableRack.conso_reelle_v2_dc_kw} onChange={(v) => handlePowerChange('conso_reelle_v2_dc_kw', v)} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="text-sm font-medium text-slate-300">Capacité PDU (kW)</label>
                                <p className="w-full mt-1 text-lg rounded bg-slate-900/50 p-1 text-center font-bold">{toNum(editableRack.puissance_pdu_kw).toFixed(2)}</p>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <VoiePowerDetails voie="1" rack={editableRack} rackPowerType={rackPowerType} />
                                <VoiePowerDetails voie="2" rack={editableRack} rackPowerType={rackPowerType} />
                            </div>
                        </>
                    )}

                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 pt-4 border-t border-slate-700/50">
                        <div>
                            <p className="font-semibold text-center text-slate-300 mb-2">Voie 1</p>
                             <div className="space-y-2">
                                <ConnectionSelectField label="Boîtier AC V1" value={editableRack.ac_box_id_v1} onChange={() => {}} disabled={true} options={allData.boitiersAC.map(b => ({value: b.id, label: b.id}))} />
                                <ConnectionSelectField label="Prise AC V1" value={editableRack.ac_outlet_v1} onChange={() => {}} disabled={true} options={availableOutletsV1} />
                            </div>
                        </div>
                         <div>
                            <p className="font-semibold text-center text-slate-300 mb-2">Voie 2</p>
                             <div className="space-y-2">
                                <ConnectionSelectField label="Boîtier AC V2" value={editableRack.ac_box_id_v2} onChange={() => {}} disabled={true} options={allData.boitiersAC.map(b => ({value: b.id, label: b.id}))} />
                                <ConnectionSelectField label="Prise AC V2" value={editableRack.ac_outlet_v2} onChange={() => {}} disabled={true} options={availableOutletsV2} />
                            </div>
                        </div>
                    </div>

                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="text-md font-semibold text-slate-200">Équipements ({equipments.length})</h3>
                        {!isAddingEquipment && (
                            <button onClick={() => setIsAddingEquipment(true)} className="flex items-center text-sm text-primary hover:text-primary-hover">
                                <PlusIcon className="w-4 h-4 mr-1"/> Ajouter Équipement
                            </button>
                        )}
                    </div>
                    {isAddingEquipment && (
                        <div className="bg-slate-700/50 p-3 rounded-lg space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                <div className="md:col-span-2">
                                    <label className="text-xs text-slate-400">Nom Équipement*</label>
                                    <input type="text" value={newEquipment.nom_equipement} onChange={(e) => setNewEquipment({...newEquipment, nom_equipement: e.target.value})} className="w-full text-sm rounded-md bg-slate-900 border-slate-600" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400">Type Équipement</label>
                                    <select value={newEquipment.type_equipement} onChange={(e) => handleNewEquipmentTypeChange(e.target.value)} className="w-full text-sm rounded-md bg-slate-900 border-slate-600">
                                        <option>Serveur</option>
                                        <option>Switch</option>
                                        <option>Stockage</option>
                                        <option>Routeur</option>
                                        <option>Firewall</option>
                                        <option>PDU</option>
                                        <option>Passe câble</option>
                                        <option>Patch Panel Cuivre</option>
                                        <option>Patch Panel Fibre</option>
                                        <option>Autre</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400">Type Alimentation</label>
                                    <select value={newEquipment.type_alimentation} onChange={(e) => setNewEquipment({...newEquipment, type_alimentation: e.target.value})} className="w-full text-sm rounded-md bg-slate-900 border-slate-600">
                                        <option value="AC">AC</option><option value="DC">DC</option><option value="AC/DC">AC/DC</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-slate-400">Position U</label>
                                        <input type="number" value={newEquipment.u_position} onChange={(e) => setNewEquipment({...newEquipment, u_position: parseInt(e.target.value)})} className="w-full text-sm rounded-md bg-slate-900 border-slate-600" disabled={newEquipment.type_equipement === 'PDU'}/>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400">Hauteur U</label>
                                        <input type="number" value={newEquipment.hauteur_u} onChange={(e) => setNewEquipment({...newEquipment, hauteur_u: parseInt(e.target.value)})} className="w-full text-sm rounded-md bg-slate-900 border-slate-600" disabled={newEquipment.type_equipement === 'PDU'}/>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400">Poids (kg)</label>
                                    <input type="text" value={newEquipment.poids_kg} onChange={(e) => setNewEquipment({...newEquipment, poids_kg: e.target.value})} className="w-full text-sm rounded-md bg-slate-900 border-slate-600"/>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-slate-400">Numéro de Série</label>
                                    <input type="text" value={newEquipment.numero_serie} onChange={(e) => setNewEquipment({...newEquipment, numero_serie: e.target.value})} className="w-full text-sm rounded-md bg-slate-900 border-slate-600"/>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={handleAddEquipment} className="px-3 py-1 text-xs bg-primary text-white rounded">Ajouter</button>
                                <button onClick={() => setIsAddingEquipment(false)} className="px-3 py-1 text-xs bg-slate-600 rounded">Annuler</button>
                            </div>
                        </div>
                    )}
                    <div className="max-h-[30vh] overflow-y-auto pr-2">
                        {equipments.sort((a,b) => toNum(b.u_position) - toNum(a.u_position)).map(eq => (
                            <div 
                                key={eq.id} 
                                className="bg-slate-900/50 p-3 rounded-md hover:bg-slate-700/50 transition-colors mb-2 flex justify-between items-center group"
                            >
                                <div 
                                    onClick={() => onSelectEquipment(eq.id)}
                                    className="flex items-center flex-grow cursor-pointer"
                                >
                                    <ServerIcon className="w-5 h-5 text-slate-400 mr-3" />
                                    <div>
                                        <p className="font-semibold text-slate-200">{eq.nom_equipement}</p>
                                        <p className="text-xs text-slate-400">{eq.type_equipement}</p>
                                    </div>
                                </div>

                                <div className="flex items-center">
                                    <div 
                                        className="text-right mr-3 cursor-pointer"
                                        onClick={() => onSelectEquipment(eq.id)}
                                    >
                                        <p className="text-sm font-mono text-slate-300">U{eq.u_position} - U{toNum(eq.u_position) + toNum(eq.hauteur_u) - 1}</p>
                                        <p className="text-xs text-slate-500">{eq.hauteur_u}U</p>
                                    </div>

                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => onSelectEquipment(eq.id)}
                                            className="p-2 rounded-full text-slate-400 hover:bg-primary/20 hover:text-primary transition-colors"
                                            title="Modifier l'équipement"
                                        >
                                            <EditIcon className="w-5 h-5" />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteEquipment(eq.id, eq.nom_equipement)}
                                            className="p-2 rounded-full text-slate-400 hover:bg-danger-red/20 hover:text-danger-red transition-colors"
                                            title="Supprimer l'équipement"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {equipments.length === 0 && !isAddingEquipment && (
                        <div className="text-center text-slate-500 py-8">Aucun équipement dans cette baie.</div>
                    )}
                </div>
            </div>
            <div className="space-y-4">
                <RackVisualizer rack={rack} equipments={equipments} onSelectEquipment={onSelectEquipment} allData={allData} />
            </div>
        </main>
      </div>
    </div>
  );
};