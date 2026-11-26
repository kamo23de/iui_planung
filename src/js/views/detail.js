// Ansicht Detailansicht mit Personalliste
import {$, $$, css, esc, fmtD, nf0, nf1, nf2, r2, sumBy} from '../util.js';
import {S} from '../state.js';
import {catColor, clusterOf, kreisColor, kreisOf} from '../parse.js';
import {effDep, effVz, grpOf, inContract, inRestPeriod, isActive, isPartlyResting, isResting, restShare, restVz, status, used} from '../model.js';
import {axis, barDs, legendHtml, mkChart} from '../charts.js';
import {showPerson} from './person.js';
import {fillClusterSelect} from './semester.js';

export const DT = {sort: 'name', dir: 1, group: 'kreis', expanded: false};
export const DT_EXT = new Set(['ruht', 'tarif', 'arb', 'deputat', 'vart', 'beginn']);
/* Schmale Bildschirme (z. B. iPad hochkant): zusätzlich OE und Laborbereich erst beim Erweitern */
export const DT_EXT_NARROW = new Set(['oe', 'labor']);
export const DT_NARROW_PX = 1000;
export const isNarrow = () => window.innerWidth < DT_NARROW_PX;   // nur in der erweiterten Ansicht
export const NOLAB = '(ohne Laborbereich)';
export const labOf = r => r.labor || NOLAB;
export const labKey = r => clusterOf(r) + '\u0000' + labOf(r);
export const labLabel = (key, withCluster) => { const [c, l] = key.split('\u0000'); return withCluster ? `${c} › ${l}` : l; };
export const selLab = () => $('#dtLab').value ? decodeURIComponent($('#dtLab').value) : null;
export const labSort = (a, b) => { const [ca, la] = a.split('\u0000'), [cb, lb] = b.split('\u0000');
  return ca.localeCompare(cb, 'de') || ((la === NOLAB) - (lb === NOLAB)) || la.localeCompare(lb, 'de'); };
