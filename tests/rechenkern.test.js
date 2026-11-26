// Rechenkern: aktive Verträge, Ruhen, Teilruhen, Vertretungen, Stichtagsbestand
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {setup} = require('./helpers');

const d = (get, s) => get('parseDate')(s).v;

test('Vertragslaufzeit: Beginn und Ende zählen jeweils mit', () => {
  const {get, rec} = setup([{pnr: 1, beginn: '01.03.2025', ende: '28.02.2027'}]);
  const inContract = get('inContract'), r = rec(1);
  assert.equal(inContract(r, d(get, '28.02.2025')), false);
  assert.equal(inContract(r, d(get, '01.03.2025')), true);
  assert.equal(inContract(r, d(get, '28.02.2027')), true);
  assert.equal(inContract(r, d(get, '01.03.2027')), false);
});

test('Vollständig ruhender Vertrag: bis einschließlich „ruht bis“ nicht aktiv, danach Rückkehr', () => {
  const {get, rec, S} = setup([{pnr: 1, vart: 'unbefristet', ende: null, ruht: '31.03.2027', deputat: 18, kreis: 'Professor/in', tarif: 'W2'}]);
  const r = rec(1), T = S.today, end = d(get, '31.03.2027'), after = d(get, '01.04.2027');
  assert.equal(get('isResting')(r, T), true);
  assert.equal(get('isActive')(r, T), false);
  assert.equal(get('isActive')(r, end), false);
  assert.equal(get('isActive')(r, after), true);
  assert.equal(get('effVz')(r, T), 0);
  assert.equal(get('effDep')(r, T), 0);
  assert.equal(get('effDep')(r, after), 18);
  assert.equal(get('returnsBetween')(r, T, after), true);
  assert.equal(get('returnsBetween')(r, T, end), false);
});

test('Teilweise ruhender Vertrag: nur der nicht ruhende Anteil zählt (VZÄ und Deputat), nach Köpfen voll', () => {
  const {get, rec, S} = setup([{pnr: 1, kreis: 'Professor/in', tarif: 'W2', vart: 'unbefristet', ende: null, ruht: '31.03.2027', ruheanteil: 0.5, deputat: 18}]);
  const r = rec(1), T = S.today;
  assert.equal(get('isPartlyResting')(r, T), true);
  assert.equal(get('isActive')(r, T), true);
  assert.equal(get('activeShare')(r, T), 0.5);
  assert.equal(get('effVz')(r, T), 0.5);
  assert.equal(get('restVz')(r, T), 0.5);
  assert.equal(get('effDep')(r, T), 9);
  S.measure = 'koepfe'; assert.equal(get('valAt')(r, T), 1);
  S.measure = 'vzae'; assert.equal(get('valAt')(r, T), 0.5);
});

test('Teilruhen bei Teilzeit: Ruheanteil bezieht sich auf VZÄ, nicht auf den Vertragsanteil', () => {
  const {get, rec, S} = setup([{pnr: 1, arb: 50, vz: 0.5, ruht: '31.03.2027', ruheanteil: 0.25, deputat: 9}]);
  const r = rec(1);
  assert.equal(get('restShare')(r), 0.5);
  assert.equal(get('effVz')(r, S.today), 0.25);
  assert.equal(get('effDep')(r, S.today), 4.5);
});

test('Ruheanteil größer als der Vertrag: ganze Stelle ruht', () => {
  const {get, rec, S} = setup([{pnr: 1, vz: 0.5, arb: 50, ruht: '31.03.2027', ruheanteil: 0.8}]);
  assert.equal(get('isResting')(rec(1), S.today), true);
});

test('Stichtagsbestand (snapshot) nach Köpfen und VZÄ, je Cluster und Mitarbeiterkreis', () => {
  const {get, S} = setup([
    {pnr: 1, cluster: 'Informatik', vz: 1, arb: 100},
    {pnr: 2, cluster: 'Informatik', vz: 0.5, arb: 50},
    {pnr: 3, cluster: 'Elektrotechnik', vz: 1, arb: 100, kreis: 'Professor/in', tarif: 'W2', vart: 'unbefristet', ende: null},
    {pnr: 4, cluster: 'Elektrotechnik', vz: 1, arb: 100, ruht: '31.03.2027'},              // ruht
    {pnr: 5, cluster: 'Elektrotechnik', vz: 1, arb: 100, ende: '30.06.2026'},              // ausgelaufen
    {pnr: 6, cluster: 'Elektrotechnik', vz: 1, arb: 100, beginn: '01.01.2027'},            // beginnt künftig
  ]);
  const snap = get('snapshot');
  S.measure = 'koepfe';
  let s = snap(S.today);
  assert.equal(s.total, 3);
  assert.equal(s.byCluster.Informatik.b, 2);
  assert.equal(s.byCluster.Elektrotechnik.b, 1);
  S.measure = 'vzae';
  s = snap(S.today);
  assert.equal(s.total, 2.5);
  assert.equal(s.byKreis['Wiss. Mitarbeiter/in'].b, 1.5);
  assert.equal(snap(S.today, 'Informatik').total, 1.5);
  assert.equal(snap(d(get, '01.04.2027')).total, 4.5);   // Rückkehr und künftiger Beginn
});

test('Offene Stellen: nur bei eingeschaltetem Schalter, nicht bei kw und nicht bei Vertretungen', () => {
  const {get, S} = setup([
    {pnr: 1, ende: '31.12.2026'},
    {pnr: 2, ende: '31.12.2026', kw: 'x'},
    {pnr: 3, vart: 'unbefristet', ende: null, ruht: '31.12.2026'},
    {pnr: 4, ende: '31.12.2026', vertretung: '3'},
  ]);
  const later = d(get, '01.03.2027');
  S.measure = 'koepfe';
  S.refill = false;
  assert.equal(get('snapshot')(later).total, 1);           // nur die Rückkehr von Pnr 3
  S.refill = true;
  const s = get('snapshot')(later);
  assert.equal(s.v, 1);                                    // nur Pnr 1 wird als offene Stelle weitergeführt
  assert.equal(s.b, 1);
  assert.equal(get('status')(S.recs.find(r => r.pnr === '4'), later), null);
  assert.equal(get('status')(S.recs.find(r => r.pnr === '1'), S.today), 'b');   // offene Stellen nur in der Zukunft
});

test('Vertragsstatus für die Detailliste', () => {
  const {get, rec} = setup([
    {pnr: 1, ende: '31.12.2030'}, {pnr: 2, ende: '31.03.2027'}, {pnr: 3, ende: '31.03.2026'},
    {pnr: 4, beginn: '01.01.2027'}, {pnr: 5, ruht: '31.03.2027'}, {pnr: 6, beginn: '01.01.2028', ende: '31.12.2027'},
    {pnr: 7, vart: 'unbefristet', ende: null, ruhestand: '31.07.2027'},
  ]);
  const st = p => get('contractStatus')(rec(p)).txt;
  assert.equal(st(1), 'aktiv');
  assert.match(st(2), /^aktiv, endet/);
  assert.equal(st(3), 'ausgelaufen');
  assert.equal(st(4), 'beginnt künftig');
  assert.equal(st(5), 'ruht bis 31.03.2027');
  assert.equal(st(6), 'ungültig');
  assert.equal(st(7), 'aktiv, Ruhestand in 12 Monaten');
});
