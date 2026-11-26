// Lehre: Lehrdeputat und Lehrangebot (Grundlage der Kapazitätsrechnung, künftig der LVVO)
import {r2} from './util.js';
import {effDep, grpOf} from './model.js';

/* Lehrangebot einer Personenliste am Stichtag D: Summe des wirksamen Deputats (SWS je Semester,
   nur nicht ruhende Anteile) je Personalgruppe; year = 2 × SWS (Jahreslehrangebot).
   teach = Personen mit Deputat > 0, support = Deputat 0 (nur unterstützend), none = ohne Angabe. */
export function capStats(list, D) {
  const o = {sws: 0, P: 0, L: 0, W: 0, O: 0, teach: 0, support: 0, none: 0};
  for (const r of list) {
    const dep = r.deputatErr ? null : effDep(r, D);   // nur der nicht ruhende Anteil
    if (dep > 0) { const g = grpOf(r); o[g] = r2(o[g] + dep); o.sws = r2(o.sws + dep); o.teach++; }
    else if (r.deputat === 0 && !r.deputatErr) o.support++;
    else o.none++;
  }
  o.year = r2(2 * o.sws);
  return o;
}