export const DT_COLS = [
  ['pnr', 'Pers.-Nr.', r => r.pnr],
  ['name', 'Name', r => r.name],
  ['vorname', 'Vorname', r => r.vorname],
  ['kreis', 'Mitarbeiterkreis', r => S.kreisOrder.indexOf(kreisOf(r))],
  ['cluster', 'Cluster', r => clusterOf(r)],
  ['oe', 'Organisationseinheit', r => r.oe],
  ['labor', 'Laborbereich', r => r.labor || '￿'],
  ['tarif', 'TrfGr', r => r.tarif],
  ['arb', 'ArbAnteil', r => r.arb, 'n'],
  ['vz', 'VZÄ', r => r.vz, 'n'],
  ['deputat', 'Deputat (SWS)', r => r.deputat ?? -1, 'n'],
  ['vart', 'Vertragsart', r => r.vart],
  ['beginn', 'Beginn', r => r.beginn, 'n'],
  ['ende', 'Vertrags\u00adende / Ruhe\u00adstand', r => r.ende == null ? Infinity : r.ende, 'n'],
  ['ruht', 'ruht bis', r => r.ruht ?? -Infinity, 'n'],
  ['rest', 'Rest\u00adlaufzeit (Jahre)', r => restJahre(r) ?? Infinity, 'n'],
  ['kw', 'kw', r => r.kw ? 1 : 0],
  ['status', 'Status', r => contractStatus(r).o],
];
export const restJahre = r => (r.ende == null || r.ende < S.today) ? null : r2((r.ende - S.today + 1) / 365.25);
export function contractStatus(r) {
  const T = S.today;
  if (isResting(r, T)) return {o: 2, t: `<span class="pill" style="border-color:var(--s4)">ruht bis ${fmtD(r.ruht)}</span>`, txt: `ruht bis ${fmtD(r.ruht)}`};
  if (isPartlyResting(r, T)) return {o: 2, t: `<span class="pill" style="border-color:var(--s4)" title="${nf2.format(restVz(r, T))} von ${nf2.format(r.vz)} VZÄ ruhen">ruht teilw. bis ${fmtD(r.ruht)}</span>`, txt: `ruht teilweise (${nf2.format(restVz(r, T))} VZÄ) bis ${fmtD(r.ruht)}`};
  if (r.beginn != null && r.ende != null && r.beginn > r.ende) return {o: 9, t: '<span class="pill sev-E">ungültig</span>', txt: 'ungültig'};
  if (r.beginn != null && r.beginn > T) return {o: 3, t: '<span class="pill">beginnt künftig</span>', txt: 'beginnt künftig'};
  if (r.ende != null && r.ende < T) return r.endType === 'Ruhestand' ? {o: 4, t: '<span class="pill sev-I">im Ruhestand</span>', txt: 'im Ruhestand'} : {o: 4, t: '<span class="pill sev-I">ausgelaufen</span>', txt: 'ausgelaufen'};
  if (r.ende != null && r.ende <= T + 365) return r.endType === 'Ruhestand' ? {o: 1, t: '<span class="pill sev-W">Ruhestand ≤ 12 M.</span>', txt: 'aktiv, Ruhestand in 12 Monaten'} : {o: 1, t: '<span class="pill sev-W">endet ≤ 12 M.</span>', txt: 'aktiv, endet in 12 Monaten'};
  return {o: 0, t: '<span class="pill" style="border-color:var(--good)">aktiv</span>', txt: 'aktiv'};
}
export function staffStats(list) {
  const g = {P: [], L: [], W: [], O: []}; list.forEach(r => g[grpOf(r)].push(r));
  const K = l => l.length, V = l => sumBy(l, r => effVz(r, S.today));
  const PL = [...g.P, ...g.L], MA = [...g.W, ...g.O];
  return {g, PL, MA, K, V};
}
export const q2 = (a, b) => b ? r2((a || 0) / b) : null;   // Teiler 0 → nicht berechenbar; Zähler 0 → 0,00
export const f2 = v => v == null ? '–' : nf1.format(v);
export const inCluster = r => { const cf = $('#dtCluster').value; return !cf || clusterOf(r) === cf; };
export const inLab = r => { const lf = selLab(); return !lf || labKey(r) === lf; };
export const NOOE = '(ohne Organisationseinheit)';
export const oeOf = r => r.oe || NOOE;
export const selOE = () => $('#dtOE').value ? decodeURIComponent($('#dtOE').value) : null;
export const inOE = r => { const o = selOE(); return !o || oeOf(r) === o; };
/* Organisationseinheiten: nur der Name, eingeschränkt auf gewählten Cluster und Laborbereich */
export function fillOESelect() {
  const sel = $('#dtOE'), cur = selOE();
  const names = [...new Set(used().filter(r => inCluster(r) && inLab(r)).map(oeOf))]
    .sort((a, b) => ((a === NOOE) - (b === NOOE)) || a.localeCompare(b, 'de'));
  sel.innerHTML = '<option value="">Alle Organisationseinheiten</option>' + names.map(n => `<option value="${encodeURIComponent(n)}">${esc(n)}</option>`).join('');
  sel.value = names.includes(cur) ? encodeURIComponent(cur) : '';
}

