// Varianten eines Blatts „Ermäßigungen“, wie sie in echten Tabellen vorkommen (für ermaessigungen-blatt.test.js).
// Jede Variante: Blattname, Zeilen (erste Zeilen ggf. Titel), erwartete Zahl gelesener Ermäßigungen,
// optional placeFirst (Blatt steht vor dem Personalblatt).
'use strict';
const d = s => s;   // Datumswerte als Text; die App liest „01.09.2026“
module.exports = [
  {name: 'Standard', sn: 'Ermäßigungen', rows: [['Personalnummer', 'Grund', 'LVS', 'Prozent', 'von', 'bis'], ['{P1}', 'Forschung', 4, null, d('01.09.2026'), d('31.08.2027')]], n: 1},
  {name: 'Kurzformen', sn: 'Ermäßigungen', rows: [['Pers.-Nr.', 'Ermäßigung', 'Umfang (LVS)', 'Beginn', 'Ende'], ['{P1}', 'Laborleitung', 2, d('01.09.2026'), null]], n: 1},
  {name: 'Begründung, ab/bis', sn: 'Ermäßigungen', rows: [['Personalnummer', 'Begründung', 'LVS', 'ab', 'bis'], ['{P1}', 'Forschung', 3, d('01.09.2026'), null]], n: 1},
  {name: 'Art der Ermäßigung, in LVS, gültig von/bis', sn: 'Ermäßigungen', rows: [['Personalnummer', 'Name', 'Vorname', 'Art der Ermäßigung', 'Ermäßigung in LVS', 'gültig von', 'gültig bis'], ['{P1}', 'X', 'Y', 'Forschung', 2, d('01.09.2026'), null]], n: 1},
  {name: 'Titelzeile über der Tabelle', sn: 'Ermäßigungen', rows: [['Ermäßigungen der Lehrverpflichtung 2026'], [], ['Personalnummer', 'Grund', 'LVS', 'von', 'bis'], ['{P1}', 'Forschung', 4, null, null]], n: 1},
  {name: 'Zweizeiliger Kopf (Zeitraum über von/bis)', sn: 'Ermäßigungen', rows: [[null, null, null, 'Zeitraum', null], [null, null, null, 'von', 'bis'], ['Personalnummer', 'Grund', 'LVS', null, null], ['{P1}', 'Forschung', 4, null, null]], n: 1},
  {name: 'Zeitraum-Zeile vor dem Kopf', sn: 'Ermäßigungen', rows: [['', '', 'Zeitraum von', 'Zeitraum bis'], ['Personalnummer', 'Grund', 'von', 'bis', 'LVS'], ['{P1}', 'Forschung', null, null, 4]], n: 1},
  {name: 'Grund der Ermäßigung, SWS', sn: 'Ermäßigungen', rows: [['PersNr', 'Grund der Ermäßigung', 'Ermäßigung (SWS)', 'von', 'bis'], ['{P1}', 'Forschung', 2, null, null]], n: 1},
  {name: 'Blatt mit Personenspalten vor dem Personalblatt', sn: 'Ermäßigungen', placeFirst: true,
    rows: [['Personalnummer', 'Name', 'Vorname', 'Mitarbeiterkreis', 'Cluster', 'Organisationseinheit', 'Grund', 'LVS', 'von', 'bis'], ['{P1}', 'X', 'Y', 'Professor/in', 'Informatik', 'OE', 'Forschung', 4, null, null]], n: 1},
  {name: 'Nur Personalnummer und Grund im Blatt „Ermäßigungen“ (Umfang in Spalte „Stunden“)', sn: 'Ermäßigungen', rows: [['Personalnummer', 'Ermäßigungstatbestand', 'Stunden'], ['{P1}', 'Studienfachberatung', 2]], n: 1},
  {name: 'Führende Nullen in der Personalnummer', sn: 'Ermäßigungen', rows: [['Personalnummer', 'Grund', 'LVS'], ['00{P1}', 'Forschung', 4]], n: 1, matchesPerson: true},
  {name: 'Personalnummer mit Leerzeichen', sn: 'Ermäßigungen', rows: [['Personalnummer', 'Grund', 'LVS'], [' {P1} ', 'Forschung', 4]], n: 1, matchesPerson: true},
];
