# Schatten-Test in Sturmzone und am Rhein

Am 18. November 2026 wurden beide Außenszenen mit Dauerfeuer und Explosionen vor und nach dem Schatten-Fix `f2626fa` gemessen. Als Referenz diente `153260c`, als aktueller Stand `8168b67`. Beide Stände nutzten dieselbe Testszene pro Karte.

Die Messung lief in Chrome mit Hardwarebeschleunigung auf einer Intel Iris Xe (ANGLE/D3D11), bei 1280 × 720 Pixeln und in der Grafikstufe „Flüssig“. Pro Durchlauf erzeugten acht Figuren über rund 13 Sekunden 1.040 Schuss- und 27 Explosionsereignisse. In Sturmzone lief zuerst die Referenz, am Rhein zuerst die Version mit Fix.

| Messwert | Sturmzone vor → nach | Rhein vor → nach |
| --- | ---: | ---: |
| Gemessene Bilder | 774 → 776 | 774 → 772 |
| Durchschnittliche FPS | 60,0 → 60,0 | 60,0 → 60,0 |
| Bildintervalle über 25 ms | 0 → 0 | 0 → 0 |
| Bildintervall (95. Perzentil) | 16,8 → 16,8 ms | 16,8 → 16,8 ms |
| CPU-Zeit (95. Perzentil) | 10,8 → 9,7 ms | 8,3 → 8,6 ms |
| GPU-Zeit gesamt (95. Perzentil) | 12,46 → 12,24 ms | 13,33 → 11,72 ms |
| GPU-Zeit für Schatten (Median) | 0,96 → 1,11 ms | 3,60 → 1,10 ms |
| Dreiecke im Schattendurchlauf | 363.031 → 363.031 | 1.478.248 → 348.664 |

In der Sturmzone stehen keine Deckungskisten, auf die der Fix angewendet wird. Am Rhein sank der Median der GPU-Zeit für den Schattendurchlauf um rund 69 %. Im Bildvergleich der getesteten Ansichten war keine Verschlechterung sichtbar. Die Messreihe auf diesem Gerät ergab keinen Anlass für weitere Änderungen am Renderer.
