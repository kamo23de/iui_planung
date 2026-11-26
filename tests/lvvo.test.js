// LVVO Niedersachsen, Fachhochschulen: Regelwerk, Zuordnung, Lehrverpflichtung, Ermäßigungen, Prüfregeln
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp, plain} = require('./load-app');
const {setup} = require('./helpers');

const PROF = {kreis: 'Professor/in', tarif: 'W2', vart: 'unbefristet', ende: null};
const LFBA = {kreis: 'Lehrkraft für besondere Aufgaben', vart: 'unbefristet', ende: null};
const has = (issues, check, sev) => issues.some(i => i.check === check && (!sev || i.sev === sev));

test('Regelwerk: Werte nach § 5 und § 9 LVVO (Fachhochschule)', () => {
  const get = loadApp(), F = get('lvvoFassung')(get('toDay')(2026, 11, 26));
  const lvs = Object.fromEntries(Object.entries(F.gruppen).map(([k, g]) => [k, [g.lvs, g.art]]));
  assert.deepEqual(plain(lvs), {prof: [18, 'regel'], lfba20: [20, 'regel'], lfba24: [24, 'regel'], wimi: [8, 'hoechst'], wimiQ: [4, 'hoechst'], keine: [0, 'keine']});
  assert.deepEqual(plain(F.p9), {quote: 7, quoteErweitert: 10, profMax: 4, profMaxForschung: 9, ref: '§ 9 Satz 2 und 3'});
  const max = Object.fromEntries(F.gruende.filter(g => g.maxPct).map(g => [g.key, g.maxPct]));
  assert.deepEqual(plain(max), {vp: 75, beratung: 25, sb: 25, gewinnung: 50});
  assert.equal(F.gueltigAb, '2018-09-10');
});

test('Spalte „LVVO-Gruppe“: Schreibweisen', () => {
  const p = loadApp()('parseLvvoGruppe');
  const cases = {'Professur': 'prof', 'Prof.': 'prof', 'LfbA 20': 'lfba20', 'LfbA höherer Dienst': 'lfba20', 'LfbA 24': 'lfba24',
    'Lehrkraft für besondere Aufgaben (gehobener Dienst)': 'lfba24', 'WiMi': 'wimi', 'WiMi Qualifikation': 'wimiQ', 'keine': 'keine', '-': 'keine'};
  for (const [v, k] of Object.entries(cases)) assert.equal(p(v), k, v);
  assert.equal(p('LfbA'), null);      // Einstiegsamt nicht angegeben
  assert.equal(p('Dozent'), null);
  assert.equal(p(''), null);
});

test('Ermäßigungsgrund aus Freitext', () => {
  const k = loadApp()('grundKey');
  const cases = {'Vizepräsidentin': 'vp', 'Studienfachberatung Informatik': 'beratung', 'Schwerbehinderung (GdB 50)': 'sb', 'GdB 70': 'sb',
    'Forschungsprojekt XY': 'forschung', 'Wissens- und Technologietransfer': 'forschung', 'Leitung Rechenzentrum': 'funktion', 'Laborleitung': 'funktion',
    'Praktikantenbetreuung': 'funktion', 'Studienreform': 'reform', 'Gewinnung (Bleibeverhandlung)': 'gewinnung', 'Tätigkeit außerhalb der Hochschule': 'extern'};
  for (const [v, key] of Object.entries(cases)) assert.equal(k(v), key, v);
  assert.equal(k('Sonstiges'), null);
});

test('Zuordnung zur LVVO-Gruppe aus Mitarbeiterkreis, Tarif und Befristung', () => {
  const {get, rec} = setup([
    {pnr: 1, ...PROF}, {pnr: 2, ...LFBA, tarif: 'E13'}, {pnr: 3, ...LFBA, tarif: 'E12'}, {pnr: 4, ...LFBA, tarif: 'A13'},
    {pnr: 5, ...LFBA, tarif: ''}, {pnr: 6}, {pnr: 7, vart: 'unbefristet', ende: null}, {pnr: 8, kreis: 'Verwaltung', tarif: 'E9'},
    {pnr: 9, lvvo: 'WiMi'}, {pnr: 10, ...LFBA, tarif: 'E13', lvvo: 'LfbA 24'},
  ]);
  const g = p => plain(get('lvvoGruppe')(rec(p)));
  assert.equal(g(1).key, 'prof');
  assert.equal(g(2).key, 'lfba20');
  assert.equal(g(3).key, 'lfba24');
  assert.equal(g(4).key, 'lfba20');
  assert.equal(g(5).key, 'lfba20'); assert.match(g(5).annahme, /Tarifgruppe fehlt/);
  assert.equal(g(6).key, 'wimiQ'); assert.match(g(6).annahme, /Weiterqualifikation/);
  assert.equal(g(7).key, 'wimi'); assert.equal(g(7).annahme, null);
  assert.equal(g(8).key, 'keine');
  assert.deepEqual(g(9), {key: 'wimi', quelle: 'Spalte', annahme: null});
  assert.equal(g(10).key, 'lfba24');
});

