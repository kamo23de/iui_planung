// Alle Ansichten einmal zeichnen – mit den echten ES-Modulen (nicht dem Bündel) und einem Platzhalter-DOM.
// Fängt vor allem vergessene Importe ab: In ES-Modulen führen sie zu einem ReferenceError, sobald der
// Code läuft, und weder esbuild noch die Textprüfung in scripts/modules.js finden jeden solchen Fall.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {pathToFileURL} = require('url');
const XLSX = require('xlsx');
const {root} = require('./load-app');

// Platzhalter für Browser-Objekte: jede Eigenschaft und jeder Aufruf liefert wieder einen Platzhalter;
// als Zahl/Text ergibt er 0 bzw. '', als Liste ist er leer.
function makeStub() {
  const store = new Map();
  const stub = new Proxy(function () {}, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return hint => hint === 'number' ? 0 : '';
      if (k === Symbol.iterator) return function* () {};
      if (k === 'length') return 0;
      if (k === 'then') return undefined;   // kein Promise
      if (store.has(k)) return store.get(k);
      return stub;
    },
    set(t, k, v) { store.set(k, v); return true; },
    apply: () => stub, construct: () => stub, has: () => true,
  });
  return stub;
}

test('Jede Ansicht lässt sich mit den Testdaten zeichnen (Köpfe, VZÄ, mit Szenario)', async () => {
  const stub = makeStub();
  const keys = ['document', 'window', 'getComputedStyle', 'innerWidth', 'innerHeight', 'Chart', 'XLSX', 'alert', 'matchMedia'];
  const saved = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const k of keys) Object.defineProperty(globalThis, k, {value: stub, configurable: true, writable: true});
  globalThis.XLSX = XLSX;
  try {
    const mod = f => import(pathToFileURL(path.join(root, 'src/js', f)).href);
    const {S} = await mod('state.js'), {toDay} = await mod('util.js'), {readWorkbook} = await mod('parse.js');
    const {renderAll} = await mod('render.js'), {PLAN, planTouch} = await mod('plan/scenario.js'), {setPlSub} = await mod('plan/view.js');
    const {usedBase} = await mod('model.js');
    S.today = toDay(2026, 11, 26);
    readWorkbook(fs.readFileSync(path.join(root, 'testdaten/Testdaten_Personalplanung.xlsx')), 'Testdaten');
    const tabs = ['check', 'overview', 'semester', 'forecast', 'ratio', 'detail', 'cap', 'lvvo', 'plan'];
    const drawAll = label => {
      for (const t of tabs) {
        S.tab = t;
        try { renderAll(); } catch (e) { assert.fail(`${label}, Reiter ${t}: ${e.name}: ${e.message}`); }
      }
      setPlSub('goal'); S.tab = 'plan';
      try { renderAll(); } catch (e) { assert.fail(`${label}, Planung/Zielwerte: ${e.name}: ${e.message}`); }
      setPlSub('tl');
    };
    for (const m of ['koepfe', 'vzae']) { S.measure = m; drawAll(m); }
    S.refill = true; drawAll('offene Stellen'); S.refill = false;
    const r = usedBase().find(x => x.ende != null && x.ende > S.today);
    PLAN.items.push({id: PLAN.seq++, type: 'nach', row: r.row, vz: r.vz, beginn: r.ende + 1, ende: null, kw: false});
    planTouch(); S.applyPlan = true; drawAll('mit Szenario');
    // Personenfenster, auch mit Zeitkonto (Blatt „Lehre“)
    const {showPerson} = await mod('views/person.js');
    const mitLehre = new Set(S.teaching.filter(t => t.ok).map(t => t.pnr));
    for (const wip of [false, true]) {
      S.showWip = wip;
      for (const p of [usedBase().find(x => mitLehre.has(x.pnr)), usedBase().find(x => !mitLehre.has(x.pnr))]) {
        try { showPerson(p.row); } catch (e) { assert.fail(`Personenfenster (WIP ${wip}): ${e.name}: ${e.message}`); }
      }
    }
    // Suche: Treffer aller Gruppen und Sprung in die Detailansicht
    const {gsMatches, gsOpen} = await mod('search.js');
    for (const q of ['a', 'labor', 'technik']) {
      const m = gsMatches(q);
      for (const type of ['person', 'labor', 'oe']) {
        const it = m.find(x => x.type === type); if (!it) continue;
        try { gsOpen(it); } catch (e) { assert.fail(`Suche „${q}“, ${type}: ${e.name}: ${e.message}`); }
      }
    }
  } finally {
    for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  }
});
