// Bedienung: Laden, Reiterwechsel, Ereignisse, Start
import {$, $$, isoD, parseIso, toDay} from './util.js';
import {S} from './state.js';
import {readWorkbook} from './parse.js';
import {chartDefaults, charts} from './charts.js';
import {renderAll} from './render.js';
import {renderCheck} from './views/check.js';
import {renderSemDetail, renderSemester} from './views/semester.js';
import {fcMode, renderForecast, setFcMode} from './views/forecast.js';
import {renderRatio} from './views/ratio.js';
import {detailCsv, DT, isNarrow, renderDetail, renderDetailList} from './views/detail.js';
import {renderCapacity} from './views/capacity.js';
import {closePerson} from './views/person.js';
import {PLAN, planTouch, renderPlanBadge} from './plan/scenario.js';
import {closePlanForm, openPlanForm, submitPlanForm} from './plan/form.js';
import {renderPlan, setPlSub} from './plan/view.js';
import {renderTimeline, tlMenu} from './plan/timeline.js';
import {loadPlan, renderGoals, savePlan, setGSel} from './plan/goals.js';
import {GS, gsClose, gsKey, gsRender, showInDetail} from './search.js';

export function showTab(t) {
  S.tab = t;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $$('section.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + t));
  renderAll();
}
/* Demodaten: fiktive Testtabelle, beim Bauen als Base64 eingebettet (scripts/build.js) */
const DEMO_XLSX_B64 = '/*DEMO_XLSX_B64*/';
const hasDemo = () => !DEMO_XLSX_B64.startsWith('/*');
async function loadFile(f) {
  try { loadBuffer(await f.arrayBuffer(), f.name, false); }
  catch (e) { console.error(e); alert('Die Datei konnte nicht gelesen werden:\n' + e.message); }
}
function loadDemo() {
  try {
    const bin = atob(DEMO_XLSX_B64), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    loadBuffer(buf.buffer, 'Demodaten (fiktiv)', true);
  } catch (e) { console.error(e); alert('Die Demodaten konnten nicht geladen werden:\n' + e.message); }
}
/* Alle geladenen Daten aus dem Speicher entfernen und zur Startseite zurückkehren */
function unloadData() {
  Object.keys(charts).forEach(id => { charts[id].destroy(); delete charts[id]; });
  Object.assign(S, {raw: null, recs: [], students: [], issues: [], colMap: {}, missingCols: [], catMap: {}, kreisOrder: [], kreisCounts: {}, checkFilter: null, isDemo: false, applyPlan: false});
  Object.assign(PLAN, {name: 'Szenario 1', items: [], seq: 1, cache: null}); setGSel(null); $('#plApply').checked = false; planTouch();
  ['#issueTable', '#issueSummary', '#dtLists', '#fcOut', '#fcIn', '#semDetailTable', '#ovTable', '#semTable', '#raTable', '#wmTable', '#stTable', '#dtRatioTable', '#dtLabTable', '#fcDelta', '#multiples'].forEach(x => { const el = $(x); if (el) el.innerHTML = ''; });
  $('#dtSearch').value = '';
  $('#gsInput').value = ''; gsClose();
  $('#file').value = '';
  $('#app').classList.add('hidden'); $('#tabs').classList.add('hidden'); $('#start').classList.remove('hidden');
  $$('[data-loaded]').forEach(e => e.classList.add('hidden'));
  $('#fileInfo').textContent = '';
  document.body.classList.remove('is-demo'); document.title = 'Personalplanung Fakultät IuI';
}
function loadBuffer(buf, name, isDemo) {
    PLAN.items = []; PLAN.cache = null; setGSel(null); planTouch();
    S.catMap = {};
    readWorkbook(buf, name);
    S.isDemo = isDemo;
    document.body.classList.toggle('is-demo', isDemo);
    document.title = (isDemo ? 'DEMO – ' : '') + 'Personalplanung Fakultät IuI';
    $('#demoBadge').classList.toggle('hidden', !isDemo); $('#demoUnload').classList.toggle('hidden', !isDemo);
    $('#reload').textContent = isDemo ? 'Echte Tabelle laden' : 'Andere Datei laden';
    $('#fileInfo').textContent = `${name} · ${S.recs.length} Personaldatensätze · ${S.students.length} Studiengänge`;
    $('#start').classList.add('hidden'); $('#app').classList.remove('hidden'); $('#tabs').classList.remove('hidden');
    $$('[data-loaded]').forEach(e => e.classList.remove('hidden'));
    document.documentElement.style.setProperty('--hh', $('#hdr').offsetHeight + 'px');
    showTab('check');
}
function init() {
  chartDefaults();
  const n = new Date(); S.today = toDay(n.getFullYear(), n.getMonth() + 1, n.getDate());
  $('#today').value = isoD(S.today);
  $('#file').onchange = e => e.target.files[0] && loadFile(e.target.files[0]);
  const dr = $('#drop');
  dr.ondragover = e => { e.preventDefault(); dr.classList.add('over'); };
  dr.ondragleave = () => dr.classList.remove('over');
  dr.ondrop = e => { e.preventDefault(); dr.classList.remove('over'); e.dataTransfer.files[0] && loadFile(e.dataTransfer.files[0]); };
  $('#reload').onclick = unloadData;
  $('#demoUnload').onclick = unloadData;
  $('#demoBtn').onclick = loadDemo;
  if (!hasDemo()) $('#demoBtn').parentElement.classList.add('hidden');
  $$('#tabs button').forEach(b => b.onclick = () => showTab(b.dataset.t));
  $('#today').onchange = () => { const d = parseIso($('#today').value); if (d != null) { S.today = d; renderAll(); } };
  $$('#measureSeg button').forEach(b => b.onclick = () => { S.measure = b.dataset.v; $$('#measureSeg button').forEach(x => x.classList.toggle('on', x === b)); renderAll(); });
  $('#refill').onchange = e => { S.refill = e.target.checked; renderAll(); };
  $('#exclDup').onchange = e => { S.excludeDup = e.target.checked; renderAll(); };
  $$('#sevSeg button').forEach(b => b.onclick = () => { S.sevFilter = b.dataset.v; $$('#sevSeg button').forEach(x => x.classList.toggle('on', x === b)); renderCheck(); });
  $('#clearIssueFilter').onclick = () => { S.checkFilter = null; renderCheck(); };
  $('#csvIssues').onclick = () => {
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [['Schwere', 'Prüfung', 'Blatt', 'Zeile', 'Personalnummer', 'Person/Studiengang', 'Feld', 'Befund'].map(q).join(';')]
      .concat(S.issues.map(i => [{E: 'Fehler', W: 'Warnung', I: 'Hinweis'}[i.sev], i.check, i.row ? i.sheet : '', i.row, i.pnr, i.person, i.field, i.msg].map(q).join(';')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], {type: 'text/csv;charset=utf-8'}));
    a.download = 'Pruefbericht_Personaldaten.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  ['#semCluster', '#semPast', '#semAhead'].forEach(s => $(s).onchange = renderSemester);
  $('#semDetail').onchange = renderSemDetail;
  $('#semCum').onchange = renderSemDetail;
  $$('#fcMode button').forEach(b => b.onclick = () => { setFcMode(b.dataset.v); $$('#fcMode button').forEach(x => x.classList.toggle('on', x === b)); $('#fcSem').classList.toggle('hidden', fcMode !== 'sem'); $('#fcDate').classList.toggle('hidden', fcMode !== 'date'); renderForecast(); });
  ['#fcSem', '#fcDate', '#fcCluster'].forEach(s => $(s).onchange = renderForecast);
  $('#raWhen').onchange = renderRatio;
  $('#dtCluster').onchange = renderDetail;
  $('#dtLab').onchange = renderDetail;
  $('#dtOE').onchange = renderDetail;
  ['#capWhen', '#capCluster', '#capIntakes'].forEach(x => $(x).onchange = renderCapacity);
  $$('#dtGroup button').forEach(b => b.onclick = () => { DT.group = b.dataset.v; $$('#dtGroup button').forEach(x => x.classList.toggle('on', x === b)); renderDetailList(); });
  ['#dtAll', '#dtSoon'].forEach(x => $(x).onchange = renderDetailList);
  $('#dtSearch').oninput = renderDetailList;
  $('#dtCsv').onclick = detailCsv;
  $('#dtExpand').onclick = () => { DT.expanded = !DT.expanded; renderDetailList(); };
  $('#pdClose').onclick = closePerson;
  $$('#plSub button').forEach(b => b.onclick = () => { setPlSub(b.dataset.v); $$('#plSub button').forEach(x => x.classList.toggle('on', x === b)); renderPlan(); });
  ['#tlCluster', '#tlGroup', '#tlKreis', '#tlRange', '#tlNeed'].forEach(x => $(x).onchange = renderTimeline);
  ['#gStud', '#gWimi', '#gTol', '#gKpi', '#gWithPlan'].forEach(x => $(x).onchange = renderGoals);
  $('#plName').onchange = () => { PLAN.name = $('#plName').value.trim() || 'Szenario'; renderPlanBadge(); };
  $('#plNew').onclick = () => openPlanForm('neu', {});
  $('#plSave').onclick = savePlan;
  $('#plLoad').onchange = e => { if (e.target.files[0]) loadPlan(e.target.files[0]); e.target.value = ''; };
  $('#plClear').onclick = () => { if (!PLAN.items.length || confirm('Alle Planmaßnahmen dieses Szenarios löschen?')) { PLAN.items = []; planTouch(); renderAll(); } };
  $('#plApply').onchange = e => { S.applyPlan = e.target.checked; planTouch(); renderAll(); };
  $('#plFormClose').onclick = closePlanForm; $('#plFormCancel').onclick = closePlanForm; $('#plFormOk').onclick = submitPlanForm;
  $('#plOverlay').onclick = e => { if (e.target.id === 'plOverlay') closePlanForm(); };
  document.addEventListener('click', e => { if (!e.target.closest('#tlMenu')) $('#tlMenu').classList.add('hidden'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#tlMenu').classList.add('hidden'); if (!$('#plOverlay').classList.contains('hidden')) closePlanForm(); } });
  $('#pdToList').onclick = () => showInDetail(+$('#pdOverlay').dataset.row);
  $('#gsInput').oninput = () => { GS.sel = -1; gsRender(); };
  $('#gsInput').onfocus = () => { if ($('#gsInput').value.trim()) gsRender(); };
  $('#gsInput').onblur = () => setTimeout(() => { if (document.activeElement !== $('#gsInput')) gsClose(); }, 120);
  $('#gsInput').onkeydown = gsKey;
  // Tastenkürzel: „/“ oder Strg/⌘+K setzt den Cursor in die Suche
  document.addEventListener('keydown', e => {
    if (!S.raw || !$('#pdOverlay').classList.contains('hidden')) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); $('#gsInput').focus(); $('#gsInput').select(); }
  });
  $('#pdOverlay').onclick = e => { if (e.target.id === 'pdOverlay') closePerson(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#pdOverlay').classList.contains('hidden')) closePerson(); });
  $('#dtOpen').onclick = () => { const d = $$('#dtLists details'); const open = !d.every(x => x.open); d.forEach(x => x.open = open); };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { chartDefaults(); if (S.raw) renderAll(); });
  let rsT;
  window.addEventListener('resize', () => {
    document.documentElement.style.setProperty('--hh', $('#hdr').offsetHeight + 'px');
    // Spaltenauswahl der Personalliste anpassen, wenn sich die Breite über die Schwelle ändert (z. B. iPad drehen)
    clearTimeout(rsT); rsT = setTimeout(() => { if (S.raw && S.tab === 'detail' && DT.lastNarrow !== isNarrow()) renderDetailList(); }, 150);
  });
}
init();
