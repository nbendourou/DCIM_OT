import type { Rack, AllData } from '../types.ts';

export const toNum = (val: any): number => {
  if (val === null || val === undefined) {
    return 0;
  }
  if (typeof val === 'number' && !isNaN(val)) {
    return val;
  }
  if (typeof val === 'string') {
    // Replace comma with a dot for decimal conversion
    const sanitizedVal = val.replace(',', '.');
    const num = parseFloat(sanitizedVal);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

/**
 * Calculates the percentage imbalance between three phase values.
 * @param p1 Phase 1 value.
 * @param p2 Phase 2 value.
 * @param p3 Phase 3 value.
 * @returns The imbalance percentage.
 */
export const calculateImbalance = (p1: number, p2: number, p3: number): number => {
    const phases = [p1, p2, p3].filter(p => p > 0);
    if (phases.length < 2) return 0;
    
    const maxPhase = Math.max(...phases);
    const minPhase = Math.min(...phases);

    if (maxPhase === 0) return 0;
    
    return ((maxPhase - minPhase) / maxPhase) * 100;
};


/**
 * Parses a rack dimension string (e.g., "42U") to get the number of units.
 * @param dimensions The dimension string.
 * @returns The number of U's, or a default of 42.
 */
export const parseRackDimensions = (dimensions: string | undefined | null): number => {
    if (!dimensions) return 42;
    const match = dimensions.match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 42;
};

/**
 * Determines the primary power type of a rack based on its equipment connections and consumption.
 * @param rack The rack object.
 * @param allData The entire application dataset.
 * @returns 'DC', 'AC_TRI', or 'AC_MONO'.
 */
export const getRackPowerType = (rack: Rack, allData: AllData): 'DC' | 'AC_TRI' | 'AC_MONO' => {
    const equipmentInRack = allData.equipements.filter(eq => eq.rack_fk === rack.id);
    const equipmentIds = new Set(equipmentInRack.map(eq => eq.id));

    // 1. Check connections first - this is the most reliable source.
    const hasDcConnections = allData.connexionsDC.some(conn => equipmentIds.has(conn.equipment_fk));
    if (hasDcConnections) {
        return 'DC';
    }

    const acConnections = allData.connexionsAC.filter(conn => equipmentIds.has(conn.equipment_fk));
    if (acConnections.length > 0) {
        const hasTriPhaseConnection = acConnections.some(conn => {
            if (conn.phase === 'P123') return true;
            // Also check the outlet name from the AC Box
            const acBox = allData.boitiersAC.find(box => box.id === conn.ac_box_fk);
            if (acBox && conn.outlet_name) {
                return conn.outlet_name.toUpperCase().includes('TRI');
            }
            return false;
        });

        return hasTriPhaseConnection ? 'AC_TRI' : 'AC_MONO';
    }

    // 2. Fallback to manually entered power values on the rack itself.
    if (toNum(rack.conso_baie_v1_dc_kw) > 0 || toNum(rack.conso_baie_v2_dc_kw) > 0) {
        return 'DC';
    }

    // Check outlet types from rack data
    const outlet1 = rack.ac_outlet_v1?.toUpperCase() || '';
    const outlet2 = rack.ac_outlet_v2?.toUpperCase() || '';
    if (outlet1.includes('TRI') || outlet2.includes('TRI')) {
        return 'AC_TRI';
    }
    if (outlet1.includes('MONO') || outlet2.includes('MONO')) {
        return 'AC_MONO';
    }

    // 3. Fallback to inferring from phase consumption
    const v1PhasesUsed = [rack.conso_baie_v1_ph1_kw, rack.conso_baie_v1_ph2_kw, rack.conso_baie_v1_ph3_kw].filter(p => toNum(p) > 0).length;
    const v2PhasesUsed = [rack.conso_baie_v2_ph1_kw, rack.conso_baie_v2_ph2_kw, rack.conso_baie_v2_ph3_kw].filter(p => toNum(p) > 0).length;

    if (v1PhasesUsed > 1 || v2PhasesUsed > 1) {
        return 'AC_TRI'; // If more than one phase is used, assume Triphasé
    }
    
    if (v1PhasesUsed > 0 || v2PhasesUsed > 0) {
        return 'AC_MONO'; // If any single phase is used, assume Monophasé
    }
    
    // Default for a rack with 0 power. The rack card only colors if power > 0, so this is safe.
    return 'AC_MONO';
};

/**
 * Parses a descriptive outlet string to extract its base name and assigned phase.
 * It also determines if the phase should be locked in the UI.
 * e.g., "MONO 1 (P1)" -> { name: "MONO 1", phase: "P1", isLocked: true }
 *       "TRI 1"       -> { name: "TRI 1", phase: null, isLocked: false }
 *       "MONO 2"      -> { name: "MONO 2", phase: null, isLocked: false }
 * @param outletString The full outlet string from the AC Box configuration.
 * @returns An object containing the name, phase, and locked status.
 */
export const parseOutletString = (outletString: string): { name: string; phase: 'P1' | 'P2' | 'P3' | 'P123' | null; isLocked: boolean } => {
    if (!outletString) return { name: '', phase: null, isLocked: false };

    const phaseMatch = outletString.match(/\((P\d)\)/);
    if (phaseMatch) {
        const phase = phaseMatch[1] as 'P1' | 'P2' | 'P3';
        const name = outletString.replace(phaseMatch[0], '').trim();
        return { name, phase, isLocked: true };
    }

    if (outletString.toUpperCase().includes('TRI')) {
        // A TRI outlet allows user to select phase. Phase is not locked.
        // The component will handle defaulting/setting the initial phase.
        return { name: outletString, phase: null, isLocked: false };
    }

    // It's a MONO plug from old format, phase is not locked
    return { name: outletString, phase: null, isLocked: false };
};


/**
 * Generates a list of all possible outlet names from an AC Box configuration string.
 * Supports both the new descriptive format (e.g., "TRI 1, MONO 1 (P1)")
 * and the old summary format (e.g., "2TRI+3MONO").
 * @param configuration The configuration string from the ACBox object.
 * @returns An array of outlet names.
 */
export const getOutletsForACBox = (configuration: string | undefined | null): string[] => {
    if (!configuration) return [];
    
    // New format: "TRI 1, MONO 1 (P1), MONO 2 (P2)"
    if (configuration.includes(',')) {
        return configuration.split(',').map(s => s.trim()).filter(s => s);
    }
    
    // Old format: "2TRI+3MONO"
    const outlets: string[] = [];
    const parts = configuration.toUpperCase().split('+');

    parts.forEach(part => {
        const match = part.match(/(\d+)(TRI|MONO)/);
        if (match) {
            const count = parseInt(match[1], 10);
            const type = match[2];
            for (let i = 1; i <= count; i++) {
                outlets.push(`${type} ${i}`);
            }
        }
    });

    return outlets;
};

/**
 * Recalculates the total AC and DC power consumption for a single rack based on its connected equipment.
 * This is a pure function that takes a rack and the full application data, and returns a new rack object with updated power values.
 * @param rack The rack object to recalculate.
 * @param allData The entire application dataset, used to find equipment and connections.
 * @returns A new rack object with the `conso_baie_*` properties updated.
 */
export const recalculateRackPower = (rack: Rack, allData: AllData): Rack => {
    const equipmentInRack = allData.equipements.filter(eq => eq.rack_fk === rack.id);
    const equipmentIds = equipmentInRack.map(eq => eq.id);

    // Recalculate DC Power
    let totalV1_DC = 0;
    let totalV2_DC = 0;
    allData.connexionsDC
        .filter(conn => equipmentIds.includes(conn.equipment_fk))
        .forEach(conn => {
            if (conn.voie === '1') totalV1_DC += toNum(conn.puissance_kw);
            if (conn.voie === '2') totalV2_DC += toNum(conn.puissance_kw);
        });

    // Recalculate AC Power
    const totalsAC = { v1p1: 0, v1p2: 0, v1p3: 0, v2p1: 0, v2p2: 0, v2p3: 0 };
    allData.connexionsAC
        .filter(conn => equipmentIds.includes(conn.equipment_fk))
        .forEach(conn => {
            const power = toNum(conn.puissance_kw);
            if (conn.voie === '1') {
                if (conn.phase === 'P1') totalsAC.v1p1 += power;
                else if (conn.phase === 'P2') totalsAC.v1p2 += power;
                else if (conn.phase === 'P3') totalsAC.v1p3 += power;
                else if (conn.phase === 'P123') {
                    const p = power / 3;
                    totalsAC.v1p1 += p; totalsAC.v1p2 += p; totalsAC.v1p3 += p;
                }
            } else if (conn.voie === '2') {
                if (conn.phase === 'P1') totalsAC.v2p1 += power;
                else if (conn.phase === 'P2') totalsAC.v2p2 += power;
                else if (conn.phase === 'P3') totalsAC.v2p3 += power;
                else if (conn.phase === 'P123') {
                     const p = power / 3;
                    totalsAC.v2p1 += p; totalsAC.v2p2 += p; totalsAC.v2p3 += p;
                }
            }
        });

    return {
        ...rack,
        conso_baie_v1_dc_kw: totalV1_DC,
        conso_baie_v2_dc_kw: totalV2_DC,
        conso_baie_v1_ph1_kw: totalsAC.v1p1,
        conso_baie_v1_ph2_kw: totalsAC.v1p2,
        conso_baie_v1_ph3_kw: totalsAC.v1p3,
        conso_baie_v2_ph1_kw: totalsAC.v2p1,
        conso_baie_v2_ph2_kw: totalsAC.v2p2,
        conso_baie_v2_ph3_kw: totalsAC.v2p3,
    };
};

/**
 * Handles the complete logic for deleting an equipment and updating the application state.
 * It removes the equipment, its associated AC/DC connections, and then recalculates the power
 * for the affected rack to ensure data consistency.
 * @param currentData The current `AllData` state object.
 * @param equipmentIdToDelete The ID of the equipment to be deleted.
 * @returns A new `AllData` object representing the updated state.
 */
export const deleteEquipmentAndUpdateState = (
    currentData: AllData, 
    equipmentIdToDelete: string
): AllData => {
    const equipmentToDelete = currentData.equipements.find(eq => eq.id === equipmentIdToDelete);
    if (!equipmentToDelete) {
        console.warn(`Equipment with ID ${equipmentIdToDelete} not found for deletion.`);
        return currentData;
    }
    const affectedRackId = equipmentToDelete.rack_fk;

    // 1. Filter out the target equipment and its connections.
    const newEquipments = currentData.equipements.filter(eq => eq.id !== equipmentIdToDelete);
    const newDcConnections = currentData.connexionsDC.filter(c => c.equipment_fk !== equipmentIdToDelete);
    const newAcConnections = currentData.connexionsAC.filter(c => c.equipment_fk !== equipmentIdToDelete);

    // 2. Create a temporary data object with the deletions applied. This is the context needed for recalculation.
    const dataAfterDeletion = {
        ...currentData,
        equipements: newEquipments,
        connexionsDC: newDcConnections,
        connexionsAC: newAcConnections,
    };
    
    // 3. Recalculate power for the affected rack and create the final racks array.
    const newRacks = currentData.racks.map(r => {
        if (r.id === affectedRackId) {
            return recalculateRackPower(r, dataAfterDeletion);
        }
        return r;
    });

    // 4. Return the complete, new state object.
    return {
        ...dataAfterDeletion,
        racks: newRacks,
    };
};