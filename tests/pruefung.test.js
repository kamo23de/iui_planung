// Datenprüfung (runChecks): ausgewählte Regeln
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {setup, HEADER} = require('./helpers');

const has = (issues, check, sev) => issues.some(i => i.check === check && (!sev || i.sev === sev));

test('Fehlerfreier Datensatz erzeugt keine Fehler und Warnungen', () => {
  const {S} = setup([{pnr: 1, deputat: 4}], {students: [{sg: 'Informatik B.Sc.', cluster: 'Informatik', cnw: 6.4, pl: 90, n: 800}]});
  const ew = S.issues.filter(i => i.sev !== 'I');
  assert.deepEqual([...ew.map(i => `${i.check}: ${i.msg}`)], []);
});

test('Fehlende Pflichtspalte ist ein Fehler, fehlende optionale Spalte nicht', () => {
  const {S} = setup([{pnr: 1}], {header: HEADER.filter(h => h !== 'Cluster' && h !== 'ruht bis')});
  assert.ok(S.issues.some(i => i.check === 'Spalte fehlt' && i.field === 'Cluster' && i.sev === 'E'));
  assert.ok(!S.issues.some(i => i.check === 'Spalte fehlt' && i.field === 'ruht bis'));
});

test('Exakt doppelte Zeile: Fehler und wird nur einmal gezählt (abschaltbar)', () => {
  const row = {pnr: 7, name: 'Doppelt'};
  let t = setup([row, row]);
  assert.ok(has(t.S.issues, 'Doppelte Zeile', 'E'));
  assert.equal(t.S.recs.filter(r => r.excluded).length, 1);
  t = setup([row, row], {excludeDup: false});
  assert.equal(t.S.recs.filter(r => r.excluded).length, 0);
});

test('Personalnummern: mehrfach vergeben, mehr als 1,0 VZÄ, mehrere Verträge', () => {
  let {issues} = setup([{pnr: 1, name: 'A'}, {pnr: 1, name: 'B'}]);
  assert.ok(has(issues(1), 'Personalnummer mehrfach vergeben', 'E'));
  ({issues} = setup([{pnr: 2, vz: 0.75, arb: 75}, {pnr: 2, vz: 0.5, arb: 50, beginn: '01.06.2025'}]));
  assert.ok(has(issues(2), 'Mehr als 1,0 VZÄ je Person', 'E'));
  ({issues} = setup([{pnr: 3, vz: 0.5, arb: 50}, {pnr: 3, vz: 0.5, arb: 50}].map((p, i) => ({...p, labor: 'L' + i}))));
  assert.ok(has(issues(3), 'Mehrere Verträge je Person', 'I'));
});

test('Vertrags- und Datumsfehler', () => {
  const {issues} = setup([
    {pnr: 1, beginn: '01.01.2028', ende: '31.12.2027'},
    {pnr: 2, vart: 'befristet', ende: null},
    {pnr: 3, ende: '31.02.2027'},
    {pnr: 4, vz: 1.2, arb: 120},
    {pnr: 5, vz: 0.5, arb: 100},
    {pnr: 6, kw: 'vielleicht'},
  ]);
  assert.ok(has(issues(1), 'Beginn nach Vertragsende', 'E'));
  assert.ok(has(issues(2), 'Befristet ohne Vertragsende', 'E'));
  assert.ok(has(issues(3), 'Datum nicht lesbar', 'E'));
  assert.ok(has(issues(4), 'Wert außerhalb des Bereichs', 'E'));
  assert.ok(has(issues(5), 'VZÄ passt nicht zu ArbAnteil', 'W'));
  assert.ok(has(issues(6), 'kw-Wert unklar', 'W'));
});

test('Tarifgruppe passt nicht zum Mitarbeiterkreis', () => {
  const {issues} = setup([{pnr: 1, kreis: 'Professor/in', tarif: 'E13'}, {pnr: 2, tarif: 'W2'}]);
  assert.ok(has(issues(1), 'Tarifgruppe passt nicht zum Mitarbeiterkreis', 'W'));
  assert.ok(has(issues(2), 'Tarifgruppe passt nicht zum Mitarbeiterkreis', 'W'));
});

test('Möglicher Tippfehler bei Clusternamen', () => {
  const {issues} = setup([{pnr: 1}, {pnr: 2}, {pnr: 3, cluster: 'Informatk'}]);
  assert.ok(has(issues(3), 'Möglicher Tippfehler', 'W'));
  assert.ok(!has(issues(1), 'Möglicher Tippfehler'));
});

test('Vertretungen: unbekannte Nummer, nicht ruhend, Lücke, passend', () => {
  const {issues} = setup([
    {pnr: 10, vart: 'unbefristet', ende: null, ruht: '31.03.2027'},
    {pnr: 11, vertretung: '10', beginn: '01.04.2026', ende: '31.03.2027'},     // passt
    {pnr: 12, vertretung: '10', beginn: '01.04.2026', ende: '31.01.2027'},     // Lücke
    {pnr: 13, vertretung: '999'},                                              // unbekannt
    {pnr: 20, vart: 'unbefristet', ende: null},
    {pnr: 21, vertretung: '20'},                                               // vertretene Person ruht nicht
    {pnr: 22, vertretung: '22'},
  ]);
  assert.ok(has(issues(11), 'Vertretung: Dauer passt zur Ruhe', 'I'));
  assert.ok(has(issues(12), 'Vertretung: Dauer passt nicht zur Ruhe', 'W'));
  assert.ok(has(issues(13), 'Vertretung: vertretene Person nicht gefunden', 'E'));
  assert.ok(has(issues(21), 'Vertretung: vertretene Person ruht nicht', 'W'));
  assert.ok(has(issues(22), 'Vertretung: ungültige Angabe', 'E'));
});