test('Lehrverpflichtung: Teilzeit anteilig, Ermäßigungen in LVS und Prozent, nur im Gültigkeitszeitraum', () => {
  const {get, rec, S} = setup([{pnr: 1, ...PROF, vz: 0.5, arb: 50}, {pnr: 2, ...PROF}], {reductions: [
    {pnr: 1, grund: 'Forschung', lvs: 2, von: '01.09.2026', bis: '31.08.2027'},
    {pnr: 2, grund: 'Schwerbehinderung', pct: '25 %'},
    {pnr: 2, grund: 'Studienfachberatung', lvs: 1, von: '01.03.2027'},
  ]});
  const x = (p, d) => get('lvvo')(rec(p), d ? get('parseDate')(d).v : S.today);
  assert.equal(x(1).basis, 9);
  assert.equal(x(1).ermSum, 2);
  assert.equal(x(1).soll, 7);
  assert.equal(x(1, '31.08.2026').soll, 9);   // vor Beginn der Ermäßigung
  assert.equal(x(1, '01.09.2026').soll, 7);   // erster Tag zählt mit
  assert.equal(x(1, '31.08.2027').soll, 7);   // letzter Tag zählt mit
  assert.equal(x(1, '01.09.2027').soll, 9);   // nach ihrem Ende
  assert.equal(x(2).ermSum, 4.5);             // 25 % von 18 LVS
  assert.equal(x(2).soll, 13.5);
  assert.equal(x(2, '01.03.2027').soll, 12.5);
});

test('Lehrverpflichtung bei ruhendem Anteil: wirksam gekürzt, nominal voll', () => {
  const {get, rec, S} = setup([{pnr: 1, ...PROF, ruht: '31.08.2028', ruheanteil: 0.5, deputat: 18}]);
  const r = rec(1);
  assert.equal(get('lvvo')(r, S.today).soll, 9);
  assert.equal(get('lvvo')(r, S.today, {nominal: true}).soll, 18);
  assert.equal(get('lvvo')(r, get('parseDate')('01.09.2028').v).soll, 18);
});

test('Ermäßigungen größer als die Lehrverpflichtung: Soll 0', () => {
  const {get, rec, S, issues} = setup([{pnr: 1, ...PROF, vz: 0.25, arb: 25}], {reductions: [{pnr: 1, grund: 'Forschung', lvs: 6}]});
  const x = get('lvvo')(rec(1), S.today);
  assert.equal(x.soll, 0);
  assert.equal(x.ueberErmaessigt, true);
  assert.ok(has(issues(1), 'Ermäßigungen größer als Lehrverpflichtung', 'W'));
});

test('WiMi: Soll ist das festgelegte Deputat, Ermäßigungen zählen nicht', () => {
  const {get, rec, S, issues} = setup([{pnr: 1, deputat: 3}, {pnr: 2, deputat: 5}, {pnr: 3, vart: 'unbefristet', ende: null, deputat: 5}],
    {reductions: [{pnr: 1, grund: 'Forschung', lvs: 1}]});
  const x = get('lvvo')(rec(1), S.today);
  assert.equal(x.basis, 4);
  assert.equal(x.soll, 3);
  assert.equal(x.ermSum, 0);
  assert.ok(has(S.issues.filter(i => i.sheet === 'Ermäßigungen'), 'Ermäßigung ohne Regellehrverpflichtung', 'W'));
  assert.ok(has(issues(2), 'Deputat über der Höchstlehrverpflichtung', 'W'));    // 5 > 4 (befristet)
  assert.ok(!has(issues(3), 'Deputat über der Höchstlehrverpflichtung'));        // 5 ≤ 8 (unbefristet)
});

