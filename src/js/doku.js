// Dokumentation der Lehrverpflichtung nach § 18 LVVO: Daten je Studienjahr und druckfertiger Bericht (HTML)
//
// § 18 LVVO: Die Fakultät dokumentiert für jede Lehrperson nachvollziehbar, dass die Lehrverpflichtung erfüllt wird.
// Anzugeben sind Ermäßigungen und Freistellungen (§§ 7 bis 9 und 16) und eine Befreiung (§ 12); darzulegen ist,
// wie Lehrveranstaltungen und Betreuungstätigkeiten (§§ 13 und 15) berücksichtigt wurden. Die Dokumentation wird
// nach Abschluss des Studienjahres dem Präsidium vorgelegt. (§ 17 gilt nur für Universitäten.)
// Studienjahr hier: Wintersemester und folgendes Sommersemester (1.9. bis 31.8.).
import {esc, fmtD, nf2, r2, semEnd, semIdx, semLabel, semStart, sumBy} from './util.js';
import {S} from './state.js';
import {lvvoFassung} from './lvvo.js';
import {clusterOf} from './parse.js';
import {usedBase} from './model.js';
import {lehreIst, lvvo, lvvoGruppe, zeitkonto} from './teaching.js';

/** Erstes Semester (WS) des Studienjahres, in dem s liegt. */
export const sjStart = s => s % 2 ? s : s - 1;
/** „2025/26“ für das Studienjahr ab WS 2025/26. */
export const sjLabel = w => { const y = Math.floor(w / 2); return `${y}/${String((y + 1) % 100).padStart(2, '0')}`; };

/** Studienjahre zur Auswahl: alle mit Einträgen im Blatt „Lehre“ und das laufende; neuestes zuerst. */
export function studienjahre() {
  const ws = new Set([sjStart(semIdx(S.today))]);
  for (const t of S.teaching || []) if (t.ok) ws.add(sjStart(t.sem));
  return [...ws].sort((a, b) => b - a);
}

// Befunde der Datenprüfung, die zur Lehrverpflichtung gehören
const BEFUND = /^(LVVO|Deputat|Ermäßigung|Lehre|Zeitkonto|Betreuung|Lehrperson ohne Deputat)/;

