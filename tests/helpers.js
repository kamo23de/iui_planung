// Gemeinsame Hilfen für die Tests: Personaltabelle aus Objekten aufbauen und wie beim Einlesen verarbeiten.
'use strict';
const {loadApp} = require('./load-app');

const HEADER = ['Personalnummer', 'Name', 'Vorname', 'Mitarbeiterkreis', 'ArbAnteil', 'VZÄ', 'TrfGr', 'Vertragsart', 'Beginn', 'Vertragsende',
  'kw', 'Cluster', 'Organisationseinheit', 'Laborbereich', 'Deputat', 'ruht bis', 'Ruheanteil', 'Ruhestand', 'Vertretung für', 'LVVO-Gruppe'];
const KEY = {pnr: 'Personalnummer', name: 'Name', vorname: 'Vorname', kreis: 'Mitarbeiterkreis', arb: 'ArbAnteil', vz: 'VZÄ', tarif: 'TrfGr',
  vart: 'Vertragsart', beginn: 'Beginn', ende: 'Vertragsende', kw: 'kw', cluster: 'Cluster', oe: 'Organisationseinheit', labor: 'Laborbereich',
  deputat: 'Deputat', ruht: 'ruht bis', ruheanteil: 'Ruheanteil', ruhestand: 'Ruhestand', vertretung: 'Vertretung für', lvvo: 'LVVO-Gruppe'};

// Grundwerte einer unauffälligen Person; einzelne Tests überschreiben nur, was sie brauchen.
const BASE = {name: 'Muster', vorname: 'Max', kreis: 'Wiss. Mitarbeiter/in', arb: 100, vz: 1, tarif: 'E13', vart: 'befristet',
  beginn: '01.01.2024', ende: '31.12.2027', kw: '', cluster: 'Informatik', oe: 'OE A', labor: 'Labor 1'};

let seq = 1000;
/** Lädt die App, baut eine Personaltabelle aus `people` (Objekte mit Kurznamen wie oben) und
 *  führt Einlesen und Datenprüfung aus. reductions: Zeilen des Blatts „Ermäßigungen“ als Objekte
 *  {pnr, grund, lvs, pct, von, bis}. Rückgabe: {get, S, rec(pnr), issues(pnr?)}. */
function setup(people, {today = '26.11.2026', students = null, reductions = null, header = HEADER, excludeDup = true} = {}) {
  const get = loadApp();
  const rows = [header].concat(people.map(p => {
    const o = Object.assign({pnr: String(seq++)}, BASE, p);
    return header.map(h => { const k = Object.keys(KEY).find(x => KEY[x] === h); return k in o ? o[k] : null; });
  }));
  const map = get('mapHeaders')(rows[0], get('FIELDS'));
  let stud = null;
  if (students) {
    const srows = [['Studiengang', 'Cluster', 'Art', 'CNW', 'Studienplätze', 'Studierende']].concat(students.map(s => [s.sg, s.cluster, s.art ?? 'Bachelor', s.cnw ?? null, s.pl ?? null, s.n]));
    stud = {sn: 'Studierende', rows: srows, headerRow: 0, map: get('mapHeaders')(srows[0], get('STUD_FIELDS'))};
  }
  let erm = null;
  if (reductions) {
    const erows = [['Personalnummer', 'Grund', 'LVS', 'Prozent', 'von', 'bis']].concat(reductions.map(e => [e.pnr == null ? null : String(e.pnr), e.grund ?? null, e.lvs ?? null, e.pct ?? null, e.von ?? null, e.bis ?? null]));
    erm = {sn: 'Ermäßigungen', rows: erows, headerRow: 0, map: get('mapHeaders')(erows[0], get('ERM_FIELDS'))};
  }
  const S = get('S');
  S.today = get('parseDate')(today).v;
  S.excludeDup = excludeDup;
  S.raw = {fileName: 'test.xlsx', pers: {sn: 'Personal', rows, headerRow: 0, map}, stud, erm, sheetNames: ['Personal']};
  get('buildRecords')();
  get('runChecks')();
  const rec = pnr => { const r = S.recs.find(x => x.pnr === String(pnr)); if (!r) throw new Error('Kein Datensatz ' + pnr); return r; };
  const issues = pnr => S.issues.filter(i => pnr == null || i.pnr === String(pnr));
  return {get, S, rec, issues};
}

module.exports = {setup, HEADER};
