// Einlesen der Excel-Datei: Spaltenerkennung, Datums-/Zahlenwerte, Aufbau der Datensätze
import {css, fromDay, pct, r2, toDay} from './util.js';
import {CATS, S} from './state.js';
import {grundKey, parseLvvoGruppe} from './lvvo.js';

export const FIELDS = [
  ['pnr', 'Personalnummer', ['personalnummer', 'persnr', 'personalnr', 'pnr']],
  ['vorname', 'Vorname', ['vorname']],
  ['name', 'Name', ['name', 'nachname', 'familienname']],
  ['kreis', 'Mitarbeiterkreis', ['mitarbeiterkreis', 'mitarbeitergruppe', 'personalkreis']],
  ['arb', 'ArbAnteil', ['arbanteil', 'arbeitsanteil', 'arbeitszeitanteil', 'beschäftigungsumfang']],
  ['vz', 'VZÄ', ['vzä', 'vzae', 'vza', 'vollzeitäquivalent']],
  ['tarif', 'TrfGr', ['trfgr', 'tarifgruppe', 'tarif', 'entgeltgruppe', 'besoldungsgruppe']],
  ['vart', 'Vertragsart', ['vertragsart', 'befristung']],
  ['beginn', 'Beginn', ['beginn', 'vertragsbeginn', 'eintritt']],
  ['ende', 'Vertragsende', ['vertragsende', 'ende', 'befristungsende', 'befristetbis', 'austritt']],
  ['kw', 'kw', ['kw', 'kannwegfallen']],
  ['cluster', 'Cluster', ['cluster']],
  ['oe', 'Organisationseinheit', ['organisationseinheit', 'orgeinheit', 'oe']],
  ['labor', 'Laborbereich', ['laborbereich', 'labor']],
  ['ruht', 'ruht bis', ['ruhtbis', 'ruhendbis', 'ruhenbis', 'ruht', 'ruhend']],
  ['ruhestand', 'Ruhestand', ['ruhestand', 'ruhestandsdatum', 'ruhestandsbeginn', 'renteneintritt', 'pensionierung']],
  ['ruheanteil', 'Ruheanteil', ['ruheanteil', 'ruhenderanteil', 'ruhendeanteil', 'ruhenderstellenanteil', 'ruhendesvzä']],
  ['vertretung', 'Vertretung für', ['vertretungfür', 'vertretungfuer', 'vertretung', 'vertrittpersonalnummer', 'vertritt']],
  ['deputat', 'Deputat', ['deputat', 'lehrdeputat', 'lehrverpflichtung', 'lvs', 'sws']],
  ['lvvo', 'LVVO-Gruppe', ['lvvogruppe', 'lehrverpflichtungsgruppe', 'lvvo']],
];
export const OPTIONAL_COLS = ['ruht bis', 'Ruheanteil', 'Ruhestand', 'Vertretung für', 'LVVO-Gruppe'];
/** Optionales Blatt „Ermäßigungen“ (LVVO): eine Zeile je Ermäßigung der Lehrverpflichtung. */
export const ERM_FIELDS = [
  ['pnr', 'Personalnummer', ['personalnummer', 'persnr', 'personalnr', 'pnr']],
  ['grund', 'Grund', ['grund', 'ermässigungsgrund', 'ermäßigungsgrund', 'ermaessigungsgrund', 'anlass']],
  ['lvs', 'LVS', ['lvs', 'ermässigunglvs', 'ermäßigunglvs', 'umfanglvs', 'sws']],
  ['pct', 'Prozent', ['prozent', 'ermässigungprozent', 'ermäßigungprozent', 'anteilprozent']],
  ['von', 'von', ['von', 'gültigab', 'gueltigab']],
  ['bis', 'bis', ['bis', 'gültigbis', 'gueltigbis']],
];
/** Zahl der Tarif- bzw. Besoldungsgruppe (E13 → 13, A13 → 13, W2 → 2); null, wenn nicht erkennbar. */
export const tarifNum = t => { const m = /^[EWA]?(\d+)/.exec(String(t || '').replace(/^TV-?L?/, '')); return m ? +m[1] : null; };
export const normH = h => String(h ?? '').toLowerCase().replace(/ß/g, 'ss').replace(/[^a-z0-9äöü]/g, '');