/** Daten der Dokumentation für das Studienjahr ab WS w, optional nur ein Cluster. */
export function dokuDaten(w, {cluster = null} = {}) {
  const sems = [w, w + 1], von = semStart(w), bis = semEnd(w + 1);
  const F = lvvoFassung(von);
  const overlaps = (a, b, x, y) => (a == null || a <= y) && (b == null || b >= x);
  const mitLehre = new Set((S.teaching || []).filter(t => t.ok && sems.includes(t.sem)).map(t => t.pk));
  const gesehen = new Set(), personen = [];
  for (const r of usedBase()) {
    if (cluster && clusterOf(r) !== cluster) continue;
    if (!overlaps(r.beginn, r.ende, von, bis)) continue;
    const gr = lvvoGruppe(r), g = F.gruppen[gr.key];
    if (g.art === 'keine' && !mitLehre.has(r.pk)) continue;
    const zweit = gesehen.has(r.pk); gesehen.add(r.pk);
    const k = zweit ? null : zeitkonto(r);   // Lehre und Konto gehören zur Personalnummer: nur beim ersten Vertrag zeigen
    const semester = sems.map(s => {
      const D = semStart(s), imVertrag = overlaps(r.beginn, r.ende, D, semEnd(s));
      const x = lvvo(r, D), L = zweit ? {ist: 0, lehre: 0, betreuung: 0, betreuungRoh: 0, betreuungGekappt: false, uebertrag: 0, zeilen: []} : lehreIst(r, s);
      const e = k ? k.semester.find(q => q.sem === s) || null : null;
      const soll = x.gruppe.art === 'regel' ? x.soll : (x.soll ?? 0);
      const hinweise = [];
      if (imVertrag && soll > 0 && !L.zeilen.filter(t => !(F.lehrarten.find(a => a.key === t.art) || {}).uebertrag).length) hinweise.push('keine Lehre erfasst');
      if (e && e.unterHaelfte && L.zeilen.length) hinweise.push('weniger als die Hälfte des Solls (§ 11)');
      if (e && e.fehlbetragZuHoch) hinweise.push('Fehlbetrag über der Regellehrverpflichtung (§ 11 Abs. 3)');
      if (e && e.verfallen) hinweise.push(`${nf2.format(e.verfallen)} LVS Guthaben verfallen (§ 11 Abs. 3)`);
      if (L.betreuungGekappt) hinweise.push(`Betreuung ${nf2.format(L.betreuungRoh)} LVS, angerechnet ${nf2.format(L.betreuung)} LVS (§ 15)`);
      if (x.gruppe.art === 'hoechst' && soll > x.basis + 0.005) hinweise.push('Deputat über der Höchstlehrverpflichtung (§ 5 Abs. 2)');
      if (!imVertrag) hinweise.push('kein Vertrag in diesem Semester');
      return {sem: s, label: semLabel(s), imVertrag, x, soll, L, konto: e, hinweise,
        saldo: r2(L.ist - soll)};
    });
    const ermaessigungen = (S.reductions || []).filter(e => e.pk === r.pk && !e.lvsErr && !e.pctErr && !e.vonErr && !e.bisErr && (e.lvs != null || e.pct != null) && overlaps(e.von, e.bis, von, bis))
      .map(e => ({e, grund: F.gruende.find(q => q.key === e.grund) || null}));
    const befunde = zweit ? [] : S.issues.filter(i => i.pk === r.pk && BEFUND.test(i.check));
    personen.push({r, gruppe: g, gruppeQuelle: gr.quelle, annahme: gr.annahme, cluster: clusterOf(r), semester, ermaessigungen, befunde, weitererVertrag: zweit,
      soll: sumBy(semester, q => q.soll), ist: sumBy(semester, q => q.L.ist), saldo: sumBy(semester, q => q.saldo),
      kontoEnde: semester[1].konto ? semester[1].konto.ende : semester[0].konto ? semester[0].konto.ende : null,
      befreiung: ermaessigungen.some(q => q.grund && q.grund.key === 'befreiung'),
      auffaellig: semester.some(q => q.hinweise.length && q.imVertrag) || befunde.some(i => i.sev !== 'I')});
  }
  const ord = Object.keys(F.gruppen);
  personen.sort((a, b) => a.cluster.localeCompare(b.cluster, 'de') || ord.indexOf(lvvoGruppe(a.r).key) - ord.indexOf(lvvoGruppe(b.r).key) || a.r.name.localeCompare(b.r.name, 'de') || a.r.vorname.localeCompare(b.r.vorname, 'de'));
  // Ermäßigungen nach Grund, wie im jeweiligen Semester angerechnet
  const grundSummen = {};
  for (const p of personen) for (const q of p.semester) for (const e of q.x.erm) {
    const key = e.grund || 'unbekannt';
    (grundSummen[key] = grundSummen[key] || [0, 0])[q.sem - w] = r2((grundSummen[key][q.sem - w] || 0) + e.lvs);
  }
  return {w, sems, von, bis, F, cluster, personen, grundSummen,
    summen: sems.map((s, i) => ({sem: s, soll: sumBy(personen, p => p.semester[i].soll), ist: sumBy(personen, p => p.semester[i].L.ist), saldo: sumBy(personen, p => p.semester[i].saldo)})),
    mitLehre: personen.filter(p => p.semester.some(q => q.L.zeilen.length)).length,
    auffaellig: personen.filter(p => p.auffaellig).length};
}

/* ---------- Bericht ---------- */

/** Stile des Berichts – im Programm (Vorschau, Druck) und in der gespeicherten HTML-Datei gleich. */
export const DOKU_CSS = `
.doku{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;font-size:11pt;line-height:1.4;max-width:190mm;margin:0 auto;background:#fff}
.doku h1{font-size:17pt;margin:0 0 4pt}.doku h2{font-size:13pt;margin:16pt 0 4pt}.doku h3{font-size:11pt;margin:10pt 0 3pt}
.doku .meta{color:#444;font-size:9.5pt;margin:0 0 8pt}.doku .note{color:#555;font-size:9pt}
.doku table{border-collapse:collapse;width:100%;margin:3pt 0 6pt;font-size:9.5pt}
.doku th,.doku td{border-bottom:1px solid #ccc;padding:2.5pt 4pt;text-align:left;vertical-align:top}
.doku th{border-bottom:1.5px solid #333;font-weight:600}.doku td.n,.doku th.n{text-align:right;white-space:nowrap}
.doku tr.sum td{font-weight:700;border-top:1.5px solid #333}
.doku .person{break-inside:avoid-page;margin-top:14pt;padding-top:6pt;border-top:2px solid #333}
.doku.seite .person{break-before:page;border-top:0;margin-top:0;padding-top:0}
.doku dl{display:grid;grid-template-columns:44mm 1fr;gap:1pt 8pt;margin:4pt 0;font-size:10pt}.doku dt{color:#444}.doku dd{margin:0}
.doku .w{color:#9a5b00}.doku .e{color:#b3261e}.doku .ok{color:#1b6e3a}
.doku .sign{display:grid;grid-template-columns:1fr 1fr;gap:16mm;margin-top:22mm;font-size:9.5pt}.doku .sign div{border-top:1px solid #333;padding-top:2pt}
@page{size:A4;margin:16mm 14mm}
`;

