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

**Blatt Personal:** Personalnummer, Name, Vorname, Mitarbeiterkreis, ArbAnteil, VZÄ, TrfGr, Vertragsart, Beginn, Vertragsende, kw, Cluster, Organisationseinheit, Laborbereich, optional „ruht bis“ (Vertrag ruht bis zu diesem Datum), „Ruheanteil“ (ruhender Stellenumfang in VZÄ) und „Ruhestand“ (voraussichtliches Ausscheiden bei unbefristeten Verträgen) sowie „Vertretung für“ (Personalnummer der vertretenen Person), optional Deputat (festgelegte Lehrverpflichtung in LVS bzw. SWS je Semester nach Ermäßigungen; 0 = nur unterstützend in der Lehre – nötig für WiMi und sonstiges Personal; für Professuren und LfbA rechnet die App nach LVVO, ein eingetragener Wert wird nur abgeglichen), optional „LVVO-Gruppe“ (Professur, LfbA 20, LfbA 24, WiMi, WiMi Qualifikation, keine – überschreibt die abgeleitete Gruppe)

**Blatt Studierende:** Studiengang, Cluster, Art (Bachelor/Master), CNW (Curricularnormwert), Studienplätze (je neuer Studierendengruppe), Studierende (eingeschrieben)

**Blatt Ermäßigungen (optional, für die LVVO):** Personalnummer, optional Name, Grund, optional Beschreibung, LVS oder Prozent, von, bis – eine Zeile je Ermäßigung der Lehrverpflichtung. Der **Name** wird mit dem Personalblatt abgeglichen („Name, Vorname“, „Vorname Name“, nur Nachname oder mit Initialen; Titel und Umlaut-Schreibweisen egal); passt er nicht zur Personalnummer, meldet die Datenprüfung das und nennt passende Personalnummern – angerechnet wird über die Personalnummer. Die **Beschreibung** ist ein Hilfstext: Sie erscheint in den Listen, im Personenfenster und im Bericht nach § 18, zählt aber nicht zur Erkennung des Grundes. Die Spalten werden am Inhalt der Überschrift erkannt: Grund z. B. „Grund“, „Begründung“, „Anlass“, „Art der Ermäßigung“, „Ermäßigungstatbestand“; Umfang z. B. „LVS“, „SWS“, „Stunden“, „Umfang“, „Ermäßigung in LVS“; Zeitraum „von/bis“, „ab/bis“, „Beginn/Ende“, „gültig von/bis“. Eine Spalte „Ermäßigung“ ohne weiteren Zusatz gilt je nach Inhalt als Grund (Text) oder Umfang (Zahl). Die Kopfzeile darf unter einer Titelzeile stehen oder zweizeilig sein. Ein Blatt, dessen Name auf Ermäßigungen deutet, wird schon mit einer Spalte „Personalnummer“ erkannt; sonst sind Personalnummer und Grund nötig. Der Grund wird aus dem Text erkannt (z. B. Forschung, Laborleitung, Studienfachberatung, Schwerbehinderung, Vizepräsidentschaft). Prozent: „12 %“, 12 und 0,12 bedeuten dasselbe.

**Blatt Lehre (optional, für das Zeitkonto):** Personalnummer, Semester („WS 2026/27“, „SS 2027“, auch „WiSe 26/27“, „SoSe 27“), Veranstaltung, Art, SWS, optional Anteil (Lehrbeteiligung), Anzahl (Durchführungen im Semester) und LVS (bereits angerechnet; ersetzt die Rechnung aus SWS) – eine Zeile je Lehrveranstaltung und Semester. Art „Betreuung“ für Abschlussarbeiten, „Übertrag“ für den Kontostand vor der ersten erfassten Zeile.

Blätter und Spalten werden an den Überschriften erkannt. Reihenfolge und Blattnamen sind egal; der Blattname dient nur als Hinweis. Als Personalblatt gilt nur ein Blatt mit Vertragsspalten (VZÄ, ArbAnteil, Beginn, Vertragsende oder Vertragsart). Personalnummern werden blattübergreifend ohne Leerzeichen und ohne führende Nullen verglichen („00123“ = 123). Die Datenprüfung zeigt, welches Blatt mit welchen Spalten erkannt wurde, und meldet Blätter, die nicht zugeordnet werden konnten, mit den gelesenen Überschriften.

## Funktionen