export function mapHeaders(row, fields) {
  const hs = row.map(normH), map = {}, used = new Set();
  for (const pass of ['exact', 'prefix']) {
    for (const [key, , pats] of fields) {
      if (key in map) continue;
      for (const p of pats) {
        const i = hs.findIndex((h, j) => !used.has(j) && h && (pass === 'exact' ? h === p : (h.startsWith(p) && (p.length >= 3 || h.length <= 4))));
        if (i >= 0) { map[key] = i; used.add(i); break; }
      }
    }
  }
  return map;
}
export function findTable(rows, fields, minHits) {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const map = mapHeaders(rows[r] || [], fields);
    if (Object.keys(map).length >= minHits) return {headerRow: r, map};
  }
  return null;
}

export function parseDate(v) {
  if (v == null || v === '') return {v: null};
  if (typeof v === 'number' && isFinite(v)) {
    const d = Math.floor(v) - 25569;          // Excel-Seriennummer → Tage seit 1970
    if (d < toDay(1900, 1, 2) || v > 2958465) return {err: true};
    return {v: fromDay(d).y >= 2100 ? null : d, open: fromDay(d).y >= 2100};
  }
  if (v instanceof Date && !isNaN(v)) return {v: toDay(v.getFullYear(), v.getMonth() + 1, v.getDate())};
  const s = String(v).trim();
  if (!s || /^(-|–|offen|unbefristet|n\/a)$/i.test(s)) return {v: null};
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(s), y, mo, d;
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += y < 70 ? 2000 : 1900; }
  else if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else return {err: true};
  const n = toDay(y, mo, d), o = fromDay(n);
  if (o.m !== mo || o.d !== d) return {err: true};
  if (y >= 2100) return {v: null, open: true};
  return {v: n};
}
export function parseNum(v) {
  if (v == null || v === '') return {v: null};
  if (typeof v === 'number') return {v};
  let s = String(v).trim().replace('%', '').replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s) && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = Number(s);
  return isFinite(n) && s !== '' ? {v: n, pct: String(v).includes('%')} : {err: true};
}
export const str = v => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();

export const STUD_FIELDS = [
  ['sg', 'Studiengang', ['studiengang']],
  ['cl', 'Cluster', ['cluster']],
  ['art', 'Art', ['art', 'abschluss', 'abschlussart', 'studienart']],
  ['cnw', 'CNW', ['cnw', 'curricularernormwert', 'curricularnormwert', 'curricularwert']],
  ['pl', 'Studienplätze', ['studienplätze', 'studienplaetze', 'aufnahmekapazität', 'zulassungszahl', 'plätze']],
  ['n', 'Studierende', ['studierende', 'anzahl', 'studierendenzahl', 'eingeschriebene']],
];
export function readWorkbook(buf, fileName) {
  const wb = XLSX.read(buf, {type: 'array'});
  let pers = null, stud = null, erm = null;
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header: 1, raw: true, defval: null, blankrows: false});
    if (!pers) { const t = findTable(rows, FIELDS, 6); if (t) { pers = {sn, rows, ...t}; continue; } }
    if (!stud) {
      const t = findTable(rows, STUD_FIELDS, 2);
      if (t && 'sg' in t.map) { stud = {sn, rows, ...t}; continue; }
    }
    if (!erm) {
      const t = findTable(rows, ERM_FIELDS, 2);
      if (t && 'pnr' in t.map && 'grund' in t.map) erm = {sn, rows, ...t};
    }
  }
  if (!pers) throw new Error('Kein Tabellenblatt mit Personaldaten gefunden. Erwartet werden Überschriften wie Personalnummer, Name, Mitarbeiterkreis, VZÄ, Vertragsende, Cluster …');
  S.raw = {fileName, pers, stud, erm, sheetNames: wb.SheetNames};
  buildRecords();
}

