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