| Reiter | Inhalt |
|---|---|
| Datenprüfung | Plausibilitätscheck mit Fehlern, Warnungen und Hinweisen samt Zeilennummer; Export als CSV |
| Mitarbeiterkreise | Aktive Stellen für die ganze Fakultät, je Cluster gestapelt und je Cluster einzeln |
| Semesterverlauf | Bestand zu jedem Semesterbeginn, Zu- und Abgänge je Semester, bis 20 Semester voraus |
| Forecast | Zielzeitpunkt als Datum oder Semester (max. 20 voraus), Vergleich mit heute, Ab- und Zugangslisten |
| Betreuung & WiMi | Studierende je Professor/in (inkl. LfbA) und je WiMi; WiMi je Professur (ohne LfbA) je Cluster und Organisationseinheit |
| Detailansicht | Auswahl nach Cluster, Laborbereich und Organisationseinheit (die Liste der Organisationseinheiten richtet sich nach Cluster und Laborbereich). Genaues Verhältnis Professur (inkl. LfbA) : WiMi : sonstige Mitarbeitende : Studierende (Köpfe und VZÄ; Studierende nur ohne Labor-/OE-Auswahl, da diesen nicht zugeordnet). Professuren und Mitarbeitende je Laborbereich mit Diagramm und Tabelle. Vollständige Personalliste, gegliedert nach Mitarbeiterkreis oder Laborbereich, mit Vertragsdaten, Restlaufzeit, kw und Status; sortierbar, durchsuchbar, als CSV speicherbar |
| Kapazität | Lehrangebot je Cluster und Organisationseinheit, nach Personalgruppe – wahlweise aus dem LVVO-Soll (Standard) oder aus der Spalte „Deputat“; erforderliche Kapazität (CNW × Studienplätze) je Studiengang neben den eingeschriebenen Studierenden; Bilanz und Auslastung für Fakultät und (vorläufig) je Cluster; Stichtag bis 20 Semester voraus |
| Lehrverpflichtung | LVVO Niedersachsen für Fachhochschulen: Regellehrverpflichtung (Professuren, LfbA) bzw. Höchstlehrverpflichtung (WiMi) anteilig nach VZÄ, Ermäßigungen nach Grund mit Quote nach § 9, Soll je Cluster und je Person im Vergleich zum eingetragenen Deputat (Liste nur mit Personen, deren Lehrverpflichtung vor Ermäßigungen über 0 liegt; nach Cluster gegliedert und je Cluster auf- und zuklappbar; per Klick auf die Spaltenüberschrift sortierbar), Regelwerk mit Fundstellen; Stichtag bis 20 Semester voraus; gehaltene Lehre und Zeitkonto je Semester (Liste ebenfalls sortierbar) mit CSV-Export (eine Zeile je Person und Semester, mit Lehrveranstaltungen) als Grundlage für die Dokumentation nach § 18; Dokumentation nach § 18 je Studienjahr (Vorschau, Drucken/PDF, HTML-Datei) |

### Tabellen sortieren

Alle Tabellen lassen sich per Klick auf eine Spaltenüberschrift sortieren; ein erneuter Klick kehrt die Richtung um (▲/▼). Zahlen in deutscher Schreibweise, Datumsangaben und Semester werden erkannt, leere Werte („–“) stehen immer am Ende. Summenzeilen am Tabellenende bleiben unten; in gegliederten Tabellen (z. B. Cluster mit Organisationseinheiten darunter) werden die Gruppen und die Zeilen innerhalb jeder Gruppe sortiert. Die Sortierung bleibt erhalten, wenn eine Tabelle neu gezeichnet wird (z. B. nach einem Stichtagswechsel). Ausgenommen sind die Rechenaufstellung „Verhältnis“ in der Detailansicht, die Ampel-Matrix der Planung, das Regelwerk und der Bericht nach § 18.

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

### Suche

