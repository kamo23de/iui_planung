// Gesamtlauf mit der Testdatei testdaten/Testdaten_Personalplanung.xlsx (Stichtag fest: 26.11.2026).
// Die Kennzahlen sind als Referenz festgehalten: Ändert sich eine Zahl, ist das entweder ein Fehler
// oder eine gewollte Regeländerung – dann die Referenz hier bewusst anpassen.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {loadApp, root} = require('./load-app');

function load() {
  const get = loadApp(), S = get('S');
  S.today = get('toDay')(2026, 11, 26);
  get('readWorkbook')(fs.readFileSync(path.join(root, 'testdaten/Testdaten_Personalplanung.xlsx')), 'Testdaten');
  get('runChecks')();
  return {get, S};
}

test('Testdatei wird vollständig eingelesen', () => {
  const {S} = load();
  assert.equal(S.recs.length, 184);
  assert.equal(S.students.length, 9);
  assert.equal(S.missingCols.length, 0);
});

test('Absichtlich eingebaute Fehler werden gefunden', () => {
  const {S} = load();
  const count = {E: 0, W: 0, I: 0}; S.issues.forEach(i => count[i.sev]++);
  assert.deepEqual(count, {E: 21, W: 44, I: 89});
  const checks = new Set(S.issues.filter(i => i.sev === 'E').map(i => i.check));
  for (const c of ['Personalnummer mehrfach vergeben', 'Datum nicht lesbar', 'Beginn nach Vertragsende', 'Wert außerhalb des Bereichs',
    'Zahl nicht lesbar', 'Pflichtfeld leer', 'Befristet ohne Vertragsende', 'Doppelte Zeile', 'Vertretung: vertretene Person nicht gefunden',
    'Studierende: CNW fehlt/unlesbar', 'LVVO-Gruppe nicht erkannt', 'Ermäßigung: Person nicht gefunden', 'Ermäßigung ohne Umfang',
    'Ermäßigung: von nach bis', 'Lehre: Person nicht gefunden', 'Lehre: Semester nicht erkannt', 'Lehre: Umfang fehlt']) assert.ok(checks.has(c), c);
});

test('Referenzwerte Bestand heute und zum SS 2029', () => {
  const {get, S} = load(), snap = get('snapshot'), ss29 = get('toDay')(2029, 3, 1);
  S.measure = 'koepfe';
  assert.equal(snap(S.today).total, 156);
  assert.equal(snap(ss29).total, 132);
  S.measure = 'vzae';
  assert.equal(snap(S.today).total, 134.45);
  assert.equal(snap(ss29).total, 115.95);
  S.refill = true;
  assert.equal(snap(ss29).total, 129.2);
});

test('Referenzwerte Lehrangebot heute', () => {
  const {get, S} = load();
  const c = get('capStats')(get('used')(), S.today);
  assert.deepEqual({sws: c.sws, P: c.P, L: c.L, W: c.W, teach: c.teach, support: c.support}, {sws: 1258.34, P: 968.34, L: 217, W: 73, teach: 91, support: 64});
});

test('Referenzwerte Lehrverpflichtung nach LVVO heute', () => {
  const {get, S} = load();
  const st = get('lvvoStats')(get('used')().filter(r => get('inContract')(r, S.today)), S.today);
  assert.deepEqual({regel: st.regel, erm: st.erm, ermP9: st.ermP9, soll: st.soll, wimi: st.wimi, lehre: st.lehre, p9Quote: st.p9Quote},
    {regel: 1261, erm: 29.16, ermP9: 24, soll: 1231.84, wimi: 73, lehre: 1304.84, p9Quote: 1.9});
  assert.equal(S.reductions.length, 14);
});

test('Referenzwerte gehaltene Lehre und Zeitkonto (WS 2026/27)', () => {
  const {get, S} = load();
  assert.equal(S.teaching.length, 299);
  assert.equal(S.teaching.filter(t => t.ok).length, 297);   // lesbar; die unbekannte Personalnummer wird keiner Person zugeordnet
  const st = get('lehreStats')(get('used')(), get('semIdx')(S.today));
  assert.deepEqual({n: st.n, soll: st.soll, ist: st.ist, saldo: st.saldo, guthaben: st.guthaben, fehlbetrag: st.fehlbetrag, verfallen: st.verfallen},
    {n: 12, soll: 194, ist: 204, saldo: 10, guthaben: 42, fehlbetrag: -45.5, verfallen: 14});
});
