// LVVO Niedersachsen: Regelwerk für Fachhochschulen (nur Daten, keine Berechnung – die steht in teaching.js)
//
// Quelle: Verordnung über die Lehrverpflichtung an Hochschulen (Lehrverpflichtungsverordnung – LVVO)
// vom 3. September 2018 (Nds. GVBl. S. 181), geändert durch VO vom 21.9.2021 (Nds. GVBl. S. 690) und
// vom 26.8.2024 (Nds. GVBl. Nr. 74/2024), VORIS 22210. Abgerufen über https://www.schure.de/22210/lvvo.htm.
// Die Änderung 2024 betrifft nur Universitäten (§ 4); für Fachhochschulen gilt die Fassung seit 10.9.2018.
//
// Eine neue Fassung wird als weiterer Eintrag in LVVO_FASSUNGEN ergänzt (mit gueltigAb); maßgeblich ist am
// Stichtag jeweils die jüngste Fassung, die schon gilt.

/** Lehrverpflichtungsgruppen an Fachhochschulen.
 *  art: 'regel' = Regellehrverpflichtung (gilt als Soll), 'hoechst' = Höchstlehrverpflichtung (Obergrenze;
 *  das Soll wird individuell festgelegt, hier aus der Spalte „Deputat“), 'keine' = keine Lehrverpflichtung. */
const GRUPPEN_FH = {
  prof: {label: 'Professur', lvs: 18, art: 'regel', ref: '§ 5 Abs. 1 Nr. 1'},
  lfba20: {label: 'LfbA ab 2. Einstiegsamt', lvs: 20, art: 'regel', ref: '§ 5 Abs. 1 Nr. 2 a'},
  lfba24: {label: 'LfbA unter 2. Einstiegsamt', lvs: 24, art: 'regel', ref: '§ 5 Abs. 1 Nr. 2 b'},
  wimi: {label: 'WiMi', lvs: 8, art: 'hoechst', ref: '§ 5 Abs. 2 Nr. 1'},
  wimiQ: {label: 'WiMi zur Weiterqualifikation', lvs: 4, art: 'hoechst', ref: '§ 5 Abs. 2 Nr. 2'},
  keine: {label: 'keine Lehrverpflichtung', lvs: 0, art: 'keine', ref: '§ 1'},
};

/** Ermäßigungsgründe. maxPct: Höchstgrenze in Prozent der (anteiligen) Lehrverpflichtung der Person;
 *  p9: zählt zur Ermäßigungsquote nach § 9 Satz 2; forschung: Höchstgrenze 9 statt 4 LVS je Professur (§ 9 Satz 3).
 *  kurz: Kurzform für Listen; muster: Erkennung des Grundes aus dem Freitext der Excel-Spalte „Grund“ (Kleinschreibung, ß → ss). */
const GRUENDE_FH = [
  {key: 'vp', kurz: 'Vizepräsidentschaft', label: 'Nebenberufliche Vizepräsidentschaft', ref: '§ 7 Abs. 1', maxPct: 75, muster: /vizepr/},
  {key: 'reform', kurz: 'Studienreform', label: 'Besondere Aufgaben der Studienreform', ref: '§ 7 Abs. 3 Nr. 1', muster: /studienreform/},
  {key: 'beratung', kurz: 'Studienfachberatung', label: 'Studienfachberatung', ref: '§ 7 Abs. 3 Nr. 2', maxPct: 25, hinweisLvs: 2, muster: /fachberat|studienberat/},
  {key: 'sb', kurz: 'Schwerbehinderung', label: 'Schwerbehinderung', ref: '§ 7 Abs. 4', maxPct: 25, muster: /schwerbehind|\bgdb\b/},
  {key: 'gewinnung', kurz: 'Gewinnung/Halten', label: 'Gewinnung oder Halten herausragender Lehrender', ref: '§ 7 Abs. 5', maxPct: 50, muster: /gewinn|halten|herausrag|bleibe/},
  {key: 'forschung', kurz: 'Forschung/Transfer', label: 'Forschung, Entwicklung, Wissens- und Technologietransfer', ref: '§ 9 Satz 1', p9: true, forschung: true, muster: /forsch|entwickl|transfer/},
  {key: 'funktion', kurz: 'Aufgabe/Funktion', label: 'Besondere Aufgabe oder Funktion (Labor, Rechenzentrum, Sammlung, Praktikantenbetreuung u. a.)', ref: '§ 9 Satz 1', p9: true,
    muster: /labor|rechenzentr|sammlung|bibliothek|praktikant|funktion|dekan|aufgabe|leitung/},
  {key: 'extern', kurz: 'außerhalb der Hochschule', label: 'Aufgaben außerhalb der Hochschule', ref: '§ 16', muster: /extern|ausserhalb/},
  {key: 'befreiung', kurz: 'Befreiung', label: 'Befreiung wegen Überangebots in der Lehre', ref: '§ 12', muster: /befreiung|uberangebot|ueberangebot/},
];

/** Veranstaltungsarten für das Blatt „Lehre“ und ihre Gewichtung (§ 14 Abs. 1 mit Anlage Nr. 1 und 3).
 *  betreuung: Betreuung von Abschlussarbeiten, höchstens betreuungMax LVS je Semester (§ 15);
 *  uebertrag: Kontostand des Zeitkontos aus der Zeit vor der Erfassung (zählt nicht als Lehre des Semesters). */
