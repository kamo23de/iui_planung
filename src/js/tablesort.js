// Alle Tabellen sortierbar: Klick auf eine Spaltenüberschrift sortiert, erneuter Klick kehrt die Richtung um.
//
// Gilt automatisch für jede Tabelle, die gezeichnet wird (Beobachtung des Dokuments), ausgenommen Tabellen mit eigener
// Sortierung (th.sortable), Layout-Tabellen, die Ampel-Matrix der Planung, Tabellen mit data-nosort und der Bericht nach § 18.
// Regeln: Zahlen in deutscher Schreibweise, Datumsangaben und Semester werden erkannt; leere Werte („–“) stehen immer
// am Ende; Summenzeilen am Tabellenende (class „tot“/„sum“) bleiben unten; in gegliederten Tabellen (Gruppenzeile
// class „tot“ mit Zeilen darunter) werden die Gruppen und die Zeilen innerhalb jeder Gruppe sortiert.
// Die gewählte Sortierung bleibt erhalten, wenn eine Tabelle neu gezeichnet wird.

/** Sortierwert eines Zellentexts: Zahl (auch Datum dd.mm.yyyy und Semester „WS 2025/26“ als Zahl), Text oder null (leer). */
export function sortValue(text) {
  const t = String(text ?? '').replace(/[▲▼]/g, '').replace(/\s+/g, ' ').trim();
  if (!t || /^[–—-]$/.test(t)) return null;
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\b/.exec(t);
  if (m) return {n: +m[3] * 10000 + +m[2] * 100 + +m[1]};
  m = /^(WS|SS) ?(\d{4})\b/.exec(t);
  if (m) return {n: +m[2] * 2 + (m[1] === 'WS' ? 1 : 0)};
  m = /^([+−\-±]?)\s?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(?![\d.,]*\/)/.exec(t);   // „1.234,56“, „−3,00“, „+2“, „8,00 max.“; nicht „2026/27“
  if (m) { const v = +(m[2].replace(/\./g, '') + (m[3] ? '.' + m[3] : '')); return {n: m[1] === '−' || m[1] === '-' ? -v : v}; }
  return {s: t};
}

/** Sortierte Reihenfolge (Indizes) der Tabellenzeilen. rows: [{vals: [Sortierwert je Spalte], tot: Summen-/Gruppenzeile?}].
 *  Summenzeilen am Ende bleiben am Ende; Gruppenzeilen mit folgenden Zeilen bilden Blöcke, die als Ganzes sortiert werden
 *  (innerhalb des Blocks die Zeilen). dir 1 = aufsteigend, −1 = absteigend; leere Werte immer am Ende. */
export function orderRows(rows, col, dir) {
  const idx = rows.map((_, i) => i);
  let end = idx.length; while (end > 0 && rows[end - 1].tot) end--;
  const fest = idx.slice(end), rest = idx.slice(0, end);
  const vals = rest.map(i => rows[i].vals[col]).filter(v => v != null);
  const numeric = vals.length && vals.filter(v => 'n' in v).length >= vals.length * 0.6;
  const key = i => { const v = rows[i].vals[col]; return v == null ? null : numeric ? ('n' in v ? v.n : null) : ('s' in v ? v.s : String(v.n)); };
  const cmp = (a, b) => {
    const x = key(a), y = key(b);
    if (x == null || y == null) return (x == null) - (y == null) || a - b;
    const c = numeric ? x - y : String(x).localeCompare(String(y), 'de', {numeric: true});
    return dir * c || a - b;
  };
  // Gruppen: Summenzeile gefolgt von normalen Zeilen
  const gegliedert = rest.some((i, k) => rows[i].tot && k + 1 < rest.length && !rows[rest[k + 1]].tot);
  if (!gegliedert) return [...rest.sort(cmp), ...fest];
  const bloecke = []; let cur = null;
  for (const i of rest) {
    if (rows[i].tot) { cur = {kopf: i, kinder: []}; bloecke.push(cur); }
    else { if (!cur) { cur = {kopf: null, kinder: []}; bloecke.push(cur); } cur.kinder.push(i); }
  }
  bloecke.forEach(b => b.kinder.sort(cmp));
  const ohneKopf = bloecke.filter(b => b.kopf == null), mitKopf = bloecke.filter(b => b.kopf != null).sort((a, b) => cmp(a.kopf, b.kopf));
  return [...ohneKopf, ...mitKopf].flatMap(b => b.kopf == null ? b.kinder : [b.kopf, ...b.kinder]).concat(fest);
}

