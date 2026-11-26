// Lehre: Lehrdeputat, Lehrangebot (Kapazität) und Lehrverpflichtung nach LVVO (Regelwerk in lvvo.js)
import {r2, semEnd, semStart, sumBy} from './util.js';
import {S} from './state.js';
import {lvvoFassung} from './lvvo.js';
import {tarifNum} from './parse.js';
import {effDep, effVz, grpOf, inContract} from './model.js';

/** Beitrag einer Person zum Lehrangebot am Stichtag D (LVS je Semester); null = keine Angabe.
 *  quelle 'lvvo' (Standard): Professuren und LfbA mit dem Soll nach LVVO (Regellehrverpflichtung anteilig − Ermäßigungen),
 *  WiMi und Personen ohne Lehrverpflichtung mit dem festgelegten Deputat (die LVVO nennt für sie kein Soll).
 *  quelle 'deputat': wirksames Deputat aus der Tabelle (bisherige Rechnung).
 *  nominal = true: voller vertraglicher Umfang ohne Laufzeit und Ruhen (für „nicht gezählt, da ruhend“). */
export function capBeitrag(r, D, quelle = 'lvvo', nominal = false) {
  const dep = r.deputatErr || r.deputat == null ? null : nominal ? r.deputat : effDep(r, D);
  if (quelle !== 'lvvo') return dep;
  const x = lvvo(r, D, {nominal});
  return x.gruppe.art === 'regel' ? x.soll : dep;
}

/* Lehrangebot einer Personenliste am Stichtag D (LVS je Semester, nur nicht ruhende Anteile) je Personalgruppe,
   Quelle wie bei capBeitrag; year = 2 × LVS je Semester (Jahreslehrangebot); erm = abgezogene Ermäßigungen (nur LVVO).
   teach = Personen mit Beitrag > 0, support = Deputat 0 ohne Regellehrverpflichtung (nur unterstützend), none = ohne Angabe. */
export function capStats(list, D, quelle = 'lvvo') {
  const o = {sws: 0, P: 0, L: 0, W: 0, O: 0, teach: 0, support: 0, none: 0, erm: 0, quelle};
  for (const r of list) {
    const b = capBeitrag(r, D, quelle);
    if (quelle === 'lvvo') { const x = lvvo(r, D); if (x.gruppe.art === 'regel') o.erm = r2(o.erm + x.ermSum); }
    if (b > 0) { const g = grpOf(r); o[g] = r2(o[g] + b); o.sws = r2(o.sws + b); o.teach++; }
    else if (r.deputat === 0 && !r.deputatErr && !(quelle === 'lvvo' && lvvo(r, D).gruppe.art === 'regel')) o.support++;
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

/* ---------- Gehaltene Lehre und Zeitkonto (§ 11, § 15) ---------- */

/** Lehre einer Person (Blatt „Lehre“), nur gültige Zeilen. */
export const lehreVon = r => (S.teaching || []).filter(t => t.ok && t.pnr === r.pnr);

/** Gehaltene LVS einer Person in Semester s: Summe der angerechneten LVS, Betreuung von Abschlussarbeiten
 *  höchstens betreuungMax (§ 15); Übertrag-Zeilen zählen nicht als Lehre, sondern zum Kontostand. */
export function lehreIst(r, s, rows = lehreVon(r)) {
  const F = lvvoFassung(semStart(s)), art = k => F.lehrarten.find(a => a.key === k) || {};
  const im = rows.filter(t => t.sem === s);
  const betreuungRoh = sumBy(im.filter(t => art(t.art).betreuung), t => t.lvs);
  const betreuung = Math.min(betreuungRoh, F.betreuungMax.lvs);
  const lehre = sumBy(im.filter(t => !art(t.art).betreuung && !art(t.art).uebertrag), t => t.lvs);
  const uebertrag = sumBy(im.filter(t => art(t.art).uebertrag), t => t.lvs);
  return {ist: r2(lehre + betreuung), lehre, betreuung, betreuungRoh, betreuungGekappt: betreuungRoh > betreuung + 0.005, uebertrag, zeilen: im};
}

/** Zeitkonto einer Person über alle Semester mit Einträgen im Blatt „Lehre“ (lückenlos vom ersten bis zum letzten).
 *  Je Semester: Soll (LVVO am Semesterbeginn), Ist, Saldo, Kontostand am Anfang und Ende, verfallene LVS.
 *  Nur für Gruppen mit Regellehrverpflichtung wird ein Konto geführt (§ 11 Abs. 3): Guthaben über kappung × Regel
 *  verfällt am Semesterende; ein Fehlbetrag über fehlbetrag × Regel und Lehre unter der Hälfte des Solls werden markiert.
 *  Bei WiMi wird nur Ist und Soll (Deputat) je Semester verglichen. */
export function zeitkonto(r) {
  const rows = lehreVon(r);
  if (!rows.length) return null;
  const sems = rows.map(t => t.sem), von = Math.min(...sems), bis = Math.max(...sems);
  const out = [];
  let konto = 0;
  for (let s = von; s <= bis; s++) {
    const D = semStart(s), F = lvvoFassung(D), x = lvvo(r, D), L = lehreIst(r, s, rows);
    const regel = x.gruppe.art === 'regel', soll = regel ? x.soll : (x.soll ?? 0);
    const e = {sem: s, gruppe: x.gruppe, regelLvs: x.basis, soll, ist: L.ist, lehre: L.lehre, betreuung: L.betreuung, betreuungGekappt: L.betreuungGekappt,
      saldo: r2(L.ist - soll), zeilen: L.zeilen, ohneEintrag: !L.zeilen.length, imVertrag: inContract(r, D) || inContract(r, semEnd(s))};
    if (regel) {
      e.anfang = r2(konto + L.uebertrag); e.uebertrag = L.uebertrag;
      let ende = r2(e.anfang + e.saldo), verfallen = 0;
      const kappung = r2(F.erfuellung.kappung * x.basis), fehl = r2(F.erfuellung.fehlbetrag * x.basis);
      if (ende > kappung) { verfallen = r2(ende - kappung); ende = kappung; }
      Object.assign(e, {ende, verfallen, kappung, fehlbetragZuHoch: ende < -fehl - 0.005, fehlGrenze: fehl,
        unterHaelfte: soll > 0 && L.ist < F.erfuellung.mindestanteil * soll - 0.005});
      konto = ende;
    }
    out.push(e);
  }
  return {von, bis, semester: out, konto: out[out.length - 1].ende ?? null};
}

/** Summen für Semester s über eine Personenliste: nur Personen mit Einträgen im Blatt „Lehre“. */
export function lehreStats(list, s) {
  const o = {n: 0, soll: 0, ist: 0, saldo: 0, guthaben: 0, fehlbetrag: 0, verfallen: 0, personen: []};
  for (const r of list) {
    const k = zeitkonto(r); if (!k) continue;
    const e = k.semester.find(x => x.sem === s); if (!e) continue;
    o.n++; o.soll = r2(o.soll + e.soll); o.ist = r2(o.ist + e.ist); o.saldo = r2(o.saldo + e.saldo);
    if (e.ende != null) { if (e.ende > 0) o.guthaben = r2(o.guthaben + e.ende); else o.fehlbetrag = r2(o.fehlbetrag + e.ende); o.verfallen = r2(o.verfallen + e.verfallen); }
    o.personen.push({r, e, k});
  }
  return o;
}
