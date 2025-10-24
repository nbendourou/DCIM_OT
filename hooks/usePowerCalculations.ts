import { useState, useMemo, useCallback } from 'react';
import type { AllData, Capacities, RackUtilization, DCPanelUtilization, ACBoxUtilization, ChainLoad, RackPowerAnomaly } from '../types.ts';
import { toNum, getOutletsForACBox, calculateImbalance } from '../utils/powerUtils.ts';

// A default empty load object
const initialChainLoad: ChainLoad = {
    it_p1: 0, it_p2: 0, it_p3: 0, it_dc: 0,
    other_p1: 0, other_p2: 0, other_p3: 0, other_dc: 0,
    transferred_p1: 0, transferred_p2: 0, transferred_p3: 0, transferred_dc: 0,
    final_p1: 0, final_p2: 0, final_p3: 0,
};

// Defines the primary and secondary power chains for each room.
const roomChainMapping: { [roomName: string]: { voie1: string, voie2: string } } = {
    'ITN1': { voie1: 'A', voie2: 'B' },
    'ITN2': { voie1: 'A', voie2: 'C' },
    'ITN3': { voie1: 'B', voie2: 'C' },
};


export const usePowerCalculations = (allData: AllData | null, capacities: Capacities) => {
  const [chainLoads, setChainLoads] = useState<{ [key: string]: ChainLoad }>({
    A: { ...initialChainLoad },
    B: { ...initialChainLoad },
    C: { ...initialChainLoad },
  });

  const rackUtilizations = useMemo<{[key: string]: RackUtilization}>(() => {
    if (!allData) return {};
    return allData.racks.reduce((acc, rack) => {
      const v1_total = toNum(rack.conso_baie_v1_ph1_kw) + toNum(rack.conso_baie_v1_ph2_kw) + toNum(rack.conso_baie_v1_ph3_kw) + toNum(rack.conso_baie_v1_dc_kw);
      const v2_total = toNum(rack.conso_baie_v2_ph1_kw) + toNum(rack.conso_baie_v2_ph2_kw) + toNum(rack.conso_baie_v2_ph3_kw) + toNum(rack.conso_baie_v2_dc_kw);
      
      // FIX: Changed calculation from Math.max(v1_total, v2_total) to the sum of both ways, as requested by the user.
      const totalPower = v1_total + v2_total;
      const capacity = toNum(rack.puissance_pdu_kw);
      const percentage = capacity > 0 ? (totalPower / capacity) * 100 : 0;
      
      acc[rack.id] = { totalPower, capacity, percentage };
      return acc;
    }, {} as {[key: string]: RackUtilization});
  }, [allData]);

  const dcPanelUtilizations = useMemo<{[key: string]: DCPanelUtilization}>(() => {
    if (!allData) return {};
    return allData.tableauxDC.reduce((acc, panel) => {
        const totalBreakers = toNum(panel.nombre_disjoncteurs_total);
        // Count equipment connections ('connexionsDC') for a more accurate breaker count.
        const usedBreakers = allData.connexionsDC.filter(c => c.dc_panel_fk === panel.id).length;
        const percentage = totalBreakers > 0 ? (usedBreakers / totalBreakers) * 100 : 0;
        acc[panel.id] = { usedBreakers, totalBreakers, percentage };
        return acc;
    }, {} as {[key: string]: DCPanelUtilization});
  }, [allData]);

  const acBoxUtilizations = useMemo<{[key: string]: ACBoxUtilization}>(() => {
     if (!allData) return {};
     return allData.boitiersAC.reduce((acc, box) => {
        const totalOutlets = getOutletsForACBox(box.configuration).length;
        // This is a simplified calculation. A real one would check connexionsAC.
        const usedOutlets = allData.racks.filter(r => r.ac_box_id_v1 === box.id || r.ac_box_id_v2 === box.id).length;
        const percentage = totalOutlets > 0 ? (usedOutlets / totalOutlets) * 100 : 0;
        acc[box.id] = { usedOutlets, totalOutlets, percentage };
        return acc;
     }, {} as {[key: string]: ACBoxUtilization});
  }, [allData]);

  const rackPowerAnomalies = useMemo<{[key: string]: RackPowerAnomaly}>(() => {
    if (!allData) return {};
    return allData.racks.reduce((acc, rack) => {
        const calculatedV1 = toNum(rack.conso_baie_v1_ph1_kw) + toNum(rack.conso_baie_v1_ph2_kw) + toNum(rack.conso_baie_v1_ph3_kw) + toNum(rack.conso_baie_v1_dc_kw);
        const calculatedV2 = toNum(rack.conso_baie_v2_ph1_kw) + toNum(rack.conso_baie_v2_ph2_kw) + toNum(rack.conso_baie_v2_ph3_kw) + toNum(rack.conso_baie_v2_dc_kw);
        const totalCalculated = calculatedV1 + calculatedV2;

        const realV1 = toNum(rack.conso_reelle_v1_ph1_kw) + toNum(rack.conso_reelle_v1_ph2_kw) + toNum(rack.conso_reelle_v1_ph3_kw) + toNum(rack.conso_reelle_v1_dc_kw);
        const realV2 = toNum(rack.conso_reelle_v2_ph1_kw) + toNum(rack.conso_reelle_v2_ph2_kw) + toNum(rack.conso_reelle_v2_ph3_kw) + toNum(rack.conso_reelle_v2_dc_kw);
        const totalReal = realV1 + realV2;

        const hasRealData = totalReal > 0;
        if (!hasRealData) {
            acc[rack.id] = { powerDifferenceKw: 0, powerDifferencePercent: 0, isOverPower: false, imbalanceV1: 0, imbalanceV2: 0, hasImbalance: false, hasAnomaly: false, totalReal, totalCalculated };
            return acc;
        }

        const powerDifferenceKw = totalReal - totalCalculated;
        const powerDifferencePercent = totalCalculated > 0 ? (powerDifferenceKw / totalCalculated) * 100 : (totalReal > 0 ? Infinity : 0);
        const isOverPower = totalReal > totalCalculated;

        const imbalanceV1 = calculateImbalance(toNum(rack.conso_reelle_v1_ph1_kw), toNum(rack.conso_reelle_v1_ph2_kw), toNum(rack.conso_reelle_v1_ph3_kw));
        const imbalanceV2 = calculateImbalance(toNum(rack.conso_reelle_v2_ph1_kw), toNum(rack.conso_reelle_v2_ph2_kw), toNum(rack.conso_reelle_v2_ph3_kw));
        const hasImbalance = imbalanceV1 > 20 || imbalanceV2 > 20;

        acc[rack.id] = {
            powerDifferenceKw,
            powerDifferencePercent,
            isOverPower,
            imbalanceV1,
            imbalanceV2,
            hasImbalance,
            hasAnomaly: isOverPower || hasImbalance,
            totalReal,
            totalCalculated,
        };
        return acc;
    }, {} as {[key: string]: RackPowerAnomaly});
  }, [allData]);

  const calculateChainLoads = useCallback((downedChains: string[] = []) => {
    if (!allData) return;

    const loads: { [key: string]: ChainLoad } = {
        A: JSON.parse(JSON.stringify(initialChainLoad)),
        B: JSON.parse(JSON.stringify(initialChainLoad)),
        C: JSON.parse(JSON.stringify(initialChainLoad)),
    };

    // 1. Calculate base IT loads based on room-to-chain mapping
    allData.racks.forEach(rack => {
        // Use the defined mapping, or default to a B/C mapping for unlisted rooms.
        const mapping = roomChainMapping[rack.salle] || { voie1: 'B', voie2: 'C' };
        
        const chain1 = mapping.voie1;
        const chain2 = mapping.voie2;

        // Add load from Voie 1 to its assigned chain
        loads[chain1].it_p1 += toNum(rack.conso_baie_v1_ph1_kw);
        loads[chain1].it_p2 += toNum(rack.conso_baie_v1_ph2_kw);
        loads[chain1].it_p3 += toNum(rack.conso_baie_v1_ph3_kw);
        loads[chain1].it_dc += toNum(rack.conso_baie_v1_dc_kw);

        // Add load from Voie 2 to its assigned chain
        loads[chain2].it_p1 += toNum(rack.conso_baie_v2_ph1_kw);
        loads[chain2].it_p2 += toNum(rack.conso_baie_v2_ph2_kw);
        loads[chain2].it_p3 += toNum(rack.conso_baie_v2_ph3_kw);
        loads[chain2].it_dc += toNum(rack.conso_baie_v2_dc_kw);
    });

    // 2. Add 'Autres Consommateurs' to their respective chains
    allData.autresConsommateurs.forEach(consumer => {
        const chain = consumer.chaine;
        if (loads[chain]) {
            loads[chain].other_p1 += toNum(consumer.acp1);
            loads[chain].other_p2 += toNum(consumer.acp2);
            loads[chain].other_p3 += toNum(consumer.acp3);
            loads[chain].other_dc += toNum(consumer.dc);
        }
    });

    // 3. Handle failures and transfer loads
    if (downedChains.length > 0) {
        // Transfer IT loads (AC+DC) based on per-rack redundancy, respecting the room-to-chain mapping.
        allData.racks.forEach(rack => {
            const mapping = roomChainMapping[rack.salle] || { voie1: 'B', voie2: 'C' };
            const chain1 = mapping.voie1;
            const chain2 = mapping.voie2;
            
            if (downedChains.includes(chain1) && !downedChains.includes(chain2)) {
                loads[chain2].transferred_p1 += toNum(rack.conso_baie_v1_ph1_kw);
                loads[chain2].transferred_p2 += toNum(rack.conso_baie_v1_ph2_kw);
                loads[chain2].transferred_p3 += toNum(rack.conso_baie_v1_ph3_kw);
                loads[chain2].transferred_dc += toNum(rack.conso_baie_v1_dc_kw);
            }

            if (downedChains.includes(chain2) && !downedChains.includes(chain1)) {
                loads[chain1].transferred_p1 += toNum(rack.conso_baie_v2_ph1_kw);
                loads[chain1].transferred_p2 += toNum(rack.conso_baie_v2_ph2_kw);
                loads[chain1].transferred_p3 += toNum(rack.conso_baie_v2_ph3_kw);
                loads[chain1].transferred_dc += toNum(rack.conso_baie_v2_dc_kw);
            }
        });
        
        // DEFINITIVE FIX: The previous logic incorrectly distributed "Other DC" loads evenly.
        // As per the user's request, this logic is removed to ensure load transfer strictly
        // follows the ITN1 (A+B) and ITN2 (A+C) redundancy rules defined by the rack mapping.
        // The "Other" loads from a downed chain are now simply lost in the simulation,
        // which is the desired behavior for now.
    }

    // 4. Calculate final loads for each chain
    const RECTIFIER_EFFICIENCY = 0.96;
    ['A', 'B', 'C'].forEach(chain => {
        if (downedChains.includes(chain)) {
            loads[chain].final_p1 = 0;
            loads[chain].final_p2 = 0;
            loads[chain].final_p3 = 0;
        } else {
            // All direct AC loads on the chain (IT + Other + Transferred)
            const total_ac_direct_p1 = loads[chain].it_p1 + loads[chain].other_p1 + loads[chain].transferred_p1;
            const total_ac_direct_p2 = loads[chain].it_p2 + loads[chain].other_p2 + loads[chain].transferred_p2;
            const total_ac_direct_p3 = loads[chain].it_p3 + loads[chain].other_p3 + loads[chain].transferred_p3;

            // All DC loads on the chain (IT + Other + Transferred)
            const total_dc_load = loads[chain].it_dc + loads[chain].other_dc + loads[chain].transferred_dc;

            // Convert the total DC load to an equivalent AC load, accounting for rectifier efficiency.
            const ac_load_from_dc = total_dc_load / RECTIFIER_EFFICIENCY;

            // Distribute this equivalent AC load evenly across the three phases.
            const ac_load_from_dc_per_phase = ac_load_from_dc / 3;

            // The final load on each phase is the sum of its direct AC loads and its share of the AC load from DC conversion.
            loads[chain].final_p1 = total_ac_direct_p1 + ac_load_from_dc_per_phase;
            loads[chain].final_p2 = total_ac_direct_p2 + ac_load_from_dc_per_phase;
            loads[chain].final_p3 = total_ac_direct_p3 + ac_load_from_dc_per_phase;
        }
    });

    setChainLoads(loads);

  }, [allData]);

  return { rackUtilizations, dcPanelUtilizations, acBoxUtilizations, chainLoads, calculateChainLoads, rackPowerAnomalies };
};
