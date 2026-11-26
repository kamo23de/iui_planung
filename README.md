# Personalplanung Fakultät IuI

Interaktives Dashboard für die Personalplanung, das **vollständig lokal im Browser** läuft.
Personenbezogene Daten verlassen den Rechner nicht.

## Benutzung

1. `Personalplanung_IuI.html` herunterladen und per Doppelklick im Browser öffnen.
2. Excel-Datei auswählen oder in das Fenster ziehen.
3. Zuerst den Reiter **Datenprüfung** ansehen, dann die Auswertungen.

### Auf dem iPad (oder einem anderen Gerät ohne lokale HTML-Dateien)

Ist GitHub Pages eingeschaltet (Settings → Pages → Deploy from a branch → `main` / root), läuft die Anwendung unter
https://kamo23de.github.io/iui_planung/. In Safari lässt sie sich über Teilen → „Zum Home-Bildschirm“ wie eine App ablegen.
Die Excel-Datei wird auch dort nur auf dem Gerät verarbeitet und nicht hochgeladen.
Die App-Symbole liegen in `icons/` (Quelle: `icons/icon.svg`), das Web-App-Manifest in `manifest.webmanifest`.

### Demo-Modus

Auf der Startseite lädt **„Demo mit fiktiven Daten starten“** eine eingebaute Beispieltabelle. Mit ihr lassen sich alle Funktionen ohne echte Daten vorführen.
Im Demo-Modus sind Kopfzeile und Fenstertitel deutlich als „DEMO · fiktive Daten“ markiert.
**„Demodaten entladen“** entfernt die Daten aus dem Speicher und kehrt zur Startseite zurück, wo die echte Tabelle wie gewohnt geladen wird.
Die Demodaten sind die Testdatei `testdaten/Testdaten_Personalplanung.xlsx`; `npm run build` bettet sie in die HTML-Datei ein.

Zum Ausprobieren gibt es außerdem `testdaten/Testdaten_Personalplanung.xlsx`. Die Datei enthält erfundene Personen und absichtlich eingebaute Fehler.

## Datenschutz

- Alle Bibliotheken (SheetJS, Chart.js) sind in der HTML-Datei eingebettet. Es wird nichts nachgeladen.
- SheetJS stammt von https://cdn.sheetjs.com/ (Version 0.20.3), nicht aus dem npm-Register: Dort gibt es nur die veraltete 0.18.5 mit bekannten Schwachstellen (Prototype Pollution, ReDoS). Ein Test stellt sicher, dass mindestens 0.20.2 eingebettet ist.
- Eine Content-Security-Policy in der Datei verbietet dem Browser jede Netzwerkverbindung.
- Die Daten liegen nur im Arbeitsspeicher des Browserfensters und sind nach dem Schließen weg.
- **Echte Excel-Dateien gehören nicht in dieses Repository** – es ist öffentlich. Die `.gitignore` schließt Excel- und CSV-Dateien aus, ausgenommen die Testdatei.

## Erwarteter Aufbau der Excel-Datei

**Blatt Personal:** Personalnummer, Name, Vorname, Mitarbeiterkreis, ArbAnteil, VZÄ, TrfGr, Vertragsart, Beginn, Vertragsende, kw, Cluster, Organisationseinheit, Laborbereich, optional „ruht bis“ (Vertrag ruht bis zu diesem Datum), „Ruheanteil“ (ruhender Stellenumfang in VZÄ) und „Ruhestand“ (voraussichtliches Ausscheiden bei unbefristeten Verträgen) sowie „Vertretung für“ (Personalnummer der vertretenen Person), Deputat (Lehrdeputat in SWS je Semester; 0 = nur unterstützend in der Lehre)

**Blatt Studierende:** Studiengang, Cluster, Art (Bachelor/Master), CNW (Curricularnormwert), Studienplätze (je neuer Studierendengruppe), Studierende (eingeschrieben)

Blätter und Spalten werden an den Überschriften erkannt. Reihenfolge und Blattnamen sind egal.

## Funktionen

