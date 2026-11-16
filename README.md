# Egoshooter · Altstadt 1945

Server-authoritative multiplayer browser shooter. React / Three.js client, Colyseus 0.18 server, PostgreSQL results, Microsoft Entra integration through SupportHub. Four playable maps with imported textured weapons, photo-based materials and authored military scenery. The art remains work in progress.

## Lokal spielen

Voraussetzung: Node.js 22.13 oder neuer. Nach dem Klonen:

```sh
npm ci
npm run preview:solo
```

Im Browser `http://127.0.0.1:5173/` öffnen, ein Profil anlegen und **Alleine testen** wählen.
Unter Windows funktioniert danach auch `Start-Spiel.cmd`. Die lokale Vorschau
benötigt weder Entra-Zugang noch PostgreSQL. Spielerprofile werden lokal gespeichert.
Sie bindet ausschließlich an Loopback und ist kein öffentlicher Spielserver.

## Mit Docker hosten

**Portainer-Webeditor:** [compose.portainer.yml](compose.portainer.yml) verwenden.
Diese Variante lädt den vollständigen Build-Kontext einschließlich Dockerfile
direkt aus GitHub. Unterhalb des Editors die vier Umgebungsvariablen `GAME_HOST`,
`SHOOTER_ORIGINS`, `SHOOTER_TICKET_SECRET` und `POSTGRES_PASSWORD` setzen.
Die normale `compose.yml` setzt voraus, dass das Repository auf dem Server liegt.

**Wenn bereits ein HTTPS-Reverse-Proxy vorhanden ist:** stattdessen
[compose.portainer.proxy.yml](compose.portainer.proxy.yml) verwenden. Der Proxy
leitet HTTP und WebSockets an Server-Port **6080** weiter. In dieser Variante
übernimmt der Spiel-Stack keine HTTPS-Zertifikate und keine HTTPS-Weiterleitung.
`GAME_HOST` und `SHOOTER_ORIGINS` beschreiben weiterhin die öffentliche HTTPS-Domain.

Der vollständige Compose-Stack enthält die Weboberfläche mit HTTPS, den
Multiplayer-Server und PostgreSQL. Er benötigt Docker mit Compose v2; Node.js
wird nur für die einmalige Erzeugung der Konfiguration benötigt.

```sh
git clone https://github.com/Dorian0311/Egoshooter.git
cd Egoshooter
node scripts/configure-docker.mjs spiel.deine-domain.de
docker compose config --quiet
docker compose up -d --build
```

Die Domain muss auf den Server zeigen; TCP-Port 80 und 443 müssen erreichbar
sein. Danach `https://spiel.deine-domain.de` öffnen, Profile anlegen und denselben
Raum betreten. Caddy stellt HTTPS-Zertifikate automatisch aus. Der Spielserver
und PostgreSQL veröffentlichen keine eigenen Ports.

Das Konfigurationsskript erzeugt zufällige, unterschiedliche Geheimnisse in
einer privaten `.env` und überschreibt keine bestehende Datei. Alternativ
`.env.example` nach `.env` kopieren und die Werte selbst setzen. Zugangsdaten,
lokale Profile und Datenbanken werden weder eingecheckt noch ins Image kopiert.

Profile, Ergebnisse und Zertifikate bleiben in Docker-Volumes erhalten.
`docker compose stop` hält den Stack an, `docker compose up -d` startet ihn wieder.
`docker compose down` entfernt die Container und behält die Volumes.
**Nicht `docker compose down -v` verwenden, wenn die Daten erhalten bleiben sollen.**
Status: `docker compose ps`; letzte Meldungen: `docker compose logs --tail 50`.

Für einen lokalen Container-Test ist `localhost` als Hostname möglich; dabei
verwendet Caddy eine lokale Zertifizierungsstelle. Deren Root-Zertifikat muss
auf dem Testgerät ausdrücklich als vertrauenswürdig eingerichtet werden.
Für öffentliches Hosting eine eigene Domain mit gültigem HTTPS verwenden.

Der Workflow `Docker multiplayer` baut und startet den Stack auf Linux und
prüft HTTPS, acht echte WebSocket-Clients, PostgreSQL und den Erhalt einer
angemeldeten Sitzung nach einem Spielserver-Neustart. Standardmäßig werden
keine Container-Images veröffentlicht und kein Produktionsserver verändert.
Weitere Hinweise stehen unter [deploy/docker](deploy/docker/README.md).

## Online-Multiplayer über diesen PC

`Start-Multiplayer.cmd` erstellt den Spiel-Build und startet einen öffentlichen
Cloudflare Quick Tunnel. Der offizielle Windows-Client liegt lokal unter
`data/tunnel/cloudflared.exe` (2026.11.0; SHA-256
`d5c1d82031da6253dcdcff64c944cd0fe063016edeb2e4fd088075fc9bd52d0a`).
Alternativ lässt sich ein vorhandener Client über `CLOUDFLARED_PATH` auswählen.

