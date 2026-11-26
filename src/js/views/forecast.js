// Ansicht Forecast
import {$, css, esc, fmtD, isoD, nf1, parseIso, r2, semEnd, semIdx, semLabel, semStart, sumBy} from '../util.js';
import {S} from '../state.js';
import {clusterOf, kreisOf} from '../parse.js';
import {clusterList, effVz, fmtV, inRestPeriod, isActive, isPartlyResting, isVertretung, returnsBetween, snapshot, tot, used, valAt} from '../model.js';
import {axis, barDs, legendHtml, mkChart} from '../charts.js';
import {fillClusterSelect, personTable, stelleTxt} from './semester.js';

export let fcMode = 'sem';
export const setFcMode = v => { fcMode = v; };
export function renderForecast() {
  fillClusterSelect($('#fcCluster'));
  const cur = semIdx(S.today), fs = $('#fcSem'), prev = fs.value;
  fs.innerHTML = Array.from({length: 20}, (_, j) => cur + 1 + j).map(i => `<option value="${i}">${semLabel(i)} (Beginn ${fmtD(semStart(i))})</option>`).join('');
  fs.value = prev && [...fs.options].some(o => o.value === prev) ? prev : String(cur + 2);
  if (!$('#fcDate').value) $('#fcDate').value = isoD(S.today + 365);
  $('#fcDate').min = isoD(S.today + 1); $('#fcDate').max = isoD(semEnd(cur + 20));
  let D = fcMode === 'sem' ? semStart(+fs.value) : parseIso($('#fcDate').value);
  if (D == null) D = S.today + 365;
  const cf = $('#fcCluster').value || null, T = S.today;
  const a = snapshot(T, cf), b = snapshot(D, cf);
  const past = D <= T;
  $('#fcInfo').innerHTML = `Vergleich <b>heute (${fmtD(T)})</b> mit <b>${fmtD(D)}</b>${fcMode === 'sem' ? ' = Beginn ' + semLabel(+fs.value) : ' (' + semLabel(semIdx(D)) + ')'}${cf ? ' · Cluster ' + esc(cf) : ''}. ` +
    (past ? '<span class="sev-W">Zielzeitpunkt liegt nicht in der Zukunft.</span> ' : '') +
    (S.refill ? 'Szenario: Stellen ohne kw werden nach Vertragsende als offene Stellen mitgezählt; auslaufende Vertretungen nicht, da die Stelle an die vertretene Person zurückfällt.' : 'Szenario: nur bestehende Verträge, keine Nachbesetzung.');
  const rs = used().filter(r => !cf || clusterOf(r) === cf);
  const outs = rs.filter(r => isActive(r, T) && !isActive(r, D) && r.ende != null && r.ende < D).sort((x, y) => x.ende - y.ende);
  const insNew = rs.filter(r => !isActive(r, T) && !inRestPeriod(r, T) && r.beginn != null && r.beginn > T && r.beginn <= D && isActive(r, D));
  const rets = rs.filter(r => returnsBetween(r, T, D));
  const zDate = r => rets.includes(r) ? r.ruht + 1 : r.beginn;
  const ins = [...insNew, ...rets].sort((x, y) => zDate(x) - zDate(y));
  // Wertung: Abgänge mit dem Stand heute, Zugänge mit dem Stand am Zieltag, Rückkehr = wieder wirksamer (bisher ruhender) Anteil
  const fv = r => rets.includes(r) ? r2(valAt(r, D) - valAt(r, T)) : outs.includes(r) ? valAt(r, T) : valAt(r, D);
  const s = l => sumBy(l, fv);
  const delta = (x, y) => { const d = r2(y - x); return `<span class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲ +' : d < 0 ? '▼ −' : '± '}${fmtV(Math.abs(d))}</span>`; };
  const kpis = [
    [S.refill ? 'Stellen gesamt' : 'Besetzte Verträge', fmtV(b.total), `heute ${fmtV(a.total)} · ${delta(a.total, b.total)}`],
    ['davon besetzt', fmtV(b.b), `heute ${fmtV(a.b)} · ${delta(a.b, b.b)}`],
  ];
  if (S.refill) kpis.push(['Offene Stellen (ohne kw)', fmtV(b.v), 'nach Vertragsende nachzubesetzen']);
  const outVtL = outs.filter(isVertretung);
  kpis.push(['Abgänge', fmtV(s(outs)), `${outs.length} Verträge · ${outs.filter(r => r.endType === 'Ruhestand' && !isVertretung(r)).length} Ruhestand · mit kw (Stelle entfällt): ${outs.filter(r => r.kw && !isVertretung(r)).length}` +
    (outVtL.length ? ` · ${outVtL.length} ${outVtL.length === 1 ? 'Vertretung endet' : 'Vertretungen enden'} (keine Nachbesetzung)` : '')]);
  kpis.push(['Zugänge', fmtV(s(ins)), `${insNew.length} ${insNew.length === 1 ? 'neuer Vertrag' : 'neue Verträge'}` + (rets.length ? ` · ${rets.length} Rückkehr nach Ruhen` : '')]);
  $('#fcKpis').innerHTML = kpis.map(([l, v, d]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
  const ks = S.kreisOrder.filter(k => a.byKreis[k] || b.byKreis[k]);
  // Zu- und Abgänge getrennt erfassen, damit ein Zugang nicht durch einen gleichzeitigen Abgang „verschwindet“
  const flow = (list, c, k) => sumBy(list.filter(r => (!c || clusterOf(r) === c) && (!k || kreisOf(r) === k)), fv);
  const inK = k => flow(insNew, null, k), retK = k => flow(rets, null, k), outK = k => flow(outs.filter(r => !isVertretung(r)), null, k), outVtK = k => flow(outs.filter(isVertretung), null, k);
  const bOf = o => o ? o.b : 0, vOf = o => o ? o.v : 0;
  const stayK = k => r2(bOf(b.byKreis[k]) - inK(k) - retK(k));
  const P = {maxBarThickness: 14, stack: 'p', borderRadius: 0, borderWidth: {right: 2}, borderColor: css('--card')};
  const dsF = [
    barDs('heute', ks.map(k => tot(a.byKreis[k])), css('--muted'), {maxBarThickness: 14, stack: 'h'}),
    barDs('Prognose: aus heutigem Bestand', ks.map(stayK), css('--s1'), P),
    barDs('Prognose: Zugänge bis Zieldatum', ks.map(inK), css('--s3'), P),
    barDs('Prognose: Rückkehr nach Ruhen', ks.map(retK), css('--s4'), P),
  ];
  if (S.refill) dsF.push(barDs('Prognose: offene Stellen (ohne kw)', ks.map(k => vOf(b.byKreis[k])), css('--vacant'), P));
  dsF.push(barDs('Abgänge bis Zieldatum', ks.map(outK), css('--s2'), {maxBarThickness: 14, stack: 'o', borderRadius: 0, borderWidth: {right: 2}, borderColor: css('--card')}));
  dsF.push(barDs('Abgänge: Vertretung endet (keine Nachbesetzung)', ks.map(outVtK), css('--s8'), {maxBarThickness: 14, stack: 'o', borderRadius: 0}));
  $('#lgFc').innerHTML = legendHtml(dsF.map(d => [d.backgroundColor, d.label]));
  $('#cFc').parentElement.style.height = Math.max(240, ks.length * 66 + 40) + 'px';
  mkChart('cFc', {type: 'bar', data: {labels: ks, datasets: dsF},
    options: {indexAxis: 'y', scales: {x: axis({beginAtZero: true, stacked: true}), y: axis({stacked: true, grid: {display: false}})},
      plugins: {tooltip: {mode: 'index', filter: x => x.raw > 0, callbacks: {label: c => ` ${c.dataset.label}: ${fmtV(c.raw)}`,
        footer: it => { const k = ks[it[0].dataIndex]; const d = r2(tot(b.byKreis[k]) - tot(a.byKreis[k]));
          return [`Prognose gesamt: ${fmtV(tot(b.byKreis[k]))}`, `Zugänge +${fmtV(r2(inK(k) + retK(k)))} · Abgänge −${fmtV(r2(outK(k) + outVtK(k)))}` + (outVtK(k) ? ` (davon Vertretungen −${fmtV(outVtK(k))})` : ''), 'Saldo: ' + (d >= 0 ? '+' : '−') + fmtV(Math.abs(d))]; }}}}}});
  // Veränderungs-Matrix: Saldo plus getrennte Zu- und Abgänge
  const cl = clusterList().filter(c => !cf || c === cf).filter(c => a.byCluster[c] || b.byCluster[c]);
  const netOf = (c, k) => r2((k ? tot(b.cell[c + '\u0000' + k]) : tot(b.byCluster[c])) - (k ? tot(a.cell[c + '\u0000' + k]) : tot(a.byCluster[c])));
  const maxAbs = Math.max(0.0001, ...cl.flatMap(c => ks.map(k => Math.abs(netOf(c, k)))));
  const cell = (d, zin, zout) => {
    const al = Math.round(Math.min(1, Math.abs(d) / maxAbs) * 45 + (d ? 10 : 0)), col = d > 0 ? css('--pos') : css('--neg');
    const fl = (zin || zout) ? `<div class="flow">${zin ? `<span class="fin">+${fmtV(zin)} zu</span>` : ''}${zin && zout ? ' ' : ''}${zout ? `<span class="fout">−${fmtV(zout)} ab</span>` : ''}</div>` : '';
    return `<td class="n" style="background:${d ? `color-mix(in srgb, ${col} ${al}%, transparent)` : 'transparent'}">${d ? (d > 0 ? '+' : '−') + fmtV(Math.abs(d)) : (zin || zout ? '±0' : '·')}${fl}</td>`; };
  $('#fcDelta').innerHTML = `<table><tr><th>Cluster</th>${ks.map(k => `<th class="n">${esc(k)}</th>`).join('')}<th class="n">Summe</th></tr>` +
    cl.map(c => `<tr><td>${esc(c)}<div class="note">${fmtV(tot(a.byCluster[c]))} → ${fmtV(tot(b.byCluster[c]))}</div></td>${ks.map(k => cell(netOf(c, k), flow(ins, c, k), flow(outs, c, k))).join('')}${cell(netOf(c, null), flow(ins, c, null), flow(outs, c, null))}</tr>`).join('') +
    `<tr class="tot"><td>Gesamt</td>${ks.map(k => cell(r2(tot(b.byKreis[k]) - tot(a.byKreis[k])), r2(inK(k) + retK(k)), r2(outK(k) + outVtK(k)))).join('')}${cell(r2(b.total - a.total), s(ins), s(outs))}</tr></table>`;
  $('#fcOut').innerHTML = personTable(outs, ['Ausscheiden', r => r.ende, stelleTxt]);
  $('#fcIn').innerHTML = personTable(ins, ['Beginn / Rückkehr', zDate, r => [rets.includes(r) ? `<span class="pill" style="border-color:var(--s4)">Rückkehr nach Ruhen${isPartlyResting(r, T) ? ` (+${nf1.format(r2(effVz(r, D) - effVz(r, T)))} VZÄ)` : ''}</span>` : '', r.kw ? 'kw' : ''].filter(Boolean).join(' ')]);
}
