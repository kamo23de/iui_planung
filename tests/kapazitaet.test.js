// Kapazität: Lehrangebot aus Deputat (capStats)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {setup} = require('./helpers');

const PROF = {kreis: 'Professor/in', tarif: 'W2', vart: 'unbefristet', ende: null};

test('Lehrangebot: Summe des wirksamen Deputats je Personalgruppe, Jahr = 2 × Semester', () => {
  const {get, S} = setup([
    {pnr: 1, ...PROF, deputat: 18},
    {pnr: 2, ...PROF, deputat: 18, ruht: '31.03.2027', ruheanteil: 0.5},   // Dekanat: halbes Deputat
    {pnr: 3, ...PROF, deputat: 18, ruht: '31.03.2027'},                    // ruht ganz
    {pnr: 4, kreis: 'Lehrkraft für besondere Aufgaben', tarif: 'E13', deputat: 16},
    {pnr: 5, deputat: 4},
    {pnr: 6, deputat: 0},                                                  // nur unterstützend
    {pnr: 7, kreis: 'Verwaltung', tarif: 'E9'},                            // keine Angabe
  ]);
  const c = get('capStats')(S.recs);
  assert.equal(c.P, 27);
  assert.equal(c.L, 16);
  assert.equal(c.W, 4);
  assert.equal(c.O, 0);
  assert.equal(c.sws, 47);
  assert.equal(c.year, 94);
  assert.equal(c.teach, 4);      // Pnr 1, 2, 4, 5
  assert.equal(c.support, 1);    // Pnr 6
  assert.equal(c.none, 2);       // Pnr 3 (ruht ganz) und Pnr 7
});

test('Lehrangebot nach Ende des Ruhens wieder voll', () => {
  const {get, S} = setup([{pnr: 1, ...PROF, deputat: 18, ruht: '31.03.2027', ruheanteil: 0.5}]);
  get('(d => { CAP_D = d; })')(get('parseDate')('01.04.2027').v);
  assert.equal(get('capStats')(S.recs).sws, 18);
});

test('Unlesbares Deputat zählt nicht zum Lehrangebot', () => {
  const {get, S} = setup([{pnr: 1, ...PROF, deputat: 'n.n.'}]);
  const c = get('capStats')(S.recs);
  assert.equal(c.sws, 0);
  assert.equal(c.none, 1);
});