export function buildRecords() {
  const {pers, stud, erm} = S.raw, M = pers.map;
  S.colMap = M;
  S.missingCols = FIELDS.filter(f => !(f[0] in M)).map(f => f[1]);
  S.parseIssues = [];
  const get = (row, k) => (k in M ? row[M[k]] : null);
  S.recs = [];
  for (let i = pers.headerRow + 1; i < pers.rows.length; i++) {
    const row = pers.rows[i];
    if (!row || row.every(c => c == null || String(c).trim() === '')) continue;
    const r = {row: i + 1, rawRow: row, problems: []};
    r.pnr = str(get(row, 'pnr')).replace(/\.0+$/, '');
    r.vertretungFuer = str(get(row, 'vertretung')).replace(/\.0+$/, ''); r.name = str(get(row, 'name')); r.vorname = str(get(row, 'vorname'));
    r.kreisRaw = get(row, 'kreis'); r.kreis = str(r.kreisRaw);
    r.tarif = str(get(row, 'tarif')).toUpperCase().replace(/\s/g, '');
    r.vart = str(get(row, 'vart'));
    r.clusterRaw = get(row, 'cluster'); r.cluster = str(r.clusterRaw);
    r.oe = str(get(row, 'oe')); r.labor = str(get(row, 'labor'));
    const dp = parseNum(get(row, 'deputat')); r.deputat = dp.v == null ? null : r2(dp.v); r.deputatErr = dp.err;
    const a = parseNum(get(row, 'arb')), v = parseNum(get(row, 'vz'));
    r.arbErr = a.err; r.vzErr = v.err;
    r.arb = a.v; if (r.arb != null && (a.pct ? false : r.arb <= 1.0001) && r.arb > 0) { r.arb = r.arb * 100; r.arbScaled = true; }
    r.vz = v.v; if (r.vz != null && r.vz > 1.5 && r.vz <= 100) { r.vzWasPct = true; r.vz = r.vz / 100; }
    if (r.vz == null && r.arb != null) { r.vz = r.arb / 100; r.vzDerived = true; }
    const ra = parseNum(get(row, 'ruheanteil')); r.ruheErr = ra.err; r.ruheRaw = ra.v;
    r.ruheVz = ra.v == null ? null : r2(ra.pct || ra.v > 1.5 ? ra.v / 100 : ra.v);   // in VZÄ; Prozentangaben beziehen sich auf eine Vollzeitstelle
    r.arb = r2(r.arb); r.vz = r2(r.vz);
    const b = parseDate(get(row, 'beginn')), e = parseDate(get(row, 'ende'));
    r.beginn = b.v; r.beginnErr = b.err; r.vertragsende = e.v; r.endeErr = e.err; r.endeOpenSentinel = e.open;
    const rst = parseDate(get(row, 'ruhestand')); r.ruhestand = rst.v; r.ruhestandErr = rst.err;
    const ru = parseDate(get(row, 'ruht')); r.ruht = ru.open ? null : ru.v; r.ruhtErr = ru.err; r.ruhtOpen = ru.open;
    const kwRaw = str(get(row, 'kw')).toLowerCase();
    r.kwRaw = kwRaw;
    r.kw = /^(x|ja|j|1|true|wahr|yes|kw|k\.?w\.?)$/.test(kwRaw);
    r.kwUnclear = kwRaw !== '' && !r.kw && !/^(nein|n|0|false|falsch|no|-)$/.test(kwRaw);
    const va = r.vart.toLowerCase();
    r.befr = /unbefr|lebenszeit|dauer|planm/.test(va) ? false : (/befr|zeit|probe|auf zeit/.test(va) ? true : null);
    // Maßgebliches Ausscheiden: das frühere Datum aus Vertragsende (Zeitvertrag) und Ruhestand (unbefristet)
    const endC = [];
    if (r.vertragsende != null) endC.push([r.vertragsende, r.befr === false ? 'Ruhestand' : 'Vertragsende']);   // Altbestand: Datum im Vertragsende eines unbefristeten Vertrags
    if (r.ruhestand != null) endC.push([r.ruhestand, 'Ruhestand']);
    endC.sort((x, y) => x[0] - y[0]);
    r.ende = endC.length ? endC[0][0] : null; r.endType = endC.length ? endC[0][1] : null;
    r.fixedTerm = r.befr === true || (r.befr === null && r.vertragsende != null);   // Zeitvertrag
    r.lvvoRaw = str(get(row, 'lvvo')); r.lvvoSpalte = parseLvvoGruppe(r.lvvoRaw);   // LVVO-Gruppe aus der Tabelle (überschreibt die Ableitung)
    S.recs.push(r);
  }
  // Studierende
  S.students = [];
  if (stud) {
    for (let i = stud.headerRow + 1; i < stud.rows.length; i++) {
      const row = stud.rows[i]; if (!row || row.every(c => c == null || String(c).trim() === '')) continue;
      const cell = k => stud.map[k] != null ? row[stud.map[k]] : null;
      const n = parseNum(cell('n')), cnw = parseNum(cell('cnw')), pl = parseNum(cell('pl'));
      const artRaw = str(cell('art')), al = artRaw.toLowerCase();
      const isB = al.includes('bachelor') || /^(b|ba|bsc|b\.\s?(sc|a|eng|ed)\.?)$/.test(al);
      const isM = al.includes('master') || /^(m|ma|msc|m\.\s?(sc|a|eng|ed)\.?)$/.test(al);
      const art = isB ? 'Bachelor' : isM ? 'Master' : (artRaw ? 'Sonstige' : '');
      S.students.push({row: i + 1, sg: str(cell('sg')), clusterRaw: cell('cl') ?? '', cluster: str(cell('cl')), n: n.v, nErr: n.err,
        artRaw, art, cnw: cnw.v == null ? null : r2(cnw.v), cnwErr: cnw.err, pl: pl.v, plErr: pl.err});
    }
  }
  // Ermäßigungen der Lehrverpflichtung (LVVO)
  S.reductions = [];
  if (erm) {
    for (let i = erm.headerRow + 1; i < erm.rows.length; i++) {
      const row = erm.rows[i]; if (!row || row.every(c => c == null || String(c).trim() === '')) continue;
      const cell = k => erm.map[k] != null ? row[erm.map[k]] : null;
      const lvs = parseNum(cell('lvs')), p = parseNum(cell('pct')), von = parseDate(cell('von')), bis = parseDate(cell('bis'));
      const grundRaw = str(cell('grund'));
      S.reductions.push({row: i + 1, pnr: str(cell('pnr')).replace(/\.0+$/, ''), grundRaw, grund: grundKey(grundRaw),
        lvs: lvs.v == null ? null : r2(lvs.v), lvsErr: lvs.err,
        pct: p.v == null ? null : r2(p.pct || p.v > 1 ? p.v : p.v * 100), pctErr: p.err,   // 0,25 und 25 % bedeuten beide 25 %
        von: von.v, vonErr: von.err, bis: bis.v, bisErr: bis.err});
    }
  }
  normalizeCategories();
  // Kategorien der Mitarbeiterkreise
  const counts = {};
  S.recs.forEach(r => { counts[r.kreis || '(ohne Angabe)'] = (counts[r.kreis || '(ohne Angabe)'] || 0) + 1; });
  for (const k of Object.keys(counts)) if (!(k in S.catMap)) S.catMap[k] = guessCat(k);
  S.kreisCounts = counts;
  orderKreise();
}

