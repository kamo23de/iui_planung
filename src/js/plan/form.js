// Planung: Formular für Planmaßnahmen
import {$, esc, fmtD, isoD, parseIso, r2, semIdx, semStart} from '../util.js';
import {S} from '../state.js';
import {clusterOf, kreisOf} from '../parse.js';
import {clusterList, usedBase} from '../model.js';
import {renderAll} from '../render.js';
import {PLAN, planTouch} from './scenario.js';

export let PF = null;
export function openPlanForm(mode, ctx) {
  PF = {mode, ctx};
  const f = (lbl, html, hint) => `<label>${lbl}</label><div>${html}</div>${hint ? `<div class="hint">${hint}</div>` : ''}`;
  const dateIn = (id, d) => `<input type="date" id="${id}" value="${d == null ? '' : isoD(d)}">`;
  let title = '', body = '';
  if (mode === 'nach') {
    const r = ctx.prev, it = ctx.item;
    title = it ? 'Nachbesetzung bearbeiten' : 'Stelle nachbesetzen';
    body = `<div class="pf">${f('Bisherige Stelle', `<b>${esc([r.vorname, r.name].filter(Boolean).join(' '))}</b> · ${esc(kreisOf(r))} · ${esc(clusterOf(r))}${r.oe ? ' · ' + esc(r.oe) : ''}<br><span class="note">${r.endType === 'Ruhestand' ? 'Ruhestand' : 'Vertragsende'} ${fmtD(r.ende)}</span>`)}
      ${f('Beginn der Nachfolge', dateIn('pfBeginn', it ? it.beginn : r.ende + 1), 'Lücke oder Überlappung ergibt sich aus dem Datum.')}
      ${f('Ende', dateIn('pfEnde', it ? it.ende : null), 'leer = unbefristet')}
      ${f('Umfang (VZÄ)', `<input type="number" id="pfVz" min="0.05" max="1" step="0.05" value="${it ? it.vz : (r.vz || 1)}">`)}
      ${f('Bezeichnung', `<input type="text" id="pfLabel" value="${esc(it ? it.label || '' : 'Nachbesetzung')}">`)}</div>`;
  } else if (mode === 'neu') {
    const it = ctx.item || {}, pre = ctx.pre || {};
    title = it.id ? 'Neue Stelle bearbeiten' : 'Neue Stelle planen';
    const kreisOpts = S.kreisOrder.filter(k => k !== '(ohne Angabe)').map(k => `<option${(it.kreis || pre.kreis) === k ? ' selected' : ''}>${esc(k)}</option>`).join('');
    const clOpts = clusterList().filter(c => c !== '(ohne Cluster)').map(c => `<option${(it.cluster || pre.cluster || $('#tlCluster').value) === c ? ' selected' : ''}>${esc(c)}</option>`).join('');
    const oes = [...new Set(usedBase().map(r => r.oe).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    const labs = [...new Set(usedBase().map(r => r.labor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    body = `<div class="pf">${f('Bezeichnung', `<input type="text" id="pfLabel" value="${esc(it.label || pre.label || 'Neue Stelle')}">`)}
      ${f('Mitarbeiterkreis', `<select id="pfKreis">${kreisOpts}</select>`)}
      ${f('Cluster', `<select id="pfCluster">${clOpts}</select>`)}
      ${f('Organisationseinheit', `<input type="text" id="pfOe" list="pfOeList" value="${esc(it.oe || pre.oe || '')}"><datalist id="pfOeList">${oes.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`)}
      ${f('Laborbereich', `<input type="text" id="pfLab" list="pfLabList" value="${esc(it.labor || '')}"><datalist id="pfLabList">${labs.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`)}
      ${f('Beginn', dateIn('pfBeginn', it.beginn ?? pre.beginn ?? semStart(semIdx(S.today) + 1)))}
      ${f('Ende', dateIn('pfEnde', it.ende ?? pre.ende ?? null), 'leer = unbefristet')}
      ${f('Umfang (VZÄ)', `<input type="number" id="pfVz" min="0.05" max="1" step="0.05" value="${it.vz ?? pre.vz ?? 1}">`, pre.hint || '')}
      ${'deputat' in S.colMap ? f('Deputat (LVS)', `<input type="number" id="pfDep" min="0" step="0.5" value="${it.deputat ?? ''}"> <span class="note">für WiMi und sonstiges Personal; Professuren und LfbA zählen mit der Regellehrverpflichtung nach LVVO</span>`) : ''}
      ${f('kw-Vermerk', `<label class="ctl"><input type="checkbox" id="pfKw"${it.kw ? ' checked' : ''}> Stelle entfällt nach Vertragsende</label>`)}</div>`;
  } else if (mode === 'ende') {
    const r = ctx.prev, it = ctx.item;
    title = 'Vertragsende ändern';
    body = `<div class="pf">${f('Vertrag', `<b>${esc([r.vorname, r.name].filter(Boolean).join(' '))}</b> · ${esc(kreisOf(r))} · ${esc(clusterOf(r))}`)}
      ${f('Bisheriges Ende', r.ende == null ? 'unbefristet' : `${fmtD(r.ende)} <span class="note">(${r.endType})</span>`)}
      ${f('Neues Ende', dateIn('pfEnde', it ? it.ende : r.ende), 'Später = Verlängerung, früher = Verkürzung')}
      ${f('', `<label class="ctl"><input type="checkbox" id="pfUnbef"${it && it.ende == null ? ' checked' : ''}> unbefristet (Entfristung)</label>`)}</div>`;
  }
  $('#plFormTitle').textContent = title; $('#plFormBody').innerHTML = body;
  $('#plOverlay').classList.remove('hidden');
}
export function closePlanForm() { $('#plOverlay').classList.add('hidden'); $('#plFormBody').innerHTML = ''; PF = null; }
export function submitPlanForm() {
  if (!PF) return;
  const d = id => parseIso(($('#' + id) || {}).value || ''), num = id => { const v = parseFloat((($('#' + id) || {}).value || '').replace(',', '.')); return isFinite(v) ? v : null; };
  const {mode, ctx} = PF;
  let it = ctx.item ? ctx.item : {id: PLAN.seq++, type: mode};
  if (mode === 'nach') {
    const b = d('pfBeginn'); if (b == null) return alert('Bitte einen Beginn angeben.');
    Object.assign(it, {row: ctx.prev.row, beginn: b, ende: d('pfEnde'), vz: r2(num('pfVz') || ctx.prev.vz || 1), label: $('#pfLabel').value.trim()});
    if (it.ende != null && it.ende < it.beginn) return alert('Das Ende liegt vor dem Beginn.');
  } else if (mode === 'neu') {
    const b = d('pfBeginn'); if (b == null) return alert('Bitte einen Beginn angeben.');
    Object.assign(it, {label: $('#pfLabel').value.trim() || 'Neue Stelle', kreis: $('#pfKreis').value, cluster: $('#pfCluster').value, oe: $('#pfOe').value.trim(), labor: $('#pfLab').value.trim(),
      beginn: b, ende: d('pfEnde'), vz: r2(num('pfVz') || 1), deputat: $('#pfDep') ? num('pfDep') : null, kw: $('#pfKw').checked});
    if (it.ende != null && it.ende < it.beginn) return alert('Das Ende liegt vor dem Beginn.');
  } else if (mode === 'ende') {
    const unbef = $('#pfUnbef').checked, e = d('pfEnde');
    if (!unbef && e == null) return alert('Bitte ein Datum angeben oder „unbefristet“ wählen.');
    Object.assign(it, {row: ctx.prev.row, ende: unbef ? null : e});
    PLAN.items = PLAN.items.filter(x => !(x.type === 'ende' && x.row === it.row && x !== it));
  }
  if (!PLAN.items.includes(it)) PLAN.items.push(it);
  closePlanForm(); planTouch(); renderAll();
}
export function deletePlanItem(id) { PLAN.items = PLAN.items.filter(i => i.id !== id); planTouch(); renderAll(); }
export function editPlanItem(id) {
  const it = PLAN.items.find(i => i.id === id); if (!it) return;
  const prev = it.row != null ? usedBase().find(r => r.row === it.row) : null;
  openPlanForm(it.type, {item: it, prev});
}
