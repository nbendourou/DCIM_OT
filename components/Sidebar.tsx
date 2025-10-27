import React from 'react';
import { PowerIcon, RefreshIcon, SaveIcon, DashboardIcon, RoomIcon, CapacityIcon, ReportingIcon, SettingsIcon } from './icons.tsx';
import type { View, User } from '../types.ts';

interface NavbarProps {
  view: View;
  setView: (view: View) => void;
  onSave: () => void;
  onRefresh: () => void;
  isSaving: boolean;
  isRefreshing: boolean;
  currentUser: User | null;
  onLogout: () => void;
}

const NavItem: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}> = ({ label, isActive, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
      isActive
        ? 'bg-primary text-white'
        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
    }`}
  >
    {icon}
    <span className="ml-2">{label}</span>
  </button>
);

export const Navbar: React.FC<NavbarProps> = ({ view, setView, onSave, onRefresh, isSaving, isRefreshing, currentUser, onLogout }) => {
  return (
    <nav className="w-full bg-slate-800 flex items-center justify-between p-3 border-b border-slate-700 shadow-lg">
      <div className="flex items-center space-x-6">
        <div className="flex items-center">
          <PowerIcon className="h-8 w-8 text-primary" />
          <h1 className="ml-2 text-lg font-bold text-slate-100">DCIM</h1>
        </div>
        <div className="flex items-center space-x-2">
            <NavItem icon={<DashboardIcon className="w-5 h-5"/>} label="Tableau de Bord" isActive={view === 'dashboard'} onClick={() => setView('dashboard')} />
            <NavItem icon={<RoomIcon className="w-5 h-5"/>} label="Salles" isActive={view === 'rooms'} onClick={() => setView('rooms')} />
            <NavItem icon={<CapacityIcon className="w-5 h-5"/>} label="Capacité" isActive={view === 'capacity'} onClick={() => setView('capacity')} />
            <NavItem icon={<ReportingIcon className="w-5 h-5"/>} label="Rapports" isActive={view === 'reporting'} onClick={() => setView('reporting')} />
            {currentUser?.role === 'admin' ? (
                <NavItem icon={<SettingsIcon className="w-5 h-5"/>} label="Paramètres" isActive={view === 'settings'} onClick={() => setView('settings')} />
            ) : (
                <NavItem icon={<SettingsIcon className="w-5 h-5"/>} label="Mon Compte" isActive={view === 'account'} onClick={() => setView('account')} />
            )}
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="text-sm text-slate-400">
            Connecté: <span className="font-bold text-slate-200">{currentUser?.username}</span>
        </div>
        <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              disabled={isRefreshing || isSaving}
              className="flex items-center justify-center px-3 py-2 border border-slate-600 text-sm font-medium rounded-md text-slate-200 bg-slate-700 hover:bg-slate-600 transition disabled:bg-slate-500 disabled:cursor-not-allowed"
            >
              {isRefreshing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              ) : (
                <RefreshIcon className="w-5 h-5 mr-2" />
              )}
              {isRefreshing ? 'Actualisation...' : 'Actualiser'}
            </button>
            {currentUser?.role === 'admin' && (
                <button
                  onClick={onSave}
                  disabled={isSaving || isRefreshing}
                  className="w-full flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-ok-green hover:bg-green-600 disabled:bg-slate-500 transition"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  ) : (
                    <SaveIcon className="w-5 h-5 mr-2" />
                  )}
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
            )}
             <button
                onClick={onLogout}
                className="px-3 py-2 text-sm font-medium rounded-md text-slate-300 hover:bg-slate-700 hover:text-white"
                title="Déconnexion"
             >
                Déconnexion
             </button>
        </div>
      </div>
    </nav>
  );
};