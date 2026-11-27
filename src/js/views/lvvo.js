// Ansicht Lehrverpflichtung (LVVO Niedersachsen, Fachhochschulen)
import {$, $$, css, esc, fmtD, nf0, nf1, nf2, parseIso, r2, semIdx, semLabel, semStart, sumBy} from '../util.js';
import {S} from '../state.js';
import {lvvoFassung} from '../lvvo.js';
import {catColor, clusterOf} from '../parse.js';
import {clusterList, inContract, used} from '../model.js';
import {lehreStats, lvvo, lvvoStats, zeitkonto} from '../teaching.js';
import {DOKU_CSS, dokuDatei, dokuDaten, dokuHtml, sjLabel, sjStart, studienjahre} from '../doku.js';
import {axis, barDs, legendHtml, mkChart} from '../charts.js';
import {showPerson} from './person.js';
import {fillClusterSelect} from './semester.js';

export function renderLvvo() {
  const cur = semIdx(S.today), sel = $('#lvWhen'), prev = sel.value;
  sel.innerHTML = `<option value="today">heute (${fmtD(S.today)})</option>` + Array.from({length: 20}, (_, j) => cur + 1 + j).map(i => `<option value="${i}">${semLabel(i)}</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === prev) ? prev : 'today';
  const D = sel.value === 'today' ? S.today : semStart(+sel.value);
  fillClusterSelect($('#lvCluster'));
  const cf = $('#lvCluster').value || null;
  const F = lvvoFassung(D), nf = v => nf1.format(v), lvs = v => nf(v) + ' LVS';

  const hasDep = 'deputat' in S.colMap, hasErm = !!S.raw.erm;
  $('#lvMissing').innerHTML = [!hasDep ? 'ℹ Ohne Spalte <b>Deputat</b> zählt die Lehre der WiMi mit 0 LVS. Professuren und LfbA werden nach der LVVO gerechnet.' : '',
    !hasErm ? 'ℹ Kein Blatt <b>Ermäßigungen</b> gefunden – es werden keine Ermäßigungen berücksichtigt.' : ''].filter(Boolean).join('<br>');
  $('#lvMissing').classList.toggle('hidden', hasDep && hasErm);

  const act = used().filter(r => inContract(r, D) && (!cf || clusterOf(r) === cf));
  const st = lvvoStats(act, D);
  const pctOfRegel = v => st.regel ? nf(r2(v / st.regel * 100)) + ' %' : '–';
  $('#lvSub').textContent = `Stand ${fmtD(D)}${sel.value === 'today' ? '' : ' (' + semLabel(+sel.value) + ')'}${cf ? ' · Cluster ' + cf : ' · ganze Fakultät'} · ${F.titel}, ${F.fassung}.`;
  const quoteTxt = st.p9Quote == null ? '–' : nf(st.p9Quote) + ' %';
  $('#lvKpis').innerHTML = [
    ['Regellehrverpflichtung', lvs(st.regel), `Professuren und LfbA, anteilig nach VZÄ (${(st.byGruppe.prof || {}).n || 0} Professuren, ${((st.byGruppe.lfba20 || {}).n || 0) + ((st.byGruppe.lfba24 || {}).n || 0)} LfbA)`],
    ['Ermäßigungen', lvs(st.erm), `${pctOfRegel(st.erm)} der Regellehrverpflichtung`],
    ['Quote § 9', quoteTxt, st.p9Quote == null ? '' : `${st.p9Quote > st.p9Grenze ? '⚠ über' : '✓ innerhalb'} der Grenze ${nf(st.p9Grenze)} % (hochschulweit; hier nur Fakultät)`],
    ['Soll Professuren und LfbA', lvs(st.soll), 'Regellehrverpflichtung abzüglich Ermäßigungen'],
    ['Lehre der WiMi', lvs(st.wimi), `festgelegt (Deputat); Höchstlehrverpflichtung ${lvs(st.wimiHoechst)}`],
    ['Lehrverpflichtung gesamt', lvs(st.lehre), 'LVS je Semester'],
  ].map(([l, v, d]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');

  // ---- je Cluster ----
  const cls = clusterList().filter(c => act.some(r => clusterOf(r) === c));
  const cs = Object.fromEntries(cls.map(c => [c, lvvoStats(act.filter(r => clusterOf(r) === c), D)]));
  const part = (o, keys) => sumBy(keys, k => (o.byGruppe[k] || {}).soll || 0);
  const series = [['Professuren', ['prof'], catColor('Professor/in')], ['LfbA', ['lfba20', 'lfba24'], catColor('LfbA')], ['WiMi', ['wimi', 'wimiQ'], catColor('WiMi')]];
  $('#lgLvCl').innerHTML = legendHtml([...series.map(([l, , c]) => [c, l]), [css('--muted'), 'Ermäßigungen']]);
  $('#lvClBox').style.height = Math.max(200, cls.length * 44 + 60) + 'px';
  mkChart('cLvCl', {type: 'bar', data: {labels: cls, datasets: [
    ...series.map(([l, keys, c]) => barDs(l, cls.map(k => part(cs[k], keys)), c, {stack: 's'})),
    barDs('Ermäßigungen', cls.map(k => cs[k].erm), css('--muted'), {stack: 's'}),
  ]}, options: {indexAxis: 'y', scales: {x: axis({stacked: true, beginAtZero: true, title: {display: true, text: 'LVS je Semester'}}), y: axis({stacked: true, grid: {display: false}})},
    plugins: {tooltip: {mode: 'index', filter: x => x.raw > 0, callbacks: {label: c => ` ${c.dataset.label}: ${lvs(c.raw)}`}}}}});

  const head = '<tr><th>Cluster</th><th class="n">Personen</th><th class="n">Regellehr­verpflichtung</th><th class="n">Ermäßigungen</th><th class="n">Soll Prof./LfbA</th><th class="n">Lehre WiMi</th><th class="n">Höchst WiMi</th><th class="n">Gesamt</th><th class="n">Quote § 9</th></tr>';
  const row = (lbl, o, cls_) => `<tr${cls_ ? ` class="${cls_}"` : ''}><td>${lbl}</td><td class="n">${nf0.format(o.n)}</td><td class="n">${nf(o.regel)}</td><td class="n">${nf(o.erm)}</td><td class="n">${nf(o.soll)}</td><td class="n">${nf(o.wimi)}</td><td class="n">${nf(o.wimiHoechst)}</td><td class="n"><b>${nf(o.lehre)}</b></td><td class="n">${o.p9Quote == null ? '–' : nf(o.p9Quote) + ' %'}</td></tr>`;
  $('#lvTable').innerHTML = `<table>${head}${cls.map(c => row(esc(c), cs[c])).join('')}${row(cf ? 'Cluster gesamt' : 'Fakultät gesamt', st, 'tot')}</table>` +
    '<p class="note">LVS je Semester. Soll = Regellehrverpflichtung (anteilig nach VZÄ) abzüglich Ermäßigungen. Lehre WiMi = Spalte „Deputat“; die LVVO nennt für WiMi nur eine Höchstlehrverpflichtung.</p>';

  // ---- Ermäßigungen nach Grund ----
  const grRows = Object.entries(st.byGrund).sort((a, b) => b[1] - a[1]);
  const lbl = k => { const g = F.gruende.find(x => x.key === k); return g ? `${esc(g.label)} <span class="note">${g.ref}</span>` : 'Grund nicht erkannt'; };
  $('#lvGrund').innerHTML = !grRows.length ? '<p class="note">Am Stichtag sind keine Ermäßigungen eingetragen.</p>' :
    `<table><tr><th>Grund</th><th class="n">LVS</th><th class="n">Anteil an der Regellehrverpflichtung</th></tr>${grRows.map(([k, v]) => `<tr><td>${lbl(k)}</td><td class="n">${nf(v)}</td><td class="n">${pctOfRegel(v)}</td></tr>`).join('')}` +
    `<tr class="tot"><td>davon nach § 9</td><td class="n">${nf(st.ermP9)}</td><td class="n">${st.p9Quote == null ? '–' : nf(st.p9Quote) + ' %'} <span class="note">(Grenze ${nf(st.p9Grenze)} %)</span></td></tr>` +
    `<tr class="tot"><td>Ermäßigungen gesamt</td><td class="n">${nf(st.erm)}</td><td class="n">${pctOfRegel(st.erm)}</td></tr></table>` +
    `<p class="note">${F.p9.ref}: Ermäßigungen nach § 9 hochschulweit höchstens ${F.p9.quote} % der Regellehrverpflichtungen, bis ${F.p9.quoteErweitert} % in dem Maß, in dem WiMi Lehre nach § 5 Abs. 2 erbringen (Auslegung: ${F.p9.quote} % + Lehre der WiMi in % der Regellehrverpflichtungen).</p>`;

  // ---- je Person (sortierbar) ----
  LV_LIST = {people: act.map(r => ({r, x: lvvo(r, D)})).filter(o => lvPflicht(o.x) > 0.005), F, cf};
  drawLvPersons();

  renderLehre(cf);
  renderDokuAuswahl();

  // ---- Regelwerk ----
  const gr = Object.values(F.gruppen).filter(g => g.art !== 'keine');
  $('#lvRules').innerHTML = `<p class="note" style="margin-top:0">${esc(F.titel)} · ${esc(F.fassung)} · gültig ab ${fmtD(parseIso(F.gueltigAb))} · Quelle: <a href="${esc(F.quelle)}" target="_blank" rel="noopener">${esc(F.quelle)}</a></p>` +
    `<div class="layout-grid"><div><h3 class="layout-h">Lehrverpflichtung je Semester</h3><table class="layout">${gr.map(g => `<tr><td>${esc(g.label)}</td><td>${g.lvs} LVS ${g.art === 'regel' ? '(Regel)' : '(höchstens)'} · ${g.ref}</td></tr>`).join('')}` +
    `<tr><td>Teilzeit</td><td>anteilig nach VZÄ · § 2 Abs. 3</td></tr></table></div>` +
    `<div><h3 class="layout-h">Ermäßigungen</h3><table class="layout">${F.gruende.map(g => `<tr><td>${esc(g.label)}</td><td>${g.maxPct ? `bis ${g.maxPct} % · ` : ''}${g.ref}</td></tr>`).join('')}` +
    `<tr><td>Je Professur nach § 9</td><td>höchstens ${F.p9.profMax} LVS, für Forschung/Entwicklung/Transfer ${F.p9.profMaxForschung} LVS · ${F.p9.ref}</td></tr></table></div></div>` +
    `<p class="note">Annahmen dieser Auswertung: LfbA ab E13/A13 gehören zum zweiten Einstiegsamt (20 LVS), darunter 24 LVS. Befristete WiMi werden als „auch zur Weiterqualifikation beschäftigt“ gewertet (höchstens 4 LVS), unbefristete mit höchstens 8 LVS. ` +
    `Abweichungen lassen sich je Person in der Spalte „LVVO-Gruppe“ eintragen (Professur, LfbA 20, LfbA 24, WiMi, WiMi Qualifikation, keine). Ermäßigungen in Prozent beziehen sich auf die anteilige Lehrverpflichtung der Person.</p>`;
}

/* ---------- Gehaltene Lehre und Zeitkonto ---------- */
function renderLehre(cf) {
  const sems = [...new Set((S.teaching || []).filter(t => t.ok).map(t => t.sem))].sort((a, b) => a - b);
  const sel = $('#lvSem'), prev = sel.value;
  if (!sems.length) {
    sel.innerHTML = ''; $('#lvLehreKpis').innerHTML = '';
    $('#lvKonto').innerHTML = `<p class="note">${S.raw.lehre ? 'Das Blatt „Lehre“ enthält keine gültigen Zeilen.' : 'Kein Blatt <b>Lehre</b> gefunden. Erwartete Spalten: Personalnummer, Semester (z. B. „WS 2026/27“), Veranstaltung, Art, SWS, optional Anteil, Anzahl und LVS.'}</p>`;
    return;
  }
  sel.innerHTML = sems.map(i => `<option value="${i}">${semLabel(i)}</option>`).join('');
  const cur = semIdx(S.today);
  sel.value = sems.includes(+prev) ? prev : String(sems.includes(cur) ? cur : sems[sems.length - 1]);
  const s = +sel.value, nf = v => nf1.format(v);
  const list = used().filter(r => !r.plan && (!cf || clusterOf(r) === cf));
  const st = lehreStats(list, s);
  const sgn = v => `<span class="${v < 0 ? 'down' : 'up'}">${v < 0 ? '−' : v > 0 ? '+' : ''}${nf(Math.abs(v))}</span>`;
  $('#lvLehreKpis').innerHTML = [
    ['Personen mit Lehre', nf0.format(st.n), `${semLabel(s)}${s > cur ? ' (geplant)' : s === cur ? ' (laufend)' : ''}`],
    ['Soll', nf(st.soll) + ' LVS', 'nach LVVO am Semesterbeginn'],
    ['Gehalten', nf(st.ist) + ' LVS', 'angerechnet nach § 14, § 15'],
    ['Saldo', sgn(st.saldo), 'LVS im Semester'],
    ['Zeitkonten', `${sgn(st.guthaben)} / ${sgn(st.fehlbetrag)}`, 'Summe Guthaben / Fehlbeträge am Semesterende' + (st.verfallen ? ` · ${nf(st.verfallen)} LVS verfallen` : '')],
  ].map(([l, v, d]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
  KT_LIST = {ps: st.personen, st};
  drawKonto();
}

/** Zeitkonto aller Personen mit Lehre als CSV: eine Zeile je Person und Semester (Grundlage für § 18). */
export function zeitkontoCsv() {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"', n = v => v == null ? '' : nf1.format(v);
  const head = ['Personalnummer', 'Name', 'Vorname', 'Cluster', 'LVVO-Gruppe', 'Semester', 'Regellehrverpflichtung (LVS)', 'Ermäßigungen (LVS)', 'Ermäßigungsgründe', 'Soll (LVS)',
    'Lehre (LVS)', 'Betreuung (LVS)', 'Gehalten (LVS)', 'Saldo (LVS)', 'Übertrag (LVS)', 'Konto Anfang (LVS)', 'Konto Ende (LVS)', 'verfallen (LVS)', 'Hinweise', 'Lehrveranstaltungen'];
  const lines = [head.map(q).join(';')];
  const rs = used().filter(r => !r.plan && zeitkonto(r)).sort((a, b) => clusterOf(a).localeCompare(clusterOf(b), 'de') || a.name.localeCompare(b.name, 'de'));
  for (const r of rs) for (const e of zeitkonto(r).semester) {
    const x = lvvo(r, semStart(e.sem)), F = x.F;
    const gr = x.erm.map(m => `${(F.gruende.find(g => g.key === m.grund) || {kurz: m.e.grundRaw}).kurz} ${n(m.lvs)}`).join(', ');
    const hinweise = [e.ohneEintrag ? 'keine Lehre eingetragen' : '', e.unterHaelfte && !e.ohneEintrag ? 'unter der Hälfte' : '', e.fehlbetragZuHoch ? 'Fehlbetrag zu hoch' : '', e.betreuungGekappt ? 'Betreuung gekappt (§ 15)' : ''].filter(Boolean).join(', ');
    const lv = e.zeilen.map(t => `${t.titel || '(ohne Titel)'} (${t.artRaw || 'Art ?'}${t.sws != null ? ', ' + n(t.sws) + ' SWS' : ''}${t.anteil !== 1 ? ', Anteil ' + n(t.anteil * 100) + ' %' : ''}${t.anzahl !== 1 ? ', ' + n(t.anzahl) + '×' : ''}: ${n(t.lvs)} LVS)`).join(' | ');
    lines.push([r.pnr, r.name, r.vorname, clusterOf(r), e.gruppe.label, semLabel(e.sem), n(e.regelLvs), n(x.ermSum), gr, n(e.soll), n(e.lehre), n(e.betreuung), n(e.ist), n(e.saldo),
      n(e.uebertrag), n(e.anfang), n(e.ende), n(e.verfallen), hinweise, lv].map(q).join(';'));
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], {type: 'text/csv;charset=utf-8'}));
  a.download = 'Zeitkonto_LVVO.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Dokumentation nach § 18 ---------- */
let DK = null;   // zuletzt erzeugte Dokumentation: {daten, opts}
function renderDokuAuswahl() {
  const sel = $('#dkJahr'), prev = sel.value, jahre = studienjahre();
  sel.innerHTML = jahre.map(w => `<option value="${w}">${sjLabel(w)}${w === sjStart(semIdx(S.today)) ? ' (laufend)' : ''}</option>`).join('');
  // vorgeschlagen: das letzte abgeschlossene Studienjahr mit erfasster Lehre, sonst das laufende
  const lauf = sjStart(semIdx(S.today)), fertig = jahre.find(w => w < lauf);
  sel.value = jahre.includes(+prev) ? prev : String(fertig ?? lauf);
  fillClusterSelect($('#dkCluster'));
  const w = +sel.value;
  $('#dkInfo').textContent = !S.raw.lehre ? 'Hinweis: Es gibt kein Blatt „Lehre“ – der Bericht enthält dann nur Soll und Ermäßigungen, keine gehaltene Lehre.'
    : w >= lauf ? `Das Studienjahr ${sjLabel(w)} ist noch nicht abgeschlossen; die Dokumentation ist vorläufig.` : '';
}
export function showDoku() {
  const w = +$('#dkJahr').value, cluster = $('#dkCluster').value || null;
  const now = new Date(), erstellt = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
  DK = {daten: dokuDaten(w, {cluster}), opts: {seiteJePerson: $('#dkSeite').checked, erstellt: erstellt + (S.isDemo ? ' · DEMO, fiktive Daten' : '')}};
  $('#dkBody').innerHTML = `<style>${DOKU_CSS}</style>` + dokuHtml(DK.daten, DK.opts);
  $('#dkOverlay').classList.remove('hidden'); document.body.classList.add('dk-open'); document.body.style.overflow = 'hidden';
}
export function closeDoku() {
  $('#dkOverlay').classList.add('hidden'); document.body.classList.remove('dk-open'); document.body.style.overflow = ''; $('#dkBody').innerHTML = ''; DK = null;
}
export function printDoku() { window.print(); }
export function saveDoku() {
  if (!DK) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([dokuDatei(DK.daten, DK.opts)], {type: 'text/html;charset=utf-8'}));
  a.download = `Dokumentation_LVVO_18_Studienjahr_${sjLabel(DK.daten.w).replace('/', '-')}${DK.daten.cluster ? '_' + DK.daten.cluster.replace(/[^\wäöüÄÖÜß-]+/g, '_') : ''}.html`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Lehrverpflichtung je Person: sortierbare Tabelle ---------- */
// Spalten: Schlüssel, Überschrift, Sortierwert (null = leer, steht immer am Ende), Zahl?
// Abweichung wie angezeigt: Professuren/LfbA Deputat − Soll; WiMi nur über der Höchstlehrverpflichtung
const lvDiff = x => x.deputat == null ? null : x.gruppe.art === 'regel' ? r2(x.deputat - x.soll) : x.gruppe.art === 'hoechst' && x.deputat > x.basis + 0.005 ? r2(x.deputat - x.basis) : null;
const LV_COLS = [
  ['name', 'Name', o => [o.r.name, o.r.vorname].filter(Boolean).join(', ')],
  ['gruppe', 'LVVO-Gruppe', o => o.x.gruppe.label],
  ['vz', 'VZÄ', o => o.x.anteil, true],
  ['basis', 'Regel / Höchst', o => o.x.basis, true],
  ['erm', 'Ermäßigungen', o => o.x.ermSum || null, true],
  ['soll', 'Soll', o => o.x.soll, true],
  ['deputat', 'Deputat', o => o.x.deputat, true],
  ['abw', 'Abweichung', o => lvDiff(o.x), true],
];
let LV_LIST = {people: [], F: null, cf: null};
/** Lehrverpflichtung vor Ermäßigungen: Professuren/LfbA Regellehrverpflichtung (anteilig), WiMi und Sonstige das Deputat. */
export const lvPflicht = x => x.gruppe.art === 'regel' ? x.basis : x.gruppe.art === 'keine' ? 0 : (x.deputat ?? 0);
const LV_OPEN = new Map();   // Cluster → aufgeklappt? (bleibt beim Neuzeichnen erhalten)
export const LV_SORT = {key: null, dir: 1};   // key null: Grundordnung (Cluster, Gruppe, Name)
export function setLvSort(k) { toggleSort(LV_SORT, k); }
/** Sortierte Kopie einer Liste nach Spalte key (cols: [Schlüssel, Überschrift, Wert, Zahl?]): auf- (dir 1) oder
 *  absteigend (dir −1); leere Werte (null) stehen immer am Ende; Gleichstand und key null: Grundordnung base. */
export function sortByCols(list, cols, key, dir, base) {
  const col = cols.find(c => c[0] === key);
  if (!col) return [...list].sort(base);
  const v = col[2];
  return [...list].sort((a, b) => {
    const x = v(a), y = v(b);
    if (x == null || y == null) return (x == null) - (y == null) || base(a, b);
    const c = col[3] ? x - y : String(x).localeCompare(String(y), 'de');
    return dir * c || base(a, b);
  });
}
/** Umschalten wie bei einer Tabelle: neue Spalte aufsteigend, dieselbe Spalte erneut → Richtung umkehren. */
const toggleSort = (state, k) => { if (state.key === k) state.dir = -state.dir; else { state.key = k; state.dir = 1; } };
const sortHead = (cols, state) => `<tr>${cols.map(([k, l, , num]) => `<th class="sortable${num ? ' n' : ''}" data-k="${k}" title="Sortieren – erneuter Klick kehrt die Richtung um">${l}${state.key === k ? (state.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr>`;
/** Sortierte Kopie: gewählte Spalte auf- oder absteigend, leere Werte am Ende, sonst Grundordnung. */
export function sortLvPeople(people, F, key = LV_SORT.key, dir = LV_SORT.dir) {
  const ord = Object.keys(F.gruppen);
  const base = (a, b) => clusterOf(a.r).localeCompare(clusterOf(b.r), 'de') || ord.indexOf(a.x.key) - ord.indexOf(b.x.key) || a.r.name.localeCompare(b.r.name, 'de') || a.r.vorname.localeCompare(b.r.vorname, 'de');
  return sortByCols(people, LV_COLS, key, dir, base);
}
function drawLvPersons() {
  const {people, F, cf} = LV_LIST, nf = v => nf1.format(v);
  if (!people.length) { $('#lvPersons').innerHTML = '<p class="note">Keine Personen mit Lehrverpflichtung am Stichtag.</p>'; return; }
  const abw = x => { if (x.deputat == null || x.gruppe.art !== 'regel') return x.gruppe.art === 'hoechst' && x.deputat > x.basis + 0.005; return Math.abs(x.deputat - x.soll) >= 0.005; };
  const diffTxt = x => {
    if (x.deputat == null) return '';
    if (x.gruppe.art === 'hoechst') return x.deputat > x.basis + 0.005 ? '<span class="pill sev-W">über Höchstwert</span>' : '';
    const d = r2(x.deputat - x.soll);
    return Math.abs(d) < 0.005 ? '<span class="note">✓</span>' : `<span class="pill sev-W">${d > 0 ? '+' : '−'}${nf(Math.abs(d))}</span>`;
  };
  const arrow = k => LV_SORT.key === k ? (LV_SORT.dir > 0 ? ' ▲' : ' ▼') : '';
  const head = `<tr>${LV_COLS.map(([k, l, , num]) => `<th class="sortable${num ? ' n' : ''}" data-k="${k}" title="Sortieren – erneuter Klick kehrt die Richtung um">${l}${arrow(k)}</th>`).join('')}</tr>`;
  const zeile = ({r, x}) => `<tr><td><a href="#" data-row="${r.row}">${esc([r.name, r.vorname].filter(Boolean).join(', '))}</a></td>` +
    `<td>${esc(x.gruppe.label)}${x.quelle === 'Spalte' ? ' <span class="pill" title="aus Spalte „LVVO-Gruppe“">Tabelle</span>' : ''}${x.annahme ? ` <span class="pill sev-I" title="${esc(x.annahme)}">angenommen</span>` : ''}</td>` +
    `<td class="n">${nf2.format(x.anteil)}</td><td class="n">${nf(x.basis)}${x.gruppe.art === 'hoechst' ? ' <span class="note">max.</span>' : ''}</td>` +
    `<td>${x.erm.map(e => `<span title="${esc([e.e.grundRaw, e.e.text].filter(Boolean).join(' – '))}">${esc((F.gruende.find(g => g.key === e.grund) || {kurz: e.e.grundRaw || 'unbekannt'}).kurz)}: ${nf(e.lvs)}</span>${e.e.text ? ` <span class="note">${esc(e.e.text)}</span>` : ''}`).join('<br>')}</td>` +
    `<td class="n">${x.soll == null ? '–' : nf(x.soll)}</td><td class="n">${x.deputat == null ? '–' : nf(x.deputat)}</td><td>${diffTxt(x)}</td></tr>`;
  const cls = [...new Set(people.map(o => clusterOf(o.r)))].sort((a, b) => (a.startsWith('(') - b.startsWith('(')) || a.localeCompare(b, 'de'));
  const sorted = sortLvPeople(people, F);
  const offen = c => LV_OPEN.has(c) ? LV_OPEN.get(c) : cls.length === 1 || !!cf;
  $('#lvPersons').innerHTML = `<div class="row" style="margin-bottom:8px"><button data-lv-all="1">Alle aufklappen</button><button data-lv-all="0">Alle zuklappen</button>` +
    `<span class="note">${people.length} Personen mit Lehrverpflichtung in ${cls.length} ${cls.length === 1 ? 'Cluster' : 'Clustern'}</span></div>` +
    cls.map(c => {
      const l = sorted.filter(o => clusterOf(o.r) === c), regel = l.filter(o => o.x.gruppe.art === 'regel');
      const k = l.filter(o => abw(o.x)).length;
      return `<details class="kreis" data-cluster="${esc(c)}"${offen(c) ? ' open' : ''}><summary><b>${esc(c)}</b>` +
        `<span class="ksum">${l.length} ${l.length === 1 ? 'Person' : 'Personen'} · Lehrverpflichtung ${nf(sumBy(l, o => lvPflicht(o.x)))} LVS · Ermäßigungen ${nf(sumBy(regel, o => o.x.ermSum))} · Soll ${nf(sumBy(l, o => o.x.soll || 0))} LVS` +
        `${k ? ` · <span class="pill sev-W">${k} ${k === 1 ? 'Abweichung' : 'Abweichungen'}</span>` : ''}</span></summary>` +
        `<div style="overflow-x:auto"><table>${head}${l.map(zeile).join('')}</table></div></details>`;
    }).join('');
  $$('#lvPersons details[data-cluster]').forEach(d => d.addEventListener('toggle', () => LV_OPEN.set(d.dataset.cluster, d.open)));
  $$('#lvPersons button[data-lv-all]').forEach(btn => btn.onclick = () => { const on = btn.dataset.lvAll === '1'; cls.forEach(c => LV_OPEN.set(c, on)); drawLvPersons(); });
  $$('#lvPersons th.sortable').forEach(th => th.onclick = () => { setLvSort(th.dataset.k); drawLvPersons(); });
  $$('#lvPersons a[data-row]').forEach(a => a.onclick = e => { e.preventDefault(); showPerson(+a.dataset.row); });
}

/* ---------- Gehaltene Lehre und Zeitkonto: sortierbare Tabelle ---------- */
const ktFlags = e => [e.ohneEintrag && 'keine Lehre eingetragen', e.unterHaelfte && !e.ohneEintrag && 'unter der Hälfte', e.fehlbetragZuHoch && 'Fehlbetrag zu hoch',
  e.verfallen && `${nf1.format(e.verfallen)} verfallen`, e.betreuungGekappt && 'Betreuung gekappt', e.uebertrag && `Übertrag ${nf1.format(e.uebertrag)}`].filter(Boolean);
const KT_COLS = [
  ['name', 'Name', o => [o.r.name, o.r.vorname].filter(Boolean).join(', ')],
  ['cluster', 'Cluster', o => clusterOf(o.r)],
  ['gruppe', 'LVVO-Gruppe', o => o.e.gruppe.label],
  ['soll', 'Soll', o => o.e.soll, true],
  ['lehre', 'Lehre', o => o.e.lehre, true],
  ['betreuung', 'Betreuung', o => o.e.betreuung, true],
  ['ist', 'Gehalten', o => o.e.ist, true],
  ['saldo', 'Saldo', o => o.e.saldo, true],
  ['anfang', 'Konto Anfang', o => o.e.anfang ?? null, true],
  ['ende', 'Konto Ende', o => o.e.ende ?? null, true],
  ['hinweise', 'Hinweise', o => ktFlags(o.e).length || null, true],   // nach Zahl der Hinweise; ohne Hinweis am Ende
];
let KT_LIST = {ps: [], st: null};
export const KT_SORT = {key: null, dir: 1};   // key null: Grundordnung (Cluster, Name)
export function setKtSort(k) { toggleSort(KT_SORT, k); }
export function sortKonto(ps, key = KT_SORT.key, dir = KT_SORT.dir) {
  const base = (a, b) => clusterOf(a.r).localeCompare(clusterOf(b.r), 'de') || a.r.name.localeCompare(b.r.name, 'de') || a.r.vorname.localeCompare(b.r.vorname, 'de');
  return sortByCols(ps, KT_COLS, key, dir, base);
}
function drawKonto() {
  const {ps, st} = KT_LIST, nf = v => nf1.format(v);
  if (!st) return;
  if (!ps.length) { $('#lvKonto').innerHTML = '<p class="note">Im gewählten Semester und Cluster ist keine Lehre eingetragen.</p>'; return; }
  const sgn = v => `<span class="${v < 0 ? 'down' : 'up'}">${v < 0 ? '−' : v > 0 ? '+' : ''}${nf(Math.abs(v))}</span>`;
  const k = v => v == null ? '<span class="note">–</span>' : sgn(v);
  const pill = t => `<span class="pill ${/verfallen|Übertrag/.test(t) ? (/verfallen/.test(t) ? 'sev-I' : '') : 'sev-W'}">${esc(t)}</span>`;
  $('#lvKonto').innerHTML = `<table>${sortHead(KT_COLS, KT_SORT)}` +
    sortKonto(ps).map(({r, e}) => `<tr><td><a href="#" data-row="${r.row}">${esc([r.name, r.vorname].filter(Boolean).join(', '))}</a></td><td>${esc(clusterOf(r))}</td><td>${esc(e.gruppe.label)}</td>` +
      `<td class="n">${nf(e.soll)}</td><td class="n">${nf(e.lehre)}</td><td class="n">${nf(e.betreuung)}</td><td class="n"><b>${nf(e.ist)}</b></td><td class="n">${sgn(e.saldo)}</td>` +
      `<td class="n">${k(e.anfang)}</td><td class="n">${k(e.ende)}</td><td>${ktFlags(e).map(pill).join(' ')}</td></tr>`).join('') +
    `<tr class="tot"><td>Summe</td><td></td><td></td><td class="n">${nf(st.soll)}</td><td class="n">${nf(sumBy(ps, o => o.e.lehre))}</td><td class="n">${nf(sumBy(ps, o => o.e.betreuung))}</td><td class="n">${nf(st.ist)}</td><td class="n">${sgn(st.saldo)}</td><td></td><td></td><td></td></tr></table>` +
    '<p class="note">LVS je Semester. Konto nur für Professuren und LfbA (Regellehrverpflichtung); bei WiMi wird die gehaltene Lehre mit dem Deputat verglichen. Klick auf eine Spaltenüberschrift sortiert, erneuter Klick kehrt die Richtung um; Klick auf den Namen zeigt das Zeitkonto über alle Semester.</p>';
  $$('#lvKonto th.sortable').forEach(th => th.onclick = () => { setKtSort(th.dataset.k); drawKonto(); });
  $$('#lvKonto a[data-row]').forEach(a => a.onclick = ev => { ev.preventDefault(); showPerson(+a.dataset.row); });
}
