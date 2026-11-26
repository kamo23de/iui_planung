// Globale Personensuche
import {$, $$, esc} from './util.js';
import {S} from './state.js';
import {clusterOf, kreisOf} from './parse.js';
import {inContract, isActive, used} from './model.js';
import {fillClusterSelect} from './views/semester.js';
import {contractStatus, renderDetail} from './views/detail.js';
import {closePerson, showPerson} from './views/person.js';
import {showTab} from './main.js';

/* Treffer: Anfang von Nachname, Vorname, „Vorname Name“, „Name, Vorname“ oder Personalnummer – ohne Rücksicht auf
   Groß-/Kleinschreibung und Akzente („muller“ findet „Müller“). Tab vervollständigt wie in der Unix-Shell bis zum
   längsten gemeinsamen Anfang aller Treffer; ist nichts mehr zu ergänzen, springt Tab durch die Liste. */
export const GS = {items: [], sel: -1, completion: ''};
export const gsNorm = t => [...String(t ?? '')].map(c => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()[0] || c.toLowerCase()).join('');
export function gsKeys(r) {
  const nv = [r.name, r.vorname].filter(Boolean).join(', '), vn = [r.vorname, r.name].filter(Boolean).join(' ');
  return [nv, vn, [r.name, r.vorname].filter(Boolean).join(' '), r.pnr].filter(Boolean);
}
export function gsMatches(q) {
  const nq = gsNorm(q.trim()); if (!nq) return [];
  const out = [];
  for (const r of used()) {
    const key = gsKeys(r).find(k => gsNorm(k).startsWith(nq));
    if (key) out.push({r, key, rank: gsNorm(r.name).startsWith(nq) ? 0 : gsNorm(r.vorname).startsWith(nq) ? 1 : 2});
  }
  return out.sort((a, b) => a.rank - b.rank || a.r.name.localeCompare(b.r.name, 'de') || a.r.vorname.localeCompare(b.r.vorname, 'de') || (isActive(b.r, S.today) - isActive(a.r, S.today)));
}
/* Längster gemeinsamer Anfang (ohne Rücksicht auf Groß-/Kleinschreibung und Akzente), in der Schreibweise des ersten Treffers */
export function gsCommonPrefix(keys) {
  if (!keys.length) return '';
  let p = keys[0];
  for (const k of keys.slice(1)) { let i = 0; const a = gsNorm(p), b = gsNorm(k); while (i < a.length && i < b.length && a[i] === b[i]) i++; p = p.slice(0, i); }
  return p;
}
export function gsRender() {
  const q = $('#gsInput').value, list = $('#gsList');
  const m = gsMatches(q);
  GS.items = m.slice(0, 12);
  if (GS.sel >= GS.items.length) GS.sel = GS.items.length - 1;
  // Vervollständigung (Ghost-Text): gemeinsamer Anfang der Schlüssel, die mit der Eingabe beginnen
  const lcp = gsCommonPrefix([...new Set(m.map(x => x.key))]);
  GS.completion = lcp.length > q.length && gsNorm(lcp).startsWith(gsNorm(q)) ? lcp : '';
  $('.gs-t').textContent = q; $('.gs-c').textContent = GS.completion ? GS.completion.slice(q.length) : '';
  if (!q.trim()) { list.classList.add('hidden'); $('#gsInput').setAttribute('aria-expanded', 'false'); return; }
  const hl = (txt) => { const nt = gsNorm(txt), nq = gsNorm(q.trim()); return nt.startsWith(nq) ? `<b>${esc(txt.slice(0, nq.length))}</b>${esc(txt.slice(nq.length))}` : esc(txt); };
  list.innerHTML = (GS.items.length ? GS.items.map((x, i) => { const r = x.r, st = contractStatus(r);
      return `<div class="gs-item${i === GS.sel ? ' on' : ''}" role="option" data-row="${r.row}" aria-selected="${i === GS.sel}">
        <span class="gs-n">${hl([r.name, r.vorname].filter(Boolean).join(', ') || '(ohne Namen)')}</span><span class="gs-s">${st.t}</span>
        <span class="gs-m">${esc(r.pnr || '–')} · ${esc(kreisOf(r))} · ${esc(clusterOf(r))}${r.oe ? ' · ' + esc(r.oe) : ''}${r.vertretungFuer ? ' · Vertretung' : ''}</span></div>`; }).join('')
    : '<div class="gs-foot" style="border:0">Keine Person gefunden.</div>') +
    (m.length > GS.items.length ? `<div class="gs-foot">… und ${m.length - GS.items.length} weitere – weiter tippen oder Tab drücken</div>` : m.length ? `<div class="gs-foot">${m.length} ${m.length === 1 ? 'Treffer' : 'Treffer'} · ↑/↓ wählen · Enter öffnet · Esc schließt</div>` : '');
  list.classList.remove('hidden'); $('#gsInput').setAttribute('aria-expanded', 'true');
  $$('#gsList .gs-item').forEach(el => el.onmousedown = e => { e.preventDefault(); gsOpen(+el.dataset.row); });
}
export function gsOpen(row) { gsClose(); $('#gsInput').blur(); showPerson(row); GS.fromSearch = true; }
export function gsClear() { $('#gsInput').value = ''; $('.gs-t').textContent = ''; $('.gs-c').textContent = ''; GS.items = []; GS.completion = ''; gsClose(); }
export function gsClose() { $('#gsList').classList.add('hidden'); $('#gsInput').setAttribute('aria-expanded', 'false'); GS.sel = -1; $('.gs-c').textContent = ''; }
export function gsKey(e) {
  const n = GS.items.length;
  if (e.key === 'Tab' && !e.shiftKey && $('#gsInput').value.trim()) {
    e.preventDefault();
    if (GS.completion) { $('#gsInput').value = GS.completion; GS.sel = -1; gsRender(); }
    else if (n) { GS.sel = (GS.sel + 1) % n; gsRender(); }            // nichts mehr zu ergänzen: durch die Treffer gehen
  } else if (e.key === 'ArrowDown' && n) { e.preventDefault(); GS.sel = (GS.sel + 1) % n; gsRender(); }
  else if (e.key === 'ArrowUp' && n) { e.preventDefault(); GS.sel = (GS.sel - 1 + n) % n; gsRender(); }
  else if (e.key === 'ArrowRight' && GS.completion && e.target.selectionStart === e.target.value.length) { e.preventDefault(); $('#gsInput').value = GS.completion; gsRender(); }
  else if (e.key === 'Enter') { e.preventDefault(); const it = GS.items[GS.sel >= 0 ? GS.sel : 0]; if (it && (GS.sel >= 0 || n === 1 || gsNorm(it.key) === gsNorm($('#gsInput').value.trim()))) gsOpen(it.r.row); else if (n) { GS.sel = 0; gsRender(); } }
  else if (e.key === 'Escape') { e.preventDefault(); if (!$('#gsList').classList.contains('hidden')) gsClose(); else { $('#gsInput').value = ''; gsRender(); $('#gsInput').blur(); } }
}
/* Aus dem Personenfenster: Person in der Detailliste zeigen und kurz hervorheben */
export function showInDetail(rowNo) {
  const r = S.recs.find(x => x.row === rowNo); if (!r) return;
  closePerson(); showTab('detail');
  fillClusterSelect($('#dtCluster')); $('#dtCluster').value = clusterOf(r);
  $('#dtLab').value = ''; $('#dtOE').value = ''; $('#dtSoon').checked = false;
  if (!inContract(r, S.today)) $('#dtAll').checked = true;
  $('#dtSearch').value = '';
  renderDetail();
  const tr = $(`#dtLists tr.prow[data-row="${r.row}"]`);
  if (tr) { const d = tr.closest('details'); if (d) d.open = true; tr.scrollIntoView({block: 'center'}); tr.classList.remove('flash'); void tr.offsetWidth; tr.classList.add('flash'); }
}
