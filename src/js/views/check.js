// Ansicht Datenprüfung
import {$, $$, esc, nf0} from '../util.js';
import {S} from '../state.js';
import {ERM_FIELDS, FIELDS, LEHRE_FIELDS, OPTIONAL_COLS} from '../parse.js';
import {used} from '../model.js';

export function renderCheck() {
  const I = S.issues, n = s => I.filter(i => i.sev === s).length;
  const rowsWithErr = new Set(I.filter(i => i.sev === 'E' && i.row && i.sheet === 'Personal').map(i => i.row)).size;
  $('#errBadge').textContent = n('E') || ''; $('#errBadge').style.display = n('E') ? '' : 'none';
  $('#checkKpis').innerHTML = [
    ['Datensätze Personal', nf0.format(S.recs.length), `${nf0.format(used().length)} ausgewertet`],
    ['Studiengänge', nf0.format(S.students.length), `${nf0.format(S.students.reduce((a, s) => a + (s.n || 0), 0))} Studierende`],
    ['⛔ Fehler', nf0.format(n('E')), `in ${rowsWithErr} Personalzeilen`],
    ['⚠ Warnungen', nf0.format(n('W')), 'bitte prüfen'],
    ['ℹ Hinweise', nf0.format(n('I')), 'informativ'],
  ].map(([l, v, d]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
  const P = S.raw.pers;
  $('#colInfo').innerHTML = `Personalblatt: <b>${esc(P.sn)}</b> (Überschriften in Zeile ${P.headerRow + 1}) · Studierendenblatt: <b>${S.raw.stud ? esc(S.raw.stud.sn) : '— nicht gefunden'}</b>` +
    (S.missingCols.filter(c => !OPTIONAL_COLS.includes(c)).length ? ` · <span class="sev-E">Nicht gefundene Spalten: ${S.missingCols.filter(c => !OPTIONAL_COLS.includes(c)).map(esc).join(', ')}</span>` : ` · alle ${FIELDS.length - S.missingCols.length} Spalten erkannt`) +
    S.missingCols.filter(c => OPTIONAL_COLS.includes(c)).map(c => ` · ohne Spalte „${c}“ (optional)`).join('') +
    [['erm', 'Ermäßigungen', ERM_FIELDS], ['lehre', 'Lehre', LEHRE_FIELDS]].map(([k, lbl, fields]) => { const t = S.raw[k];
      return t ? `<br>${lbl}: <b>${esc(t.sn)}</b> (Überschriften in Zeile ${t.headerRow + 1}; erkannt: ${fields.filter(f => f[0] in t.map).map(f => esc(f[1])).join(', ')})` : ''; }).join('');
  // Zusammenfassung je Prüfung
  const groups = {};
  I.forEach(i => { const k = i.sev + '\u0000' + i.check; groups[k] = groups[k] || {sev: i.sev, check: i.check, n: 0}; groups[k].n++; });
  const sevLbl = {E: '⛔ Fehler', W: '⚠ Warnung', I: 'ℹ Hinweis'};
  const gs = Object.values(groups);
  $('#issueSummary').innerHTML = gs.length ? '<tr><th>Schwere</th><th>Prüfung</th><th class="n">Befunde</th></tr>' + gs.map(g =>
    `<tr class="click sumrow ${S.checkFilter === g.check ? 'sel' : ''}" data-check="${esc(g.check)}"><td><span class="pill sev-${g.sev}">${sevLbl[g.sev]}</span></td><td>${esc(g.check)}</td><td class="n">${g.n}</td></tr>`).join('')
    : '<tr><td>✅ Keine Auffälligkeiten gefunden.</td></tr>';
  $$('#issueSummary tr[data-check]').forEach(tr => tr.onclick = () => { S.checkFilter = S.checkFilter === tr.dataset.check ? null : tr.dataset.check; renderCheck(); });
  const F = I.filter(i => (S.sevFilter === 'all' || i.sev === S.sevFilter) && (!S.checkFilter || i.check === S.checkFilter));
  $('#issueFilterLbl').textContent = `(${F.length}${S.checkFilter ? ' · ' + S.checkFilter : ''})`;
  $('#clearIssueFilter').classList.toggle('hidden', !S.checkFilter);
  $('#issueTable').innerHTML = '<tr><th>Schwere</th><th>Blatt</th><th class="n">Zeile</th><th>Pers.-Nr.</th><th>Person / Studiengang</th><th>Feld</th><th>Befund</th></tr>' +
    F.slice(0, 2000).map(i => `<tr><td><span class="pill sev-${i.sev}">${sevLbl[i.sev]}</span></td><td>${i.row ? esc(i.sheet) : ''}</td><td class="n">${i.row ?? ''}</td><td>${esc(i.pnr)}</td><td>${esc(i.person)}</td><td>${esc(i.field)}</td><td>${esc(i.msg)}</td></tr>`).join('');
}
