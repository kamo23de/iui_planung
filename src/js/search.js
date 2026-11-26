// Globale Suche: Personen, Laborbereiche, Organisationseinheiten
import {$, $$, esc} from './util.js';
import {S} from './state.js';
import {clusterOf, kreisOf} from './parse.js';
import {inContract, isActive, used} from './model.js';
import {contractStatus, fillLabSelect, fillOESelect, renderDetail} from './views/detail.js';
import {closePerson, showPerson} from './views/person.js';
import {fillClusterSelect} from './views/semester.js';
import {showTab} from './main.js';

/* Treffer in drei Gruppen, in dieser Reihenfolge: Personen, Laborbereiche, Organisationseinheiten.
   Personen: Anfang von Nachname, Vorname, „Vorname Name“, „Name, Vorname“ oder Personalnummer.
   Laborbereiche und Organisationseinheiten: Anfang des Namens oder eines Wortes darin („fert“ findet „Labor Fertigungstechnik“).
   Immer ohne Rücksicht auf Groß-/Kleinschreibung und Akzente („muller“ findet „Müller“). Tab vervollständigt wie in der
   Unix-Shell bis zum längsten gemeinsamen Anfang aller Treffer; ist nichts mehr zu ergänzen, springt Tab durch die Liste. */
export const GS = {items: [], sel: -1, completion: ''};
export const GS_GROUPS = [['person', 'Personen', 8], ['labor', 'Laborbereiche', 5], ['oe', 'Organisationseinheiten', 5]];
export const gsNorm = t => [...String(t ?? '')].map(c => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()[0] || c.toLowerCase()).join('');
export function gsKeys(r) {
  const nv = [r.name, r.vorname].filter(Boolean).join(', '), vn = [r.vorname, r.name].filter(Boolean).join(' ');
  return [nv, vn, [r.name, r.vorname].filter(Boolean).join(' '), r.pnr].filter(Boolean);
}
/** Passt nq (normalisiert) auf den Anfang von name oder eines Wortes darin? Rückgabe: Schlüssel ab dieser Stelle und Rang
 *  (0 = Anfang des Namens, 1 = Anfang eines späteren Wortes), sonst null. */