/* ---------- Anbindung an die Seite ---------- */
const STATE = new Map();   // Tabelle (Container-ID + Nummer) → {text: Spaltenüberschrift, dir}
const SKIP = 'table.layout, table.gm, table[data-nosort], #dkBody table, #start table';

/** Spalte je Überschriftszelle (berücksichtigt colspan/rowspan); nur Zellen mit genau einer Spalte sind sortierbar. */
function headerCells(table) {
  const head = [...table.rows].filter(r => r.cells.length && ![...r.cells].some(c => c.tagName === 'TD'));
  const grid = [];
  head.forEach((r, ri) => {
    let c = 0;
    for (const cell of r.cells) {
      while (grid[ri] && grid[ri][c]) c++;
      for (let dr = 0; dr < (cell.rowSpan || 1); dr++) for (let dc = 0; dc < (cell.colSpan || 1); dc++) { (grid[ri + dr] = grid[ri + dr] || [])[c + dc] = cell; }
      if ((cell.colSpan || 1) === 1) cell.dataset.tsCol = c;
      c += cell.colSpan || 1;
    }
  });
  return {head, cells: head.flatMap(r => [...r.cells]).filter(c => c.dataset.tsCol != null && c.textContent.trim())};
}
function tableKey(table) {
  const box = table.parentElement && table.parentElement.closest('[id]');
  const all = box ? [...box.querySelectorAll('table')] : [];
  return (box ? box.id : '?') + ':' + all.indexOf(table);
}
function sortTable(table, cell, dir) {
  const col = +cell.dataset.tsCol;
  const body = [...table.rows].filter(r => [...r.cells].some(c => c.tagName === 'TD'));
  if (body.length < 2) return;
  const rows = body.map(r => {
    const vals = []; let c = 0;
    for (const td of r.cells) { const v = sortValue(td.innerText ?? td.textContent); for (let k = 0; k < (td.colSpan || 1); k++) vals[c + k] = k ? null : v; c += td.colSpan || 1; }
    return {vals, tot: r.classList.contains('tot') || r.classList.contains('sum')};
  });
  const parent = body[0].parentNode;
  for (const i of orderRows(rows, col, dir)) parent.appendChild(body[i]);
  table.querySelectorAll('th .ts-ind').forEach(s => s.remove());
  const ind = document.createElement('span'); ind.className = 'ts-ind'; ind.textContent = dir > 0 ? ' ▲' : ' ▼'; cell.appendChild(ind);
}
/** Tabellen sortierbar machen und eine gemerkte Sortierung wieder anwenden. Markiert wird jede Überschriftszelle
 *  (class „ts-th“), nicht die Tabelle: Wird der Inhalt einer bestehenden Tabelle ersetzt, wird sie neu eingerichtet. */
export function enhanceTables(root = document) {
  for (const table of root.querySelectorAll('table')) {
    if (table.matches(SKIP) || table.querySelector('th.sortable')) continue;
    const {cells} = headerCells(table);
    if (!cells.length || cells.every(c => c.classList.contains('ts-th'))) continue;
    if ([...table.rows].filter(r => [...r.cells].some(c => c.tagName === 'TD')).length < 2) continue;
    const key = tableKey(table);
    for (const cell of cells) {
      if (cell.classList.contains('ts-th')) continue;
      cell.classList.add('ts-th'); cell.title = cell.title || 'Sortieren – erneuter Klick kehrt die Richtung um';
      cell.addEventListener('click', ev => {
        if (ev.target.closest('a, button, input, select')) return;
        const st = STATE.get(key), text = cell.textContent.replace(/[▲▼]/g, '').trim();
        const dir = st && st.text === text ? -st.dir : 1;
        STATE.set(key, {text, dir}); sortTable(table, cell, dir);
      });
    }
    const st = STATE.get(key);
    if (st) { const cell = cells.find(c => c.textContent.replace(/[▲▼]/g, '').trim() === st.text); if (cell) sortTable(table, cell, st.dir); }
  }
}
/** Beim Start aufrufen: beobachtet das Dokument und macht jede neu gezeichnete Tabelle sortierbar. */
export function initTableSort() {
  let queued = false;
  const run = () => { queued = false; enhanceTables(document); };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } }).observe(document.body, {childList: true, subtree: true});
  run();
}