export function detailRows() {
  const q = $('#dtSearch').value.trim().toLowerCase();
  const all = $('#dtAll').checked, soon = $('#dtSoon').checked, T = S.today;
  return used().filter(r => {
    if (!inCluster(r) || !inLab(r) || !inOE(r)) return false;
    if (!all && !inContract(r, T)) return false;   // ruhende Verträge stehen in der Liste (markiert), zählen aber nicht
    if (soon && !(isActive(r, T) && r.ende != null && r.ende <= T + 365)) return false;
    if (q && ![r.pnr, r.name, r.vorname, r.oe, r.labor, r.tarif, r.vart, kreisOf(r)].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
}
export function fillLabSelect() {
  const sel = $('#dtLab'), cur = selLab(), cf = $('#dtCluster').value || null;
  const keys = [...new Set(used().filter(r => !cf || clusterOf(r) === cf).map(labKey))].sort(labSort);
  sel.innerHTML = '<option value="">Alle Laborbereiche</option>' + keys.map(k => `<option value="${encodeURIComponent(k)}">${esc(labLabel(k, !cf))}</option>`).join('');
  sel.value = keys.includes(cur) ? encodeURIComponent(cur) : '';
}
export function renderDetail() {
  fillClusterSelect($('#dtCluster'));
  fillLabSelect();
  fillOESelect();
  const cf = $('#dtCluster').value || null, lf = selLab(), T = S.today;
  const oe = selOE();
  const scope = [oe ? `Organisationseinheit ${oe}` : '', lf ? `Laborbereich ${labLabel(lf, !cf)}` : '', cf ? `Cluster ${cf}` : ''].filter(Boolean).join(' · ') || 'Fakultät gesamt';
  // ---- Betreuungsverhältnis ----
  const act = used().filter(r => isActive(r, T) && inCluster(r) && inLab(r) && inOE(r));
  const {g, PL, MA, K, V} = staffStats(act);
  const withStud = !lf && !oe;
  const studN = withStud ? S.students.filter(s => s.n > 0 && (!cf || s.cluster === cf)).reduce((t, s) => t + s.n, 0) : 0;
  const byV = S.measure === 'vzae', base = l => byV ? V(l) : K(l);
  const amount = l => byV ? `${nf1.format(V(l))} VZÄ` : `${nf0.format(K(l))} ${K(l) === 1 ? 'Person' : 'Personen'}`;
  const tiles = [
    ['Professur (inkl. LfbA)', '1', amount(PL)],
    ['WiMi', f2(q2(base(g.W), base(PL))), amount(g.W)],
    ['Sonstige Mitarbeitende', f2(q2(base(g.O), base(PL))), amount(g.O) + ' (Technik, Verwaltung …)'],
  ];
  if (withStud) tiles.push(['Studierende', f2(q2(studN, base(PL))), `${nf0.format(studN)} Studierende`]);
  $('#dtRatioTitle').textContent = `${withStud ? 'Betreuungsverhältnis' : 'Verhältnis Professuren : Mitarbeitende'} – ${scope}`;
  $('#dtRatioSub').textContent = `Auf eine Professur (inkl. LfbA) kommen … · Basis ${byV ? 'VZÄ' : 'Köpfe'} (oben umschaltbar), Stand ${fmtD(T)}, nur aktive Verträge.` +
    (withStud ? (cf ? '' : ' Fakultät = alle Personen und alle Studierenden.') : ` Studierende sind keine${lf && oe ? 'm Laborbereich und keiner Organisationseinheit' : lf ? 'm Laborbereich' : 'r Organisationseinheit'} zugeordnet und werden hier nicht berücksichtigt.`);
  $('#dtRatio').innerHTML = tiles.map(([l, v, d], i) => `${i ? '<div class="ratio-sep">:</div>' : ''}<div class="kpi ratio-tile"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
  const sc = withStud ? (l => `<td class="n">${f2(q2(studN, K(l)))}</td><td class="n">${f2(q2(studN, V(l)))}</td>`) : (() => '');
  const rowR = (lbl, l, strong) => `<tr${strong ? ' class="tot"' : ''}><td>${lbl}</td><td class="n">${nf0.format(K(l))}</td><td class="n">${nf1.format(V(l))}</td><td class="n">${f2(q2(K(l), K(PL)))}</td><td class="n">${f2(q2(V(l), V(PL)))}</td>${sc(l)}</tr>`;
  $('#dtRatioTable').innerHTML = `<table><tr><th>Gruppe</th><th class="n">Köpfe</th><th class="n">VZÄ</th><th class="n">je Professur (Köpfe)</th><th class="n">je Professur (VZÄ)</th>${withStud ? '<th class="n">Studierende je Person</th><th class="n">Studierende je VZÄ</th>' : ''}</tr>` +
    rowR('Professor/innen', g.P) + rowR('LfbA', g.L) + rowR('Professuren inkl. LfbA', PL, true) +
    rowR('WiMi', g.W) + rowR('Sonstige Mitarbeitende', g.O) + rowR('Mitarbeitende gesamt', MA, true) + rowR('Personal gesamt', act, true) +
    (withStud ? `<tr><td>Studierende</td><td class="n">${nf0.format(studN)}</td><td></td><td class="n">${f2(q2(studN, K(PL)))}</td><td class="n">${f2(q2(studN, V(PL)))}</td><td></td><td></td></tr>` : '') + '</table>' +
    `<p class="note">Zum Vergleich ohne LfbA: ${f2(q2(K(g.W), K(g.P)))} WiMi je Professor/in (Köpfe), ${f2(q2(V(g.W), V(g.P)))} (VZÄ). Zuordnung der Mitarbeiterkreise zu den Gruppen: Reiter „Betreuung &amp; WiMi“.</p>`;
  renderLabBreakdown();
  renderDetailList();
}
/* Verhältnis Professuren : Mitarbeitende je Laborbereich (innerhalb des gewählten Clusters) */
export function renderLabBreakdown() {
  const cf = $('#dtCluster').value || null, lf = selLab(), T = S.today, byV = S.measure === 'vzae';
  const act = used().filter(r => isActive(r, T) && inCluster(r) && inOE(r));
  const keys = [...new Set(act.map(labKey))].sort(labSort);
  const st = Object.fromEntries(keys.map(k => [k, staffStats(act.filter(r => labKey(r) === k))]));
  const tot = staffStats(act);
  const m = (s, l) => byV ? s.V(l) : s.K(l);
  const ratioW = s => q2(m(s, s.g.W), m(s, s.PL)), ratioO = s => q2(m(s, s.g.O), m(s, s.PL));
  const avg = q2(m(tot, tot.MA), m(tot, tot.PL));
  $('#dtLabTitle').textContent = `Professuren und Mitarbeitende je Laborbereich – ${cf ? 'Cluster ' + cf : 'alle Cluster'}${selOE() ? ' · Organisationseinheit ' + selOE() : ''}`;
  $('#dtLabSub').textContent = `Mitarbeitende (WiMi + sonstige) je Professur inkl. LfbA, Basis ${byV ? 'VZÄ' : 'Köpfe'}, Stand ${fmtD(T)}. Linie = Durchschnitt ${selOE() ? 'der Organisationseinheit' + (cf ? ' im Cluster' : '') : cf ? 'des Clusters' : 'der Fakultät'} (${f2(avg)}). Laborbereiche ohne Professur haben keinen Balken.`;
  const labels = keys.map(k => labLabel(k, !cf));
  const dsW = barDs('WiMi je Professur', keys.map(k => ratioW(st[k])), catColor('WiMi'), {stack: 's', borderRadius: 0, borderWidth: {right: 2}, borderColor: css('--card'), maxBarThickness: 18});
  const dsO = barDs('Sonstige Mitarbeitende je Professur', keys.map(k => ratioO(st[k])), css('--s4'), {stack: 's', borderRadius: 0, maxBarThickness: 18});
  $('#lgLab').innerHTML = legendHtml([[dsW.backgroundColor, dsW.label], [dsO.backgroundColor, dsO.label]]);
  $('#dtLabBox').style.height = Math.max(180, keys.length * 32 + 60) + 'px';
  const avgLine = {id: 'avgLineLab', afterDatasetsDraw(c) {
    if (avg == null) return; const x = c.scales.x.getPixelForValue(avg), {top, bottom} = c.chartArea, ctx = c.ctx;
    ctx.save(); ctx.strokeStyle = css('--text-secondary'); ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.restore(); }};
  const sumLbl = {id: 'sumLblLab', afterDatasetsDraw(c) {
    const ctx = c.ctx; ctx.save(); ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = css('--text-secondary'); ctx.textBaseline = 'middle';
    keys.forEach((k, j) => { const s = st[k]; const v = q2(m(s, s.MA), m(s, s.PL)); let maxX = c.scales.x.left, y = c.scales.y.getPixelForValue(j);
      [0, 1].forEach(i => { const el = c.getDatasetMeta(i).data[j]; if (el && el.x > maxX) maxX = el.x; });
      ctx.fillText(v == null ? (m(s, s.MA) ? 'keine Professur' : '') : nf1.format(v), maxX + 5, y); });
    ctx.restore(); }};
  mkChart('cLab', {type: 'bar', plugins: [avgLine, sumLbl], data: {labels, datasets: [dsW, dsO]},
    options: {indexAxis: 'y', layout: {padding: {right: 90}}, scales: {x: axis({stacked: true, beginAtZero: true, title: {display: true, text: 'Mitarbeitende je Professur'}}),
      y: axis({stacked: true, grid: {display: false}, ticks: {font: c => ({weight: keys[c.index] === lf ? '700' : '400'})}})},
      plugins: {tooltip: {mode: 'index', callbacks: {label: c => ` ${c.dataset.label}: ${f2(c.raw)}`, footer: it => { const s = st[keys[it[0].dataIndex]];
        return [`Professuren: ${byV ? nf1.format(s.V(s.PL)) : s.K(s.PL)} · WiMi: ${byV ? nf1.format(s.V(s.g.W)) : s.K(s.g.W)} · Sonstige: ${byV ? nf1.format(s.V(s.g.O)) : s.K(s.g.O)}`]; }}}}}});
  const row = (lbl, s, cls) => `<tr class="${cls || ''}"><td>${lbl}</td>` +
    `<td class="n">${s.K(s.PL)}</td><td class="n">${nf1.format(s.V(s.PL))}</td>` +
    `<td class="n">${s.K(s.g.W)}</td><td class="n">${nf1.format(s.V(s.g.W))}</td>` +
    `<td class="n">${s.K(s.g.O)}</td><td class="n">${nf1.format(s.V(s.g.O))}</td>` +
    `<td class="n"><b>${f2(q2(s.K(s.MA), s.K(s.PL)))}</b></td><td class="n"><b>${f2(q2(s.V(s.MA), s.V(s.PL)))}</b></td>` +
    `<td class="n">${f2(q2(s.K(s.g.W), s.K(s.PL)))}</td><td class="n">${f2(q2(s.V(s.g.W), s.V(s.PL)))}</td></tr>`;
  $('#dtLabTable').innerHTML = `<table><tr><th rowspan="2">Laborbereich</th><th class="n" colspan="2">Professuren inkl. LfbA</th><th class="n" colspan="2">WiMi</th><th class="n" colspan="2">Sonstige Mitarbeitende</th><th class="n" colspan="2">Mitarbeitende je Professur</th><th class="n" colspan="2">WiMi je Professur</th></tr>` +
    `<tr>${'<th class="n">Köpfe</th><th class="n">VZÄ</th>'.repeat(5)}</tr>` +
    keys.map(k => row(esc(labLabel(k, !cf)) + (st[k].PL.length ? '' : ' <span class="pill sev-W">keine Professur</span>'), st[k], k === lf ? 'sel-row' : '')).join('') +
    row(cf ? `Cluster ${esc(cf)} gesamt` : 'Fakultät gesamt', tot, 'tot') + '</table>';
}
export function renderDetailList() {
  const cf = $('#dtCluster').value || null, rows = detailRows(), byLab = DT.group === 'lab';
  // Vertretende Personen werden unter der vertretenen Person angezeigt, sofern diese ebenfalls in der Liste steht
  const rowSet = new Set(rows);
  const isChild = r => !!(r.vertretene && r.vertretene !== r && rowSet.has(r.vertretene));
  const kids = r => (r.vertreter || []).filter(x => rowSet.has(x)).sort((x, y) => (x.beginn ?? 0) - (y.beginn ?? 0));
  const top = rows.filter(r => !isChild(r));
  const issuesByRow = {};
  S.issues.filter(i => i.sheet === 'Personal' && i.row && i.sev !== 'I').forEach(i => (issuesByRow[i.row] = issuesByRow[i.row] || []).push(i));
  const cols = DT_COLS.filter(c => !((cf || byLab) && c[0] === 'cluster') && !(byLab ? c[0] === 'labor' : c[0] === 'kreis') && (DT.expanded || (!DT_EXT.has(c[0]) && !(isNarrow() && DT_EXT_NARROW.has(c[0])))));
  const col = DT_COLS.find(c => c[0] === DT.sort) || DT_COLS[1];
  const cmp = (a, b) => { const x = col[2](a), y = col[2](b);
    const d = (typeof x === 'number' || typeof y === 'number') ? ((x ?? -Infinity) - (y ?? -Infinity)) : String(x ?? '').localeCompare(String(y ?? ''), 'de');
    return d * DT.dir || a.name.localeCompare(b.name, 'de'); };
  const cell = (k, r) => {
    switch (k) {
      case 'arb': return r.arb == null ? '–' : nf1.format(r.arb) + ' %';
      case 'vz': return r.vz == null ? '–' : nf1.format(r.vz) + (isPartlyResting(r, S.today) ? `<div class="eff" title="wirksam (nicht ruhend)">wirksam ${nf1.format(effVz(r, S.today))}</div>` : isResting(r, S.today) ? '<div class="eff">wirksam 0,00</div>' : '');
      case 'deputat': return r.deputat == null ? '–' : nf1.format(r.deputat) + (inRestPeriod(r, S.today) && r.deputat > 0 ? `<div class="eff">wirksam ${nf1.format(effDep(r, S.today))}</div>` : '');
      case 'beginn': return fmtD(r.beginn);
      case 'ende': return r.ende == null ? 'unbefristet' : fmtD(r.ende) + (r.endType === 'Ruhestand' ? ' <span class="pill rs" title="voraussichtlicher Ruhestand">RS</span>' : '');
      case 'ruht': return r.ruht == null ? '' : fmtD(r.ruht);
      case 'rest': { const j = restJahre(r); return j == null ? '–' : nf1.format(j); }
      case 'kw': return r.kw ? '<span class="pill" style="border-color:var(--s2)">kw</span>' : '';
      case 'status': return contractStatus(r).t;
      case 'cluster': return esc(clusterOf(r));
      case 'name': return (isChild(r) ? '<span class="vt-mark" title="Vertretung">↳</span>' : '') + esc(r.name) +
        (isChild(r) ? ' <span class="pill vt">Vertretung</span>' : r.vertretene ? ` <span class="pill vt" title="Vertretung für ${esc(r.vertretene.vorname + ' ' + r.vertretene.name)}">Vertretung für ${esc(r.vertretene.pnr)}</span>` : r.vertretungFuer ? ` <span class="pill vt sev-E" title="Personalnummer nicht gefunden">Vertretung für ${esc(r.vertretungFuer)} ?</span>` : '') +
        (kids(r).length ? ` <span class="pill vt-p">vertreten</span>` : '');
      case 'kreis': return `<span class="sw" style="background:${kreisColor(kreisOf(r))}"></span>${esc(kreisOf(r))}`;
      default: return esc(r[k]);
    }
  };
  const T = S.today;
  const groups = byLab
    ? [...new Set(top.map(labKey))].sort(labSort).map(k => ({key: k, head: `<b>${esc(labLabel(k, !cf))}</b>`, list: top.filter(r => labKey(r) === k)}))
    : S.kreisOrder.filter(k => top.some(r => kreisOf(r) === k)).map(k => ({key: k, head: `<span class="sw" style="background:${kreisColor(k)}"></span><b>${esc(k)}</b> <span class="note">(${esc(S.catMap[k])})</span>`, list: top.filter(r => kreisOf(r) === k)}));
  $('#dtCount').textContent = `${rows.length} Verträge · ${nf1.format(sumBy(rows, r => effVz(r, T)))} wirksame VZÄ`;
  $('#dtLists').innerHTML = groups.length ? groups.map(({head, list}) => {
    const l = list.sort(cmp).flatMap(r => [r, ...kids(r)]), a = l.filter(r => isActive(r, T));
    const befr = a.filter(r => r.fixedTerm).length, kw = a.filter(r => r.kw).length, soon = a.filter(r => r.ende != null && r.ende <= T + 365).length, rest = l.filter(r => inRestPeriod(r, T)).length;
    let extra = '';
    if (byLab) { const s = staffStats(a); extra = ` · Prof. ${s.K(s.PL)} : MA ${s.K(s.MA)} (Köpfe) = 1 : ${f2(q2(s.K(s.MA), s.K(s.PL)))}`; }
    return `<details open class="kreis"><summary>${head}
      <span class="ksum">${l.length} Verträge · ${nf1.format(sumBy(l, r => effVz(r, T)))} wirksame VZÄ · befristet ${befr} · kw ${kw} · Ausscheiden ≤ 12 Mon. ${soon}${rest ? ` · ruhend ${rest}` : ''}${extra}</span></summary>
      <div style="overflow-x:auto"><table class="dt"><tr><th></th>${cols.map(c => `<th class="${c[3] || ''} sortable" data-k="${c[0]}">${c[1]}${DT.sort === c[0] ? (DT.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr>` +
      l.map(r => { const is = issuesByRow[r.row]; return `<tr class="prow${isChild(r) ? ' vt-child' : ''}" data-row="${r.row}" title="Klicken für alle Daten zur Person"><td>${is ? `<span title="${esc(is.map(i => i.msg).join('\n'))}" class="${is.some(i => i.sev === 'E') ? 'sev-E' : 'sev-W'}">${is.some(i => i.sev === 'E') ? '⛔' : '⚠'}</span>` : ''}</td>${cols.map(c => `<td class="${c[3] || ''}">${cell(c[0], r)}</td>`).join('')}</tr>`; }).join('') +
      `<tr class="tot"><td></td>${cols.map(c => `<td class="${c[3] || ''}">${c[0] === 'name' ? 'Summe' : c[0] === 'vz' ? `${nf1.format(sumBy(l, r => r.vz))}<div class="eff">wirksam ${nf1.format(sumBy(l, r => effVz(r, T)))}</div>` : ''}</td>`).join('')}</tr></table></div></details>`;
  }).join('') : '<p class="note">Keine Verträge für diese Auswahl.</p>';
  $$('#dtLists th.sortable').forEach(th => th.onclick = () => { if (DT.sort === th.dataset.k) DT.dir *= -1; else { DT.sort = th.dataset.k; DT.dir = 1; } renderDetailList(); });
  $$('#dtLists tr.prow').forEach(tr => tr.onclick = () => showPerson(+tr.dataset.row));
  $('#dtExpand').textContent = DT.expanded ? '◂ Reduzieren' : 'Erweitern ▸';
  const extNames = (isNarrow() ? 'Organisationseinheit, Laborbereich, ' : '') + 'TrfGr, ArbAnteil, Deputat, Vertragsart, Beginn und „ruht bis“';
  $('#dtExpand').title = (DT.expanded ? 'Ausblenden: ' : 'Einblenden: ') + extNames;
  DT.lastNarrow = isNarrow();
}
export function detailCsv() {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const head = ['Mitarbeiterkreis', 'Gruppe', 'Personalnummer', 'Name', 'Vorname', 'Cluster', 'Organisationseinheit', 'Laborbereich', 'TrfGr', 'ArbAnteil', 'VZÄ', 'Deputat (SWS)', 'wirksames Deputat heute', 'Vertragsart', 'Beginn', 'Vertragsende', 'Ruhestand', 'Ausscheiden', 'ruht bis', 'Ruheanteil (VZÄ)', 'wirksame VZÄ heute', 'Vertretung für', 'Restlaufzeit (Jahre)', 'kw', 'Status'];
  const rows = detailRows().sort(DT.group === 'lab'
    ? (a, b) => labSort(labKey(a), labKey(b)) || S.kreisOrder.indexOf(kreisOf(a)) - S.kreisOrder.indexOf(kreisOf(b)) || a.name.localeCompare(b.name, 'de')
    : (a, b) => S.kreisOrder.indexOf(kreisOf(a)) - S.kreisOrder.indexOf(kreisOf(b)) || a.name.localeCompare(b.name, 'de'));
  const n = v => v == null ? '' : nf1.format(v);
  const lines = [head.map(q).join(';')].concat(rows.map(r => [kreisOf(r), S.catMap[kreisOf(r)], r.pnr, r.name, r.vorname, clusterOf(r), r.oe, r.labor, r.tarif, n(r.arb), n(r.vz), n(r.deputat), n(effDep(r, S.today)), r.vart,
    r.beginn == null ? '' : fmtD(r.beginn), r.vertragsende == null ? (r.fixedTerm ? '' : 'unbefristet') : fmtD(r.vertragsende), r.ruhestand == null ? '' : fmtD(r.ruhestand), r.ende == null ? '' : fmtD(r.ende) + ' (' + r.endType + ')', r.ruht == null ? '' : fmtD(r.ruht), n(r.ruht == null ? null : r2((r.vz || 0) * restShare(r))), n(effVz(r, S.today)), r.vertretungFuer, n(restJahre(r)), r.kw ? 'x' : '', contractStatus(r).txt].map(q).join(';')));
  const lab = (selLab() ? '_' + labLabel(selLab(), false) : '') + (selOE() ? '_' + selOE() : '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], {type: 'text/csv;charset=utf-8'}));
  a.download = ('Personalliste_' + ($('#dtCluster').value || 'Fakultaet') + lab).replace(/[^\wäöüÄÖÜß-]+/g, '_') + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