export function guessCat(k) {
  const s = k.toLowerCase();
  if (/hilfskr|\bshk\b|\bwhk\b|\bshk|tutor|azubi|auszubild/.test(s)) return 'Sonstige';
  if (/lfba|lehrkr|lehrkraft|besondere aufgaben/.test(s)) return 'LfbA';
  if (/prof/.test(s)) return 'Professor/in';
  if (/wimi|wiss|wissenschaftl/.test(s)) return 'WiMi';
  return 'Sonstige';
}
export function orderKreise() {
  const ks = Object.keys(S.kreisCounts);
  ks.sort((a, b) => CATS.indexOf(S.catMap[a]) - CATS.indexOf(S.catMap[b]) || S.kreisCounts[b] - S.kreisCounts[a] || a.localeCompare(b, 'de'));
  S.kreisOrder = ks;
}
export const kreisOf = r => r.kreis || '(ohne Angabe)';
export const clusterOf = r => r.cluster || '(ohne Cluster)';
export function kreisColor(k) {
  const i = S.kreisOrder.indexOf(k);
  return i >= 0 && i < 8 ? css('--s' + (i + 1)) : css('--muted');
}
export const catColor = c => css('--s' + (CATS.indexOf(c) + 1));

/* Schreibvarianten vereinheitlichen (Groß/Klein, Leerzeichen) */
export function normalizeCategories() {
  for (const field of ['cluster', 'kreis']) {
    const freq = {}, byLow = {};
    const all = S.recs.map(r => r[field]).concat(field === 'cluster' ? S.students.map(s => s.cluster) : []);
    all.forEach(v => { if (v) freq[v] = (freq[v] || 0) + 1; });
    for (const v of Object.keys(freq)) { const l = v.toLowerCase(); if (!byLow[l] || freq[v] > freq[byLow[l]]) byLow[l] = v; }
    const fix = o => { if (o[field] && byLow[o[field].toLowerCase()] !== o[field]) { o[field + 'Case'] = o[field]; o[field] = byLow[o[field].toLowerCase()]; } };
    S.recs.forEach(fix);
    if (field === 'cluster') S.students.forEach(fix);
  }
}