test('Summen und Quote nach § 9 (7 %, bis 10 % mit WiMi-Lehre)', () => {
  const people = [{pnr: 1, ...PROF}, {pnr: 2, ...PROF}];
  const red = [{pnr: 1, grund: 'Forschung', lvs: 3}];
  let t = setup(people, {reductions: red});
  let st = t.get('lvvoStats')(t.S.recs, t.S.today);
  assert.equal(st.regel, 36);
  assert.equal(st.ermP9, 3);
  assert.equal(st.p9Quote, 8.33);
  assert.equal(st.p9Grenze, 7);
  assert.ok(has(t.S.issues, 'Ermäßigungsquote § 9', 'I'));
  t = setup([...people, {pnr: 3, deputat: 1.08}], {reductions: red});            // WiMi-Lehre 1,08 LVS = 3 % von 36
  st = t.get('lvvoStats')(t.S.recs, t.S.today);
  assert.equal(st.p9Grenze, 10);
  assert.equal(st.wimi, 1.08);
  assert.equal(st.lehre, 34.08);
  assert.ok(!has(t.S.issues, 'Ermäßigungsquote § 9'));
});

test('Prüfregeln: Deputat gegen LVVO', () => {
  const {issues} = setup([
    {pnr: 1, ...PROF, deputat: 18}, {pnr: 2, ...PROF, deputat: 16}, {pnr: 3, ...PROF, deputat: 16},
    {pnr: 4, ...LFBA, tarif: 'E11', deputat: 20},
  ], {reductions: [{pnr: 3, grund: 'Laborleitung', lvs: 2}]});
  assert.ok(!has(issues(1), 'Deputat weicht von LVVO ab'));
  assert.ok(has(issues(2), 'Deputat weicht von LVVO ab', 'W'));
  assert.ok(!has(issues(3), 'Deputat weicht von LVVO ab'));
  assert.ok(issues(4).some(i => i.check === 'Deputat weicht von LVVO ab' && /24 LVS/.test(i.msg)));
});

test('Prüfregeln: Höchstgrenzen der Ermäßigungen', () => {
  const {S, issues} = setup([{pnr: 1, ...PROF}, {pnr: 2, ...PROF}, {pnr: 3, ...PROF}, {pnr: 4, ...PROF}, {pnr: 5, ...PROF}, {pnr: 6, ...PROF}], {reductions: [
    {pnr: 1, grund: 'Labor', lvs: 3}, {pnr: 1, grund: 'Rechenzentrum', lvs: 2},          // § 9 Funktion 5 > 4
    {pnr: 2, grund: 'Forschung', lvs: 8}, {pnr: 2, grund: 'Labor', lvs: 2},              // § 9 zusammen 10 > 9
    {pnr: 3, grund: 'Forschung', lvs: 9},                                                // genau 9: zulässig
    {pnr: 4, grund: 'Vizepräsident', pct: 80},                                           // > 75 %
    {pnr: 5, grund: 'Schwerbehinderung', lvs: 5},                                        // 27,78 % > 25 %
    {pnr: 6, grund: 'Studienfachberatung', lvs: 3},                                      // Hinweis: mehr als 2 LVS
  ]});
  const red = S.issues.filter(i => i.sheet === 'Ermäßigungen');
  assert.ok(has(issues(1), 'Ermäßigung über der Höchstgrenze', 'W'));
  assert.ok(issues(2).some(i => i.check === 'Ermäßigung über der Höchstgrenze' && /zusammen 10,00/.test(i.msg)));
  assert.ok(!has(issues(3), 'Ermäßigung über der Höchstgrenze'));
  assert.ok(red.some(i => i.pnr === '4' && i.check === 'Ermäßigung über der Höchstgrenze'));
  assert.ok(red.some(i => i.pnr === '5' && i.check === 'Ermäßigung über der Höchstgrenze' && /27,78 %/.test(i.msg)));
  assert.ok(red.some(i => i.pnr === '6' && i.check === 'Ermäßigung: Hinweis'));
});

