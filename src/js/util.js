// Hilfsfunktionen: DOM-Kurzformen, Datum, Zahlenformate, Rundung, Semester
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const DAY = 864e5;
export const pad = n => String(n).padStart(2, '0');
export const toDay = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY);
export const fromDay = n => { const d = new Date(n * DAY); return {y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate()}; };
export const fmtD = n => { if (n == null) return '–'; const o = fromDay(n); return `${pad(o.d)}.${pad(o.m)}.${o.y}`; };
export const isoD = n => { const o = fromDay(n); return `${o.y}-${pad(o.m)}-${pad(o.d)}`; };
export const parseIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? toDay(+m[1], +m[2], +m[3]) : null; };
export const nf0 = new Intl.NumberFormat('de-DE', {maximumFractionDigits: 0});
/* Alle Berechnungen werden auf zwei Nachkommastellen gerundet und mit zwei Nachkommastellen angezeigt */
export const r2 = x => x == null || !isFinite(x) ? x : Math.round((x + Math.sign(x) * Number.EPSILON) * 100) / 100;
export const nf1 = new Intl.NumberFormat('de-DE', {maximumFractionDigits: 2, minimumFractionDigits: 2});
export const nf2 = nf1;
export const sumBy = (list, f) => r2(list.reduce((t, x) => t + (f(x) || 0), 0));
export const pct = (a, b) => b ? r2(a / b * 100) : 0;
export const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/* Semester: WS = 01.09.–28./29.02., SS = 01.03.–31.08.  Index: SS j → 2j, WS j/j+1 → 2j+1 */
export const semIdx = n => { const {y, m} = fromDay(n); return m >= 9 ? y * 2 + 1 : (m <= 2 ? (y - 1) * 2 + 1 : y * 2); };
export const semStart = i => { const y = Math.floor(i / 2); return i % 2 ? toDay(y, 9, 1) : toDay(y, 3, 1); };
export const semEnd = i => semStart(i + 1) - 1;
export const semLabel = i => { const y = Math.floor(i / 2); return i % 2 ? `WS ${y}/${pad((y + 1) % 100)}` : `SS ${y}`; };
/** Semesterangabe lesen: „WS 2026/27“, „Wintersemester 2026/2027“, „WiSe 26/27“, „SS 2027“, „SoSe 27“, „Sommersemester 2027“.
 *  Rückgabe: Semesterindex wie semIdx, oder null. */
export function parseSemester(v) {
  if (typeof v === 'number' && isFinite(v)) return null;
  const s = String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const year = t => { const y = +t; return t.length <= 2 ? 2000 + y : y; };
  let m = /^(ws|wise|wintersemester|w)\.? ?(\d{2}|\d{4})(?: ?[/-] ?(\d{2}|\d{4}))?$/.exec(s);
  if (m) {
    const y = year(m[2]);
    if (m[3] != null && (year(m[3]) % 100) !== ((y + 1) % 100)) return null;   // z. B. „WS 2026/28“
    return y * 2 + 1;
  }
  m = /^(ss|sose|sommersemester|s)\.? ?(\d{2}|\d{4})$/.exec(s);
  return m ? year(m[2]) * 2 : null;
}
