// Kapazität: Lehrangebot (capStats) – Quelle LVVO-Soll (Standard) oder Deputat aus der Tabelle
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {setup} = require('./helpers');

const PROF = {kreis: 'Professor/in', tarif: 'W2', vart: 'unbefristet', ende: null};
const PEOPLE = [
  {pnr: 1, ...PROF, deputat: 18},
  {pnr: 2, ...PROF, deputat: 18, ruht: '31.03.2027', ruheanteil: 0.5},   // Dekanat: halbe Stelle ruht
  {pnr: 3, ...PROF, deputat: 18, ruht: '31.03.2027'},                    // ruht ganz
  {pnr: 4, kreis: 'Lehrkraft für besondere Aufgaben', tarif: 'E13', deputat: 16},   // LVVO: 20 LVS
  {pnr: 5, deputat: 4},                                                  // WiMi: Deputat
  {pnr: 6, deputat: 0},                                                  // WiMi, nur unterstützend
  {pnr: 7, kreis: 'Verwaltung', tarif: 'E9'},                            // keine Angabe
];
const pick = c => ({P: c.P, L: c.L, W: c.W, O: c.O, sws: c.sws, year: c.year, teach: c.teach, support: c.support, none: c.none, erm: c.erm});

test('Lehrangebot nach LVVO-Soll (Standard): Professuren und LfbA mit Regellehrverpflichtung, WiMi mit Deputat', () => {
  const {get, S} = setup(PEOPLE);
  assert.deepEqual(pick(get('capStats')(S.recs, S.today)), {P: 27, L: 20, W: 4, O: 0, sws: 51, year: 102, teach: 4, support: 1, none: 2, erm: 0});
});

test('Lehrangebot nach Deputat: bisherige Rechnung', () => {
  const {get, S} = setup(PEOPLE);
  assert.deepEqual(pick(get('capStats')(S.recs, S.today, 'deputat')), {P: 27, L: 16, W: 4, O: 0, sws: 47, year: 94, teach: 4, support: 1, none: 2, erm: 0});
});

test('Lehrangebot nach LVVO: Ermäßigungen werden abgezogen', () => {
  const {get, S} = setup([{pnr: 1, ...PROF, deputat: 18}, {pnr: 2, ...PROF, deputat: 18}],
    {reductions: [{pnr: 1, grund: 'Forschung', lvs: 4}, {pnr: 2, grund: 'Laborleitung', lvs: 2, von: '01.03.2027'}]});
  const c = get('capStats')(S.recs, S.today);
  assert.equal(c.sws, 32);
  assert.equal(c.erm, 4);
  assert.equal(get('capStats')(S.recs, get('parseDate')('01.03.2027').v).sws, 30);
  assert.equal(get('capStats')(S.recs, S.today, 'deputat').sws, 36);
});

test('Lehrangebot nach Ende des Ruhens wieder voll', () => {
  const {get, S} = setup([{pnr: 1, ...PROF, deputat: 18, ruht: '31.03.2027', ruheanteil: 0.5}]);
  for (const q of ['lvvo', 'deputat']) {
    assert.equal(get('capStats')(S.recs, S.today, q).sws, 9, q);
    assert.equal(get('capStats')(S.recs, get('parseDate')('01.04.2027').v, q).sws, 18, q);
  }
  assert.equal(get('capBeitrag')(S.recs[0], S.today, 'lvvo', true), 18);   // nominal: ohne Ruhen
});

test('Unlesbares Deputat: nach LVVO zählt die Professur trotzdem, nach Deputat nicht', () => {
  const {get, S} = setup([{pnr: 1, ...PROF, deputat: 'n.n.'}, {pnr: 2, deputat: 'n.n.'}]);
  const l = get('capStats')(S.recs, S.today), d = get('capStats')(S.recs, S.today, 'deputat');
  assert.equal(l.sws, 18); assert.equal(l.none, 1);   // WiMi ohne lesbares Deputat
  assert.equal(d.sws, 0); assert.equal(d.none, 2);
});

test('Professur mit Deputat 0 zählt nach LVVO mit ihrer Regellehrverpflichtung', () => {
  const {get, S} = setup([{pnr: 1, ...PROF, deputat: 0}]);
  const l = get('capStats')(S.recs, S.today);
  assert.equal(l.sws, 18); assert.equal(l.support, 0);
  assert.equal(get('capStats')(S.recs, S.today, 'deputat').support, 1);
});
