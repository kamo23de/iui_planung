// Gebaute Datei: aktuell und weiterhin ohne Netzwerkzugriff
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const {buildHtml, OUT} = require('../scripts/build');

const committed = fs.readFileSync(OUT, 'utf8');

test('Personalplanung_IuI.html entspricht dem Quelltext (sonst: npm run build)', () => {
  assert.ok(buildHtml() === committed, 'Personalplanung_IuI.html ist veraltet – bitte „npm run build“ ausführen und mit einchecken.');
});

test('Content-Security-Policy verbietet Netzwerkverbindungen', () => {
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(committed);
  assert.ok(csp, 'CSP-Meta-Tag fehlt');
  const p = csp[1];
  assert.match(p, /default-src 'none'/);
  assert.match(p, /connect-src 'none'/);
  assert.match(p, /form-action 'none'/);
  assert.doesNotMatch(p, /https?:|\*/, 'CSP darf keine externen Quellen erlauben');
});

test('Keine externen Skripte, Stylesheets oder Bilder', () => {
  const ext = [...committed.matchAll(/<(script|link|img)\b[^>]*\b(src|href)="(https?:)?\/\/[^"]*"/gi)].map(m => m[0]);
  assert.deepEqual(ext, []);
});

test('Eingebettetes SheetJS ist mindestens 0.20.2 (ältere Versionen: Prototype Pollution, ReDoS)', () => {
  const m = /make_xlsx_lib\(e\)\{e\.version="(\d+)\.(\d+)\.(\d+)"/.exec(committed);
  assert.ok(m, 'Versionskennung von SheetJS nicht gefunden');
  const v = m.slice(1).map(Number), min = [0, 20, 2];
  const cmp = v.findIndex((x, i) => x !== min[i]);
  assert.ok(cmp < 0 || v[cmp] > min[cmp], `SheetJS ${v.join('.')} ist älter als ${min.join('.')}`);
});

test('styles.css: keine Deklarationen außerhalb von Regeln (sonst verwirft der Browser die folgende Regel)', () => {
  const css = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0, top = '';
  for (const ch of css) {
    if (ch === '{') { if (depth === 0) { assert.doesNotMatch(top, /[a-z-]+\s*:[^{};]*;/i, `Deklaration außerhalb einer Regel vor: ${top.trim().slice(0, 80)}`); top = ''; } depth++; }
    else if (ch === '}') { depth--; assert.ok(depth >= 0, 'überzählige schließende Klammer'); }
    else if (depth === 0) top += ch;
  }
  assert.equal(depth, 0, 'nicht geschlossene Klammer');
});
