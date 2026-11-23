"""Erzeugt eine synthetische Testtabelle (fiktive Personen) mit absichtlich eingebauten Fehlern."""
import random, datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font

random.seed(7)
TODAY = dt.date(2026, 11, 19)
clusters = {
    "Informatik": ["Softwaretechnik", "Data Science", "IT-Sicherheit"],
    "Elektrotechnik": ["Energietechnik", "Nachrichtentechnik"],
    "Maschinenbau": ["Konstruktion", "Fertigungstechnik", "Werkstoffe"],
    "Medientechnik": ["Mediendesign", "Audio/Video"],
}
labs = {
    "Informatik": ["Labor Verteilte Systeme", "Labor KI & Data Science", "Labor IT-Sicherheit", ""],
    "Elektrotechnik": ["Hochspannungslabor", "Labor Kommunikationstechnik", ""],
    "Maschinenbau": ["Labor Fertigungstechnik", "Werkstoffprüflabor", "Labor CAD/CAE", ""],
    "Medientechnik": ["Tonstudio", "Labor Bewegtbild", ""],
}
nach = ["Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann","Koch","Richter","Klein","Wolf","Schröder","Neumann","Schwarz","Braun","Zimmermann","Krüger","Hartmann","Lange","Werner","Krause","Lehmann","Köhler","Maier","Huber","Kaiser","Fuchs","Peters","Lang","Scholz","Möller","Weiß","Jung","Hahn","Vogel","Keller","Günther","Frank","Berger","Roth","Beck","Lorenz","Baumann","Franke","Albrecht"]
vor = ["Anna","Lena","Julia","Sarah","Laura","Lisa","Maria","Katharina","Sophie","Johanna","Jonas","Lukas","Felix","Paul","Leon","Tim","Jan","David","Moritz","Simon","Thomas","Michael","Stefan","Andreas","Claudia","Petra","Sabine","Martin","Markus","Frank"]

kreise = [  # name, tarif options, befristet-wahrsch., anzahl je cluster
    ("Professor/in", ["W2", "W3"], 0.05, 14),
    ("LfbA", ["E13", "E14"], 0.4, 4),
    ("Wiss. Mitarbeiter/in", ["E13", "E13", "E14"], 0.85, 16),
    ("Technische/r Mitarbeiter/in", ["E9a", "E10", "E11"], 0.2, 6),
    ("Verwaltung", ["E6", "E8", "E9a"], 0.15, 3),
]

def d(y, m, day): return dt.date(y, m, day)

def rnd_end():
    y = random.randint(2025, 2032)
    return random.choice([d(y, 2, 28), d(y, 8, 31), d(y, 3, 31), d(y, 9, 30), d(y, 12, 31)])

rows = []
pn = 100000
for cl, oes in clusters.items():
    scale = 1.4 if cl == "Informatik" else (0.6 if cl == "Medientechnik" else 1.0)
    for kreis, tarifs, pbef, n in kreise:
        for _ in range(max(1, round(n * scale))):
            pn += random.randint(1, 30)
            bef = random.random() < pbef
            arb = 100 if kreis == "Professor/in" else random.choice([100, 100, 100, 75, 50, 50])
            beginn = d(random.randint(2005, 2026), random.choice([3, 9, 1, 4, 10]), 1)
            ende = None
            if bef:
                ende = rnd_end()
                if ende <= beginn: beginn = d(ende.year - 3, 9, 1)
            kw = "x" if bef and random.random() < 0.35 else ""
            rows.append([pn, random.choice(nach), random.choice(vor), kreis, arb, arb / 100,
                         random.choice(tarifs), "befristet" if bef else "unbefristet", beginn, ende, kw,
                         cl, random.choice(oes), random.choice(labs[cl])])

# zukünftige Einstellungen
for cl, kreis, tg in [("Informatik", "Professor/in", "W2"), ("Elektrotechnik", "Wiss. Mitarbeiter/in", "E13"),
                      ("Maschinenbau", "LfbA", "E13")]:
    pn += 7
    rows.append([pn, random.choice(nach), random.choice(vor), kreis, 100, 1.0, tg,
                 "befristet" if kreis != "Professor/in" else "unbefristet", d(2027, 3, 1),
                 d(2030, 2, 28) if kreis != "Professor/in" else None, "", cl, clusters[cl][0], labs[cl][0]])

# Nachfolge: neue Professur ab 01.09.2027, Ruhestand einer Professur zum 29.02.2028 (gleicher Cluster)
pn += 11
rows.append([pn, "Neumann", "Clara", "Professor/in", 100, 1.0, "W2", "unbefristet", d(2027, 9, 1), None, "",
             "Maschinenbau", "Konstruktion", labs["Maschinenbau"][2]])