| Reiter | Inhalt |
|---|---|
| Datenprüfung | Plausibilitätscheck mit Fehlern, Warnungen und Hinweisen samt Zeilennummer; Export als CSV |
| Mitarbeiterkreise | Aktive Stellen für die ganze Fakultät, je Cluster gestapelt und je Cluster einzeln |
| Semesterverlauf | Bestand zu jedem Semesterbeginn, Zu- und Abgänge je Semester, bis 20 Semester voraus |
| Forecast | Zielzeitpunkt als Datum oder Semester (max. 20 voraus), Vergleich mit heute, Ab- und Zugangslisten |
| Betreuung & WiMi | Studierende je Professor/in (inkl. LfbA) und je WiMi; WiMi je Professur (ohne LfbA) je Cluster und Organisationseinheit |
| Detailansicht | Auswahl nach Cluster, Laborbereich und Organisationseinheit (die Liste der Organisationseinheiten richtet sich nach Cluster und Laborbereich). Genaues Verhältnis Professur (inkl. LfbA) : WiMi : sonstige Mitarbeitende : Studierende (Köpfe und VZÄ; Studierende nur ohne Labor-/OE-Auswahl, da diesen nicht zugeordnet). Professuren und Mitarbeitende je Laborbereich mit Diagramm und Tabelle. Vollständige Personalliste, gegliedert nach Mitarbeiterkreis oder Laborbereich, mit Vertragsdaten, Restlaufzeit, kw und Status; sortierbar, durchsuchbar, als CSV speicherbar |
| Kapazität | Lehrangebot (Summe Deputat) je Cluster und Organisationseinheit, nach Personalgruppe; erforderliche Kapazität (CNW × Studienplätze) je Studiengang neben den eingeschriebenen Studierenden; Bilanz und Auslastung für Fakultät und (vorläufig) je Cluster; Stichtag bis 20 Semester voraus |

### Diagramme exportieren

Jedes Diagramm hat oben rechts den Button **⤓ PNG**. Er speichert das Diagramm als Bild in hoher Auflösung, mit Titel, Legende und einer Quellenzeile (Stichtag, Maßeinheit, gewählte Filter, ggf. DEMO/PLAN, Erstellungsdatum). Ganze Seiten lassen sich über den Druckdialog des Browsers als PDF speichern.

### Planung (Entwurf)

Der Reiter **Planung** legt ein **Szenario** aus Planmaßnahmen über die Ist-Daten; die Excel-Datei bleibt unverändert.
Planmaßnahmen: **Nachbesetzung** einer ausscheidenden Stelle, **neue Stelle**, **Vertragsende ändern** (Verlängerung, Verkürzung, Entfristung).
Nachbesetzungen übernehmen das Deputat der bisherigen Stelle (anteilig zum Stellenumfang), bei neuen Stellen lässt es sich eintragen; ist das Szenario eingerechnet, zählt es auch in der Ansicht **Kapazität** mit.
Szenarien werden als JSON-Datei gespeichert und wieder geladen (lokal, ohne Upload). Auf Wunsch wird das Szenario in **allen** Ansichten eingerechnet; die Kopfzeile zeigt dann „PLAN“.

- **Stellenplan (Zeitstrahl):** je Vertrag ein Balken über bis zu 20 Semester, gegliedert nach Organisationseinheit, Laborbereich oder Mitarbeiterkreis. Ruhephasen schraffiert, Vertretungen und Nachbesetzungen eingerückt darunter, kw- und Ruhestands-Marken, rot gestrichelt die Zeit, in der eine Stelle nach Vertragsende unbesetzt ist. Klick auf Balken oder offene Stelle: nachbesetzen, Vertragsende ändern, Person anzeigen. Darunter die Wirkung Ist gegenüber Plan und die Liste der Planmaßnahmen.
- **Zielwerte (Ampel):** Zielwerte für Studierende je Professur (inkl. LfbA) und WiMi je Professur (ohne LfbA) mit Toleranz. Ampel je Cluster und Semester (✓ / ! / ✕), erstes Semester mit Zielverfehlung, Fehlbedarf in VZÄ je Feld; der Fehlbedarf lässt sich als neue Stelle in das Szenario übernehmen.

### Diagramme exportieren

Jedes Diagramm hat oben rechts den Button **⤓ PNG**. Er speichert das Diagramm als Bild in hoher Auflösung, mit Titel, Legende und einer Quellenzeile (Stichtag, Maßeinheit, gewählte Filter, ggf. DEMO/PLAN, Erstellungsdatum). Ganze Seiten lassen sich über den Druckdialog des Browsers als PDF speichern.

### Personensuche