test('Prüfregeln: fehlerhafte Zeilen im Blatt „Ermäßigungen“', () => {
  const {S} = setup([{pnr: 1, ...PROF}, {pnr: 2, ...PROF, ende: '31.08.2027', vart: 'befristet'}], {reductions: [
    {pnr: 999, grund: 'Forschung', lvs: 1},
    {pnr: null, grund: 'Forschung', lvs: 1},
    {pnr: 1, grund: 'Forschung'},
    {pnr: 1, grund: 'Forschung', lvs: 1, pct: 10},
    {pnr: 1, grund: 'Forschung', lvs: 'zwei'},
    {pnr: 1, grund: 'Forschung', lvs: 1, von: '01.09.2027', bis: '01.03.2027'},
    {pnr: 1, grund: 'Sonstiges', lvs: 1},
    {pnr: 2, grund: 'Forschung', lvs: 1, von: '01.09.2027'},
  ]});
  const red = S.issues.filter(i => i.sheet === 'Ermäßigungen'), at = row => red.filter(i => i.row === row).map(i => i.check);
  assert.deepEqual([...at(2)], ['Ermäßigung: Person nicht gefunden']);
  assert.deepEqual([...at(3)], ['Ermäßigung: Pflichtfeld leer']);
  assert.ok(at(4).includes('Ermäßigung ohne Umfang'));
  assert.ok(at(5).includes('Ermäßigung doppelt angegeben'));
  assert.ok(at(6).includes('Ermäßigung: Wert nicht lesbar'));
  assert.ok(at(7).includes('Ermäßigung: von nach bis'));
  assert.ok(at(8).includes('Ermäßigungsgrund nicht erkannt'));
  assert.ok(at(9).includes('Ermäßigung außerhalb der Vertragslaufzeit'));
});

test('Prüfregeln: Spalte „LVVO-Gruppe“', () => {
  const {issues, S} = setup([{pnr: 1, lvvo: 'Dozent'}, {pnr: 2, lvvo: 'Professur'}, {pnr: 3}, {pnr: 4}]);
  assert.ok(has(issues(1), 'LVVO-Gruppe nicht erkannt', 'E'));
  assert.ok(has(issues(2), 'LVVO-Gruppe passt nicht zum Mitarbeiterkreis', 'W'));
  assert.ok(S.issues.some(i => i.check === 'LVVO-Gruppe angenommen' && i.row == null && /^3 befristete WiMi/.test(i.msg)));   // Pnr 1, 3, 4
});

test('Prozentangaben der Ermäßigung: 12 %, 0,12 und 12 bedeuten dasselbe', () => {
  const {S} = setup([{pnr: 1, ...PROF}], {reductions: [{pnr: 1, grund: 'GdB 50', pct: '12 %'}, {pnr: 1, grund: 'GdB 50', pct: 0.12}, {pnr: 1, grund: 'GdB 50', pct: 12}]});
  assert.deepEqual([...S.reductions.map(e => e.pct)], [12, 12, 12]);
});

test('Liste je Person: Sortierung auf- und absteigend, leere Werte am Ende, Umschalten per Klick', () => {
  const {get, S} = setup([
    {pnr: 1, name: 'Berg', ...PROF, deputat: 18},
    {pnr: 2, name: 'Arndt', ...PROF, deputat: 16},
    {pnr: 3, name: 'Cramer', ...PROF, vz: 0.5, arb: 50},           // ohne Deputat
    {pnr: 4, name: 'Dahl', deputat: 2},                              // WiMi
  ]);
  const F = get('lvvoFassung')(S.today), people = S.recs.map(r => ({r, x: get('lvvo')(r, S.today)}));
  const names = (k, d) => [...get('sortLvPeople')(people, F, k, d)].map(o => o.r.name);
  assert.deepEqual(names('name', 1), ['Arndt', 'Berg', 'Cramer', 'Dahl']);
  assert.deepEqual(names('name', -1), ['Dahl', 'Cramer', 'Berg', 'Arndt']);
  assert.deepEqual(names('soll', 1), ['Dahl', 'Cramer', 'Arndt', 'Berg']);         // 2, 9, 18, 18 (gleich: Grundordnung)
  assert.deepEqual(names('deputat', 1), ['Dahl', 'Arndt', 'Berg', 'Cramer']);      // ohne Deputat am Ende
  assert.deepEqual(names('deputat', -1), ['Berg', 'Arndt', 'Dahl', 'Cramer']);     // auch absteigend am Ende
  assert.deepEqual(names('abw', 1), ['Arndt', 'Berg', 'Cramer', 'Dahl']);          // −2, 0; Cramer und WiMi ohne Wert
  assert.deepEqual(names(null, 1), ['Arndt', 'Berg', 'Cramer', 'Dahl']);           // Grundordnung: Cluster, Gruppe, Name
  const L = get('LV_SORT'), set = get('setLvSort');
  set('soll'); assert.deepEqual([L.key, L.dir], ['soll', 1]);
  set('soll'); assert.deepEqual([L.key, L.dir], ['soll', -1]);
  set('soll'); assert.equal(L.dir, 1);
  set('name'); assert.deepEqual([L.key, L.dir], ['name', 1]);
});
