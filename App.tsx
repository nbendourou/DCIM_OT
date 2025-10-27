import React, { useState, useEffect, useMemo } from 'react';
import type { AllData, Rack, Equipment, View, Capacities, User } from './types.ts';
import { useGoogleSheetData } from './hooks/useGoogleSheetData.ts';
import { MOCK_CAPACITIES } from './mockData.ts';
import { Navbar } from './components/Sidebar.tsx';
import Dashboard from './components/Dashboard.tsx';
import Rooms from './components/Rooms.tsx';
// FIX: Added .tsx extension to fix module resolution error.
import Capacity from './components/Capacity.tsx';
import Reporting from './components/Reporting.tsx';
import Settings from './components/Settings.tsx';
import Account from './components/Account.tsx';
import { RackDetailModal } from './components/RackDetailModal.tsx';
import { EquipmentDetailModal } from './components/EquipmentDetailModal.tsx';
import { LoadingSpinnerIcon } from './components/icons.tsx';
import { usePowerCalculations } from './hooks/usePowerCalculations.ts';
import { recalculateRackPower } from './utils/powerUtils.ts';
import Login from './components/Login.tsx';

const App: React.FC = () => {
    const { initialData, loading, error, refreshData, saveData, diagnosticInfo, login, changePassword } = useGoogleSheetData();
    const [allData, setAllData] = useState<AllData | null>(initialData);
    const [isSaving, setIsSaving] = useState(false);
    const [view, setView] = useState<View>('dashboard');
    const [capacities, setCapacities] = useState<Capacities>(MOCK_CAPACITIES);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

    const { rackUtilizations, dcPanelUtilizations, acBoxUtilizations, rackPowerAnomalies } = usePowerCalculations(allData, capacities);

    useEffect(() => {
        const savedUser = sessionStorage.getItem('currentUser');
        if (savedUser) {
            setCurrentUser(JSON.parse(savedUser));
        }
    }, []);

    useEffect(() => {
        if (initialData) {
            const recalculatedRacks = initialData.racks.map(rack => 
                recalculateRackPower(rack, initialData)
            );
            setAllData({
                ...initialData,
                racks: recalculatedRacks,
            });
        } else {
            setAllData(null);
        }
    }, [initialData]);
    
    const handleLogin = (user: User) => {
        setCurrentUser(user);
        sessionStorage.setItem('currentUser', JSON.stringify(user));
    };

    const handleLogout = () => {
        setCurrentUser(null);
        sessionStorage.removeItem('currentUser');
        setView('dashboard'); // Reset to dashboard view on logout
    };

    const handleSave = async () => {
        if (!allData) return;
        setIsSaving(true);
        await saveData(allData);
        setIsSaving(false);
    };
    
    const handleSelectRack = (rack: Rack) => {
        setSelectedRack(rack);
    };

    const handleSelectEquipment = (equipmentId: string) => {
        if (!allData) return;
        const equipment = allData.equipements.find(eq => eq.id === equipmentId);
        if (equipment) {
            setSelectedEquipment(equipment);
        }
    };
    
    const handleCloseRackModal = () => {
        setSelectedRack(null);
    };

    const handleCloseEquipmentModal = () => {
        setSelectedEquipment(null);
    };
    
    const selectedEquipmentRack = useMemo(() => {
        if (!selectedEquipment || !allData?.racks) return null;
        return allData.racks.find(r => r.id === selectedEquipment.rack_fk) || null;
    }, [selectedEquipment, allData?.racks]);

    const renderView = () => {
        if (!allData) return null;
        switch (view) {
            case 'dashboard':
                return <Dashboard allData={allData} capacities={capacities} onSelectRack={handleSelectRack} rackPowerAnomalies={rackPowerAnomalies} />;
            case 'rooms':
                return <Rooms allData={allData} capacities={capacities} onSelectRack={handleSelectRack} rackPowerAnomalies={rackPowerAnomalies} />;
            case 'capacity':
                return <Capacity allData={allData} capacities={capacities} />;
            case 'reporting':
                return <Reporting allData={allData} dcPanelUtilizations={dcPanelUtilizations} />;
            case 'settings':
                return <Settings allData={allData} setAllData={setAllData} diagnosticInfo={diagnosticInfo} capacities={capacities} setCapacities={setCapacities} currentUser={currentUser!} changePassword={changePassword} />;
            case 'account':
                return <Account currentUser={currentUser!} changePassword={changePassword} />;
            default:
                return <Dashboard allData={allData} capacities={capacities} onSelectRack={handleSelectRack} rackPowerAnomalies={rackPowerAnomalies} />;
        }
    };
    
    if (!currentUser) {
        return <Login onLogin={handleLogin} loginFn={login} fetchError={error} diagnosticInfo={diagnosticInfo} />;
    }

    if (loading && !allData) {
        return (
            <div className="bg-slate-900 text-slate-100 min-h-screen flex flex-col items-center justify-center">
                <LoadingSpinnerIcon className="w-12 h-12 text-primary mb-4" />
                <p>Chargement des données depuis Google Sheets...</p>
                {error && <p className="text-danger-red mt-2">{error}</p>}
            </div>
        );
    }

    return (
        <div className="bg-slate-900 text-slate-100 min-h-screen flex flex-col">
            <Navbar view={view} setView={setView} onSave={handleSave} onRefresh={refreshData} isSaving={isSaving} isRefreshing={loading} currentUser={currentUser} onLogout={handleLogout} />
            <main className="flex-grow p-6 overflow-y-auto">
                {error && (
                    <div className="bg-warning-orange/20 border border-warning-orange text-warning-orange p-4 rounded-md mb-6">
                        {error}
                    </div>
                )}
                {renderView()}
            </main>
            
            {selectedRack && allData && rackUtilizations[selectedRack.id] && (
                <RackDetailModal
                    rack={selectedRack}
                    equipments={allData.equipements.filter(eq => eq.rack_fk === selectedRack.id)}
                    utilization={rackUtilizations[selectedRack.id]}
                    onClose={handleCloseRackModal}
                    onSelectEquipment={handleSelectEquipment}
                    allData={allData}
                    setAllData={setAllData}
                />
            )}

            {selectedEquipment && allData && (
                <EquipmentDetailModal
                    equipment={selectedEquipment}
                    rack={selectedEquipmentRack}
                    allData={allData}
                    setAllData={setAllData}
                    dcPanelUtilizations={dcPanelUtilizations}
                    acBoxUtilizations={acBoxUtilizations}
                    onClose={handleCloseEquipmentModal}
                />
            )}
        </div>
    );
};

export default App;