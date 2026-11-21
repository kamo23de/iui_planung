// Baut eine einzige, offline lauffähige HTML-Datei: src/app.html + eingebettete Bibliotheken
// Aufruf: npm install && npm run build
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(path.join(root, 'src/app.html'), 'utf8');
const xlsx = safe(fs.readFileSync(path.join(root, 'node_modules/xlsx/dist/xlsx.core.min.js'), 'utf8'));
const chart = safe(fs.readFileSync(path.join(root, 'node_modules/chart.js/dist/chart.umd.js'), 'utf8'));
html = html.replace('<script>/*XLSX*/</script>', () => '<script>' + xlsx + '</script>');
html = html.replace('<script>/*CHARTJS*/</script>', () => '<script>' + chart + '</script>');
// Fiktive Testtabelle als Demodaten einbetten
const demo = fs.readFileSync(path.join(root, 'testdaten/Testdaten_Personalplanung.xlsx')).toString('base64');
if (!html.includes("'/*DEMO_XLSX_B64*/'")) throw new Error('Platzhalter für Demodaten fehlt');
html = html.replace("'/*DEMO_XLSX_B64*/'", () => "'" + demo + "'");
fs.writeFileSync(path.join(root, 'Personalplanung_IuI.html'), html);
console.log('Personalplanung_IuI.html geschrieben,', (html.length / 1024).toFixed(0), 'KB');