Den angezeigten HTTPS-Link an Mitspieler weitergeben. Er steht außerdem in
`data/tunnel/Spiel-Link.txt`. Jeder legt ein eigenes Spielerprofil an; anschließend
einen Einsatz erstellen und denselben Raum über die Liste oder den Raumcode betreten.
Bis zu acht Spieler können gemeinsam spielen. Alle Teilnehmer wählen „Bereit“.

Der PC muss eingeschaltet, mit dem Internet verbunden und ohne Ruhezustand bleiben.
`Stop-Multiplayer.cmd` beendet auch einen im Hintergrund gestarteten Host.
Ein neuer Start erzeugt einen neuen Link. Quick Tunnels sind für Tests gedacht
und haben keine Verfügbarkeitsgarantie. Es sind weder Router-Portfreigaben noch
ein Cloudflare-Konto nötig.

Nur der fertige Client-Build und die Spiel-API werden veröffentlicht. Quellcode,
Entwicklungsserver und lokale Test-Tickets sind darüber nicht erreichbar.
Gateway (4180), Steuerung (4181) und Spielserver (2588) lauschen nur auf Loopback.
Spielerprofile bleiben in `data/users.sqlite`; Passwörter werden als scrypt-Hash
gespeichert. Ohne zusätzliche PostgreSQL-Datenbank werden keine dauerhaften
Ranglisten oder Spielergebnisse gespeichert. Die Cloudflare-Adresse ist öffentlich;
alle mit dem Link können ein Profil anlegen.

Die Anmeldung lädt den 3D-Spielcode erst nach erfolgreicher Anmeldung nach.
Der Build erzeugt Brotli-/Gzip-Kopien der Skripte und Modelldaten; der Gateway
liefert passende Dateitypen, komprimierte Varianten und Cache-Header aus.
`python scripts/optimize-network-assets.py` erzeugt bei geänderten Originalen
die 1024px-Kartentexturen und das kleinere WebP-Startbild (Pillow erforderlich).
Diese Laufzeitkopien liegen bereits unter `public/`; der normale Start benötigt
kein Python. Die Grafik startet im Auto-Modus; „Hoch“ und „Ultra“ bleiben wählbar.

Gezielte Prüfung: `node --import tsx --test tests/tunnel-gateway.test.ts`.
`node --import tsx tests/tunnel-network.ts` prüft den laufenden öffentlichen Tunnel
mit acht WebSocket-Clients und legt dafür acht `TunnelQA_*`-Profile an; anschließend
werden deren Sitzungen abgemeldet. Die Testprofile bleiben in der lokalen Datenbank.

WASD: Bewegung · Maus: Blickrichtung · rechte Maustaste: Zielen · R: Nachladen ·
1/2/3/4/5: die fünf gewählten Waffenplätze · Umschalt: Sprint · C: Ducken · Esc: Maus freigeben.

Vor jedem Einsatz wählst du zuerst deinen Charakter und danach genau fünf unterschiedliche Waffen. Zur deutschen WWII-Auswahl gehören Karabiner 98k, Luger P08, MP 40, StG 44, Gewehr 43, MG 42, MP 34, Walther P38 und FG 42. Auswahlreihenfolge und Tastenplätze stimmen überein; die Ausrüstung bleibt beim Wiedereinstieg erhalten.

Unter **Startfigur / Uniform** stehen zusätzlich Deadpool, Harley Quinn, Rocket
und Homer zur Auswahl. Diese Bonus-Skins werden bei Bedarf geladen und behalten
dieselben Spielwerte und Trefferzonen; Rocket ist dafür auf Spielerhöhe skaliert.
Die Herkunft der vom Nutzer gelieferten Modelle ist in
[PROVENANCE.md](public/shooter/characters/bonus/PROVENANCE.md) dokumentiert.

## Neue Kampf- und Komfortfunktionen

### Einzelspieler, Koop und Einsätze

Über **Einzelspieler & Koop** stehen alle vier Karten mit Training, Bot-Gefecht,
fünf Überlebenswellen und drei Missionsarten zur Verfügung. Im Bot-Gefecht ist
4 gegen 4 mit verbündeten Bots oder allein gegen ein bis vier Gegner möglich.
Sabotage und Dokumenten-Bergung enden an der Extraktion; Stellung halten verlangt
90 Sekunden Kontrolle. Missionen haben acht Minuten Zeitlimit.

