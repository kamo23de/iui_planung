// Ansicht Kapazität
import {$, css, esc, fmtD, nf0, nf1, pct, r2, semIdx, semLabel, semStart, sumBy} from '../util.js';
import {S} from '../state.js';
import {catColor, clusterOf} from '../parse.js';
import {clusterList, effDep, inRestPeriod, isActive, isPartlyResting, used} from '../model.js';
import {capStats} from '../teaching.js';
import {axis, barDs, charts, endLabels, legendHtml, mkChart} from '../charts.js';
import {labSort, oeOf} from './detail.js';
import {fillClusterSelect} from './semester.js';

/* Lehrangebot: Summe Deputat (SWS je Semester) der Personen mit aktivem Vertrag; Jahreslehrangebot = 2 × SWS je Semester
   (KapVO: jährliche Aufnahmekapazität = 2 × Lehrangebot je Semester / Curricularanteil).
   Erforderliche Kapazität je Studiengang = CNW × Studienplätze × Aufnahmen pro Jahr. */
export const CAP_GROUPS = [['P', 'Professor/innen', 'Professor/in'], ['L', 'LfbA', 'LfbA'], ['W', 'WiMi', 'WiMi'], ['O', 'Sonstige', 'Sonstige']];
export const ART_COL = {Bachelor: '--s7', Master: '--s5', Sonstige: '--muted', '': '--muted'};
/* Zwei nebeneinanderstehende Diagramme mit gleicher Kategorie-Reihenfolge vertikal deckungsgleich machen */
export function alignCharts(a, b) {
  for (let pass = 0; pass < 2; pass++) {
    const A = a.chartArea, B = b.chartArea;
    const dt = Math.round(A.top - B.top), db = Math.round(A.bottom - B.bottom);
    if (!dt && !db) return;
    const pad = (c, top, bottom) => { const p = c.options.layout.padding = Object.assign({top: 0, bottom: 0, left: 0, right: 0}, c.options.layout.padding || {}); p.top += top; p.bottom += bottom; c.update('none'); };
    if (dt > 0) pad(b, dt, 0); else if (dt < 0) pad(a, -dt, 0);
    if (db < 0) pad(b, 0, -db); else if (db > 0) pad(a, 0, db);
  }
}
export function renderCapacity() {
  const cur = semIdx(S.today), sel = $('#capWhen'), prev = sel.value;
  sel.innerHTML = `<option value="today">heute (${fmtD(S.today)})</option>` + Array.from({length: 20}, (_, j) => cur + 1 + j).map(i => `<option value="${i}">${semLabel(i)}</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === prev) ? prev : 'today';
  const D = sel.value === 'today' ? S.today : semStart(+sel.value);
  fillClusterSelect($('#capCluster'));
  const cf = $('#capCluster').value || null, intakes = +$('#capIntakes').value;
  const hasDep = 'deputat' in S.colMap, sm = S.raw.stud ? S.raw.stud.map : {}, hasReq = 'cnw' in sm && 'pl' in sm;
  $('#capMissing').innerHTML = [!hasDep ? '⚠ Im Personalblatt fehlt die Spalte <b>Deputat</b> – das Lehrangebot kann nicht berechnet werden.' : '',
    !hasReq ? '⚠ Im Studierendenblatt fehlen die Spalten <b>CNW</b> und/oder <b>Studienplätze</b> – die erforderliche Kapazität kann nicht berechnet werden.' : ''].filter(Boolean).join('<br>');
  $('#capMissing').classList.toggle('hidden', hasDep && hasReq);
  const act = used().filter(r => isActive(r, D));
  const T = capStats(act, D);
  // Erforderliche Kapazität je Studiengang
  const sg = S.students.map(s => ({...s, req: (s.cnw > 0 && s.pl >= 0 && !s.cnwErr && !s.plErr) ? r2(s.cnw * s.pl * intakes) : null}));
  const reqTot = sumBy(sg, s => s.req);
  const reqBy = {}; sg.forEach(s => { if (s.req != null) reqBy[s.cluster || '(ohne Cluster)'] = r2((reqBy[s.cluster || '(ohne Cluster)'] || 0) + s.req); });
  const fmtS = v => nf1.format(v);
  const bal = r2(T.year - reqTot), util = T.year ? r2(reqTot / T.year * 100) : null;
  const utilPill = u => u == null ? '<span class="note">–</span>' : `<span class="pill ${u > 100 ? 'sev-E' : u >= 90 ? 'sev-W' : ''}" ${u < 90 ? 'style="border-color:var(--good)"' : ''}>${nf1.format(u)} %${u > 100 ? ' · Überlast' : u >= 90 ? ' · knapp' : ''}</span>`;
  const balTxt = b => `<span class="${b < 0 ? 'down' : 'up'}">${b < 0 ? '−' : '+'}${fmtS(Math.abs(b))}</span>`;
  $('#capKpis').innerHTML = [
    ['Lehrangebot je Semester', fmtS(T.sws) + ' SWS', `${T.teach} Lehrende mit Deputat · ${T.support} unterstützend (Deputat 0)`],
    ['Lehrangebot je Jahr', fmtS(T.year), 'Deputatstunden (2 × SWS je Semester)'],
    ['Erforderliche Kapazität je Jahr', fmtS(reqTot), `CNW × Studienplätze${intakes === 2 ? ' × 2 Aufnahmen' : ''}, ${sg.filter(s => s.req != null).length} Studiengänge`],
    ['Bilanz', balTxt(bal), bal < 0 ? 'Deputatstunden fehlen' : 'Deputatstunden Reserve'],
    ['Auslastung', util == null ? '–' : nf1.format(util) + ' %', util == null ? '' : util > 100 ? '⛔ Lehrangebot reicht nicht aus' : util >= 90 ? '⚠ knapp' : '✓ ausreichend'],
  ].map(([l, v, d]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
  const restDep = used().filter(r => inRestPeriod(r, D) && r.deputat > 0 && !r.deputatErr);
  // Vertretungen: nur aktive Verträge zählen – die Vertretung zählt, der vertretene ruhende Vertrag nicht
  const vtAct = used().filter(r => r.vertretene && isActive(r, D));
  const vtDouble = vtAct.filter(r => !inRestPeriod(r.vertretene, D));
  $('#capSub').textContent = `Stand ${fmtD(D)}${sel.value === 'today' ? '' : ' (' + semLabel(+sel.value) + ')'} · nur Personen mit aktivem Vertrag und Deputat > 0 · Studierenden- und Studiengangsdaten unverändert.` +
    (restDep.length ? ` · Nicht gezählt, da ruhend: ${nf1.format(sumBy(restDep, r => r2(r.deputat - effDep(r, D))))} SWS aus ${restDep.length} ${restDep.length === 1 ? 'Vertrag' : 'Verträgen'}${restDep.some(r => isPartlyResting(r, D)) ? ` (davon ${restDep.filter(r => isPartlyResting(r, D)).length} teilweise ruhend)` : ''}.` : '') +
    (vtAct.length ? ` · Gezählt als aktive Vertretung: ${vtAct.length} ${vtAct.length === 1 ? 'Vertrag' : 'Verträge'} mit ${nf1.format(sumBy(vtAct, r => effDep(r, D) || 0))} SWS.` : '');
  $('#capDouble').innerHTML = vtDouble.length ? `⚠ ${vtDouble.length} ${vtDouble.length === 1 ? 'Vertretung bezieht' : 'Vertretungen beziehen'} sich auf ${vtDouble.length === 1 ? 'einen Vertrag, der' : 'Verträge, die'} am Stichtag nicht ruh${vtDouble.length === 1 ? 't' : 'en'} – beide Verträge sind aktiv und werden gezählt (${vtDouble.map(r => esc(r.name) + ' → ' + esc(r.vertretene.name)).join(', ')}). Bitte in der Datenprüfung klären.` : '';
  $('#capDouble').classList.toggle('hidden', !vtDouble.length);

  // ---- je Cluster ----
  const cls = clusterList().filter(c => act.some(r => clusterOf(r) === c));
  Object.keys(reqBy).forEach(c => { if (!cls.includes(c)) cls.push(c); });
  cls.sort((a, b) => a.localeCompare(b, 'de'));
  const cs = Object.fromEntries(cls.map(c => [c, capStats(act.filter(r => clusterOf(r) === c), D)]));
  const grpDs = (labels, stats) => CAP_GROUPS.map(([k, l, cat]) => barDs(l, labels.map((_, i) => stats[i][k]), catColor(cat), {stack: 's', borderRadius: 0, borderWidth: {right: 2}, borderColor: css('--card'), maxBarThickness: 22}));
  $('#lgCapCl').innerHTML = legendHtml(CAP_GROUPS.map(([, l, cat]) => [catColor(cat), l]));
  $('#capClBox').style.height = Math.max(200, cls.length * 44 + 60) + 'px';
  const totLbl = (vals) => ({id: 'totLbl', afterDatasetsDraw(c) { const ctx = c.ctx; ctx.save(); ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = css('--text-secondary'); ctx.textBaseline = 'middle';
    vals.forEach((v, j) => { let x = c.scales.x.left; c.data.datasets.forEach((_, i) => { const el = c.getDatasetMeta(i).data[j]; if (el && el.x > x) x = el.x; }); if (v) ctx.fillText(fmtS(v), x + 5, c.scales.y.getPixelForValue(j)); }); ctx.restore(); }});
  mkChart('cCapCl', {type: 'bar', plugins: [totLbl(cls.map(c => cs[c].sws))], data: {labels: cls, datasets: grpDs(cls, cls.map(c => cs[c]))},
    options: {indexAxis: 'y', layout: {padding: {right: 50}}, scales: {x: axis({stacked: true, beginAtZero: true, title: {display: true, text: 'SWS je Semester'}}), y: axis({stacked: true, grid: {display: false}})},
      plugins: {tooltip: {mode: 'index', filter: x => x.raw > 0, callbacks: {label: c => ` ${c.dataset.label}: ${fmtS(c.raw)} SWS`, footer: it => 'Summe: ' + fmtS(cs[cls[it[0].dataIndex]].sws) + ' SWS'}}}}});
  // verfügbar vs. erforderlich je Cluster
  const balCls = cls.filter(c => cs[c].year || reqBy[c]);
  $('#lgCapBal').innerHTML = legendHtml([[css('--s1'), 'Lehrangebot je Jahr (verfügbar)'], [css('--s2'), 'Erforderliche Kapazität je Jahr']]);
  $('#capBalBox').style.height = Math.max(200, balCls.length * 52 + 60) + 'px';
  mkChart('cCapBal', {type: 'bar', plugins: [endLabels], data: {labels: balCls, datasets: [
      barDs('Lehrangebot je Jahr', balCls.map(c => cs[c].year), css('--s1'), {maxBarThickness: 14}),
      barDs('Erforderliche Kapazität je Jahr', balCls.map(c => reqBy[c] || 0), css('--s2'), {maxBarThickness: 14})]},
    options: {indexAxis: 'y', layout: {padding: {right: 60}}, scales: {x: axis({beginAtZero: true, title: {display: true, text: 'Deputatstunden je Jahr'}}), y: axis({grid: {display: false}})},
      plugins: {endLabels: {enabled: true, fmt: fmtS}, tooltip: {callbacks: {label: c => ` ${c.dataset.label}: ${fmtS(c.raw)}`,
        footer: it => { const c = balCls[it[0].dataIndex], y = cs[c].year, q = reqBy[c] || 0; return [`Bilanz: ${y - q < 0 ? '−' : '+'}${fmtS(Math.abs(r2(y - q)))}`, `Auslastung: ${y ? nf1.format(r2(q / y * 100)) + ' %' : '–'}`]; }}}}}});
  const row = (lbl, st, req, cls2) => { const b = req == null ? null : r2(st.year - req), u = (req != null && st.year) ? r2(req / st.year * 100) : null;
    return `<tr class="${cls2 || ''}"><td>${lbl}</td><td class="n">${st.teach}</td><td class="n">${st.support}</td>${CAP_GROUPS.map(([k]) => `<td class="n">${fmtS(st[k])}</td>`).join('')}<td class="n"><b>${fmtS(st.sws)}</b></td><td class="n">${fmtS(st.year)}</td><td class="n">${req == null ? '<span class="note">–</span>' : fmtS(req)}</td><td class="n">${b == null ? '<span class="note">–</span>' : balTxt(b)}</td><td class="n">${req == null ? '<span class="note">–</span>' : utilPill(u)}</td></tr>`; };
  const head = (first) => `<tr><th>${first}</th><th class="n">Lehrende</th><th class="n">unterstützend</th>${CAP_GROUPS.map(([, l, cat]) => `<th class="n"><span class="sw" style="background:${catColor(cat)}"></span>${l} (SWS)</th>`).join('')}<th class="n">SWS je Semester</th><th class="n">Lehrangebot je Jahr</th><th class="n">Erforderlich je Jahr</th><th class="n">Bilanz</th><th class="n">Auslastung</th></tr>`;
  $('#capClTable').innerHTML = `<table>${head('Cluster')}${cls.map(c => row(esc(c), cs[c], reqBy[c] ?? null)).join('')}${row('Fakultät gesamt', T, reqTot, 'tot')}</table>`;

  // ---- je Organisationseinheit ----
  const oeAct = act.filter(r => !cf || clusterOf(r) === cf);
  const oeKeys = [...new Set(oeAct.map(r => clusterOf(r) + '\u0000' + oeOf(r)))].sort(labSort);
  const os = Object.fromEntries(oeKeys.map(k => [k, capStats(oeAct.filter(r => clusterOf(r) + '\u0000' + oeOf(r) === k), D)]));
  const oeLabels = oeKeys.map(k => { const [c, o] = k.split('\u0000'); return cf ? o : `${o} (${c})`; });
  const oeShown = oeKeys.filter(k => os[k].sws > 0 || os[k].support > 0);
  $('#lgCapOe').innerHTML = legendHtml(CAP_GROUPS.map(([, l, cat]) => [catColor(cat), l]));
  $('#capOeBox').style.height = Math.max(200, oeShown.length * 30 + 60) + 'px';
  const oeL = oeShown.map(k => oeLabels[oeKeys.indexOf(k)]);
  mkChart('cCapOe', {type: 'bar', plugins: [totLbl(oeShown.map(k => os[k].sws))], data: {labels: oeL, datasets: grpDs(oeL, oeShown.map(k => os[k]))},
    options: {indexAxis: 'y', layout: {padding: {right: 50}}, scales: {x: axis({stacked: true, beginAtZero: true, title: {display: true, text: 'SWS je Semester'}}), y: axis({stacked: true, grid: {display: false}})},
      plugins: {tooltip: {mode: 'index', filter: x => x.raw > 0, callbacks: {label: c => ` ${c.dataset.label}: ${fmtS(c.raw)} SWS`, footer: it => 'Summe: ' + fmtS(os[oeShown[it[0].dataIndex]].sws) + ' SWS'}}}}});
  const oeCl = [...new Set(oeKeys.map(k => k.split('\u0000')[0]))];
  const rowO = (lbl, st, share, cls2) => `<tr class="${cls2 || ''}"><td>${lbl}</td><td class="n">${st.teach}</td><td class="n">${st.support}</td>${CAP_GROUPS.map(([k]) => `<td class="n">${fmtS(st[k])}</td>`).join('')}<td class="n"><b>${fmtS(st.sws)}</b></td><td class="n">${fmtS(st.year)}</td><td class="n">${share == null ? '' : nf1.format(share) + ' %'}</td></tr>`;
  $('#capOeTable').innerHTML = `<table><tr><th>Cluster / Organisationseinheit</th><th class="n">Lehrende</th><th class="n">unterstützend</th>${CAP_GROUPS.map(([, l, cat]) => `<th class="n"><span class="sw" style="background:${catColor(cat)}"></span>${l} (SWS)</th>`).join('')}<th class="n">SWS je Semester</th><th class="n">Lehrangebot je Jahr</th><th class="n">Anteil am Cluster</th></tr>` +
    oeCl.map(c => { const cst = capStats(oeAct.filter(r => clusterOf(r) === c), D);
      return rowO(esc(c), cst, null, 'tot') + oeKeys.filter(k => k.startsWith(c + '\u0000')).map(k => rowO(`<span style="padding-left:16px">${esc(k.split('\u0000')[1])}</span>`, os[k], pct(os[k].sws, cst.sws))).join(''); }).join('') + '</table>';

  // ---- erforderliche Kapazität je Studiengang ----
  const sgs = [...sg].sort((a, b) => (b.req ?? -1) - (a.req ?? -1) || a.sg.localeCompare(b.sg, 'de'));
  const sgL = sgs.map(s => s.sg || '(ohne Namen)');
  const arts = [...new Set(sgs.map(s => s.art || ''))];
  $('#lgCapSg').innerHTML = legendHtml(arts.map(a => [css(ART_COL[a]), a || 'Art unbekannt']));
  const h = Math.max(220, sgs.length * 30 + 60) + 'px'; $('#capSgBox').style.height = h; $('#capStBox').style.height = h;
  const colors = sgs.map(s => css(ART_COL[s.art || '']));
  mkChart('cCapSg', {type: 'bar', plugins: [endLabels], data: {labels: sgL, datasets: [barDs('Erforderliche Kapazität je Jahr', sgs.map(s => s.req), colors, {maxBarThickness: 18})]},
    options: {indexAxis: 'y', layout: {padding: {right: 60}}, scales: {x: axis({beginAtZero: true, afterFit: sc => { sc.height = 48; }, title: {display: true, text: 'Deputatstunden je Jahr (CNW × Studienplätze)'}}), y: axis({grid: {display: false}})},
      plugins: {endLabels: {enabled: true, fmt: fmtS}, tooltip: {callbacks: {label: c => { const s = sgs[c.dataIndex]; return s.req == null ? ' nicht berechenbar (CNW/Studienplätze fehlen)' : [` ${fmtS(s.req)} = CNW ${fmtS(s.cnw)} × ${s.pl} Plätze${intakes === 2 ? ' × 2' : ''}`, ` ${s.art || 'Art unbekannt'} · ${s.cluster || 'ohne Cluster'}`]; }}}}}});
  mkChart('cCapSt', {type: 'bar', plugins: [endLabels], data: {labels: sgL, datasets: [barDs('Eingeschriebene Studierende', sgs.map(s => s.n), colors, {maxBarThickness: 18})]},
    options: {indexAxis: 'y', layout: {padding: {right: 50}}, scales: {x: axis({beginAtZero: true, afterFit: sc => { sc.height = 48; }, title: {display: true, text: 'Eingeschriebene Studierende'}}), y: axis({grid: {display: false}, ticks: {display: false}})},
      plugins: {endLabels: {enabled: true, fmt: v => nf0.format(v)}, tooltip: {callbacks: {title: it => sgL[it[0].dataIndex], label: c => { const s = sgs[c.dataIndex]; return [` ${nf0.format(s.n ?? 0)} Studierende`, ` ${s.pl ? nf1.format(r2((s.n ?? 0) / s.pl)) + ' je Studienplatz einer Kohorte' : ''}`]; }}}}}});
  alignCharts(charts.cCapSg, charts.cCapSt);
  const artSum = a => { const l = sg.filter(s => (s.art || '') === a); return {req: sumBy(l, s => s.req), pl: l.reduce((t, s) => t + (s.pl || 0), 0), n: l.reduce((t, s) => t + (s.n || 0), 0)}; };
  const sgRow = s => `<tr><td><span class="sw" style="background:${css(ART_COL[s.art || ''])}"></span>${esc(s.sg)}</td><td>${esc(s.art || s.artRaw || '–')}</td><td>${esc(s.cluster || '–')}</td><td class="n">${s.cnw == null ? '<span class="note">–</span>' : fmtS(s.cnw)}</td><td class="n">${s.pl == null ? '<span class="note">–</span>' : nf0.format(s.pl)}</td><td class="n"><b>${s.req == null ? '<span class="sev-E">nicht berechenbar</span>' : fmtS(s.req)}</b></td><td class="n">${s.req == null || !reqTot ? '' : nf1.format(pct(s.req, reqTot)) + ' %'}</td><td class="n">${s.n == null ? '–' : nf0.format(s.n)}</td><td class="n">${s.pl ? nf1.format(r2((s.n || 0) / s.pl)) : '–'}</td></tr>`;
  $('#capSgTable').innerHTML = `<table><tr><th>Studiengang</th><th>Art</th><th>Cluster</th><th class="n">CNW</th><th class="n">Studienplätze</th><th class="n">Erforderliche Kapazität je Jahr</th><th class="n">Anteil</th><th class="n">Eingeschriebene Studierende</th><th class="n">Studierende je Studienplatz</th></tr>` +
    sgs.map(sgRow).join('') +
    arts.map(a => { const x = artSum(a); return `<tr class="tot"><td>Summe ${esc(a || 'Art unbekannt')}</td><td></td><td></td><td></td><td class="n">${nf0.format(x.pl)}</td><td class="n">${fmtS(x.req)}</td><td class="n">${reqTot ? nf1.format(pct(x.req, reqTot)) + ' %' : ''}</td><td class="n">${nf0.format(x.n)}</td><td></td></tr>`; }).join('') +
    `<tr class="tot"><td>Gesamt</td><td></td><td></td><td></td><td class="n">${nf0.format(sg.reduce((t, s) => t + (s.pl || 0), 0))}</td><td class="n">${fmtS(reqTot)}</td><td class="n">100,00 %</td><td class="n">${nf0.format(sg.reduce((t, s) => t + (s.n || 0), 0))}</td><td></td></tr></table>`;
}
