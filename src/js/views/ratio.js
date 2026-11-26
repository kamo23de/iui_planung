// Ansicht Betreuung & WiMi
import {$, $$, css, esc, fmtD, nf0, nf1, pct, r2, semIdx, semLabel, semStart, sumBy} from '../util.js';
import {CATS, S} from '../state.js';
import {catColor, clusterOf, kreisColor, kreisOf, orderKreise} from '../parse.js';
import {fmtV, isActive, tot, used, valAt} from '../model.js';
import {axis, barDs, endLabels, legendHtml, mkChart} from '../charts.js';
import {renderAll} from '../render.js';

export function renderRatio() {
  const cur = semIdx(S.today), sel = $('#raWhen'), prev = sel.value;
  sel.innerHTML = `<option value="today">heute (${fmtD(S.today)})</option>` + Array.from({length: 20}, (_, j) => cur + 1 + j).map(i => `<option value="${i}">${semLabel(i)}</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === prev) ? prev : 'today';
  const D = sel.value === 'today' ? S.today : semStart(+sel.value);
  $('#raNote').textContent = sel.value === 'today' ? '' : `Stand ${fmtD(D)} – Studierendenzahlen unverändert angenommen.`;
  // Studierende je Cluster
  const stud = {}; S.students.forEach(s => { if (s.cluster && s.n > 0) stud[s.cluster] = (stud[s.cluster] || 0) + s.n; });
  const unitLbl = S.measure === 'vzae' ? 'VZÄ' : 'Köpfe';
  // Personal je Cluster: P = Professor/innen ohne LfbA, L = LfbA, PL = Professor/innen inkl. LfbA, W = WiMi
  const staff = {}, oeStaff = {};
  const addS = (o, k, w) => { o[k] = r2((o[k] || 0) + w); };
  for (const r of used()) {
    if (!isActive(r, D)) continue;
    const c = clusterOf(r), cat = S.catMap[kreisOf(r)], w = valAt(r, D);
    const o = staff[c] = staff[c] || {P: 0, L: 0, PL: 0, W: 0};
    const oeKey = c + '\u0000' + (r.oe || '(ohne Organisationseinheit)');
    const q = oeStaff[oeKey] = oeStaff[oeKey] || {c, oe: r.oe || '(ohne Organisationseinheit)', P: 0, W: 0};
    if (cat === 'Professor/in') { addS(o, 'P', w); addS(o, 'PL', w); addS(q, 'P', w); }
    else if (cat === 'LfbA') { addS(o, 'L', w); addS(o, 'PL', w); }
    else if (cat === 'WiMi') { addS(o, 'W', w); addS(q, 'W', w); }
  }
  const cls = [...new Set([...Object.keys(stud), ...clusterList()])].filter(c => stud[c] || (staff[c] && c !== '(ohne Cluster)')).sort((a, b) => a.localeCompare(b, 'de'));
  const both = cls.filter(c => stud[c] && staff[c]);
  const G = {P: 0, L: 0, PL: 0, W: 0}; let Gs = 0;
  both.forEach(c => { Gs += stud[c]; for (const k in G) G[k] = r2(G[k] + staff[c][k]); });
  const ratio = (n, d) => (n && d) ? r2(n / d) : null;
  const rc = v => v == null ? '<span class="note">–</span>' : nf1.format(v);
  const FAK = 'Fakultät gesamt';
  const labels = [...both, FAK];
  const st = c => c === FAK ? G : staff[c];
  const sn = c => c === FAK ? Gs : stud[c];
  const groups = [['PL', 'Professor/innen (inkl. LfbA)', catColor('Professor/in')], ['W', 'WiMi', catColor('WiMi')]];
  const ds = groups.map(([k, l, col]) => barDs('Studierende je ' + l, labels.map(c => ratio(sn(c), st(c)[k])), col, {maxBarThickness: 16}));
  $('#lgRa').innerHTML = legendHtml(ds.map(d => [d.backgroundColor, d.label]));
  $('#raSub').textContent = `Studierende im Cluster geteilt durch ${unitLbl} der jeweiligen Gruppe mit aktivem Vertrag am ${fmtD(D)}. LfbA zählen als Professor/innen. Fehlende Balken: keine Person dieser Gruppe im Cluster.`;
  $('#raBox').style.height = Math.max(220, labels.length * 52 + 50) + 'px';
  const boldFak = (lbls) => ({font: c => ({weight: lbls[c.index] === FAK ? '700' : '400'})});
  mkChart('cRa', {type: 'bar', plugins: [endLabels], data: {labels, datasets: ds},
    options: {indexAxis: 'y', layout: {padding: {right: 50}}, scales: {x: axis({beginAtZero: true, title: {display: true, text: 'Studierende je ' + (S.measure === 'vzae' ? 'VZÄ' : 'Person')}}), y: axis({grid: {display: false}, ticks: boldFak(labels)})},
      plugins: {endLabels: {enabled: true, fmt: v => nf1.format(v)}, tooltip: {callbacks: {label: c => ` ${c.dataset.label}: ${nf1.format(c.raw)}`}}}}});
  const row = (n, o) => `<td class="n">${n ? nf0.format(n) : '<span class="note">–</span>'}</td>` +
    `<td class="n">${fmtV(o.P)}</td><td class="n">${fmtV(o.L)}</td><td class="n">${fmtV(o.PL)}</td><td class="n"><b>${rc(ratio(n, o.PL))}</b></td>` +
    `<td class="n">${fmtV(o.W)}</td><td class="n"><b>${rc(ratio(n, o.W))}</b></td><td class="n">${rc(ratio(n, r2(o.PL + o.W)))}</td>`;
  $('#raTable').innerHTML = `<table><tr><th>Cluster</th><th class="n">Studierende</th><th class="n">Professor/innen (${unitLbl})</th><th class="n">+ LfbA (${unitLbl})</th><th class="n"><span class="sw" style="background:${catColor('Professor/in')}"></span>Prof. inkl. LfbA</th><th class="n">Stud. je Prof. inkl. LfbA</th><th class="n"><span class="sw" style="background:${catColor('WiMi')}"></span>WiMi (${unitLbl})</th><th class="n">Stud. je WiMi</th><th class="n">Stud. je (Prof. inkl. LfbA + WiMi)</th></tr>` +
    cls.map(c => `<tr><td>${esc(c)}${!stud[c] ? ' <span class="pill sev-W">keine Studierenden</span>' : !staff[c] ? ' <span class="pill sev-W">kein Personal</span>' : ''}</td>${row(stud[c], staff[c] || {P: 0, L: 0, PL: 0, W: 0})}</tr>`).join('') +
    `<tr class="tot"><td>${FAK}*</td>${row(Gs, G)}</tr></table><p class="note">* Summe nur über Cluster, für die sowohl Studierende als auch Personal vorliegen. Alle Werte auf zwei Nachkommastellen gerundet.</p>`;

  // ---------- WiMi je Professur (ohne LfbA) ----------
  const wcl = cls.filter(c => staff[c] && (staff[c].P || staff[c].W));
  const WG = {P: sumBy(wcl, c => staff[c].P), W: sumBy(wcl, c => staff[c].W)};
  const wLabels = [...wcl, FAK];
  const wst = c => c === FAK ? WG : staff[c];
  const wr = wLabels.map(c => ratio(wst(c).W, wst(c).P));
  const avg = ratio(WG.W, WG.P);
  $('#wmSub').textContent = `${S.measure === 'vzae' ? 'WiMi-VZÄ je Professur-VZÄ' : 'WiMi je Professor/in (Köpfe)'} am ${fmtD(D)}. LfbA werden hier nicht berücksichtigt. Linie = Fakultätsdurchschnitt ${avg == null ? '–' : nf1.format(avg)}.`;
  $('#wmBox').style.height = Math.max(200, wLabels.length * 38 + 50) + 'px';
  const avgLine = {id: 'avgLine', afterDatasetsDraw(c) {
    if (avg == null) return; const x = c.scales.x.getPixelForValue(avg), {top, bottom} = c.chartArea, ctx = c.ctx;
    ctx.save(); ctx.strokeStyle = css('--text-secondary'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.restore(); }};
  mkChart('cWm', {type: 'bar', plugins: [endLabels, avgLine], data: {labels: wLabels, datasets: [barDs('WiMi je Professur', wr, wLabels.map(c => c === FAK ? css('--muted') : catColor('WiMi')), {maxBarThickness: 18})]},
    options: {indexAxis: 'y', layout: {padding: {right: 50}}, scales: {x: axis({beginAtZero: true, title: {display: true, text: 'WiMi je Professur'}}), y: axis({grid: {display: false}, ticks: boldFak(wLabels)})},
      plugins: {endLabels: {enabled: true, fmt: v => nf1.format(v)}, tooltip: {callbacks: {label: c => { const o = wst(wLabels[c.dataIndex]); return [` ${nf1.format(c.raw)} WiMi je Professur`, ` ${fmtV(o.W)} WiMi / ${fmtV(o.P)} Professuren (${unitLbl})`]; }}}}}});
  // Verteilung: Anteil an allen Professuren vs. Anteil an allen WiMi
  const shP = wcl.map(c => pct(staff[c].P, WG.P)), shW = wcl.map(c => pct(staff[c].W, WG.W));
  $('#lgWmShare').innerHTML = legendHtml([[catColor('Professor/in'), 'Anteil an allen Professuren'], [catColor('WiMi'), 'Anteil an allen WiMi']]);
  $('#wmShareBox').style.height = Math.max(200, wcl.length * 52 + 50) + 'px';
  mkChart('cWmShare', {type: 'bar', plugins: [endLabels], data: {labels: wcl, datasets: [barDs('Anteil an allen Professuren', shP, catColor('Professor/in'), {maxBarThickness: 14}), barDs('Anteil an allen WiMi', shW, catColor('WiMi'), {maxBarThickness: 14})]},
    options: {indexAxis: 'y', layout: {padding: {right: 60}}, scales: {x: axis({beginAtZero: true, ticks: {callback: v => v + ' %'}}), y: axis({grid: {display: false}})},
      plugins: {endLabels: {enabled: true, fmt: v => nf1.format(v) + ' %'}, tooltip: {callbacks: {label: c => ` ${c.dataset.label}: ${nf1.format(c.raw)} %`}}}}});
  // Tabelle je Cluster mit Organisationseinheiten
  const oes = Object.values(oeStaff).filter(o => o.P || o.W);
  const hasOe = 'oe' in S.colMap;
  const flag = (P, W) => !P && W ? ' <span class="pill sev-W">WiMi ohne Professur</span>' : (P && !W ? ' <span class="pill sev-I">keine WiMi</span>' : '');
  const devCell = v => { if (v == null || avg == null) return '<td class="n"><span class="note">–</span></td>'; const d = r2(v - avg);
    return `<td class="n"><span class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${nf1.format(Math.abs(d))}</span></td>`; };
  $('#wmTable').innerHTML = `<table><tr><th>Cluster${hasOe ? ' / Organisationseinheit' : ''}</th><th class="n">Professuren (${unitLbl})</th><th class="n">WiMi (${unitLbl})</th><th class="n">WiMi je Professur</th><th class="n">Abweichung vom Fakultätsschnitt</th><th class="n">Anteil Professuren</th><th class="n">Anteil WiMi</th></tr>` +
    wcl.map((c, i) => { const o = staff[c], v = ratio(o.W, o.P);
      return `<tr class="tot"><td>${esc(c)}${flag(o.P, o.W)}</td><td class="n">${fmtV(o.P)}</td><td class="n">${fmtV(o.W)}</td><td class="n">${rc(v)}</td>${devCell(v)}<td class="n">${nf1.format(shP[i])} %</td><td class="n">${nf1.format(shW[i])} %</td></tr>` +
        (hasOe ? oes.filter(q => q.c === c).sort((x, y) => x.oe.localeCompare(y.oe, 'de')).map(q => { const qv = ratio(q.W, q.P);
          return `<tr><td style="padding-left:20px">${esc(q.oe)}${flag(q.P, q.W)}</td><td class="n">${fmtV(q.P)}</td><td class="n">${fmtV(q.W)}</td><td class="n">${rc(qv)}</td>${devCell(qv)}<td class="n">${nf1.format(pct(q.P, WG.P))} %</td><td class="n">${nf1.format(pct(q.W, WG.W))} %</td></tr>`; }).join('') : ''); }).join('') +
    `<tr class="tot"><td>${FAK}</td><td class="n">${fmtV(WG.P)}</td><td class="n">${fmtV(WG.W)}</td><td class="n">${rc(avg)}</td><td></td><td class="n">100,00 %</td><td class="n">100,00 %</td></tr></table>`;
  // Zuordnung
  $('#catMapBox').innerHTML = `<table><tr><th>Mitarbeiterkreis (aus Daten)</th><th class="n">Datensätze</th><th>Zählt als</th></tr>` +
    S.kreisOrder.map(k => `<tr><td><span class="sw" style="background:${kreisColor(k)}"></span>${esc(k)}</td><td class="n">${S.kreisCounts[k]}</td><td><select data-k="${esc(k)}">${CATS.map(c => `<option${S.catMap[k] === c ? ' selected' : ''}>${c}</option>`).join('')}</select></td></tr>`).join('') + '</table>';
  $$('#catMapBox select').forEach(s => s.onchange = () => { S.catMap[s.dataset.k] = s.value; orderKreise(); renderAll(); });
  // Studiengänge
  const maxN = Math.max(1, ...S.students.map(s => s.n || 0));
  const byC = {}; S.students.forEach(s => (byC[s.cluster || '(ohne Cluster)'] = byC[s.cluster || '(ohne Cluster)'] || []).push(s));
  $('#stTable').innerHTML = `<table><tr><th>Studiengang</th><th class="n">Studierende</th><th style="width:40%"></th></tr>` +
    Object.keys(byC).sort((a, b) => a.localeCompare(b, 'de')).map(c => `<tr class="tot"><td>${esc(c)}</td><td class="n">${nf0.format(byC[c].reduce((t, s) => t + (s.n || 0), 0))}</td><td></td></tr>` +
      byC[c].map(s => `<tr><td style="padding-left:18px">${esc(s.sg)}</td><td class="n">${s.n != null ? nf0.format(s.n) : '–'}</td><td><span class="bar-inline" style="width:${(s.n || 0) / maxN * 100}%"></span></td></tr>`).join('')).join('') + '</table>';
}