Solo-Einsätze sind privat. Koop unterstützt zwei bis vier Menschen, Raumcode und
Einladungslink; alle müssen bereit sein. Nach dem Start sind keine neuen Beitritte
möglich. Überlebenswellen skalieren beim Start mit der Teilnehmerzahl. Bei einem
Solo-Verbindungsabbruch pausiert die Simulation während der zehnsekündigen
Wiederverbindungsfrist. PvE-Ergebnisse bleiben außerhalb der Community-Rangliste;
Bestwerte werden getrennt nach Einsatzkonfiguration im Browser gespeichert.

- **E:** Geschenk, Verband oder Missionsgegenstand aufnehmen; Funkstation
  sabotieren; verwundeten Mitspieler wiederbeleben. Nähe und freie Sicht sind nötig.
- **G:** einen eingesammelten Wurfstern werfen. Acht Geschenkpakete enthalten je
  drei hakenkreuzförmige Wurfsterne und können jeweils einmal pro Einsatz von einem
  Spieler eingesammelt werden. Es gibt keinen Nachschub zwischen Wellen.
- **H:** vier Sekunden lang verbinden. Vier Verband-Fundstücke pro Karte stoppen
  Blutverlust; Bewegung, Angriff und Beschuss brechen die Behandlung ab. Gliedmaßen
  und Lebenspunkte werden dadurch nicht wiederhergestellt.
- Arme und Beine sind getrennte Trefferzonen. Abtrennung durch angesammelten
  Fernkampfschaden oder Kettensäge verursacht Blutverlust. Beinverlust erzwingt
  Kriechen, Armverlust beschränkt Waffen. Normale Respawns stellen den Körper
  wieder her und erhalten eingesammelte Wurfsterne.
- Im Koop bleiben 30 Sekunden für vier Sekunden Wiederbelebung. Danach stehen
  30 Lebenspunkte ohne Blutverlust zur Verfügung; fehlende Gliedmaßen bleiben.
  Kopfverlust ist endgültig. Ohne handlungsfähige Mitspieler endet der Einsatz.
- **Karl Ruprecht Kroenen** ist als Bonusfigur mit drehbarer Vorschau verfügbar.
  Das lokale USDZ-Modell wurde mit Skelett und Texturen in GLB konvertiert.
- Standard, Nebel, Nacht und wechselnde Zugänge sind vor dem Einsatz wählbar.
  Bots berücksichtigen Sicht, Geräusche, Deckung, Verletzungen und Türen; die
  Recast-Navigationsdaten werden vor Annahme von Spielern erzeugt und je Raum
  mit den Türzuständen abgeglichen.
- Bis zu drei lokale Höhepunkte können nach dem Einsatz wiedergegeben und bei
  Browser-Unterstützung als 720p-WebM mit Spielaudio gespeichert werden. Es findet
  kein automatischer Upload statt. Kamerastöße, Gewalteffekte und neue Tasten
  sind in den Einstellungen anpassbar.

Gezielte Prüfung: `node --import tsx --test tests/operations.test.ts tests/navigation.test.ts tests/anatomy.test.ts tests/highlights.test.ts`.
`node --import tsx tests/operation-network.ts` prüft separate lokale Server/Clients
mit In-Memory-Profilen. Die visuellen Prüfseiten unter `tests/` sind ausschließlich
für Vite-Entwicklung bestimmt und sind kein Bestandteil des Produktionsbuilds.
Audio-Herkunft: `public/shooter/audio/CREDITS.json`; Bot-Referenz und Abhängigkeiten:
`THIRD_PARTY_NOTICES.md`.

- Charakter-Slider mit drehbarer 3D-Vorschau, Pfeiltasten und gespeicherter Auswahl.
- Einstellungen für Maus- und Zielempfindlichkeit, Sichtfeld, Lautstärke und Tastenbelegung; Speicherung im Browser.
- Waffen besitzen unterschiedliche Grundstreuung, Feuerraten, Rückstoß und Schadensabfall. Die Maschinenpistole ist für kurze, das G36 für größere Entfernungen ausgelegt.
- Leatherface kann seine Kettensäge als einen der fünf Plätze wählen und auch Schusswaffen verwenden. Werte der Kettensäge: 2,2 m Reichweite, 38 Schaden alle 320 ms. Angriff halten aktiviert 2,2 Sekunden Schub mit 9,2 m/s (nur während des Angriffs und ohne Ducken), danach folgen 7 Sekunden Erholung. Normale Nahkampfangriffe bleiben während der Erholung möglich.
- Killfeed, Beschussrichtung, Todesursache und Powermodus-Anzeige ergänzen das HUD. Namensschilder zeigen andere lebende Spieler bis 45 m Entfernung; Wände verdecken sie.
- Eigene tödliche Kopftreffer zeigen einen optionalen lokalen Zeitlupeneffekt: Schädelsplitter bewegen sich für 0,85 Sekunden mit 18 % Geschwindigkeit; die Fallanimation dauert 1,3 Sekunden. Die laufende Simulation und Steuerung werden nicht verlangsamt.
- In der Grafikprüfung lässt sich unter „Kampf · Nahansicht“ mit „Kopftreffer prüfen“ und „Figur wiederherstellen“ der Effekt reproduzieren; die Kettensäge ist dort ebenfalls auswählbar.

