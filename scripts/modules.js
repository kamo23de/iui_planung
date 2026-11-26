// Module unter src/js/: Reihenfolge, Prüfung der Importe und Zusammenfügen zu einem Skript.
//
// Die Quellen sind ES-Module mit import/export. Für die Auslieferung als eine einzige, offline
// lauffähige HTML-Datei werden sie in der festen Reihenfolge MODULES aneinandergehängt
// (import-Zeilen entfernt, „export “ gestrichen). Das klappt, weil jeder Name auf oberster Ebene
// nur in einem Modul deklariert ist (wird geprüft).
//
// Aufruf:  node scripts/modules.js          → prüft Importe, Exit-Code 1 bei Problemen
//          node scripts/modules.js --fix    → schreibt die import-Zeilen aller Module neu
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'js');

// Reihenfolge im gebauten Skript. Neue Module hier eintragen. Module, deren oberste Ebene
// Werte anderer Module beim Laden braucht, müssen nach diesen stehen.
const MODULES = [
  'util.js', 'state.js', 'parse.js', 'checks.js', 'model.js', 'teaching.js', 'charts.js', 'render.js',
  'views/check.js', 'views/overview.js', 'views/semester.js', 'views/forecast.js', 'views/ratio.js',
  'views/detail.js', 'views/capacity.js', 'views/person.js',
  'plan/scenario.js', 'plan/form.js', 'plan/view.js', 'plan/timeline.js', 'plan/goals.js',
  'search.js', 'main.js',
];

const DECL = /^(?:export\s+)?(?:async\s+)?(?:function\*?\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*))/;
const IMPORT = /^import \{([^}]*)\} from '([^']+)';\s*$/;

/** Kommentare entfernen (Strings bleiben: Template-Ausdrücke enthalten Code). */
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
const re = s => s.replace(/[$]/g, '\\$');

function readModules() {
  const onDisk = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) onDisk.push(path.relative(SRC, p).split(path.sep).join('/'));
    }
  })(SRC);
  const problems = [];
  for (const f of onDisk) if (!MODULES.includes(f)) problems.push(`${f}: Modul fehlt in MODULES (scripts/modules.js)`);
  for (const f of MODULES) if (!onDisk.includes(f)) problems.push(`${f}: in MODULES eingetragen, Datei fehlt`);
  const mods = MODULES.filter(f => onDisk.includes(f)).map(f => {
    const src = fs.readFileSync(path.join(SRC, f), 'utf8');
    const lines = src.split('\n');
    const imports = [];
    lines.forEach(l => { const m = IMPORT.exec(l); if (m) imports.push({names: m[1].split(',').map(s => s.trim()).filter(Boolean), from: m[2]}); });
    const decls = [], exports = new Set();
    lines.forEach(l => { const m = DECL.exec(l); if (m) { const n = m[1] || m[2]; decls.push(n); if (l.startsWith('export ')) exports.add(n); } });
    const body = lines.filter(l => !IMPORT.test(l)).join('\n');
    return {file: f, src, lines, imports, decls, exports, body};
  });
  return {mods, problems};
}

/** Pfad eines Imports relativ zum importierenden Modul auflösen. */
const resolve = (from, spec) => path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
const relPath = (from, to) => { const p = path.posix.relative(path.posix.dirname(from), to); return p.startsWith('.') ? p : './' + p; };

/** Linke Seiten einer Deklarationsliste („a = f(x, y), {b, c} = o“ → ['a', '{b, c}']), Klammertiefe beachtet. */
function declaredTargets(list) {
  const out = []; let depth = 0, cur = '', inInit = false;
  for (const ch of list) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) { if (depth === 0) break; depth--; }   // Ende von „for (const x of …)“
    if (depth === 0 && ch === ',') { out.push(cur); cur = ''; inInit = false; continue; }
    if (depth === 0 && ch === '=' ) inInit = true;
    if (!inInit) cur += ch;
  }
  out.push(cur);
  return out.map(s => s.split(/\s+(?:of|in)\s+/)[0]);
}

/** Lokal (in Funktionen) deklarierte Namen, die einen Namen eines anderen Moduls überdecken. */
function locallyDeclared(code, name) {
  const n = re(name), word = new RegExp(`(?<![\\w$.])${n}(?![\\w$])`);
  // const/let/var-Deklaration (auch mehrere Namen oder Destrukturierung in einer Anweisung)
  for (const m of code.matchAll(/(?:const|let|var)\s+([^;\n]*)/g)) {
    if (declaredTargets(m[1]).some(s => word.test(s))) return true;
  }
  // Parameter von Funktionen und Pfeilfunktionen
  for (const m of code.matchAll(/function\s*[\w$]*\s*\(([^)]*)\)|\(([^()]*)\)\s*=>|(?<![\w$.])([A-Za-z_$][\w$]*)\s*=>/g)) {
    const params = (m[1] ?? m[2] ?? m[3]).split(',').map(s => s.split('=')[0]);
    if (params.some(s => word.test(s))) return true;
  }
  return false;
}

