import React, { useState, useEffect, useMemo, useCallback } from 'react';
// FIX: Added ACConnection to import list
import type { Equipment, Rack, AllData, DCConnection, ACConnection, DCPanel, DCPanelUtilization, ACBoxUtilization } from '../types.ts';
// FIX: Added .tsx extension to fix module resolution.
import { CloseIcon, EditIcon, TrashIcon, PlusIcon } from './icons.tsx';
// FIX: Added .ts extension to fix module resolution.
import { toNum, getOutletsForACBox, parseOutletString } from '../utils/powerUtils.ts';

const EQUIPMENT_TYPES = ['Serveur', 'Switch', 'Stockage', 'Routeur', 'Firewall', 'PDU', 'Passe câble', 'Patch Panel Cuivre', 'Patch Panel Fibre', 'Autre'];
const EQUIPMENT_STATUSES = ['Actif', 'En maintenance', 'Planifié', 'Hors service'];


interface EquipmentDetailModalProps {
  equipment: Equipment;
  rack: Rack | null;
  allData: AllData;
  setAllData: React.Dispatch<React.SetStateAction<AllData | null>>;
  dcPanelUtilizations: { [key: string]: DCPanelUtilization };
  acBoxUtilizations: { [key: string]: any };
  onClose: () => void;
}

