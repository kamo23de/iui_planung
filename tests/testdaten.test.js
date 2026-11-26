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
  assert.deepEqual(count, {E: 14, W: 30, I: 79});
  const checks = new Set(S.issues.filter(i => i.sev === 'E').map(i => i.check));
  for (const c of ['Personalnummer mehrfach vergeben', 'Datum nicht lesbar', 'Beginn nach Vertragsende', 'Wert außerhalb des Bereichs',
    'Zahl nicht lesbar', 'Pflichtfeld leer', 'Befristet ohne Vertragsende', 'Doppelte Zeile', 'Vertretung: vertretene Person nicht gefunden',
    'Studierende: CNW fehlt/unlesbar']) assert.ok(checks.has(c), c);
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
  const {get} = load();
  const c = get('capStats')(get('used')());
  assert.deepEqual({sws: c.sws, P: c.P, L: c.L, W: c.W, teach: c.teach, support: c.support}, {sws: 1285.5, P: 994.5, L: 215, W: 76, teach: 89, support: 66});
});
