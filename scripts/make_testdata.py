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
labs = ["Labor A", "Labor B", "Labor C", ""]
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
                         cl, random.choice(oes), random.choice(labs)])

# zukünftige Einstellungen
for cl, kreis, tg in [("Informatik", "Professor/in", "W2"), ("Elektrotechnik", "Wiss. Mitarbeiter/in", "E13"),
                      ("Maschinenbau", "LfbA", "E13")]:
    pn += 7
    rows.append([pn, random.choice(nach), random.choice(vor), kreis, 100, 1.0, tg,
                 "befristet" if kreis != "Professor/in" else "unbefristet", d(2027, 3, 1),
                 d(2030, 2, 28) if kreis != "Professor/in" else None, "", cl, clusters[cl][0], ""])

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

wb = Workbook()
ws = wb.active; ws.title = "Personal"
hdr = ["Personalnummer", "Name", "Vorname", "Mitarbeiterkreis", "ArbAnteil", "VZÄ", "TrfGr", "Vertragsart",
       "Beginn", "Vertragsende", "kw", "Cluster", "Organisationseinheit", "Laborbereich"]
ws.append(hdr)
for r in rows: ws.append(r)
for c in ws[1]: c.font = Font(bold=True)
for col in "IJ":
    for cell in ws[col][1:]: cell.number_format = "DD.MM.YYYY"

ws2 = wb.create_sheet("Studierende")
ws2.append(["Studiengang", "Cluster", "Studierende"])
for r in [("Informatik B.Sc.", "Informatik", 820), ("Informatik M.Sc.", "Informatik", 260),
          ("Wirtschaftsinformatik B.Sc.", "Informatik", 410), ("Elektrotechnik B.Sc.", "Elektrotechnik", 380),
          ("Elektrotechnik M.Sc.", "Elektrotechnik", 95), ("Maschinenbau B.Sc.", "Maschinenbau", 540),
          ("Maschinenbau M.Sc.", "Maschinenbau", 130), ("Medientechnik B.Sc.", "Medientechnik", 300),
          ("Robotik M.Sc.", "Mechatronik", 60)]:   # Cluster ohne Personal
    ws2.append(list(r))
for c in ws2[1]: c.font = Font(bold=True)
wb.save("testdaten/Testdaten_Personalplanung.xlsx")
print(len(rows), "Zeilen")
