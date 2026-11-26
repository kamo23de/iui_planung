// Aufbau der Module unter src/js/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {pathToFileURL} = require('url');
const {analyze, MODULES} = require('../scripts/modules');

test('Importe und Exporte sind vollständig und eindeutig (node scripts/modules.js)', () => {
  assert.deepEqual([...analyze().problems], []);
});

test('Die Module lassen sich als echte ES-Module laden und verknüpfen', async () => {
  // Universeller Platzhalter für Browser-Objekte: jede Eigenschaft und jeder Aufruf liefert wieder den Platzhalter.
  const stub = new Proxy(function () {}, {get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === Symbol.iterator ? [][Symbol.iterator] : stub,
    apply: () => stub, construct: () => stub, set: () => true});
  const saved = {};
  for (const k of ['document', 'window', 'getComputedStyle', 'innerWidth', 'innerHeight', 'addEventListener', 'Chart', 'XLSX'])
    { saved[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, {value: stub, configurable: true, writable: true}); }
  try {
    // Ein fehlender Export führt hier zu einem SyntaxError beim Verknüpfen; main.js zieht alle Module nach sich.
    const ns = {};
    for (const f of MODULES) ns[f] = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'js', f)).href);
    assert.equal(ns['util.js'].fmtD(ns['util.js'].toDay(2026, 9, 1)), '01.09.2026');
  } finally {
    for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  }
});
