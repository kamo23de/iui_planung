// Planung: Stellenplan-Zeitstrahl
import {$, $$, css, esc, fmtD, nf1, pad, r2, semEnd, semIdx, semLabel, semStart} from '../util.js';
import {S} from '../state.js';
import {clusterOf, kreisColor, kreisOf} from '../parse.js';
import {clusterList, fmtV, isVertretung, restShare, restVz, snapshot, unit, used, usedBase, withPlan} from '../model.js';
import {axis, legendHtml, mkChart} from '../charts.js';
import {showPerson} from '../views/person.js';
import {deletePlanItem, editPlanItem, openPlanForm} from './form.js';
import {modFor, nachFor, PLAN, planDesc, planFind} from './scenario.js';

export function renderTimeline() {
  const sel = $('#tlCluster'), cur0 = sel.value;
  const cls = clusterList();
  sel.innerHTML = '<option value="">Alle Cluster</option>' + cls.map(c => `<option>${esc(c)}</option>`).join('');
  sel.value = cls.includes(cur0) ? cur0 : (cur0 === '' && sel.dataset.init ? '' : (cls[0] || '')); sel.dataset.init = '1';
  const ks = $('#tlKreis'), k0 = ks.value;
  ks.innerHTML = '<option value="">Alle</option>' + S.kreisOrder.map(k => `<option>${esc(k)}</option>`).join(''); ks.value = S.kreisOrder.includes(k0) ? k0 : '';
  const cf = sel.value || null, kf = ks.value || null, grp = $('#tlGroup').value, need = $('#tlNeed').checked;
  const cur = semIdx(S.today), s0 = cur - 2, s1 = cur + +$('#tlRange').value, A = semStart(s0), B = semEnd(s1);
  const X = d => Math.max(0, Math.min(100, (d - A) / (B - A + 1) * 100));
  const recs = withPlan(true, () => used());
  const inRange = r => (r.beginn == null || r.beginn <= B) && (r.ende == null || r.ende >= A);
  // Handlungsbedarf: Stelle endet im Zeitraum, ohne kw, keine Vertretung, noch keine Nachbesetzung geplant
  const openEnd = r => !r.plan && r.ende != null && r.ende >= S.today && r.ende <= B && !r.kw && !isVertretung(r) && !nachFor(r).length;
  let rows = recs.filter(r => inRange(r) && (!cf || clusterOf(r) === cf) && (!kf || kreisOf(r) === kf));
  const isChildRow = r => (r.vertretene && rows.includes(r.vertretene)) || (r.plan && r.plan.type === 'nach' && r.planOf && rows.some(x => x.row === r.planOf.row));
  if (need) rows = rows.filter(r => openEnd(r) || r.plan || r.planMod || nachFor(r).length);
  const top = rows.filter(r => !isChildRow(r));
  const kids = r => rows.filter(x => (x.vertretene === r) || (x.plan && x.plan.type === 'nach' && x.planOf && x.planOf.row === r.row)).sort((a, b) => (a.beginn ?? 0) - (b.beginn ?? 0));
  const gKey = r => grp === 'oe' ? (r.oe || '(ohne Organisationseinheit)') : grp === 'labor' ? (r.labor || '(ohne Laborbereich)') : kreisOf(r);
  const gk = [...new Set(top.map(r => (cf ? '' : clusterOf(r) + ' › ') + gKey(r)))].sort((a, b) => (a.includes('(ohne') - b.includes('(ohne')) || a.localeCompare(b, 'de'));
  const sems = []; for (let i = s0; i <= s1; i++) sems.push(i);
  const head = `<div class="tl-head"><div class="tl-lbl"><b>${rows.length} Verträge/Stellen</b></div><div class="tl-track">${sems.map(i => `<div class="tl-sem${i === cur ? ' cur' : ''}" style="left:${X(semStart(i))}%;width:${X(semEnd(i) + 1) - X(semStart(i))}%" title="${semLabel(i)}: ${fmtD(semStart(i))} – ${fmtD(semEnd(i))}">${(i % 2 ? 'WS ' : 'SS ') + pad(Math.floor(i / 2) % 100)}</div>`).join('')}<div class="tl-today" style="left:${X(S.today)}%" title="heute"></div></div></div>`;
  const gridLines = sems.map(i => `<div class="tl-grid" style="left:${X(semStart(i))}%"></div>`).join('') + `<div class="tl-today" style="left:${X(S.today)}%"></div>`;
  const bar = r => {
    const b = r.beginn == null ? A : Math.max(A, r.beginn), e = r.ende == null ? B : Math.min(B, r.ende);
    if (e < A || b > B) return '';
    const col = kreisColor(kreisOf(r)), L = X(b), W = Math.max(0.6, X(e + 1) - L);
    const cls2 = ['tl-bar', r.plan ? 'plan' : '', (r.beginn == null || r.beginn < A) ? 'open-l' : '', (r.ende == null || r.ende > B) ? 'open-r' : ''].join(' ');
    const lab = r.plan ? 'PLAN' : '';
    let h = '';
    if (r.planMod && r.origEnde != null && r.ende != null && r.ende > r.origEnde) {   // Verlängerung: Ist-Teil + Planverlängerung
      const m = Math.min(B, r.origEnde);
      h += `<div class="${cls2} open-r" data-row="${r.row}" style="left:${L}%;width:${Math.max(0.6, X(m + 1) - L)}%;background:${col}" title="${esc(tipOf(r))}"></div>`;
      h += `<div class="tl-bar ext ${r.ende > B ? 'open-r' : ''}" data-row="${r.row}" style="left:${X(m + 1)}%;width:${Math.max(0.6, X(e + 1) - X(m + 1))}%" title="Plan: verlängert bis ${fmtD(r.ende)}"></div>`;
    } else if (r.planMod && r.origEnde != null && r.ende == null) {                       // Entfristung
      const m = Math.min(B, r.origEnde);
      h += `<div class="${cls2} open-r" data-row="${r.row}" style="left:${L}%;width:${Math.max(0.6, X(m + 1) - L)}%;background:${col}" title="${esc(tipOf(r))}"></div>`;
      if (m < B) h += `<div class="tl-bar ext open-r" data-row="${r.row}" style="left:${X(m + 1)}%;width:${100 - X(m + 1)}%" title="Plan: entfristet"></div>`;
    } else h += `<div class="${cls2}" data-row="${r.row}" style="left:${L}%;width:${W}%;${r.plan ? '' : 'background:' + col}" title="${esc(tipOf(r))}">${lab}</div>`;
    // Ruhe (ganz oder teilweise), schraffiert
    if (r.ruht != null && r.ruht >= A) { const rb = b, re = Math.min(e, r.ruht); if (re >= rb) h += `<div class="tl-rest${restShare(r) < 0.9999 ? ' part' : ''}" style="left:${X(rb)}%;width:${X(re + 1) - X(rb)}%" title="ruht${restShare(r) < 0.9999 ? ' teilweise (' + nf1.format(restVz(r, S.today)) + ' VZÄ)' : ''} bis ${fmtD(r.ruht)}"></div>`; }
    // Ende-Marken
    if (r.ende != null && r.ende <= B && r.ende >= A) {
      if (r.kw) h += `<span class="tl-mark kw" style="left:calc(${X(r.ende + 1)}% + 2px)">kw</span>`;
      else if (r.endType === 'Ruhestand') h += `<span class="tl-mark rs" style="left:calc(${X(r.ende + 1)}% + 2px)">RS</span>`;
    }
    // Unbesetzte Stelle nach Vertragsende (ohne kw, keine Vertretung): bis zur geplanten Nachfolge oder bis Zeitraumende
    if (!r.plan && r.ende != null && r.ende < B && r.ende >= S.today - 1 && !r.kw && !isVertretung(r)) {
      const nf = nachFor(r).map(i => i.beginn).sort((a, b) => a - b)[0];
      const ge = nf != null ? Math.min(B, nf - 1) : B;
      if (ge > r.ende) h += `<div class="tl-gap" data-gap="${r.row}" style="padding-left:${r.kw || r.endType === 'Ruhestand' ? 22 : 4}px;left:${X(r.ende + 1)}%;width:${Math.max(0.8, X(ge + 1) - X(r.ende + 1))}%" title="${nf != null ? 'Lücke bis zur geplanten Nachbesetzung' : 'Stelle unbesetzt – Klick zum Nachbesetzen'}">${nf != null ? 'Lücke' : 'offen'}</div>`;
    }
    return h;
  };
  const lbl = r => `<span class="sw" style="background:${kreisColor(kreisOf(r))}"></span>${r.plan ? '<b>PLAN</b> ' : ''}${esc([r.name, r.vorname].filter(Boolean).join(', '))} <span class="note">${nf1.format(r.vz || 0)}</span>`;
  const rowHtml = (r, child) => `<div class="tl-row${child ? ' child' : ''}"><div class="tl-lbl${r.plan ? '' : ' click'}" data-person="${r.plan ? '' : r.row}" title="${esc(kreisOf(r) + ' · ' + clusterOf(r) + (r.oe ? ' · ' + r.oe : '') + (r.labor ? ' · ' + r.labor : ''))}">${child ? '↳ ' : ''}${lbl(r)}</div><div class="tl-track">${gridLines}${bar(r)}</div></div>`;
  $('#tlBox').innerHTML = `<div class="tl">${head}` + (gk.length ? gk.map(g => {
    const list = top.filter(r => (cf ? '' : clusterOf(r) + ' › ') + gKey(r) === g).sort((a, b) => S.kreisOrder.indexOf(kreisOf(a)) - S.kreisOrder.indexOf(kreisOf(b)) || a.name.localeCompare(b.name, 'de'));
    return `<div class="tl-grp"><div class="tl-lbl">${esc(g)} <span class="note">(${list.length})</span></div><div class="tl-track"></div></div>` + list.map(r => rowHtml(r, false) + kids(r).map(k => rowHtml(k, true)).join('')).join('');
  }).join('') : '<p class="note" style="padding:12px">Keine Verträge für diese Auswahl.</p>') + '</div>';
  $('#tlLegend').innerHTML = legendHtml(S.kreisOrder.filter(k => rows.some(r => kreisOf(r) === k)).map(k => [kreisColor(k), k])) +
    '<span><i style="background:repeating-linear-gradient(45deg,#999 0 3px,transparent 3px 6px)"></i>ruht</span><span><i style="border:2px dashed var(--critical);background:transparent"></i>unbesetzt</span><span><i style="border:2px dashed var(--s7);background:transparent"></i>Plan</span><span><i style="background:var(--accent);width:2px"></i>heute</span>';
  $$('#tlBox .tl-lbl[data-person]').forEach(el => { if (el.dataset.person) el.onclick = () => showPerson(+el.dataset.person); });
  $$('#tlBox .tl-bar, #tlBox .tl-gap').forEach(el => el.onclick = e => tlMenu(e, el.dataset.row ? +el.dataset.row : +el.dataset.gap));
  renderPlanEffect(cf); renderPlanList();
}
export function tipOf(r) {
  return `${[r.vorname, r.name].filter(Boolean).join(' ')} · ${kreisOf(r)} · ${nf1.format(r.vz || 0)} VZÄ · ${r.beginn != null ? fmtD(r.beginn) : '…'} – ${r.ende != null ? fmtD(r.ende) + (r.endType === 'Ruhestand' ? ' (Ruhestand)' : '') : 'unbefristet'}${r.kw ? ' · kw' : ''}${r.vertretene ? ' · Vertretung für ' + r.vertretene.name : ''}${r.ruht != null ? ' · ruht bis ' + fmtD(r.ruht) : ''}`;
}
export function tlMenu(e, row) {
  e.stopPropagation();
  const r = withPlan(true, () => planFind(row)) || usedBase().find(x => x.row === row); if (!r) return;
  const m = $('#tlMenu'), btn = (act, txt) => `<button data-act="${act}">${txt}</button>`;
  let h = `<div class="mh">${esc(tipOf(r))}</div>`;
  if (r.plan) h += btn('edit', 'Planmaßnahme bearbeiten …') + btn('del', 'Planmaßnahme löschen');
  else {
    h += btn('person', 'Person anzeigen');
    if (r.ende != null && !r.kw && !isVertretung(r)) h += btn('nach', nachFor(r).length ? 'Weitere Nachbesetzung planen …' : 'Nachbesetzen …');
    h += btn('ende', modFor(r) ? 'Geplantes Vertragsende bearbeiten …' : 'Vertragsende ändern (Verlängerung/Entfristung) …');
    if (modFor(r)) h += btn('delmod', 'Geplante Änderung des Vertragsendes löschen');
  }
  m.innerHTML = h; m.classList.remove('hidden');
  const W = m.offsetWidth, x = Math.max(8, Math.min(e.clientX, innerWidth - W - 12)), y = Math.max(8, Math.min(e.clientY + 6, innerHeight - m.offsetHeight - 8));
  m.style.left = x + 'px'; m.style.top = y + 'px';
  $$('#tlMenu button').forEach(b => b.onclick = () => { m.classList.add('hidden'); const base = usedBase().find(x => x.row === (r.planMod ? r.row : row));
    if (b.dataset.act === 'person') showPerson(row);
    if (b.dataset.act === 'nach') openPlanForm('nach', {prev: base});
    if (b.dataset.act === 'ende') openPlanForm('ende', {prev: base, item: modFor(base)});
    if (b.dataset.act === 'delmod') deletePlanItem(modFor(base).id);
    if (b.dataset.act === 'edit') editPlanItem(r.plan.id);
    if (b.dataset.act === 'del') deletePlanItem(r.plan.id); });
}
export function renderPlanEffect(cf) {
  const cur = semIdx(S.today), sems = []; for (let i = cur; i <= cur + 20; i++) sems.push(i);
  const v = (on) => withPlan(on, () => sems.map(i => snapshot(semStart(i), cf).b));
  const ist = v(false), pl = v(true);
  $('#tlEffSub').textContent = `${unit()} mit aktivem Vertrag zu Semesterbeginn${cf ? ' · Cluster ' + cf : ' · Fakultät'}. Ist = nur bestehende Verträge, Plan = mit allen Planmaßnahmen.`;
  $('#tlEffLg').innerHTML = legendHtml([[css('--muted'), 'Ist'], [css('--s7'), 'Plan']]);
  mkChart('cPlanEff', {type: 'line', data: {labels: sems.map(semLabel), datasets: [
      {label: 'Ist', data: ist, borderColor: css('--muted'), backgroundColor: css('--muted'), borderWidth: 2, pointRadius: 2, tension: 0},
      {label: 'Plan', data: pl, borderColor: css('--s7'), backgroundColor: css('--s7'), borderWidth: 2, borderDash: [6, 4], pointRadius: 3, tension: 0}]},
    options: {interaction: {mode: 'index', intersect: false}, scales: {x: axis({grid: {display: false}, ticks: {maxRotation: 60, autoSkip: true}}), y: axis({beginAtZero: false, title: {display: true, text: unit()}})},
      plugins: {tooltip: {callbacks: {label: c => ` ${c.dataset.label}: ${fmtV(c.raw)}`, footer: it => { const d = r2(it[1].raw - it[0].raw); return d ? `Plan − Ist: ${d > 0 ? '+' : '−'}${fmtV(Math.abs(d))}` : ''; }}}}}});
}
export function renderPlanList() {
  $('#plList').innerHTML = PLAN.items.length ? `<table>${[...PLAN.items].sort((a, b) => (a.beginn ?? a.ende ?? 0) - (b.beginn ?? b.ende ?? 0)).map(it => `<tr><td><span class="pill" style="border-color:var(--s7)">${it.type === 'nach' ? 'Nachbesetzung' : it.type === 'neu' ? 'Neue Stelle' : 'Vertragsende'}</span></td><td>${esc(planDesc(it))}</td><td style="white-space:nowrap"><button data-edit="${it.id}">Bearbeiten</button> <button data-del="${it.id}" title="Löschen">✕</button></td></tr>`).join('')}</table>`
    : '<p class="note">Noch keine Planmaßnahmen. Klicken Sie im Zeitstrahl auf einen Balken oder eine rot gestrichelte offene Stelle, nutzen Sie „+ Neue Stelle“ oder übernehmen Sie einen Fehlbedarf aus der Ampel.</p>';
  $$('#plList [data-edit]').forEach(b => b.onclick = () => editPlanItem(+b.dataset.edit));
  $$('#plList [data-del]').forEach(b => b.onclick = () => deletePlanItem(+b.dataset.del));
}