pn += 5
rows.append([pn, "Albrecht", "Wolfgang", "Professor/in", 100, 1.0, "W3", "unbefristet", d(1998, 9, 1), d(2028, 2, 29), "",
             "Maschinenbau", "Konstruktion", labs["Maschinenbau"][2]])

# ---- absichtlich eingebaute Fehler ----
rows[3][0] = rows[2][0]                      # doppelte Personalnummer (andere Person)
rows[10][8], rows[10][9] = d(2027, 9, 1), d(2025, 8, 31); rows[10][7] = "befristet"  # Beginn nach Ende
rows[15][5] = 0.75                           # VZÄ passt nicht zu ArbAnteil
rows[22][11] = ""                            # Cluster fehlt
rows[30][7], rows[30][9], rows[30][10] = "unbefristet", None, "x"  # kw ohne Vertragsende
rows[40][6] = "E13"; rows[40][3] = "Professor/in"   # Professor mit E-Tarif
rows[50][4], rows[50][5] = 120, 1.2           # ArbAnteil > 100
rows[60][11] = "Informatk"                   # Tippfehler Cluster
rows[61][11] = "Informatik "                 # Leerzeichen
rows[70][7], rows[70][9] = "befristet", None  # befristet ohne Ende
rows[80][2] = ""                             # Vorname fehlt
rows[90][10] = "vielleicht"                  # unklarer kw-Wert
rows[95][9] = d(2024, 2, 29)                 # bereits ausgelaufen
dup = list(rows[100]); rows.append(dup)       # exaktes Duplikat

# ---- Lehrdeputat (SWS je Semester), deterministisch aus Mitarbeiterkreis, Anteil und Personalnummer ----
def deputat(r):
    pn, kreis, arb = r[0], r[3], r[4] or 0
    if kreis == "Professor/in": return round(18 * arb / 100, 2)
    if kreis == "LfbA": return round(20 * arb / 100, 2)
    if kreis == "Wiss. Mitarbeiter/in": return 4 if pn % 3 == 0 else 0      # Deputat 0 = nur unterstützend
    if kreis == "Technische/r Mitarbeiter/in": return 0
    return None                                                            # Verwaltung: keine Angabe
for r in rows: r.append(deputat(r))
# absichtlich eingebaute Fehler beim Deputat
rows[5][14] = 0           # Professur mit Deputat 0
rows[12][14] = -4         # negatives Deputat
rows[20][14] = "n.n."     # keine Zahl

# ---- „ruht bis“: Vertrag ruht bis zu diesem Datum (z. B. Elternzeit, Beurlaubung) ----
RUHT = len(rows[0])          # Spaltenindex der neuen Spalte
for r in rows: r.append(None)
skip = {2, 3, 5, 10, 12, 15, 20, 22, 30, 40, 50, 60, 61, 70, 80, 90, 95, 100}
def pick(kreis, cond):
    for i, r in enumerate(rows[:-3]):
        if i not in skip and r[3] == kreis and r[8] and r[8] <= TODAY and (r[9] is None or r[9] > TODAY) and cond(r):
            skip.add(i); return r
pick("Wiss. Mitarbeiter/in", lambda r: r[9] and r[9] > d(2028, 6, 1))[RUHT] = d(2027, 8, 31)   # ruht, kehrt zurück
pick("Professor/in", lambda r: r[9] is None)[RUHT] = d(2027, 2, 28)                          # ruht, kehrt zurück
pick("LfbA", lambda r: True)[RUHT] = d(2028, 2, 29)                                          # ruht, kehrt zurück
pick("Technische/r Mitarbeiter/in", lambda r: True)[RUHT] = d(2026, 6, 30)                   # Ruhen bereits beendet
pick("Wiss. Mitarbeiter/in", lambda r: r[9] and r[9] < d(2028, 1, 1))[RUHT] = d(2030, 1, 31) # Fehler: ruht über Vertragsende hinaus
pick("Verwaltung", lambda r: True)[RUHT] = "bald"                                            # Fehler: kein Datum

# ---- „Ruhestand“: voraussichtliches Ausscheiden bei unbefristeten Verträgen; Vertragsende nur bei Zeitverträgen ----
import calendar
RUHESTAND = len(rows[0])
def monatsende(y, m): return d(y, m, calendar.monthrange(y, m)[1])
for r in rows:
    r.append(None)
    if r[7] == "unbefristet" and r[9] is None and r[0] % 5 in (0, 1, 2):
        r[RUHESTAND] = monatsende(2027 + r[0] % 14, r[0] % 12 + 1)
for r in rows:
    if r[1] == "Albrecht" and r[2] == "Wolfgang":              # Nachfolgefall: Ruhestand statt Vertragsende
        r[RUHESTAND], r[9] = r[9], None
