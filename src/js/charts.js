// Diagramme (Chart.js) und PNG-Export
import {css, esc, fmtD, isoD, toDay} from './util.js';
import {S} from './state.js';
import {PLAN} from './plan/scenario.js';

export const charts = {};
export const endLabels = {
  id: 'endLabels',
  afterDatasetsDraw(c, _a, opts) {
    if (!opts || !opts.enabled) return;
    const ctx = c.ctx; ctx.save(); ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = css('--text-secondary');
    c.data.datasets.forEach((ds, i) => {
      const m = c.getDatasetMeta(i); if (m.hidden || (opts.only && !opts.only(ds, i))) return;
      m.data.forEach((el, j) => {
        const v = ds.data[j]; if (v == null || !isFinite(v) || v === 0) return;
        const t = opts.fmt(v);
        if (c.options.indexAxis === 'y') { ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(t, el.x + 4, el.y); }
        else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(t, el.x, el.y - 3); }
      });
    });
    ctx.restore();
  }
};
export function chartDefaults() {
  Chart.defaults.font.family = 'system-ui,-apple-system,"Segoe UI",sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.locale = 'de-DE';
  Chart.defaults.color = css('--text-secondary');
  Chart.defaults.borderColor = css('--grid');
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = css('--text-primary');
  Chart.defaults.plugins.tooltip.titleColor = css('--surface');
  Chart.defaults.plugins.tooltip.bodyColor = css('--surface');
  Chart.defaults.plugins.tooltip.padding = 8;
  Chart.defaults.plugins.tooltip.boxPadding = 4;
  Chart.defaults.animation = false;
  Chart.defaults.maintainAspectRatio = false;
}
export function mkChart(id, cfg) {
  if (charts[id]) charts[id].destroy();
  const el = document.getElementById(id); if (!el) return;
  charts[id] = new Chart(el, cfg);
  addPngButton(el, id);
  return charts[id];
}
/* ---------- Diagramm als PNG speichern ---------- */
export function addPngButton(canvas, id) {
  const box = canvas.parentElement; if (!box || box.querySelector(':scope > .png-btn')) return;
  const b = document.createElement('button');
  b.className = 'png-btn'; b.type = 'button'; b.textContent = '⤓ PNG'; b.title = 'Diagramm als Bild (PNG) speichern';
  b.onclick = e => { e.stopPropagation(); exportChartPng(id); };
  box.appendChild(b);
}
export function chartContext(canvas) {
  const card = canvas.closest('.m') || canvas.closest('.card');
  const h = card && (card.querySelector('h3') || card.querySelector('h2'));
  let title = '';
  if (h) { const c = h.cloneNode(true); c.querySelectorAll('select').forEach(sel => { const o = sel.options[sel.selectedIndex]; sel.replaceWith(document.createTextNode(o ? o.textContent : '')); });
    c.querySelectorAll('.pill, .note').forEach(x => x.remove()); title = c.textContent.replace(/\s+/g, ' ').trim(); }
  // Zugehörige Legende: die letzte .legend vor dem Diagramm in derselben Karte
  let legend = null;
  if (card) { const all = [...card.querySelectorAll('.legend')]; legend = all.filter(l => l.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING).pop() || null; }
  const items = legend ? [...legend.querySelectorAll(':scope > span')].map(sp => { const i = sp.querySelector('i'); const st = i ? getComputedStyle(i) : null;
    return {text: sp.textContent.trim(), color: st ? (st.backgroundImage !== 'none' ? st.borderTopColor || '#999' : st.backgroundColor) : '#999', dashed: st && st.borderTopStyle === 'dashed'}; }) : [];
  // Filter und Einstellungen der Karte (Auswahlfelder) für die Quellenzeile
  const filters = card ? [...card.querySelectorAll('select')].filter(sel => !(h && h.contains(sel))).map(sel => { const lab = sel.closest('label'); const o = sel.options[sel.selectedIndex];
    const name = lab ? lab.childNodes[0].textContent.trim() : ''; return o && o.value !== '' ? (name ? name + ': ' : '') + o.textContent.trim() : ''; }).filter(Boolean) : [];
  return {title, items, filters};
}
export function exportChartPng(id) {
  const ch = charts[id]; if (!ch) return;
  const SCALE = 3;
  const oldDpr = ch.options.devicePixelRatio;
  ch.options.devicePixelRatio = SCALE; ch.resize(); ch.update('none');
  const src = ch.canvas, ctxInfo = chartContext(src);
  const W = src.width, pad = 16 * SCALE, fam = 'system-ui,-apple-system,"Segoe UI",sans-serif';
  const meas = document.createElement('canvas').getContext('2d');
  // Legende umbrechen
  meas.font = `${12 * SCALE}px ${fam}`;
  const rows = [[]]; let x = 0; const sw = 11 * SCALE, gap = 16 * SCALE;
  for (const it of ctxInfo.items) { const w = sw + 6 * SCALE + meas.measureText(it.text).width + gap;
    if (x + w > W - 2 * pad && rows[rows.length - 1].length) { rows.push([]); x = 0; } rows[rows.length - 1].push({...it, x}); x += w; }
  const titleH = ctxInfo.title ? 26 * SCALE : 0, legH = ctxInfo.items.length ? rows.length * 20 * SCALE + 6 * SCALE : 0, footH = 34 * SCALE;
  const out = document.createElement('canvas'); out.width = W + 0; out.height = pad + titleH + legH + src.height + footH;
  const c = out.getContext('2d');
  c.fillStyle = css('--card') || '#fff'; c.fillRect(0, 0, out.width, out.height);
  let y = pad;
  if (ctxInfo.title) { c.fillStyle = css('--text-primary'); c.font = `600 ${16 * SCALE}px ${fam}`; c.textBaseline = 'top'; c.fillText(ctxInfo.title, pad, y); y += titleH; }
  if (ctxInfo.items.length) {
    c.font = `${12 * SCALE}px ${fam}`; c.textBaseline = 'middle';
    rows.forEach((r, ri) => r.forEach(it => { const yy = y + ri * 20 * SCALE + 8 * SCALE;
      if (it.dashed) { c.strokeStyle = it.color; c.lineWidth = 2 * SCALE; c.setLineDash([3 * SCALE, 2 * SCALE]); c.strokeRect(pad + it.x, yy - sw / 2, sw, sw); c.setLineDash([]); }
      else { c.fillStyle = it.color; c.fillRect(pad + it.x, yy - sw / 2, sw, sw); }
      c.fillStyle = css('--text-secondary'); c.fillText(it.text, pad + it.x + sw + 6 * SCALE, yy); }));
    y += legH;
  }
  c.drawImage(src, 0, y); y += src.height;
  // Quellenzeile: Datenstand, Filter, Maßeinheit, Kennzeichnung
  const marks = [S.isDemo ? 'DEMO – fiktive Daten' : '', (typeof PLAN !== 'undefined' && S.applyPlan && PLAN.items.length) ? 'PLAN – ' + PLAN.name : ''].filter(Boolean);
  const foot = [`Personalplanung Fakultät IuI · Stichtag ${fmtD(S.today)} · Maßeinheit ${S.measure === 'vzae' ? 'VZÄ' : 'Köpfe'}`, ...ctxInfo.filters, ...marks, `erstellt ${fmtD(toDay(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()))}`].join(' · ');
  c.font = `${10.5 * SCALE}px ${fam}`; c.fillStyle = css('--muted'); c.textBaseline = 'middle';
  let ft = foot; while (c.measureText(ft).width > W - 2 * pad && ft.length > 20) ft = ft.slice(0, -2);
  c.fillText(ft === foot ? ft : ft + '…', pad, y + footH / 2);
  ch.options.devicePixelRatio = oldDpr; ch.resize(); ch.update('none');
  const name = ((ctxInfo.title || id) + '_' + isoD(S.today)).replace(/[^\wäöüÄÖÜß-]+/g, '_').replace(/_+/g, '_').slice(0, 90) + '.png';
  out.toBlob(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, 'image/png');
}
export const axis = (extra = {}) => Object.assign({grid: {color: css('--grid'), drawTicks: false}, border: {color: css('--axis')}, ticks: {padding: 6}}, extra);
export const legendHtml = items => items.map(([c, l]) => `<span><i style="background:${c}"></i>${esc(l)}</span>`).join('');
export const barDs = (label, data, color, extra = {}) => Object.assign({label, data, backgroundColor: color, borderColor: css('--card'), borderWidth: 0, borderRadius: 3, borderSkipped: false, maxBarThickness: 28}, extra);
