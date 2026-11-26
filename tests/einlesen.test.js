// Einlesen: Spaltenerkennung und Aufbereitung der Personaldatensätze (buildRecords)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp} = require('./load-app');
const {setup} = require('./helpers');

test('mapHeaders: Überschriften werden unabhängig von Schreibweise und Reihenfolge erkannt', () => {
  const get = loadApp();
  const m = get('mapHeaders')(['Vertragsende', 'Pers.-Nr.', 'VZAE', 'Mitarbeitergruppe', 'Befristet bis', 'ruht bis'], get('FIELDS'));
  assert.equal(m.ende, 0);
  assert.equal(m.pnr, 1);
  assert.equal(m.vz, 2);
  assert.equal(m.kreis, 3);
  assert.equal(m.ruht, 5);
  assert.equal(m.name, undefined);
});

test('Stellenumfang: ArbAnteil als Anteil oder Prozent, VZÄ in Prozent, VZÄ aus ArbAnteil abgeleitet', () => {
  const {rec} = setup([
    {pnr: 1, arb: 0.5, vz: 0.5},
    {pnr: 2, arb: '50 %', vz: 0.5},
    {pnr: 3, arb: 75, vz: 75},
    {pnr: 4, arb: 60, vz: null},
  ]);
  assert.equal(rec(1).arb, 50);
  assert.equal(rec(2).arb, 50);
  assert.equal(rec(3).vz, 0.75); assert.equal(rec(3).vzWasPct, true);
  assert.equal(rec(4).vz, 0.6); assert.equal(rec(4).vzDerived, true);
});

test('Ruheanteil: VZÄ, Prozent oder Zahl über 1,5 werden als VZÄ gelesen', () => {
  const {rec} = setup([
    {pnr: 1, ruht: '31.03.2027', ruheanteil: 0.5},
    {pnr: 2, ruht: '31.03.2027', ruheanteil: '50%'},
    {pnr: 3, ruht: '31.03.2027', ruheanteil: 50},
  ]);
  for (const p of [1, 2, 3]) assert.equal(rec(p).ruheVz, 0.5, 'Pnr ' + p);
});

test('Vertragsart: befristet, unbefristet, unklar', () => {
  const {rec} = setup([
    {pnr: 1, vart: 'befristet'}, {pnr: 2, vart: 'unbefristet'}, {pnr: 3, vart: 'Beamtenverhältnis auf Lebenszeit'},
    {pnr: 4, vart: 'Zeitvertrag'}, {pnr: 5, vart: 'irgendwas'},
  ]);
  assert.equal(rec(1).befr, true);
  assert.equal(rec(2).befr, false);
  assert.equal(rec(3).befr, false);
  assert.equal(rec(4).befr, true);
  assert.equal(rec(5).befr, null);
  assert.equal(rec(5).fixedTerm, true);   // unklar, aber mit Vertragsende → Zeitvertrag
});

test('Maßgebliches Ende: früheres Datum aus Vertragsende und Ruhestand', () => {
  const {rec, get} = setup([
    {pnr: 1, vart: 'befristet', ende: '31.08.2028', ruhestand: '31.01.2028'},
    {pnr: 2, vart: 'befristet', ende: '31.08.2027', ruhestand: '31.01.2030'},
    {pnr: 3, vart: 'unbefristet', ende: '31.07.2031'},                 // Altbestand: Datum im Vertragsende
    {pnr: 4, vart: 'unbefristet', ende: null, ruhestand: null},
  ]);
  const toDay = get('toDay');
  assert.equal(rec(1).ende, toDay(2028, 1, 31)); assert.equal(rec(1).endType, 'Ruhestand');
  assert.equal(rec(2).ende, toDay(2027, 8, 31)); assert.equal(rec(2).endType, 'Vertragsende');
  assert.equal(rec(3).ende, toDay(2031, 7, 31)); assert.equal(rec(3).endType, 'Ruhestand');
  assert.equal(rec(3).fixedTerm, false);
  assert.equal(rec(4).ende, null);
});

test('kw-Vermerk: ja/x erkannt, unbekannte Werte markiert', () => {
  const {rec} = setup([{pnr: 1, kw: 'x'}, {pnr: 2, kw: 'Ja'}, {pnr: 3, kw: 'nein'}, {pnr: 4, kw: 'vielleicht'}, {pnr: 5, kw: ''}]);
  assert.equal(rec(1).kw, true);
  assert.equal(rec(2).kw, true);
  assert.equal(rec(3).kw, false); assert.equal(rec(3).kwUnclear, false);
  assert.equal(rec(4).kw, false); assert.equal(rec(4).kwUnclear, true);
  assert.equal(rec(5).kwUnclear, false);
});

test('Personalnummer: Excel-Zahl mit .0 wird bereinigt', () => {
  const {S} = setup([{pnr: '4711.0', vertretung: '4712.0'}]);
  assert.equal(S.recs[0].pnr, '4711');
  assert.equal(S.recs[0].vertretungFuer, '4712');
});

test('Schreibvarianten bei Cluster und Mitarbeiterkreis werden vereinheitlicht', () => {
  const {rec} = setup([{pnr: 1, cluster: 'Informatik'}, {pnr: 2, cluster: 'Informatik'}, {pnr: 3, cluster: 'informatik'}]);
  assert.equal(rec(3).cluster, 'Informatik');
  assert.equal(rec(3).clusterCase, 'informatik');
});

test('Mitarbeiterkreise werden Kategorien zugeordnet', () => {
  const get = loadApp(), g = get('guessCat');
  assert.equal(g('Professor/in'), 'Professor/in');
  assert.equal(g('W2-Professur'), 'Professor/in');
  assert.equal(g('Lehrkraft für besondere Aufgaben'), 'LfbA');
  assert.equal(g('Wiss. Mitarbeiter/in'), 'WiMi');
  assert.equal(g('Studentische Hilfskraft'), 'Sonstige');
  assert.equal(g('Verwaltung'), 'Sonstige');
});
