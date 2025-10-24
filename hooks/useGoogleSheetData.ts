import { useState, useEffect, useCallback } from 'react';
import type { AllData, DiagnosticInfo, KeyMappingInfo, ACConnection, DCConnection } from '../types.ts';
import { MOCK_DATA } from '../mockData.ts';
import { toNum } from '../utils/powerUtils.ts';

// This URL must be configured with your own Google Apps Script web app URL.
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzhxvgEjc9vH5_-b5_egH26FRUXSlc_mnAV2J43gyuErCjfSlFi6Uqi-_MZwZ1uXDqXNA/exec';

const CANONICAL_KEYS: (keyof AllData)[] = [
  'racks', 'equipements', 'boitiersAC', 'tableauxDC', 'connexionsAC',
  'connexionsDC', 'autresConsommateurs', 'portsAlimentation', 'cablageAlimentation'
];

// Maps various possible incoming keys (lowercase) to the canonical key used in the app.
const KEY_MAPPINGS: { [rawKey: string]: keyof AllData } = {
  'racks': 'racks',
  'equipements': 'equipements',
  'boitiers_ac': 'boitiersAC',
  'boitiersac': 'boitiersAC',
  'tableaux_dc': 'tableauxDC',
  'tableauxdc': 'tableauxDC',
  'connexions_ac': 'connexionsAC',
  'connexionsac': 'connexionsAC',
  'connexions_dc': 'connexionsDC',
  'connexionsdc': 'connexionsDC',
  'autres_consommateurs': 'autresConsommateurs',
  'autresconsommateurs': 'autresConsommateurs',
  'otherconsumers': 'autresConsommateurs',
  'ports_alimentation': 'portsAlimentation',
  'portsalimentation': 'portsAlimentation',
  'cablage_alimentation': 'cablageAlimentation',
  'cablagealimentation': 'cablageAlimentation',
};

const normalizeObjectKeys = (obj: any): any => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    // FIX: Explicitly type the accumulator to prevent 'Type 'symbol' cannot be used as an index type' error.
    return Object.keys(obj).reduce((acc: {[key: string]: any}, key) => {
        // Normalize by lowercasing, removing diacritics, and replacing spaces with underscores for consistency.
        const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
        acc[normalizedKey] = obj[key];
        return acc;
    }, {});
};

// Definitive fix: A robust function to safely get a key and clean it as a string.
const getCleanString = (obj: any, key1: string, key2?: string): string => {
    const value = obj[key1] ?? (key2 ? obj[key2] : undefined);
    return String(value || '').trim();
}