Die Werte sind ein erster Balance-Stand; ein gemeinsamer Spieltest bleibt für die Feinabstimmung sinnvoll.

Sprinten hält maximal 3,2 Sekunden an. Nach 0,9 Sekunden Ruhe lädt die Ausdauer
innerhalb von 4 Sekunden vollständig auf; nach vollständiger Erschöpfung muss
sie ganz aufgeladen sein. Unter **Einstellungen → Sprint-Verhalten** kann
zwischen Halten und Umschalten gewählt werden. Die Spielregeln gelten auf dem
Server und für alle Spieler gleich.

Die Laufkamera interpoliert zwischen den 30-Hz-Spielschritten; kleine
Netzwerkkorrekturen werden geglättet. Munition und Nachladestatus stehen direkt
neben der Waffe, die eigenen Kills und Tode oben links. **Rangliste / Tab** zeigt
die aktuellen Werte aller Spieler. Die Stufe Hoch spart den zusätzlichen
Bloom-Pass; Ultra behält ihn. Auto passt die Auflösung weiterhin an die Last an.


## Grafik und flüssiges Spielen

**Hoch** ist die Voreinstellung für neue Grafikprofile; eine bereits gespeicherte
Auswahl bleibt erhalten. **Auto · Ziel 60 FPS** passt die Auflösung an die Last an.
Oberfläche und HUD können in
1920 × 1080 dargestellt werden; im Auto-Modus startet das 3D-Bild mit maximal 1280 × 720
internen Pixeln. Unter dauerhafter Last reduziert die Automatik die Auflösung
bis auf 540 Bildzeilen. Die festen Stufen Flüssig, Hoch und Ultra bleiben verfügbar.
Auto verwendet SMAA, aktualisiert Schatten mit bis zu 30 Hz und lässt die teuren
AO-/Bloom-Pässe aus. Höhere feste Stufen priorisieren Bildqualität.

Die Überarbeitung umfasst PBR-Putz-/Felsmaterialien, vertiefte Fensterrahmen,
Sockelmauerwerk, Schornsteine, unregelmäßige Felsformen mit identischer Client-/
Server-Kollision, animiertes Wasser, anatomische Waffenhände und geglättete
Ziel-, Lauf-, Rückstoß- und Nachladebewegungen. Statische Waffen- und Weltteile
werden gebündelt; Kistenstapel sind instanziert.

### Neue Karten und Waffengrafik

- **Sturmzone · Küstenwacht:** eigene kompakte Inselarena mit Küste, Palmen,
  Gras- und Sandwegen, Containern, 14 begehbaren Militärposten und erhöhtem
  Funkposten mit zwei Treppenwegen. Zwei taktische Militäruniformen mit
  Schutzweste, Funkgerät und Helm sind für die beiden Einheiten verfügbar.
- **Operation Abendrot:** eigenes Güterviertel von 1944 mit Gleisen,
  Güterwagen, Lastwagen, Sandsackstellungen, Ruinen und 16 begehbaren Gebäuden.
- Die Insel ist bis zum Küstenradius von 122 m begehbar. Das Güterviertel
  bietet ein 236 × 236 m großes Spielfeld. Außenposten und äußere Wohn-/
  Werksgebäude besitzen dieselben Türen, Innenräume und Treppen wie das Zentrum.
- Die Live-Rangliste ist im Einsatz über **Rangliste** oder durch Gedrückthalten
  von **Tab** erreichbar und zeigt Kills und Tode aller Spieler. Eigene
  Tab-Tastenbelegungen bleiben erhalten; der Button funktioniert weiterhin.
- Beide Karten verwenden die bestehenden Teamgefechte mit bis zu acht Spielern.
  Ein Battle-Royale-Regelwerk mit Beute, schrumpfender Zone und Ausscheiden
  ist nicht implementiert.
- Kar98k, MP40, M1 Garand, Thompson und Luger P08 verwenden importierte,
  texturierte Modelle. Die Lizenzen und Urheber stehen in
  [CREDITS.txt](public/shooter/models/realistic/CREDITS.txt). Das G36 bekommt
  getrennte Polymer- und Stahloberflächen mit feinen Materialdetails.
- Die eigene Waffenperspektive bleibt unabhängig vom eingestellten Sichtfeld.
  Mündungsfeuer und Leuchtspuren berücksichtigen dieselbe Projektion. Welt-AO
  überlagert die Waffen nicht; der Nahbereich wird separat gerendert.
