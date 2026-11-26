// Lehre: Lehrdeputat, Lehrangebot (Kapazität) und Lehrverpflichtung nach LVVO (Regelwerk in lvvo.js)
import {r2, sumBy} from './util.js';
import {S} from './state.js';
import {lvvoFassung} from './lvvo.js';
import {tarifNum} from './parse.js';
import {effDep, effVz, grpOf} from './model.js';

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

/* ---------- LVVO (Fachhochschule) ---------- */

/** LVVO-Gruppe einer Person: aus der Spalte „LVVO-Gruppe“ oder abgeleitet aus Mitarbeiterkreis, Tarif und Befristung.
 *  Rückgabe {key, quelle: 'Spalte' | 'abgeleitet', annahme: Text oder null}. */
export function lvvoGruppe(r) {
  if (r.lvvoSpalte) return {key: r.lvvoSpalte, quelle: 'Spalte', annahme: null};
  const g = grpOf(r);
  if (g === 'P') return {key: 'prof', quelle: 'abgeleitet', annahme: null};
  if (g === 'L') {
    const tn = tarifNum(r.tarif);
    if (tn == null) return {key: 'lfba20', quelle: 'abgeleitet', annahme: 'Tarifgruppe fehlt – zweites Einstiegsamt (20 LVS) angenommen'};
    return {key: tn >= 13 ? 'lfba20' : 'lfba24', quelle: 'abgeleitet', annahme: null};
  }
  if (g === 'W') return r.fixedTerm
    ? {key: 'wimiQ', quelle: 'abgeleitet', annahme: 'befristet – Beschäftigung auch zur Weiterqualifikation angenommen'}
    : {key: 'wimi', quelle: 'abgeleitet', annahme: null};
  return {key: 'keine', quelle: 'abgeleitet', annahme: null};
}

/** Gültige Ermäßigungen einer Person am Tag D (Blatt „Ermäßigungen“). */
export const ermaessigungenAm = (r, D) => (S.reductions || []).filter(e => e.pnr && e.pnr === r.pnr && !e.lvsErr && !e.pctErr && !e.vonErr && !e.bisErr &&
  (e.lvs != null || e.pct != null) && (e.von == null || e.von <= D) && (e.bis == null || e.bis >= D));

/** Lehrverpflichtung einer Person am Tag D nach LVVO.
 *  nominal = true: voller vertraglicher Umfang (VZÄ), unabhängig von Laufzeit und Ruhen – für den Vergleich mit der Spalte „Deputat“.
 *  Sonst nur der am Tag D wirksame Anteil (wie in allen anderen Auswertungen).
 *  basis: Regel- bzw. Höchstlehrverpflichtung anteilig (LVS); erm: Ermäßigungen in LVS; soll: zu erfüllende LVS
 *  (Regelgruppen: basis − Ermäßigungen, mindestens 0; WiMi: festgelegtes Deputat, da die LVVO nur eine Obergrenze nennt). */
export function lvvo(r, D, {nominal = false} = {}) {
  const F = lvvoFassung(D), gr = lvvoGruppe(r), g = F.gruppen[gr.key];
  const anteil = nominal ? r2(r.vz || 0) : effVz(r, D);
  const basis = r2(g.lvs * anteil);
  const erm = g.art !== 'regel' ? [] : ermaessigungenAm(r, D).map(e => ({e, grund: e.grund, lvs: r2(e.lvs != null ? e.lvs : e.pct / 100 * basis)}));
  const ermSum = sumBy(erm, x => x.lvs);
  const dep = r.deputatErr || r.deputat == null ? null : nominal ? r.deputat : effDep(r, D);
  const soll = g.art === 'regel' ? r2(Math.max(0, basis - ermSum)) : g.art === 'hoechst' ? dep : 0;
  return {...gr, gruppe: g, F, anteil, basis, erm, ermSum, soll, deputat: dep, ueberErmaessigt: g.art === 'regel' && ermSum > basis + 0.001};
}

/** Summen für eine Personenliste am Tag D (nur wirksame Anteile). regel: Regellehrverpflichtungen (Professuren, LfbA);
 *  wimi: festgelegte Lehre der WiMi; p9Quote: Ermäßigungen nach § 9 in Prozent der Regellehrverpflichtungen;
 *  p9Grenze: zulässige Quote (7 %, bis 10 % in dem Maß, in dem WiMi-Lehre nach § 5 Abs. 2 erbracht wird – Auslegung). */
export function lvvoStats(list, D) {
  const F = lvvoFassung(D);
  const o = {regel: 0, erm: 0, ermP9: 0, soll: 0, wimi: 0, wimiHoechst: 0, n: 0, byGruppe: {}, byGrund: {}};
  for (const r of list) {
    const x = lvvo(r, D);
    if (x.gruppe.art === 'keine' || !(x.anteil > 0)) continue;
    o.n++;
    const b = o.byGruppe[x.key] = o.byGruppe[x.key] || {n: 0, basis: 0, erm: 0, soll: 0};
    b.n++; b.basis = r2(b.basis + x.basis); b.erm = r2(b.erm + x.ermSum); b.soll = r2(b.soll + (x.soll || 0));
    if (x.gruppe.art === 'regel') {
      o.regel = r2(o.regel + x.basis); o.erm = r2(o.erm + x.ermSum); o.soll = r2(o.soll + x.soll);
      for (const e of x.erm) {
        const k = e.grund || 'unbekannt'; o.byGrund[k] = r2((o.byGrund[k] || 0) + e.lvs);
        if ((F.gruende.find(g => g.key === e.grund) || {}).p9) o.ermP9 = r2(o.ermP9 + e.lvs);
      }
    } else { o.wimi = r2(o.wimi + (x.soll || 0)); o.wimiHoechst = r2(o.wimiHoechst + x.basis); }
  }
  o.lehre = r2(o.soll + o.wimi);
  o.p9Quote = o.regel ? r2(o.ermP9 / o.regel * 100) : null;
  o.p9Grenze = o.regel ? r2(Math.min(F.p9.quoteErweitert, F.p9.quote + o.wimi / o.regel * 100)) : F.p9.quote;
  return o;
}
