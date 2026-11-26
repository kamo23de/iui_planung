// Datums-, Zahlen- und Semesterfunktionen
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp, plain} = require('./load-app');

const get = loadApp();
const toDay = get('toDay'), fmtD = get('fmtD'), parseDate = get('parseDate'), parseNum = get('parseNum'), r2 = get('r2');
const semIdx = get('semIdx'), semStart = get('semStart'), semEnd = get('semEnd'), semLabel = get('semLabel');

test('toDay/fromDay/fmtD: Hin- und Rückweg', () => {
  for (const [y, m, d] of [[1970, 1, 1], [2024, 2, 29], [2026, 12, 31], [2099, 6, 15]]) {
    assert.deepEqual(plain(get('fromDay')(toDay(y, m, d))), {y, m, d});
  }
  assert.equal(fmtD(toDay(2026, 9, 1)), '01.09.2026');
  assert.equal(fmtD(null), '–');
  assert.equal(get('isoD')(toDay(2026, 3, 5)), '2026-03-05');
  assert.equal(get('parseIso')('2026-03-05'), toDay(2026, 3, 5));
});

test('parseDate: deutsche Schreibweise, ISO, zweistellige Jahre', () => {
  assert.equal(parseDate('01.09.2026').v, toDay(2026, 9, 1));
  assert.equal(parseDate('1.9.26').v, toDay(2026, 9, 1));
  assert.equal(parseDate('1.9.75').v, toDay(1975, 9, 1));
  assert.equal(parseDate('2026-09-01').v, toDay(2026, 9, 1));
  assert.equal(parseDate('2026-09-01T00:00:00').v, toDay(2026, 9, 1));
});

test('parseDate: Excel-Seriennummer', () => {
  assert.equal(parseDate(46266).v, toDay(2026, 9, 1));       // 01.09.2026
  assert.equal(parseDate(46266.75).v, toDay(2026, 9, 1));    // Uhrzeitanteil wird ignoriert
});

test('parseDate: leer, unbefristet und Platzhalter ab 2100', () => {
  for (const v of [null, '', '-', '–', 'offen', 'unbefristet', 'n/a']) assert.equal(parseDate(v).v, null, String(v));
  assert.deepEqual(plain(parseDate('31.12.2999')), {v: null, open: true});
  assert.equal(parseDate(parseDate('31.12.2999').v).v, null);
});

test('parseDate: ungültige Angaben werden als Fehler gemeldet', () => {
  for (const v of ['31.02.2026', '2026-13-01', 'morgen', '12/31/2026']) assert.equal(parseDate(v).err, true, v);
});

test('parseNum: Zahlen, deutsche Schreibweise, Prozent', () => {
  assert.deepEqual(plain(parseNum(0.5)), {v: 0.5});
  assert.equal(parseNum('0,5').v, 0.5);
  assert.equal(parseNum('1.234,5').v, 1234.5);
  assert.equal(parseNum(' 75 % ').v, 75);
  assert.equal(parseNum(' 75 % ').pct, true);
  assert.equal(parseNum(null).v, null);
  assert.equal(parseNum('n.n.').err, true);
  assert.equal(parseNum('abc').err, true);
});

test('r2: kaufmännisch auf zwei Stellen, auch bei Gleitkomma-Resten', () => {
  assert.equal(r2(1.005), 1.01);
  assert.equal(r2(0.1 + 0.2), 0.3);
  assert.equal(r2(-1.005), -1.01);
  assert.equal(r2(null), null);
});

test('Semester: WS 01.09.–Ende Februar, SS 01.03.–31.08.', () => {
  const ws = semIdx(toDay(2026, 9, 1));
  assert.equal(semLabel(ws), 'WS 2026/27');
  assert.equal(semIdx(toDay(2027, 2, 28)), ws);
  assert.equal(semIdx(toDay(2026, 12, 31)), ws);
  assert.equal(semLabel(semIdx(toDay(2027, 3, 1))), 'SS 2027');
  assert.equal(semLabel(semIdx(toDay(2026, 8, 31))), 'SS 2026');
  assert.equal(semStart(ws), toDay(2026, 9, 1));
  assert.equal(semEnd(ws), toDay(2027, 2, 28));
  assert.equal(semEnd(semIdx(toDay(2027, 9, 1))), toDay(2028, 2, 29));   // Schaltjahr
  assert.equal(semStart(ws + 1), toDay(2027, 3, 1));
  assert.equal(semLabel(semIdx(toDay(2099, 10, 1))), 'WS 2099/00');
});
