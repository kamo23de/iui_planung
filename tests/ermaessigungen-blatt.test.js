// Erkennung des Blatts „Ermäßigungen“ in echten Tabellen: Überschriften, Kopfzeilen, Blattreihenfolge, Personalnummern
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const {loadApp, root} = require('./load-app');
const VARIANTEN = require('./fixtures-erm');

const base = XLSX.read(fs.readFileSync(path.join(root, 'testdaten/Testdaten_Personalplanung.xlsx')));
const P1 = String(XLSX.utils.sheet_to_json(base.Sheets.Personal, {header: 1, raw: true})[5][0]);

/** Arbeitsmappe aus Personal- und Studierendenblatt der Testdatei und einem zusätzlichen Blatt lesen. */
function lies(sn, rows, {placeFirst = false} = {}) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.map(c => typeof c === 'string' ? c.replace('{P1}', P1) : c)));
  if (placeFirst) XLSX.utils.book_append_sheet(wb, ws, sn);
  XLSX.utils.book_append_sheet(wb, base.Sheets.Personal, 'Personal');
  XLSX.utils.book_append_sheet(wb, base.Sheets.Studierende, 'Studierende');
  if (!placeFirst) XLSX.utils.book_append_sheet(wb, ws, sn);
  const get = loadApp(), S = get('S');
  S.today = get('toDay')(2026, 11, 26);
  get('readWorkbook')(XLSX.write(wb, {type: 'array', bookType: 'xlsx'}), 'test.xlsx');
  get('runChecks')();
  return {get, S};
}

for (const v of VARIANTEN) {
  test(`Variante: ${v.name}`, () => {
    const {get, S} = lies(v.sn, v.rows, v);
    assert.equal(S.raw.pers.sn, 'Personal', 'Personalblatt');
    assert.ok(S.raw.erm, 'Blatt „Ermäßigungen“ nicht erkannt');
    assert.equal(S.raw.erm.sn, v.sn);
    assert.equal(S.reductions.length, v.n);
    const r = S.recs.find(x => x.pnr === P1);
    assert.equal(get('ermaessigungenAm')(r, S.today).length, 1, 'Ermäßigung nicht der Person zugeordnet');
    assert.ok(!S.issues.some(i => i.check === 'Ermäßigung: Person nicht gefunden'));
  });
}

test('Personalnummern: führende Nullen, Leerzeichen und „.0“ sind dieselbe Nummer', () => {
  const k = loadApp()('pnrKey');
  assert.equal(k('00123'), '123');
  assert.equal(k(123), '123');
  assert.equal(k(' 123 '), '123');
  assert.equal(k('123.0'), '123');
  assert.equal(k('0'), '0');
  assert.equal(k('AB-12'), 'ab-12');
});

test('Nicht erkanntes Blatt mit passendem Namen wird gemeldet, mit gelesenen Überschriften', () => {
  const {S} = lies('Ermäßigungen', [['Name', 'Vorname', 'Grund', 'LVS'], ['X', 'Y', 'Forschung', 2]]);
  assert.equal(S.raw.erm, null);
  const w = S.issues.find(i => i.check === 'Blatt nicht erkannt');
  assert.ok(w, 'keine Warnung');
  assert.equal(w.sev, 'W');
  assert.match(w.msg, /Personalnummer/);
  assert.match(w.msg, /„Grund“, „LVS“/);
});

test('Anderes Blatt ohne Zuordnung: Hinweis', () => {
  const {S} = lies('Notizen', [['Thema', 'Bemerkung'], ['a', 'b']]);
  assert.ok(S.issues.some(i => i.check === 'Blatt nicht ausgewertet' && i.sev === 'I' && /Notizen/.test(i.msg)));
});

test('Blatt „Ermäßigungen“ ohne Spalte für den Umfang: Fehler', () => {
  const {S} = lies('Ermäßigungen', [['Personalnummer', 'Grund'], ['{P1}', 'Forschung']]);
  assert.ok(S.raw.erm);
  assert.ok(S.issues.some(i => i.check === 'Spalte fehlt' && i.field === 'LVS/Prozent' && i.sev === 'E'));
});

test('„Ermäßigung“ als Überschrift: Inhalt entscheidet zwischen Grund und Umfang', () => {
  let {S} = lies('Tabelle3', [['Personalnummer', 'Grund', 'Ermäßigung'], ['{P1}', 'Forschung', 4]]);
  assert.deepEqual({...S.raw.erm.map}, {pnr: 0, grund: 1, lvs: 2});
  ({S} = lies('Tabelle3', [['Personalnummer', 'Ermäßigung', 'LVS'], ['{P1}', 'Forschung', 4]]));
  assert.deepEqual({...S.raw.erm.map}, {pnr: 0, lvs: 2, grund: 1});
});

test('Testdatei: alle Blätter erkannt, keine Hinweise zu Blättern', () => {
  const get = loadApp(), S = get('S');
  S.today = get('toDay')(2026, 11, 26);
  get('readWorkbook')(fs.readFileSync(path.join(root, 'testdaten/Testdaten_Personalplanung.xlsx')), 'Testdaten');
  get('runChecks')();
  assert.deepEqual([...S.raw.sheetInfo.map(s => `${s.sn}:${s.kind}`)], ['Personal:pers', 'Studierende:stud', 'Ermäßigungen:erm', 'Lehre:lehre']);
  assert.ok(!S.issues.some(i => /Blatt nicht/.test(i.check)));
});
