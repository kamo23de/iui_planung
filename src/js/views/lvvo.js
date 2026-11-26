// Ansicht Lehrverpflichtung (LVVO Niedersachsen, Fachhochschulen)
import {$, $$, css, esc, fmtD, nf0, nf1, nf2, parseIso, r2, semIdx, semLabel, semStart, sumBy} from '../util.js';
import {S} from '../state.js';
import {lvvoFassung} from '../lvvo.js';
import {catColor, clusterOf} from '../parse.js';
import {clusterList, inContract, used} from '../model.js';
import {lvvo, lvvoStats} from '../teaching.js';
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
  $('#lvMissing').innerHTML = [!hasDep ? '⚠ Im Personalblatt fehlt die Spalte <b>Deputat</b> – die Lehre der WiMi kann nicht berücksichtigt und das Deputat nicht mit der LVVO verglichen werden.' : '',
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

  // ---- je Person ----
  const people = act.map(r => ({r, x: lvvo(r, D)})).filter(o => o.x.gruppe.art !== 'keine' && o.x.anteil > 0);
  const ord = Object.keys(F.gruppen);
  people.sort((a, b) => clusterOf(a.r).localeCompare(clusterOf(b.r), 'de') || ord.indexOf(a.x.key) - ord.indexOf(b.x.key) || a.r.name.localeCompare(b.r.name, 'de'));
  const diffTxt = o => {
    if (o.x.deputat == null || o.x.gruppe.art !== 'regel') return o.x.gruppe.art === 'hoechst' && o.x.deputat > o.x.basis + 0.005 ? '<span class="pill sev-W">über Höchstwert</span>' : '';
    const d = r2(o.x.deputat - o.x.soll);
    return Math.abs(d) < 0.005 ? '<span class="note">✓</span>' : `<span class="pill sev-W">${d > 0 ? '+' : '−'}${nf(Math.abs(d))}</span>`;
  };
  $('#lvPersons').innerHTML = !people.length ? '<p class="note">Keine Personen mit Lehrverpflichtung am Stichtag.</p>' :
    `<table><tr><th>Name</th><th>Cluster</th><th>LVVO-Gruppe</th><th class="n">VZÄ</th><th class="n">Regel / Höchst</th><th>Ermäßigungen</th><th class="n">Soll</th><th class="n">Deputat</th><th>Abweichung</th></tr>` +
    people.map(({r, x}) => `<tr><td><a href="#" data-row="${r.row}">${esc([r.name, r.vorname].filter(Boolean).join(', '))}</a></td><td>${esc(clusterOf(r))}</td>` +
      `<td>${esc(x.gruppe.label)}${x.quelle === 'Spalte' ? ' <span class="pill" title="aus Spalte „LVVO-Gruppe“">Tabelle</span>' : ''}${x.annahme ? ` <span class="pill sev-I" title="${esc(x.annahme)}">angenommen</span>` : ''}</td>` +
      `<td class="n">${nf2.format(x.anteil)}</td><td class="n">${nf(x.basis)}${x.gruppe.art === 'hoechst' ? ' <span class="note">max.</span>' : ''}</td>` +
      `<td>${x.erm.map(e => `${esc((F.gruende.find(g => g.key === e.grund) || {kurz: e.e.grundRaw || 'unbekannt'}).kurz)}: ${nf(e.lvs)}`).join('<br>')}</td>` +
      `<td class="n">${x.soll == null ? '–' : nf(x.soll)}</td><td class="n">${x.deputat == null ? '–' : nf(x.deputat)}</td><td>${diffTxt({x})}</td></tr>`).join('') + '</table>';
  $$('#lvPersons a[data-row]').forEach(a => a.onclick = e => { e.preventDefault(); showPerson(+a.dataset.row); });

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
