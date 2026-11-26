// Dokumentation nach § 18 LVVO: Studienjahr, Daten je Lehrperson, Bericht
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {loadApp, root} = require('./load-app');
const {setup} = require('./helpers');

const PROF = {kreis: 'Professor/in', tarif: 'W2', vart: 'unbefristet', ende: null, beginn: '01.03.2020'};

function testdatei() {
  const get = loadApp(), S = get('S');
  S.today = get('toDay')(2026, 11, 26);
  get('readWorkbook')(fs.readFileSync(path.join(root, 'testdaten/Testdaten_Personalplanung.xlsx')), 'Testdaten');
  get('runChecks')();
  return {get, S};
}

test('Studienjahr: Wintersemester und folgendes Sommersemester', () => {
  const get = loadApp(), p = get('parseSemester');
  assert.equal(get('sjStart')(p('WS 2025/26')), p('WS 2025/26'));
  assert.equal(get('sjStart')(p('SS 2026')), p('WS 2025/26'));
  assert.equal(get('sjLabel')(p('WS 2025/26')), '2025/26');
  assert.equal(get('sjLabel')(p('WS 2099/00')), '2099/00');
});

test('Testdatei: Studienjahre und Referenzwerte 2025/26', () => {
  const {get} = testdatei();
  assert.deepEqual([...get('studienjahre')()].map(get('sjLabel')), ['2026/27', '2025/26', '2024/25']);
  const w = get('parseSemester')('WS 2025/26');
  const d = get('dokuDaten')(w);
  assert.equal(d.personen.length, 129);
  assert.equal(d.mitLehre, 12);
  const et = get('dokuDaten')(w, {cluster: 'Elektrotechnik'});
  assert.equal(et.personen.length, 29);
  assert.equal(et.mitLehre, 11);
  assert.deepEqual([...et.summen.map(s => [s.soll, s.ist])].map(x => [...x]), [[270.84, 185], [269.34, 169.5]]);
});

test('Testdatei: Hinweise im Einzelnachweis', () => {
  const {get} = testdatei();
  const d = get('dokuDaten')(get('parseSemester')('WS 2025/26'), {cluster: 'Elektrotechnik'});
  const p = name => d.personen.find(x => `${x.r.vorname} ${x.r.name}` === name);
  assert.match(p('Markus Becker').semester[1].hinweise.join('|'), /6,00 LVS Guthaben verfallen/);
  assert.equal(p('Markus Becker').kontoEnde, 36);
  assert.ok(p('Lena Lang').semester[1].hinweise.includes('keine Lehre erfasst'));
  assert.match(p('Frank Becker').semester[1].hinweise.join('|'), /Betreuung 5,00 LVS, angerechnet 2,00 LVS/);
  assert.equal(p('Martin Lehmann').auffaellig, false);
});

test('Vertragsende im Studienjahr, Ermäßigungen und Befreiung', () => {
  const {get, rec} = setup([{pnr: 1, ...PROF, vart: 'befristet', ende: '28.02.2026'}, {pnr: 2, ...PROF}], {
    reductions: [{pnr: 2, grund: 'Befreiung wegen Überangebot', lvs: 18, von: '01.03.2026', bis: '31.08.2026'}, {pnr: 2, grund: 'Forschung', lvs: 2, bis: '31.08.2025'}],
    teaching: [{pnr: 1, sem: 'WS 2025/26', art: 'Vorlesung', sws: 18}, {pnr: 2, sem: 'WS 2025/26', art: 'Vorlesung', sws: 18}]});
  const d = get('dokuDaten')(get('parseSemester')('WS 2025/26'));
  const a = d.personen.find(p => p.r === rec(1)), b = d.personen.find(p => p.r === rec(2));
  assert.equal(a.semester[1].imVertrag, false);
  assert.ok(a.semester[1].hinweise.includes('kein Vertrag in diesem Semester'));
  assert.equal(b.ermaessigungen.length, 1);              // die Forschungsermäßigung endete vor dem Studienjahr
  assert.equal(b.befreiung, true);
  assert.equal(b.semester[1].soll, 0);                   // SS 2026: befreit
  assert.ok(!b.semester[1].hinweise.includes('keine Lehre erfasst'));
});

test('Mehrere Verträge mit derselben Personalnummer: Lehre nur beim ersten', () => {
  const {get} = setup([{pnr: 7, ...PROF, vz: 0.5, arb: 50, labor: 'A'}, {pnr: 7, ...PROF, vz: 0.5, arb: 50, labor: 'B'}],
    {teaching: [{pnr: 7, sem: 'WS 2025/26', art: 'Vorlesung', sws: 18}]});
  const d = get('dokuDaten')(get('parseSemester')('WS 2025/26'));
  assert.equal(d.personen.length, 2);
  assert.deepEqual([...d.personen.map(p => p.weitererVertrag)], [false, true]);
  assert.equal(d.summen[0].ist, 18);
});

test('Bericht: je Lehrperson ein Abschnitt, Namen maskiert, Datei ohne Skript und Netzwerk', () => {
  const {get} = setup([{pnr: 1, ...PROF, name: '<img src=x onerror=alert(1)>'}, {pnr: 2, ...PROF}]);
  const d = get('dokuDaten')(get('parseSemester')('WS 2025/26'));
  const html = get('dokuHtml')(d, {seiteJePerson: true, erstellt: '26.11.2026'});
  assert.equal((html.match(/<section class="person">/g) || []).length, 2);
  assert.ok(html.includes('class="doku seite"'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(!get('dokuHtml')(d, {seiteJePerson: false}).includes('doku seite'));
  const file = get('dokuDatei')(d, {});
  assert.ok(!/<script/i.test(file));
  assert.match(file, /Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"/);
  assert.match(file, /Studienjahr 2025\/26/);
});
