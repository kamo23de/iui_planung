// Planung: Zielwerte mit Ampel
import {$, $$, esc, fmtD, isoD, nf0, nf1, parseIso, r2, semIdx, semLabel, semStart} from '../util.js';
import {S} from '../state.js';
import {clusterOf} from '../parse.js';
import {clusterList, effVz, grpOf, isActive, used, usedBase, withPlan} from '../model.js';
import {renderAll} from '../render.js';
import {openPlanForm} from './form.js';
import {GOALS, PLAN, planTouch} from './scenario.js';

export let G_SEL = null;
export const setGSel = v => { G_SEL = v; };
export function goalEval(cl, D) {
  const stud = S.students.filter(s => s.n > 0 && s.cluster === cl).reduce((t, s) => t + s.n, 0);
  let P = 0, L = 0, W = 0;
  for (const r of used()) { if (clusterOf(r) !== cl || !isActive(r, D)) continue; const g = grpOf(r), v = effVz(r, D); if (g === 'P') P = r2(P + v); else if (g === 'L') L = r2(L + v); else if (g === 'W') W = r2(W + v); }
  const PL = r2(P + L);
  const studRatio = stud && PL ? r2(stud / PL) : null, wimiRatio = P ? r2(W / P) : null;
  const needProf = stud ? Math.max(0, r2(stud / GOALS.stud - PL)) : 0;
  const needWimi = Math.max(0, r2(GOALS.wimi * P - W));
  const tol = GOALS.tol / 100;
  const lvlStud = !stud ? 'na' : studRatio == null ? 'bad' : studRatio <= GOALS.stud ? 'ok' : studRatio <= GOALS.stud * (1 + tol) ? 'warn' : 'bad';
  const lvlWimi = !P ? 'na' : wimiRatio >= GOALS.wimi ? 'ok' : wimiRatio >= GOALS.wimi * (1 - tol) ? 'warn' : 'bad';
  return {stud, P, L, PL, W, studRatio, wimiRatio, needProf, needWimi, lvlStud, lvlWimi};
}
export function renderGoals() {
  GOALS.stud = Math.max(1, +$('#gStud').value || 40); GOALS.wimi = Math.max(0, +$('#gWimi').value || 0); GOALS.tol = Math.max(0, +$('#gTol').value || 0);
  const kpi = $('#gKpi').value, withP = $('#gWithPlan').checked;
  const cur = semIdx(S.today), sems = []; for (let i = cur; i <= cur + 20; i++) sems.push(i);
  const cls = clusterList().filter(c => c !== '(ohne Cluster)' && S.students.some(s => s.cluster === c && s.n > 0));
  const ord = {ok: 0, na: 0, warn: 1, bad: 2}, ic = {ok: '✓', warn: '!', bad: '✕', na: '–'};
  const res = withPlan(withP, () => Object.fromEntries(cls.map(c => [c, sems.map(i => goalEval(c, semStart(i)))])));
  const cell = (c, j) => { const e = res[c][j]; const lv = kpi === 'stud' ? e.lvlStud : kpi === 'wimi' ? e.lvlWimi : (ord[e.lvlStud] >= ord[e.lvlWimi] ? e.lvlStud : e.lvlWimi);
    const txt = kpi === 'wimi' ? (e.wimiRatio == null ? '–' : nf1.format(e.wimiRatio)) : kpi === 'stud' ? (e.studRatio == null ? '–' : nf0.format(e.studRatio)) : '';
    const sel = G_SEL && G_SEL.c === c && G_SEL.j === j;
    return `<td class="c g-${lv}${sel ? ' sel' : ''}" data-c="${esc(c)}" data-j="${j}" title="${semLabel(sems[j])}: ${e.studRatio == null ? '–' : nf1.format(e.studRatio)} Stud./Prof. · ${e.wimiRatio == null ? '–' : nf1.format(e.wimiRatio)} WiMi/Prof."><span class="ic">${ic[lv]}</span>${txt}</td>`; };
  const firstMiss = c => { const j = res[c].findIndex(e => (kpi !== 'wimi' && e.lvlStud === 'bad') || (kpi !== 'stud' && e.lvlWimi === 'bad')); return j < 0 ? '<span class="note">–</span>' : semLabel(sems[j]); };
  $('#gMatrix').innerHTML = `<table class="gm"><tr><th>Cluster</th>${sems.map(i => `<th${i === cur ? ' style="color:var(--text-primary)"' : ''}>${semLabel(i).replace(' ', '<br>')}</th>`).join('')}<th>erstmals verfehlt</th></tr>` +
    cls.map(c => `<tr><td><b>${esc(c)}</b></td>${sems.map((_, j) => cell(c, j)).join('')}<td>${firstMiss(c)}</td></tr>`).join('') + '</table>' +
    (cls.length ? '' : '<p class="note">Keine Cluster mit Studierenden – im Studierendenblatt fehlen Daten.</p>');
  $$('#gMatrix td.c').forEach(td => td.onclick = () => { G_SEL = {c: td.dataset.c, j: +td.dataset.j}; renderGoals(); });
  if (G_SEL && res[G_SEL.c]) {
    const e = res[G_SEL.c][G_SEL.j], sem = sems[G_SEL.j];
    $('#gDetailTitle').textContent = `Fehlbedarf – ${G_SEL.c}, ${semLabel(sem)} (Stand ${fmtD(semStart(sem))})${withP ? ' · mit Planmaßnahmen' : ''}`;
    const profK = S.kreisOrder.find(k => S.catMap[k] === 'Professor/in'), wimiK = S.kreisOrder.find(k => S.catMap[k] === 'WiMi');
    const rnd = v => Math.ceil(v * 2 - 1e-9) / 2;   // auf halbe Stellen aufrunden
    $('#gDetail').innerHTML = `<table><tr><th></th><th class="n">Ist-Wert</th><th class="n">Ziel</th><th>Bewertung</th><th class="n">Fehlbedarf</th><th></th></tr>
      <tr><td>Studierende je Professur (inkl. LfbA)</td><td class="n">${e.studRatio == null ? '–' : nf1.format(e.studRatio)}<div class="note">${nf0.format(e.stud)} Stud. / ${nf1.format(e.PL)} VZÄ</div></td><td class="n">≤ ${nf0.format(GOALS.stud)}</td><td>${ic[e.lvlStud]} ${{ok: 'erreicht', warn: 'knapp', bad: 'verfehlt', na: '–'}[e.lvlStud]}</td>
        <td class="n">${e.needProf > 0 ? `<b>${nf1.format(e.needProf)} VZÄ Professur</b>` : '–'}</td><td>${e.needProf > 0 && profK ? `<button data-take="prof">Als Planmaßnahme übernehmen …</button>` : ''}</td></tr>
      <tr><td>WiMi je Professur (ohne LfbA)</td><td class="n">${e.wimiRatio == null ? '–' : nf1.format(e.wimiRatio)}<div class="note">${nf1.format(e.W)} / ${nf1.format(e.P)} VZÄ</div></td><td class="n">≥ ${nf1.format(GOALS.wimi)}</td><td>${ic[e.lvlWimi]} ${{ok: 'erreicht', warn: 'knapp', bad: 'verfehlt', na: '–'}[e.lvlWimi]}</td>
        <td class="n">${e.needWimi > 0 ? `<b>${nf1.format(e.needWimi)} VZÄ WiMi</b>` : '–'}</td><td>${e.needWimi > 0 && wimiK ? `<button data-take="wimi">Als Planmaßnahme übernehmen …</button>` : ''}</td></tr></table>
      <p class="note">Der Fehlbedarf ist die Menge an VZÄ, die zu Semesterbeginn zusätzlich nötig wäre, um den Zielwert genau zu erreichen. Beim Übernehmen wird er auf halbe Stellen aufgerundet; Sie können Umfang, Beginn und Ende im Formular anpassen.</p>`;
    $$('#gDetail [data-take]').forEach(b => b.onclick = () => { const prof = b.dataset.take === 'prof', need = prof ? e.needProf : e.needWimi;
      const beg = Math.max(semStart(sem), S.today + 1);
      openPlanForm('neu', {pre: {kreis: prof ? profK : wimiK, cluster: G_SEL.c, beginn: beg, ende: prof ? null : beg + 3 * 365 - 1, vz: Math.min(1, rnd(need)), label: prof ? 'Neue Professur' : 'Neue WiMi-Stelle',
        hint: `Fehlbedarf ${nf1.format(need)} VZÄ${rnd(need) > 1 ? ' – für mehr als eine Stelle bitte mehrfach übernehmen' : ''}.`}}); });
  }
}
export function savePlan() {
  const data = {format: 'Personalplanung IuI – Szenario', version: 1, name: PLAN.name, created: new Date().toISOString(), goals: GOALS,
    items: PLAN.items.map(it => ({...it, beginn: it.beginn == null ? null : isoD(it.beginn), ende: it.ende == null ? null : isoD(it.ende),
      ref: it.row != null ? (r => r ? {pnr: r.pnr, name: r.name, vorname: r.vorname} : null)(usedBase().find(x => x.row === it.row)) : null}))};
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
  a.download = (/^szenario/i.test(PLAN.name) ? PLAN.name : 'Szenario_' + PLAN.name).replace(/[^\wäöüÄÖÜß-]+/g, '_') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function loadPlan(file) {
  try {
    const d = JSON.parse(await file.text()); if (!Array.isArray(d.items)) throw new Error('Keine Planmaßnahmen in der Datei.');
    const base = usedBase(); let missing = 0;
    const items = d.items.map(it => { const x = {...it, beginn: it.beginn ? parseIso(it.beginn) : null, ende: it.ende ? parseIso(it.ende) : null};
      if (x.type !== 'neu') { const r = (it.ref && base.find(b => b.pnr === it.ref.pnr && b.name === it.ref.name)) || base.find(b => b.row === it.row); if (!r) { missing++; return null; } x.row = r.row; }
      return x; }).filter(Boolean);
    PLAN.items = items; PLAN.name = d.name || 'Szenario'; PLAN.seq = Math.max(0, ...items.map(i => i.id)) + 1;
    if (d.goals) { Object.assign(GOALS, d.goals); $('#gStud').value = GOALS.stud; $('#gWimi').value = GOALS.wimi; $('#gTol').value = GOALS.tol; }
    planTouch(); renderAll();
    if (missing) alert(`${missing} Planmaßnahme(n) bezogen sich auf Verträge, die in der geladenen Tabelle nicht mehr vorkommen, und wurden übersprungen.`);
  } catch (e) { alert('Das Szenario konnte nicht geladen werden:\n' + e.message); }
}
