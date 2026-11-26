// Datenprüfung (Plausibilitätsregeln)
import {fmtD, fromDay, nf2, r2} from './util.js';
import {S} from './state.js';
import {clusterOf, kreisOf, OPTIONAL_COLS, str, STUD_FIELDS} from './parse.js';
import {effVz, inContract, inRestPeriod, restShare, restVz} from './model.js';

export function lev(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const d = Array.from({length: a.length + 1}, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export const tarifNum = t => { const m = /^[EW]?(\d+)/.exec(t.replace(/^TV-?L?/, '')); return m ? +m[1] : null; };

export function runChecks() {
  const I = [], T = S.today;
  const add = (sev, check, r, field, msg) => I.push({sev, check, row: r ? r.row : null, pnr: r ? r.pnr : '', person: r ? [r.name, r.vorname].filter(Boolean).join(', ') : '', field, msg, sheet: r && r.sg != null ? 'Studierende' : 'Personal'});

  S.missingCols.filter(c => !OPTIONAL_COLS.includes(c)).forEach(c => add(c === 'Laborbereich' || c === 'Organisationseinheit' || c === 'Deputat' ? 'W' : 'E', 'Spalte fehlt', null, c, `Spalte „${c}“ wurde im Personalblatt nicht gefunden.` + (c === 'Deputat' ? ' Die Ansicht Kapazität kann kein Lehrangebot berechnen.' : '')));
  if (S.raw.stud) STUD_FIELDS.filter(f => !(f[0] in S.raw.stud.map)).forEach(f => add(['cnw', 'pl'].includes(f[0]) ? 'W' : f[0] === 'art' ? 'I' : 'E', 'Spalte fehlt', null, f[1], `Spalte „${f[1]}“ wurde im Studierendenblatt nicht gefunden.` + (['cnw', 'pl'].includes(f[0]) ? ' Die erforderliche Kapazität ist nicht berechenbar.' : '')));
  if (!S.raw.stud) add('E', 'Studierendenblatt fehlt', null, '', 'Kein Tabellenblatt mit Studiengang/Cluster/Studierende gefunden – Betreuungsverhältnis nicht berechenbar.');

  // exakte Duplikate
  const seen = new Map();
  S.recs.forEach(r => {
    r.excluded = false;
    const key = JSON.stringify(r.rawRow);
    if (seen.has(key)) { r.dupOf = seen.get(key); r.excluded = S.excludeDup; add('E', 'Doppelte Zeile', r, '(ganze Zeile)', `Identisch mit Zeile ${seen.get(key)}.` + (S.excludeDup ? ' Wird nur einmal gezählt.' : ' Wird doppelt gezählt!')); }
    else seen.set(key, r.row);
  });
  const recs = S.recs.filter(r => !r.excluded);

  for (const r of recs) {
    const cat = S.catMap[kreisOf(r)];
    if (!r.pnr) add('E', 'Pflichtfeld leer', r, 'Personalnummer', 'Personalnummer fehlt.');
    if (!r.name) add('E', 'Pflichtfeld leer', r, 'Name', 'Name fehlt.');
    if (!r.vorname && 'vorname' in S.colMap) add('W', 'Pflichtfeld leer', r, 'Vorname', 'Vorname fehlt.');
    if (!r.kreis) add('E', 'Pflichtfeld leer', r, 'Mitarbeiterkreis', 'Mitarbeiterkreis fehlt – Person wird unter „(ohne Angabe)“ geführt.');
    if (!r.cluster) add('E', 'Pflichtfeld leer', r, 'Cluster', 'Cluster fehlt – Person wird unter „(ohne Cluster)“ geführt.');
    if (r.beginn == null && !r.beginnErr) add('W', 'Pflichtfeld leer', r, 'Beginn', 'Vertragsbeginn fehlt – Vertrag wird als bereits begonnen gewertet.');
    if (!r.tarif && 'tarif' in S.colMap) add('W', 'Pflichtfeld leer', r, 'TrfGr', 'Tarifgruppe fehlt.');
    if (!r.vart && 'vart' in S.colMap) add('W', 'Pflichtfeld leer', r, 'Vertragsart', 'Vertragsart fehlt.');
    if (r.beginnErr) add('E', 'Datum nicht lesbar', r, 'Beginn', `„${str(r.rawRow[S.colMap.beginn])}“ ist kein gültiges Datum.`);
    if (r.endeErr) add('E', 'Datum nicht lesbar', r, 'Vertragsende', `„${str(r.rawRow[S.colMap.ende])}“ ist kein gültiges Datum – Vertrag wird als unbefristet gewertet.`);
    if (r.ruhtErr) add('E', 'Datum nicht lesbar', r, 'ruht bis', `„${str(r.rawRow[S.colMap.ruht])}“ ist kein gültiges Datum – Vertrag wird als nicht ruhend gewertet.`);
    if (r.ruhtOpen) add('W', 'Ruhen ohne Ende', r, 'ruht bis', 'Datum ab 2100 bei „ruht bis“ – wird ignoriert. Bitte das tatsächliche Ende des Ruhens eintragen.');
    if (r.ruht != null) {
      if (r.beginn != null && r.ruht < r.beginn) add('W', 'Ruhen außerhalb der Vertragslaufzeit', r, 'ruht bis', `„ruht bis“ ${fmtD(r.ruht)} liegt vor Vertragsbeginn ${fmtD(r.beginn)} – ohne Wirkung.`);
      else if (r.ende != null && r.ruht >= r.ende) add('W', 'Ruhen bis Vertragsende', r, 'ruht bis', `Vertrag ruht bis ${fmtD(r.ruht)}, endet aber am ${fmtD(r.ende)} – die Person kehrt nicht mehr zurück.`);
      else if (r.ruht >= S.today && inContract(r, S.today)) add('I', restShare(r) < 0.9999 ? 'Vertrag ruht teilweise' : 'Vertrag ruht', r, 'ruht bis', restShare(r) < 0.9999 ? `${nf2.format(restVz(r, S.today))} von ${nf2.format(r.vz)} VZÄ ruhen bis ${fmtD(r.ruht)} – bis dahin nur ${nf2.format(effVz(r, S.today))} VZÄ${'deputat' in S.colMap ? ' und anteiliges Deputat' : ''} gezählt.` : `Vertrag ruht bis ${fmtD(r.ruht)} – bis dahin nicht als Stelle${'deputat' in S.colMap ? ' und nicht mit Deputat' : ''} gezählt.`);
      else if (r.ruht < S.today) add('I', 'Ruhen beendet', r, 'ruht bis', `Ruhen endete am ${fmtD(r.ruht)} – Vertrag wieder aktiv.`);
    }
    if (r.ruheErr) add('E', 'Zahl nicht lesbar', r, 'Ruheanteil', `Ruheanteil „${str(r.rawRow[S.colMap.ruheanteil])}“ ist keine Zahl – es ruht die ganze Stelle.`);
    else if (r.ruheVz != null) {
      if (r.ruheVz <= 0) add('E', 'Wert außerhalb des Bereichs', r, 'Ruheanteil', `Ruheanteil ${nf2.format(r.ruheVz)} muss größer als 0 sein – es ruht die ganze Stelle.`);
      else if (r.vz > 0 && r.ruheVz > r.vz + 0.001) add('W', 'Ruheanteil größer als Stelle', r, 'Ruheanteil', `Ruheanteil ${nf2.format(r.ruheVz)} VZÄ ist größer als der Vertrag (${nf2.format(r.vz)} VZÄ) – es ruht die ganze Stelle.`);
      if (r.ruht == null && !r.ruhtErr) add('W', 'Ruheanteil ohne „ruht bis“', r, 'Ruheanteil', `Ruheanteil ${nf2.format(r.ruheVz)} VZÄ angegeben, aber kein Datum „ruht bis“ – ohne Wirkung.`);
    }
    if (r.arbErr) add('E', 'Zahl nicht lesbar', r, 'ArbAnteil', 'ArbAnteil ist keine Zahl.');
    if (r.vzErr) add('E', 'Zahl nicht lesbar', r, 'VZÄ', 'VZÄ ist keine Zahl.');
    if (r.beginn != null && r.ende != null && r.beginn > r.ende) add('E', 'Beginn nach Vertragsende', r, 'Beginn/Vertragsende', `Beginn ${fmtD(r.beginn)} liegt nach Vertragsende ${fmtD(r.ende)} – Vertrag ist nie aktiv.`);
    if (r.arb != null && (r.arb <= 0 || r.arb > 100)) add('E', 'Wert außerhalb des Bereichs', r, 'ArbAnteil', `ArbAnteil ${nf2.format(r.arb)} % liegt außerhalb von 0–100 %.`);
    if (r.vz != null && !r.vzDerived && (r.vz <= 0 || r.vz > 1)) add('E', 'Wert außerhalb des Bereichs', r, 'VZÄ', `VZÄ ${nf2.format(r.vz)} liegt außerhalb von 0–1.`);
    if (r.vzWasPct) add('W', 'Wert außerhalb des Bereichs', r, 'VZÄ', 'VZÄ scheint in Prozent angegeben – wurde durch 100 geteilt.');
    if (r.vz == null && r.arb == null) add('E', 'Pflichtfeld leer', r, 'VZÄ/ArbAnteil', 'Weder VZÄ noch ArbAnteil angegeben – VZÄ wird mit 0 gezählt.');
    else if (r.vzDerived) add('W', 'Pflichtfeld leer', r, 'VZÄ', `VZÄ fehlt – aus ArbAnteil abgeleitet (${nf2.format(r.vz)}).`);
    else if (r.arb != null && Math.abs(r.arb / 100 - r.vz) > 0.011) add('W', 'VZÄ passt nicht zu ArbAnteil', r, 'VZÄ/ArbAnteil', `ArbAnteil ${nf2.format(r.arb)} % ergibt ${nf2.format(r.arb / 100)} VZÄ, eingetragen sind ${nf2.format(r.vz)}. Gezählt wird der VZÄ-Wert.`);
    // Vertragsart / Ende / kw
    if (r.befr === true && r.vertragsende == null && !r.endeErr) add('E', 'Befristet ohne Vertragsende', r, 'Vertragsende', 'Vertragsart „befristet“, aber kein Vertragsende – ' + (r.ruhestand != null ? `es zählt das Ruhestandsdatum ${fmtD(r.ruhestand)}.` : 'wird in Prognosen als unbefristet gezählt.'));
    if (r.befr === false && r.vertragsende != null) {
      if ('ruhestand' in S.colMap) add('W', 'Unbefristet mit Vertragsende', r, 'Vertragsende', `Unbefristeter Vertrag mit Vertragsende ${fmtD(r.vertragsende)} – das Ausscheiden gehört in die Spalte „Ruhestand“. Wird als Ruhestand gewertet.`);
      else add('I', 'Unbefristet mit Enddatum', r, 'Vertragsende', `Unbefristeter Vertrag mit Ende ${fmtD(r.vertragsende)} – wird als Ruhestand gewertet.`);
    }
    if (r.ruhestandErr) add('E', 'Datum nicht lesbar', r, 'Ruhestand', `„${str(r.rawRow[S.colMap.ruhestand])}“ ist kein gültiges Datum.`);
    if (r.ruhestand != null) {
      if (r.beginn != null && r.ruhestand < r.beginn) add('E', 'Ruhestand vor Vertragsbeginn', r, 'Ruhestand', `Ruhestand ${fmtD(r.ruhestand)} liegt vor Vertragsbeginn ${fmtD(r.beginn)}.`);
      else if (r.fixedTerm && r.vertragsende != null && r.ruhestand < r.vertragsende) add('I', 'Ruhestand vor Vertragsende', r, 'Ruhestand', `Ruhestand ${fmtD(r.ruhestand)} liegt vor dem Ende des Zeitvertrags ${fmtD(r.vertragsende)} – maßgeblich ist der Ruhestand.`);
      else if (r.fixedTerm && r.vertragsende != null) add('I', 'Ruhestand bei Zeitvertrag', r, 'Ruhestand', `Zeitvertrag endet ${fmtD(r.vertragsende)} vor dem Ruhestand ${fmtD(r.ruhestand)} – maßgeblich ist das Vertragsende.`);
    } else if (r.befr === false && r.vertragsende == null && 'ruhestand' in S.colMap && !r.ruhestandErr) add('I', 'Unbefristet ohne Ruhestandsdatum', r, 'Ruhestand', 'Kein voraussichtlicher Ruhestand angegeben – der Vertrag läuft in Prognosen unbegrenzt weiter.');
    if (r.befr === null && r.vart) add('W', 'Vertragsart unklar', r, 'Vertragsart', `Vertragsart „${r.vart}“ nicht als befristet/unbefristet erkannt.`);
    if (r.kw && r.ende == null) add('W', 'kw-Vermerk ohne Vertragsende', r, 'kw', 'kw-Vermerk, aber weder Vertragsende noch Ruhestand – die Stelle entfällt in der Prognose nie.');
    if (r.kwUnclear) add('W', 'kw-Wert unklar', r, 'kw', `kw-Wert „${r.kwRaw}“ nicht erkannt – als „kein kw“ gewertet. Erwartet: x / ja / leer.`);
    // Tarif vs. Kreis
    if (r.tarif) {
      const isW = /^W\d|^C\d/.test(r.tarif), tn = tarifNum(r.tarif);
      if (cat === 'Professor/in' && !isW) add('W', 'Tarifgruppe passt nicht zum Mitarbeiterkreis', r, 'TrfGr', `Professur mit Tarifgruppe ${r.tarif} (erwartet W1–W3 bzw. C).`);
      if (cat !== 'Professor/in' && /^W[1-3]$/.test(r.tarif)) add('W', 'Tarifgruppe passt nicht zum Mitarbeiterkreis', r, 'TrfGr', `W-Besoldung ${r.tarif} bei Mitarbeiterkreis „${r.kreis}“.`);
      if ((cat === 'WiMi' || cat === 'LfbA') && /^E/.test(r.tarif) && tn != null && tn < 13) add('I', 'Tarifgruppe passt nicht zum Mitarbeiterkreis', r, 'TrfGr', `${cat} mit ${r.tarif} (üblich ab E13).`);
    }
    // Zeitbezug
    if (r.ende != null && r.ende < T && !(r.beginn != null && r.beginn > r.ende)) add('I', r.endType === 'Ruhestand' ? 'Bereits im Ruhestand' : 'Vertrag bereits ausgelaufen', r, r.endType || 'Vertragsende', `${r.endType === 'Ruhestand' ? 'Ruhestand' : 'Vertragsende'} ${fmtD(r.ende)} liegt vor dem Stichtag – nicht aktiv.`);
    if (r.beginn != null && r.beginn > T) add('I', 'Vertrag beginnt in der Zukunft', r, 'Beginn', `Beginn ${fmtD(r.beginn)} – noch nicht aktiv, erscheint ab dann in Prognosen.`);
    if ('deputat' in S.colMap) {
      if (r.deputatErr) add('E', 'Zahl nicht lesbar', r, 'Deputat', `Deputat „${str(r.rawRow[S.colMap.deputat])}“ ist keine Zahl – als 0 gewertet.`);
      else if (r.deputat != null && r.deputat < 0) add('E', 'Wert außerhalb des Bereichs', r, 'Deputat', `Deputat ${nf2.format(r.deputat)} SWS ist negativ.`);
      else if (r.deputat != null && r.deputat > 30) add('W', 'Deputat unplausibel', r, 'Deputat', `Deputat ${nf2.format(r.deputat)} SWS je Semester ist ungewöhnlich hoch.`);
      if ((cat === 'Professor/in' || cat === 'LfbA') && !r.deputatErr && !r.deputat) add('W', 'Lehrperson ohne Deputat', r, 'Deputat', `${cat} ${r.deputat === 0 ? 'mit Deputat 0 (nur unterstützend)' : 'ohne Deputatsangabe'} – trägt nicht zur Lehrkapazität bei.`);
      if (r.deputat > 0 && cat === 'Sonstige') add('I', 'Deputat bei sonstigem Personal', r, 'Deputat', `${r.kreis || 'Person'} mit ${nf2.format(r.deputat)} SWS Deputat – wird zur Lehrkapazität gezählt.`);
    }
    if (r.endeOpenSentinel) add('I', 'Platzhalter-Enddatum', r, 'Vertragsende', 'Enddatum ab Jahr 2100 als „unbefristet“ gewertet.');
    if (r.beginn != null && fromDay(r.beginn).y < 1960) add('W', 'Datum unplausibel', r, 'Beginn', `Beginn ${fmtD(r.beginn)} sehr früh.`);
    if (r.clusterCase) add('I', 'Schreibweise vereinheitlicht', r, 'Cluster', `„${r.clusterCase}“ als „${r.cluster}“ gezählt.`);
    if (r.kreisCase) add('I', 'Schreibweise vereinheitlicht', r, 'Mitarbeiterkreis', `„${r.kreisCase}“ als „${r.kreis}“ gezählt.`);
    if (typeof r.clusterRaw === 'string' && r.clusterRaw !== r.clusterRaw.trim() && r.cluster) add('I', 'Leerzeichen entfernt', r, 'Cluster', `Überzählige Leerzeichen in „${r.clusterRaw}“ entfernt.`);
  }

  // Personalnummern
  const byP = {};
  recs.forEach(r => { if (r.pnr) (byP[r.pnr] = byP[r.pnr] || []).push(r); });
  for (const [p, rs] of Object.entries(byP)) {
    if (rs.length < 2) continue;
    const names = new Set(rs.map(r => (r.name + '|' + r.vorname).toLowerCase()));
    if (names.size > 1) { rs.forEach(r => add('E', 'Personalnummer mehrfach vergeben', r, 'Personalnummer', `Nr. ${p} gehört zu verschiedenen Personen (Zeilen ${rs.map(x => x.row).join(', ')}).`)); continue; }
    // gleiche Person – Überlappung prüfen
    let over = false;
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      const s = Math.max(a.beginn ?? -1e9, b.beginn ?? -1e9), e = Math.min(a.ende ?? 1e9, b.ende ?? 1e9);
      if (s <= e && (a.vz || 0) + (b.vz || 0) > 1.0001) over = true;
    }
    rs.forEach(r => add(over ? 'E' : 'I', over ? 'Mehr als 1,0 VZÄ je Person' : 'Mehrere Verträge je Person', r, 'Personalnummer',
      over ? `Personalnummer ${p}: zeitgleich laufende Verträge mit zusammen mehr als 1,0 VZÄ (Zeilen ${rs.map(x => x.row).join(', ')}).`
           : `Personalnummer ${p} hat ${rs.length} Verträge (Zeilen ${rs.map(x => x.row).join(', ')}) – wird je Vertrag gezählt.`));
  }
  const byN = {};
  recs.forEach(r => { if (r.name && r.vorname && r.pnr) { const k = (r.name + '|' + r.vorname).toLowerCase(); (byN[k] = byN[k] || new Set()).add(r.pnr); } });
  recs.forEach(r => { const k = (r.name + '|' + r.vorname).toLowerCase(); if (byN[k] && byN[k].size > 1) add('W', 'Gleicher Name, verschiedene Personalnummern', r, 'Name', `${r.vorname} ${r.name} kommt mit ${byN[k].size} Personalnummern vor – Namensgleichheit oder Doppelerfassung?`); });

  // ähnliche Cluster-/Kreisnamen (Tippfehler)
  for (const field of ['cluster', 'kreis']) {
    const cnt = {}; recs.forEach(r => { if (r[field]) cnt[r[field]] = (cnt[r[field]] || 0) + 1; });
    if (field === 'cluster') S.students.forEach(s => { if (s.cluster && !cnt[s.cluster]) cnt[s.cluster] = 0; });
    const vals = Object.keys(cnt);
    for (const a of vals) for (const b of vals) {
      if (a === b || cnt[a] > cnt[b] || (cnt[a] === cnt[b] && a > b)) continue;
      const d = lev(a, b);
      if (d > 0 && d <= Math.max(1, Math.min(2, Math.floor(Math.min(a.length, b.length) / 4))))
        recs.filter(r => r[field] === a).forEach(r => add('W', 'Möglicher Tippfehler', r, field === 'cluster' ? 'Cluster' : 'Mitarbeiterkreis', `„${a}“ ähnelt „${b}“ – Tippfehler? Wird derzeit als eigene Kategorie gezählt.`));
    }
  }

  // Vertretungen: „Vertretung für“ enthält die Personalnummer der vertretenen Person
  S.recs.forEach(r => { r.vertretene = null; r.vertreter = []; });
  if ('vertretung' in S.colMap) {
    const byPnr = {}; recs.forEach(r => { if (r.pnr) (byPnr[r.pnr] = byPnr[r.pnr] || []).push(r); });
    const nm = v => [v.vorname, v.name].filter(Boolean).join(' ') || 'Person';
    const days = (a, b) => Math.abs(a - b);
    for (const r of recs) {
      const vp = r.vertretungFuer; if (!vp) continue;
      if (vp === r.pnr) { add('E', 'Vertretung: ungültige Angabe', r, 'Vertretung für', 'Person vertritt sich selbst.'); continue; }
      const cands = byPnr[vp];
      if (!cands) { add('E', 'Vertretung: vertretene Person nicht gefunden', r, 'Vertretung für', `Personalnummer ${vp} kommt im Personalblatt nicht vor.`); continue; }
      const v = cands.find(x => x.ruht != null) || cands[0];
      r.vertretene = v; v.vertreter.push(r);
      // 1) Ruht der Vertrag der vertretenen Person?
      if (v.ruht == null) { add('W', 'Vertretung: vertretene Person ruht nicht', r, 'Vertretung für', `${nm(v)} (${vp}) hat keinen ruhenden Vertrag – die Stelle wäre doppelt besetzt und wird doppelt gezählt.`); continue; }
      // 2) Passt die Vertragsdauer zur Dauer der Ruhe?
      if (r.beginn != null && r.beginn > v.ruht) add('E', 'Vertretung: Dauer passt nicht zur Ruhe', r, 'Beginn', `Vertretung beginnt am ${fmtD(r.beginn)}, die Ruhe von ${nm(v)} endet aber schon am ${fmtD(v.ruht)}.`);
      else if (r.ende == null) add('W', 'Vertretung: Dauer passt nicht zur Ruhe', r, 'Vertragsende', `Vertretung ist unbefristet, die Ruhe von ${nm(v)} endet am ${fmtD(v.ruht)}.`);
      else if (r.ende > v.ruht) add('W', 'Vertretung: Dauer passt nicht zur Ruhe', r, 'Vertragsende', `Vertretung endet am ${fmtD(r.ende)}, ${days(r.ende, v.ruht)} Tage nach dem Ende der Ruhe von ${nm(v)} (${fmtD(v.ruht)}) – Überschneidung nach der Rückkehr.`);
      else if (r.ende < v.ruht) add('W', 'Vertretung: Dauer passt nicht zur Ruhe', r, 'Vertragsende', `Vertretung endet am ${fmtD(r.ende)}, ${days(r.ende, v.ruht)} Tage vor dem Ende der Ruhe von ${nm(v)} (${fmtD(v.ruht)}) – Lücke bis zur Rückkehr.`);
      else add('I', 'Vertretung: Dauer passt zur Ruhe', r, 'Vertragsende', `Vertretung endet zeitgleich mit der Ruhe von ${nm(v)} (${fmtD(v.ruht)}).`);
      const vRest = r2((v.vz || 0) * restShare(v));
      if (r.vz != null && v.vz != null && r.vz > vRest + 0.001) add('I', 'Vertretung: größerer Umfang', r, 'VZÄ', `Vertretung mit ${nf2.format(r.vz)} VZÄ, bei ${[v.vorname, v.name].filter(Boolean).join(' ')} ${restShare(v) < 0.9999 ? 'ruhen nur' : 'ruht die Stelle mit'} ${nf2.format(vRest)} VZÄ.`);
    }
    // Ruhende Verträge ohne Vertretung
    recs.filter(r => r.ruht != null && inRestPeriod(r, S.today) && !r.vertreter.length).forEach(r => add('I', 'Ruhender Vertrag ohne Vertretung', r, 'ruht bis', `Vertrag ruht bis ${fmtD(r.ruht)}; es ist keine Vertretung eingetragen.`));
  }

  // Studierende
  const staffCl = new Set(recs.map(clusterOf)), studCl = new Set();
  const sgSeen = {};
  for (const s of S.students) {
    const r = {row: s.row, pnr: '', name: s.sg, vorname: '', sg: s.sg};
    if (!s.sg) add('W', 'Studierende: Pflichtfeld leer', r, 'Studiengang', 'Studiengang fehlt.');
    if (!s.cluster) add('E', 'Studierende: Pflichtfeld leer', r, 'Cluster', 'Cluster fehlt – Studierende werden keinem Cluster zugeordnet.');
    if (s.nErr || s.n == null) add('E', 'Studierende: Zahl fehlt/unlesbar', r, 'Studierende', 'Anzahl Studierende fehlt oder ist keine Zahl.');
    else if (s.n < 0 || !Number.isInteger(s.n)) add('E', 'Studierende: Wert unplausibel', r, 'Studierende', `Anzahl ${s.n} ist keine nichtnegative ganze Zahl.`);
    if (s.sg) { const k = s.sg.toLowerCase(); if (sgSeen[k]) add('W', 'Studierende: Studiengang doppelt', r, 'Studiengang', `Studiengang auch in Zeile ${sgSeen[k]} – wird doppelt gezählt.`); else sgSeen[k] = s.row; }
    if (s.cluster) { studCl.add(s.cluster); if (!staffCl.has(s.cluster)) add('W', 'Cluster ohne Personal', r, 'Cluster', `Cluster „${s.cluster}“ kommt im Personalblatt nicht vor – Betreuungsrelation nicht berechenbar.`); }
    if (s.clusterCase) add('I', 'Schreibweise vereinheitlicht', r, 'Cluster', `„${s.clusterCase}“ als „${s.cluster}“ gezählt.`);
    const sm = S.raw.stud.map;
    if ('cnw' in sm) {
      if (s.cnwErr || s.cnw == null) add('E', 'Studierende: CNW fehlt/unlesbar', r, 'CNW', 'CNW fehlt oder ist keine Zahl – erforderliche Kapazität nicht berechenbar.');
      else if (s.cnw <= 0) add('E', 'Studierende: Wert unplausibel', r, 'CNW', `CNW ${nf2.format(s.cnw)} muss größer als 0 sein.`);
      else if (s.cnw > 15) add('W', 'Studierende: Wert unplausibel', r, 'CNW', `CNW ${nf2.format(s.cnw)} ist ungewöhnlich hoch.`);
    }
    if ('pl' in sm) {
      if (s.plErr || s.pl == null) add('E', 'Studierende: Studienplätze fehlen/unlesbar', r, 'Studienplätze', 'Anzahl Studienplätze fehlt oder ist keine Zahl – erforderliche Kapazität nicht berechenbar.');
      else if (s.pl < 0 || !Number.isInteger(s.pl)) add('E', 'Studierende: Wert unplausibel', r, 'Studienplätze', `Studienplätze ${s.pl} ist keine nichtnegative ganze Zahl.`);
    }
    if ('art' in sm) {
      if (!s.artRaw) add('W', 'Studierende: Pflichtfeld leer', r, 'Art', 'Art des Studiengangs (Bachelor/Master) fehlt.');
      else if (s.art === 'Sonstige') add('W', 'Studierende: Art unklar', r, 'Art', `Art „${s.artRaw}“ nicht als Bachelor oder Master erkannt.`);
    }
  }
  if (S.raw.stud) for (const c of staffCl) if (c !== '(ohne Cluster)' && !studCl.has(c)) add('W', 'Cluster ohne Studierende', null, 'Cluster', `Cluster „${c}“ hat im Studierendenblatt keine Studiengänge.`);

  const ord = {E: 0, W: 1, I: 2};
  I.sort((a, b) => ord[a.sev] - ord[b.sev] || (a.sheet > b.sheet ? 1 : a.sheet < b.sheet ? -1 : 0) || (a.row ?? 0) - (b.row ?? 0));
  S.issues = I;
}
