// Rechenkern: aktive Verträge, Ruhen, Teilruhen, Vertretungen, Stichtagsbestand
import {nf0, nf1, r2} from './util.js';
import {S} from './state.js';
import {clusterOf, kreisOf} from './parse.js';
import {PLAN, planRecords} from './plan/scenario.js';

/* Datenbasis. Ist das Szenario aktiv (überall eingerechnet oder vorübergehend für die Planungssicht),
   liefert used() die Ist-Verträge mit den Planänderungen plus die geplanten Stellen. */
export const usedBase = () => S.recs.filter(r => !r.excluded);
export const used = () => (!S.forceBase && (S.applyPlan || S.usePlan) && PLAN.items.length) ? planRecords() : usedBase();
export function withPlan(on, fn) { const a = S.usePlan, b = S.forceBase; S.usePlan = on; S.forceBase = !on; try { return fn(); } finally { S.usePlan = a; S.forceBase = b; } }
export const val = r => S.measure === 'vzae' ? (r.vz || 0) : 1;
export const fmtV = v => S.measure === 'vzae' ? nf1.format(r2(v)) : nf0.format(Math.round(v));
export const unit = () => S.measure === 'vzae' ? 'VZÄ' : 'Personen';
/* inContract: Vertrag läuft (Beginn ≤ D ≤ Vertragsende).
   isResting: Vertrag ruht am Tag D (Spalte „ruht bis“; D ≤ ruht bis). Ruhende Verträge zählen weder als Stelle noch mit Deputat.
   isActive: Vertrag läuft und ruht nicht – nur diese Verträge werden in allen Auswertungen gezählt. */
export const inContract = (r, D) => (r.beginn == null || r.beginn <= D) && (r.ende == null || r.ende >= D);
export const inRestPeriod = (r, D) => r.ruht != null && D <= r.ruht && inContract(r, D);   // Ruhezeit (ganz oder teilweise)
/* Anteil der Stelle, der während der Ruhe ruht: Ruheanteil / VZÄ (leer = ganze Stelle) */
export const restShare = r => (r.ruheVz == null || !(r.vz > 0)) ? 1 : Math.max(0, Math.min(1, r.ruheVz / r.vz));
export const isResting = (r, D) => inRestPeriod(r, D) && restShare(r) >= 0.9999;          // ruht vollständig
export const isPartlyResting = (r, D) => inRestPeriod(r, D) && restShare(r) < 0.9999;     // ruht teilweise
export const isActive = (r, D) => inContract(r, D) && !isResting(r, D);
/* Wirksamer (nicht ruhender) Anteil am Tag D: 0 außerhalb des Vertrags, 1 − Ruheanteil während der Ruhe, sonst 1 */
export const activeShare = (r, D) => !inContract(r, D) ? 0 : inRestPeriod(r, D) ? 1 - restShare(r) : 1;
export const effVz = (r, D) => r2((r.vz || 0) * activeShare(r, D));
export const effDep = (r, D) => r.deputat == null ? null : r2(r.deputat * activeShare(r, D));
export const restVz = (r, D) => inRestPeriod(r, D) ? r2((r.vz || 0) * restShare(r)) : 0;    // ruhende VZÄ am Tag D
/* Zählwert am Tag D: Köpfe = 1 bei aktivem Vertrag, VZÄ = nur nicht ruhender Anteil */
export const isVertretung = r => !!r.vertretungFuer;   // Vertretungen werden nach Vertragsende nicht nachbesetzt
export const valAt = (r, D) => S.measure === 'vzae' ? effVz(r, D) : (isActive(r, D) ? 1 : 0);
export const returnsBetween = (r, T, D) => inRestPeriod(r, T) && !inRestPeriod(r, D) && inContract(r, D);   // Rückkehr nach Ruhen zwischen T und D
/* 'b' = besetzt, 'v' = offene (nicht-kw) Stelle nach Vertragsende, nur im Szenario „weiterführen“ */
export function status(r, D) {
  if (isActive(r, D)) return 'b';
  if (S.refill && D > S.today && !r.kw && !isVertretung(r) && r.ende != null && r.ende >= S.today && r.ende < D && !(r.beginn != null && r.beginn > r.ende)) return 'v';
  return null;
}
export function snapshot(D, clusterFilter) {
  const res = {total: 0, b: 0, v: 0, byKreis: {}, byCluster: {}, cell: {}};
  for (const r of used()) {
    if (clusterFilter && clusterOf(r) !== clusterFilter) continue;
    const st = status(r, D); if (!st) continue;
    // besetzt: wirksamer Anteil am Tag D; offene Stelle (Szenario): voller Stellenumfang des ausgelaufenen Vertrags
    const w = st === 'v' ? (S.measure === 'vzae' ? (r.vz || 0) : 1) : valAt(r, D), k = kreisOf(r), c = clusterOf(r);
    res.total = r2(res.total + w); res[st] = r2(res[st] + w);
    const o1 = res.byKreis[k] = res.byKreis[k] || {b: 0, v: 0}; o1[st] = r2(o1[st] + w);
    const o2 = res.byCluster[c] = res.byCluster[c] || {b: 0, v: 0}; o2[st] = r2(o2[st] + w);
    const key = c + '\u0000' + k, o3 = res.cell[key] = res.cell[key] || {b: 0, v: 0}; o3[st] = r2(o3[st] + w);
  }
  return res;
}
export const clusterList = () => [...new Set(used().map(clusterOf))].sort((a, b) => (a.startsWith('(') - b.startsWith('(')) || a.localeCompare(b, 'de'));
export const tot = o => o ? r2(o.b + o.v) : 0;
/* Gruppenbildung: P = Professor/innen, L = LfbA, W = WiMi, O = sonstige Mitarbeitende */
export const grpOf = r => { const c = S.catMap[kreisOf(r)]; return c === 'Professor/in' ? 'P' : c === 'LfbA' ? 'L' : c === 'WiMi' ? 'W' : 'O'; };