- Neue 2K-Fototexturen für Pflaster, Putz, Schiefer, Gras und Sand enthalten
  Normal-, Rauigkeits- und AO-Kanäle. Kleine Trümmer, Unkraut, Regenrohre und
  Wandlampen ergänzen die vorhandenen Karten.

Die Downloadrezepte `scripts/fetch-realistic-weapons.py` und
`scripts/fetch-map-materials.py` prüfen Herkunft, Lizenzen und Prüfsummen.
Die Inselvorschau ist unter
`http://127.0.0.1:5173/tests/graphics-preview.html?view=storm&quality=high`
erreichbar; `view=frontline` öffnet das Güterviertel. Ein bereits laufender
lokaler Spielserver muss nach dem Update neu gestartet werden, damit er die
zusätzlichen Karten kennt.

Die reproduzierbare Grafikprüfung liegt unter
`http://127.0.0.1:5173/tests/graphics-preview.html` und bietet feste Kameras,
Waffenwechsel, Nachladen und acht Figuren (historisch oder Bonus-Mix). Die Anzeige misst 120 Bildintervalle
nach fünf Sekunden Anlaufzeit. 60 FPS sind ein Ziel, keine Hardwaregarantie.

Aktueller Veröffentlichungsumfang: **lokaler Betrieb und GitHub-Quellstand**.
Es wird keine Live-Umgebung automatisch veröffentlicht.

## Local checks

```
npm ci
npm test
npm run build
npm run test:network
```

The network test starts its own local server and eight real WebSocket clients, verifies admission, room lookup, countdown, inputs and reconnect. A WebSocket proxy applies 25–75 ms delay in each direction (50–150 ms RTT); it does not emulate packet loss. Unit tests cover combat, spawn, timing and collision. Browser QA uses `node --import tsx tests/preview.ts`: open `http://127.0.0.1:5173/` and create a local player profile. A second browser profile can register another player. The legacy dummy-ticket endpoint is retained for isolated CLI and embedding checks; it is not used by the standalone start page.

## SupportHub integration

`python integration/install.py <absolute-Ticketsystem_Support-path>` installs shooter-owned files and adds the lazy gate and ticket router without replacing existing CasinoShell behavior. Run `npm install` in SupportHub afterward. In the casino module, Ctrl+Alt+G opens/closes the game. The game has its own database and never calls Jira mutation APIs.

The new `POST /api/shooter/ticket` requires the existing Entra bearer token, the `Support.Agent` role and `SHOOTER_ENABLED=true`. It returns a 120-second signed game admission token, server URL and stable player ID. No game secret is sent to the browser. `GET /rooms/:code` and `GET /stats` on the game host also require a game ticket. Existing rooms use SDK reconnection credentials for the ten-second reconnect window.

## Deployment

1. Verify the actual app release/host and free CPU/RAM before deploying. The repository contains both Azure and Komodo configurations; no live host is assumed.
2. Set unique secrets using `.env.example`; use hexadecimal database passwords to avoid URL escaping issues. Keep the same `SHOOTER_TICKET_SECRET` on game and existing backend.
3. Deploy this directory as a separate Komodo stack using `compose.yml`. Configure TLS and WebSocket forwarding with `deploy/nginx.conf`, including external network connectivity if the reverse proxy is containerized. The published port is intentionally loopback only.
4. Add `deploy/supporthub-shooter.override.yml` to the existing app stack's Compose files. Set `SHOOTER_PUBLIC_URL` and exact allowed browser origin. Leave `SHOOTER_ENABLED=false` until the closed test passes.
5. Test `/health`, existing Entra login, two browsers, eight clients, reconnect, result persistence and restore from backup. Run `deploy/backup.ps1` from this repository for a binary PostgreSQL dump; schedule it on the host and copy backups independently. Restore with `pg_restore` into an isolated test database first.
6. Enable the feature. To roll back, set `SHOOTER_ENABLED=false` and stop the game stack; normal app routes continue to operate. Existing matches are lost on game-server restart and never counted.

## Verification limits

No production deployment, physical-PC FPS measurement, historical asset review, PostgreSQL restore or real Entra browser login is implied by automated checks. Both maps have six accessible buildings and two stair routes in each of their three two-storey buildings. Audio remains synthesized; historical detailing, full motion-captured animation and broad hardware testing remain open. See THIRD_PARTY_NOTICES.md and per-asset provenance before distributing.

## Earlier integration verification (12 November 2026)

