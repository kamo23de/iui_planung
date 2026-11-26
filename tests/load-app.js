// Lädt den Anwendungscode in einen eigenen Node-Kontext (ohne Browser), damit die Rechenkerne direkt
// getestet werden können. esbuild bündelt dafür alle Module unter src/js/ außer dem Startpunkt app.js
// (init() läuft also nicht) mit denselben Einstellungen wie der Build. Jeder Aufruf von loadApp()
// liefert einen frischen Zustand.
'use strict';
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const {bundle} = require('../scripts/build');
const {listModules} = require('../scripts/modules');

let script = null;
/** Gebündelter Code aller Module (ohne app.js); alle Exporte liegen im Namensraum __app. Einmal je Testlauf übersetzt. */
function appScript() {
  if (script) return script;
  const entry = listModules().filter(f => f !== 'app.js').map(f => `export * from './${f}';`).join('\n');
  const code = bundle({stdin: {contents: entry, resolveDir: path.join(root, 'src/js'), sourcefile: 'test-entry.js'}, globalName: '__app'});
  return (script = new vm.Script(code, {filename: 'app.js'}));
}

/** Erzeugt einen frischen Kontext mit geladenem Anwendungscode.
 *  Rückgabe: Funktion get(ausdruck) wertet einen Ausdruck mit allen exportierten Namen aus, z. B. get('toDay')(2026, 9, 1). */
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
  appScript().runInContext(ctx);
  return expr => vm.runInContext(`with (__app) { ${expr} }`, ctx);
}

/** Objekte aus dem App-Kontext haben andere Prototypen; für deepEqual in normale Objekte umwandeln. */
const plain = o => JSON.parse(JSON.stringify(o));

module.exports = {loadApp, plain, root};