# absichtlich eingebaute Fehler/Sonderfälle
befr = [i for i, r in enumerate(rows[:-3]) if r[7] == "befristet" and r[9] and r[9] > d(2029, 1, 1) and i not in (100,)]
rows[befr[0]][RUHESTAND] = d(2028, 7, 31)                     # Ruhestand vor Ende des Zeitvertrags
unbefr = [i for i, r in enumerate(rows[:-3]) if r[7] == "unbefristet" and r[9] is None and r[RUHESTAND] is None and i not in (30, 100)]
rows[unbefr[0]][9] = d(2031, 3, 31)                           # Altbestand: Ruhestand im Vertragsende eingetragen
rows[unbefr[1]][RUHESTAND] = "irgendwann"                     # kein Datum

# ---- „Vertretung für“: Personalnummer der Person, deren (ruhende) Stelle vertreten wird ----
VERTRETUNG = len(rows[0])
for r in rows: r.append(None)
ruhend = {r[1]: r for r in rows if isinstance(r[RUHT], dt.date) and r[RUHT] > TODAY and (r[9] is None or r[9] > r[RUHT])}
def vertretung(v, vorname, name, beginn, ende):
    global pn
    pn += 3
    nr = [None] * len(rows[0])
    nr[:14] = [pn, name, vorname, v[3], v[4], v[5], v[6], "befristet", beginn, ende, "", v[11], v[12], v[13]]
    if "deputat" in globals(): nr[14] = deputat(nr)
    nr[VERTRETUNG] = v[0]
    rows.append(nr)
vertretung(ruhend["Krause"], "Lea", "Vogt", d(2026, 3, 1), ruhend["Krause"][RUHT])          # passt genau
vertretung(ruhend["Weber"], "Jan", "Brandt", d(2026, 9, 1), d(2027, 3, 31))                 # endet 1 Monat nach der Ruhe
vertretung(ruhend["Wagner"], "Mia", "Seidel", d(2026, 9, 1), d(2027, 8, 31))                # Lücke bis zur Rückkehr
aktiv = next(r for r in rows if r[3] == "Professor/in" and r[RUHT] is None and r[9] is None and r[8] and r[8] < TODAY)
vertretung(aktiv, "Tom", "Ernst", d(2026, 10, 1), d(2027, 9, 30))                             # Fehler: vertretene Person ruht nicht
vertretung(ruhend["Weber"], "Ida", "Hahn", d(2026, 10, 1), d(2027, 2, 28)); rows[-1][VERTRETUNG] = 999999   # Fehler: unbekannte Nummer

wb = Workbook()
ws = wb.active; ws.title = "Personal"
hdr = ["Personalnummer", "Name", "Vorname", "Mitarbeiterkreis", "ArbAnteil", "VZÄ", "TrfGr", "Vertragsart",
       "Beginn", "Vertragsende", "kw", "Cluster", "Organisationseinheit", "Laborbereich", "Deputat"]
hdr.append("ruht bis"); hdr.append("Ruhestand"); hdr.append("Vertretung für")
ws.append(hdr)
for r in rows: ws.append(r)
for c in ws[1]: c.font = Font(bold=True)
for col in "IJ":
    for cell in ws[col][1:]: cell.number_format = "DD.MM.YYYY"
from openpyxl.utils import get_column_letter
for cell in ws[get_column_letter(RUHT + 1)][1:]: cell.number_format = "DD.MM.YYYY"
for cell in ws[get_column_letter(RUHESTAND + 1)][1:]: cell.number_format = "DD.MM.YYYY"

ws2 = wb.create_sheet("Studierende")
ws2.append(["Studiengang", "Cluster", "Art", "CNW", "Studienplätze", "Studierende"])
for r in [("Informatik B.Sc.", "Informatik", "Bachelor", 6.4, 90, 820),
          ("Informatik M.Sc.", "Informatik", "Master", 2.6, 35, 260),
          ("Wirtschaftsinformatik B.Sc.", "Informatik", "Bachelor", 5.8, 55, 410),
          ("Elektrotechnik B.Sc.", "Elektrotechnik", "Bachelor", 7.2, 75, 380),
          ("Elektrotechnik M.Sc.", "Elektrotechnik", "Master", 2.9, 30, 95),
          ("Maschinenbau B.Sc.", "Maschinenbau", "Bachelor", 7.0, 85, 540),
          ("Maschinenbau M.Sc.", "Maschinenbau", "Master", 2.8, 30, 130),
          ("Medientechnik B.Sc.", "Medientechnik", "Bachelor", 6.8, 50, 300),
          ("Robotik M.Sc.", "Mechatronik", "M.Sc.", None, 25, 60)]:   # Cluster ohne Personal, CNW fehlt
    ws2.append(list(r))
for c in ws2[1]: c.font = Font(bold=True)
wb.save("testdaten/Testdaten_Personalplanung.xlsx")
print(len(rows), "Zeilen")
