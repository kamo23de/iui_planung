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

Der Quelltext liegt in `src/app.html`. Die fertige Einzeldatei wird so gebaut:

```bash
npm install
npm run build        # erzeugt Personalplanung_IuI.html
```

Testdaten neu erzeugen (Python mit openpyxl):

```bash
python3 scripts/make_testdata.py
```
