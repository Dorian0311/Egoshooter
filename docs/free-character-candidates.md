# Kostenlose Figurenkandidaten · 16. November 2026

Microsoft Rocketbox Male_Adult_03 ist als Stadtbewohner eingebunden. Die übrigen
hier genannten Modelle bleiben Kandidaten. Die heruntergeladenen Originale bleiben
unter dem ignorierten Ordner `research/free-characters/`; ausgeliefert wird nur das
vorbereitete Laufzeitmodell mit Lizenz und Herkunftsnachweis.

## Eingebauter Stadtbewohner

[Microsoft Rocketbox Male_Adult_03](https://github.com/microsoft/Microsoft-Rocketbox/tree/0943055db6ec570bcef9f2c8b41c9e5467c808f9/Assets/Avatars/Adults/Male_Adult_03)
mit Sakko, langer Hose und Lederschuhen. Kostenlose
[MIT-Lizenz](https://github.com/microsoft/Microsoft-Rocketbox/blob/0943055db6ec570bcef9f2c8b41c9e5467c808f9/LICENSE.md).

- Laufzeitdatei: `public/shooter/characters/civilian/civilian-male.glb`.
- 9.266.020 Bytes, 7.200 Dreiecke, 80 Skin-Knochen, drei Materialprimitives statt
  neun; ursprüngliche Geometrie, UVs und 1024px-Texturen erhalten.
- SHA-256: `7a28fd96e85e29e043dda06f5f4b685a5bf0a6297b1e41d107f86a9c7f7f41ff`.
- Quellcommit, Originaldateien, Verarbeitung und Prüfsummen stehen im benachbarten
  `manifest.json`; `LICENSE.md` enthält den unveränderten Microsoft-MIT-Lizenztext.
- Im echten lokalen WebGL-Renderer geprüft: Front, 45 Grad und Seite bei Stehen,
  Gehen und Mittelfingergeste. Schwarze Haar-Overlays werden ausgeblendet; die
  originale texturierte Kopfhaut bleibt erhalten. Ruhehände folgen dem nativen Rig.
- Beide Arme, beide Beine und Kopf lassen sich als Originalgeometrie abtrennen;
  Wiederherstellung stellt die ursprüngliche Topologie vollständig wieder her.
  Kroenen und Deadpool behalten Beinbewegung und korrekten Waffengriff.
- Reproduzierbare Browserprüfung: `tests/civilian-browser.py`; 17 Ansichten und
  JSON-Bericht unter `artifacts/movement-combat-20261116/civilian-quality/`, ohne
  JavaScript-Seitenfehler. Die Fixture hält ihren Code für die Prüfung konstant.
- Der Gang bleibt eine prozedurale Animation. Das Sakko ist keine bestätigte
  historische Uniform; dieses Modell ersetzt keine Bonusfigur.

Der unveränderte Forschungskandidat bleibt unter
`research/free-characters/rocketbox-male-adult-03/` mit seinem ursprünglichen
Prüfprotokoll erhalten.

Ein zweiter vollständig beschaffter Kandidat, Male_Adult_01, trägt Polo und Shorts
und passt deshalb weniger gut zur Spielzeit. Sein unverkleinerter Forschungs-GLB
liegt separat unter `research/free-characters/rocketbox-male-adult-01/`.

## Soldatenkandidat

[WW2 Panzergrenadier 2k](https://sketchfab.com/3d-models/ww2-panzergrenadier-2k-cc0-6a104431bcb8400080b79446ec019696)
von britdawgmasterfunk: 27.005 Dreiecke laut öffentlicher Modellmetadaten;
der Autor beschreibt einen Mixamo-Rig und 2k-PBR-Texturen. Der offizielle Download
antwortete ohne Anmeldung mit HTTP 401. Das Modell wurde nicht heruntergeladen.
Die Beschreibung nennt CC0, die Plattformmetadaten CC BY 4.0; beides ist im lokalen
Rechercheprotokoll festgehalten. Vor einer Einbindung sind Originaldownload und
Quellenangaben zu klären.

Deadpool bleibt erhalten. Für die bestehenden Bonusfiguren wurde kein kostenloses,
sichtbar besseres gleichnamiges Ersatzmodell bestätigt. Bis zur gezielten Einbindung
eines geprüften Ersatzes arbeiten die Spielmechaniken mit den vorhandenen Figuren.