Das Suchfeld oben in der Kopfzeile steht auf allen Seiten zur Verfügung (Tastenkürzel **/** oder **Strg/⌘ + K**). Es findet Personen, Laborbereiche und Organisationseinheiten, ohne Rücksicht auf Groß-/Kleinschreibung und Akzente („mul“ findet „Müller“).

- **Personen:** Anfang von Nachname, Vorname oder Personalnummer. Die Liste zeigt Personalnummer, Mitarbeiterkreis, Cluster und Status; **Enter** öffnet das Personenfenster. Dort führt „In Detailliste zeigen“ zur Person in der Detailansicht.
- **Laborbereiche und Organisationseinheiten:** Anfang des Namens oder eines Wortes darin („fert“ findet „Labor Fertigungstechnik“). Gleiche Namen in verschiedenen Clustern erscheinen getrennt. **Enter** öffnet die Detailansicht mit passendem Cluster und Filter.
- Die Auswahlliste ist in dieser Reihenfolge gruppiert: **Personen**, **Laborbereiche**, **Organisationseinheiten** (höchstens 8, 5 und 5 Einträge; weiter tippen grenzt ein).
- **Tab** vervollständigt wie in der Unix-Shell bis zum längsten gemeinsamen Anfang aller Treffer (grau angezeigt), über alle drei Gruppen hinweg; ist nichts mehr zu ergänzen, springt Tab durch die Liste. **↑/↓** wählen, **Esc** schließt. Bei mehreren Treffern markiert das erste **Enter** den obersten, das zweite öffnet ihn.

### Bereiche in Arbeit (WIP)

Die Reiter **Kapazität**, **Lehrverpflichtung** und **Planung** sowie die LVVO-Angaben im Personenfenster sind noch in Arbeit. Der Schalter **WIP-Bereiche** in der Kopfzeile blendet sie ein oder aus; standardmäßig sind sie ausgeblendet. Die Wahl merkt sich der Browser (nur diese Einstellung, keine Daten). Beim Ausblenden wird ein eingerechnetes Planungsszenario abgeschaltet. Die Datenprüfung meldet LVVO-Befunde unabhängig vom Schalter.

## Festgelegte Regeln

- **Aktiv:** Beginn ≤ Stichtag ≤ Vertragsende. Ein leeres Vertragsende oder ein Enddatum ab 2100 zählt als unbefristet.
- **Vertragsende und Ruhestand:** „Vertragsende“ ist das tatsächliche Ende eines Zeitvertrags, „Ruhestand“ das voraussichtliche Ausscheiden bei unbefristeten Verträgen. Maßgeblich ist das frühere der beiden Daten. Ein Datum im Vertragsende eines unbefristeten Vertrags (Altbestand) wird als Ruhestand gewertet. Abgänge werden nach Ruhestand und Vertragsende getrennt ausgewiesen; die Befristungsquote zählt nur Zeitverträge.
- **Ruhende Verträge:** Ist „ruht bis“ gesetzt, ruht der Vertrag bis einschließlich dieses Datums. Er zählt bis dahin weder als Stelle noch mit Deputat und erscheint danach als „Rückkehr nach Ruhen“ (Semesterverlauf, Forecast). Da kein Beginn des Ruhens erfasst wird, gilt der Vertrag in allen Auswertungen vor diesem Datum als ruhend – auch für zurückliegende Semester.
- **Teilweise ruhende Verträge:** „Ruheanteil“ gibt an, welcher Stellenumfang (in VZÄ oder % einer Vollzeitstelle) während der Ruhe ruht, z. B. 0,5 bei einem Dekanat. Leer bedeutet: die ganze Stelle ruht. Während der Ruhe zählen immer nur die nicht ruhenden Anteile – VZÄ und Deputat werden anteilig gekürzt; nach Köpfen zählt die Person weiter, solange ein Anteil aktiv ist. Bei der Rückkehr wird nur der bisher ruhende Anteil als Zugang gezählt.
- **Vertretungen:** „Vertretung für“ verweist per Personalnummer auf die vertretene Person. Die Datenprüfung meldet unbekannte Nummern, vertretene Personen ohne ruhenden Vertrag (Stelle doppelt gezählt) und Vertretungen, deren Laufzeit nicht mit dem Ende der Ruhe übereinstimmt (Überschneidung oder Lücke). In der Detailliste stehen Vertretungen eingerückt unter der vertretenen Person. Gezählt wird immer nur der aktive Vertrag: die Vertretung, nicht der ruhende. Endet eine Vertretung, wird sie nicht nachbesetzt: Forecast und Semesterverlauf weisen sie als eigenen Abgang „Vertretung endet“ aus, und im Szenario „offene Stellen weiterführen“ entsteht daraus keine offene Stelle.
- **Semester:** Wintersemester 01.09.–28./29.02., Sommersemester 01.03.–31.08. Bestand je Semester = Stand am ersten Tag.
- **kw:** Stellen mit kw-Vermerk entfallen nach Vertragsende. Optional werden Stellen ohne kw als offene, nachzubesetzende Stellen weitergeführt (Schalter oben).
- **Rundung:** Alle Berechnungen auf zwei Nachkommastellen. Kopfzahlen bleiben ganze Zahlen.
- **Kapazität:** Lehrangebot je Semester in LVS. Quelle **LVVO-Soll** (Standard): Professuren und LfbA mit ihrer Regellehrverpflichtung nach LVVO (anteilig nach VZÄ, ohne ruhende Anteile) abzüglich der Ermäßigungen – das entspricht dem um Verminderungen bereinigten Lehrdeputat der Kapazitätsverordnung; WiMi und sonstiges Personal mit der Spalte „Deputat“, da die LVVO für sie nur eine Obergrenze nennt. Quelle **Deputat**: Spalte „Deputat“ für alle (bisherige Rechnung). Lehrangebot je Jahr = 2 × Lehrangebot je Semester, wie in der Kapazitätsverordnung (Aufnahmekapazität = 2 × Lehrangebot je Semester / Curricularanteil). Erforderliche Kapazität = CNW × Studienplätze × Aufnahmen je Jahr. Nicht berücksichtigt: Lehraufträge, Dienstleistungsexport/-import, Schwund, unbesetzte Stellen (die Kapazitätsverordnung rechnet mit Stellen statt Personen). In der Planung zählen neue Professuren und LfbA ebenfalls mit der LVVO; das Deputat im Formular gilt nur für WiMi und sonstiges Personal.
- **Lehrverpflichtung (LVVO):** Grundlage ist die LVVO Niedersachsen vom 3.9.2018, zuletzt geändert am 26.8.2024, Fall Fachhochschule (Regelwerk mit Fundstellen und Gültigkeitsdatum in `src/js/lvvo.js`). Regellehrverpflichtung je Semester: Professur 18 LVS, LfbA ab zweitem Einstiegsamt 20 LVS, darunter 24 LVS (§ 5 Abs. 1); Höchstlehrverpflichtung WiMi 8 LVS, befristet zur Weiterqualifikation 4 LVS (§ 5 Abs. 2). Teilzeit und ruhende Anteile anteilig (§ 2 Abs. 3). Soll = Regellehrverpflichtung − Ermäßigungen (mindestens 0); bei WiMi gilt das eingetragene Deputat als Soll, die Höchstlehrverpflichtung als Obergrenze.
- **LVVO-Annahmen:** Die LVVO gilt unmittelbar nur für Beamtinnen und Beamte (§ 1); für Tarifbeschäftigte wird sie ebenso angewendet. LfbA ab E13/A13 gelten als zweites Einstiegsamt. Befristete WiMi gelten als „auch zur Weiterqualifikation beschäftigt“. Ermäßigungen in Prozent beziehen sich auf die anteilige Lehrverpflichtung der Person. Die zulässige Quote nach § 9 wird als 7 % plus Lehre der WiMi in Prozent der Regellehrverpflichtungen gelesen, höchstens 10 %; sie gilt hochschulweit, die App zeigt nur den Anteil der Fakultät. Alle Annahmen lassen sich je Person mit der Spalte „LVVO-Gruppe“ übersteuern.
- **Gehaltene Lehre (§§ 13–15):** LVS = SWS × Faktor × Anteil × Anzahl. Faktor 1 für Vorlesung, Übung, Seminar, seminaristischen Unterricht, Praktikum, Kolloquium, Repetitorium; 0,3 für Exkursionen (Anlage Nr. 3); drei Zehntel bei Faktor ≥ 0,5 ohne ständige Anwesenheit, wenn die Art „nicht ständig anwesend“ enthält (§ 14 Abs. 2). Betreuung von Abschlussarbeiten zählt höchstens 2 LVS je Semester (§ 15). Ist die Spalte LVS gefüllt, zählt dieser Wert. Unbekannte Arten zählen mit Faktor 1 (Warnung).
- **Zeitkonto (§ 11 Abs. 3):** für Professuren und LfbA, je Semester vom ersten bis zum letzten Semester mit Einträgen (Semester ohne Eintrag zählen mit 0 LVS). Saldo = gehaltene Lehre − Soll; Soll nach LVVO am Semesterbeginn (mit Teilzeit, Ruhen und Ermäßigungen). Guthaben über dem Zweifachen der Regellehrverpflichtung verfällt am Semesterende (Kappung); ein Fehlbetrag über der Regellehrverpflichtung und Lehre unter der Hälfte des Solls werden gemeldet. Bei WiMi wird die gehaltene Lehre nur mit dem Deputat verglichen, ohne Konto. Nicht abgebildet: die Prüfung, ob eine ungleiche Verteilung nach § 11 Abs. 2 innerhalb von sechs Semestern ausgeglichen ist.
- **Dokumentation nach § 18:** je Studienjahr (Wintersemester und folgendes Sommersemester) und optional je Cluster. Deckblatt mit Übersicht aller Lehrpersonen (Soll, Ist, Saldo, Zeitkonto), Ermäßigungen nach Grund und Unterschriftsfeld für das Dekanat; danach je Lehrperson ein Einzelnachweis: Gruppe nach LVVO, Rechnung des Solls, Ermäßigungen/Freistellungen/Befreiung mit Rechtsgrundlage und Zeitraum, jede Lehrveranstaltung mit SWS, Faktor, Anteil, Anzahl, angerechneten LVS und Rechtsgrundlage, Betreuung, Zeitkonto, Hinweise und Befunde der Datenprüfung. Lehrpersonen sind Professuren, LfbA und WiMi mit Vertrag im Studienjahr sowie alle mit Einträgen im Blatt „Lehre“. Lehre und Zeitkonto stehen bei mehreren Verträgen mit derselben Personalnummer beim ersten. Der Bericht lässt sich drucken (nur der Bericht, auch als PDF) oder als eigenständige HTML-Datei ohne Skripte speichern; diese enthält personenbezogene Daten.
- **Datenprüfung zur LVVO:** Deputat weicht vom LVVO-Soll ab; WiMi-Deputat über der Höchstlehrverpflichtung; Ermäßigungen über den Höchstgrenzen (§ 7: Vizepräsidentschaft 75 %, Studienfachberatung 25 %, Schwerbehinderung 25 %, herausragende Lehrende 50 %; § 9: je Professur 4 LVS, für Forschung/Entwicklung/Transfer 9 LVS) oder über der Lehrverpflichtung; unbekannte Personalnummern, fehlender Umfang, unbekannter Grund, Zeitraum außerhalb des Vertrags; unbekannte oder unpassende LVVO-Gruppe.
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
| `src/js/lvvo.js` | LVVO Niedersachsen (Fachhochschule): Regelwerk mit Fundstellen und Gültigkeitsdatum, Erkennung von Gruppe und Ermäßigungsgrund |
| `src/js/teaching.js` | Lehre: Lehrangebot (Kapazität) und Lehrverpflichtung nach LVVO |
| `src/js/doku.js` | Dokumentation nach § 18: Daten je Studienjahr und Lehrperson, Bericht als HTML |
| `src/js/charts.js` | Diagramme und PNG-Export |
| `src/js/render.js` | Neuzeichnen der aktiven Ansicht |
| `src/js/views/*.js` | je Reiter eine Ansicht, dazu das Personenfenster |
| `src/js/plan/*.js` | Planung: Szenario, Formular, Zeitstrahl, Zielwerte |
| `src/js/search.js` | globale Suche nach Personen, Laborbereichen und Organisationseinheiten |
| `src/js/tablesort.js` | Sortierung aller Tabellen per Klick auf die Spaltenüberschrift |
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
| `lvvo.test.js` | LVVO: Regelwerte, Zuordnung zur Gruppe, Lehrverpflichtung mit Teilzeit, Ruhen und Ermäßigungen, Quote nach § 9, Prüfregeln |
| `lehre.test.js` | Blatt „Lehre“: Semesterangaben, Gewichtung nach § 14, Betreuung nach § 15, Zeitkonto mit Kappung, Fehlbetrag, Übertrag und Lücken, Prüfregeln |
| `suche.test.js` | Suche: Reihenfolge Personen – Laborbereiche – Organisationseinheiten, Treffer am Wortanfang, Akzente, Vervollständigung |
| `doku.test.js` | Dokumentation nach § 18: Studienjahr, Referenzwerte, Hinweise, Vertragsende, Befreiung, mehrere Verträge, sicherer HTML-Bericht |
| `ermaessigungen-blatt.test.js` | Erkennung des Blatts „Ermäßigungen“ in 12 realistischen Varianten (Überschriften, Titelzeile, zweizeiliger Kopf, Blattreihenfolge, führende Nullen), Meldungen zu nicht erkannten Blättern |
| `tabellen-sortierung.test.js` | Allgemeine Tabellensortierung: Werte (Zahlen, Datum, Semester, Text, leer), flache und gegliederte Tabellen, Summenzeilen |
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
