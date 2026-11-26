// Baut eine einzige, offline lauffähige HTML-Datei aus
//   src/index.html (Gerüst), src/styles.css, src/js/**/*.js (Module, siehe scripts/modules.js)
// und den eingebetteten Bibliotheken SheetJS und Chart.js.
// Aufruf: npm install && npm run build
const fs = require('fs');
const path = require('path');
const {bundle} = require('./modules');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'Personalplanung_IuI.html');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');

function put(html, marker, content) {
  if (!html.includes(marker)) throw new Error(`Platzhalter ${marker} fehlt in src/index.html`);
  return html.replace(marker, () => content);
}

/** Anwendungsskript (alle Module) mit eingebetteten Demodaten. */
function appScript() {
  const demo = fs.readFileSync(path.join(root, 'testdaten/Testdaten_Personalplanung.xlsx')).toString('base64');
  return put(bundle(), "'/*DEMO_XLSX_B64*/'", "'" + demo + "'");
}

function buildHtml() {
  let html = read('src/index.html');
  html = put(html, '<style>/*CSS*/</style>', '<style>\n' + read('src/styles.css') + '</style>');
  html = put(html, '<script>/*XLSX*/</script>', '<script>' + safe(read('node_modules/xlsx/dist/xlsx.core.min.js')) + '</script>');
  html = put(html, '<script>/*CHARTJS*/</script>', '<script>' + safe(read('node_modules/chart.js/dist/chart.umd.js')) + '</script>');
  html = put(html, '<script>/*APP*/</script>', '<script>\n' + safe(appScript()) + '</script>');
  return html;
}

if (require.main === module) {
  const html = buildHtml();
  fs.writeFileSync(OUT, html);
  console.log('Personalplanung_IuI.html geschrieben,', (html.length / 1024).toFixed(0), 'KB');
}

module.exports = {buildHtml, appScript, OUT};
