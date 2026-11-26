// Blatt „Lehre“ und Zeitkonto nach § 11 LVVO (Fachhochschule)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp} = require('./load-app');
const {setup} = require('./helpers');

const PROF = {kreis: 'Professor/in', tarif: 'W2', vart: 'unbefristet', ende: null, beginn: '01.03.2020'};
const has = (issues, check, sev) => issues.some(i => i.check === check && (!sev || i.sev === sev));
const SEMS = ['SS 2025', 'WS 2025/26', 'SS 2026', 'WS 2026/27'];

test('Semesterangaben', () => {
  const get = loadApp(), p = get('parseSemester'), L = get('semLabel');
  const ok = {'WS 2026/27': 'WS 2026/27', 'Wintersemester 2026/2027': 'WS 2026/27', 'WiSe 26/27': 'WS 2026/27', 'ws26/27': 'WS 2026/27',
    'SS 2027': 'SS 2027', 'SoSe 27': 'SS 2027', 'Sommersemester 2027': 'SS 2027'};
  for (const [v, l] of Object.entries(ok)) assert.equal(L(p(v)), l, v);
  for (const v of ['WS 2026/28', 'Herbst 2026', '2026', '', null, 46266]) assert.equal(p(v), null, String(v));
  assert.equal(p('WS 2026/27'), get('semIdx')(get('toDay')(2026, 9, 1)));
  assert.equal(p('SS 2027'), get('semIdx')(get('toDay')(2027, 3, 1)));
});

test('Angerechnete LVS je Zeile (§ 13 Abs. 5, § 14 mit Anlage)', () => {
  const {S} = setup([{pnr: 1, ...PROF}], {teaching: [
    {pnr: 1, sem: 'SS 2026', art: 'Vorlesung', sws: 4},
    {pnr: 1, sem: 'SS 2026', art: 'Vorlesung', sws: 4, anteil: '50 %'},
    {pnr: 1, sem: 'SS 2026', art: 'Übung', sws: 2, anzahl: 2},
    {pnr: 1, sem: 'SS 2026', art: 'Exkursion', sws: 2},
    {pnr: 1, sem: 'SS 2026', art: 'Praktikum (nicht ständig anwesend)', sws: 4},
    {pnr: 1, sem: 'SS 2026', art: 'seminaristischer Unterricht', sws: 3, anteil: 0.5},
    {pnr: 1, sem: 'SS 2026', art: 'Übung', sws: 2, lvs: 1.5},
    {pnr: 1, sem: 'SS 2026', art: 'Tutorium', sws: 2},
  ]});
  assert.deepEqual([...S.teaching.map(t => t.lvs)], [4, 2, 4, 0.6, 1.2, 1.5, 1.5, 2]);
  assert.ok(S.teaching.every(t => t.ok));
  const L = S.issues.filter(i => i.sheet === 'Lehre');
  assert.ok(L.some(i => i.row === 6 && i.check === 'Lehre: ohne ständige Anwesenheit'));
  assert.ok(L.some(i => i.row === 8 && i.check === 'Lehre: LVS eingetragen'));
  assert.ok(L.some(i => i.row === 9 && i.check === 'Lehre: Art nicht erkannt' && i.sev === 'W'));
});

test('Betreuung von Abschlussarbeiten höchstens 2 LVS je Semester (§ 15)', () => {
  const {get, rec, issues} = setup([{pnr: 1, ...PROF}], {teaching: [
    {pnr: 1, sem: 'SS 2026', art: 'Vorlesung', sws: 16},
    {pnr: 1, sem: 'SS 2026', art: 'Betreuung Bachelorarbeiten', lvs: 2},
    {pnr: 1, sem: 'SS 2026', art: 'Betreuung Masterarbeiten', lvs: 1.5},
  ]});
  const L = get('lehreIst')(rec(1), get('parseSemester')('SS 2026'));
  assert.equal(L.betreuungRoh, 3.5);
  assert.equal(L.betreuung, 2);
  assert.equal(L.ist, 18);
  assert.ok(has(issues(1), 'Betreuung über der Höchstgrenze', 'W'));
});

test('Zeitkonto: Guthaben wächst bis zur Kappung beim Zweifachen der Regellehrverpflichtung', () => {
  const {get, rec, issues} = setup([{pnr: 1, ...PROF, vz: 0.5, arb: 50}], {teaching: SEMS.map(sem => ({pnr: 1, sem, art: 'Vorlesung', sws: 16}))});
  const k = get('zeitkonto')(rec(1));
  assert.deepEqual([...k.semester.map(e => [e.soll, e.ist, e.saldo, e.ende, e.verfallen])],
    [[9, 16, 7, 7, 0], [9, 16, 7, 14, 0], [9, 16, 7, 18, 3], [9, 16, 7, 18, 7]]);   // Kappung 2 × 9 LVS
  assert.equal(k.konto, 18);
  assert.equal(issues(1).filter(i => i.check === 'Zeitkonto: Guthaben verfallen').length, 2);
});