function wordMatch(name, nq) {
  const n = gsNorm(name);
  if (n.startsWith(nq)) return {key: name, rank: 0};
  for (const m of name.matchAll(/[\s\-/&(]+(?=\S)/g)) {
    const i = m.index + m[0].length;
    if (gsNorm(name.slice(i)).startsWith(nq)) return {key: name.slice(i), rank: 1};
  }
  return null;
}
/** Laborbereiche und Organisationseinheiten der Daten, je Cluster einmal, mit Zahl der aktiven Personen. */
export function gsUnits() {
  const lab = new Map(), oe = new Map();
  for (const r of used()) {
    const act = isActive(r, S.today) ? 1 : 0;
    if (r.labor) { const k = clusterOf(r) + '\u0000' + r.labor; const o = lab.get(k) || lab.set(k, {type: 'labor', name: r.labor, cluster: clusterOf(r), n: 0}).get(k); o.n += act; }
    if (r.oe) { const k = clusterOf(r) + '\u0000' + r.oe; const o = oe.get(k) || oe.set(k, {type: 'oe', name: r.oe, cluster: clusterOf(r), n: 0}).get(k); o.n += act; }
  }
  return {labor: [...lab.values()], oe: [...oe.values()]};
}
export function gsMatches(q) {
  const nq = gsNorm(q.trim()); if (!nq) return [];
  const persons = [];
  for (const r of used()) {
    const key = gsKeys(r).find(k => gsNorm(k).startsWith(nq));
    if (key) persons.push({type: 'person', r, key, rank: gsNorm(r.name).startsWith(nq) ? 0 : gsNorm(r.vorname).startsWith(nq) ? 1 : 2});
  }
  persons.sort((a, b) => a.rank - b.rank || a.r.name.localeCompare(b.r.name, 'de') || a.r.vorname.localeCompare(b.r.vorname, 'de') || (isActive(b.r, S.today) - isActive(a.r, S.today)));
  const units = gsUnits(), byName = (a, b) => a.rank - b.rank || a.u.name.localeCompare(b.u.name, 'de') || a.u.cluster.localeCompare(b.u.cluster, 'de');
  const unitHits = list => list.map(u => { const m = wordMatch(u.name, nq); return m && {type: u.type, u, key: m.key, rank: m.rank}; }).filter(Boolean).sort(byName);
  return [...persons, ...unitHits(units.labor), ...unitHits(units.oe)];
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
  // je Gruppe höchstens so viele Einträge wie in GS_GROUPS angegeben; die Reihenfolge der Gruppen bleibt
  const groups = GS_GROUPS.map(([type, title, max]) => { const all = m.filter(x => x.type === type); return {type, title, all, shown: all.slice(0, max)}; });
  GS.items = groups.flatMap(g => g.shown);
  if (GS.sel >= GS.items.length) GS.sel = GS.items.length - 1;
  // Vervollständigung (Ghost-Text): gemeinsamer Anfang der Schlüssel, die mit der Eingabe beginnen
  const lcp = gsCommonPrefix([...new Set(m.map(x => x.key))]);
  GS.completion = lcp.length > q.length && gsNorm(lcp).startsWith(gsNorm(q)) ? lcp : '';
  $('.gs-t').textContent = q; $('.gs-c').textContent = GS.completion ? GS.completion.slice(q.length) : '';
  if (!q.trim()) { list.classList.add('hidden'); $('#gsInput').setAttribute('aria-expanded', 'false'); return; }
  const nq = gsNorm(q.trim());
  const hl = txt => { const nt = gsNorm(txt), i = nt.startsWith(nq) ? 0 : nt.search(new RegExp('[\\s\\-/&(]' + nq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) + 1;
    return i < 0 || (i === 0 && !nt.startsWith(nq)) ? esc(txt) : `${esc(txt.slice(0, i))}<b>${esc(txt.slice(i, i + nq.length))}</b>${esc(txt.slice(i + nq.length))}`; };
  let idx = 0;
  const item = x => { const i = idx++, on = i === GS.sel ? ' on' : '';
    if (x.type === 'person') { const r = x.r, st = contractStatus(r);
      return `<div class="gs-item${on}" role="option" data-i="${i}" aria-selected="${i === GS.sel}">
        <span class="gs-n">${hl([r.name, r.vorname].filter(Boolean).join(', ') || '(ohne Namen)')}</span><span class="gs-s">${st.t}</span>
        <span class="gs-m">${esc(r.pnr || '–')} · ${esc(kreisOf(r))} · ${esc(clusterOf(r))}${r.oe ? ' · ' + esc(r.oe) : ''}${r.vertretungFuer ? ' · Vertretung' : ''}</span></div>`; }
    const u = x.u;
    return `<div class="gs-item${on}" role="option" data-i="${i}" aria-selected="${i === GS.sel}">
      <span class="gs-n">${hl(u.name)}</span><span class="gs-s"><span class="pill">${x.type === 'labor' ? 'Labor' : 'OE'}</span></span>
      <span class="gs-m">Cluster ${esc(u.cluster)} · ${u.n} ${u.n === 1 ? 'Person' : 'Personen'} aktiv · öffnet die Detailansicht</span></div>`; };
  const shownGroups = groups.filter(g => g.all.length);
  list.innerHTML = (shownGroups.length ? shownGroups.map(g => `<div class="gs-head" role="presentation">${g.title}${g.all.length > g.shown.length ? ` <span class="note">${g.shown.length} von ${g.all.length}</span>` : ''}</div>` + g.shown.map(item).join('')).join('')
    : '<div class="gs-foot" style="border:0">Keine Person, kein Laborbereich und keine Organisationseinheit gefunden.</div>') +
    (m.length ? `<div class="gs-foot">${m.length} Treffer${m.length > GS.items.length ? ' – weiter tippen oder Tab drücken' : ''} · ↑/↓ wählen · Enter öffnet · Esc schließt</div>` : '');
  list.classList.remove('hidden'); $('#gsInput').setAttribute('aria-expanded', 'true');
  $$('#gsList .gs-item').forEach(el => el.onmousedown = e => { e.preventDefault(); gsOpen(GS.items[+el.dataset.i]); });
}
/** Treffer öffnen: Person im Personenfenster, Laborbereich oder Organisationseinheit in der Detailansicht. */
export function gsOpen(it) {
  if (!it) return;
  gsClose(); $('#gsInput').blur();
  if (it.type === 'person') { showPerson(it.r.row); GS.fromSearch = true; return; }
  gsClear();
  showUnitInDetail(it.u);
}
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
  else if (e.key === 'Enter') { e.preventDefault(); const it = GS.items[GS.sel >= 0 ? GS.sel : 0]; if (it && (GS.sel >= 0 || n === 1 || gsNorm(it.key) === gsNorm($('#gsInput').value.trim()))) gsOpen(it); else if (n) { GS.sel = 0; gsRender(); } }
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
/* Laborbereich oder Organisationseinheit in der Detailansicht zeigen: Cluster und passenden Filter setzen */
export function showUnitInDetail(u) {
  closePerson(); showTab('detail');
  fillClusterSelect($('#dtCluster')); $('#dtCluster').value = u.cluster === '(ohne Cluster)' ? '' : u.cluster;
  $('#dtLab').value = ''; $('#dtOE').value = '';
  fillLabSelect();
  if (u.type === 'labor') $('#dtLab').value = encodeURIComponent(u.cluster + '\u0000' + u.name);
  fillOESelect();
  if (u.type === 'oe') $('#dtOE').value = encodeURIComponent(u.name);
  $('#dtSoon').checked = false; $('#dtSearch').value = '';
  renderDetail();
  window.scrollTo(0, 0);   // Filter oben sichtbar; die Diagramme darunter ändern nach dem Zeichnen noch ihre Höhe
}
