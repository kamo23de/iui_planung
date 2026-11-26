// Baut eine einzige, offline lauffähige HTML-Datei aus
//   src/index.html (Gerüst), src/styles.css, src/js/ (ES-Module, Einstieg src/js/app.js)
// und den eingebetteten Bibliotheken SheetJS und Chart.js. Die Module bündelt esbuild.
// Aufruf: npm install && npm run build
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'Personalplanung_IuI.html');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');

function put(text, marker, content, where) {
  const re = marker instanceof RegExp ? marker : null;
  if (re ? !re.test(text) : !text.includes(marker)) throw new Error(`Platzhalter ${marker} fehlt in ${where}`);
  return text.replace(marker, () => content);
}

/** Module mit esbuild zu einem Skript bündeln. Gemeinsame Einstellungen für Build und Tests. */
function bundle(options) {
  const res = esbuild.buildSync(Object.assign({
    bundle: true, write: false, format: 'iife', charset: 'utf8', legalComments: 'none', logLevel: 'silent',
    target: 'es2020',
  }, options));
  return res.outputFiles[0].text;
}

/** Anwendungsskript (alle Module ab src/js/app.js) mit eingebetteten Demodaten. */
function appScript() {
  const demo = fs.readFileSync(path.join(root, 'testdaten/Testdaten_Personalplanung.xlsx')).toString('base64');
  const js = bundle({entryPoints: [path.join(root, 'src/js/app.js')]});
  return put(js, /(['"])\/\*DEMO_XLSX_B64\*\/\1/, "'" + demo + "'", 'src/js/main.js');
}

function buildHtml() {
  let html = read('src/index.html');
  html = put(html, '<style>/*CSS*/</style>', '<style>\n' + read('src/styles.css') + '</style>', 'src/index.html');
  html = put(html, '<script>/*XLSX*/</script>', '<script>' + safe(read('node_modules/xlsx/dist/xlsx.core.min.js')) + '</script>', 'src/index.html');
  html = put(html, '<script>/*CHARTJS*/</script>', '<script>' + safe(read('node_modules/chart.js/dist/chart.umd.js')) + '</script>', 'src/index.html');
  html = put(html, '<script>/*APP*/</script>', '<script>\n' + safe(appScript()) + '</script>', 'src/index.html');
  return html;
}

if (require.main === module) {
  const html = buildHtml();
  fs.writeFileSync(OUT, html);
  console.log('Personalplanung_IuI.html geschrieben,', (html.length / 1024).toFixed(0), 'KB');
}

module.exports = {buildHtml, appScript, bundle, OUT};