Das Suchfeld oben in der Kopfzeile steht auf allen Seiten zur Verfügung (Tastenkürzel **/** oder **Strg/⌘ + K**).
Gesucht wird am Anfang von Nachname, Vorname oder Personalnummer, ohne Rücksicht auf Groß-/Kleinschreibung und Akzente („mul“ findet „Müller“).
Die Treffer erscheinen als Auswahlliste mit Personalnummer, Mitarbeiterkreis, Cluster und Status.
**Tab** vervollständigt wie in der Unix-Shell bis zum längsten gemeinsamen Anfang aller Treffer (grau angezeigt); ist nichts mehr zu ergänzen, springt Tab durch die Liste.
**↑/↓** wählen, **Enter** öffnet das Personenfenster, **Esc** schließt. Im Personenfenster führt „In Detailliste zeigen“ zur Person in der Detailansicht.

## Festgelegte Regeln

- **Aktiv:** Beginn ≤ Stichtag ≤ Vertragsende. Ein leeres Vertragsende oder ein Enddatum ab 2100 zählt als unbefristet.
- **Vertragsende und Ruhestand:** „Vertragsende“ ist das tatsächliche Ende eines Zeitvertrags, „Ruhestand“ das voraussichtliche Ausscheiden bei unbefristeten Verträgen. Maßgeblich ist das frühere der beiden Daten. Ein Datum im Vertragsende eines unbefristeten Vertrags (Altbestand) wird als Ruhestand gewertet. Abgänge werden nach Ruhestand und Vertragsende getrennt ausgewiesen; die Befristungsquote zählt nur Zeitverträge.
- **Ruhende Verträge:** Ist „ruht bis“ gesetzt, ruht der Vertrag bis einschließlich dieses Datums. Er zählt bis dahin weder als Stelle noch mit Deputat und erscheint danach als „Rückkehr nach Ruhen“ (Semesterverlauf, Forecast). Da kein Beginn des Ruhens erfasst wird, gilt der Vertrag in allen Auswertungen vor diesem Datum als ruhend – auch für zurückliegende Semester.
- **Teilweise ruhende Verträge:** „Ruheanteil“ gibt an, welcher Stellenumfang (in VZÄ oder % einer Vollzeitstelle) während der Ruhe ruht, z. B. 0,5 bei einem Dekanat. Leer bedeutet: die ganze Stelle ruht. Während der Ruhe zählen immer nur die nicht ruhenden Anteile – VZÄ und Deputat werden anteilig gekürzt; nach Köpfen zählt die Person weiter, solange ein Anteil aktiv ist. Bei der Rückkehr wird nur der bisher ruhende Anteil als Zugang gezählt.
- **Vertretungen:** „Vertretung für“ verweist per Personalnummer auf die vertretene Person. Die Datenprüfung meldet unbekannte Nummern, vertretene Personen ohne ruhenden Vertrag (Stelle doppelt gezählt) und Vertretungen, deren Laufzeit nicht mit dem Ende der Ruhe übereinstimmt (Überschneidung oder Lücke). In der Detailliste stehen Vertretungen eingerückt unter der vertretenen Person. Gezählt wird immer nur der aktive Vertrag: die Vertretung, nicht der ruhende. Endet eine Vertretung, wird sie nicht nachbesetzt: Forecast und Semesterverlauf weisen sie als eigenen Abgang „Vertretung endet“ aus, und im Szenario „offene Stellen weiterführen“ entsteht daraus keine offene Stelle.
- **Semester:** Wintersemester 01.09.–28./29.02., Sommersemester 01.03.–31.08. Bestand je Semester = Stand am ersten Tag.
- **kw:** Stellen mit kw-Vermerk entfallen nach Vertragsende. Optional werden Stellen ohne kw als offene, nachzubesetzende Stellen weitergeführt (Schalter oben).
- **Rundung:** Alle Berechnungen auf zwei Nachkommastellen. Kopfzahlen bleiben ganze Zahlen.
- **Kapazität:** Lehrangebot je Jahr = 2 × Summe Deputat (SWS je Semester) der aktiven Verträge, wie in der Kapazitätsverordnung (Aufnahmekapazität = 2 × Lehrangebot je Semester / Curricularanteil). Erforderliche Kapazität = CNW × Studienplätze × Aufnahmen je Jahr. Nicht berücksichtigt: Deputatsermäßigungen, Lehraufträge, Dienstleistungsexport/-import, Schwund, offene Stellen.
- **Betreuungsverhältnis:** LfbA zählen als Professor/innen. In der WiMi-je-Professur-Auswertung werden LfbA nicht berücksichtigt.
- Die Zuordnung der Mitarbeiterkreise zu Professor/in, LfbA, WiMi und Sonstige wird aus den Bezeichnungen erraten und lässt sich im Reiter „Betreuung & WiMi“ ändern.

## Entwicklung

Die fertige Einzeldatei wird so gebaut. `npm install` lädt SheetJS vom SheetJS-CDN (`cdn.sheetjs.com`), alles andere aus dem npm-Register:

```bash
npm install
npm run build        # erzeugt Personalplanung_IuI.html
```

### Aufbau des Quelltexts

| Pfad | Inhalt |
|---|---|
| `src/index.html` | HTML-Gerüst aller Ansichten, mit Platzhaltern für CSS, Bibliotheken und Anwendungsskript |
| `src/styles.css` | Gestaltung |
| `src/js/util.js` | Hilfsfunktionen: DOM-Kurzformen, Datum, Zahlenformate, Rundung, Semester |
| `src/js/state.js` | gemeinsamer Anwendungszustand `S` |
| `src/js/parse.js` | Einlesen der Excel-Datei, Spaltenerkennung, Aufbau der Datensätze |
| `src/js/checks.js` | Datenprüfung |
| `src/js/model.js` | Rechenkern: aktive Verträge, Ruhen, Teilruhen, Vertretungen, Personalgruppen, Stichtagsbestand |
| `src/js/teaching.js` | Lehre: Deputat und Lehrangebot (hier setzt die LVVO-Rechnung an) |
| `src/js/charts.js` | Diagramme und PNG-Export |
| `src/js/render.js` | Neuzeichnen der aktiven Ansicht |
| `src/js/views/*.js` | je Reiter eine Ansicht, dazu das Personenfenster |
| `src/js/plan/*.js` | Planung: Szenario, Formular, Zeitstrahl, Zielwerte |
| `src/js/search.js` | globale Personensuche |
| `src/js/main.js` | Laden der Datei, Reiterwechsel, Ereignisse, `init()` |
| `src/js/app.js` | Einstiegspunkt: startet die Anwendung |

Die Dateien unter `src/js/` sind ES-Module mit `import`/`export`. `scripts/build.js` bündelt sie mit [esbuild](https://esbuild.github.io/) ab dem Einstiegspunkt `src/js/app.js` zu einem Skript und setzt dieses zusammen mit CSS, SheetJS, Chart.js und den Demodaten in die HTML-Datei ein. Dabei gilt:

- Was ein Modul aus einem anderen braucht, importiert es ausdrücklich. Importierte Variablen sind nur lesbar; zum Ändern bietet das besitzende Modul einen Setter (z. B. `setFcMode`).
- Jeder Name auf oberster Ebene ist nur in einem Modul deklariert. Das braucht die Importprüfung in `scripts/modules.js`.
- esbuild meldet Importe von Namen, die nicht exportiert werden. Einen vergessenen Import meldet es nicht. Diese Lücke schließen `npm run check` und der Test `ansichten.test.js`.

```bash
npm run check        # prüft Importe und Exporte aller Module
npm run fix-imports  # schreibt die import-Zeilen aus der tatsächlichen Verwendung neu
```

### Tests

```bash
npm test
```

Die Tests laufen ohne Browser mit dem in Node eingebauten Test-Runner (`node:test`). `tests/load-app.js` bündelt alle Module außer `app.js` mit esbuild (gleiche Einstellungen wie der Build) und lädt sie für jeden Test in einen frischen Node-Kontext:

| Datei | Inhalt |
|---|---|
| `grundlagen.test.js` | Datum, Zahlen, Rundung, Semestergrenzen |
| `einlesen.test.js` | Spaltenerkennung, Stellenumfang, Vertragsart, maßgebliches Ende, kw |
| `rechenkern.test.js` | Vertragslaufzeit, Ruhen und Teilruhen, Stichtagsbestand, offene Stellen, Vertragsstatus |
| `pruefung.test.js` | Regeln der Datenprüfung |
| `kapazitaet.test.js` | Lehrangebot aus Deputat |
| `planung.test.js` | Szenarien (Nachbesetzung, neue Stelle, Vertragsende) und Zielwerte |
| `testdaten.test.js` | Gesamtlauf mit der Testdatei und festgehaltenen Referenzwerten (Stichtag 26.11.2026) |
| `build.test.js` | `Personalplanung_IuI.html` ist aktuell; Content-Security-Policy ohne Netzwerkzugriff |
| `module.test.js` | Importe und Exporte vollständig; die Module lassen sich als echte ES-Module laden |
| `ansichten.test.js` | Alle Ansichten werden mit den echten ES-Modulen und einem Platzhalter-DOM gezeichnet; fängt vergessene Importe ab |

Neue Fälle lassen sich mit `setup([...])` aus `tests/helpers.js` knapp formulieren: Jede Person ist ein Objekt, das nur die abweichenden Felder angibt.
Ändert sich durch eine gewollte Regeländerung ein Referenzwert in `testdaten.test.js`, wird er dort bewusst angepasst.
Auf GitHub laufen die Tests bei jedem Push (`.github/workflows/test.yml`).

Testdaten neu erzeugen (Python mit openpyxl):

```bash
python3 scripts/make_testdata.py
```
