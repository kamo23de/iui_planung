// Planung: Szenario aus Planmaßnahmen über den Ist-Daten
import {$, fmtD, nf1, r2} from '../util.js';
import {S} from '../state.js';
import {usedBase} from '../model.js';

/* Ein Szenario besteht aus Planmaßnahmen über den Ist-Daten; die Excel-Datei bleibt unverändert.
   nach = Nachbesetzung einer ausscheidenden Stelle, neu = neue Stelle, ende = Vertragsende ändern (Verlängerung/Verkürzung/Entfristung). */
export const PLAN = {name: 'Szenario 1', items: [], seq: 1, ver: 0, cache: null, cacheVer: -1};
export const GOALS = {stud: 40, wimi: 0.75, tol: 10};
export const planRow = it => -1000 - it.id;          // eindeutige (negative) Zeilennummer für geplante Stellen
export function planTouch() { PLAN.ver++; renderPlanBadge(); }
export function planRecords() {
  if (PLAN.cache && PLAN.cacheVer === PLAN.ver + ':' + S.issues.length) return PLAN.cache;
  const base = usedBase(), byRow = new Map(base.map(r => [r.row, r]));
  const mods = new Map(PLAN.items.filter(i => i.type === 'ende').map(i => [i.row, i]));
  const out = base.map(r => { const m = mods.get(r.row); if (!m) return r;
    const c = Object.assign(Object.create(Object.getPrototypeOf(r)), r);
    c.ende = m.ende; c.endType = m.ende == null ? null : (r.endType === 'Ruhestand' && m.ende === r.ruhestand ? 'Ruhestand' : 'Vertragsende');
    c.fixedTerm = m.ende != null; c.planMod = m; c.origEnde = r.ende; return c; });
  for (const it of PLAN.items) {
    if (it.type === 'ende') continue;
    const prev = it.type === 'nach' ? byRow.get(it.row) : null;
    if (it.type === 'nach' && !prev) continue;
    const kreis = prev ? prev.kreis : it.kreis;
    out.push({row: planRow(it), rawRow: [], plan: it, planOf: prev || null, problems: [],
      pnr: 'PLAN-' + it.id, name: it.label || (prev ? 'Nachbesetzung' : 'Neue Stelle'), vorname: prev ? `für ${[prev.vorname, prev.name].filter(Boolean).join(' ')}` : '(Plan)',
      kreis, cluster: prev ? prev.cluster : it.cluster, oe: prev ? prev.oe : (it.oe || ''), labor: prev ? prev.labor : (it.labor || ''),
      tarif: prev ? prev.tarif : '', vart: it.ende == null ? 'unbefristet' : 'befristet', befr: it.ende != null, fixedTerm: it.ende != null,
      arb: r2(it.vz * 100), vz: it.vz, deputat: it.deputat ?? (prev && prev.deputat != null && prev.vz ? r2(prev.deputat * it.vz / prev.vz) : null),
      beginn: it.beginn, ende: it.ende, vertragsende: it.ende, ruhestand: null, endType: it.ende == null ? null : 'Vertragsende',
      kw: !!it.kw, kwRaw: it.kw ? 'x' : '', ruht: null, ruheVz: null, vertretungFuer: '', vertretene: null, vertreter: [], excluded: false});
  }
  PLAN.cache = out; PLAN.cacheVer = PLAN.ver + ':' + S.issues.length;
  return out;
}
export const planFind = row => planRecords().find(r => r.row === row);
export const nachFor = r => PLAN.items.filter(i => i.type === 'nach' && i.row === r.row);
export const modFor = r => PLAN.items.find(i => i.type === 'ende' && i.row === r.row);
export function renderPlanBadge() {
  const n = PLAN.items.length;
  $('#planTabBadge').textContent = n ? String(n) : '';
  const on = S.applyPlan && n > 0;
  document.body.classList.toggle('plan-on', on);
  $('#planBadge').classList.toggle('hidden', !on);
  $('#planBadge').textContent = 'PLAN · ' + PLAN.name;
}
export function planDesc(it) {
  const p = it.type !== 'neu' ? usedBase().find(r => r.row === it.row) : null, nm = p ? [p.name, p.vorname].filter(Boolean).join(', ') : '';
  if (it.type === 'nach') return `Nachbesetzung für ${nm}: ${nf1.format(it.vz)} VZÄ ab ${fmtD(it.beginn)}${it.ende ? ' bis ' + fmtD(it.ende) : ', unbefristet'}`;
  if (it.type === 'ende') return `${nm}: Vertragsende ${p ? fmtD(p.ende) : ''} → ${it.ende == null ? 'unbefristet (Entfristung)' : fmtD(it.ende)}`;
  return `${it.label || 'Neue Stelle'} (${it.kreis}, ${it.cluster}${it.oe ? ', ' + it.oe : ''}): ${nf1.format(it.vz)} VZÄ ab ${fmtD(it.beginn)}${it.ende ? ' bis ' + fmtD(it.ende) : ', unbefristet'}`;
}