const dkNum = v => v == null ? '–' : nf2.format(v);
const dkSig = v => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + nf2.format(Math.abs(v));

/** Bericht als HTML-Fragment (Wurzel: div.doku). opts: seiteJePerson (Seitenumbruch je Lehrperson), erstellt (Text), fakultaet. */
export function dokuHtml(d, {seiteJePerson = true, erstellt = '', fakultaet = 'Fakultät IuI'} = {}) {
  const F = d.F, [ws, ss] = d.sems, lbl = q => esc(q.label);
  const grundLbl = k => { const g = F.gruende.find(q => q.key === k); return g ? `${esc(g.label)} <span class="note">(${g.ref})</span>` : 'Grund nicht erkannt'; };
  const kopf = `<h1>Dokumentation der Lehrverpflichtung nach § 18 LVVO</h1>
    <p class="meta">${esc(fakultaet)}${d.cluster ? ' · Cluster ' + esc(d.cluster) : ''} · Studienjahr ${sjLabel(d.w)} (${semLabel(ws)} und ${semLabel(ss)}, ${fmtD(d.von)}–${fmtD(d.bis)})<br>
    Rechtsgrundlage: ${esc(F.titel)}, ${esc(F.fassung)}${erstellt ? ' · erstellt ' + esc(erstellt) : ''}</p>`;
  // Übersicht
  const ueb = `<h2>Übersicht</h2>
    <p>${d.personen.length} Lehrpersonen, davon ${d.mitLehre} mit erfasster Lehre; ${d.auffaellig ? `<span class="w">${d.auffaellig} mit Hinweisen</span>` : 'keine mit Hinweisen'}.</p>
    <table><tr><th>Name</th><th>Cluster</th><th>Gruppe</th><th class="n">Soll<br>${semLabel(ws)}</th><th class="n">Ist<br>${semLabel(ws)}</th><th class="n">Soll<br>${semLabel(ss)}</th><th class="n">Ist<br>${semLabel(ss)}</th><th class="n">Saldo</th><th class="n">Zeit&shy;konto</th><th></th></tr>
    ${d.personen.map(p => `<tr><td>${esc([p.r.name, p.r.vorname].filter(Boolean).join(', '))}${p.weitererVertrag ? ' <span class="note">(weiterer Vertrag)</span>' : ''}</td><td>${esc(p.cluster)}</td><td>${esc(p.gruppe.label)}</td>
      <td class="n">${dkNum(p.semester[0].soll)}</td><td class="n">${dkNum(p.semester[0].L.ist)}</td><td class="n">${dkNum(p.semester[1].soll)}</td><td class="n">${dkNum(p.semester[1].L.ist)}</td>
      <td class="n">${dkSig(p.saldo)}</td><td class="n">${p.kontoEnde == null ? '–' : dkSig(p.kontoEnde)}</td><td>${p.auffaellig ? '<span class="w" title="Hinweise im Einzelnachweis">⚠</span>' : p.semester.some(q => q.L.zeilen.length) ? '<span class="ok">✓</span>' : ''}</td></tr>`).join('')}
    <tr class="sum"><td>Summe</td><td></td><td></td><td class="n">${dkNum(d.summen[0].soll)}</td><td class="n">${dkNum(d.summen[0].ist)}</td><td class="n">${dkNum(d.summen[1].soll)}</td><td class="n">${dkNum(d.summen[1].ist)}</td><td class="n">${dkSig(r2(d.summen[0].saldo + d.summen[1].saldo))}</td><td></td><td></td></tr></table>
    <p class="note">LVS je Semester. Soll: Regellehrverpflichtung nach § 5 Abs. 1, anteilig nach VZÄ, abzüglich Ermäßigungen, jeweils am Semesterbeginn; bei WiMi das festgelegte Deputat (Höchstlehrverpflichtung nach § 5 Abs. 2). Ist: angerechnete Lehre nach §§ 13–15. Zeitkonto: Stand am Ende des Studienjahres (§ 11 Abs. 3). ⚠ = Hinweise im Einzelnachweis, ✓ = Lehre erfasst und ohne Hinweise.</p>`;
  const gr = Object.entries(d.grundSummen);
  const ermUeb = `<h3>Ermäßigungen und Freistellungen nach Grund</h3>` + (!gr.length ? '<p>Keine.</p>' :
    `<table><tr><th>Grund</th><th class="n">${semLabel(ws)}</th><th class="n">${semLabel(ss)}</th></tr>${gr.map(([k, v]) => `<tr><td>${grundLbl(k)}</td><td class="n">${dkNum(v[0] || 0)}</td><td class="n">${dkNum(v[1] || 0)}</td></tr>`).join('')}</table>`);
  // Einzelnachweise
  const person = p => {
    const r = p.r;
    const stamm = `<dl><dt>Personalnummer</dt><dd>${esc(r.pnr)}</dd><dt>Mitarbeiterkreis</dt><dd>${esc(r.kreis)}${r.tarif ? ' · ' + esc(r.tarif) : ''}</dd>
      <dt>Cluster / OE</dt><dd>${esc(p.cluster)}${r.oe ? ' · ' + esc(r.oe) : ''}</dd><dt>Vertrag</dt><dd>${r.beginn != null ? fmtD(r.beginn) : 'ohne Beginn'} – ${r.ende != null ? fmtD(r.ende) : 'unbefristet'} · ${dkNum(r.vz)} VZÄ${r.ruht != null ? ` · ruht ${r.ruheVz != null ? 'teilweise ' : ''}bis ${fmtD(r.ruht)}` : ''}</dd>
      <dt>Gruppe nach LVVO</dt><dd>${esc(p.gruppe.label)}: ${p.gruppe.art === 'regel' ? `Regellehrverpflichtung ${p.gruppe.lvs} LVS` : p.gruppe.art === 'hoechst' ? `Höchstlehrverpflichtung ${p.gruppe.lvs} LVS` : 'keine Lehrverpflichtung'} (${p.gruppe.ref})${p.gruppeQuelle === 'Spalte' ? ' – laut Tabelle' : ''}${p.annahme ? ` – <span class="w">${esc(p.annahme)}</span>` : ''}</dd></dl>`;
    const erm = p.ermaessigungen.length ? `<h3>Ermäßigungen, Freistellungen, Befreiung</h3><table><tr><th>Grund</th><th>Rechtsgrundlage</th><th class="n">Umfang</th><th>Zeitraum</th></tr>` +
      p.ermaessigungen.map(({e, grund}) => `<tr><td>${esc(e.grundRaw || '–')}</td><td>${grund ? esc(grund.ref) : '<span class="w">nicht zugeordnet</span>'}</td><td class="n">${e.lvs != null ? dkNum(e.lvs) + ' LVS' : dkNum(e.pct) + ' %'}</td><td>${e.von != null ? fmtD(e.von) : 'offen'} – ${e.bis != null ? fmtD(e.bis) : 'offen'}</td></tr>`).join('') + '</table>' : '';
    const sem = q => {
      const x = q.x, zeilen = q.L.zeilen;
      const art = t => F.lehrarten.find(a => a.key === t.art) || {};
      const lv = zeilen.length ? `<table><tr><th>Lehrveranstaltung</th><th>Art</th><th class="n">SWS</th><th class="n">Faktor</th><th class="n">Anteil</th><th class="n">Anzahl</th><th class="n">LVS</th><th>Grundlage</th></tr>` +
        zeilen.map(t => `<tr><td>${esc(t.titel || '–')}</td><td>${esc(t.artRaw || '–')}</td><td class="n">${t.sws == null ? '–' : dkNum(t.sws)}</td><td class="n">${t.lvsEin != null ? '–' : dkNum(t.faktor)}</td><td class="n">${t.anteil === 1 ? '' : dkNum(t.anteil * 100) + ' %'}</td><td class="n">${t.anzahl === 1 ? '' : dkNum(t.anzahl) + '×'}</td><td class="n">${dkNum(t.lvs)}</td>` +
          `<td class="note">${t.lvsEin != null ? 'LVS eingetragen' : art(t).uebertrag ? 'Übertrag, § 11 Abs. 3' : t.nichtAnwesend ? '§ 14 Abs. 2' : esc(art(t).ref || 'Art nicht erkannt, Faktor 1')}${t.anteil !== 1 ? ', § 14 Abs. 3' : ''}${t.anzahl !== 1 ? ', § 13 Abs. 5' : ''}</td></tr>`).join('') + '</table>'
        : `<p class="note">${q.imVertrag && q.soll > 0 ? '<span class="w">Keine Lehre erfasst.</span>' : 'Keine Lehre erfasst.'}</p>`;
      const erml = x.erm.length ? x.erm.map(e => `${esc((F.gruende.find(g => g.key === e.grund) || {kurz: e.e.grundRaw}).kurz)} ${dkNum(e.lvs)}`).join(', ') : '';
      const rechnung = x.gruppe.art === 'regel' ? `${x.gruppe.lvs} LVS × ${dkNum(x.anteil)} VZÄ = ${dkNum(x.basis)} LVS${x.ermSum ? ` − Ermäßigungen ${dkNum(x.ermSum)} LVS (${erml})` : ''} = <b>${dkNum(q.soll)} LVS</b>`
        : x.gruppe.art === 'hoechst' ? `festgelegtes Deputat <b>${dkNum(q.soll)} LVS</b> (höchstens ${x.gruppe.lvs} LVS × ${dkNum(x.anteil)} VZÄ = ${dkNum(x.basis)} LVS)` : 'keine Lehrverpflichtung';
      const k = q.konto;
      return `<h3>${lbl(q)}</h3><dl><dt>Soll</dt><dd>${rechnung}</dd>
        <dt>Ist</dt><dd>Lehre ${dkNum(q.L.lehre)} LVS${q.L.betreuungRoh ? ` + Betreuung ${dkNum(q.L.betreuung)} LVS${q.L.betreuungGekappt ? ` (von ${dkNum(q.L.betreuungRoh)}, höchstens ${F.betreuungMax.lvs} LVS nach § 15)` : ''}` : ''} = <b>${dkNum(q.L.ist)} LVS</b> · Saldo ${dkSig(q.saldo)} LVS</dd>
        ${k && k.ende != null ? `<dt>Zeitkonto (§ 11 Abs. 3)</dt><dd>Anfang ${dkSig(k.anfang)}${k.uebertrag ? ` (inkl. Übertrag ${dkNum(k.uebertrag)})` : ''} · Ende ${dkSig(k.ende)} LVS${k.verfallen ? ` · ${dkNum(k.verfallen)} LVS verfallen (Kappung ${dkNum(k.kappung)})` : ''}</dd>` : ''}
        ${q.hinweise.length ? `<dt>Hinweise</dt><dd class="w">${q.hinweise.map(esc).join('; ')}</dd>` : ''}</dl>${lv}`;
    };
    const bef = p.befunde.length ? `<h3>Befunde der Datenprüfung <span class="note">(Stand ${fmtD(S.today)})</span></h3><ul>${p.befunde.map(i => `<li class="${i.sev === 'E' ? 'e' : i.sev === 'W' ? 'w' : ''}">${esc(i.check)}: ${esc(i.msg)}</li>`).join('')}</ul>` : '';
    return `<section class="person"><h2>${esc([r.vorname, r.name].filter(Boolean).join(' '))}${p.weitererVertrag ? ' <span class="note">(weiterer Vertrag; Lehre siehe ersten Vertrag)</span>' : ''}</h2>${stamm}${erm}${p.semester.map(sem).join('')}${bef}</section>`;
  };
  const unterschrift = `<div class="sign"><div>Ort, Datum</div><div>Für das Dekanat</div></div>`;
  return `<div class="doku${seiteJePerson ? ' seite' : ''}">${kopf}${ueb}${ermUeb}${unterschrift}${d.personen.map(person).join('')}</div>`;
}

/** Eigenständige HTML-Datei (ohne Skripte und ohne Netzwerkzugriff) zum Speichern oder Weitergeben. */
export function dokuDatei(d, opts = {}) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dokumentation Lehrverpflichtung § 18 LVVO – Studienjahr ${sjLabel(d.w)}</title>
<style>body{margin:12mm;background:#fff}${DOKU_CSS}</style></head><body>${dokuHtml(d, opts)}</body></html>`;
}