export const useGoogleSheetData = () => {
  const [initialData, setInitialData] = useState<AllData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<DiagnosticInfo>({
      connectionStatus: 'En cours',
      rawKeysFound: [],
      keyMapping: []
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // FIX: Made the fetch call more robust to prevent potential caching or CORS issues
      // that can lead to a "Failed to fetch" error.
      const response = await fetch(`${SCRIPT_URL}?action=readAll`, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache', // Bypass cache which might be causing issues
      });
      if (!response.ok) {
        throw new Error(`Le serveur a répondu avec le statut ${response.status}`);
      }
      const rawData = await response.json();
      if (rawData.error) {
        throw new Error(rawData.error);
      }

      console.log("Raw data received from Google Sheets:", rawData);

      const normalizedData: Partial<AllData> = {};
      const rawKeys = Object.keys(rawData);
      
      const newKeyMapping = CANONICAL_KEYS.map(canonicalKey => {
          const mappingInfo: KeyMappingInfo = { canonicalKey, status: 'Manquant', rowCount: 0 };
          
          const foundRawKey = rawKeys.find(rawKey => {
              const normalizedRawKey = rawKey.toLowerCase().replace(/_/g, '');
              const targetKey = KEY_MAPPINGS[normalizedRawKey];
              return targetKey === canonicalKey;
          });

          if (foundRawKey && Array.isArray(rawData[foundRawKey])) {
              mappingInfo.status = 'Trouvé';
              mappingInfo.rawKeyFound = foundRawKey;
              mappingInfo.rowCount = rawData[foundRawKey].length;
              
              let dataArray = rawData[foundRawKey].map(normalizeObjectKeys);
              
              if (canonicalKey === 'connexionsAC') {
                  dataArray = dataArray.map((conn: any) => {
                      const rawPower = getCleanString(conn, 'puissance-kw', 'puissance_kw') || '0';
                      let power = toNum(rawPower);
                      if (power > 100) { // If power is over 100kW, assume it was entered in Watts.
                          power = power / 1000;
                      }
                      return {
                          id: getCleanString(conn, 'id'),
                          equipment_fk: getCleanString(conn, 'equipement_fk', 'equipementfk'),
                          ac_box_fk: getCleanString(conn, 'boitier_fk', 'boitierfk'),
                          outlet_name: getCleanString(conn, 'prise_utilisee', 'priseutilisee'),
                          phase: getCleanString(conn, 'phase'),
                          voie: getCleanString(conn, 'voie'),
                          puissance_kw: String(power)
                      };
                  });
              } else if (canonicalKey === 'connexionsDC') {
                  dataArray = dataArray.map((conn: any) => {
                       const rawPower = getCleanString(conn, 'puissance-kw', 'puissance_kw') || '0';
                       let power = toNum(rawPower);
                       if (power > 100) { // If power is over 100kW, assume it was entered in Watts.
                           power = power / 1000;
                       }
                       return {
                          id: getCleanString(conn, 'id'),
                          equipment_fk: getCleanString(conn, 'equipement_fk', 'equipementfk'),
                          dc_panel_fk: getCleanString(conn, 'tableau_dc_fk', 'tableaudcfk'),
                          breaker_number: getCleanString(conn, 'numero_disjoncteur', 'numerodisjoncteur'),
                          breaker_rating_a: getCleanString(conn, 'calibre_a', 'calibrea'),
                          voie: getCleanString(conn, 'voie'),
                          puissance_kw: String(power)
                       };
                  });
              } else if (canonicalKey === 'autresConsommateurs') {
                  dataArray = dataArray.map((consumer: any) => ({
                      chaine: getCleanString(consumer, 'chaine'),
                      acp1: consumer.acp1 || '0',
                      acp2: consumer.acp2 || '0',
                      acp3: consumer.acp3 || '0',
                      dc: consumer.dc || '0',
                  }));
              }
              
              normalizedData[canonicalKey] = dataArray;
          }
          return mappingInfo;
      });

      // FIX: Ensure all canonical keys exist on the data object, even if the sheet was empty or missing.
      // This prevents sending partial data on save, which was causing other data sheets to be overwritten.
      CANONICAL_KEYS.forEach(key => {
        if (!normalizedData[key]) {
            normalizedData[key] = [];
        }
      });

      console.log("Sanitized Data (ensuring all arrays exist):", normalizedData);
      setInitialData(normalizedData as AllData);
      setDiagnosticInfo({ connectionStatus: 'Succès', rawKeysFound: rawKeys, keyMapping: newKeyMapping });

    } catch (err: any) {
      console.error("Erreur lors de la récupération des données, retour aux données de démonstration.", err);
      setError(`Erreur de connexion : ${err.message}. Utilisation des données de démonstration.`);
      setInitialData(MOCK_DATA); // Fallback to mock data
      setDiagnosticInfo(prev => ({ ...prev, connectionStatus: 'Erreur' }));
    } finally {
      setLoading(false);
    }
  }, []);

  const saveData = useCallback(async (currentData: AllData) => {
    try {
      // Create a deep copy to avoid mutating the original state
      const payloadForGoogleSheet = JSON.parse(JSON.stringify(currentData));

      // FIX: Unify AC/DC connection object shapes to prevent backend data overwriting bug.
      // By ensuring both connection types have the same set of keys, we protect against a faulty
      // backend script that might reuse headers across different sheets during the save process.

      // Transform AC Connections
      if (payloadForGoogleSheet.connexionsAC) {
        payloadForGoogleSheet.connexionsAC = payloadForGoogleSheet.connexionsAC.map((conn: ACConnection) => ({
          // Shared fields
          id: conn.id || '',
          equipement_fk: conn.equipment_fk || '',
          voie: conn.voie || '',
          puissance_kw: conn.puissance_kw || 0,
          // AC-specific fields
          boitier_fk: conn.ac_box_fk || '',
          prise_utilisee: conn.outlet_name || '',
          phase: conn.phase || '',
          // Add empty DC fields for shape consistency
          tableau_dc_fk: '',
          numero_disjoncteur: '',
          calibre_a: '',
        }));
      }
      
      // Transform DC Connections
      if (payloadForGoogleSheet.connexionsDC) {
        payloadForGoogleSheet.connexionsDC = payloadForGoogleSheet.connexionsDC.map((conn: DCConnection) => ({
          // Shared fields
          id: conn.id || '',
          equipement_fk: conn.equipment_fk || '',
          voie: conn.voie || '',
          puissance_kw: conn.puissance_kw || 0,
          // DC-specific fields
          tableau_dc_fk: conn.dc_panel_fk || '',
          numero_disjoncteur: conn.breaker_number || '',
          calibre_a: conn.breaker_rating_a || '',
          // Add empty AC fields for shape consistency
          boitier_fk: '',
          prise_utilisee: '',
          phase: '',
        }));
      }


      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'writeAll', payload: payloadForGoogleSheet }),
      });
      
      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }
      console.log("Save successful:", result);
    } catch (err: any) {
      console.error("Failed to save data:", err);
      alert(`Erreur lors de la sauvegarde : ${err.message}`);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { initialData, loading, error, refreshData: fetchData, saveData, diagnosticInfo };
};