- 8 game/protocol tests passed; 2 backend ticket tests passed.
- Eight actual WebSocket clients completed an accelerated 15-second match and rematch behind an ordered 50–150ms RTT proxy; admission, room lookup, countdown, invalid input and reconnect checks passed.
- Two separate browser tabs joined one room with distinct local test identities and reached the running 3D view. No browser errors were recorded at that stage. This was not a complete ten-minute manual combat session.
- Shooter production build and the integrated SupportHub production build passed; SupportHub module boundaries and isolated-checkout TypeScript checks passed.
- The normal SDK installation hit filesystem errors in the original OneDrive folder. The SDK and its private dependencies were copied from the successfully installed isolated checkout; the npm-generated lockfile was copied back. No existing dependency package was overwritten.
- Not verified: live deployment/host capacity, real Entra login end-to-end, PostgreSQL persistence/restore, physical hardware FPS, complete manual inspection of all upstairs routes, or final historical fidelity.

The direct TypeScript rerun in the original OneDrive tree was stopped after several minutes without completion; the same integrated source passed TypeScript and production build in the isolated checkout. No passing result is claimed for that stalled rerun. Local QA servers were stopped after testing.

## Spielerprofile und Einsatzliste

Die eigenständige Startseite verlangt vor dem Lobbyzugang ein Spielerprofil:
Benutzername (3–24 Zeichen) und Passwort (8–128 Zeichen), ohne E-Mail-Adresse.
Vorhandene Profile können sich wieder anmelden. Der Server speichert individuelle
Salt-/scrypt-Passworthashes und nur gehashte, widerrufbare Sitzungstokens.
Sitzungscookies sind HttpOnly und SameSite=Lax, in Produktion zusätzlich Secure.
Produktion benötigt HTTPS und `NODE_ENV=production`.

Benötigt wird Node **22.13 oder neuer** (node:sqlite ohne Startflag).
Die lokale Datenbank liegt in `data/users.sqlite`, optional über
`SHOOTER_ACCOUNTS_DB` konfigurierbar. Sie muss dauerhaft gespeichert und gesichert
werden; Compose bindet dafür das Volume `shooter-users` ein. Diese Datenbank und
Testdaten werden weder in Git noch in das Docker-Buildkontext übernommen.
Der vorhandene PostgreSQL-Speicher für Matchstatistiken bleibt separat.

`npm run preview:solo` startet die lokale Anwendung samt Spielserver auf
http://127.0.0.1:5173. Die HTTP-/WebSocket-Weiterleitung `/game` muss im Hosting
auf den Spielserver zeigen; `SHOOTER_ORIGINS` begrenzt erlaubte Browserursprünge.
`SHOOTER_PUBLIC_URL` kann die öffentliche Spielserver-URL überschreiben.
Die bestehende SupportHub-Einbettung mit Zugangsticket bleibt unterstützt.

Die Lobby zeigt offene und laufende öffentliche Einsätze alle fünf Sekunden mit
Karte, Host und Belegung. Training erscheint nicht in dieser Liste. Ein freier
Platz kann auch im laufenden Gefecht belegt werden; neue Spieler erhalten drei
Sekunden Einstiegsschutz. Die kompakte Figurenauswahl öffnet sich erst beim
Erstellen oder Beitreten. Tests: `node --import tsx tests/accounts-network.ts`.

## Umgebung und Bewegung

Neue CC0-Fassadenmodule mit PBR-Texturen, flache Militärdächer mit Aufbauten,
fotografierte Vegetation und Küstenfelsen ergänzen die Umgebung. Sturmzone und
Abendrot nutzen ein gemeinsames Höhenfeld für Darstellung und Bewegung; Wege,
Gebäudeeingänge und Spawnpunkte bleiben eben. Acht übertragene Animationsclips
werden für Militärfiguren überblendet; Bonusfiguren behalten ihre eigenen Rigs.
Quellen und Konvertierung sind in THIRD_PARTY_NOTICES.md dokumentiert.

## Stadtbewohner

Vier unbewaffnete Hintergrund-NPCs pro Karte nutzen das vorhandene Figurenmodell mit ziviler Kleidung, Flicken und Schultertaschen. Sie wandern auf festen, trockenen Straßenrouten mit Pausen. Ihre Positionen werden aus der Spielzeit abgeleitet; sie zählen nicht als Spieler und vergeben keine Punkte. Im laufenden Spiel sind sie serververwaltete, verletzbare und tötbare NPCs; die reine Grafikvorschau verwendet weiterhin lokale Wanderer. Dialoge sind nicht enthalten.

## Begehbare Innenräume

Alle zwölf Gebäude besitzen unterschiedliche Einrichtung (Wohnung, Funkwache, Versorgung, Bahnhof, Kommandostelle und Unterkunft), Bodenbeläge, Lampen, Deckung und sichtbare Gebrauchsspuren. Häuser mit Obergeschoss haben zwei Treppen mit oberen Podesten; eingeschossige Häuser zusätzliche seitliche Durchbrüche. Die mittleren Laufwege bleiben frei.