test('Zeitkonto: Fehlbetrag über der Regellehrverpflichtung und Lehre unter der Hälfte', () => {
  const {get, rec, issues} = setup([{pnr: 1, ...PROF}], {teaching: [8, 10, 16, 18].map((sws, i) => ({pnr: 1, sem: SEMS[i], art: 'Vorlesung', sws}))});
  const k = get('zeitkonto')(rec(1));
  assert.deepEqual([...k.semester.map(e => e.ende)], [-10, -18, -20, -20]);
  assert.deepEqual([...k.semester.map(e => !!e.fehlbetragZuHoch)], [false, false, true, true]);   // genau −18 ist noch zulässig
  assert.deepEqual([...k.semester.map(e => !!e.unterHaelfte)], [true, false, false, false]);
  assert.ok(has(issues(1), 'Zeitkonto: Fehlbetrag zu hoch', 'W'));
  assert.ok(has(issues(1), 'Zeitkonto: weniger als die Hälfte', 'W'));
});

test('Zeitkonto: Übertrag, Lücke und Ermäßigung im Semester', () => {
  const {get, rec, issues} = setup([{pnr: 1, ...PROF}], {
    reductions: [{pnr: 1, grund: 'Forschung', lvs: 4, von: '01.09.2026'}],
    teaching: [
      {pnr: 1, sem: 'SS 2025', art: 'Übertrag', lvs: 5},
      {pnr: 1, sem: 'SS 2025', art: 'Vorlesung', sws: 18},
      {pnr: 1, sem: 'SS 2026', art: 'Vorlesung', sws: 18},
      {pnr: 1, sem: 'WS 2026/27', art: 'Vorlesung', sws: 14},
    ]});
  const k = get('zeitkonto')(rec(1));
  assert.deepEqual([...k.semester.map(e => [get('semLabel')(e.sem), e.soll, e.ist, e.anfang, e.ende])],
    [['SS 2025', 18, 18, 5, 5], ['WS 2025/26', 18, 0, 5, -13], ['SS 2026', 18, 18, -13, -13], ['WS 2026/27', 14, 14, -13, -13]]);
  assert.ok(issues(1).some(i => i.check === 'Zeitkonto: Semester ohne Lehre' && /WS 2025\/26/.test(i.msg)));
});

test('WiMi: gehaltene Lehre gegen Deputat, kein Zeitkonto', () => {
  const {get, rec} = setup([{pnr: 1, beginn: '01.03.2024', deputat: 4}], {teaching: [{pnr: 1, sem: 'SS 2026', art: 'Übung', sws: 3}]});
  const e = get('zeitkonto')(rec(1)).semester[0];
  assert.equal(e.soll, 4);
  assert.equal(e.ist, 3);
  assert.equal(e.saldo, -1);
  assert.equal(e.ende, undefined);
});

test('Prüfregeln: fehlerhafte Zeilen im Blatt „Lehre“', () => {
  const {S} = setup([{pnr: 1, ...PROF}, {pnr: 2, ...PROF, beginn: '01.03.2027'}], {teaching: [
    {pnr: 999, sem: 'SS 2026', art: 'Vorlesung', sws: 2},
    {pnr: null, sem: 'SS 2026', art: 'Vorlesung', sws: 2},
    {pnr: 1, sem: 'Herbst 2026', art: 'Vorlesung', sws: 2},
    {pnr: 1, sem: 'SS 2026', art: 'Vorlesung'},
    {pnr: 1, sem: 'SS 2026', art: 'Vorlesung', sws: 2, anteil: 150},
    {pnr: 1, sem: 'SS 2026', art: 'Vorlesung', sws: 'zwei'},
    {pnr: 2, sem: 'SS 2026', art: 'Vorlesung', sws: 2},
  ]});
  const at = row => [...S.issues.filter(i => i.sheet === 'Lehre' && i.row === row).map(i => i.check)];
  assert.deepEqual(at(2), ['Lehre: Person nicht gefunden']);
  assert.deepEqual(at(3), ['Lehre: Pflichtfeld leer']);
  assert.ok(at(4).includes('Lehre: Semester nicht erkannt'));
  assert.ok(at(5).includes('Lehre: Umfang fehlt'));
  assert.ok(at(6).includes('Wert außerhalb des Bereichs'));   // Anteil 150 %
  assert.equal(S.teaching[4].ok, false);
  assert.ok(at(7).includes('Lehre: Zahl nicht lesbar'));
  assert.ok(at(8).includes('Lehre außerhalb der Vertragslaufzeit'));
});