const LEHRARTEN_FH = [
  {key: 'vorlesung', kurz: 'Vorlesung', faktor: 1, ref: 'Anlage Nr. 1', muster: /vorles|^v$|^vl$/},
  {key: 'uebung', kurz: 'Übung', faktor: 1, ref: 'Anlage Nr. 1', muster: /ubung|uebung|^u$|^ue$|^ü$/},
  {key: 'seminar', kurz: 'Seminar', faktor: 1, ref: 'Anlage Nr. 1', muster: /seminar|^s$|^su$/},
  {key: 'praktikum', kurz: 'Praktikum', faktor: 1, ref: 'Anlage Nr. 1', muster: /praktik|labor|^p$|^pr$/},
  {key: 'kolloquium', kurz: 'Kolloquium/Repetitorium', faktor: 1, ref: 'Anlage Nr. 1', muster: /kolloq|repetit/},
  {key: 'exkursion', kurz: 'Exkursion', faktor: 0.3, ref: 'Anlage Nr. 3 i. V. m. Nr. 2.3', muster: /exkursion|anschauung/},
  {key: 'betreuung', kurz: 'Betreuung Abschlussarbeiten', faktor: 1, ref: '§ 15', betreuung: true, muster: /betreuung|abschlussarb|bachelorarb|masterarb|thesis/},
  {key: 'uebertrag', kurz: 'Übertrag Zeitkonto', faktor: 1, ref: '§ 11 Abs. 3', uebertrag: true, muster: /ubertrag|uebertrag|kontostand|saldo/},
];

export const LVVO_FASSUNGEN = [
  {
    gueltigAb: '2018-09-10',
    titel: 'LVVO Niedersachsen, Fachhochschulen',
    fassung: 'VO vom 3.9.2018 (Nds. GVBl. S. 181), zuletzt geändert am 26.8.2024 (Nds. GVBl. Nr. 74/2024)',
    quelle: 'https://www.schure.de/22210/lvvo.htm',
    gruppen: GRUPPEN_FH,
    gruende: GRUENDE_FH,
    lehrarten: LEHRARTEN_FH,
    // § 14 Abs. 2: Veranstaltungen mit Faktor ≥ 0,5 ohne ständige Anwesenheit der Lehrperson zählen zu drei Zehnteln
    nichtAnwesend: {faktor: 0.3, ab: 0.5, muster: /nicht standig|nicht staendig|ohne standige|ohne staendige|unbeaufsichtigt/, ref: '§ 14 Abs. 2'},
    // § 9 Satz 2 und 3: Ermäßigungen nach § 9 insgesamt höchstens 7 % der Regellehrverpflichtungen des Lehrpersonals
    // der Fachhochschule, bis 10 %, soweit Lehrverpflichtungen nach § 5 Abs. 2 (WiMi) erfüllt werden;
    // je Professur höchstens 4 LVS, für Forschung/Entwicklung/Transfer höchstens 9 LVS.
    p9: {quote: 7, quoteErweitert: 10, profMax: 4, profMaxForschung: 9, ref: '§ 9 Satz 2 und 3'},
    // § 11: Verteilung über sechs Semester (je Semester mindestens die Hälfte); Zeitkonto an Fachhochschulen:
    // Guthaben über dem Zweifachen der Regellehrverpflichtung verfällt, Fehlbetrag höchstens einmal die Regellehrverpflichtung.
    erfuellung: {semester: 6, mindestanteil: 0.5, kappung: 2, fehlbetrag: 1, ref: '§ 11'},
    // § 3 Abs. 2 Nr. 2: Vorlesungszeit an Fachhochschulen
    vorlesungswochen: {SS: 18, WS: 19, ref: '§ 3 Abs. 2'},
    // § 15: Betreuung von Abschlussarbeiten bis 2 LVS je Semester
    betreuungMax: {lvs: 2, ref: '§ 15'},
  },
];

/** Die am Tag D geltende Fassung (Tage seit 1970, wie im übrigen Code). */
export function lvvoFassung(D) {
  const iso = d => Math.round(Date.parse(d + 'T00:00:00Z') / 864e5);
  const gilt = LVVO_FASSUNGEN.filter(f => iso(f.gueltigAb) <= D).sort((a, b) => iso(b.gueltigAb) - iso(a.gueltigAb));
  return gilt[0] || LVVO_FASSUNGEN[0];
}

const norm = s => String(s ?? '').toLowerCase().replace(/ß/g, 'ss').replace(/[äöü]/g, c => ({ä: 'a', ö: 'o', ü: 'u'}[c]));

/** Wert der Spalte „LVVO-Gruppe“ in einen Gruppenschlüssel übersetzen; null = nicht erkannt. */
export function parseLvvoGruppe(raw) {
  const s = norm(raw).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (/^(prof|professur|professor)/.test(s)) return 'prof';
  if (/lfba|lehrkraft/.test(s)) {
    if (/24|unter|gehoben/.test(s)) return 'lfba24';
    if (/20|ab |hoher|hoeher/.test(s)) return 'lfba20';
    return null;
  }
  if (/wimi|wiss/.test(s)) return /quali|4\b|befrist/.test(s) ? 'wimiQ' : 'wimi';
  if (/^(keine|kein|-|–|0|nein)$/.test(s)) return 'keine';
  return null;
}

/** Veranstaltungsart aus Freitext erkennen; null = unbekannt. */
export const lehrartKey = (raw, fassung = LVVO_FASSUNGEN[0]) => (fassung.lehrarten.find(a => a.muster.test(norm(raw).trim())) || {}).key || null;
/** Hinweis „nicht ständig anwesend“ (§ 14 Abs. 2) im Freitext der Art? */
export const nichtAnwesend = (raw, fassung = LVVO_FASSUNGEN[0]) => fassung.nichtAnwesend.muster.test(norm(raw));

/** Ermäßigungsgrund aus Freitext erkennen; null = unbekannt. */
export const grundKey = (raw, fassung = LVVO_FASSUNGEN[0]) => (fassung.gruende.find(g => g.muster.test(norm(raw))) || {}).key || null;
