import React, { useState, useEffect } from 'react';
import type { AllData, OtherConsumer, DiagnosticInfo, Capacities, User } from '../types.ts';
import Header from './Header.tsx';
import { toNum } from '../utils/powerUtils.ts';
import { TrashIcon } from './icons.tsx';

interface SettingsProps {
  allData: AllData;
  setAllData: React.Dispatch<React.SetStateAction<AllData | null>>;
  diagnosticInfo: DiagnosticInfo;
  capacities: Capacities;
  setCapacities: React.Dispatch<React.SetStateAction<Capacities>>;
  currentUser: User;
  changePassword: (username: string, oldPass: string, newPass: string) => Promise<{success: boolean, message: string}>;
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

const ChangePasswordPanel: React.FC<{
    currentUser: User,
    changePassword: (username: string, oldPass: string, newPass: string) => Promise<{success: boolean, message: string}>
}> = ({ currentUser, changePassword }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: "Les nouveaux mots de passe ne correspondent pas." });
            return;
        }
        if (!oldPassword || !newPassword) {
            setMessage({ type: 'error', text: "Veuillez remplir tous les champs." });
            return;
        }

        try {
            const result = await changePassword(currentUser.username, oldPassword, newPassword);
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
            <h3 className="text-lg font-bold text-slate-100 mb-2">Changer mon mot de passe</h3>
            <form onSubmit={handleSubmit} className="max-w-md mt-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300">Mot de passe actuel</label>
                    <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="mt-1 block w-full bg-slate-900 border border-slate-600 rounded-md p-2" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300">Nouveau mot de passe</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1 block w-full bg-slate-900 border border-slate-600 rounded-md p-2" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300">Confirmer le nouveau mot de passe</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 block w-full bg-slate-900 border border-slate-600 rounded-md p-2" required />
                </div>
                {message && (
                    <div className={`p-2 rounded text-sm ${message.type === 'success' ? 'bg-ok-green/20 text-ok-green' : 'bg-danger-red/20 text-danger-red'}`}>
                        {message.text}
                    </div>
                )}
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover">
                    Mettre à jour
                </button>
            </form>
        </div>
    );
}

const Settings: React.FC<SettingsProps> = ({ allData, setAllData, diagnosticInfo, capacities, setCapacities, currentUser, changePassword }) => {
    const [consumers, setConsumers] = useState<OtherConsumer[]>([]);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' as 'user' | 'admin' });
  
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
    
    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUser.username || !newUser.password) {
            alert("Le nom d'utilisateur et le mot de passe sont requis.");
            return;
        }
        if (allData.utilisateurs.some(u => u.username === newUser.username)) {
            alert("Ce nom d'utilisateur existe déjà.");
            return;
        }
        const newUserObject: User = {
            id: `U${Date.now()}`,
            ...newUser,
        };
        setAllData(prev => {
            if (!prev) return null;
            return {
                ...prev,
                utilisateurs: [...prev.utilisateurs, newUserObject],
            };
        });
        setNewUser({ username: '', password: '', role: 'user' });
    };

    const handleDeleteUser = (username: string) => {
        if (username === currentUser.username) {
            alert("Vous ne pouvez pas supprimer votre propre compte.");
            return;
        }
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${username}?`)) {
            setAllData(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    utilisateurs: prev.utilisateurs.filter(u => u.username !== username),
                };
            });
        }
    };

    return (
        <>
            <Header title="Paramètres Généraux & Diagnostic" />
            <div className="mt-6 space-y-8">
                <ChangePasswordPanel currentUser={currentUser} changePassword={changePassword} />
    
                <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
                    <h3 className="text-lg font-bold text-slate-100 mb-2">Gestion des Utilisateurs</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-semibold text-primary mb-2">Ajouter un utilisateur</h4>
                            <form onSubmit={handleAddUser} className="space-y-3">
                                <input type="text" placeholder="Nom d'utilisateur" value={newUser.username} onChange={e => setNewUser(p => ({...p, username: e.target.value}))} className="w-full bg-slate-900 border border-slate-600 rounded-md p-2"/>
                                <input type="password" placeholder="Mot de passe initial" value={newUser.password} onChange={e => setNewUser(p => ({...p, password: e.target.value}))} className="w-full bg-slate-900 border border-slate-600 rounded-md p-2"/>
                                <select value={newUser.role} onChange={e => setNewUser(p => ({...p, role: e.target.value as 'user'|'admin'}))} className="w-full bg-slate-900 border border-slate-600 rounded-md p-2">
                                    <option value="user">Utilisateur</option>
                                    <option value="admin">Administrateur</option>
                                </select>
                                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover">Ajouter</button>
                            </form>
                        </div>
                         <div>
                            <h4 className="font-semibold text-primary mb-2">Utilisateurs existants</h4>
                            <ul className="space-y-2 max-h-60 overflow-y-auto">
                                {allData.utilisateurs.map(user => (
                                    <li key={user.id} className="flex justify-between items-center bg-slate-900/50 p-2 rounded-md">
                                        <div>
                                            <span className="font-semibold text-slate-200">{user.username}</span>
                                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-primary/30 text-primary' : 'bg-slate-600 text-slate-300'}`}>{user.role}</span>
                                        </div>
                                        <button onClick={() => handleDeleteUser(user.username)} className="p-1 hover:bg-danger-red/20 rounded-full" title="Supprimer">
                                            <TrashIcon className="w-4 h-4 text-danger-red"/>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
    
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
    
                <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
                    <h3 className="text-lg font-bold text-slate-100 mb-2">Autres Consommateurs</h3>
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
                                        <td className="px-6 py-4 font-bold text-white">{consumer.chaine || 'N/A'}</td>
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
    
                <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
                    <h3 className="text-lg font-bold text-slate-100 mb-2">Diagnostic de Connexion Google Sheets</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Donnée Attendue</th>
                                    <th scope="col" className="px-6 py-3">Statut</th>
                                    <th scope="col" className="px-6 py-3">Nom Trouvé</th>
                                    <th scope="col" className="px-6 py-3">Lignes Lues</th>
                                </tr>
                            </thead>
                            <tbody>
                                {diagnosticInfo.keyMapping.map((info) => (
                                    <tr key={info.canonicalKey} className="bg-slate-800 border-b border-slate-700">
                                        <td className="px-6 py-4 font-medium text-white">{info.canonicalKey}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${info.status === 'Trouvé' ? 'bg-ok-green/20 text-ok-green' : 'bg-danger-red/20 text-danger-red'}`}>{info.status}</span>
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