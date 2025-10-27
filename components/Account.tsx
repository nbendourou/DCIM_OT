import React, { useState } from 'react';
import type { User } from '../types.ts';
import Header from './Header.tsx';

interface ChangePasswordPanelProps {
    currentUser: User,
    changePassword: (username: string, oldPass: string, newPass: string) => Promise<{success: boolean, message: string}>
}

const ChangePasswordPanel: React.FC<ChangePasswordPanelProps> = ({ currentUser, changePassword }) => {
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
};

interface AccountProps {
  currentUser: User;
  changePassword: (username: string, oldPass: string, newPass: string) => Promise<{success: boolean, message: string}>;
}

const Account: React.FC<AccountProps> = ({ currentUser, changePassword }) => {
  return (
    <>
      <Header title="Gestion de Compte" />
      <div className="mt-6">
        <ChangePasswordPanel currentUser={currentUser} changePassword={changePassword} />
      </div>
    </>
  );
};

export default Account;
