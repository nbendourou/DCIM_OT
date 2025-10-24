import React, { useState, useEffect } from 'react';
import type { AllData, OtherConsumer, DiagnosticInfo, Capacities } from '../types.ts';
import Header from './Header.tsx';
import { toNum } from '../utils/powerUtils.ts';

interface SettingsProps {
  allData: AllData;
  setAllData: React.Dispatch<React.SetStateAction<AllData | null>>;
  diagnosticInfo: DiagnosticInfo;
  capacities: Capacities;
  setCapacities: React.Dispatch<React.SetStateAction<Capacities>>;
}

const CapacityInput: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
}> = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
        <label className="text-sm text-slate-300">{label}</label>
        <div className="flex items-center">
            <input 
                type="text" 
                value={String(value).replace('.', ',')}
                onChange={e => onChange(toNum(e.target.value))}
                className="bg-slate-900 border border-slate-600 rounded-md w-24 p-1 text-center font-semibold"
            />
            <span className="ml-2 text-sm text-slate-400">kW</span>
        </div>
    </div>
);


const Settings: React.FC<SettingsProps> = ({ allData, setAllData, diagnosticInfo, capacities, setCapacities }) => {
  const [consumers, setConsumers] = useState<OtherConsumer[]>([]);
  
  useEffect(() => {
    if (allData?.autresConsommateurs && Array.isArray(allData.autresConsommateurs)) {
      setConsumers(JSON.parse(JSON.stringify(allData.autresConsommateurs)));
    } else {
      setConsumers([]);
    }
  }, [allData]);

  const handleConsumerChange = (index: number, field: keyof OtherConsumer, value: string) => {
    const newConsumers = [...consumers];
    if (field === 'chaine') {
      newConsumers[index] = { ...newConsumers[index], [field]: value as 'A' | 'B' | 'C' };
    } else {
      const numericValue = toNum(value);
      newConsumers[index] = { ...newConsumers[index], [field]: numericValue };
    }
    setConsumers(newConsumers);
    setAllData(prev => {
      if (!prev) return null;
      return { ...prev, autresConsommateurs: newConsumers };
    });
  };
  
  const handleCapacityChange = (key: keyof Capacities, value: number) => {
    setCapacities(prev => ({
        ...prev,
        [key]: value
    }));
  };

  return (
    <>
      <Header title="Paramètres Généraux & Diagnostic" />
      <div className="mt-6 space-y-8">
      
        {/* NEW: Capacity Management Panel */}
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
            <h3 className="text-lg font-bold text-slate-100 mb-2">Gestion des Capacités</h3>
            <p className="text-sm text-slate-400 mb-4">
                Définissez les capacités maximales en kW pour les différents composants de l'infrastructure.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                <div>
                    <h4 className="font-semibold text-primary mb-2">Onduleurs (UPS)</h4>
                    <CapacityInput label="Capacité Chaîne A" value={capacities.upsChainA_kW} onChange={v => handleCapacityChange('upsChainA_kW', v)} />
                    <CapacityInput label="Capacité Chaîne B" value={capacities.upsChainB_kW} onChange={v => handleCapacityChange('upsChainB_kW', v)} />
                    <CapacityInput label="Capacité Chaîne C" value={capacities.upsChainC_kW} onChange={v => handleCapacityChange('upsChainC_kW', v)} />
                </div>
                <div>
                    <h4 className="font-semibold text-primary mb-2">Salles ITN</h4>
                    <CapacityInput label="Capacité Salle ITN1" value={capacities.roomITN1_kW} onChange={v => handleCapacityChange('roomITN1_kW', v)} />
                    <CapacityInput label="Capacité Salle ITN2" value={capacities.roomITN2_kW} onChange={v => handleCapacityChange('roomITN2_kW', v)} />
                    <CapacityInput label="Capacité Salle ITN3" value={capacities.roomITN3_kW} onChange={v => handleCapacityChange('roomITN3_kW', v)} />
                </div>
                 <div>
                    <h4 className="font-semibold text-primary mb-2">Rangées</h4>
                    <CapacityInput label="Capacité par Rangée AC" value={capacities.rowAC_kW} onChange={v => handleCapacityChange('rowAC_kW', v)} />
                    <CapacityInput label="Capacité par Rangée DC" value={capacities.rowDC_kW} onChange={v => handleCapacityChange('rowDC_kW', v)} />
                </div>
            </div>
        </div>

        {/* Other Consumers Section */}
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
          <h3 className="text-lg font-bold text-slate-100 mb-2">Autres Consommateurs</h3>
          <p className="text-sm text-slate-400 mb-4">
            Modifiez ici les charges de base (non-IT) pour chaque chaîne de puissance.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-700">
                <tr>
                  <th scope="col" className="px-6 py-3">Chaîne</th>
                  <th scope="col" className="px-6 py-3">AC Phase 1 (kW)</th>
                  <th scope="col" className="px-6 py-3">AC Phase 2 (kW)</th>
                  <th scope="col" className="px-6 py-3">AC Phase 3 (kW)</th>
                  <th scope="col" className="px-6 py-3">DC (kW)</th>
                </tr>
              </thead>
              <tbody>
                {consumers.map((consumer, index) => (
                  <tr key={index} className="bg-slate-800 border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="px-6 py-4 font-bold text-white">
                      {consumer.chaine || 'N/A'}
                    </td>
                    <td className="px-6 py-4"><input type="text" value={String(consumer.acp1).replace('.', ',')} onChange={(e) => handleConsumerChange(index, 'acp1', e.target.value)} className="bg-slate-900 border border-slate-600 rounded-md w-24 p-1 text-center"/></td>
                    <td className="px-6 py-4"><input type="text" value={String(consumer.acp2).replace('.', ',')} onChange={(e) => handleConsumerChange(index, 'acp2', e.target.value)} className="bg-slate-900 border border-slate-600 rounded-md w-24 p-1 text-center"/></td>
                    <td className="px-6 py-4"><input type="text" value={String(consumer.acp3).replace('.', ',')} onChange={(e) => handleConsumerChange(index, 'acp3', e.target.value)} className="bg-slate-900 border border-slate-600 rounded-md w-24 p-1 text-center"/></td>
                    <td className="px-6 py-4"><input type="text" value={String(consumer.dc).replace('.', ',')} onChange={(e) => handleConsumerChange(index, 'dc', e.target.value)} className="bg-slate-900 border border-slate-600 rounded-md w-24 p-1 text-center"/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Diagnostic Section */}
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
          <h3 className="text-lg font-bold text-slate-100 mb-2">Diagnostic de Connexion Google Sheets</h3>
          <p className="text-sm text-slate-400 mb-4">
            Ce panneau vous montre l'état de la connexion avec votre fichier Google Sheets. Si une feuille de données est "Manquante", vérifiez que le nom de l'onglet dans votre fichier correspond à l'un des alias attendus.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-700">
                <tr>
                  <th scope="col" className="px-6 py-3">Donnée Attendue</th>
                  <th scope="col" className="px-6 py-3">Statut</th>
                  <th scope="col" className="px-6 py-3">Nom Trouvé dans le Fichier</th>
                  <th scope="col" className="px-6 py-3">Lignes Lues</th>
                </tr>
              </thead>
              <tbody>
                {diagnosticInfo.keyMapping.map((info) => (
                  <tr key={info.canonicalKey} className="bg-slate-800 border-b border-slate-700">
                    <td className="px-6 py-4 font-medium text-white">{info.canonicalKey}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        info.status === 'Trouvé' ? 'bg-ok-green/20 text-ok-green' : 'bg-danger-red/20 text-danger-red'
                      }`}>
                        {info.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">{info.rawKeyFound || 'N/A'}</td>
                    <td className="px-6 py-4">{info.rowCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;