function analyze() {
  const {mods, problems} = readModules();
  const owner = new Map();
  for (const m of mods) for (const n of m.decls) {
    if (owner.has(n)) problems.push(`${m.file}: „${n}“ ist bereits in ${owner.get(n)} deklariert – Namen müssen eindeutig sein`);
    else owner.set(n, m.file);
  }
  const byFile = new Map(mods.map(m => [m.file, m]));
  const wanted = new Map();
  for (const m of mods) {
    const code = stripComments(m.body).replace(/\$\{/g, ' {');   // „${“ in Template-Strings ist keine Verwendung von $
    const used = new Set(code.match(/(?<![.\w$])[A-Za-z_$][\w$]*/g));
    // $ und $$ (DOM-Kurzformen) nur als Aufruf zählen – ein „$“ in Regex-Literalen (/…$/) ist ein Anker
    for (const n of ['$', '$$']) if (!new RegExp(`(?<![\\w$.])${re(n)}\\s*\\(`).test(code)) used.delete(n);
    const need = new Map();
    for (const n of used) {
      const o = owner.get(n);
      if (!o || o === m.file) continue;
      if (locallyDeclared(code, n)) continue;
      if (!need.has(o)) need.set(o, []);
      need.get(o).push(n);
    }
    wanted.set(m.file, need);
    // Vorhandene Importe prüfen
    const have = new Map();
    for (const imp of m.imports) {
      const target = resolve(m.file, imp.from);
      const t = byFile.get(target);
      if (!t) { problems.push(`${m.file}: Import aus unbekanntem Modul '${imp.from}'`); continue; }
      for (const n of imp.names) {
        if (!t.exports.has(n)) problems.push(`${m.file}: „${n}“ wird aus ${target} importiert, dort aber nicht exportiert`);
        have.set(n, target);
      }
    }
    for (const [o, names] of need) for (const n of names) {
      if (!have.has(n)) problems.push(`${m.file}: „${n}“ aus ${o} wird verwendet, aber nicht importiert`);
      if (byFile.get(o) && !byFile.get(o).exports.has(n)) problems.push(`${o}: „${n}“ wird in ${m.file} gebraucht, ist aber nicht exportiert`);
    }
    for (const [n, t] of have) if (!(need.get(t) || []).includes(n)) problems.push(`${m.file}: Import „${n}“ aus ${t} wird nicht verwendet`);
    // Importierte Bindungen sind nur lesbar
    for (const n of have.keys()) {
      if (new RegExp(`(?<![\\w$.])${re(n)}\\s*(?:=(?![=>])|\\+\\+|--|[-+*/]=)`).test(code) && !locallyDeclared(code, n))
        problems.push(`${m.file}: importierte Variable „${n}“ wird neu zugewiesen – Setter im Modul ${have.get(n)} verwenden`);
    }
  }
  return {mods, problems, wanted};
}

/** import-Zeilen aller Module aus der tatsächlichen Verwendung neu schreiben. */
function fixImports() {
  const {mods, wanted} = analyze();
  for (const m of mods) {
    const need = wanted.get(m.file);
    const block = [...need.keys()].sort((a, b) => MODULES.indexOf(a) - MODULES.indexOf(b))
      .map(o => `import {${need.get(o).sort((a, b) => a.localeCompare(b, 'en')).join(', ')}} from '${relPath(m.file, o)}';`);
    const lines = m.lines.filter(l => !IMPORT.test(l));
    // Importblock nach der ersten Kommentarzeile (Modulbeschreibung) einsetzen
    while (lines[1] === '') lines.splice(1, 1);
    const out = [lines[0], ...block, ...(block.length ? [''] : []), ...lines.slice(1)];
    const text = out.join('\n');
    if (text !== m.src) fs.writeFileSync(path.join(SRC, m.file), text);
  }
}

/** Alle Module zu einem klassischen Skript zusammenfügen (für die HTML-Datei und die Tests). */
function bundle() {
  const {mods, problems} = readModules();
  if (problems.length) throw new Error(problems.join('\n'));
  const parts = ['"use strict";'];
  for (const m of mods) {
    parts.push(`/* ===== src/js/${m.file} ===== */`);
    parts.push(m.lines.filter(l => !IMPORT.test(l)).map(l => DECL.test(l) ? l.replace(/^export /, '') : l).join('\n').replace(/\n+$/, ''));
  }
  return parts.join('\n') + '\n';
}

module.exports = {MODULES, analyze, bundle, fixImports};

if (require.main === module) {
  if (process.argv.includes('--fix')) fixImports();
  const {problems} = analyze();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log(`Module in Ordnung (${MODULES.length} Dateien).`);
}
