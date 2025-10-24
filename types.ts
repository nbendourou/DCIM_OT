// All type definitions for the DCIM application.

export interface Rack {
  id: string;
  designation: string;
  salle: string;
  rangee: string;
  numero_baie: number | string;
  dimensions: string;
  poids_max_kg: number | string;
  puissance_pdu_kw: number | string;
  conso_baie_v1_ph1_kw: number | string;
  conso_baie_v1_ph2_kw: number | string;
  conso_baie_v1_ph3_kw: number | string;
  conso_baie_v1_dc_kw: number | string;
  conso_baie_v2_ph1_kw: number | string;
  conso_baie_v2_ph2_kw: number | string;
  conso_baie_v2_ph3_kw: number | string;
  conso_baie_v2_dc_kw: number | string;
  ac_box_id_v1?: string;
  ac_outlet_v1?: string;
  ac_box_id_v2?: string;
  ac_outlet_v2?: string;
  dc_panel_id_v1?: string;
  dc_breaker_v1?: string | number;
  dc_panel_id_v2?: string;
  dc_breaker_v2?: string | number;

  // Real power consumption fields
  conso_reelle_v1_ph1_kw?: number | string;
  conso_reelle_v1_ph2_kw?: number | string;
  conso_reelle_v1_ph3_kw?: number | string;
  conso_reelle_v2_ph1_kw?: number | string;
  conso_reelle_v2_ph2_kw?: number | string;
  conso_reelle_v2_ph3_kw?: number | string;
  conso_reelle_v1_dc_kw?: number | string;
  conso_reelle_v2_dc_kw?: number | string;
}

export interface Equipment {
  id: string;
  rack_fk: string;
  nom_equipement: string;
  type_equipement: string;
  type_alimentation: 'AC' | 'DC' | 'AC/DC';
  u_position: number | string;
  hauteur_u: number | string;
  poids_kg: number | string;
  numero_serie: string;
  statut: string;
}

export interface ACBox {
  id: string;
  canalis: string;
  salle: string;
  configuration: string;
  rangee: string;
}

export interface DCPanel {
  id: string;
  salle: string;
  designation: string;
  capacite_a: number | string;
  nombre_disjoncteurs_total: number | string;
  capacite_disjoncteurs: string;
  chaine: string;
}

export interface ACConnection {
  id: string;
  equipment_fk: string;
  ac_box_fk: string;
  outlet_name: string;
  phase: 'P1' | 'P2' | 'P3' | 'P123';
  voie: '1' | '2';
  puissance_kw?: number | string;
}

export interface DCConnection {
  id: string;
  equipment_fk: string;
  dc_panel_fk: string;
  breaker_number: number | string;
  breaker_rating_a: number | string;
  voie: '1' | '2';
  puissance_kw: number | string;
}

export interface OtherConsumer {
  chaine: 'A' | 'B' | 'C';
  acp1: number | string;
  acp2: number | string;
  acp3: number | string;
  dc: number | string;
}

export interface AllData {
  racks: Rack[];
  equipements: Equipment[];
  boitiersAC: ACBox[];
  tableauxDC: DCPanel[];
  connexionsAC: ACConnection[];
  connexionsDC: DCConnection[];
  autresConsommateurs: OtherConsumer[];
  portsAlimentation: any[];
  cablageAlimentation: any[];
}

export interface Capacities {
    upsChainA_kW: number;
    upsChainB_kW: number;
    upsChainC_kW: number;
    rowAC_kW: number;
    rowDC_kW: number;
    roomITN1_kW: number;
    roomITN2_kW: number;
    roomITN3_kW: number;
}

export type View = 'dashboard' | 'rooms' | 'capacity' | 'reporting' | 'settings';

export interface KeyMappingInfo {
  canonicalKey: keyof AllData;
  status: 'Trouvé' | 'Manquant';
  rawKeyFound?: string;
  rowCount: number;
}

export interface DiagnosticInfo {
  connectionStatus: 'En cours' | 'Succès' | 'Erreur';
  rawKeysFound: string[];
  keyMapping: KeyMappingInfo[];
}

export interface RackUtilization {
  totalPower: number;
  capacity: number;
  percentage: number;
}

export interface DCPanelUtilization {
  usedBreakers: number;
  totalBreakers: number;
  percentage: number;
}

export interface ACBoxUtilization {
  usedOutlets: number;
  totalOutlets: number;
  percentage: number;
}

export interface ChainLoad {
    it_p1: number;
    it_p2: number;
    it_p3: number;
    it_dc: number;
    other_p1: number;
    other_p2: number;
    other_p3: number;
    other_dc: number;
    transferred_p1: number;
    transferred_p2: number;
    transferred_p3: number;
    transferred_dc: number;
    final_p1: number;
    final_p2: number;
    final_p3: number;
}

export interface RackPowerAnomaly {
    powerDifferenceKw: number;
    powerDifferencePercent: number;
    isOverPower: boolean;
    imbalanceV1: number;
    imbalanceV2: number;
    hasImbalance: boolean;
    hasAnomaly: boolean;
    totalReal: number;
    totalCalculated: number;
}