test('Ruheanteil: ohne „ruht bis“, größer als die Stelle', () => {
  const {issues} = setup([
    {pnr: 1, ruheanteil: 0.5},
    {pnr: 2, vz: 0.5, arb: 50, ruht: '31.03.2027', ruheanteil: 0.8},
  ]);
  assert.ok(has(issues(1), 'Ruheanteil ohne „ruht bis“', 'W'));
  assert.ok(has(issues(2), 'Ruheanteil größer als Stelle', 'W'));
});

test('Deputat: unlesbar, negativ, unplausibel hoch, Professur mit Deputat 0', () => {
  const {issues} = setup([
    {pnr: 1, deputat: 'n.n.'},
    {pnr: 2, deputat: -4},
    {pnr: 3, deputat: 40},
    {pnr: 4, kreis: 'Professor/in', tarif: 'W2', vart: 'unbefristet', ende: null, deputat: 0},
    {pnr: 5, kreis: 'Verwaltung', tarif: 'E9', deputat: 2},
  ]);
  assert.ok(issues(1).some(i => i.field === 'Deputat' && i.check === 'Zahl nicht lesbar'));
  assert.ok(issues(2).some(i => i.field === 'Deputat' && i.check === 'Wert außerhalb des Bereichs'));
  assert.ok(has(issues(3), 'Deputat unplausibel', 'W'));
  assert.ok(has(issues(4), 'Deputat weicht von LVVO ab', 'W'));   // 0 statt 18 LVS
  assert.ok(has(issues(5), 'Deputat bei sonstigem Personal', 'I'));
});

test('Deputat optional: leer bei Professur und LfbA ohne Befund, bei WiMi Warnung, fehlende Spalte nur Hinweis', () => {
  const PROF = {kreis: 'Professor/in', tarif: 'W2', vart: 'unbefristet', ende: null};
  const {issues, S} = setup([
    {pnr: 1, ...PROF, deputat: null},
    {pnr: 2, kreis: 'Lehrkraft für besondere Aufgaben', tarif: 'E13', vart: 'unbefristet', ende: null, deputat: null},
    {pnr: 3, deputat: null},          // WiMi ohne Deputat
    {pnr: 4, deputat: 0},             // WiMi nur unterstützend
    {pnr: 5, kreis: 'Verwaltung', tarif: 'E9', deputat: null},
  ]);
  for (const p of [1, 2, 4, 5]) assert.ok(!issues(p).some(i => i.field === 'Deputat'), 'Pnr ' + p);
  assert.ok(has(issues(3), 'WiMi ohne Deputat', 'W'));
  assert.ok(!S.issues.some(i => i.check === 'Spalte fehlt'));
  const ohne = setup([{pnr: 1, ...PROF}, {pnr: 2}], {header: HEADER.filter(h => h !== 'Deputat')});
  assert.ok(!ohne.S.issues.some(i => i.check === 'Spalte fehlt'));
  assert.ok(has(ohne.S.issues, 'Spalte Deputat fehlt', 'I'));
  assert.ok(!has(ohne.S.issues, 'WiMi ohne Deputat'));   // ohne Spalte keine Einzelmeldungen
  assert.equal(ohne.get('capStats')(ohne.S.recs, ohne.S.today).sws, 18);   // Professur nach LVVO, WiMi mit 0
});

test('Studierendenblatt: CNW und Studienplätze werden geprüft', () => {
  const {S} = setup([{pnr: 1}], {students: [
    {sg: 'A', cluster: 'Informatik', cnw: null, pl: 30, n: 10},
    {sg: 'B', cluster: 'Informatik', cnw: 6, pl: 2.5, n: 10},
    {sg: 'C', cluster: 'Mechatronik', cnw: 6, pl: 30, n: 10},
  ]});
  const by = sg => S.issues.filter(i => i.person === sg).map(i => i.check);
  assert.ok(by('A').includes('Studierende: CNW fehlt/unlesbar'));
  assert.ok(by('B').includes('Studierende: Wert unplausibel'));
  assert.ok(by('C').includes('Cluster ohne Personal'));
});

test('Sortierung: Fehler vor Warnungen vor Hinweisen', () => {
  const {S} = setup([{pnr: 1, kw: 'vielleicht'}, {pnr: 2, ende: '31.02.2027'}, {pnr: 3, beginn: '01.01.2027'}]);
  const ord = {E: 0, W: 1, I: 2}, seq = [...S.issues.map(i => ord[i.sev])];
  assert.deepEqual(seq, [...seq].sort((a, b) => a - b));
});
