// Prüfung der Module unter src/js/: Sind alle Importe vorhanden, verwendet und exportiert?
//
// Die Quellen sind ES-Module mit import/export; gebündelt werden sie von esbuild (scripts/build.js).
// esbuild meldet Importe nicht exportierter Namen, aber keine vergessenen Importe – ein vergessener
// Import fiele erst beim Klicken im Browser auf. Diese Prüfung schließt die Lücke ohne weitere Werkzeuge.
// Sie erkennt Namen per Textmuster und setzt deshalb voraus, dass jeder Name auf oberster Ebene nur in
// einem Modul deklariert ist (wird ebenfalls geprüft).
//
// Aufruf:  node scripts/modules.js          → prüft Importe, Exit-Code 1 bei Problemen
//          node scripts/modules.js --fix    → schreibt die import-Zeilen aller Module neu
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'js');

// Schichtenfolge – bestimmt nur die Reihenfolge der import-Zeilen; neue Module ohne Eintrag stehen am Ende.
const LAYERS = ['util.js', 'state.js', 'lvvo.js', 'parse.js', 'checks.js', 'model.js', 'teaching.js', 'doku.js', 'charts.js', 'render.js', 'views/', 'plan/', 'search.js', 'main.js', 'app.js'];
const rank = f => { const i = LAYERS.findIndex(l => l.endsWith('/') ? f.startsWith(l) : f === l); return i < 0 ? LAYERS.length : i; };

/** Alle Module unter src/js/ (ohne package.json), in Schichtenfolge. */
function listModules() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) out.push(path.relative(SRC, p).split(path.sep).join('/'));
    }
  })(SRC);
  return out.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const DECL = /^(?:export\s+)?(?:async\s+)?(?:function\*?\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*))/;
const IMPORT = /^import \{([^}]*)\} from '([^']+)';\s*$/;

/** Kommentare entfernen (Strings bleiben: Template-Ausdrücke enthalten Code). */
/** Nur den Code behalten: Kommentare, Strings, Regex-Literale und der Textanteil von Template-Strings werden
 *  durch Leerzeichen ersetzt (Zeilenumbrüche bleiben), Ausdrücke in ${…} bleiben erhalten. */
function codeOnly(src) {
  let out = '', i = 0;
  const n = src.length, blank = t => t.replace(/[^\n]/g, ' ');
  const stack = [];   // offene Template-Strings: Klammertiefe des jeweiligen ${…}
  let prevSig = '';   // letztes bedeutsames Zeichen (für die Unterscheidung Regex / Division)
  const regexAllowed = () => !prevSig || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prevSig) || /\b(return|typeof|case|in|of|delete|void|throw|new)$/.test(prevSig);
  const readTemplateText = () => {   // ab i (nach ` oder }) bis ` oder ${
    let j = i;
    while (j < n && src[j] !== '`' && !(src[j] === '$' && src[j + 1] === '{')) j += src[j] === '\\' ? 2 : 1;
    out += blank(src.slice(i, j));
    if (src[j] === '`') { out += ' '; i = j + 1; prevSig = 'x'; }
    else { out += '  '; i = j + 2; stack.push(0); prevSig = '{'; }
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { const j = src.indexOf('\n', i); const e = j < 0 ? n : j; out += blank(src.slice(i, e)); i = e; continue; }
    if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); const e = j < 0 ? n : j + 2; out += blank(src.slice(i, e)); i = e; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1; while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out += blank(src.slice(i, j + 1)); i = j + 1; prevSig = 'x'; continue;
    }
    if (c === '`') { out += ' '; i++; readTemplateText(); continue; }
    if (stack.length && c === '{') { stack[stack.length - 1]++; out += c; i++; prevSig = c; continue; }
    if (stack.length && c === '}') {
      if (stack[stack.length - 1] === 0) { stack.pop(); out += ' '; i++; readTemplateText(); continue; }
      stack[stack.length - 1]--; out += c; i++; prevSig = c; continue;
    }
    if (c === '/' && regexAllowed()) {
      let j = i + 1, cls = false;
      while (j < n && src[j] !== '\n' && (cls || src[j] !== '/')) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; j++; }
      j++; while (j < n && /[a-z]/.test(src[j])) j++;
      out += blank(src.slice(i, j)); i = j; prevSig = 'x'; continue;
    }
    out += c;
    if (!/\s/.test(c)) prevSig = /[\w$]/.test(c) ? (prevSig.match(/[\w$]*$/)[0] + c).slice(-8) : c;
    i++;
  }
  return out;
}
const re = s => s.replace(/[$]/g, '\\$');
// Davor weder ein Namenszeichen noch ein einzelner Punkt (obj.name ist eine Eigenschaft); „...name“ (Spread) ist eine Verwendung.
const NOT_PROP = '(?<![\\w$])(?<!(?:^|[^.])\\.)';

function readModules() {
  const problems = [];
  const mods = listModules().map(f => {
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
  const n = re(name), word = new RegExp(`${NOT_PROP}${n}(?![\\w$])`);
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
    // Objektschlüssel („{name: …}“, „, name: …“) sind keine Verwendung des Namens; die Kurzform „{name}“ schon
    const code = codeOnly(m.body).replace(/([{,]\s*)[A-Za-z_$][\w$]*(\s*:)(?!:)/g, '$1 $2');
    const used = new Set(code.match(new RegExp(`${NOT_PROP}[A-Za-z_$][\\w$]*`, 'g')));
    // $ und $$ (DOM-Kurzformen) nur als Aufruf zählen – ein „$“ in Regex-Literalen (/…$/) ist ein Anker
    for (const n of ['$', '$$']) if (!new RegExp(`${NOT_PROP}${re(n)}\\s*\\(`).test(code)) used.delete(n);
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
      if (new RegExp(`${NOT_PROP}${re(n)}\\s*(?:=(?![=>])|\\+\\+|--|[-+*/]=)`).test(code) && !locallyDeclared(code, n))
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
    const block = [...need.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
      .map(o => `import {${need.get(o).sort((a, b) => a.localeCompare(b, 'en')).join(', ')}} from '${relPath(m.file, o)}';`);
    const lines = m.lines.filter(l => !IMPORT.test(l));
    // Importblock nach dem Kommentarblock am Dateianfang (Modulbeschreibung) einsetzen
    let k = 0; while (k < lines.length && lines[k].startsWith('//')) k++;
    while (lines[k] === '' && lines[k + 1] === '') lines.splice(k, 1);
    const rest = lines.slice(k); if (rest[0] === '' && block.length) rest.shift();
    const out = [...lines.slice(0, k), ...block, ...(block.length ? [''] : []), ...rest];
    const text = out.join('\n');
    if (text !== m.src) fs.writeFileSync(path.join(SRC, m.file), text);
  }
}

module.exports = {listModules, analyze, fixImports};

if (require.main === module) {
  if (process.argv.includes('--fix')) fixImports();
  const {problems} = analyze();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log(`Module in Ordnung (${listModules().length} Dateien).`);
}
