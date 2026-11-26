// Lädt den Anwendungscode – genau so, wie er in die HTML-Datei eingebaut wird – in einen eigenen
// Node-Kontext (ohne Browser), damit die Rechenkerne direkt getestet werden können. Jeder Aufruf
// von loadApp() liefert einen frischen Zustand. Der Startaufruf init() wird weggelassen; DOM-Zugriffe
// gibt es dann nur noch in Rendering-Funktionen, die hier nicht laufen.
'use strict';
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const {appScript} = require('../scripts/build');

/** Das gebaute Anwendungsskript (alle Module aus src/js/ in Build-Reihenfolge), ohne den Startaufruf init(). */
function appSource() {
  const app = appScript();
  const stripped = app.replace(/\ninit\(\);\s*$/, '\n');
  if (stripped === app) throw new Error('Aufruf init() am Ende von src/js/main.js nicht gefunden');
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
  vm.runInContext(appSource(), ctx, {filename: 'app.js'});
  return expr => vm.runInContext(expr, ctx);
}

/** Objekte aus dem App-Kontext haben andere Prototypen; für deepEqual in normale Objekte umwandeln. */
const plain = o => JSON.parse(JSON.stringify(o));

module.exports = {loadApp, plain, root};
