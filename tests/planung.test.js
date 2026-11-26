// Planung: Szenario-Datensätze (planRecords), Umschalten Ist/Plan, Zielwerte (goalEval)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {setup} = require('./helpers');

const PROF = {kreis: 'Professor/in', tarif: 'W2', vart: 'unbefristet', ende: null};

function withScenario(people, items, opts) {
  const t = setup(people, opts);
  const PLAN = t.get('PLAN');
  for (const it of items) PLAN.items.push(Object.assign({id: PLAN.seq++}, it));
  t.get('planTouch')();
  t.S.applyPlan = true;
  return t;
}

test('Nachbesetzung übernimmt Kreis, Cluster und anteiliges Deputat der bisherigen Stelle', () => {
  const t = setup([{pnr: 1, ...PROF, vart: 'befristet', ende: '28.02.2027', vz: 1, arb: 100, deputat: 18}]);
  const row = t.rec(1).row, b = t.get('parseDate')('01.03.2027').v;
  const {get, S} = withScenario([{pnr: 1, ...PROF, vart: 'befristet', ende: '28.02.2027', deputat: 18}], [{type: 'nach', row, vz: 0.5, beginn: b, ende: null, kw: false}]);
  const recs = get('used')();
  assert.equal(recs.length, 2);
  const n = recs.find(r => r.plan);
  assert.equal(n.kreis, 'Professor/in');
  assert.equal(n.cluster, 'Informatik');
  assert.equal(n.deputat, 9);
  assert.equal(n.befr, false);
  assert.equal(get('withPlan')(false, () => get('used')().length), 1);
  assert.equal(get('withPlan')(true, () => get('used')().length), 2);
  S.applyPlan = false;
  assert.equal(get('used')().length, 1);
});

test('Neue Stelle und geändertes Vertragsende wirken auf den Bestand', () => {
  const t = setup([{pnr: 1, ende: '31.12.2026'}]);
  const row = t.rec(1).row, p = s => t.get('parseDate')(s).v;
  const {get, S} = withScenario([{pnr: 1, ende: '31.12.2026'}], [
    {type: 'ende', row, ende: p('31.12.2028')},
    {type: 'neu', kreis: 'Wiss. Mitarbeiter/in', cluster: 'Informatik', vz: 1, beginn: p('01.03.2027'), ende: null, kw: false, deputat: 4},
  ]);
  S.measure = 'koepfe';
  const later = p('01.06.2027');
  assert.equal(get('snapshot')(later).total, 2);
  assert.equal(get('withPlan')(false, () => get('snapshot')(later).total), 0);
  const geaendert = get('used')().find(r => r.planMod);
  assert.equal(geaendert.origEnde, p('31.12.2026'));
  assert.equal(geaendert.endType, 'Vertragsende');
  assert.equal(t.rec(1).ende, p('31.12.2026'), 'Ist-Datensatz bleibt unverändert');
});

test('Szenario-Cache wird bei neuen Planmaßnahmen erneuert', () => {
  const {get} = withScenario([{pnr: 1}], [{type: 'neu', kreis: 'Wiss. Mitarbeiter/in', cluster: 'Informatik', vz: 1, beginn: 0, ende: null, kw: false}]);
  assert.equal(get('used')().length, 2);
  const PLAN = get('PLAN');
  PLAN.items.push({id: PLAN.seq++, type: 'neu', kreis: 'Wiss. Mitarbeiter/in', cluster: 'Informatik', vz: 1, beginn: 0, ende: null, kw: false});
  get('planTouch')();
  assert.equal(get('used')().length, 3);
});

test('Zielwerte: Studierende je Professur und WiMi je Professur mit Ampel und Fehlbedarf', () => {
  const {get} = setup([
    {pnr: 1, ...PROF}, {pnr: 2, ...PROF},
    {pnr: 3, kreis: 'Lehrkraft für besondere Aufgaben', tarif: 'E13'},
    {pnr: 4}, {pnr: 5, vz: 0.5, arb: 50},
  ], {students: [{sg: 'Informatik B.Sc.', cluster: 'Informatik', cnw: 6, pl: 90, n: 150}]});
  const S = get('S'), g = get('goalEval')('Informatik', S.today);
  assert.equal(g.PL, 3);
  assert.equal(g.studRatio, 50);
  assert.equal(g.lvlStud, 'bad');           // Ziel 40, Toleranz 10 % → bis 44 gelb
  assert.equal(g.needProf, 0.75);           // 150 / 40 − 3
  assert.equal(g.wimiRatio, 0.75);          // 1,5 VZÄ WiMi / 2 Professuren (ohne LfbA)
  assert.equal(g.lvlWimi, 'ok');
  assert.equal(g.needWimi, 0);
});