Mit **E** (unter Einstellungen änderbar) werden nahe Türen und Lichtschalter bedient; der Hinweis erscheint beim Annähern und Hinsehen. Türen starten geöffnet. Der Server prüft Entfernung, Sicht und belegte Türflächen. Seitliche Fensterscheiben stoppen den ersten Schuss und zerbrechen; einige sind anfangs bereits beschädigt. Türen, Lampen und Scheiben werden an alle Clients übertragen, bei Wiederverbindung übernommen und zu Beginn einer neuen Runde zurückgesetzt.

Innenraumlicht, leichter Staub, unterschiedliche Schritte auf Holz/Fliesen, Treppenknarren, Tür-/Glasgeräusche und gedämpfte Außenquellen ergänzen die Räume. Maximal vier lokale Lampen sind gleichzeitig aktiv; statische Einrichtung wird nach Material gebündelt. Geräusche sind synthetisiert. Die Fassadenfenster an Vorder- und Rückseiten bleiben dekorativ; zerstörbar sind die seitlichen Scheiben.

Die Grafikprüfung bietet „Funkwache innen“, „Obergeschoss“ und „Bahnhof innen“ mit Licht-, Tür- und Glasvorschau. Diese Vorschauknöpfe prüfen die Darstellung; echte Serverinteraktionen werden separat mit acht Netzwerkclients getestet. Testports lassen sich über TEST_GAME_PORT / TEST_PROXY_PORT setzen.

## Lobby-Fahrzeug

Das Hintergrundbild verwendet einen deutschen VW Kübelwagen Typ 82 anstelle des amerikanischen Jeeps. Login und Lobby laden die cache-versionierte Datei `encampment-v2.webp`; Bildquelle und Bearbeitungsprompt stehen in `public/shooter/lobby/provenance.json`. Die Szene wurde mit dem eingebauten Imagegen-Werkzeug bearbeitet.

## Prüfstand · 16. November 2026

- 109 automatisierte Tests bestanden; TypeScript und Produktionsbuild erfolgreich.
- Echte Netzwerkclients: Solo-Privatsphäre, Koop-Bereitschaft, Wiederverbindung, einmalige Geschenke, Projektilübertragung und Hostwechsel geprüft.
- Zwei getrennte Browser starteten gemeinsam eine Alpen-Nachtmission; Raumcode-Beitritt wählte die richtige Karte. Mehrspieler mit Nebel wurde ebenfalls geprüft, ohne JavaScript-Fehler. Dieser UI-Test drosselt die Softwaregrafik und aktiviert Bereitschaft über DOM-Ereignisse; er ist keine FPS-Messung.
- Alle 15 Figuren wurden intakt, verletzt/kriechend und wiederhergestellt dargestellt. Ein tatsächlicher 1280×720-WebM-Export mit VP8/Opus-Spielaudio wurde geprüft.
- Nachweise liegen lokal unter `artifacts/operations-20261116/`. Kein Produktions-Rollout. Langzeitmessungen auf physischer Spielhardware und vollständige manuelle Gefechte auf jeder Karte bleiben offen.

## Einmaliges Changelog

Beim ersten App-Start für dieses Update erscheint eine Übersicht der Neuerungen. „Verstanden“ oder Escape bestätigt sie; weitere Starts und die anschließende Anmeldung öffnen sie im selben Browserprofil nicht erneut. Desktop, mobile Darstellung, Neuladen und Anmeldung sind mit `tests/release-notes-browser.py` geprüft.

## Heilung, Überreste und Tragen

- **H** verwendet ein Medkit: nach vier ungestörten Sekunden +50 Lebenspunkte und
  gestoppter Blutverlust. Fehlende Gliedmaßen bleiben bestehen. **E** heilt einen
  nahen verletzten Mitspieler mit dem eigenen Medkit. Die Tasten sind umbelegbar.
- Leichen und abgetrennte Teile bleiben bis zum neuen Einsatz liegen. **E** hebt
  einen Arm, ein Bein oder einen Kopf auf; Angriff schwingt das Teil als Keule,
  **G** wirft es. Ohne gehaltenes Teil wirft G wie bisher einen Wurfstern.
  Die Waffentasten 1–4 legen das gehaltene Teil ab.
- **Umschalt+E** startet am Kopf einer Leiche eine dreisekündige Aktion. Bewegung,
  Angriff, Schaden und Verbindungsabbruch unterbrechen sie. Der Kopf behält das
  ursprüngliche Gesicht und die Kleidung des Opfers.
- **E** trägt eine Leiche oder legt sie ab. Sie absorbiert frontale Treffer mit
  bis zu 150 zusätzlichen Schildpunkten; der verbleibende Wert steht neben den
  Lebenspunkten. Er füllt sich beim erneuten Aufheben nicht auf. Tragen verlangsamt
  die Bewegung und verhindert Sprint und Sprung.
