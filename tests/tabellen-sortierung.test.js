// Allgemeine Tabellensortierung: Werte erkennen, flache und gegliederte Tabellen, Summenzeilen, leere Werte
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp, plain} = require('./load-app');

const get = loadApp(), v = get('sortValue'), order = get('orderRows');

test('Sortierwerte: deutsche Zahlen, Vorzeichen, Einheiten, Datum, Semester, Text, leer', () => {
  assert.deepEqual(plain(v('1.234,56')), {n: 1234.56});
  assert.deepEqual(plain(v('−3,00')), {n: -3});
  assert.deepEqual(plain(v('+2,50')), {n: 2.5});
  assert.deepEqual(plain(v('12,5 %')), {n: 12.5});
  assert.deepEqual(plain(v('8,00 max.')), {n: 8});
  assert.deepEqual(plain(v('100986')), {n: 100986});
  assert.deepEqual(plain(v('01.09.2026')), {n: 20260901});
  assert.ok(v('WS 2025/26').n > v('SS 2025').n && v('SS 2026').n > v('WS 2025/26').n);
  assert.deepEqual(plain(v('Müller, Anna')), {s: 'Müller, Anna'});
  assert.deepEqual(plain(v('2026/27')), {s: '2026/27'});
  for (const e of ['', '–', '-', '  ']) assert.equal(v(e), null, JSON.stringify(e));
  assert.deepEqual(plain(v('Soll ▲')), {s: 'Soll'});
});

const R = (vals, tot = false) => ({vals: vals.map(v), tot});

test('Flache Tabelle: auf- und absteigend, leere Werte am Ende, Summenzeile bleibt unten', () => {
  const rows = [R(['Berg', '2,00']), R(['Arndt', '–']), R(['Cramer', '10,00']), R(['Dahl', '1.000,00']), R(['Gesamt', '1.012,00'], true)];
  assert.deepEqual([...order(rows, 1, 1)], [0, 2, 3, 1, 4]);
  assert.deepEqual([...order(rows, 1, -1)], [3, 2, 0, 1, 4]);
  assert.deepEqual([...order(rows, 0, 1)], [1, 0, 2, 3, 4]);
  assert.deepEqual([...order(rows, 0, -1)], [3, 2, 0, 1, 4]);
});

test('Text mit Zahlen natürlich sortiert', () => {
  const rows = [R(['Labor 10']), R(['Labor 2']), R(['Labor 1'])];
  assert.deepEqual([...order(rows, 0, 1)], [2, 1, 0]);
});

test('Gegliederte Tabelle: Gruppen und Zeilen innerhalb der Gruppen, Gesamtzeile unten', () => {
  const rows = [
    R(['Informatik', '10'], true), R(['Data Science', '3']), R(['IT-Sicherheit', '7']),
    R(['Elektrotechnik', '5'], true), R(['Nachrichtentechnik', '4']), R(['Energietechnik', '1']),
    R(['Fakultät gesamt', '15'], true),
  ];
  assert.deepEqual([...order(rows, 1, 1)], [3, 5, 4, 0, 1, 2, 6]);    // Gruppen nach Summe, innen aufsteigend
  assert.deepEqual([...order(rows, 1, -1)], [0, 2, 1, 3, 4, 5, 6]);
  assert.deepEqual([...order(rows, 0, 1)], [3, 5, 4, 0, 1, 2, 6]);    // alphabetisch: Elektrotechnik vor Informatik
});

test('Gemischte Spalte: überwiegend Zahlen → numerisch, Text zählt als leer', () => {
  const rows = [R(['a', '5']), R(['b', 'n. v.']), R(['c', '1']), R(['d', '3'])];
  assert.deepEqual([...order(rows, 1, 1)], [2, 3, 0, 1]);
});