const InfoField: React.FC<{ label: string; value: string | number | undefined; isEditable?: boolean; onChange?: (val: string) => void; inputType?: string; options?: {value: string, label: string}[] }> = ({ label, value, isEditable, onChange, inputType = 'text', options }) => (
    <div>
        <label className="text-xs text-slate-400">{label}</label>
        {isEditable ? (
            options ? (
                 <select
                    value={value || ''}
                    onChange={(e) => onChange && onChange(e.target.value)}
                    className="w-full text-sm rounded bg-slate-900 border-slate-600 p-1 mt-1"
                >
                    {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            ) : (
                <input
                    type={inputType}
                    value={String(value || '').replace('.', ',')}
                    onChange={(e) => onChange && onChange(e.target.value)}
                    className="w-full text-sm rounded bg-slate-900 border-slate-600 p-1 mt-1"
                />
            )
        ) : (
            <p className="text-md font-semibold text-slate-100">{value || 'N/A'}</p>
        )}
    </div>
);

const ConnectionDiagnostics: React.FC<{equipment: Equipment, allData: AllData, onClose: () => void}> = ({ equipment, allData, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-white mb-2">Diagnostic des Connexions</h3>
                <p className="text-sm text-slate-400 mb-4">Analyse de la correspondance pour l'équipement ID: <span className="font-mono bg-slate-700 px-1 rounded">{equipment.id}</span></p>
                
                <div className="overflow-y-auto space-y-4 pr-2">
                    {['AC', 'DC'].map(type => {
                        const connections = type === 'AC' ? allData.connexionsAC : allData.connexionsDC;
                        return (
                             <div key={type}>
                                <h4 className="font-semibold text-slate-200 sticky top-0 bg-slate-900 py-1">Connexions {type} ({connections.length} total)</h4>
                                <table className="w-full text-xs text-left">
                                    <thead className="text-slate-400">
                                        <tr>
                                            <th className="p-2">ID Connexion</th>
                                            <th className="p-2">Clé Étrangère (FK)</th>
                                            <th className="p-2">Correspondance ?</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {connections.map(conn => {
                                            const matches = conn.equipment_fk === equipment.id;
                                            return (
                                                <tr key={conn.id} className={`border-t border-slate-800 ${matches ? 'text-ok-green' : 'text-slate-500'}`}>
                                                    <td className="p-2 font-mono">{conn.id}</td>
                                                    <td className="p-2 font-mono">"{conn.equipment_fk}"</td>
                                                    <td className="p-2 font-bold">{matches ? '✅ OUI' : '❌ NON'}</td>
                                                </tr>
                                            );
                                        })}
                                        {connections.length === 0 && (
                                            <tr><td colSpan={3} className="p-4 text-center text-slate-500">Aucune connexion {type} trouvée dans les données brutes.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )
                    })}
                </div>
                 <button onClick={onClose} className="mt-4 ml-auto px-4 py-2 text-sm bg-primary text-white rounded-md">Fermer</button>
            </div>
        </div>
    );
}

const DcConnectionForm: React.FC<{
    voie: '1' | '2';
    equipment: Equipment;
    rack: Rack | null;
    allData: AllData;
    onSave: (conn: DCConnection) => void;
    onCancel: () => void;
    initialConnection?: DCConnection;
}> = ({ voie, equipment, rack, allData, onSave, onCancel, initialConnection }) => {
    const isEditMode = !!initialConnection;
    const [selectedPanelId, setSelectedPanelId] = useState(initialConnection?.dc_panel_fk || '');
    const [breakerNumber, setBreakerNumber] = useState(initialConnection ? String(initialConnection.breaker_number) : '');
    const [breakerRating, setBreakerRating] = useState(initialConnection ? String(initialConnection.breaker_rating_a) : '');
    const [powerKW, setPowerKW] = useState(initialConnection ? String(initialConnection.puissance_kw) : '0');

    const roomChainMapping = { 'ITN1': { voie1: 'A', voie2: 'B' }, 'ITN2': { voie1: 'A', voie2: 'C' }, 'ITN3': { voie1: 'B', voie2: 'C' } };

    const filteredPanels = useMemo(() => {
        if (!rack?.salle) return [];
        
        const mapping = roomChainMapping[rack.salle as keyof typeof roomChainMapping] || { voie1: 'A', voie2: 'B' };

        const salleNumMatch = rack.salle.trim().match(/\d+/);
        if (!salleNumMatch) return [];
        const salleNum = salleNumMatch[0];

        const voieChar = voie === '1' ? mapping.voie1 : mapping.voie2;
        const prefix = `IT.${salleNum}-SWB.REC.${voieChar}.`;
        
        return allData.tableauxDC.filter(p => p.id && p.id.startsWith(prefix));
    }, [rack, allData.tableauxDC, voie]);
    
    const breakerOptions = useMemo(() => {
        const fixedRatings = [25, 32, 40, 63, 80, 100, 125];
        const totalCounts = new Map<number, number>([
            [25, 4], [32, 5], [40, 4], [63, 35],
            [80, 10], [100, 10], [125, 2],
        ]);

        const usedCounts = new Map<number, number>();
        allData.connexionsDC
            .filter(c => c.dc_panel_fk === selectedPanelId)
            .forEach(c => {
                const rating = toNum(c.breaker_rating_a);
                // In edit mode, don't count the current connection's usage against itself.
                const quantity = (isEditMode && initialConnection?.id === c.id) ? 0 : toNum(c.breaker_number);
                usedCounts.set(rating, (usedCounts.get(rating) || 0) + quantity);
            });

        return fixedRatings.map(rating => {
            const total = totalCounts.get(rating) || 0;
            const used = usedCounts.get(rating) || 0;
            const available = total - used;
            
            return {
                value: String(rating),
                label: `${rating}A (${available})`,
                available: available
            };
        });
    }, [selectedPanelId, allData.connexionsDC, isEditMode, initialConnection]);


    const handleSaveClick = () => {
        if (!selectedPanelId || !breakerNumber || !breakerRating) {
            alert('Veuillez remplir tous les champs de la connexion.');
            return;
        }
        
        onSave({
            id: initialConnection?.id || `DCC-${Date.now()}`,
            equipment_fk: equipment.id,
            dc_panel_fk: selectedPanelId,
            breaker_number: toNum(breakerNumber),
            breaker_rating_a: toNum(breakerRating),
            voie,
            puissance_kw: toNum(powerKW)
        });
    };

    return (
      <div className="bg-slate-700/50 p-3 rounded-lg mt-2 space-y-3 border border-slate-600">
        <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-slate-200">{isEditMode ? 'Modifier' : 'Ajouter'} Connexion DC</p>
        </div>
        
        <select value={selectedPanelId} onChange={e => setSelectedPanelId(e.target.value)} className="w-full text-sm rounded-md bg-slate-900 border-slate-600">
            <option value="">-- Choisir Tableau DC --</option>
            {filteredPanels.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
            <div>
                 <label className="text-xs text-slate-400">Nombre de disjoncteurs</label>
                 <input type="number" placeholder="Quantité" value={breakerNumber} onChange={e => setBreakerNumber(e.target.value)} className="w-full text-sm rounded-md bg-slate-900 border-slate-600" />
            </div>
            <div className="relative">
                <label className="text-xs text-slate-400">Calibre (A)</label>
                 <select 
                    value={breakerRating} 
                    onChange={e => setBreakerRating(e.target.value)} 
                    className="w-full text-sm rounded-md bg-slate-900 border-slate-600" 
                    disabled={!selectedPanelId}
                >
                    <option value="">-- Calibre --</option>
                    {breakerOptions.map(opt => (
                        <option key={opt.value} value={opt.value} disabled={opt.available < toNum(breakerNumber) && String(opt.value) !== initialConnection?.breaker_rating_a}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
        <input type="text" placeholder="Puissance (kW)" value={powerKW} onChange={e => setPowerKW(e.target.value)} className="w-full text-sm rounded-md bg-slate-900 border-slate-600" />
        <div className="flex justify-end gap-2">
            <button onClick={handleSaveClick} className="px-3 py-1 text-xs bg-primary text-white rounded">{isEditMode ? 'Enregistrer' : 'Ajouter'}</button>
            <button onClick={onCancel} className="px-3 py-1 text-xs bg-slate-600 rounded">Annuler</button>
        </div>
      </div>
    );
};


const AcConnectionForm: React.FC<{
    voie: '1' | '2';
    equipment: Equipment;
    rack: Rack | null;
    allData: AllData;
    onSave: (conn: ACConnection) => void;
    onCancel: () => void;
    initialConnection?: ACConnection;
}> = ({ voie, equipment, rack, allData, onSave, onCancel, initialConnection }) => {
    const isEditMode = !!initialConnection;
    const [selectedBoxId, setSelectedBoxId] = useState(initialConnection?.ac_box_fk || '');
    const [powerKW, setPowerKW] = useState(initialConnection ? String(initialConnection.puissance_kw) : '0');

    // State for the full outlet string, e.g., "MONO 1 (P1)"
    const [selectedFullOutlet, setSelectedFullOutlet] = useState('');
    // State for the selected phase, which can be derived or manually set
    const [selectedPhase, setSelectedPhase] = useState<'P1' | 'P2' | 'P3' | 'P123'>(initialConnection?.phase || 'P1');

    const filteredBoxes = useMemo(() => {
        if (!rack || !rack.salle || !rack.rangee) return [];
        const roomNumMatch = rack.salle.trim().match(/\d+/);
        if (!roomNumMatch) return [];
        const roomNum = roomNumMatch[0];
        const roomChainMapping = { 'ITN1': { voie1: 'A', voie2: 'B' }, 'ITN2': { voie1: 'A', voie2: 'C' }, 'ITN3': { voie1: 'B', voie2: 'C' } };
        const mapping = roomChainMapping[rack.salle as keyof typeof roomChainMapping] || { voie1: 'A', voie2: 'B' };
        const voieChar = voie === '1' ? mapping.voie1 : mapping.voie2;
        const prefix = `IT.${roomNum}-TB.${voieChar}.`;

        return allData.boitiersAC.filter(box => box.rangee === rack.rangee && box.id?.startsWith(prefix));
    }, [rack, allData.boitiersAC, voie]);

    const availableOutlets = useMemo(() => {
        const selectedBox = allData.boitiersAC.find(box => box.id === selectedBoxId);
        if (!selectedBox) return [];
        return getOutletsForACBox(selectedBox.configuration);
    }, [selectedBoxId, allData.boitiersAC]);
    
    // This effect initializes/resets the form when the connection or available outlets change
    useEffect(() => {
        if (isEditMode && initialConnection && availableOutlets.length > 0) {
            const { outlet_name, phase } = initialConnection;
            // Attempt to reconstruct the full name, e.g., "MONO 1" + "P1" -> "MONO 1 (P1)"
            const reconstructed = `${outlet_name} (${phase})`;
            if (phase && phase !== 'P123' && availableOutlets.includes(reconstructed)) {
                setSelectedFullOutlet(reconstructed);
            } else if (availableOutlets.includes(outlet_name)) {
                // If reconstruction fails, just use the name (old format)
                setSelectedFullOutlet(outlet_name);
            } else {
                setSelectedFullOutlet('');
            }
            setSelectedPhase(phase || 'P1');
        } else if (!isEditMode) {
             setSelectedFullOutlet('');
             setSelectedPhase('P1');
        }
    }, [initialConnection, isEditMode, availableOutlets]);
    
    const { name: derivedOutletName, phase: derivedPhase, isLocked: isPhaseLocked } = useMemo(() => parseOutletString(selectedFullOutlet), [selectedFullOutlet]);

    const phaseOptions = useMemo(() => {
        const isTriOutlet = derivedOutletName.toUpperCase().includes('TRI');
        if (isTriOutlet) {
            return ['P1', 'P2', 'P3', 'P123'];
        }
        return ['P1', 'P2', 'P3'];
    }, [derivedOutletName]);


    // This effect handles phase changes when the selected outlet changes.
    useEffect(() => {
        if (derivedPhase && isPhaseLocked) {
            // Handles descriptive mono outlets like "MONO 1 (P1)" -> sets phase to P1 and locks.
            setSelectedPhase(derivedPhase);
            return;
        }
        
        // For outlets where phase is user-selectable (TRI or old format MONO).
        if (!isEditMode) {
            // If creating a NEW connection, set a smart default when outlet is chosen.
            if (selectedFullOutlet) {
                const isTri = derivedOutletName.toUpperCase().includes('TRI');
                setSelectedPhase(isTri ? 'P123' : 'P1');
            }
        } else {
            // If EDITING, and the user *changes* the outlet to a MONO type, ensure P123 is not selected.
            const isTri = derivedOutletName.toUpperCase().includes('TRI');
            if (!isTri && selectedPhase === 'P123') {
                setSelectedPhase('P1');
            }
        }
    }, [selectedFullOutlet, derivedOutletName, derivedPhase, isPhaseLocked, isEditMode]);
    
    const handleSaveClick = () => {
        if (!selectedBoxId || !derivedOutletName || !selectedPhase) {
            alert('Veuillez remplir tous les champs de la connexion AC.');
            return;
        }
        
        onSave({
            id: initialConnection?.id || `ACC-${Date.now()}`,
            equipment_fk: equipment.id,
            ac_box_fk: selectedBoxId,
            outlet_name: derivedOutletName, // Save the parsed name
            phase: selectedPhase, // Save the final phase
            voie,
            puissance_kw: toNum(powerKW)
        });
    };

    return (
      <div className="bg-slate-700/50 p-3 rounded-lg mt-2 space-y-3 border border-slate-600">
        <p className="text-sm font-semibold text-slate-200">{isEditMode ? 'Modifier' : 'Ajouter'} Connexion AC</p>
        <select value={selectedBoxId} onChange={e => { setSelectedBoxId(e.target.value); setSelectedFullOutlet(''); }} className="w-full text-sm rounded-md bg-slate-900 border-slate-600">
            <option value="">-- Choisir Boîtier AC --</option>
            {filteredBoxes.map(b => <option key={b.id} value={b.id}>{b.id} ({b.configuration})</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
            <select value={selectedFullOutlet} onChange={e => setSelectedFullOutlet(e.target.value)} className="w-full text-sm rounded-md bg-slate-900 border-slate-600" disabled={!selectedBoxId}>
                <option value="">-- Choisir Prise --</option>
                {availableOutlets.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select value={selectedPhase} onChange={e => setSelectedPhase(e.target.value as any)} disabled={isPhaseLocked} className="w-full text-sm rounded-md bg-slate-900 border-slate-600 disabled:bg-slate-800/50 disabled:text-slate-400">
                {phaseOptions.map(p => <option key={p} value={p}>Phase {p.replace('P', '')}</option>)}
            </select>
        </div>
        <input type="text" placeholder="Puissance (kW)" value={powerKW} onChange={e => setPowerKW(e.target.value)} className="w-full text-sm rounded-md bg-slate-900 border-slate-600" />
        <div className="flex justify-end gap-2">
            <button onClick={handleSaveClick} className="px-3 py-1 text-xs bg-primary text-white rounded">{isEditMode ? 'Enregistrer' : 'Ajouter'}</button>
            <button onClick={onCancel} className="px-3 py-1 text-xs bg-slate-600 rounded">Annuler</button>
        </div>
      </div>
    );
};


export const EquipmentDetailModal: React.FC<EquipmentDetailModalProps> = ({ equipment, rack, allData, setAllData, onClose }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableEquipment, setEditableEquipment] = useState<Equipment>(equipment);
  const [formVisibleForVoie, setFormVisibleForVoie] = useState<'1' | '2' | null>(null);
  const [formVisibleForVoieAC, setFormVisibleForVoieAC] = useState<'1' | '2' | null>(null);
  const [editingDcConnection, setEditingDcConnection] = useState<DCConnection | null>(null);
  const [editingAcConnection, setEditingAcConnection] = useState<ACConnection | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const dcConnections = useMemo(() => allData.connexionsDC.filter(c => c.equipment_fk === equipment.id), [allData.connexionsDC, equipment.id]);
  const acConnections = useMemo(() => allData.connexionsAC.filter(c => c.equipment_fk === equipment.id), [allData.connexionsAC, equipment.id]);

  useEffect(() => {
    setEditableEquipment(equipment);
  }, [equipment]);
  
  const updateDataAndPower = useCallback((updater: (currentData: AllData) => AllData) => {
    setAllData(prevData => {
        if (!prevData) return null;
        let updatedData = updater(prevData);
        if (rack) {
            const equipmentInRack = updatedData.equipements.filter(eq => eq.rack_fk === rack.id);
            const equipmentIds = equipmentInRack.map(eq => eq.id);
            let totalV1_DC = 0, totalV2_DC = 0;
            updatedData.connexionsDC.filter(conn => equipmentIds.includes(conn.equipment_fk)).forEach(conn => {
                if (conn.voie === '1') totalV1_DC += toNum(conn.puissance_kw);
                if (conn.voie === '2') totalV2_DC += toNum(conn.puissance_kw);
            });
            let totalsAC = { v1p1: 0, v1p2: 0, v1p3: 0, v2p1: 0, v2p2: 0, v2p3: 0 };
            updatedData.connexionsAC.filter(conn => equipmentIds.includes(conn.equipment_fk)).forEach(conn => {
                const power = toNum(conn.puissance_kw);
                const p = conn.phase === 'P123' ? power / 3 : power;
                if (conn.voie === '1') {
                    if (conn.phase === 'P1' || conn.phase === 'P123') totalsAC.v1p1 += p;
                    if (conn.phase === 'P2' || conn.phase === 'P123') totalsAC.v1p2 += p;
                    if (conn.phase === 'P3' || conn.phase === 'P123') totalsAC.v1p3 += p;
                } else if (conn.voie === '2') {
                    if (conn.phase === 'P1' || conn.phase === 'P123') totalsAC.v2p1 += p;
                    if (conn.phase === 'P2' || conn.phase === 'P123') totalsAC.v2p2 += p;
                    if (conn.phase === 'P3' || conn.phase === 'P123') totalsAC.v2p3 += p;
                }
            });
            updatedData = {
                ...updatedData,
                racks: updatedData.racks.map(r => r.id === rack.id ? { ...r, conso_baie_v1_dc_kw: totalV1_DC, conso_baie_v2_dc_kw: totalV2_DC, conso_baie_v1_ph1_kw: totalsAC.v1p1, conso_baie_v1_ph2_kw: totalsAC.v1p2, conso_baie_v1_ph3_kw: totalsAC.v1p3, conso_baie_v2_ph1_kw: totalsAC.v2p1, conso_baie_v2_ph2_kw: totalsAC.v2p2, conso_baie_v2_ph3_kw: totalsAC.v2p3 } : r)
            };
        }
        return updatedData;
    });
  }, [setAllData, rack]);

  const handleSaveDcConnection = (conn: DCConnection) => {
    updateDataAndPower(currentData => {
        const existing = currentData.connexionsDC.find(c => c.id === conn.id);
        const connexionsDC = existing 
            ? currentData.connexionsDC.map(c => c.id === conn.id ? conn : c)
            : [...currentData.connexionsDC, conn];
        return { ...currentData, connexionsDC };
    });
    setFormVisibleForVoie(null);
    setEditingDcConnection(null);
  };
  
  const handleDeleteDcConnection = (connId: string) => {
    updateDataAndPower(currentData => ({ ...currentData, connexionsDC: currentData.connexionsDC.filter(c => c.id !== connId) }));
  };

  const handleSaveAcConnection = (conn: ACConnection) => {
    updateDataAndPower(currentData => {
        const existing = currentData.connexionsAC.find(c => c.id === conn.id);
        const connexionsAC = existing 
            ? currentData.connexionsAC.map(c => c.id === conn.id ? conn : c)
            : [...currentData.connexionsAC, conn];
        return { ...currentData, connexionsAC };
    });
    setFormVisibleForVoieAC(null);
    setEditingAcConnection(null);
  };
  
  const handleDeleteAcConnection = (connId: string) => {
    updateDataAndPower(currentData => ({ ...currentData, connexionsAC: currentData.connexionsAC.filter(c => c.id !== connId) }));
  };

  const saveChanges = () => {
    updateDataAndPower(currentData => ({ ...currentData, equipements: currentData.equipements.map(eq => eq.id === editableEquipment.id ? editableEquipment : eq) }));
    setIsEditing(false);
  };

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50" onClick={onClose}>
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[90vh] bg-slate-800 border border-slate-700 shadow-2xl flex flex-col rounded-lg"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-700 flex justify-between items-center cursor-move">
          <div>
            <h2 className="text-xl font-bold text-slate-100">{equipment.nom_equipement}</h2>
            <p className="text-sm text-slate-400">Dans Baie {rack?.designation || 'N/A'}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setIsEditing(prev => !prev)} className="p-2 rounded-full hover:bg-slate-700">
                <EditIcon className={`w-5 h-5 ${isEditing ? 'text-sky-400' : 'text-primary'}`}/>
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700">
              <CloseIcon className="w-6 h-6 text-slate-400" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-slate-900/50 p-4 rounded-lg">
                <h3 className="text-md font-semibold text-slate-200 mb-3">Détails de l'Équipement</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoField label="Nom" value={editableEquipment.nom_equipement} isEditable={isEditing} onChange={v => setEditableEquipment({...editableEquipment, nom_equipement: v})} />
                    <InfoField label="Type" value={editableEquipment.type_equipement} isEditable={isEditing} onChange={v => setEditableEquipment({...editableEquipment, type_equipement: v})} options={EQUIPMENT_TYPES.map(o => ({value: o, label: o}))} />
                    <InfoField label="Statut" value={editableEquipment.statut} isEditable={isEditing} onChange={v => setEditableEquipment({...editableEquipment, statut: v})} options={EQUIPMENT_STATUSES.map(o => ({value: o, label: o}))} />
                    <InfoField label="Alimentation" value={editableEquipment.type_alimentation} isEditable={isEditing} onChange={v => setEditableEquipment({...editableEquipment, type_alimentation: v as any})} options={[{value: 'AC', label: 'AC'}, {value: 'DC', label: 'DC'}, {value: 'AC/DC', label: 'AC/DC'}]} />
                    <InfoField label="Position U" value={editableEquipment.u_position} isEditable={isEditing} onChange={v => setEditableEquipment({...editableEquipment, u_position: toNum(v)})} />
                    <InfoField label="Hauteur (U)" value={editableEquipment.hauteur_u} isEditable={isEditing} onChange={v => setEditableEquipment({...editableEquipment, hauteur_u: toNum(v)})} />
                    <InfoField label="Poids (kg)" value={editableEquipment.poids_kg} isEditable={isEditing} onChange={v => setEditableEquipment({...editableEquipment, poids_kg: toNum(v)})} />
                    <InfoField label="Numéro de Série" value={editableEquipment.numero_serie} isEditable={isEditing} onChange={v => setEditableEquipment({...editableEquipment, numero_serie: v})} />
                </div>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-md font-semibold text-slate-200">Connectivité Électrique</h3>
                    <button onClick={() => setShowDiagnostics(true)} className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded-md">Diagnostiquer</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {/* --- VOIE 1 --- */}
                    <div>
                        <h4 className="font-semibold text-slate-300 mb-2 border-b border-slate-700 pb-1">Voie 1 (Chaîne A)</h4>
                         {equipment.type_alimentation.includes('AC') && (
                            <div className="mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-sm font-medium text-slate-400">Connexions AC</p>
                                    {formVisibleForVoieAC !== '1' && !editingAcConnection && <button onClick={() => setFormVisibleForVoieAC('1')} className="text-sm text-primary hover:text-primary-hover flex items-center"><PlusIcon className="w-4 h-4 mr-1"/> Ajouter AC</button>}
                                </div>
                                {acConnections.filter(c => c.voie === '1').map(conn => editingAcConnection?.id === conn.id ? <AcConnectionForm key={conn.id} voie="1" equipment={equipment} rack={rack} allData={allData} onSave={handleSaveAcConnection} onCancel={() => setEditingAcConnection(null)} initialConnection={conn} /> : (
                                    <div key={conn.id} className="text-xs bg-slate-800/60 p-2 rounded mb-2">
                                        <p className="font-bold">{conn.ac_box_fk} / {conn.outlet_name}</p>
                                        <div className="flex justify-between items-center">
                                            <span>Phase: {conn.phase} | {toNum(conn.puissance_kw).toFixed(2)} kW</span>
                                            <div className="flex space-x-2">
                                                <button onClick={() => setEditingAcConnection(conn)}><EditIcon className="w-3 h-3 text-slate-400 hover:text-primary"/></button>
                                                <button onClick={() => handleDeleteAcConnection(conn.id)}><TrashIcon className="w-3 h-3 text-slate-400 hover:text-danger-red"/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {acConnections.filter(c => c.voie === '1').length === 0 && formVisibleForVoieAC !== '1' && <p className="text-xs text-slate-500 italic">Aucune connexion AC.</p>}
                                {formVisibleForVoieAC === '1' && <AcConnectionForm voie="1" equipment={equipment} rack={rack} allData={allData} onSave={handleSaveAcConnection} onCancel={() => setFormVisibleForVoieAC(null)} />}
                            </div>
                        )}
                        {equipment.type_alimentation.includes('DC') && (
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                   <p className="text-sm font-medium text-slate-400">Connexions DC</p>
                                   {formVisibleForVoie !== '1' && !editingDcConnection && <button onClick={() => setFormVisibleForVoie('1')} className="text-sm text-primary hover:text-primary-hover flex items-center"><PlusIcon className="w-4 h-4 mr-1"/> Ajouter DC</button>}
                                </div>
                                {dcConnections.filter(c => c.voie === '1').map(conn => editingDcConnection?.id === conn.id ? <DcConnectionForm key={conn.id} voie="1" equipment={equipment} rack={rack} allData={allData} onSave={handleSaveDcConnection} onCancel={() => setEditingDcConnection(null)} initialConnection={conn} /> : (
                                    <div key={conn.id} className="text-xs bg-slate-800/60 p-2 rounded mb-2">
                                        <p className="font-bold">{conn.dc_panel_fk}</p>
                                        <div className="flex justify-between items-center">
                                            <span>{conn.breaker_number}x {conn.breaker_rating_a}A | {toNum(conn.puissance_kw).toFixed(2)} kW</span>
                                            <div className="flex space-x-2">
                                                <button onClick={() => setEditingDcConnection(conn)}><EditIcon className="w-3 h-3 text-slate-400 hover:text-primary"/></button>
                                                <button onClick={() => handleDeleteDcConnection(conn.id)}><TrashIcon className="w-3 h-3 text-slate-400 hover:text-danger-red"/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {dcConnections.filter(c => c.voie === '1').length === 0 && formVisibleForVoie !== '1' && <p className="text-xs text-slate-500 italic">Aucune connexion DC.</p>}
                                {formVisibleForVoie === '1' && <DcConnectionForm voie="1" equipment={equipment} rack={rack} allData={allData} onSave={handleSaveDcConnection} onCancel={() => setFormVisibleForVoie(null)} />}
                            </div>
                        )}
                    </div>
                    {/* --- VOIE 2 --- */}
                     <div>
                        <h4 className="font-semibold text-slate-300 mb-2 border-b border-slate-700 pb-1">Voie 2 (Chaîne B/C)</h4>
                        {equipment.type_alimentation.includes('AC') && (
                            <div className="mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-sm font-medium text-slate-400">Connexions AC</p>
                                    {formVisibleForVoieAC !== '2' && !editingAcConnection && <button onClick={() => setFormVisibleForVoieAC('2')} className="text-sm text-primary hover:text-primary-hover flex items-center"><PlusIcon className="w-4 h-4 mr-1"/> Ajouter AC</button>}
                                </div>
                                {acConnections.filter(c => c.voie === '2').map(conn => editingAcConnection?.id === conn.id ? <AcConnectionForm key={conn.id} voie="2" equipment={equipment} rack={rack} allData={allData} onSave={handleSaveAcConnection} onCancel={() => setEditingAcConnection(null)} initialConnection={conn} /> : (
                                    <div key={conn.id} className="text-xs bg-slate-800/60 p-2 rounded mb-2">
                                        <p className="font-bold">{conn.ac_box_fk} / {conn.outlet_name}</p>
                                        <div className="flex justify-between items-center">
                                            <span>Phase: {conn.phase} | {toNum(conn.puissance_kw).toFixed(2)} kW</span>
                                            <div className="flex space-x-2">
                                                <button onClick={() => setEditingAcConnection(conn)}><EditIcon className="w-3 h-3 text-slate-400 hover:text-primary"/></button>
                                                <button onClick={() => handleDeleteAcConnection(conn.id)}><TrashIcon className="w-3 h-3 text-slate-400 hover:text-danger-red"/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {acConnections.filter(c => c.voie === '2').length === 0 && formVisibleForVoieAC !== '2' && <p className="text-xs text-slate-500 italic">Aucune connexion AC.</p>}
                                {formVisibleForVoieAC === '2' && <AcConnectionForm voie="2" equipment={equipment} rack={rack} allData={allData} onSave={handleSaveAcConnection} onCancel={() => setFormVisibleForVoieAC(null)} />}
                            </div>
                        )}
                        {equipment.type_alimentation.includes('DC') && (
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                   <p className="text-sm font-medium text-slate-400">Connexions DC</p>
                                   {formVisibleForVoie !== '2' && !editingDcConnection && <button onClick={() => setFormVisibleForVoie('2')} className="text-sm text-primary hover:text-primary-hover flex items-center"><PlusIcon className="w-4 h-4 mr-1"/> Ajouter DC</button>}
                                </div>
                                 {dcConnections.filter(c => c.voie === '2').map(conn => editingDcConnection?.id === conn.id ? <DcConnectionForm key={conn.id} voie="2" equipment={equipment} rack={rack} allData={allData} onSave={handleSaveDcConnection} onCancel={() => setEditingDcConnection(null)} initialConnection={conn} /> : (
                                     <div key={conn.id} className="text-xs bg-slate-800/60 p-2 rounded mb-2">
                                        <p className="font-bold">{conn.dc_panel_fk}</p>
                                        <div className="flex justify-between items-center">
                                            <span>{conn.breaker_number}x {conn.breaker_rating_a}A | {toNum(conn.puissance_kw).toFixed(2)} kW</span>
                                            <div className="flex space-x-2">
                                                <button onClick={() => setEditingDcConnection(conn)}><EditIcon className="w-3 h-3 text-slate-400 hover:text-primary"/></button>
                                                <button onClick={() => handleDeleteDcConnection(conn.id)}><TrashIcon className="w-3 h-3 text-slate-400 hover:text-danger-red"/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {dcConnections.filter(c => c.voie === '2').length === 0 && formVisibleForVoie !== '2' && <p className="text-xs text-slate-500 italic">Aucune connexion DC.</p>}
                                {formVisibleForVoie === '2' && <DcConnectionForm voie="2" equipment={equipment} rack={rack} allData={allData} onSave={handleSaveDcConnection} onCancel={() => setFormVisibleForVoie(null)} />}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
        
        {isEditing && (
            <footer className="p-4 border-t border-slate-700 flex justify-end gap-3 bg-slate-800/50 rounded-b-lg">
                <button onClick={() => { setIsEditing(false); setEditableEquipment(equipment); }} className="px-4 py-2 text-sm bg-slate-600 rounded-md">Annuler</button>
                <button onClick={saveChanges} className="px-4 py-2 text-sm bg-ok-green text-white rounded-md">Enregistrer Détails</button>
            </footer>
        )}
      </div>
    </div>
    {showDiagnostics && <ConnectionDiagnostics equipment={equipment} allData={allData} onClose={() => setShowDiagnostics(false)} />}
    </>
  );
};