- Im Koop kann die Leiche des aktuellen Partnerlebens am eigenen Erste-Hilfe-Zelt
  mit **E** abgegeben werden. Nach acht Sekunden steht der Partner vollständig
  wiederhergestellt dort auf. Gegner und Leichen früherer Leben sind ausgeschlossen.

Überreste, Schild, Heilung, Würfe und Wiederbelebung werden vom Server verwaltet.
Ruhende Überreste benötigen keine laufende Physiksimulation; Netzwerkpakete
übertragen nur geänderte Leichen und Teile. Figurenanimationen außerhalb der Nähe
werden seltener aktualisiert, statische Kollisionsdaten zwischengespeichert und
gleichzeitige Trefferpartikel in drei Zeichenaufrufen gebündelt.

Zusätzliche Prüfungen: `tests/remains.test.ts`, `tests/protocol.test.ts`,
`tests/remains-network.ts` (drei echte WebSocket-Clients),
`tests/remains-browser.py`, `tests/movement-browser.py` und
`tests/static-skinning.test.ts`. Die Browserprüfungen verwenden Softwaregrafik;
sie belegen keine Bildrate auf physischer Spielhardware. Die vorhandenen Modelle
bleiben die gestalterische Grundlage; insbesondere ein nachträglich erzeugtes
Skelett ersetzt keine vollständig neu modellierte Figur.

Kostenlose zivile Ersatzkandidaten wurden separat beschafft und im Renderer
geprüft. Quelle, Lizenz, lokale Dateien und verbleibende Integrationsschritte:
[Kostenlose Figurenkandidaten](docs/free-character-candidates.md).

## Ergänzende Prüfung · Bewegung und Überreste

- 159 automatisierte Tests bestanden; TypeScript und Produktionsbuild erfolgreich.
- Alle 15 Figuren erneut unter WebGL geprüft: Beinbewegung, alle fünf abtrennbaren
  Regionen und passende Waffengriffe; keine JavaScriptfehler.
- Drei echte WebSocket-Clients prüfen Medkit-Heilung am Partner, einmalige Aufnahme,
  sofortiges Werfen nach E, Schildschaden und die Wiederherstellung im Sanitätszelt.
  Solo-/Koop-Raumregeln sowie der bestehende Acht-Client-Latenz-/Rematchtest bestanden.
- Changelog auf Desktop und Mobilgerät, Bestätigung, Neuladen und Anmeldung geprüft.
- Trefferpartikel benötigen im WebGL-Vergleich drei statt bis zu 256 Zeichenaufrufe.
  Die lokalen CPU-/Softwaregrafikmessungen sind keine FPS-Abnahme auf Spielhardware.
- Videoexport separat mit kleiner Softwaregrafik-Vorschau und 1280×720-Zieldatei
  geprüft. `tests/replay-browser.py` benötigt zusätzlich PyAV und prüft echte
  unterschiedliche Frames sowie Video-/Audiospuren; `VIDEO_QA_WIDTH` und
  `VIDEO_QA_HEIGHT` steuern nur die Quellvorschau. Hohe Aufnahme-Bildraten auf
  physischer Spielhardware sind weiterhin offen.
- Zusammenbrechen und fliegende Teile sind animiert; ein vollständiges physikalisches
  Ragdoll ist nicht enthalten. Die Modellqualität bleibt bei einzelnen Bonusfiguren
  und den vorhandenen zivilen Grundfiguren sichtbar begrenzt.

Nachweise: `artifacts/movement-combat-20261116/`, `artifacts/remains-client/` und
`artifacts/static-skinning-20261116/`. Kein Produktions-Rollout.

## Gemeinsames Update · Stadtbewohner, Waffen und Audio

Der neue Rocketbox-Stadtbewohner, die deutsche Waffenauswahl mit fünf Plätzen und
die überarbeiteten Gefechtsgeräusche sind gemeinsam integriert. Kroenen und Deadpool
bleiben erhalten. Das Start-Changelog trägt die Kennung
`npc-weapons-audio-details-2026-11-16`: Auch nach Bestätigung der vorherigen Übersicht erscheint
dieses Update einmal; Bestätigung, Neuladen, Anmeldung und Mobilansicht sind geprüft.

Die gemeinsame Abnahme umfasst 181 erfolgreiche Tests und den Produktionsbuild.
Zusätzliche Integrationsregressionen sichern das gewählte Loadout nach Zeltbehandlung,
den Munitionsnachschub für alle Waffen und die P38 bei Armverlust/Leichentragen ab.
Die Drittpersonen-Waffen liegen nach Bündelung wieder innerhalb des bisherigen
Zeichenbudgets. Browsernachweise liegen unter `artifacts/coordinated-release/`,
`artifacts/weapon-loadout-20261116/` und `artifacts/audio-overhaul-20261116/`.
Den Server-Rollout übernimmt der Betreiber; aus diesem Chat wurde kein Deployment ausgeführt.
