// Ansicht Semesterverlauf
import {$, css, esc, fmtD, nf1, nf2, r2, semEnd, semIdx, semLabel, semStart, sumBy} from '../util.js';
import {S} from '../state.js';
import {clusterOf, kreisColor, kreisOf} from '../parse.js';
import {clusterList, fmtV, inContract, isVertretung, snapshot, unit, used, valAt} from '../model.js';
import {axis, barDs, legendHtml, mkChart} from '../charts.js';

export function fillClusterSelect(sel) {
  const cur = sel.value;
  sel.innerHTML = '<option value="">Alle Cluster</option>' + clusterList().map(c => `<option>${esc(c)}</option>`).join('');
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}
export function renderSemester() {
  fillClusterSelect($('#semCluster'));
  const cf = $('#semCluster').value || null, cur = semIdx(S.today);
  const sems = []; for (let i = cur - +$('#semPast').value; i <= cur + +$('#semAhead').value; i++) sems.push(i);
  const snaps = sems.map(i => snapshot(semStart(i), cf));
  const ks = S.kreisOrder.filter(k => snaps.some(s => s.byKreis[k]));
  const labels = sems.map(i => semLabel(i) + (i === cur ? ' ◂' : ''));
  const ds = ks.map(k => barDs(k, snaps.map(s => s.byKreis[k] ? s.byKreis[k].b : 0), kreisColor(k), {borderRadius: 0, borderWidth: {top: 1}, borderColor: css('--card'), maxBarThickness: 40}));
  if (S.refill) ds.push(barDs('Offene Stellen (ohne kw, nachzubesetzen)', snaps.map(s => s.v), css('--vacant'), {borderRadius: 0, borderWidth: {top: 1}, borderColor: css('--card'), maxBarThickness: 40}));
  $('#lgSem').innerHTML = legendHtml(ds.map(d => [d.backgroundColor, d.label]));
  $('#semRefillNote').textContent = S.refill ? 'Szenario: Stellen ohne kw-Vermerk werden nach Vertragsende als offene Stellen weitergeführt (grau); auslaufende Vertretungen nicht.' : 'Nur bestehende Verträge – auslaufende Stellen werden nicht ersetzt. (Szenario „weiterführen“ oben einschaltbar.)';
  mkChart('cSem', {type: 'bar', data: {labels, datasets: ds},
    options: {scales: {x: axis({stacked: true, grid: {display: false}, ticks: {maxRotation: 60, autoSkip: false, font: c => ({weight: sems[c.index] === cur ? '700' : '400'})}}), y: axis({stacked: true, beginAtZero: true, title: {display: true, text: unit()}})},
      plugins: {tooltip: {mode: 'index', filter: x => x.raw > 0, callbacks: {title: it => semLabel(sems[it[0].dataIndex]) + ' (Stand ' + fmtD(semStart(sems[it[0].dataIndex])) + ')', label: c => ` ${c.dataset.label}: ${fmtV(c.raw)}`, footer: it => 'Summe: ' + fmtV(sumBy(it, x => x.raw))}}}}});
  // Zu-/Abgänge
  const rs = used().filter(r => !cf || clusterOf(r) === cf);
  const inSem = (d, i) => d != null && d >= semStart(i) && d <= semEnd(i);
  const outVt = sems.map(i => -sumBy(rs.filter(r => isVertretung(r) && inSem(r.ende, i)), r => valAt(r, r.ende)));
  const outKw = sems.map(i => -sumBy(rs.filter(r => r.kw && !isVertretung(r) && inSem(r.ende, i)), r => valAt(r, r.ende)));
  const outRe = sems.map(i => -sumBy(rs.filter(r => !r.kw && !isVertretung(r) && r.endType !== 'Ruhestand' && inSem(r.ende, i)), r => valAt(r, r.ende)));
  const outRs = sems.map(i => -sumBy(rs.filter(r => !r.kw && !isVertretung(r) && r.endType === 'Ruhestand' && inSem(r.ende, i)), r => valAt(r, r.ende)));
  const inn = sems.map(i => sumBy(rs.filter(r => inSem(r.beginn, i)), r => valAt(r, r.beginn)));
  const ret = sems.map(i => sumBy(rs.filter(r => r.ruht != null && inSem(r.ruht + 1, i) && inContract(r, r.ruht + 1)), r => r2(valAt(r, r.ruht + 1) - valAt(r, r.ruht))));
  const fds = [barDs('Zugänge', inn, css('--s3'), {stack: 's'}), barDs('Rückkehr nach Ruhen', ret, css('--s4'), {stack: 's'}), barDs('Abgänge – Ruhestand', outRs, css('--s7'), {stack: 's'}), barDs('Abgänge – Vertragsende, Stelle bleibt (ohne kw)', outRe, css('--s1'), {stack: 's'}), barDs('Abgänge – Stelle entfällt (kw)', outKw, css('--s2'), {stack: 's'}), barDs('Abgänge – Vertretung endet (keine Nachbesetzung)', outVt, css('--s8'), {stack: 's'})];
  $('#lgFlow').innerHTML = legendHtml(fds.map(d => [d.backgroundColor, d.label]));
  mkChart('cFlow', {type: 'bar', data: {labels, datasets: fds},
    options: {onClick: (_e, el) => { if (el.length) { $('#semDetail').value = sems[el[0].index]; renderSemDetail(); } },
      scales: {x: axis({stacked: true, grid: {display: false}, ticks: {maxRotation: 60, autoSkip: false}}), y: axis({stacked: true, ticks: {callback: v => fmtV(Math.abs(v))}})},
      plugins: {tooltip: {mode: 'index', callbacks: {label: c => ` ${c.dataset.label}: ${fmtV(Math.abs(c.raw))}`}}}}});
  const sd = $('#semDetail'), prev = sd.value;
  sd.innerHTML = sems.map(i => `<option value="${i}">${semLabel(i)}</option>`).join('');
  sd.value = sems.includes(+prev) ? prev : cur;
  renderSemDetail();
  $('#semTable').innerHTML = `<table><tr><th>Semester</th><th>Stichtag</th>${ks.map(k => `<th class="n"><span class="sw" style="background:${kreisColor(k)}"></span>${esc(k)}</th>`).join('')}${S.refill ? '<th class="n">offen</th>' : ''}<th class="n">Summe</th><th class="n">Zugänge</th><th class="n">Abgänge (davon kw)</th></tr>` +
    sems.map((i, j) => `<tr${i === cur ? ' style="font-weight:600"' : ''}><td>${semLabel(i)}</td><td>${fmtD(semStart(i))}</td>${ks.map(k => `<td class="n">${fmtV(snaps[j].byKreis[k] ? snaps[j].byKreis[k].b : 0)}</td>`).join('')}${S.refill ? `<td class="n">${fmtV(snaps[j].v)}</td>` : ''}<td class="n"><b>${fmtV(snaps[j].total)}</b></td><td class="n">${fmtV(r2(inn[j] + ret[j]))}</td><td class="n">${fmtV(r2(-(outKw[j] + outRe[j] + outRs[j] + outVt[j])))} (${fmtV(-outKw[j])})</td></tr>`).join('') + '</table>';
}
export function personTable(list, extraCol, sub) {
  if (!list.length) return '<p class="note">Keine.</p>';
  return `<table><tr><th>Name</th><th>Mitarbeiterkreis</th><th>Cluster</th><th class="n">VZÄ</th><th>${extraCol[0]}</th><th>Stelle</th></tr>` +
    list.map(r => `<tr><td>${esc([r.name, r.vorname].filter(Boolean).join(', '))}</td><td><span class="sw" style="background:${kreisColor(kreisOf(r))}"></span>${esc(kreisOf(r))}</td><td>${esc(clusterOf(r))}</td><td class="n">${nf2.format(r.vz || 0)}</td><td class="n">${fmtD(extraCol[1](r))}${sub ? `<div class="note">${sub(r)}</div>` : ''}</td><td>${extraCol[2](r)}</td></tr>`).join('') + '</table>';
}
export const stelleTxt = r => isVertretung(r) ? `<span class="pill vt-end" title="Die Stelle fällt an die vertretene Person zurück">Vertretung endet – keine Nachbesetzung</span>` +
  (r.vertretene ? ` <span class="note">Stelle von ${esc([r.vertretene.vorname, r.vertretene.name].filter(Boolean).join(' '))}${r.vertretene.ruht != null ? (r.vertretene.ruht < r.ende ? ` (zurück ab ${fmtD(r.vertretene.ruht + 1)})` : r.vertretene.ruht > r.ende ? ` (ruht noch bis ${fmtD(r.vertretene.ruht)})` : ' (kehrt zurück)') : ''}</span>` : '') :
  (r.endType === 'Ruhestand' ? '<span class="pill" style="border-color:var(--s7)">Ruhestand</span> ' : '') + (r.kw ? '<span class="pill" style="border-color:var(--s2)">entfällt (kw)</span>' : '<span class="pill">bleibt – Nachbesetzung</span>');
