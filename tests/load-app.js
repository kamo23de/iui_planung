// Lädt den Anwendungscode aus src/app.html in einen eigenen Node-Kontext (ohne Browser),
// damit die Rechenkerne direkt getestet werden können. Der Aufruf init() am Ende wird
// weggelassen; DOM-Zugriffe gibt es dann nur noch in Rendering-Funktionen, die hier nicht laufen.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/app.html'), 'utf8');

function appSource() {
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const app = blocks.find(b => b.includes('function buildRecords('));
  if (!app) throw new Error('Anwendungsskript in src/app.html nicht gefunden');
  const stripped = app.replace(/\ninit\(\);\s*$/, '\n');
  if (stripped === app) throw new Error('Aufruf init() am Skriptende nicht gefunden');
  return stripped;
}

/** Erzeugt einen frischen Kontext mit geladenem Anwendungscode.
 *  Rückgabe: Funktion get(ausdruck) wertet einen Ausdruck im Kontext aus, z. B. get('toDay')(2026, 9, 1). */
function loadApp() {
  const el = () => ({classList: {add() {}, remove() {}, toggle() {}}, style: {}, setAttribute() {}, addEventListener() {}, value: '', textContent: '', innerHTML: ''});
  const document = {
    querySelector: () => el(), querySelectorAll: () => [], getElementById: () => el(), createElement: () => el(),
    documentElement: {}, body: el(), addEventListener() {}, title: ''
  };
  const ctx = {
    console, Intl, Math, Date, JSON, Number, String, Array, Object, Set, Map, Promise, Error, RegExp, Symbol,
    isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout, structuredClone, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer,
    document, window: {innerWidth: 1400, addEventListener() {}}, innerWidth: 1400, innerHeight: 900,
    getComputedStyle: () => ({getPropertyValue: () => ''}),
    XLSX: require('xlsx'),
    Chart: function Chart() {},
    alert() {}, atob: s => Buffer.from(s, 'base64').toString('binary'),
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(appSource(), ctx, {filename: 'src/app.html'});
  return expr => vm.runInContext(expr, ctx);
}

/** Objekte aus dem App-Kontext haben andere Prototypen; für deepEqual in normale Objekte umwandeln. */
const plain = o => JSON.parse(JSON.stringify(o));

module.exports = {loadApp, plain, root};
