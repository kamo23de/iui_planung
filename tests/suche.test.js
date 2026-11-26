// Globale Suche: Personen, Laborbereiche und Organisationseinheiten
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {setup} = require('./helpers');

const PEOPLE = [
  {pnr: 101, name: 'Ferber', vorname: 'Anna', cluster: 'Maschinenbau', oe: 'Fertigungstechnik', labor: 'Labor Fertigungstechnik'},
  {pnr: 102, name: 'Müller', vorname: 'Jan', cluster: 'Maschinenbau', oe: 'Werkstoffe', labor: 'Werkstoffprüflabor'},
  {pnr: 103, name: 'Schulz', vorname: 'Fernando', cluster: 'Informatik', oe: 'IT-Sicherheit', labor: 'Labor IT-Sicherheit'},
  {pnr: 104, name: 'Weber', vorname: 'Eva', cluster: 'Elektrotechnik', oe: 'Energietechnik', labor: 'Labor Fertigungstechnik'},   // gleicher Labor-Name, anderer Cluster
  {pnr: 105, name: 'Alt', vorname: 'Otto', cluster: 'Maschinenbau', oe: 'Fertigungstechnik', labor: 'Labor Fertigungstechnik', ende: '31.12.2025'},   // ausgelaufen
];
const view = m => [...m].map(x => x.type === 'person' ? `P ${x.r.name}` : `${x.type === 'labor' ? 'L' : 'O'} ${x.u.name} (${x.u.cluster})`);

test('Reihenfolge: erst Personen, dann Laborbereiche, dann Organisationseinheiten', () => {
  const {get} = setup(PEOPLE);
  assert.deepEqual(view(get('gsMatches')('fer')), [
    'P Ferber',                                       // Nachname
    'P Schulz',                                       // Vorname Fernando
    'L Labor Fertigungstechnik (Elektrotechnik)',     // Wortanfang im Namen, je Cluster einmal
    'L Labor Fertigungstechnik (Maschinenbau)',
    'O Fertigungstechnik (Maschinenbau)',
  ]);
});

test('Laborbereiche und OEs: Anfang des Namens vor Wortanfang, Trennzeichen Leerzeichen und Bindestrich', () => {
  const {get} = setup(PEOPLE);
  assert.deepEqual(view(get('gsMatches')('sicher')), ['L Labor IT-Sicherheit (Informatik)', 'O IT-Sicherheit (Informatik)']);
  assert.deepEqual(view(get('gsMatches')('labor')), ['L Labor Fertigungstechnik (Elektrotechnik)', 'L Labor Fertigungstechnik (Maschinenbau)', 'L Labor IT-Sicherheit (Informatik)']);
  assert.deepEqual(view(get('gsMatches')('tung')), []);   // nicht mitten im Wort
});

test('Umlaute und Akzente werden ignoriert', () => {
  const {get} = setup(PEOPLE);
  assert.deepEqual(view(get('gsMatches')('werkstoffpruf')), ['L Werkstoffprüflabor (Maschinenbau)']);
  assert.deepEqual(view(get('gsMatches')('mul')), ['P Müller']);
});

test('Vervollständigung: Schlüssel ab dem passenden Wort, gemeinsamer Anfang über alle Gruppen', () => {
  const {get} = setup(PEOPLE);
  const m = get('gsMatches')('ferti');
  assert.deepEqual([...new Set(m.map(x => x.key))], ['Fertigungstechnik']);
  assert.equal(get('gsCommonPrefix')([...new Set(get('gsMatches')('fer').map(x => x.key))]), 'Fer');
});

test('Anzahl aktiver Personen je Laborbereich und OE', () => {
  const {get} = setup(PEOPLE);
  const u = get('gsUnits')();
  const lab = u.labor.find(x => x.name === 'Labor Fertigungstechnik' && x.cluster === 'Maschinenbau');
  assert.equal(lab.n, 1);   // Otto Alt ist ausgelaufen
  assert.equal(u.oe.length, 4);
  assert.equal(u.labor.length, 4);
});