export function renderSemDetail() {
  const i = +$('#semDetail').value, cf = $('#semCluster').value || null, cum = $('#semCum').checked;
  // kumulativ: vom Beginn des aktuellen Semesters (bzw. des gewählten, falls es zurückliegt) bis zum Ende des gewählten Semesters
  const cur = semIdx(S.today), from = cum ? semStart(Math.min(cur, i)) : semStart(i), to = semEnd(i);
  const list = used().filter(r => (!cf || clusterOf(r) === cf) && r.ende != null && r.ende >= from && r.ende <= to).sort((a, b) => a.ende - b.ende || a.name.localeCompare(b.name, 'de'));
  $('#semDetailLbl').textContent = cum ? 'Ausscheiden (Vertragsende/Ruhestand) kumulativ bis' : 'Ausscheiden (Vertragsende/Ruhestand) in';
  const nVt = list.filter(isVertretung).length, nKw = list.filter(r => r.kw && !isVertretung(r)).length, nRs = list.filter(r => r.endType === 'Ruhestand' && !isVertretung(r)).length;
  $('#semDetailSum').textContent = list.length ? `${cum ? `${semLabel(Math.min(cur, i))} bis ${semLabel(i)} · ` : ''}${list.length} ${list.length === 1 ? 'Vertrag' : 'Verträge'} · ${nf1.format(sumBy(list, r => r.vz))} VZÄ · ${nRs} Ruhestand · ${nKw} mit kw · ${nVt} ${nVt === 1 ? 'Vertretung' : 'Vertretungen'}` : '';
  $('#semDetailTable').innerHTML = personTable(list, [cum ? 'Ausscheiden (Semester)' : 'Ausscheiden', r => r.ende, stelleTxt], cum ? (r => semLabel(semIdx(r.ende))) : null);
}
