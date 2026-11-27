// Personen-Detailfenster
import {$, $$, esc, fmtD, nf1, semIdx, semLabel} from '../util.js';
import {S} from '../state.js';
import {clusterOf, kreisColor, kreisOf} from '../parse.js';
import {effDep, effVz, inRestPeriod, isPartlyResting, isResting, restShare, restVz, used} from '../model.js';
import {lvvo, zeitkonto} from '../teaching.js';
import {contractStatus, restJahre} from './detail.js';
import {editPlanItem} from '../plan/form.js';
import {planFind} from '../plan/scenario.js';
import {GS, gsClear} from '../search.js';
import {showTab} from '../main.js';

export function showPerson(rowNo) {
  const r = S.recs.find(x => x.row === rowNo) || (rowNo < 0 ? planFind(rowNo) : null); if (!r) return;
  if (r.plan) { closePerson(); showTab('plan'); editPlanItem(r.plan.id); return; }
  $('#pdOverlay').dataset.row = r.row;
  const T = S.today, st = contractStatus(r), rest = restJahre(r);
  const iss = S.issues.filter(i => i.sheet === 'Personal' && i.row === r.row);
  const others = r.pnr ? used().filter(x => x.pnr === r.pnr && x.row !== r.row) : [];
  const sevLbl = {E: '⛔ Fehler', W: '⚠ Warnung', I: 'ℹ Hinweis'};
  const dl = rows => '<dl class="pd">' + rows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v === '' || v == null ? '<span class="note">–</span>' : v}</dd>`).join('') + '</dl>';
  // Spalten der Excel-Datei, die keinem Feld zugeordnet sind
  const P = S.raw.pers, mapped = new Set(Object.values(S.colMap));
  const extra = (P.rows[P.headerRow] || []).map((h, i) => [h, i]).filter(([h, i]) => !mapped.has(i) && h != null && String(h).trim() !== '' && r.rawRow[i] != null && String(r.rawRow[i]).trim() !== '');
  const semOf = d => d != null ? ` <span class="note">(${semLabel(semIdx(d))})</span>` : '';
  $('#pdTitle').innerHTML = `${esc([r.vorname, r.name].filter(Boolean).join(' ') || '(ohne Namen)')} <span class="note">· Pers.-Nr. ${esc(r.pnr || '–')}</span>`;
  $('#pdBody').innerHTML =
    `<div class="pd-grid">
      <section><h3>Zuordnung</h3>${dl([
        ['Mitarbeiterkreis', `<span class="sw" style="background:${kreisColor(kreisOf(r))}"></span>${esc(kreisOf(r))}`],
        ['Gruppe (Auswertung)', esc(S.catMap[kreisOf(r)])],
        ['Cluster', esc(clusterOf(r))],
        ['Organisationseinheit', esc(r.oe)],
        ['Laborbereich', esc(r.labor)],
      ])}</section>
      <section><h3>Vertrag</h3>${dl([
        ['Status', st.t],
        ['Vertragsart', esc(r.vart)],
        ['Tarifgruppe', esc(r.tarif)],
        ['Beginn', r.beginn == null ? '' : fmtD(r.beginn)],
        ['Vertragsende', r.vertragsende == null ? (r.fixedTerm ? '' : 'unbefristet') : fmtD(r.vertragsende) + semOf(r.vertragsende) + (r.befr === false ? ' <span class="note">(bei unbefristetem Vertrag – als Ruhestand gewertet)</span>' : '')],
        ['Ruhestand (voraussichtlich)', r.ruhestand == null ? '' : fmtD(r.ruhestand) + semOf(r.ruhestand)],
        ['Maßgebliches Ausscheiden', r.ende == null ? '<span class="note">offen</span>' : `<b>${fmtD(r.ende)}</b> <span class="note">(${r.endType})</span>`],
        ['Vertretung für', !r.vertretungFuer ? '' : r.vertretene ? `<a href="#" data-row="${r.vertretene.row}">${esc([r.vertretene.vorname, r.vertretene.name].filter(Boolean).join(' '))}</a> <span class="note">(${esc(r.vertretungFuer)})</span>` : `${esc(r.vertretungFuer)} <span class="sev-E">(nicht gefunden)</span>`],
        ['Vertreten durch', (r.vertreter || []).map(x => `<a href="#" data-row="${x.row}">${esc([x.vorname, x.name].filter(Boolean).join(' '))}</a> <span class="note">(${fmtD(x.beginn)} – ${x.ende == null ? 'offen' : fmtD(x.ende)})</span>`).join('<br>')],
        ['Ruheanteil', r.ruht == null && r.ruheVz == null ? '' : r.ruheVz == null ? 'ganze Stelle' : `${nf1.format(r.ruheVz)} VZÄ` + (r.vz > 0 ? ` <span class="note">(${nf1.format(restShare(r) * 100)} % der Stelle)</span>` : '')],
        ['Ruht bis', r.ruht == null ? '' : `${fmtD(r.ruht)}` + (isResting(r, T) ? ' <span class="note">– derzeit ruhend, nicht als Stelle gezählt</span>' : isPartlyResting(r, T) ? ` <span class="note">– derzeit teilweise ruhend, gezählt werden ${nf1.format(effVz(r, T))} VZÄ</span>` : r.ruht < T ? ' <span class="note">(beendet)</span>' : '')],
        ['Restlaufzeit', rest == null ? '' : `${nf1.format(rest)} Jahre`],
        ['kw-Vermerk', r.kw ? '<span class="pill" style="border-color:var(--s2)">kw – Stelle entfällt nach Vertragsende</span>' : 'nein'],
      ])}</section>
      <section><h3>Umfang</h3>${dl([
        ['Arbeitsanteil', r.arb == null ? '' : nf1.format(r.arb) + ' %'],
        ['VZÄ', r.vz == null ? '' : nf1.format(r.vz) + (r.vzDerived ? ' <span class="note">(aus ArbAnteil abgeleitet)</span>' : '')],
        ['Wirksame VZÄ heute', inRestPeriod(r, T) ? `<b>${nf1.format(effVz(r, T))}</b> <span class="note">(${nf1.format(restVz(r, T))} VZÄ ruhen)</span>` : ''],
        ['Lehrdeputat', r.deputat == null ? '' : `${nf1.format(r.deputat)} SWS je Semester` + (inRestPeriod(r, T) && r.deputat > 0 ? ` <span class="note">– wirksam heute ${nf1.format(effDep(r, T))} SWS</span>` : '') + (r.deputat === 0 ? ' <span class="note">(nur unterstützend in der Lehre)</span>' : '')],
        S.showWip && ['Lehrverpflichtung (LVVO)', (() => { const x = lvvo(r, T); if (x.gruppe.art === 'keine') return x.quelle === 'Spalte' ? 'keine (Spalte „LVVO-Gruppe“)' : '';
          const er = x.erm.map(e => `${esc((x.F.gruende.find(g => g.key === e.grund) || {kurz: e.e.grundRaw || 'Grund unbekannt'}).kurz)} ${nf1.format(e.lvs)}${e.e.text ? ` (${esc(e.e.text)})` : ''}`).join(', ');
          return `${esc(x.gruppe.label)}: ${x.gruppe.art === 'regel' ? `<b>${nf1.format(x.soll)} LVS</b> je Semester (${x.gruppe.lvs} LVS × ${nf1.format(x.anteil)} VZÄ` + (x.ermSum ? ` − Ermäßigungen ${nf1.format(x.ermSum)}: ${er}` : '') + ')'
            : `höchstens ${nf1.format(x.basis)} LVS (${x.gruppe.lvs} LVS × ${nf1.format(x.anteil)} VZÄ)`} <span class="note">${x.gruppe.ref}${x.quelle === 'Spalte' ? ', Gruppe aus Spalte „LVVO-Gruppe“' : ''}${x.annahme ? ' – ' + esc(x.annahme) : ''}</span>`; })()],
      ])}</section>
      <section><h3>Herkunft</h3>${dl([
        ['Tabellenblatt', esc(P.sn)],
        ['Excel-Zeile', String(r.row)],
        ...extra.map(([h, i]) => [esc(h), esc(r.rawRow[i])]),
      ])}</section>
    </div>` +
    (S.showWip ? kontoHtml(r) : '') +
    (iss.length ? `<section><h3>Befunde der Datenprüfung</h3><table>${iss.map(i => `<tr><td><span class="pill sev-${i.sev}">${sevLbl[i.sev]}</span></td><td>${esc(i.field)}</td><td>${esc(i.msg)}</td></tr>`).join('')}</table></section>` : '') +
    (others.length ? `<section><h3>Weitere Verträge mit derselben Personalnummer</h3><table><tr><th>Zeile</th><th>Name</th><th>Mitarbeiterkreis</th><th>Cluster</th><th class="n">VZÄ</th><th>Beginn</th><th>Ausscheiden</th><th>Status</th></tr>${others.map(o => `<tr class="click" data-row="${o.row}"><td>${o.row}</td><td>${esc([o.name, o.vorname].filter(Boolean).join(', '))}</td><td>${esc(kreisOf(o))}</td><td>${esc(clusterOf(o))}</td><td class="n">${o.vz == null ? '–' : nf1.format(o.vz)}</td><td>${fmtD(o.beginn)}</td><td>${o.ende == null ? 'unbefristet' : fmtD(o.ende)}</td><td>${contractStatus(o).t}</td></tr>`).join('')}</table></section>` : '');
  $$('#pdBody [data-row]').forEach(el => el.onclick = e => { e.preventDefault(); showPerson(+el.dataset.row); });
  $('#pdOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  $('#pdClose').focus();
}
export function closePerson() {
  $('#pdOverlay').classList.add('hidden'); document.body.style.overflow = ''; $('#pdBody').innerHTML = '';
  if (GS.fromSearch) { GS.fromSearch = false; gsClear(); }   // aus der Suche geöffnet: Suchfeld beim Schließen leeren
}

/* Zeitkonto der Person über alle Semester mit Einträgen im Blatt „Lehre“ (§ 11) */
function kontoHtml(r) {
  const k = zeitkonto(r); if (!k) return '';
  const n = v => nf1.format(v), sg = v => v == null ? '<span class="note">–</span>' : `<span class="${v < 0 ? 'down' : 'up'}">${v < 0 ? '−' : v > 0 ? '+' : ''}${n(Math.abs(v))}</span>`;
  const regel = k.semester.some(e => e.ende != null);
  const lv = e => e.zeilen.map(t => `${esc(t.titel || t.artRaw || '–')} <span class="note">${esc(t.artRaw)}${t.sws != null ? ', ' + n(t.sws) + ' SWS' : ''}${t.anteil !== 1 ? ', ' + n(t.anteil * 100) + ' %' : ''}${t.anzahl !== 1 ? ', ' + n(t.anzahl) + '×' : ''} → ${n(t.lvs)}</span>`).join('<br>');
  return `<section><h3>Gehaltene Lehre und Zeitkonto</h3><table><tr><th>Semester</th><th class="n">Soll</th><th class="n">Gehalten</th><th class="n">Saldo</th>${regel ? '<th class="n">Konto Ende</th>' : ''}<th>Lehrveranstaltungen (LVS)</th></tr>` +
    k.semester.map(e => `<tr><td>${semLabel(e.sem)}</td><td class="n">${n(e.soll)}</td><td class="n">${n(e.ist)}</td><td class="n">${sg(e.saldo)}</td>` +
      (regel ? `<td class="n">${sg(e.ende)}${e.verfallen ? `<div class="note">${n(e.verfallen)} verfallen</div>` : ''}${e.fehlbetragZuHoch ? '<div class="pill sev-W">Fehlbetrag zu hoch</div>' : ''}</td>` : '') +
      `<td>${e.ohneEintrag ? '<span class="pill sev-W">keine Lehre eingetragen</span>' : lv(e)}</td></tr>`).join('') + '</table>' +
    (regel ? `<p class="note">Zeitkonto nach § 11 Abs. 3: Guthaben über dem Zweifachen der Regellehrverpflichtung verfällt am Semesterende.</p>` : '<p class="note">Ohne Regellehrverpflichtung wird kein Zeitkonto geführt; Soll = festgelegtes Deputat.</p>') + '</section>';
}
