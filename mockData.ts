import type { AllData, Capacities } from './types.ts';

export const MOCK_CAPACITIES: Capacities = {
    upsChainA_kW: 333,
    upsChainB_kW: 333,
    upsChainC_kW: 333,
    rowAC_kW: 80,
    rowDC_kW: 80,
    roomITN1_kW: 500,
    roomITN2_kW: 500,
    roomITN3_kW: 500,
};

export const MOCK_DATA: AllData = {
  racks: [
    { id: 'R1', designation: 'ITN1-A-01', salle: 'ITN1', rangee: 'A', numero_baie: 1, dimensions: '42U 600x1200', poids_max_kg: 1000, puissance_pdu_kw: 22, conso_baie_v1_ph1_kw: 1.2, conso_baie_v1_ph2_kw: 1.1, conso_baie_v1_ph3_kw: 1.3, conso_baie_v1_dc_kw: 0, conso_baie_v2_ph1_kw: 1.2, conso_baie_v2_ph2_kw: 1.1, conso_baie_v2_ph3_kw: 1.3, conso_baie_v2_dc_kw: 0, ac_box_id_v1: 'AC1', ac_outlet_v1: 'MONO 1', dc_panel_id_v2: 'IT.1-SWB.REC.B.1', dc_breaker_v2: '1' },
    { id: 'R2', designation: 'ITN1-A-02', salle: 'ITN1', rangee: 'A', numero_baie: 2, dimensions: '42U 800x1200', poids_max_kg: 1000, puissance_pdu_kw: 22, conso_baie_v1_ph1_kw: 2, conso_baie_v1_ph2_kw: 2.1, conso_baie_v1_ph3_kw: 2.3, conso_baie_v1_dc_kw: 0, conso_baie_v2_ph1_kw: 2, conso_baie_v2_ph2_kw: 2.1, conso_baie_v2_ph3_kw: 2.3, conso_baie_v2_dc_kw: 0, ac_box_id_v1: 'AC1', ac_outlet_v1: 'MONO 2' },
    { id: 'R3', designation: 'ITN1-B-01', salle: 'ITN1', rangee: 'B', numero_baie: 1, dimensions: '47U 600x1200', poids_max_kg: 1200, puissance_pdu_kw: 30, conso_baie_v1_ph1_kw: 0, conso_baie_v1_ph2_kw: 0, conso_baie_v1_ph3_kw: 0, conso_baie_v1_dc_kw: 5.5, conso_baie_v2_ph1_kw: 0, conso_baie_v2_ph2_kw: 0, conso_baie_v2_ph3_kw: 0, conso_baie_v2_dc_kw: 5.5, dc_panel_id_v1: 'IT.1-SWB.REC.A.1', dc_breaker_v1: '2' },
    { id: 'R4', designation: 'ITN2-A-01', salle: 'ITN2', rangee: 'A', numero_baie: 1, dimensions: '42U 600x1200', poids_max_kg: 1000, puissance_pdu_kw: 22, conso_baie_v1_ph1_kw: 3, conso_baie_v1_ph2_kw: 2.8, conso_baie_v1_ph3_kw: 3.1, conso_baie_v1_dc_kw: 0, conso_baie_v2_ph1_kw: 3, conso_baie_v2_ph2_kw: 2.8, conso_baie_v2_ph3_kw: 3.1, conso_baie_v2_dc_kw: 0, ac_box_id_v1: 'AC2', ac_outlet_v1: 'TRI 1' },
    { id: 'R5', designation: 'ITN2-A-02', salle: 'ITN2', rangee: 'A', numero_baie: 2, dimensions: '42U 800x1200', poids_max_kg: 1000, puissance_pdu_kw: 22, conso_baie_v1_ph1_kw: 1, conso_baie_v1_ph2_kw: 1, conso_baie_v1_ph3_kw: 1, conso_baie_v1_dc_kw: 0, conso_baie_v2_ph1_kw: 1, conso_baie_v2_ph2_kw: 1, conso_baie_v2_ph3_kw: 1, conso_baie_v2_dc_kw: 0, ac_box_id_v1: 'AC2', ac_outlet_v1: 'TRI 2' },
  ],
  equipements: [
    { id: 'EQ1', rack_fk: 'R1', nom_equipement: 'Serveur Web 01', type_equipement: 'Serveur', type_alimentation: 'AC', u_position: 5, hauteur_u: 2, poids_kg: 25, numero_serie: 'SN-WEB01', statut: 'Actif' },
    { id: 'EQ2', rack_fk: 'R1', nom_equipement: 'Switch Core 01', type_equipement: 'Switch', type_alimentation: 'AC', u_position: 40, hauteur_u: 1, poids_kg: 8, numero_serie: 'SN-SW01', statut: 'Actif' },
    { id: 'EQ3', rack_fk: 'R2', nom_equipement: 'Serveur BDD 01', type_equipement: 'Serveur', type_alimentation: 'AC', u_position: 10, hauteur_u: 2, poids_kg: 30, numero_serie: 'SN-DB01', statut: 'Actif' },
    { id: 'EQ4', rack_fk: 'R3', nom_equipement: 'Routeur Telco 01', type_equipement: 'Routeur', type_alimentation: 'DC', u_position: 20, hauteur_u: 4, poids_kg: 40, numero_serie: 'SN-RT01', statut: 'Actif' },
    { id: 'EQ5', rack_fk: 'R4', nom_equipement: 'Serveur App 01', type_equipement: 'Serveur', type_alimentation: 'AC', u_position: 5, hauteur_u: 2, poids_kg: 25, numero_serie: 'SN-APP01', statut: 'Actif' },
  ],
  boitiersAC: [
    { id: 'AC1', canalis: 'A1', salle: 'ITN1', configuration: '2TRI+3MONO', rangee: 'A' },
    { id: 'AC2', canalis: 'B1', salle: 'ITN2', configuration: '4TRI+1MONO', rangee: 'A' },
  ],
  tableauxDC: [
    { id: 'IT.1-SWB.REC.A.1', salle: 'ITN1', designation: 'TGBT-DC-01.A', capacite_a: 400, nombre_disjoncteurs_total: 24, capacite_disjoncteurs: '12x32A,12x63A', chaine: 'A' },
    { id: 'IT.1-SWB.REC.B.1', salle: 'ITN1', designation: 'TGBT-DC-01.B', capacite_a: 400, nombre_disjoncteurs_total: 24, capacite_disjoncteurs: '12x32A,12x63A', chaine: 'B' },
    { id: 'IT.2-SWB.REC.B.1', salle: 'ITN2', designation: 'TGBT-DC-02.B', capacite_a: 400, nombre_disjoncteurs_total: 24, capacite_disjoncteurs: '16x32A,8x63A', chaine: 'B' },
    { id: 'IT.2-SWB.REC.A.1', salle: 'ITN2', designation: 'TGBT-DC-02.A', capacite_a: 400, nombre_disjoncteurs_total: 24, capacite_disjoncteurs: '16x32A,8x63A', chaine: 'A' },
    { id: 'IT.2-SWB.REC.C.1', salle: 'ITN2', designation: 'TGBT-DC-02.C', capacite_a: 400, nombre_disjoncteurs_total: 24, capacite_disjoncteurs: '16x32A,8x63A', chaine: 'C' },
    { id: 'IT.2-SWB.REC.C.2', salle: 'ITN2', designation: 'TGBT-DC-02.C', capacite_a: 400, nombre_disjoncteurs_total: 24, capacite_disjoncteurs: '16x32A,8x63A', chaine: 'C' },
    { id: 'IT.2-SWB.REC.C.3', salle: 'ITN2', designation: 'TGBT-DC-02.C', capacite_a: 400, nombre_disjoncteurs_total: 24, capacite_disjoncteurs: '16x32A,8x63A', chaine: 'C' },
    { id: 'IT.2-SWB.REC.C.4', salle: 'ITN2', designation: 'TGBT-DC-02.C', capacite_a: 400, nombre_disjoncteurs_total: 24, capacite_disjoncteurs: '16x32A,8x63A', chaine: 'C' },
    { id: 'IT.2-SWB.REC.C.5', salle: 'ITN2', designation: 'TGBT-DC-02.C', capacite_a: 400, nombre_disjoncteurs_total: 24, capacite_disjoncteurs: '16x32A,8x63A', chaine: 'C' },
    { id: 'IT.2-SWB.REC.C.6', salle: 'ITN2', designation: 'TGBT-DC-02.C', capacite_a: 400, nombre_disjoncteurs_total: 24, capacite_disjoncteurs: '16x32A,8x63A', chaine: 'C' },
    { id: 'IT.2-SWB.REC.C.7', salle: 'ITN2', designation: 'TGBT-DC-02.C', capacite_a: 400, nombre_disjoncteurs_total: 24, capacite_disjoncteurs: '16x32A,8x63A', chaine: 'C' },
    { id: 'IT.2-SWB.REC.C.8', salle: 'ITN2', designation: 'TGBT-DC-02.C', capacite_a: 400, nombre_disjoncteurs_total: 24, capacite_disjoncteurs: '16x32A,8x63A', chaine: 'C' },
  ],
  connexionsAC: [
      { id: 'ACC1', equipment_fk: 'EQ1', ac_box_fk: 'AC1', outlet_name: 'MONO 1', phase: 'P1', voie: '1' },
      { id: 'ACC2', equipment_fk: 'EQ2', ac_box_fk: 'AC1', outlet_name: 'MONO 1', phase: 'P2', voie: '1' },
  ],
  connexionsDC: [
      { id: 'DCC1', equipment_fk: 'EQ4', dc_panel_fk: 'IT.1-SWB.REC.A.1', breaker_number: 5, breaker_rating_a: 32, voie: '1', puissance_kw: 2.5 },
  ],
  autresConsommateurs: [
    { chaine: 'A', acp1: 5.2, acp2: 5.3, acp3: 5.1, dc: 2.5 },
    { chaine: 'B', acp1: 8.1, acp2: 8.0, acp3: 8.2, dc: 4.0 },
    { chaine: 'C', acp1: 2.0, acp2: 2.1, acp3: 2.0, dc: 1.5 },
  ],
  portsAlimentation: [],
  cablageAlimentation: [],
};