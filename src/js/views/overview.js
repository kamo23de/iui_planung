// Ansicht Mitarbeiterkreise
import {$, css, esc, fmtD, nf0, nf1, pct, sumBy} from '../util.js';
import {S} from '../state.js';
import {kreisColor} from '../parse.js';
import {clusterList, effVz, fmtV, inRestPeriod, isActive, isPartlyResting, restVz, snapshot, tot, unit, used} from '../model.js';
import {axis, barDs, endLabels, legendHtml, mkChart} from '../charts.js';

export function renderOverview() {
  const T = S.today, snap = snapshot(T), cl = clusterList().filter(c => snap.byCluster[c]);
  const act = used().filter(r => isActive(r, T)), resting = used().filter(r => inRestPeriod(r, T)), partly = resting.filter(r => isPartlyResting(r, T));
  const befr = act.filter(r => r.fixedTerm), kw = act.filter(r => r.kw);
  const in12 = act.filter(r => r.ende != null && r.ende <= T + 365);
  const vzSum = sumBy(act, r => effVz(r, T));
  $('#ovKpis').innerHTML = [
    ['Aktive Verträge', nf0.format(act.length), `${nf1.format(vzSum)} VZÄ (nicht ruhende Anteile)`],
    ['Befristet', `${nf1.format(pct(befr.length, act.length))} %`, `${befr.length} Zeitverträge`],
    ['kw-Vermerk', nf0.format(kw.length), `${nf1.format(sumBy(kw, r => r.vz))} VZÄ entfallen künftig`],
    ['Ausscheiden in 12 Monaten', nf0.format(in12.length), `${in12.filter(r => r.endType === 'Ruhestand').length} Ruhestand · ${in12.filter(r => r.endType !== 'Ruhestand').length} Vertragsende · ${in12.filter(r => r.kw).length} mit kw`],
    ['Ruhende Verträge', nf0.format(resting.length), resting.length ? `${nf1.format(sumBy(resting, r => restVz(r, T)))} VZÄ ruhen – nicht mitgezählt` + (partly.length ? ` · davon ${partly.length} teilweise` : '') : 'keine'],
    ['Cluster', nf0.format(cl.length), `${S.kreisOrder.length} Mitarbeiterkreise`],
  ].map(([l, v, d]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
  $('#ovSub1').textContent = `${unit()} mit aktivem Vertrag am ${fmtD(T)} (Beginn ≤ Stichtag ≤ Vertragsende, ruhende Verträge nicht mitgezählt).`;
  const ks = S.kreisOrder.filter(k => snap.byKreis[k]);
  const fmt = v => fmtV(v) + ' · ' + nf1.format(pct(v, snap.total)) + ' %';
  mkChart('cKreisTotal', {type: 'bar', plugins: [endLabels], data: {labels: ks, datasets: [barDs(unit(), ks.map(k => tot(snap.byKreis[k])), ks.map(kreisColor))]},
    options: {indexAxis: 'y', layout: {padding: {right: 70}}, scales: {x: axis({beginAtZero: true}), y: axis({grid: {display: false}})},
      plugins: {endLabels: {enabled: true, fmt}, tooltip: {callbacks: {label: c => ' ' + fmt(c.raw) + ' ' + unit()}}}}});
  $('#lgCluster').innerHTML = legendHtml(ks.map(k => [kreisColor(k), k]));
  $('#cKreisCluster').parentElement.style.height = Math.max(200, cl.length * 46 + 60) + 'px';
  // Summe am Ende jedes Stapels
  const stackTot = {id: 'stackTot', afterDatasetsDraw(c) {
    const ctx = c.ctx; ctx.save(); ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = css('--text-secondary'); ctx.textBaseline = 'middle';
    cl.forEach((cn, j) => { let maxX = 0, y = 0; c.data.datasets.forEach((_, i) => { const el = c.getDatasetMeta(i).data[j]; if (el && el.x > maxX) { maxX = el.x; y = el.y; } }); ctx.fillText(fmtV(tot(snap.byCluster[cn])), maxX + 5, y); });
    ctx.restore(); }};
  mkChart('cKreisCluster', {type: 'bar', plugins: [stackTot], data: {labels: cl, datasets: ks.map(k => barDs(k, cl.map(c => tot(snap.cell[c + '\u0000' + k])), kreisColor(k), {borderWidth: {right: 2}, borderColor: css('--card'), borderRadius: 0}))},
    options: {indexAxis: 'y', layout: {padding: {right: 50}}, scales: {x: axis({stacked: true, beginAtZero: true}), y: axis({stacked: true, grid: {display: false}})},
      plugins: {tooltip: {mode: 'index', filter: x => x.raw > 0, callbacks: {label: c => ` ${c.dataset.label}: ${fmtV(c.raw)}`, footer: it => 'Summe: ' + fmtV(sumBy(it, x => x.raw))}}}}});
  // Small multiples
  const maxV = Math.max(1, ...Object.values(snap.cell).map(tot));
  $('#multiples').innerHTML = cl.map((c, i) => `<div class="m"><h3>${esc(c)}</h3><div class="t">${fmtV(tot(snap.byCluster[c]))} ${unit()}</div><div class="chartbox" style="height:${ks.length * 24 + 30}px"><canvas id="cm${i}"></canvas></div></div>`).join('');
  cl.forEach((c, i) => {
    const data = ks.map(k => tot(snap.cell[c + '\u0000' + k]));
    mkChart('cm' + i, {type: 'bar', plugins: [endLabels], data: {labels: ks, datasets: [barDs(unit(), data, ks.map(kreisColor), {maxBarThickness: 16})]},
      options: {indexAxis: 'y', layout: {padding: {right: 34}}, scales: {x: axis({beginAtZero: true, max: maxV, ticks: {display: false}, grid: {display: false}}), y: axis({grid: {display: false}, ticks: {font: {size: 11}, callback: (_v, j) => ks[j].length > 18 ? ks[j].slice(0, 17) + '…' : ks[j]}})},
        plugins: {endLabels: {enabled: true, fmt: fmtV}, tooltip: {callbacks: {title: x => ks[x[0].dataIndex], label: x => ` ${fmtV(x.raw)} ${unit()}`}}}}});
  });
  // Tabelle
  $('#ovTable').innerHTML = `<table><tr><th>Cluster</th>${ks.map(k => `<th class="n"><span class="sw" style="background:${kreisColor(k)}"></span>${esc(k)}</th>`).join('')}<th class="n">Summe</th></tr>` +
    cl.map(c => `<tr><td>${esc(c)}</td>${ks.map(k => `<td class="n">${fmtV(tot(snap.cell[c + '\u0000' + k]))}</td>`).join('')}<td class="n"><b>${fmtV(tot(snap.byCluster[c]))}</b></td></tr>`).join('') +
    `<tr class="tot"><td>Fakultät</td>${ks.map(k => `<td class="n">${fmtV(tot(snap.byKreis[k]))}</td>`).join('')}<td class="n">${fmtV(snap.total)}</td></tr></table>`;
}
