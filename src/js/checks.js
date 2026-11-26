// Datenprüfung (Plausibilitätsregeln)
import {fmtD, fromDay, nf2, r2, semEnd, semLabel, semStart, sumBy} from './util.js';
import {S} from './state.js';
import {lvvoFassung} from './lvvo.js';
import {clusterOf, kreisOf, OPTIONAL_COLS, pnrKey, str, STUD_FIELDS, tarifNum} from './parse.js';
import {effVz, grpOf, inContract, inRestPeriod, isActive, restShare, restVz} from './model.js';
import {lvvo, lvvoGruppe, lvvoStats, zeitkonto} from './teaching.js';

export function lev(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const d = Array.from({length: a.length + 1}, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function runChecks() {
  const I = [], T = S.today;
  const add = (sev, check, r, field, msg) => I.push({sev, check, row: r ? r.row : null, pnr: r ? r.pnr : '', pk: r ? (r.pk ?? pnrKey(r.pnr)) : '', person: r ? [r.name, r.vorname].filter(Boolean).join(', ') : '', field, msg, sheet: r && r.sheet ? r.sheet : r && r.sg != null ? 'Studierende' : 'Personal'});

  S.missingCols.filter(c => !OPTIONAL_COLS.includes(c)).forEach(c => add(c === 'Laborbereich' || c === 'Organisationseinheit' ? 'W' : 'E', 'Spalte fehlt', null, c, `Spalte „${c}“ wurde im Personalblatt nicht gefunden.`));
  if (!('deputat' in S.colMap)) add('I', 'Spalte Deputat fehlt', null, 'Deputat', 'Ohne Spalte „Deputat“ zählt die Lehre der WiMi und des sonstigen Personals mit 0 LVS. Professuren und LfbA werden nach der LVVO gerechnet; für sie wird das Deputat nicht gebraucht.');
  if (S.raw.stud) STUD_FIELDS.filter(f => !(f[0] in S.raw.stud.map)).forEach(f => add(['cnw', 'pl'].includes(f[0]) ? 'W' : f[0] === 'art' ? 'I' : 'E', 'Spalte fehlt', null, f[1], `Spalte „${f[1]}“ wurde im Studierendenblatt nicht gefunden.` + (['cnw', 'pl'].includes(f[0]) ? ' Die erforderliche Kapazität ist nicht berechenbar.' : '')));
  if (!S.raw.stud) add('E', 'Studierendenblatt fehlt', null, '', 'Kein Tabellenblatt mit Studiengang/Cluster/Studierende gefunden – Betreuungsverhältnis nicht berechenbar.');

  // Blätter: nicht erkannte Blätter melden, fehlende Spalten der LVVO-Blätter
  for (const sh of S.raw.sheetInfo || []) {
    if (sh.kind) continue;
    const ref = {row: null, pnr: '', name: '', vorname: '', sheet: sh.sn}, seen = sh.headers.length ? ` Gelesene Überschriften: ${sh.headers.map(h => `„${h}“`).join(', ')}.` : ' Es wurden keine Überschriften gefunden.';
    if (sh.hint === 'erm') add('W', 'Blatt nicht erkannt', ref, 'Blatt', `Blatt „${sh.sn}“ sieht nach Ermäßigungen aus, wurde aber nicht erkannt. Benötigt wird eine Spalte „Personalnummer“, dazu „Grund“ und „LVS“ oder „Prozent“, optional „von“ und „bis“.${seen}`);
    else if (sh.hint === 'lehre') add('W', 'Blatt nicht erkannt', ref, 'Blatt', `Blatt „${sh.sn}“ sieht nach gehaltener Lehre aus, wurde aber nicht erkannt. Benötigt werden „Personalnummer“ und „Semester“, dazu „SWS“ oder „LVS“.${seen}`);
    else add('I', 'Blatt nicht ausgewertet', ref, 'Blatt', `Blatt „${sh.sn}“ wurde keiner Tabelle zugeordnet (Personal, Studierende, Ermäßigungen, Lehre) und wird nicht ausgewertet.${seen}`);
  }
  if (S.raw.erm) {
    const m = S.raw.erm.map, ref = {row: S.raw.erm.headerRow + 1, pnr: '', name: '', vorname: '', sheet: S.raw.erm.sn};
    if (!('grund' in m)) add('W', 'Spalte fehlt', ref, 'Grund', `Im Blatt „${S.raw.erm.sn}“ wurde keine Spalte für den Grund der Ermäßigung erkannt (z. B. „Grund“, „Anlass“, „Art der Ermäßigung“) – Höchstgrenzen können nicht geprüft werden.`);
    if (!('lvs' in m) && !('pct' in m)) add('E', 'Spalte fehlt', ref, 'LVS/Prozent', `Im Blatt „${S.raw.erm.sn}“ wurde keine Spalte für den Umfang erkannt (z. B. „LVS“, „SWS“, „Stunden“ oder „Prozent“) – keine Ermäßigung kann angerechnet werden.`);
  }

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
    const byPnr = {}; recs.forEach(r => { if (r.pk) (byPnr[r.pk] = byPnr[r.pk] || []).push(r); });
    const nm = v => [v.vorname, v.name].filter(Boolean).join(' ') || 'Person';
    const days = (a, b) => Math.abs(a - b);
    for (const r of recs) {
      const vp = r.vertretungFuer; if (!vp) continue;
      if (r.vertretungPk === r.pk) { add('E', 'Vertretung: ungültige Angabe', r, 'Vertretung für', 'Person vertritt sich selbst.'); continue; }
      const cands = byPnr[r.vertretungPk];
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

  // LVVO (Fachhochschule): Zuordnung, Deputat gegen Lehrverpflichtung, Ermäßigungen
  {
    const F = lvvoFassung(T), nf = v => nf2.format(v);
    const current = recs.filter(r => r.ende == null || r.ende >= T);   // ausgelaufene Verträge nicht mehr prüfen
    const byPnr = new Map(); recs.forEach(r => { if (r.pk && !byPnr.has(r.pk)) byPnr.set(r.pk, r); });   // Schlüssel: Personalnummer ohne führende Nullen
    const qAnnahme = [];
    for (const r of current) {
      const gr = lvvoGruppe(r), g = F.gruppen[gr.key];
      if (r.lvvoRaw && !r.lvvoSpalte) add('E', 'LVVO-Gruppe nicht erkannt', r, 'LVVO-Gruppe', `„${r.lvvoRaw}“ nicht erkannt – Gruppe wird aus dem Mitarbeiterkreis abgeleitet (${g.label}). Erwartet: Professur, LfbA 20, LfbA 24, WiMi, WiMi Qualifikation oder keine.`);
      if (r.lvvoSpalte) {
        const erwartet = {P: ['prof'], L: ['lfba20', 'lfba24'], W: ['wimi', 'wimiQ']}[grpOf(r)] || ['keine'];
        if (!erwartet.includes(r.lvvoSpalte)) add('W', 'LVVO-Gruppe passt nicht zum Mitarbeiterkreis', r, 'LVVO-Gruppe', `LVVO-Gruppe „${g.label}“ bei Mitarbeiterkreis „${r.kreis}“ – bitte prüfen. Es zählt die LVVO-Gruppe.`);
      }
      if (gr.annahme && gr.key === 'wimiQ') qAnnahme.push(r);
      else if (gr.annahme) add('I', 'LVVO-Gruppe angenommen', r, 'TrfGr', `${gr.annahme} (${g.ref}). Abweichungen in der Spalte „LVVO-Gruppe“ eintragen.`);
      if (g.art === 'keine') continue;
      const x = lvvo(r, T, {nominal: true});
      if ('deputat' in S.colMap && g.art === 'hoechst' && r.deputat == null && !r.deputatErr && isActive(r, T)) add('W', 'WiMi ohne Deputat', r, 'Deputat',
        `Deputat fehlt – die Lehre zählt mit 0 LVS. Für WiMi nennt die LVVO nur die Höchstlehrverpflichtung (${g.label}: ${g.lvs} LVS × ${nf(r2(r.vz || 0))} VZÄ); bitte die festgelegte Lehre eintragen, 0 = nur unterstützend.`);
      if ('deputat' in S.colMap && x.deputat != null) {
        if (g.art === 'regel' && x.deputat >= 0 && Math.abs(x.deputat - x.soll) > 0.005) add('W', 'Deputat weicht von LVVO ab', r, 'Deputat',
          `Deputat ${nf(x.deputat)} LVS, nach LVVO ${nf(x.soll)} LVS: ${g.label} ${g.lvs} LVS × ${nf(x.anteil)} VZÄ` + (x.ermSum ? ` − Ermäßigungen ${nf(x.ermSum)} LVS` : '') + ` (${g.ref}).`);
        if (g.art === 'hoechst' && x.deputat > x.basis + 0.005) add('W', 'Deputat über der Höchstlehrverpflichtung', r, 'Deputat',
          `Deputat ${nf(x.deputat)} LVS, Höchstlehrverpflichtung ${g.label} ${g.lvs} LVS × ${nf(x.anteil)} VZÄ = ${nf(x.basis)} LVS (${g.ref}).`);
      }
      if (x.ueberErmaessigt) add('W', 'Ermäßigungen größer als Lehrverpflichtung', r, 'Ermäßigungen', `Ermäßigungen ${nf(x.ermSum)} LVS übersteigen die Lehrverpflichtung von ${nf(x.basis)} LVS – es wird 0 gezählt.`);
      // § 9 Satz 3: je Professur höchstens 4 LVS, für Forschung/Entwicklung/Transfer höchstens 9 LVS
      if (gr.key === 'prof') {
        const p9 = x.erm.filter(e => (F.gruende.find(q => q.key === e.grund) || {}).p9), sum = sumBy(p9, e => e.lvs);
        const ohneF = sumBy(p9.filter(e => e.grund !== 'forschung'), e => e.lvs);
        if (sum > F.p9.profMaxForschung + 0.005) add('W', 'Ermäßigung über der Höchstgrenze', r, 'Ermäßigungen', `Ermäßigungen nach § 9 zusammen ${nf(sum)} LVS – höchstens ${F.p9.profMaxForschung} LVS (${F.p9.ref}).`);
        else if (ohneF > F.p9.profMax + 0.005) add('W', 'Ermäßigung über der Höchstgrenze', r, 'Ermäßigungen', `Ermäßigungen nach § 9 für Aufgaben und Funktionen ${nf(ohneF)} LVS – höchstens ${F.p9.profMax} LVS je Professur; nur für Forschung, Entwicklung und Transfer bis ${F.p9.profMaxForschung} LVS (${F.p9.ref}).`);
      }
    }
    if (qAnnahme.length) add('I', 'LVVO-Gruppe angenommen', null, 'LVVO-Gruppe', `${qAnnahme.length} befristete WiMi: Beschäftigung auch zur Weiterqualifikation angenommen – Höchstlehrverpflichtung 4 statt 8 LVS (§ 5 Abs. 2 Nr. 2). Abweichungen in der Spalte „LVVO-Gruppe“ eintragen.`);
    // Blatt „Ermäßigungen“
    for (const e of S.reductions || []) {
      const p = byPnr.get(e.pk), ref = {row: e.row, pnr: e.pnr, pk: e.pk, name: p ? p.name : e.grundRaw, vorname: p ? p.vorname : '', sheet: 'Ermäßigungen'};
      const G = F.gruende.find(q => q.key === e.grund);
      if (!e.pnr) { add('E', 'Ermäßigung: Pflichtfeld leer', ref, 'Personalnummer', 'Personalnummer fehlt – Ermäßigung wird nicht berücksichtigt.'); continue; }
      if (!p) { add('E', 'Ermäßigung: Person nicht gefunden', ref, 'Personalnummer', `Personalnummer ${e.pnr} kommt im Personalblatt nicht vor – Ermäßigung wird nicht berücksichtigt.`); continue; }
      for (const [k, f] of [['lvsErr', 'LVS'], ['pctErr', 'Prozent'], ['vonErr', 'von'], ['bisErr', 'bis']])
        if (e[k]) add('E', 'Ermäßigung: Wert nicht lesbar', ref, f, `${f} ist ${f === 'von' || f === 'bis' ? 'kein gültiges Datum' : 'keine Zahl'} – Ermäßigung wird nicht berücksichtigt.`);
      if (e.lvs == null && e.pct == null && !e.lvsErr && !e.pctErr) add('E', 'Ermäßigung ohne Umfang', ref, 'LVS/Prozent', 'Weder LVS noch Prozent angegeben – Ermäßigung wird nicht berücksichtigt.');
      if (e.lvs != null && e.pct != null) add('W', 'Ermäßigung doppelt angegeben', ref, 'LVS/Prozent', `LVS (${nf(e.lvs)}) und Prozent (${nf(e.pct)} %) angegeben – es zählen die LVS.`);
      if (e.lvs != null && e.lvs <= 0) add('E', 'Wert außerhalb des Bereichs', ref, 'LVS', `Ermäßigung ${nf(e.lvs)} LVS muss größer als 0 sein.`);
      if (e.lvs == null && e.pct != null && (e.pct <= 0 || e.pct > 100)) add('E', 'Wert außerhalb des Bereichs', ref, 'Prozent', `Ermäßigung ${nf(e.pct)} % liegt außerhalb von 0–100 %.`);
      if (e.von != null && e.bis != null && e.von > e.bis) add('E', 'Ermäßigung: von nach bis', ref, 'von/bis', `Beginn ${fmtD(e.von)} liegt nach dem Ende ${fmtD(e.bis)} – Ermäßigung gilt nie.`);
      if (!e.grund) add('W', 'Ermäßigungsgrund nicht erkannt', ref, 'Grund', `„${e.grundRaw || '(leer)'}“ keinem Grund der LVVO zugeordnet – wird angerechnet, aber ohne Prüfung der Höchstgrenzen.`);
      const g = F.gruppen[lvvoGruppe(p).key];
      if (g.art !== 'regel') { add('W', 'Ermäßigung ohne Regellehrverpflichtung', ref, 'Personalnummer', `${p.vorname} ${p.name} hat keine Regellehrverpflichtung (${g.label}) – Ermäßigung wird nicht berücksichtigt.`); continue; }
      if ((e.von != null && p.ende != null && e.von > p.ende) || (e.bis != null && p.beginn != null && e.bis < p.beginn))
        add('I', 'Ermäßigung außerhalb der Vertragslaufzeit', ref, 'von/bis', `Zeitraum ${fmtD(e.von)}–${fmtD(e.bis)} liegt außerhalb des Vertrags (${fmtD(p.beginn)}–${fmtD(p.ende)}).`);
      if (G && G.maxPct && !e.lvsErr && !e.pctErr) {
        const basis = r2(g.lvs * (p.vz || 0)), pctV = e.lvs != null ? (basis ? r2(e.lvs / basis * 100) : null) : e.pct;
        if (pctV != null && pctV > G.maxPct + 0.005) add('W', 'Ermäßigung über der Höchstgrenze', ref, e.lvs != null ? 'LVS' : 'Prozent', `${G.label}: ${nf(pctV)} % der Lehrverpflichtung – höchstens ${G.maxPct} % (${G.ref}).`);
      }
      if (G && G.hinweisLvs && e.lvs != null && e.lvs > G.hinweisLvs) add('I', 'Ermäßigung: Hinweis', ref, 'LVS', `${G.label}: je Studiengang sollen nicht mehr als ${G.hinweisLvs} LVS gewährt werden (${G.ref}) – bei ${nf(e.lvs)} LVS also mehrere Studiengänge.`);
    }
    // Blatt „Lehre“: Zeilen
    const nfL = v => nf2.format(v);
    for (const t of S.teaching || []) {
      const p = byPnr.get(t.pk), ref = {row: t.row, pnr: t.pnr, pk: t.pk, name: p ? p.name : t.titel, vorname: p ? p.vorname : '', sheet: 'Lehre'};
      if (!t.pnr) { add('E', 'Lehre: Pflichtfeld leer', ref, 'Personalnummer', 'Personalnummer fehlt – Zeile wird nicht berücksichtigt.'); continue; }
      if (!p) { add('E', 'Lehre: Person nicht gefunden', ref, 'Personalnummer', `Personalnummer ${t.pnr} kommt im Personalblatt nicht vor – Zeile wird nicht berücksichtigt.`); continue; }
      if (t.sem == null) add('E', 'Lehre: Semester nicht erkannt', ref, 'Semester', `„${t.semRaw || '(leer)'}“ ist keine Semesterangabe (erwartet z. B. „WS 2026/27“ oder „SS 2027“) – Zeile wird nicht berücksichtigt.`);
      for (const [k, f] of [['swsErr', 'SWS'], ['anteilErr', 'Anteil'], ['anzahlErr', 'Anzahl'], ['lvsErr', 'LVS']])
        if (t[k]) add('E', 'Lehre: Zahl nicht lesbar', ref, f, `${f} ist keine Zahl – Zeile wird nicht berücksichtigt.`);
      if (t.sws == null && t.lvsEin == null && !t.swsErr && !t.lvsErr) add('E', 'Lehre: Umfang fehlt', ref, 'SWS/LVS', 'Weder SWS noch LVS angegeben – Zeile wird nicht berücksichtigt.');
      if (!t.anteilErr && (t.anteil <= 0 || t.anteil > 1)) add('E', 'Wert außerhalb des Bereichs', ref, 'Anteil', `Anteil ${nfL(t.anteil * 100)} % liegt außerhalb von 0–100 %.`);
      if (t.lvs != null && t.lvs < 0) add('E', 'Wert außerhalb des Bereichs', ref, t.lvsEin != null ? 'LVS' : 'SWS', `${nfL(t.lvs)} LVS ist negativ.`);
      if (!t.art && t.lvsEin == null) add('W', 'Lehre: Art nicht erkannt', ref, 'Art', `Art „${t.artRaw || '(leer)'}“ nicht erkannt – Faktor 1 angenommen. Erwartet z. B. Vorlesung, Übung, Seminar, Praktikum, Exkursion, Betreuung.`);
      if (t.lvsEin != null && t.sws != null && !t.swsErr && !t.lvsErr && Math.abs(r2(t.sws * t.faktor * t.anteil * t.anzahl) - t.lvsEin) > 0.005)
        add('I', 'Lehre: LVS eingetragen', ref, 'LVS', `Eingetragen sind ${nfL(t.lvsEin)} LVS; aus SWS ergäben sich ${nfL(r2(t.sws * t.faktor * t.anteil * t.anzahl))} LVS. Es zählen die eingetragenen LVS.`);
      if (t.nichtAnwesend) add('I', 'Lehre: ohne ständige Anwesenheit', ref, 'Art', `Nur zu drei Zehnteln angerechnet (§ 14 Abs. 2): ${nfL(t.lvs)} LVS.`);
      if (t.ok && !(inContract(p, semStart(t.sem)) || inContract(p, semEnd(t.sem)))) add('W', 'Lehre außerhalb der Vertragslaufzeit', ref, 'Semester', `${semLabel(t.sem)} liegt außerhalb des Vertrags (${fmtD(p.beginn)}–${fmtD(p.ende)}).`);
    }
    // Zeitkonto je Person (§ 11, § 15)
    if (S.raw.lehre) {
      const mitLehre = new Set((S.teaching || []).filter(t => t.ok).map(t => t.pk));
      for (const r of recs) {
        if (!mitLehre.has(r.pk) || byPnr.get(r.pk) !== r) continue;   // je Personalnummer einmal
        const k = zeitkonto(r);
        for (const e of k.semester) {
          const sl = semLabel(e.sem);
          if (e.ohneEintrag && e.imVertrag) add('W', 'Zeitkonto: Semester ohne Lehre', r, 'Lehre', `${sl}: keine Lehre eingetragen – zählt als 0 LVS (Soll ${nfL(e.soll)} LVS).`);
          if (e.betreuungGekappt) add('W', 'Betreuung über der Höchstgrenze', r, 'Lehre', `${sl}: Betreuung von Abschlussarbeiten über ${lvvoFassung(semStart(e.sem)).betreuungMax.lvs} LVS – angerechnet werden ${nfL(e.betreuung)} LVS (§ 15).`);
          if (e.unterHaelfte && !e.ohneEintrag) add('W', 'Zeitkonto: weniger als die Hälfte', r, 'Lehre', `${sl}: ${nfL(e.ist)} LVS gehalten, Soll ${nfL(e.soll)} LVS – weniger als die Hälfte (§ 11 Abs. 2 und 3).`);
          if (e.fehlbetragZuHoch) add('W', 'Zeitkonto: Fehlbetrag zu hoch', r, 'Lehre', `Ende ${sl}: Kontostand ${nfL(e.ende)} LVS – der Fehlbetrag darf höchstens die Regellehrverpflichtung (${nfL(e.fehlGrenze)} LVS) betragen (§ 11 Abs. 3 Satz 4).`);
          if (e.verfallen > 0) add('I', 'Zeitkonto: Guthaben verfallen', r, 'Lehre', `Ende ${sl}: ${nfL(e.verfallen)} LVS verfallen – Guthaben höchstens ${nfL(e.kappung)} LVS (Zweifaches der Regellehrverpflichtung, § 11 Abs. 3 Satz 3).`);
        }
      }
      const ohne = current.filter(r => F.gruppen[lvvoGruppe(r).key].art === 'regel' && isActive(r, T) && !mitLehre.has(r.pk));
      if (ohne.length) add('I', 'Lehre nicht erfasst', null, 'Lehre', `${ohne.length} Professuren und LfbA mit aktivem Vertrag haben keine Einträge im Blatt „Lehre“ – für sie wird kein Zeitkonto geführt.`);
    }
    // § 9 Satz 2: Ermäßigungsquote (gilt für die ganze Hochschule – hier nur der Anteil der Fakultät)
    const st = lvvoStats(recs, T);
    if (st.p9Quote != null && st.p9Quote > st.p9Grenze + 0.005) add('I', 'Ermäßigungsquote § 9', null, 'Ermäßigungen',
      `Ermäßigungen nach § 9 der Fakultät: ${nf(st.ermP9)} LVS = ${nf(st.p9Quote)} % der Regellehrverpflichtungen (${nf(st.regel)} LVS). Zulässig sind hochschulweit ${F.p9.quote} %, bis ${F.p9.quoteErweitert} % in dem Maß, in dem WiMi-Lehre erbracht wird (hier ${nf(st.p9Grenze)} %) – ${F.p9.ref}.`);
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
